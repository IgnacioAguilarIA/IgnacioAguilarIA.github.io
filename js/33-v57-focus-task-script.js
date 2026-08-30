(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const key=()=>`agendaV57FocusTask:${currentUser?.id||'guest'}`;
  let selectedId='';
  let running=false, remaining=1500, duration=1500, startedAt=null, timer=null;
  function read(){try{const x=JSON.parse(localStorage.getItem(key())||'{}');return {tasks:x.tasks&&typeof x.tasks==='object'?x.tasks:{},sessions:x.sessions&&Array.isArray(x.sessions)?x.sessions:[]}}catch{return {tasks:{},sessions:[]}}}
  function write(x){try{localStorage.setItem(key(),JSON.stringify(x))}catch{}}
  function fmt(sec){sec=Math.max(0,Math.round(sec));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
  function taskList(){return Array.isArray(tasks)?tasks.filter(t=>!t.completed).sort((a,b)=>(Number(a.day)-Number(b.day))||((Number(a.hour)||0)*60+(Number(a.minute)||0))-((Number(b.hour)||0)*60+(Number(b.minute)||0))):[]}
  function renderTaskOptions(){const sel=q('v57FocusTaskSelect');if(!sel)return;const current=selectedId;sel.innerHTML='<option value="">Sesión libre (sin tarea)</option>';taskList().forEach(t=>{const o=document.createElement('option');o.value=String(t.id);o.textContent=`${t.title} · ${String(Number(t.hour)||0).padStart(2,'0')}:${String(Number(t.minute)||0).padStart(2,'0')}`;sel.appendChild(o)});sel.value=taskList().some(t=>String(t.id)===current)?current:'';selectedId=sel.value;renderSelected();renderTotals()}
  function renderSelected(){const sel=q('v57FocusTaskSelect'),open=q('v57FocusTaskOpen'),meta=q('v57FocusTaskMeta');const t=selectedId&&Array.isArray(tasks)?tasks.find(x=>String(x.id)===selectedId):null;if(sel&&sel.value!==selectedId)sel.value=selectedId;if(open)open.disabled=!t;if(meta)meta.textContent=t?`📚 ${t.title} · ${typeof getPriority==='function'?getPriority(t):'normal'} · ${String(Number(t.hour)||0).padStart(2,'0')}:${String(Number(t.minute)||0).padStart(2,'0')}`:'Sesión libre: el tiempo no queda asociado a una tarea.';q('v56FocusTask').textContent=t?.title||'Sesión libre';q('v56FocusSub').textContent=running&&t?'Concentrate en una sola tarea hasta que termine el bloque.':running?'Concentrate en el bloque actual.':'El contador registra solo el tiempo que dejás correr.'}
  function renderTotals(){const x=read(),id=selectedId,total=id?Number(x.tasks[id])||0:0;q('v57FocusTaskTotal').textContent=total+' min';q('v57FocusTaskTotalLabel').textContent=id?'Tiempo total registrado para esta tarea':'Seleccioná una tarea para ver su tiempo acumulado';const host=q('v57FocusTaskList');if(!host)return;host.innerHTML='';const entries=Object.entries(x.tasks).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,8);const map=new Map((Array.isArray(tasks)?tasks:[]).map(t=>[String(t.id),t]));entries.forEach(([id,mins])=>{const t=map.get(String(id));if(!t)return;const row=document.createElement('div');row.className='v57-focus-task-row';row.innerHTML=`<div><div class="v57-focus-task-row-title">${esc(t.title)}</div><div class="v57-focus-task-row-meta">${String(Number(t.hour)||0).padStart(2,'0')}:${String(Number(t.minute)||0).padStart(2,'0')}</div></div><div class="v57-focus-task-row-time">${mins} min</div>`;row.onclick=()=>{selectedId=String(id);renderTaskOptions()};host.appendChild(row)})}
  function replaceButton(id,handler){const old=q(id);if(!old)return null;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('click',handler);return fresh}
  function clearTimer(){if(timer){clearInterval(timer);timer=null}}
  function record(spent){const mins=Math.max(1,Math.round(spent/60));const x=read();x.sessions.push({at:new Date().toISOString(),minutes:mins,taskId:selectedId||null});if(selectedId)x.tasks[selectedId]=(Number(x.tasks[selectedId])||0)+mins;while(x.sessions.length>200)x.sessions.shift();write(x);renderTotals()}
  function update(){q('v56FocusTimer').textContent=fmt(remaining);q('v56FocusBadge').textContent=running?'En curso':'Listo';q('v56FocusPanel')?.classList.toggle('running',running);renderSelected()}
  function stop(){clearTimer();running=false;startedAt=null;remaining=duration;update()}
  function finish(){if(!startedAt&&!running&&remaining===duration){q('v56FocusNote').textContent='No hay una sesión en curso.';return}const spent=Math.max(0,duration-remaining);if(spent>=60){record(spent);q('v56FocusNote').textContent=`✅ Registrados ${Math.round(spent/60)} min${selectedId?' para esta tarea.':'.'}`}else{q('v56FocusNote').textContent='Sesión demasiado corta para registrarla.'}stop()}
  function start(mode){if(running)return;duration=mode;remaining=mode;running=true;startedAt=Date.now();update();clearTimer();timer=setInterval(()=>{remaining--;if(remaining<=0){remaining=0;clearTimer();running=false;record(mode);q('v56FocusNote').textContent=`🎉 Sesión completa. ${selectedId?'Tiempo asociado a la tarea.':''}`;update();return}update()},1000)}
  function togglePause(){if(running){running=false;clearTimer();update();q('v56FocusNote').textContent='⏸ Pausado. Retomá cuando quieras.'}else if(remaining<duration&&remaining>0){running=true;startedAt=Date.now();timer=setInterval(()=>{remaining--;if(remaining<=0){remaining=0;clearTimer();running=false;record(duration);q('v56FocusNote').textContent='🎉 Sesión completa.'}update()},1000);update()}}
  function bind(){
    const b25=replaceButton('v56Focus25',()=>start(1500));
    const b50=replaceButton('v56Focus50',()=>start(3000));
    const bp=replaceButton('v56FocusPause',togglePause);
    const bs=replaceButton('v56FocusStop',finish);
    q('v57FocusTaskSelect')?.addEventListener('change',e=>{selectedId=e.target.value;renderSelected();renderTotals()});
    q('v57FocusTaskOpen')?.addEventListener('click',()=>{const t=Array.isArray(tasks)?tasks.find(x=>String(x.id)===selectedId):null;if(t)openTaskModal?.(Number(t.hour)||7,Number(t.minute)||0,t)});
    renderTaskOptions();update();
    const observer=setInterval(()=>{if(!currentUser)return;renderTaskOptions();},30000);
    window.addEventListener('beforeunload',()=>{clearInterval(observer);clearTimer()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else setTimeout(bind,50);
})();
