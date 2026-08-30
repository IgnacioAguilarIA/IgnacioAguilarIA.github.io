(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const storageKey=name=>`agendaV33:${currentUser?.id||'guest'}:${name}`;
  const readJSON=(name, fallback)=>{try{const r=localStorage.getItem(storageKey(name));return r?JSON.parse(r):fallback}catch(_){return fallback}};
  const writeJSON=(name,value)=>{try{localStorage.setItem(storageKey(name),JSON.stringify(value))}catch(_) {}};
  const escHtml=v=>String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const pad=n=>String(n).padStart(2,'0');
  const dayLabel=i=>Array.isArray(DAYS)?DAYS[i]||'Día':`Día ${i+1}`;
  const priorityMeta={urgent:['🔴','Urgente'],high:['🟠','Alta'],normal:['🔵','Normal'],low:['⚪','Baja']};
  let habits=readJSON('habits',[]), notes=readJSON('notes',[]);
  let priorityMap=readJSON('priorities',{});

  function uid(prefix='id'){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
  function todayKey(){return typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10)}
  function priorityKey(t){return t?.id?String(t.id):`${t?.day}|${t?.hour}|${t?.minute}|${t?.title}`}
  function getPriority(t){return priorityMap[priorityKey(t)]||'normal'}
  window.getPriority=getPriority;
  function setPriority(t,p){priorityMap[priorityKey(t)]=p;writeJSON('priorities',priorityMap)}

  function prioritySort(a,b){const rank={urgent:0,high:1,normal:2,low:3};return (rank[getPriority(a)]-rank[getPriority(b)])||taskSort(a,b)}
  function injectTaskFields(){
    const modal=q('taskOverlay'), title=q('taskTitleInput');
    if(!modal||!title||q('v33TaskExtras'))return;
    const box=document.createElement('div');box.id='v33TaskExtras';box.className='v33-modal-grid';
    box.innerHTML=`<div class="field"><label>Prioridad</label><select class="input" id="v33TaskPriority"><option value="urgent">🔴 Urgente</option><option value="high">🟠 Alta</option><option value="normal">🔵 Normal</option><option value="low">⚪ Baja</option></select></div><div class="field"><label>Frecuencia</label><div class="input" style="display:flex;align-items:center;min-height:48px;color:#bfdbfe">📆 Semanal · según el día elegido</div></div>`;
    const desc=q('taskDescInput')?.parentElement; desc?.after(box);
    const help=document.createElement('div');help.className='v33-inline-help';help.textContent='La prioridad se guarda en este dispositivo. Las tareas de la agenda se organizan por día de semana, por lo que la rutina semanal queda disponible automáticamente.';box.after(help);
  }

  function patchTaskModal(){
    if(typeof openTaskModal!=='function'||openTaskModal.__v33)return;
    const original=openTaskModal;
    function wrapped(hour,minute=0,task=null){
      injectTaskFields();
      original(hour,minute,task);
      const p=q('v33TaskPriority');if(p)p.value=getPriority(task||{});
      const r=q('v33TaskRepeat');if(r)r.value='none';
    }
    wrapped.__v33=true;window.openTaskModal=wrapped;
  }

  function patchTaskSave(){
    const b=q('saveTaskBtn');if(!b||b.__v33)return;
    const original=b.onclick;if(typeof original!=='function')return;
    b.onclick=async function(){
      const isEdit=!!editingTaskId, oldId=editingTaskId;
      const payload={title:q('taskTitleInput')?.value.trim()||'',day:Number(q('taskDayInput')?.value)||selectedDay,hour:Number(q('taskHourInput')?.value)||selectedHour,minute:Number(q('taskMinuteInput')?.value)||0,priority:q('v33TaskPriority')?.value||'normal'};
      await original.call(this);
      const match=tasks.filter(t=>String(t.title||'')===payload.title&&Number(t.day)===payload.day&&Number(t.hour)===payload.hour&&Number(t.minute)===payload.minute).sort((a,b)=>String(b.id).localeCompare(String(a.id)))[0];
      const target=isEdit?(tasks.find(t=>String(t.id)===String(oldId))||match):match;
      if(target)setPriority(target,payload.priority);
      renderV33();
    };
    b.__v33=true;
  }

  async function expandRepeatTemplates(){
    if(!currentUser?.id)return;
    const arr=readJSON('repeatTemplates',[]);if(!arr.length)return;
    const today=new Date(todayKey()+'T12:00:00');let changed=false;const next=[];
    for(const t of arr){
      let nd=new Date(t.nextDate+'T12:00:00'), rem=Number(t.remaining)||0;
      while(rem>0&&nd<=today){
        const exists=tasks.some(x=>x.title===t.title&&x.description===(t.description||'')&&Number(x.day)===Number(t.day)&&Number(x.hour)===Number(t.hour)&&Number(x.minute)===Number(t.minute)&&!x.completed);
        if(!exists){const {error}=await sb.from('tasks').insert({user_id:currentUser.id,title:t.title,description:t.description||'',day:Number(t.day),hour:Number(t.hour),minute:Number(t.minute),completed:false});if(error)break;}
        rem--;nd.setDate(nd.getDate()+7);changed=true;
      }
      if(rem>0)next.push({...t,remaining:rem,nextDate:nd.toISOString().slice(0,10)});else changed=true;
    }
    if(changed){writeJSON('repeatTemplates',next);await loadTasks();createDays();renderSchedule();renderDashboard();renderConflicts();}
  }

  function decorateTasks(){
    document.querySelectorAll('.task').forEach(card=>{
      if(card.dataset.v33Decorated==='1')return;
      const title=card.querySelector('h4')?.textContent||'';const tm=card.querySelector('.task-time')?.textContent||'';
      const m=tm.match(/(\d{1,2}):(\d{2})/);const hh=m?Number(m[1]):0,mm=m?Number(m[2]):0;
      const task=tasks.find(t=>t.title===title&&Number(t.day)===Number(selectedDay)&&Number(t.hour)===hh&&Number(t.minute)===mm);
      if(!task)return;
      const p=getPriority(task), meta=priorityMeta[p];const el=document.createElement('div');el.className='v33-priority';el.dataset.priority=p;el.textContent=`${meta[0]} ${meta[1]}`;card.appendChild(el);card.dataset.v33Decorated='1';card.dataset.v33Priority=p;
    });
  }

  function ensureV33Tools(){
    if(q('v33Tools'))return;
    const host=q('smartPanel')?.parentElement||q('dashboard')?.parentElement||q('app');if(!host)return;
    const el=document.createElement('section');el.className='v33-tools v32-home-pane';el.setAttribute('data-v33-pane','home');el.id='v33Tools';
    el.innerHTML=`<div class="v33-tools-head"><div><h3>🧭 Organizador personal</h3><p>Plan del día, hábitos y notas rápidas en un mismo lugar.</p></div><div class="streak-badge" id="v33Streak">🔥 0 días</div></div><div class="v33-grid"><div class="v33-card"><h4>🗺 Plan recomendado</h4><div id="v33Plan" class="v33-plan-list"></div><div class="v33-actions"><button class="v33-btn" id="v33RefreshPlan">↻ Actualizar plan</button><button class="v33-btn" id="v33FocusNext">🎯 Enfocar próxima tarea</button></div></div><div class="v33-card"><h4>✅ Hábitos de hoy</h4><div id="v33Habits" class="v33-habit-list"></div><div class="v33-actions"><button class="v33-btn" id="v33AddHabit">＋ Nuevo hábito</button></div></div><div class="v33-card"><h4>📝 Notas rápidas</h4><div id="v33Notes" class="v33-note-list"></div><div class="v33-actions"><button class="v33-btn" id="v33AddNote">＋ Nueva nota</button></div></div></div>`;
    const anchor=q('smartPanel')||q('dashboard');anchor?.after(el);
    q('v33RefreshPlan').onclick=renderV33Plan;q('v33FocusNext').onclick=focusNextTask;q('v33AddHabit').onclick=addHabit;q('v33AddNote').onclick=addNote;
  }

  function dailyPlanItems(){
    const items=tasks.filter(t=>Number(t.day)===Number(selectedDay)).sort(prioritySort);
    const out=[];
    for(const t of items.slice(0,8))out.push({time:`${pad(t.hour)}:${pad(t.minute)}`,title:t.title,priority:getPriority(t),done:t.completed});
    if(!out.length)out.push({time:'—',title:'Tu día está libre. Aprovechá para planificar una tarea importante.',priority:'low',done:false});
    return out;
  }
  function renderV33Plan(){const c=q('v33Plan');if(!c)return;c.innerHTML='';dailyPlanItems().forEach(x=>{const row=document.createElement('div');row.className='v33-plan-item';row.innerHTML=`<div class="v33-plan-time">${escHtml(x.time)}</div><div style="flex:1;min-width:0"><div class="v33-plan-title">${escHtml(x.title)}</div></div><span class="v33-plan-badge v33-priority-${x.priority}">${x.done?'✓ Listo':priorityMeta[x.priority][1]}</span>`;c.appendChild(row)});if(q('v33Streak'))q('v33Streak').textContent=`🔥 ${typeof computeCurrentStreak==='function'?computeCurrentStreak():0} días`;}

  function habitStreak(h){let n=0,d=new Date();while(true){const k=d.toISOString().slice(0,10);if(!(h.doneDates||[]).includes(k))break;n++;d.setDate(d.getDate()-1);if(n>365)break;}return n}
  function renderHabits(){const c=q('v33Habits');if(!c)return;c.innerHTML='';const today=todayKey();if(!habits.length){c.innerHTML='<div class="v33-empty">Todavía no tenés hábitos. Creá uno para empezar.</div>';return;}habits.forEach((h,i)=>{const done=(h.doneDates||[]).includes(today);const row=document.createElement('div');row.className='v33-habit-item';row.innerHTML=`<div class="v33-habit-left"><button class="v33-habit-check ${done?'done':''}" type="button">${done?'✓':''}</button><div class="v33-habit-name">${escHtml(h.title)}</div></div><div class="v33-streak">🔥 ${habitStreak(h)}</div>`;row.querySelector('button').onclick=()=>{h.doneDates=h.doneDates||[];if(done)h.doneDates=h.doneDates.filter(x=>x!==today);else h.doneDates.push(today);habits[i]=h;writeJSON('habits',habits);renderHabits();renderV33Plan()};c.appendChild(row)});}
  function addHabit(){const title=prompt('Nombre del hábito:');if(!title?.trim())return;habits.push({id:uid('habit'),title:title.trim(),doneDates:[]});writeJSON('habits',habits);renderHabits()}

  function renderNotes(){const c=q('v33Notes');if(!c)return;c.innerHTML='';if(!notes.length){c.innerHTML='<div class="v33-empty">No hay notas rápidas.</div>';return;}notes.slice().reverse().slice(0,6).forEach((n,idx)=>{const row=document.createElement('div');row.className='v33-note-item';row.innerHTML=`<div class="v33-note-title">${escHtml(n.title||'Nota')}</div><div class="v33-note-body">${escHtml(n.body)}</div><div class="v33-actions"><button class="v33-btn" type="button">Editar</button><button class="v33-btn" type="button">Eliminar</button></div>`;const buttons=row.querySelectorAll('button');buttons[0].onclick=()=>editNote(n);buttons[1].onclick=()=>{notes=notes.filter(x=>x.id!==n.id);writeJSON('notes',notes);renderNotes()};c.appendChild(row)});}
  function addNote(){const title=prompt('Título de la nota:','Nota rápida');if(!title?.trim())return;const body=prompt('Contenido:');if(body===null)return;notes.push({id:uid('note'),title:title.trim(),body:String(body),updated_at:new Date().toISOString()});writeJSON('notes',notes);renderNotes()}
  function editNote(n){const title=prompt('Título:',n.title||'');if(!title?.trim())return;const body=prompt('Contenido:',n.body||'');if(body===null)return;n.title=title.trim();n.body=String(body);n.updated_at=new Date().toISOString();writeJSON('notes',notes);renderNotes()}

  function focusNextTask(){const all=tasks.filter(t=>Number(t.day)===Number(selectedDay)&&!t.completed).sort(taskSort);const next=all[0];if(!next){alert('No tenés tareas pendientes para este día.');return;}if(typeof v32SetSection==='function')v32SetSection('agenda');setTimeout(()=>{const card=[...document.querySelectorAll('.task')].find(x=>x.querySelector('h4')?.textContent===next.title&&x.querySelector('.task-time')?.textContent===`${pad(next.hour)}:${pad(next.minute)}`);card?.scrollIntoView({behavior:'smooth',block:'center'});card?.animate?.([{transform:'scale(1)'},{transform:'scale(1.03)'},{transform:'scale(1)'}],{duration:500})},250)}

  function upgradeQuickActions(){
    const grid=document.querySelector('.quick-actions-grid');if(!grid||q('v33QuickExtras'))return;
    const wrap=document.createElement('div');wrap.id='v33QuickExtras';wrap.style.display='contents';
    wrap.innerHTML=`<button id="v33QuickHabit" type="button">✅<span>Hábito</span></button><button id="v33QuickNote" type="button">📝<span>Nota</span></button><button id="v33QuickPlan" type="button">🧭<span>Plan del día</span></button>`;
    grid.appendChild(wrap);
    q('v33QuickHabit').onclick=()=>{closeQuickActions();addHabit()};q('v33QuickNote').onclick=()=>{closeQuickActions();addNote()};q('v33QuickPlan').onclick=()=>{closeQuickActions();if(typeof v32SetSection==='function')v32SetSection('home');setTimeout(()=>q('v33Tools')?.scrollIntoView({behavior:'smooth',block:'center'}),180)};
  }

  function keyboard(){document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault();addNote();return;}if(e.altKey&&e.key>='1'&&e.key<='5'){const names=['home','agenda','calendar','workout','nutrition'];if(typeof v32SetSection==='function')v32SetSection(names[Number(e.key)-1]);}})}

  function patchDashboard(){
    if(typeof renderDashboard==='function'&&!renderDashboard.__v33){const old=renderDashboard;const wrapped=function(){const r=old.apply(this,arguments);try{renderV33Plan();renderHabits();renderNotes()}catch(_){}return r};wrapped.__v33=true;window.renderDashboard=wrapped;}
    if(typeof renderSchedule==='function'&&!renderSchedule.__v33){const old=renderSchedule;const wrapped=function(){const r=old.apply(this,arguments);try{setTimeout(decorateTasks,0);renderV33Plan()}catch(_){}return r};wrapped.__v33=true;window.renderSchedule=wrapped;}
  }

  function renderV33(){try{habits=readJSON('habits',[]);notes=readJSON('notes',[]);priorityMap=readJSON('priorities',{});renderV33Plan();renderHabits();renderNotes();setTimeout(decorateTasks,0)}catch(_){} }
  function init(){
    try{injectTaskFields();patchTaskModal();patchTaskSave();upgradeQuickActions();ensureV33Tools();keyboard();patchDashboard();renderV33Plan();renderHabits();renderNotes();}catch(err){console.warn('V33 init',err)}
    const mo=new MutationObserver(()=>{try{patchTaskSave();upgradeQuickActions();ensureV33Tools();decorateTasks()}catch(_){}});mo.observe(document.body,{childList:true,subtree:true});
    setInterval(()=>{try{expandRepeatTemplates();renderV33Plan();renderHabits();}catch(_){ }},60000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
