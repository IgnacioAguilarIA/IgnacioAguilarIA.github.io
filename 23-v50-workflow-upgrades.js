(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const now=()=>typeof getArgentinaNow==='function'?getArgentinaNow():new Date();
  const today=()=>typeof getTodayIndex==='function'?getTodayIndex():((now().getDay()+6)%7);
  const pRank=t=>({urgent:0,high:1,normal:2,low:3}[typeof getPriority==='function'?getPriority(t):String(t?.priority||'normal').toLowerCase()]??2);
  const mins=t=>Number(t?.hour||0)*60+Number(t?.minute||0);
  const pad=n=>String(Math.max(0,Number(n)||0)).padStart(2,'0');
  function top3(){
    const list=(tasks||[]).filter(t=>Number(t.day)===today()&&!t.completed).sort((a,b)=>pRank(a)-pRank(b)||mins(a)-mins(b)||String(a.title||'').localeCompare(String(b.title||''))).slice(0,3);
    const host=q('v50Top3List'); if(!host)return;
    host.innerHTML='';
    if(!list.length){host.innerHTML='<div class="v50-top3-empty">✅ No tenés tareas pendientes hoy.</div>'; if(q('v50Top3Badge'))q('v50Top3Badge').textContent='Todo al día'; return;}
    list.forEach((t,i)=>{const el=document.createElement('div');el.className='v50-top3-item';const pr=typeof getPriority==='function'?getPriority(t):String(t.priority||'normal');const icon=pr==='urgent'?'🔴':pr==='high'?'🟠':pr==='low'?'⚪':'🔵';el.innerHTML=`<div class="v50-top3-rank">#${i+1} · ${icon}</div><div class="v50-top3-title">${esc(t.title||'Tarea')}</div><div class="v50-top3-meta">${pad(t.hour)}:${pad(t.minute)} · ${pr}</div>`;el.onclick=()=>{try{v32SetSection?.('agenda');selectedDay=today();createDays?.();renderSchedule?.();setTimeout(()=>{const card=[...document.querySelectorAll('.task')].find(c=>c.querySelector('h4')?.textContent===t.title&&c.querySelector('.task-time')?.textContent===`${pad(t.hour)}:${pad(t.minute)}`);card?.scrollIntoView({behavior:'smooth',block:'center'});},180)}catch(_){} };host.appendChild(el)});
    if(q('v50Top3Badge'))q('v50Top3Badge').textContent=`${list.length} prioridad${list.length===1?'':'es'}`;
  }
  function latestLog(exName,day){
    const logs=(workoutLogs||[]).filter(l=>String(l.exercise_name||'')===String(exName||'')&&String(l.performed_at||'')!==String(day||'')).slice().sort((a,b)=>String(b.performed_at||'').localeCompare(String(a.performed_at||'')));
    return logs[0]||null;
  }
  function actualData(){
    try{const active=window.__agendaTrainingActiveSession;return active||null}catch{return null}
  }
  function currentTrainingState(){
    try{
      const title=q('v28CurrentName')?.textContent?.trim();
      if(!title||typeof workoutLogs==='undefined')return null;
      const log=latestLog(title,typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10));
      const box=q('v50PrevPerf'); if(!box)return null;
      if(!log){box.style.display='block';box.innerHTML='<strong>🆕 Sin registro anterior</strong><br>Este será tu primer punto de comparación para este ejercicio.';return null;}
      box.style.display='block';
      const meta=[];if(log.reps)meta.push(`Reps: ${esc(log.reps)}`);if(log.weight)meta.push(`Peso: ${esc(log.weight)}`);if(log.rir!==null&&log.rir!==undefined&&log.rir!=='')meta.push(`RIR: ${esc(log.rir)}`);if(log.sets_completed)meta.push(`Series: ${esc(log.sets_completed)}`);
      box.innerHTML=`<strong>📈 Último registro · ${esc(log.performed_at||'')}</strong><br>${meta.join(' · ')||'Sin datos detallados.'}<div class="v50-prev-actions"><button class="v50-prev-btn" id="v50CopyPrevious" type="button">↗ Copiar reps/peso al registro actual</button></div>`;
      q('v50CopyPrevious').onclick=()=>copyPrevious(log);
      return log;
    }catch(e){return null}
  }
  function parseSeriesValues(value){
    const text=String(value??'').trim();
    if(!text)return [];
    // Supports formats such as: S1:8 · S2:10 · S3:9, 8/10/9, 8 · 10 · 9
    const tagged=[...text.matchAll(/S\s*(\d+)\s*[:=-]\s*(-?\d+(?:[.,]\d+)?)/gi)];
    if(tagged.length){
      const out=[];
      tagged.forEach(m=>{out[Math.max(0,Number(m[1])-1)]=m[2].replace(',', '.')});
      return out;
    }
    return text.split(/\s*[\/|·;,]+\s*/).map(v=>v.trim()).filter(Boolean).map(v=>v.replace(/^S\s*\d+\s*[:=-]?\s*/i,''));
  }

  function copyPrevious(log){
    try{
      const btn=q('v50CopyPrevious');
      const panel=q('v47SetList');
      if(!panel)throw new Error('No se encontró el registro actual.');
      const rows=[...panel.querySelectorAll('.v48-set-row,.v47-set-row')];
      if(!rows.length)throw new Error('No hay series cargadas para copiar.');

      const reps=parseSeriesValues(log?.reps);
      const weights=parseSeriesValues(log?.weight);
      let changed=0;
      rows.forEach((row,i)=>{
        const inputs=[...row.querySelectorAll('input')];
        if(inputs[0] && reps[i]!==undefined){inputs[0].value=String(reps[i]);inputs[0].dispatchEvent(new Event('input',{bubbles:true}));inputs[0].dispatchEvent(new Event('change',{bubbles:true}));changed++;}
        if(inputs[1] && weights.length){
          const w=weights[i]!==undefined?weights[i]:weights.length===1?weights[0]:undefined;
          if(w!==undefined){inputs[1].value=String(w);inputs[1].dispatchEvent(new Event('input',{bubbles:true}));inputs[1].dispatchEvent(new Event('change',{bubbles:true}));}
        }
      });

      // Persist through the native training bridge when it exists, without rebuilding the view.
      try{window.__agendaTrainingActualsState?.save?.();}catch(_){}
      try{if(typeof window.__agendaTrainingSaveVisible==='function')window.__agendaTrainingSaveVisible();}catch(_){}

      if(!changed)throw new Error('El registro anterior no contiene reps por serie compatibles.');
      if(btn){btn.textContent='✓ Copiado';btn.classList.add('v50-copy-done');setTimeout(()=>{btn.textContent='↗ Copiar reps/peso al registro actual';btn.classList.remove('v50-copy-done')},1400);}
    }catch(err){
      const btn=q('v50CopyPrevious');
      if(btn){btn.textContent='⚠ No se pudo copiar';setTimeout(()=>{btn.textContent='↗ Copiar reps/peso al registro actual'},1600);}
      console.warn('Agenda FICH: no se pudo copiar el registro anterior:',err);
    }
  }
  function bind(){
    top3();setInterval(top3,30000);window.addEventListener('focus',top3);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')top3()});window.addEventListener('online',top3);
    ['v28TimerStart','v28TimerPause','v28TimerReset'].forEach(id=>{
      const b=q(id);
      if(!b)return;
      const press=()=>{b.classList.remove('is-pressed');void b.offsetWidth;b.classList.add('is-pressed')};
      b.addEventListener('pointerdown',press,{passive:true});
      b.addEventListener('animationend',()=>b.classList.remove('is-pressed'));
    });
    const original=document.getElementById('v28CurrentName');
    if(original){new MutationObserver(()=>setTimeout(currentTrainingState,0)).observe(original,{childList:true,characterData:true,subtree:true});}
    setInterval(()=>{if(document.getElementById('v28WorkoutOverlay')?.classList.contains('show'))currentTrainingState()},2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.agendaV50Top3=top3;window.agendaV50TrainingContext=currentTrainingState;
})();
