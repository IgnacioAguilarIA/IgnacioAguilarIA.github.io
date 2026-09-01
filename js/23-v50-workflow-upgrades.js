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
  function copyPrevious(log){
    try{
      const btn=q('v50CopyPrevious');
      const actual=window.__agendaTrainingActuals;
      if(actual&&typeof actual.fillPrevious==='function'){
        actual.fillPrevious(log);
        if(btn){btn.textContent='✓ Pegado en Registro de lo que hiciste';setTimeout(()=>{if(btn)btn.textContent='↗ Copiar reps/peso al registro actual'},1600);}
        return;
      }
      const panel=q('v47SetList');
      if(!panel){if(btn)btn.textContent='⚠️ Abrí el registro actual primero';return;}
      const parseSeries=(value)=>{
        const out=[]; const text=String(value??'').trim(); if(!text)return out;
        text.split('·').forEach(part=>{const m=part.match(/S\s*(\d+)\s*:\s*(.*)/i);if(m){const n=Number(m[1])-1;if(n>=0)out[n]=m[2].trim()}else if(part.trim())out.push(part.trim())});
        if(out.length===1&&text.includes('/')) text.split('/').forEach((v,i)=>{if(v.trim())out[i]=v.trim()});
        return out;
      };
      const reps=parseSeries(log?.reps),weights=parseSeries(log?.weight);
      const rows=[...panel.querySelectorAll('.v48-set-row,.v47-set-row')];
      rows.forEach((row,i)=>{
        const inputs=[...row.querySelectorAll('input')];
        if(inputs[0]&&reps[i]!==undefined&&reps[i]!=='-') inputs[0].value=reps[i];
        if(inputs[1]){const w=weights[i]??(weights.length===1?weights[0]:'');if(w&&w!=='-')inputs[1].value=w;}
        inputs.forEach(input=>input.dispatchEvent(new Event('input',{bubbles:true})));
      });
      if(btn){btn.textContent='✓ Pegado en Registro de lo que hiciste';setTimeout(()=>{if(btn)btn.textContent='↗ Copiar reps/peso al registro actual'},1600);}
    }catch(err){console.warn('No se pudieron copiar los datos anteriores:',err);const btn=q('v50CopyPrevious');if(btn)btn.textContent='⚠️ No se pudo copiar';}
  }

  function bind(){
    top3();setInterval(top3,30000);window.addEventListener('focus',top3);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')top3()});window.addEventListener('online',top3);
    const original=document.getElementById('v28CurrentName');
    if(original){new MutationObserver(()=>setTimeout(currentTrainingState,0)).observe(original,{childList:true,characterData:true,subtree:true});}
    setInterval(()=>{if(document.getElementById('v28WorkoutOverlay')?.classList.contains('show'))currentTrainingState()},2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.agendaV50Top3=top3;window.agendaV50TrainingContext=currentTrainingState;
})();
