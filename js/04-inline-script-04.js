(function(){
  const $v=id=>document.getElementById(id);
  function todayLabel(){try{return new Intl.DateTimeFormat('es-AR',{timeZone:TZ,weekday:'long',day:'2-digit',month:'long'}).format(new Date()).replace(/^./,c=>c.toUpperCase())}catch{return 'Hoy'}}
  function setThemeButton(){const b=$v('themeValue');if(b)b.textContent=document.body.classList.contains('light')?'Claro':'Oscuro';const i=$v('v15ThemeBtn');if(i)i.setAttribute('aria-label',document.body.classList.contains('light')?'Cambiar a tema oscuro':'Cambiar a tema claro')}
  function toggleTheme(){const on=document.body.classList.toggle('light');localStorage.setItem('agendaTheme',on?'light':'dark');setThemeButton()}
  function restoreTheme(){if(localStorage.getItem('agendaTheme')==='light')document.body.classList.add('light');setThemeButton()}
  function setFocusButton(){const b=$v('focusValue');if(b)b.textContent=document.body.classList.contains('focus-mode')?'Activo':'Apagado';const i=$v('v15FocusBtn');if(i)i.setAttribute('aria-pressed',document.body.classList.contains('focus-mode')?'true':'false')}
  function toggleFocus(){const on=document.body.classList.toggle('focus-mode');localStorage.setItem('agendaFocusMode',on?'1':'0');setFocusButton()}
  function restoreFocus(){if(localStorage.getItem('agendaFocusMode')==='1')document.body.classList.add('focus-mode');setFocusButton()}
  function closeSearch(){const o=$v('v15SearchOverlay');if(o){o.classList.remove('show');o.setAttribute('aria-hidden','true')} searchCache=null; searchCacheAt=0;}
  function openSearch(){const o=$v('v15SearchOverlay');if(!o)return;o.classList.add('show');o.setAttribute('aria-hidden','false');const i=$v('v15SearchInput');if(i){i.value='';setTimeout(()=>i.focus(),50)};renderSearch('')}
  let searchRequestId = 0;
  let searchCache = null;
  let searchCacheAt = 0;

  async function loadGlobalSearchCorpus(){
    const now = Date.now();
    if(searchCache && (now-searchCacheAt)<30000) return searchCache;

    const [tasksRes, datesRes, workoutsRes, logsRes, mealsRes] = await Promise.all([
      sb.from('tasks').select('*').limit(1000),
      sb.from('personal_dates').select('*').limit(1000),
      sb.from('workout_exercises').select('*').limit(1000),
      sb.from('workout_logs').select('*').order('performed_at',{ascending:false}).limit(1000),
      sb.from('nutrition_meals').select('*').limit(1000)
    ]);

    const errors=[tasksRes,datesRes,workoutsRes,logsRes,mealsRes].filter(x=>x.error);
    if(errors.length) throw new Error(errors.map(x=>x.error?.message||'Error de búsqueda').join(' · '));

    let events=Array.isArray(sharedEvents)?sharedEvents:[];
    if(!events.length){
      try{
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),5000);
        const res=await fetch('./data/events.json?search='+Date.now(),{cache:'no-store',signal:controller.signal});
        clearTimeout(timer);
        if(res.ok){const data=await res.json();events=Array.isArray(data)?data:(data.events||[]);sharedEvents=events;}
      }catch(e){ console.warn('No se pudieron cargar eventos para la búsqueda:',e); }
    }

    searchCache={
      tasks:tasksRes.data||[],
      dates:datesRes.data||[],
      workouts:workoutsRes.data||[],
      logs:logsRes.data||[],
      meals:mealsRes.data||[],
      events
    };
    searchCacheAt=now;
    return searchCache;
  }

  function invalidateGlobalSearchCache(){searchCache=null;searchCacheAt=0}

  async function renderSearch(q){
    const host=$v('v15SearchResults');
    if(!host)return;
    q=String(q||'').trim().toLowerCase();
    if(!q){host.innerHTML='<div class="v15-search-empty">Escribí algo para buscar en toda tu agenda.</div>';return;}

    const request=++searchRequestId;
    host.innerHTML='<div class="v15-search-loading">🔎 Buscando en toda tu agenda…</div>';

    try{
      const corpus=await loadGlobalSearchCorpus();
      if(request!==searchRequestId)return;
      const results=[];
      const contains=(...parts)=>parts.filter(v=>v!==null&&v!==undefined).join(' ').toLowerCase().includes(q);

      corpus.tasks.forEach(t=>{
        if(!contains(t.title,t.description))return;
        results.push({
          icon:t.completed?'✅':'📚',
          title:t.title||'Tarea',
          meta:`${DAYS[Number(t.day)||0]} · ${String(Number(t.hour)||0).padStart(2,'0')}:${String(Number(t.minute)||0).padStart(2,'0')}${t.description?' · '+t.description:''}`,
          type:'Tarea',
          action:async()=>{
            selectedDay=Number(t.day)||0;
            createDays(); renderSchedule(); closeSearch();
            openTaskModal(Number(t.hour)||7,Number(t.minute)||0,t);
          }
        });
      });

      corpus.workouts.forEach(x=>{
        if(!contains(x.exercise,x.notes,x.tempo,x.weight))return;
        results.push({
          icon:'🏋️',title:x.exercise||'Ejercicio',
          meta:`${DAYS[Number(x.day)||0]} · ${x.sets||'-'} series · ${x.reps||'-'} reps · RIR ${x.rir??'-'}`,
          type:'Entrenamiento',
          action:async()=>{
            workoutDay=Number(x.day)||0;
            openWorkoutPanel();
            await loadWorkoutExercises();
            renderWorkoutList(); renderWorkoutHistory(); renderWorkoutAnalytics?.();
            closeSearch();
          }
        });
      });

      corpus.logs.forEach(log=>{
        if(!contains(log.exercise_name,log.reps,log.weight,log.notes))return;
        results.push({
          icon:'📈',title:log.exercise_name||'Registro de entrenamiento',
          meta:`${fmtDate(log.performed_at)} · ${log.sets_completed||'-'} series · ${log.reps||'-'} reps · ${log.weight||'-'}${log.notes?' · '+log.notes:''}`,
          type:'Historial',
          action:async()=>{
            workoutDay=selectedDay;
            openWorkoutPanel();
            await loadWorkoutExercises();
            await loadWorkoutLogs();
            renderWorkoutList(); renderWorkoutHistory(); renderWorkoutAnalytics?.();
            closeSearch();
          }
        });
      });

      corpus.meals.forEach(m=>{
        if(!contains(m.title,m.foods,m.description,m.meal_type))return;
        results.push({
          icon:'🍽️',title:m.title||'Comida',
          meta:`${DAYS[Number(m.day)||0]} · ${mealLabel(m.meal_type)}${m.meal_time?' · '+m.meal_time:''}${m.foods?' · '+m.foods:''}`,
          type:'Alimentación',
          action:async()=>{
            nutritionDay=Number(m.day)||0;
            activeMealType=m.meal_type;
            openNutritionPanel();
            await loadNutritionMeals();
            renderMealTabs(); renderNutritionList(); renderNutritionGoals();
            closeSearch();
          }
        });
      });

      corpus.dates.forEach(d=>{
        if(!contains(d.title,d.description,d.type,d.date))return;
        results.push({
          icon:d.type==='importante'?'⭐':'📌',title:d.title||'Fecha personal',
          meta:`${fmtDate(d.date)}${d.description?' · '+d.description:''}`,
          type:'Fecha',
          action:async()=>{closeSearch();openDateModal(d)}
        });
      });

      corpus.events.forEach(e=>{
        const date=e.date||e.fecha||'';
        if(!contains(e.title||e.titulo,e.description||e.descripcion,e.type||e.tipo,e.scope||e.alcance,date))return;
        results.push({
          icon:(mapKind(e.type||e.tipo)==='holiday'?'🇦🇷 ':mapKind(e.type||e.tipo)==='teacher'?'🟠 ':mapKind(e.type||e.tipo)==='nonteacher'?'🔴 ':mapKind(e.type||e.tipo)==='university'?'🟣 ':'📅'),
          title:e.title||e.titulo||'Evento',
          meta:`${date}${e.scope||e.alcance?' · '+(e.scope||e.alcance):''}`,
          type:'Calendario',
          action:async()=>{
            if(date){
              const parts=String(date).split('-').map(Number);
              if(parts.length===3&&parts.every(Number.isFinite)){
                currentYear=parts[0]; currentMonth=parts[1]-1; buildMonthOptions(); renderCalendar();
              }
            }
            closeSearch();
            try{openCalendarPanel?.()}catch{toggleCalendarPanel?.()}
          }
        });
      });

      results.sort((a,b)=>{
        const at=a.type==='Tarea'?0:a.type==='Entrenamiento'?1:a.type==='Alimentación'?2:a.type==='Fecha'?3:a.type==='Historial'?4:5;
        const bt=b.type==='Tarea'?0:b.type==='Entrenamiento'?1:b.type==='Alimentación'?2:b.type==='Fecha'?3:b.type==='Historial'?4:5;
        return at-bt;
      });

      const limited=results.slice(0,30);
      if(!limited.length){host.innerHTML='<div class="v15-search-empty">No encontré coincidencias en tu agenda.</div>';return;}
      host.innerHTML='';
      limited.forEach(x=>{
        const b=document.createElement('button');
        b.type='button'; b.className='v15-search-result';
        b.innerHTML=`<span class="v15-search-icon">${x.icon}</span><span><div class="v15-search-title">${esc(x.title)}</div><div class="v15-search-meta">${esc(x.meta)}</div></span><span class="v15-search-type">${esc(x.type)}</span>`;
        b.onclick=()=>x.action();
        host.appendChild(b);
      });
    }catch(err){
      if(request!==searchRequestId)return;
      console.error('Búsqueda global:',err);
      host.innerHTML=`<div class="v15-search-empty">No pude completar la búsqueda.<br><small>${esc(err?.message||'Error desconocido')}</small></div>`;
    }
  }

  function exportData(){let v33Local={};try{const prefix=`agendaV33:${currentUser?.id||'guest'}:`;v33Local={habits:JSON.parse(localStorage.getItem(prefix+'habits')||'[]'),notes:JSON.parse(localStorage.getItem(prefix+'notes')||'[]'),priorities:JSON.parse(localStorage.getItem(prefix+'priorities')||'{}')};}catch(_){}const payload={exported_at:new Date().toISOString(),account:currentUser?.email||null,tasks,personal_dates:personalDates,workout_exercises:workoutExercises,workout_logs:workoutLogs,nutrition_meals:nutritionMeals,v33_local:v33Local};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`agenda-fich-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function openSettings(){const o=$v('settingsOverlay'),d=$v('settingsDrawer');if(o)o.classList.add('open');if(d){d.classList.add('open');d.setAttribute('aria-hidden','false')}}
  function closeSettings(){const o=$v('settingsOverlay'),d=$v('settingsDrawer');if(o)o.classList.remove('open');if(d){d.classList.remove('open');d.setAttribute('aria-hidden','true')}}
  function syncSettingsExtras(){const u=$v('settingsUserEmail');if(u)u.textContent=currentUser?.email||'Tu cuenta';const r=$v('settingsReminderValue');if(r)r.textContent=(typeof remindersEnabled!=='undefined'&&remindersEnabled)?'Activos':'Apagados';const s=$v('settingsRefreshStatus');if(s)s.textContent=$v('refreshStatus')?.textContent||'Listo'}
function initV16(){restoreTheme();restoreFocus();const d=$v('v15DateLabel');if(d)d.textContent=todayLabel();syncSettingsExtras();$v('v15ThemeBtn')?.addEventListener('click',()=>{toggleTheme();syncSettingsExtras()});$v('v15FocusBtn')?.addEventListener('click',()=>{toggleFocus();syncSettingsExtras()});$v('topSearchBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openSearch()});document.getElementById('topSearchBtn')?.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();openSearch()});$v('v15SearchClose')?.addEventListener('click',closeSearch);$v('v15SearchInput')?.addEventListener('input',e=>renderSearch(e.target.value));$v('v15SearchOverlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeSearch()});$v('v15ExportBtn')?.addEventListener('click',exportData);$v('settingsImportBtn')?.addEventListener('click',()=>{$v('importDataInput')?.click()});$v('importDataInput')?.addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;window.__pendingImportFile=f;$v('importSelectModal')?.classList.add('show')});$v('importSelectClose')?.addEventListener('click',()=>{$v('importSelectModal')?.classList.remove('show');window.__pendingImportFile=null});$v('importSelectCancel')?.addEventListener('click',()=>{$v('importSelectModal')?.classList.remove('show');window.__pendingImportFile=null});$v('importSelectConfirm')?.addEventListener('click',async()=>{const f=window.__pendingImportFile;if(!f)return;const selected={tasks:$v('impTasks')?.checked!==false,dates:$v('impDates')?.checked!==false,exercises:$v('impExercises')?.checked!==false,logs:$v('impLogs')?.checked!==false,meals:$v('impMeals')?.checked!==false};$v('importSelectModal')?.classList.remove('show');window.__pendingImportFile=null;try{await importMyData(f,selected)}catch(err){console.error(err);setImportProgress('',false);alert('No se pudo importar el archivo.\n\n'+(err?.message||err))}});$v('settingsReminderBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeSettings();const p=$v('reminderPanel');if(p){p.classList.add('open');p.style.zIndex='140';}if(typeof updateReminderUI==='function')updateReminderUI();syncSettingsExtras();});$v('settingsInstallBtn')?.addEventListener('click',()=>{$v('installAppBtn')?.click()});$v('settingsLogoutBtn')?.addEventListener('click',async()=>{closeSettings();await sb.auth.signOut()});$v('settingsTopBtn')?.addEventListener('click',openSettings);$v('settingsClose')?.addEventListener('click',closeSettings);$v('settingsOverlay')?.addEventListener('click',closeSettings);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='q'){e.preventDefault();openQuickActions();return}if(e.key==='Escape'){closeSearch();closeSettings()}});setInterval(()=>{const d=$v('v15DateLabel');if(d)d.textContent=todayLabel();syncSettingsExtras()},60000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initV16);else initV16();
})();
