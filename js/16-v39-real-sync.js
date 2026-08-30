(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const uid=()=>currentUser?.id||'guest';
  const baseKey=()=>`agendaV39:${uid()}`;
  const safeRead=(key,fallback)=>{try{const r=localStorage.getItem(key);return r?JSON.parse(r):fallback}catch(_){return fallback}};
  const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
  const fp=v=>{try{return JSON.stringify(v)}catch{return String(v)}};
  const nowIso=()=>new Date().toISOString();
  let busy=false, timer=null;

  function state(){return safeRead(baseKey(),{items:{notes:{},habits:{},meta:{}},tombstones:{notes:{},habits:{meta:{}},appState:0},snapshot:{},pending:0,lastSync:null})}
  function writeState(s){safeWrite(baseKey(),s)}
  function localNotes(){return safeRead(`agendaV33:${uid()}:notes`,[])}
  function saveLocalNotes(v){safeWrite(`agendaV33:${uid()}:notes`,v)}
  function localHabits(){return safeRead(`agendaV33:${uid()}:habits`,[])}
  function saveLocalHabits(v){safeWrite(`agendaV33:${uid()}:habits`,v)}
  function localMeta(){return safeRead(`agendaV37:${uid()}:taskMeta`,{})}
  function saveLocalMeta(v){safeWrite(`agendaV37:${uid()}:taskMeta`,v)}
  function localPriorityMap(){return safeRead(`agendaV33:${uid()}:priorities`,{})}
  function localAppState(){return safeRead(`agendaV38:${uid()}`,{inbox:[],energy:null,undo:null,lastPlan:null})}
  function saveLocalAppState(v){safeWrite(`agendaV38:${uid()}`,v)}

  function ensureItemState(bucket,id,value){
    const s=state(); s.items[bucket]=s.items[bucket]||{}; const key=String(id), current=fp(value); const prev=s.items[bucket][key];
    if(!prev){s.items[bucket][key]={fp:current,updatedAt:nowIso()};s.pending=(s.pending||0)+1;writeState(s);return true}
    if(prev.fp!==current){prev.fp=current;prev.updatedAt=nowIso();s.pending=Math.max(0,(s.pending||0)+1);writeState(s);return true}
    return false;
  }

  function normalizeNote(n){return {id:String(n.id),title:n.title||'Nota',body:n.body??n.text??'',created_at:n.created_at||nowIso()}}
  function normalizeHabit(h){const doneDates=Array.isArray(h.doneDates)?h.doneDates:(Array.isArray(h.done_dates)?h.done_dates:(h.doneOn?[h.doneOn]:[]));return {id:String(h.id),title:h.title||'Hábito',doneDates:[...new Set(doneDates.filter(Boolean))],streak:Number(h.streak||0),created_at:h.created_at||nowIso()}}
  function normalizeMeta(id,v,priority){return {task_id:String(id),category:v?.category||'',subtasks:Array.isArray(v?.subtasks)?v.subtasks:[],priority:priority||v?.priority||'normal'}}
  function rebuildLocalHabitShape(rows){return rows.map(r=>({...r,doneDates:Array.isArray(r.done_dates)?r.done_dates:[],done_dates:undefined})).map(r=>{delete r.done_dates;return r})}

  function markTombstone(bucket,id){const s=state();s.tombstones[bucket]=s.tombstones[bucket]||{};s.tombstones[bucket][String(id)]=nowIso();s.pending=Math.max(1,(s.pending||0)+1);writeState(s)}

  // Captura eliminaciones de notas/hábitos sin tener que reescribir las versiones anteriores.
  document.addEventListener('click',e=>{
    if(!currentUser)return;
    const note=e.target.closest?.('[data-v36-note]'); if(note){markTombstone('notes',note.dataset.v36Note);setTimeout(syncNow,350);return;}
    const habit=e.target.closest?.('[data-v36-habit]'); if(habit){
      // El botón también sirve para completar/descompletar; solo sincronizamos el nuevo estado.
      setTimeout(()=>{const h=localHabits().find(x=>String(x.id)===String(habit.dataset.v36Habit));if(h)ensureItemState('habits',h.id,normalizeHabit(h));syncNow()},350);return;
    }
  },true);

  async function fetchAll(table,queryFn){
    try{let qy=sb.from(table).select('*'); if(queryFn)qy=queryFn(qy); const {data,error}=await qy; if(error)throw error; return data||[];}catch(e){throw e}
  }

  async function upsertRows(table,rows){if(!rows.length)return true;try{const {error}=await sb.from(table).upsert(rows,{onConflict:'id'});if(error)throw error;return true}catch(e){console.warn('V39 upsert',table,e);return false}}
  async function deleteRows(table,ids){if(!ids.length)return true;try{const {error}=await sb.from(table).delete().in('id',ids);if(error)throw error;return true}catch(e){console.warn('V39 delete',table,e);return false}}

  async function syncNotes(s){
    const local=localNotes().map(normalizeNote); const changed=[]; const tomb=s.tombstones.notes||{};
    local.forEach(n=>{if(!tomb[n.id]){if(ensureItemState('notes',n.id,n)) changed.push(n)} });
    const remote=await fetchAll('personal_notes',q=>q.order('updated_at',{ascending:false}));
    const remoteMap=new Map(remote.map(r=>[String(r.id),r])); const localMap=new Map(local.map(r=>[String(r.id),r]));
    const push=[]; const removeRemote=[];
    for(const n of local){if(tomb[n.id]){const td=new Date(tomb[n.id]);const rr=remoteMap.get(n.id);if(!rr||td>=new Date(rr.updated_at||0))removeRemote.push(n.id);continue;} const meta=s.items.notes[n.id]; const rr=remoteMap.get(n.id); if(!rr || new Date(meta?.updatedAt||0)>new Date(rr.updated_at||0)) push.push({...n,user_id:currentUser.id,updated_at:meta?.updatedAt||nowIso()}); else if(new Date(rr.updated_at||0)>new Date(meta?.updatedAt||0)){localMap.set(n.id,{...n,text:rr.body,title:rr.title,created_at:rr.created_at});}
    }
    // Remote-only rows.
    for(const rr of remote){if(tomb[String(rr.id)])continue;if(!localMap.has(String(rr.id))||new Date(rr.updated_at||0)>new Date(s.items.notes[String(rr.id)]?.updatedAt||0)){localMap.set(String(rr.id),{id:String(rr.id),title:rr.title||'Nota',text:rr.body||'',created_at:rr.created_at||nowIso()});}}
    const merged=[...localMap.values()].filter(n=>!removeRemote.includes(String(n.id))); saveLocalNotes(merged);
    await deleteRows('personal_notes',removeRemote); await upsertRows('personal_notes',push); return true;
  }

  async function syncHabits(s){
    const local=localHabits().map(normalizeHabit); const tomb=s.tombstones.habits||{};
    local.forEach(h=>{if(!tomb[h.id])ensureItemState('habits',h.id,h)});
    const remote=await fetchAll('personal_habits',q=>q.order('updated_at',{ascending:false})); const remoteMap=new Map(remote.map(r=>[String(r.id),r])); const mergedMap=new Map(local.map(h=>[String(h.id),h])); const push=[],removeRemote=[];
    for(const h of local){if(tomb[h.id]){const td=new Date(tomb[h.id]),rr=remoteMap.get(h.id);if(!rr||td>=new Date(rr.updated_at||0))removeRemote.push(h.id);continue;}const meta=s.items.habits[h.id],rr=remoteMap.get(h.id);if(!rr||new Date(meta?.updatedAt||0)>new Date(rr.updated_at||0))push.push({id:h.id,user_id:currentUser.id,title:h.title,done_dates:h.doneDates||[],created_at:h.created_at||nowIso(),updated_at:meta?.updatedAt||nowIso()});else if(new Date(rr.updated_at||0)>new Date(meta?.updatedAt||0))mergedMap.set(h.id,normalizeHabit({id:rr.id,title:rr.title,done_dates:rr.done_dates,created_at:rr.created_at}));}
    for(const rr of remote){if(tomb[String(rr.id)])continue;if(!mergedMap.has(String(rr.id))){mergedMap.set(String(rr.id),normalizeHabit({id:rr.id,title:rr.title,done_dates:rr.done_dates,created_at:rr.created_at}));}}
    saveLocalHabits([...mergedMap.values()].filter(h=>!removeRemote.includes(String(h.id)))); await deleteRows('personal_habits',removeRemote); await upsertRows('personal_habits',push); return true;
  }

  function stableMetaId(taskId,s){if(s.items.meta[taskId]?.rowId)return s.items.meta[taskId].rowId; const existing=s.items.meta[taskId]||{}; let id=existing.rowId; if(!id){id=crypto?.randomUUID?.(); if(!id){let h=2166136261;for(const ch of String(currentUser.id)+'|'+String(taskId)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)} const hex=(n)=>('00000000'+(n>>>0).toString(16)).slice(-8); id=`${hex(h)}-${hex(h*31)}-4${hex(h*131).slice(1,4)}-8${hex(h*17).slice(1,4)}-${hex(h*7)}${hex(h*13).slice(0,4)}`;} s.items.meta[taskId]={...(s.items.meta[taskId]||{}),rowId:id,updatedAt:nowIso(),fp:''};writeState(s)} return id}
  async function syncMeta(s){
    const metas=localMeta(), priorities=localPriorityMap(); const localRows=[];
    Object.entries(metas).forEach(([taskId,v])=>{const row=normalizeMeta(taskId,v,priorities[taskId]);ensureItemState('meta',taskId,row);const ss=state();const st=ss.items.meta[taskId];localRows.push({id:stableMetaId(taskId,ss),user_id:currentUser.id,task_id:String(taskId),category:row.category,subtasks:row.subtasks,priority:row.priority,updated_at:st?.updatedAt||nowIso()})});
    const remote=await fetchAll('task_meta',q=>q.order('updated_at',{ascending:false})); const rmap=new Map(remote.map(r=>[String(r.task_id),r])); const lmap=new Map(localRows.map(r=>[String(r.task_id),r])); const push=[];
    for(const row of localRows){const rr=rmap.get(row.task_id);if(!rr||new Date(row.updated_at||0)>new Date(rr.updated_at||0))push.push(row);else if(new Date(rr.updated_at||0)>new Date(row.updated_at||0)){metas[row.task_id]={category:rr.category||'',subtasks:Array.isArray(rr.subtasks)?rr.subtasks:[]};priorities[row.task_id]=rr.priority||'normal';}}
    for(const rr of remote){const id=String(rr.task_id);if(!lmap.has(id)){metas[id]={category:rr.category||'',subtasks:Array.isArray(rr.subtasks)?rr.subtasks:[]};priorities[id]=rr.priority||'normal';}}
    saveLocalMeta(metas); safeWrite(`agendaV33:${uid()}:priorities`,priorities); await upsertRows('task_meta',push); return true;
  }

  async function syncAppState(s){
    const app=localAppState(); if(s.items.appStateFp!==fp(app)){s.items.appStateFp=fp(app);s.items.appStateAt=nowIso();s.pending=(s.pending||0)+1;writeState(s)}
    let remote=[]; try{remote=await fetchAll('personal_app_state')}catch(e){return false}
    const rr=remote.find(x=>String(x.user_id)===String(currentUser.id));
    if(!rr||new Date(s.items.appStateAt||0)>new Date(rr.updated_at||0)){await upsertRows('personal_app_state',[{user_id:currentUser.id,id:currentUser.id,inbox:app.inbox||[],energy:app.energy??null,last_plan:app.lastPlan||null,updated_at:s.items.appStateAt||nowIso()}]);}
    else if(new Date(rr.updated_at||0)>new Date(s.items.appStateAt||0)){saveLocalAppState({inbox:Array.isArray(rr.inbox)?rr.inbox:[],energy:rr.energy??null,lastPlan:rr.last_plan||null});}
    return true;
  }

  async function syncNow(){
    if(busy||!currentUser)return; const dot=q('v39SyncDot'),txt=q('v39SyncText'),btn=q('v39SyncBtn'),count=q('v39Pending');
    if(!navigator.onLine){if(dot)dot.className='v39-sync-dot off';if(txt)txt.textContent='Sin Internet · cambios guardados localmente';return}
    busy=true;if(btn)btn.disabled=true;if(dot)dot.className='v39-sync-dot';if(txt)txt.textContent='Sincronizando…';
    try{
      let s=state(); await syncNotes(s); await syncHabits(s); await syncMeta(s); await syncAppState(s); s=state(); s.pending=0;s.lastSync=nowIso();writeState(s);
      if(dot)dot.className='v39-sync-dot ok';if(txt)txt.textContent=`Sincronizado · ${new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}`;if(count)count.textContent='0 cambios pendientes';
      try{renderPersonalList?.();renderNutritionGoals?.();renderDashboard?.();renderSchedule?.()}catch(_){ }
    }catch(e){console.warn('V39 sync',e);if(dot)dot.className='v39-sync-dot err';if(txt)txt.textContent='No se pudo sincronizar · seguimos con datos locales'}
    finally{busy=false;if(btn)btn.disabled=false;updatePending()}
  }
  function updatePending(){const s=state(), n=Number(s.pending||0);if(q('v39Pending'))q('v39Pending').textContent=n+(n===1?' cambio pendiente':' cambios pendientes');if(q('v39SyncText')&&!navigator.onLine)q('v39SyncText').textContent='Sin Internet · cambios guardados localmente'}
  function buildBar(){if(q('v39SyncBar'))return;const anchor=q('utilityRow')||q('v37Sync')||q('smartPanel')||q('v38Productivity')||q('dashboard');if(!anchor)return;const bar=document.createElement('div');bar.id='v39SyncBar';bar.className='v39-syncbar';bar.innerHTML=`<span class="v39-sync-dot off" id="v39SyncDot"></span><span class="v39-sync-text" id="v39SyncText">Sincronización preparada</span><span class="v39-sync-count" id="v39Pending">0 cambios pendientes</span><button class="v39-sync-btn" id="v39SyncBtn" type="button">☁️ Sincronizar ahora</button>`;anchor.parentNode.insertBefore(bar,anchor.nextSibling);q('v39SyncBtn').onclick=syncNow;q('v37SyncBtn')?.addEventListener('click',e=>{e.preventDefault();syncNow()});updatePending();}
  function markLocalChanges(){if(!currentUser)return;try{const s=state();s.pending=Math.max(1,Number(s.pending||0)+1);writeState(s)}catch(_){}}
  window.agendaV39SyncNow=syncNow;
  window.addEventListener('online',()=>{updatePending();setTimeout(syncNow,500)});
  window.addEventListener('offline',()=>{updatePending()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentUser)setTimeout(syncNow,250)});
  setInterval(()=>{if(currentUser&&navigator.onLine)syncNow()},45000);
  function init(){buildBar();updatePending();setTimeout(syncNow,1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
