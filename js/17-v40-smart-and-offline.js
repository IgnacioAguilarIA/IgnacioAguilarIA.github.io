(function(){
  const q=id=>document.getElementById(id);
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const pad40=n=>String(Number(n)||0).padStart(2,'0');
  const tmin40=t=>Number(t?.hour||0)*60+Number(t?.minute||0);
  const now40=()=>typeof getArgentinaNow==='function'?getArgentinaNow():new Date();
  const today40=()=>typeof getTodayIndex==='function'?getTodayIndex():0;
  const pri40=t=>typeof getPriority==='function'?getPriority(t):'normal';
  const taskId40=t=>String(t?.id??'');
  let nextTask=null;

  function taskScore(t){
    if(!t||t.completed)return -1e9;
    const n=now40(), d=Number(t.day)||0, td=today40();
    let delta=d-td; if(delta<0)delta+=7;
    const diff=delta*1440+tmin40(t)-(n.getHours()*60+n.getMinutes());
    const p=pri40(t); const pScore=p==='urgent'?1000:p==='high'?650:p==='normal'?300:120;
    const overdue=delta===0&&tmin40(t)<n.getHours()*60+n.getMinutes()?500:0;
    const near=diff>=0&&diff<=90?220:0;
    return pScore+overdue+near-Math.max(0,diff)/12;
  }
  function pickNext(){return (tasks||[]).filter(t=>!t.completed).slice().sort((a,b)=>taskScore(b)-taskScore(a))[0]||null}
  function freeSlots40(){
    const n=now40(), day=today40(), nowMin=n.getHours()*60+n.getMinutes();
    const occupied=(tasks||[]).filter(t=>Number(t.day)===day&&!t.completed).map(t=>tmin40(t)).sort((a,b)=>a-b);
    const slots=[]; let cursor=Math.max(7*60,nowMin+5);
    for(let i=0;i<occupied.length;i++){
      const start=occupied[i];
      if(start-cursor>=25)slots.push({start,end:start,length:start-cursor});
      cursor=Math.max(cursor,start+30);
    }
    if(22*60-cursor>=25)slots.push({start:cursor,end:22*60,length:22*60-cursor});
    return slots.filter(x=>x.length>=25).slice(0,6);
  }
  function fmtSlot40(m){return `${pad40(Math.floor(m/60))}:${pad40(m%60)}`}
  function render40(){
    if(!q('v40SmartPanel'))return;
    nextTask=pickNext();
    if(nextTask){
      q('v40NextTitle').textContent=nextTask.title||'Tarea';
      q('v40NextMeta').textContent=`${DAYS?.[Number(nextTask.day)]||'Día'} · ${fmtSlot40(tmin40(nextTask))}${pri40(nextTask)==='urgent'?' · 🔴 Urgente':''}`;
    }else{q('v40NextTitle').textContent='No hay tareas pendientes';q('v40NextMeta').textContent='Podés descansar, planificar o capturar algo nuevo.'}
    const today=(tasks||[]).filter(t=>Number(t.day)===today40());
    const done=today.filter(t=>t.completed).length, pending=today.length-done, urgent=today.filter(t=>!t.completed&&pri40(t)==='urgent').length;
    q('v40DayState').textContent=urgent?`${urgent} urgente${urgent===1?'':'s'}`:pending?`${pending} pendiente${pending===1?'':'s'}`:'Todo al día 🎉';
    q('v40DayMeta').textContent=`${done}/${today.length} tareas completadas hoy`;
    const free=freeSlots40(); const total=free.reduce((s,x)=>s+x.length,0); q('v40FreePill').textContent=`🟢 Tiempo libre: ${Math.floor(total/60)}h ${total%60}m`;
    const online=navigator.onLine; q('v40OfflineState').textContent=online?'Conectado':'Sin Internet'; q('v40OfflineMeta').textContent=online?'La app puede sincronizar con Supabase.':'Los cambios quedan locales y se sincronizan al volver la conexión.';
    q('v40SmartBadge').textContent=urgent?'⚠️ Prioridad alta':pending?'🟡 Día en marcha':'✅ Día tranquilo';
    const pendingCount=document.querySelector('#v39Pending')?.textContent||''; q('v40QueueText').textContent=online?(pendingCount||'Sincronización activa'):'Sin Internet · guardado local'; q('v40Queue').classList.toggle('ok',online&&(!pendingCount||pendingCount.startsWith('0')));
  }
  function openPlan(){const o=q('v40PlanOverlay'),c=q('v40Suggestions');if(!o||!c)return;c.innerHTML='';const slots=freeSlots40();if(!slots.length){c.innerHTML='<div class="v40-suggest"><strong>No encontré un bloque libre</strong><span>Podés cambiar la duración de las tareas o revisar tu agenda.</span></div>'}else slots.slice(0,3).forEach((s,i)=>{const m=slots[i]?.length>=50?'50 min':slots[i]?.length>=40?'40 min':'25 min';const div=document.createElement('div');div.className='v40-suggest';div.innerHTML=`<strong>${fmtSlot40(s.start)}–${fmtSlot40(Math.min(s.start+Number(m.split(' ')[0]),s.end))}</strong><span>Bloque ${i+1} · ${m} disponibles para concentrarte.</span><button class="v40-btn" data-v40-focus="${s.start}" type="button">🎯 Usar para foco</button>`;c.appendChild(div)});o.classList.add('show');o.setAttribute('aria-hidden','false')}
  function closePlan(){q('v40PlanOverlay')?.classList.remove('show');q('v40PlanOverlay')?.setAttribute('aria-hidden','true')}
  function bind40(){
    q('v40FocusNow')?.addEventListener('click',()=>{try{openFocus?.(nextTask)}catch(_){}});
    q('v40OpenNow')?.addEventListener('click',()=>{if(!nextTask)return;try{selectedDay=Number(nextTask.day)||0;createDays?.();renderSchedule?.();v32SetSection?.('agenda');openTaskModal?.(Number(nextTask.hour)||7,Number(nextTask.minute)||0,nextTask)}catch(_){}});
    q('v40PlanBtn')?.addEventListener('click',openPlan);q('v40PlanClose')?.addEventListener('click',closePlan);q('v40PlanOverlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closePlan()});
    q('v40Suggestions')?.addEventListener('click',e=>{const b=e.target.closest('[data-v40-focus]');if(!b)return;closePlan();try{openFocus?.(nextTask)}catch(_){}});
    window.addEventListener('online',render40);window.addEventListener('offline',render40);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(render40,100)});
    setInterval(render40,30000);
  }

  // Offline-first queue for task CRUD. Existing online code is preserved.
  const QKEY=()=>`agendaV40:queue:${currentUser?.id||'guest'}`;
  const MAPKEY=()=>`agendaV40:idmap:${currentUser?.id||'guest'}`;
  function readQ(){try{const x=localStorage.getItem(QKEY());return x?JSON.parse(x):[]}catch(_){return []}}
  function writeQ(v){try{localStorage.setItem(QKEY(),JSON.stringify(v))}catch(_){};renderQueueMeta()}
  function readMap(){try{const x=localStorage.getItem(MAPKEY());return x?JSON.parse(x):{}}catch(_){return {}}}
  function writeMap(v){try{localStorage.setItem(MAPKEY(),JSON.stringify(v))}catch(_){} }
  function queueOp(op){const qv=readQ();qv.push({...op,at:new Date().toISOString(),qid:`q-${Date.now()}-${Math.random().toString(36).slice(2,7)}`});writeQ(qv);}
  function saveLocalSnapshot40(){try{cacheWrite?.('tasks',tasks||[]);localStorage.setItem(`agendaV40:tasks:${currentUser?.id||'guest'}`,JSON.stringify(tasks||[]))}catch(_){} }
  function renderQueueMeta(){const n=readQ().length;const el=q('v40QueueText');if(el&&navigator.onLine)el.textContent=n?`${n} operación${n===1?'':'es'} esperando sincronización`:'Sincronización activa';const bar=q('v39Pending');if(bar&&n)bar.textContent=`${n} cambios pendientes`}
  async function flushQueue(){
    if(!currentUser||!navigator.onLine)return;
    let qv=readQ();if(!qv.length)return;
    const map=readMap(); const remain=[];
    for(const op of qv){
      try{
        let id=op.id&&map[op.id]?map[op.id]:op.id;
        if(op.kind==='create'){
          const payload={...op.payload,user_id:currentUser.id};delete payload.id;
          const {data,error}=await sb.from('tasks').insert(payload).select('*').single();if(error)throw error;
          if(op.id&&data?.id)map[op.id]=data.id;
        }else if(op.kind==='update'){
          if(String(id).startsWith('local-')){remain.push(op);continue}
          const {error}=await sb.from('tasks').update(op.payload).eq('id',id);if(error)throw error;
        }else if(op.kind==='delete'){
          if(String(id).startsWith('local-')){delete map[op.id];continue}
          const {error}=await sb.from('tasks').delete().eq('id',id);if(error)throw error;delete map[op.id]
        }else if(op.kind==='complete'){
          if(String(id).startsWith('local-')){remain.push(op);continue}
          const {error}=await sb.from('tasks').update({completed:!!op.completed}).eq('id',id);if(error)throw error;
        }
      }catch(e){remain.push(op);console.warn('V40 queue op',e);break}
    }
    writeMap(map);writeQ(remain);saveLocalSnapshot40();
    if(!remain.length){try{await loadTasks();createDays?.();renderSchedule?.();renderDashboard?.();renderTodayTimeline?.();}catch(_){} if(window.agendaV39SyncNow)window.agendaV39SyncNow()}
  }
  function installTaskOfflineHandlers(){
    const saveBtn=q('saveTaskBtn');
    if(saveBtn&&!saveBtn.dataset.v40wrapped){
      const old=saveBtn.onclick; if(typeof old==='function'){
        saveBtn.onclick=async function(e){
          if(navigator.onLine){return old.call(this,e)}
          const title=q('taskTitleInput')?.value.trim()||''; if(!title){alert('Escribí el título.');return}
          const description=q('taskDescInput')?.value.trim()||''; const day=Math.max(0,Math.min(6,Number(q('taskDayInput')?.value)||selectedDay));const hour=Math.max(7,Math.min(22,Number(q('taskHourInput')?.value)||7));const minute=Math.max(0,Math.min(59,Number(q('taskMinuteInput')?.value)||0));
          const id=editingTaskId||`local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; const completed=editingTaskId?!!(tasks.find(t=>String(t.id)===String(editingTaskId))?.completed):false;
          const payload={title,description,day,hour,minute,completed,user_id:currentUser.id}; if(editingTaskId){const target=tasks.find(t=>String(t.id)===String(editingTaskId));if(target)Object.assign(target,payload);queueOp({kind:'update',id,payload:{title,description,day,hour,minute}})}else{tasks.push({...payload,id,created_at:new Date().toISOString()});queueOp({kind:'create',id,payload})}
          cacheWrite?.('tasks',tasks);saveLocalSnapshot40();closeTaskModal?.();createDays?.();renderSchedule?.();renderDashboard?.();renderTodayTimeline?.();render40();
        }
        saveBtn.dataset.v40wrapped='1';
      }
    }
    const origToggle=window.toggleTaskComplete; if(typeof origToggle==='function'&&!origToggle.__v40){const w=async function(task){if(navigator.onLine)return origToggle.apply(this,arguments);const target=tasks.find(t=>String(t.id)===String(task.id));if(!target)return;target.completed=!target.completed;queueOp({kind:'complete',id:target.id,completed:target.completed});cacheWrite?.('tasks',tasks);saveLocalSnapshot40();renderSchedule?.();renderDashboard?.();renderTodayTimeline?.();render40()};w.__v40=true;window.toggleTaskComplete=w}
    const origDelete=window.deleteTask; if(typeof origDelete==='function'&&!origDelete.__v40){const w=async function(id){if(navigator.onLine)return origDelete.apply(this,arguments);const idx=tasks.findIndex(t=>String(t.id)===String(id));if(idx<0)return;tasks.splice(idx,1);queueOp({kind:'delete',id});cacheWrite?.('tasks',tasks);saveLocalSnapshot40();renderSchedule?.();renderDashboard?.();renderTodayTimeline?.();render40()};w.__v40=true;window.deleteTask=w}
  }
  async function init40(){try{bind40();setTimeout(()=>{installTaskOfflineHandlers();render40();renderQueueMeta()},400);setInterval(()=>{installTaskOfflineHandlers();render40()},30000);window.addEventListener('online',()=>setTimeout(flushQueue,700));if(navigator.onLine)setTimeout(flushQueue,1500)}catch(e){console.warn('V40',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init40,{once:true});else init40();
  window.agendaV40Flush=flushQueue;
})();
