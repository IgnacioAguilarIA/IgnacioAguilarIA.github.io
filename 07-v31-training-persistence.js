(function(){
  let index=0,timerMode='stopwatch',timerRunning=false,timerSeconds=0,timerInterval=null,timerStartedAt=null,timerBaseSeconds=0;
  let sessionInterval=null,sessionStartedAt=null,sessionSeconds=0,wakeLock=null,activeSession=null,finishing=false;
  const KEY='agendaTrainingV31';
  const q=id=>document.getElementById(id);
  const list=()=>Array.isArray(workoutExercises)?workoutExercises:[];
  const fmt=s=>{s=Math.max(0,Math.floor(Number(s)||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`};
  const today=()=>typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);
  const skey=()=>`${KEY}:${currentUser?.id||'guest'}`;
  function read(){try{const x=localStorage.getItem(skey());return x?JSON.parse(x):null}catch(_){return null}}
  function seriesDoneKey(){return activeSession?.id?`${skey()}:seriesDone:${activeSession.id}`:null}
  function readSeriesDone(){try{const k=seriesDoneKey();if(!k)return {};const x=JSON.parse(localStorage.getItem(k)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return {}}}
  function writeSeriesDone(map){try{const k=seriesDoneKey();if(k)localStorage.setItem(k,JSON.stringify(map||{}))}catch(_){} }
  function persistSeriesDone(exIdx,setIdx,value){if(!activeSession)return;const map=readSeriesDone();const arr=Array.isArray(map[String(exIdx)])?map[String(exIdx)]:[];arr[setIdx]=!!value;map[String(exIdx)]=arr;writeSeriesDone(map)}
  function save(){if(!activeSession)return;activeSession.currentIndex=index;activeSession.sessionSeconds=sessionSeconds;activeSession.timerMode=timerMode;activeSession.timerSeconds=timerSeconds;activeSession.timerRunning=timerRunning;activeSession.timerStartedAt=timerStartedAt;activeSession.timerBaseSeconds=timerBaseSeconds;activeSession.lastSavedAt=Date.now();activeSession.actuals=actualsSnapshot();try{localStorage.setItem(skey(),JSON.stringify(activeSession))}catch(_){} }
  function clear(){try{const k=seriesDoneKey();if(k)localStorage.removeItem(k);localStorage.removeItem(skey())}catch(_){} } function v32TrainingActive(on){document.body.classList.toggle('v32-training-active',!!on)}
  function actualsSnapshot(){return Array.isArray(activeSession?.actuals)?activeSession.actuals.map(x=>({reps:Array.isArray(x?.reps)?x.reps.slice():[],weight:Array.isArray(x?.weight)?x.weight.slice():[],rir:Array.isArray(x?.rir)?x.rir.slice():[],done:Array.isArray(x?.done)?x.done.slice():[]})):[]}
  function ensureActualsBase(){if(!activeSession)return;const len=list().length;activeSession.actuals=Array.isArray(activeSession.actuals)?activeSession.actuals:[];while(activeSession.actuals.length<len)activeSession.actuals.push({reps:[],weight:[],rir:[],done:[]});if(activeSession.actuals.length>len)activeSession.actuals.length=len;activeSession.actuals.forEach((x,i)=>{x.reps=Array.isArray(x?.reps)?x.reps:[];x.weight=Array.isArray(x?.weight)?x.weight:[];x.rir=Array.isArray(x?.rir)?x.rir:[];x.done=Array.isArray(x?.done)?x.done:[];const n=Math.max(0,Number(list()[i]?.sets)||1);x.reps=Array.from({length:n},(_,j)=>x.reps[j]??'');x.weight=Array.from({length:n},(_,j)=>x.weight[j]??'');x.rir=Array.from({length:n},(_,j)=>x.rir[j]??'');x.done=Array.from({length:n},(_,j)=>!!x.done[j])})}
  function ensureActuals(){if(!activeSession)return;ensureActualsBase();const map=readSeriesDone();Object.entries(map).forEach(([exIdx,val])=>{const i=Number(exIdx),arr=Array.isArray(val)?val:[];if(!activeSession.actuals?.[i])return;activeSession.actuals[i].done=Array.isArray(activeSession.actuals[i].done)?activeSession.actuals[i].done:[];arr.forEach((v,j)=>{if(v)activeSession.actuals[i].done[j]=true;});});}
  function restoreSeriesDone(){if(!activeSession)return;ensureActuals();}
  function captureVisibleActuals(){
    if(!activeSession)return;
    const host=q('v47SetList');
    if(!host)return;
    ensureActuals();
    const data=activeSession.actuals[index];
    if(!data)return;
    const rows=[...host.querySelectorAll('.v48-set-row')];
    rows.forEach((row,i)=>{
      const inputs=[...row.querySelectorAll('input')];
      if(inputs[0])data.reps[i]=inputs[0].value;
      if(inputs[1])data.weight[i]=inputs[1].value;
      if(inputs[2])data.rir[i]=inputs[2].value;
    });
  }
  function renderRepTracker(){
    if(activeSession) restoreSeriesDone();
    const panel=q('v47RepsPanel'),listEl=q('v47SetList'),counter=q('v47RepsCounter'),summary=q('v47RepsSummary');
    if(!panel||!listEl||!counter||!summary||!activeSession)return;
    captureVisibleActuals();
    ensureActuals();
    const ex=list()[index];
    if(!ex){panel.style.display='none';return}
    panel.style.display='block';
    const sets=Math.max(0,Number(ex.sets)||1);
    const data=activeSession.actuals[index]||{reps:[],weight:[],rir:[],done:[]};
    listEl.innerHTML='';
    let completed=0,volume=0;
    for(let i=0;i<sets;i++){
      if(data.done[i])completed++;
      const row=document.createElement('div');
      row.className='v48-set-row'+(data.done[i]?' done':'');
      const lab=document.createElement('div');lab.className='v48-set-label';lab.textContent=`Serie ${i+1}`;
      const reps=document.createElement('input');
      reps.type='number';reps.min='0';reps.inputMode='numeric';reps.className='v48-set-input';
      reps.placeholder=ex.reps||'Reps';reps.value=data.reps[i]??'';
      reps.setAttribute('aria-label',`Repeticiones serie ${i+1}`);
      reps.addEventListener('input',()=>{data.reps[i]=reps.value;save();updateRepStatus()});
      const weight=document.createElement('input');
      weight.type='number';weight.min='0';weight.step='0.5';weight.inputMode='decimal';weight.className='v48-set-input';
      weight.placeholder=ex.weight||'Kg';weight.value=data.weight[i]??'';
      weight.setAttribute('aria-label',`Peso serie ${i+1}`);
      weight.addEventListener('input',()=>{data.weight[i]=weight.value;save();updateRepStatus()});
      const rir=document.createElement('input');
      rir.type='number';rir.min='0';rir.max='10';rir.step='1';rir.inputMode='numeric';rir.className='v48-set-input';
      rir.placeholder=ex.rir??'RIR';rir.value=data.rir[i]??'';
      rir.setAttribute('aria-label',`RIR serie ${i+1}`);
      rir.addEventListener('input',()=>{data.rir[i]=rir.value;save();updateRepStatus()});
      const btn=document.createElement('button');
      btn.type='button';btn.className='v47-set-check'+(data.done[i]?' done':'');
      btn.textContent=data.done[i]?'✓':'○';
      btn.title=data.done[i]?'Marcar serie como pendiente':'Marcar serie como hecha';
      btn.addEventListener('click',(ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        captureVisibleActuals();
        const next=!data.done[i];
        data.done[i]=next;
        persistSeriesDone(index,i,next);
        save();
        row.classList.toggle('done',next);
        btn.classList.toggle('done',next);
        btn.textContent=next?'✓':'○';
        btn.title=next?'Marcar serie como pendiente':'Marcar serie como hecha';
        updateRepStatus();
      });
      row.append(lab,reps,weight,rir,btn);
      listEl.appendChild(row);
      const rr=Number(data.reps[i]),ww=Number(data.weight[i]);
      if(data.done[i]&&Number.isFinite(rr)&&rr>0&&Number.isFinite(ww)&&ww>0)volume+=rr*ww;
    }
    counter.textContent=`${completed}/${sets} series`;
    panel.classList.toggle('complete',completed===sets&&sets>0);
    summary.textContent=completed===sets&&sets>0?`✅ Todas las series hechas · Volumen registrado: ${Math.round(volume*10)/10} kg`:'Reps + peso + RIR por serie. Marcá cada serie al terminarla.';
  }
  function updateRepStatus(){const panel=q('v47RepsPanel');if(!panel||!activeSession)return;ensureActuals();const ex=list()[index],data=activeSession.actuals[index]||{reps:[],weight:[],rir:[],done:[]};const sets=Math.max(0,Number(ex?.sets)||1);const done=data.done.filter(Boolean).length;let volume=0;data.done.forEach((ok,i)=>{const rr=Number(data.reps[i]),ww=Number(data.weight[i]);if(ok&&Number.isFinite(rr)&&rr>0&&Number.isFinite(ww)&&ww>0)volume+=rr*ww});const counter=q('v47RepsCounter'),summary=q('v47RepsSummary');if(counter)counter.textContent=`${done}/${sets} series`;if(summary)summary.textContent=done===sets&&sets>0?`✅ Todas las series hechas · Volumen registrado: ${Math.round(volume*10)/10} kg`:'Reps + peso + RIR por serie. Marcá cada serie al terminarla.';panel.classList.toggle('complete',done===sets&&sets>0)}
  function updateMini(){const mini=q('v31TrainingMini');if(!mini)return;if(!activeSession||finishing||activeSession.finished){mini.classList.remove('show');return}mini.classList.add('show');const ex=list()[index];q('v31MiniTitle').textContent=ex?.exercise?`🏋️ ${ex.exercise}`:'🏋️ Entrenamiento en curso';q('v31MiniSub').textContent=`${DAYS?.[activeSession.day]||'Día'} · guardado automático`;q('v31MiniTimer').textContent=fmt(sessionSeconds)}
  function updateFull(){const a=list();if(!a.length)return;captureVisibleActuals();save();window.__agendaTrainingActuals={fillPrevious:function(log){try{ensureActuals();const data=activeSession.actuals[index];const reps=[];String(log?.reps||'').split('·').forEach((part)=>{const m=part.match(/S\s*(\d+)\s*:\s*(.*)/i);if(m)reps[Number(m[1])-1]=m[2].trim();else if(part.trim())reps.push(part.trim())});for(let i=0;i<data.reps.length;i++){if(reps[i])data.reps[i]=reps[i];if(log?.weight)data.weight[i]=String(log.weight);if(log?.rir!==null&&log?.rir!==undefined&&log?.rir!=='')data.rir[i]=String(log.rir);}save();renderRepTracker();updateFull()}catch(_){}}};index=Math.max(0,Math.min(index,a.length-1));const ex=a[index];q('v28WorkoutDayLabel').textContent=`${DAYS[workoutDay]} · ${a.length} ejercicios`;q('v28StepLabel').textContent=`Ejercicio ${index+1} de ${a.length}`;q('v28CurrentName').textContent=ex.exercise||'Ejercicio';const chips=q('v28CurrentChips');chips.innerHTML='';[['Series',ex.sets],['Reps',ex.reps],['RIR',ex.rir],['Descanso',ex.rest_seconds?`${ex.rest_seconds}s`:null],['Peso',ex.weight],['Tempo',ex.tempo]].forEach(([k,v])=>{if(v===null||v===undefined||v==='')return;const c=document.createElement('span');c.className='v28-chip';c.textContent=`${k}: ${v}`;chips.appendChild(c)});q('v28CurrentNote').textContent=ex.notes||'';q('v28CurrentNote').style.display=ex.notes?'block':'none';q('v28PrevBtn').disabled=index===0;q('v28NextBtn').disabled=index===a.length-1;q('v28ProgressBar').style.width=`${Math.round((index+1)/a.length*100)}%`;const s=q('v28SessionList');s.innerHTML='';a.forEach((e,i)=>{const p=document.createElement('div');p.className='v28-session-pill'+(i===index?' active':'');const done=activeSession?.loggedIndexes?.includes(i);p.textContent=`${i+1}. ${e.exercise||'Ejercicio'}${done?' ✓':''}`;p.onclick=()=>{index=i;save();updateFull()};s.appendChild(p)});q('v28TimerDisplay').textContent=fmt(timerSeconds);q('v28SessionClock').textContent=fmt(sessionSeconds);updateMini();renderRepTracker()}
  async function wake(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen')}catch(_){}}
  async function unwake(){try{if(wakeLock){await wakeLock.release();wakeLock=null}}catch(_){}}
  function renderClocksOnly(){const timer=q('v28TimerDisplay'),session=q('v28SessionClock');if(timer)timer.textContent=fmt(timerSeconds);if(session)session.textContent=fmt(sessionSeconds);updateMini()}
  function syncTimer(now=Date.now()){
    if(!timerRunning){renderClocksOnly();return false}
    const elapsed=Math.max(0,Math.floor((now-Number(timerStartedAt||now))/1000));
    let next=timerMode==='countdown'?Number(timerBaseSeconds||0)-elapsed:Number(timerBaseSeconds||0)+elapsed;
    if(timerMode==='countdown' && next<=0){
      timerSeconds=0;timerRunning=false;clearInterval(timerInterval);timerInterval=null;timerStartedAt=null;timerBaseSeconds=0;
      save();renderClocksOnly();
      if(navigator.vibrate)try{navigator.vibrate([180,90,180])}catch(_){}
      return false
    }
    timerSeconds=Math.max(0,Math.floor(next));
    renderClocksOnly();
    return true
  }
  function pauseTimer(){
    if(timerRunning)syncTimer();
    timerRunning=false;clearInterval(timerInterval);timerInterval=null;timerStartedAt=null;timerBaseSeconds=timerSeconds;save();renderClocksOnly()
  }
  function startTimer(){
    if(timerRunning)return;
    if(timerMode==='countdown'&&timerSeconds<=0)timerSeconds=Math.max(0,Number(list()[index]?.rest_seconds)||0);
    timerBaseSeconds=Math.max(0,Math.floor(Number(timerSeconds)||0));
    timerStartedAt=Date.now();timerRunning=true;save();
    clearInterval(timerInterval);
    timerInterval=setInterval(()=>syncTimer(),250);
    syncTimer();
  }
  function resetTimer(){
    clearInterval(timerInterval);timerInterval=null;timerRunning=false;timerStartedAt=null;
    timerSeconds=timerMode==='countdown'?Math.max(0,Number(list()[index]?.rest_seconds)||0):0;
    timerBaseSeconds=timerSeconds;save();renderClocksOnly();
  }
  function setMode(mode){timerMode=mode;q('v28TimerModeStopwatch').classList.toggle('active',mode==='stopwatch');q('v28TimerModeCountdown').classList.toggle('active',mode==='countdown');resetTimer()}
  function startClock(){
    if(sessionInterval)return;
    if(!sessionStartedAt)sessionStartedAt=Date.now()-sessionSeconds*1000;
    const tick=()=>{sessionSeconds=Math.max(0,Math.floor((Date.now()-sessionStartedAt)/1000));save();renderClocksOnly()};
    sessionInterval=setInterval(tick,250);tick();
  }
  function stopClock(){clearInterval(sessionInterval);sessionInterval=null}
  function newSession(){activeSession={id:`training-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,userId:currentUser?.id||null,day:Number(workoutDay)||0,performedAt:today(),startedAt:Date.now(),currentIndex:0,exerciseIds:list().map(x=>x.id).filter(Boolean),sessionSeconds:0,timerMode:'stopwatch',timerSeconds:0,timerRunning:false,timerStartedAt:null,timerBaseSeconds:0,loggedIndexes:[],actuals:[]};index=0;sessionSeconds=0;sessionStartedAt=Date.now();timerMode='stopwatch';timerSeconds=0;timerRunning=false;timerStartedAt=null;timerBaseSeconds=0;save()}
  function restore(s){activeSession=s;workoutDay=Number(s.day)||workoutDay;index=Math.max(0,Number(s.currentIndex)||0);const elapsed=Math.max(0,Math.floor((Date.now()-Number(s.startedAt||Date.now()))/1000));sessionSeconds=Math.max(Number(s.sessionSeconds)||0,elapsed);sessionStartedAt=Date.now()-sessionSeconds*1000;timerMode=s.timerMode||'stopwatch';timerRunning=!!s.timerRunning;timerBaseSeconds=Math.max(0,Math.floor(Number(s.timerBaseSeconds ?? s.timerSeconds ?? 0)));timerStartedAt=timerRunning?Number(s.timerStartedAt)||Date.now():null;timerSeconds=timerRunning&&timerStartedAt?(timerMode==='countdown'?Math.max(0,timerBaseSeconds-Math.floor((Date.now()-timerStartedAt)/1000)):timerBaseSeconds+Math.floor((Date.now()-timerStartedAt)/1000)):Number(s.timerSeconds)||0;activeSession.loggedIndexes=Array.isArray(s.loggedIndexes)?s.loggedIndexes:[];activeSession.actuals=Array.isArray(s.actuals)?s.actuals:[];ensureActuals();restoreSeriesDone();save()}
  function buildWorkoutLogPayload(ex,actual,sessionId,performedAt){const entered=Array.isArray(actual?.reps)?actual.reps.map(v=>String(v??'').trim()):[];const weights=Array.isArray(actual?.weight)?actual.weight.map(v=>String(v??'').trim()):[];const rirs=Array.isArray(actual?.rir)?actual.rir.map(v=>String(v??'').trim()):[];const done=Array.isArray(actual?.done)?actual.done.filter(Boolean).length:0;const repsText=entered.some(Boolean)?entered.map((v,j)=>`S${j+1}:${v||'-'}`).join(' · '):(ex?.reps||'');const weightText=weights.some(Boolean)?weights.map((v,j)=>`S${j+1}:${v||'-'}`).join(' · '):(ex?.weight||'');const numericRirs=rirs.map(Number).filter(Number.isFinite);const rirAvg=numericRirs.length?Math.round(numericRirs.reduce((a,b)=>a+b,0)/numericRirs.length*10)/10:(ex?.rir===''||ex?.rir===null||ex?.rir===undefined?null:Number(ex?.rir));const volume=entered.reduce((sum,v,j)=>{const rr=Number(v),ww=Number(weights[j]);return sum+(Number.isFinite(rr)&&rr>0&&Number.isFinite(ww)&&ww>0?rr*ww:0)},0);const detail=entered.some(Boolean)||weights.some(Boolean)||rirs.some(Boolean)||done?`Registro por series: ${entered.map((r,j)=>`S${j+1} ${r||'-'} reps · ${weights[j]||'-'} kg · RIR ${rirs[j]||'-'}`).join(' | ')} · Volumen ${Math.round(volume*10)/10} kg · Sesión ${sessionId}`:`Registro automático de sesión · ${sessionId}`;return{user_id:currentUser.id,exercise_id:ex.id,exercise_name:ex.exercise,performed_at:performedAt,sets_completed:done||Number(ex.sets)||null,reps:repsText,weight:weightText,rir:rirAvg,notes:detail};}
  function pendingWorkoutKey(){return `agendaWorkoutPendingLogs:${currentUser?.id||'guest'}`}
  function readPendingWorkoutLogs(){try{const x=JSON.parse(localStorage.getItem(pendingWorkoutKey())||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function writePendingWorkoutLogs(rows){try{localStorage.setItem(pendingWorkoutKey(),JSON.stringify(rows||[]))}catch(_){} }
  async function persistWorkoutLog(payload){const localKey=String(payload?.__local_key||'');const dbPayload={...(payload||{})};delete dbPayload.__local_key;let lastErr=null;for(let attempt=0;attempt<3;attempt++){try{const {error}=await sb.from('workout_logs').insert(dbPayload);if(!error)return true;lastErr=error}catch(e){lastErr=e}await new Promise(r=>setTimeout(r,350*(attempt+1)));}console.warn('Registro de entrenamiento pendiente:',lastErr);const pending=readPendingWorkoutLogs();if(!pending.some(x=>x._local_key===localKey)){pending.push({_local_key:localKey,...dbPayload,_queued_at:new Date().toISOString()});writePendingWorkoutLogs(pending)}return false}
  async function flushPendingWorkoutLogs(){if(!currentUser?.id||!navigator.onLine)return;const pending=readPendingWorkoutLogs();if(!pending.length)return;const remain=[];for(const item of pending){const {_local_key,_queued_at,...payload}=item;try{const {error}=await sb.from('workout_logs').insert(payload);if(error)remain.push(item)}catch(_){remain.push(item)}}writePendingWorkoutLogs(remain)}
  async function logExercise(i){if(!activeSession||activeSession.loggedIndexes.includes(i))return true;const ex=list()[i];if(!ex?.id||!currentUser?.id)return false;const actual=activeSession.actuals?.[i];const payload=buildWorkoutLogPayload(ex,actual,activeSession.id,activeSession.performedAt);payload.__local_key=`${activeSession.id}:${ex.id}`;const saved=await persistWorkoutLog(payload);if(saved){activeSession.loggedIndexes.push(i);save()}return saved}
  async function next(){captureVisibleActuals();save();await logExercise(index);const rest=Math.max(0,Number(list()[index]?.rest_seconds)||0);if(index<list().length-1){index++;save();updateFull();if(rest>0){setMode('countdown');timerSeconds=rest;save();startTimer()}else setMode('stopwatch')}else await finish()}
  async function prev(){if(index>0){index--;save();updateFull();setMode('stopwatch')}}
  async function finish(){if(finishing||!activeSession)return;captureVisibleActuals();save();finishing=true;const session=JSON.parse(JSON.stringify(activeSession));session.finished=true;const exercises=list().map(x=>({...x}));const actuals=Array.isArray(session.actuals)?session.actuals.map(x=>({reps:Array.isArray(x?.reps)?x.reps.slice():[],weight:Array.isArray(x?.weight)?x.weight.slice():[],rir:Array.isArray(x?.rir)?x.rir.slice():[],done:Array.isArray(x?.done)?x.done.slice():[]})):[];const originalLogged=Array.isArray(session.loggedIndexes)?session.loggedIndexes.slice():[];const visibleLogged=new Set(originalLogged);const mini=q('v31TrainingMini');if(mini)mini.classList.remove('show');q('v28WorkoutOverlay')?.classList.remove('show');v32TrainingActive(false);document.body.style.overflow='';const pendingJobs=[];for(let i=0;i<exercises.length;i++){if(visibleLogged.has(i))continue;const ex=exercises[i],actual=actuals[i]||{};const payload=buildWorkoutLogPayload(ex,actual,session.id,session.performedAt);payload.__local_key=`${session.id}:${ex.id}`;pendingJobs.push({i,payload})}let savedCount=visibleLogged.size,queuedCount=0;for(const job of pendingJobs){const ok=await persistWorkoutLog(job.payload);if(ok){visibleLogged.add(job.i);savedCount=visibleLogged.size}else{queuedCount++;visibleLogged.add(job.i);savedCount=visibleLogged.size}}pauseTimer();stopClock();await unwake();await flushPendingWorkoutLogs();try{await loadWorkoutLogs();renderWorkoutHistory();renderWorkoutAnalytics?.();renderDashboard()}catch(_){}let totalVolume=0,maxWeight=0,setsDone=0;actuals.forEach(a=>{(a?.reps||[]).forEach((rv,j)=>{const rr=Number(rv),ww=Number(a?.weight?.[j]);if(a?.done?.[j])setsDone++;if(Number.isFinite(rr)&&rr>0&&Number.isFinite(ww)&&ww>0){totalVolume+=rr*ww;maxWeight=Math.max(maxWeight,ww)}})});session.finished=true;clear();activeSession=null;updateMini();q('v28WorkoutOverlay')?.classList.remove('show');v32TrainingActive(false);document.body.style.overflow='';finishing=false;const cmpSession={...session,actuals};const oldActive=activeSession;activeSession=cmpSession;showFinishSummary({count:savedCount,queuedCount,totalVolume,setsDone,maxWeight,comparison:comparisonForSession()});activeSession=oldActive;}
  function parseWorkoutLogDetail(log){
    const reps=[]; const weights=[]; const rirs=[];
    const text=String(log?.notes||'');
    const re=/S(\d+)\s+([^·]+?)\s+reps\s+·\s+([^·]+?)\s+kg\s+·\s+RIR\s+([^·|]+)/g;
    let m; while((m=re.exec(text))){const i=Number(m[1])-1;reps[i]=String(m[2]).trim();weights[i]=String(m[3]).trim();rirs[i]=String(m[4]).trim();}
    if(!reps.length && log?.reps){String(log.reps).split('·').forEach(part=>{const x=part.match(/S(\d+):\s*(.*)/);if(x)reps[Number(x[1])-1]=x[2].trim()})}
    if(!weights.length && log?.weight){String(log.weight).split('·').forEach(part=>{const x=part.match(/S(\d+):\s*(.*)/);if(x)weights[Number(x[1])-1]=x[2].trim()})}
    return {reps,weights,rirs};
  }
  function currentSessionExerciseStats(i){
    const a=activeSession?.actuals?.[i]||{};const ex=list()[i];const reps=Array.isArray(a.reps)?a.reps:[];const weights=Array.isArray(a.weight)?a.weight:[];const rirs=Array.isArray(a.rir)?a.rir:[];let volume=0,maxWeight=0,totalReps=0,doneSets=0;reps.forEach((v,j)=>{const rr=Number(v),ww=Number(weights[j]);if(a.done?.[j])doneSets++;if(Number.isFinite(rr)&&rr>0)totalReps+=rr;if(Number.isFinite(rr)&&rr>0&&Number.isFinite(ww)&&ww>0){volume+=rr*ww;maxWeight=Math.max(maxWeight,ww)}});return {exercise:ex,volume,totalReps,doneSets,maxWeight,reps,weights,rirs};
  }
  function previousLogForExercise(exerciseName){
    const currentDay=String(activeSession?.performedAt||today());
    return (workoutLogs||[]).filter(l=>String(l.exercise_name||'')===String(exerciseName||'') && String(l.performed_at||'')!==currentDay).sort((a,b)=>String(b.performed_at||'').localeCompare(String(a.performed_at||'')))[0]||null;
  }
  function comparisonForSession(){
    const rows=[];let improved=0,worse=0,same=0;
    list().forEach((ex,i)=>{const cur=currentSessionExerciseStats(i);if(!cur.exercise)return;const prev=previousLogForExercise(cur.exercise.exercise);if(!prev){rows.push({name:cur.exercise.exercise,status:'new',text:'Sin sesión anterior para comparar'});return;}const detail=parseWorkoutLogDetail(prev);let prevVol=0,prevMax=0,prevReps=0;detail.reps.forEach((rv,j)=>{const rr=Number(rv),ww=Number(detail.weights[j]);if(Number.isFinite(rr)&&rr>0)prevReps+=rr;if(Number.isFinite(rr)&&rr>0&&Number.isFinite(ww)&&ww>0){prevVol+=rr*ww;prevMax=Math.max(prevMax,ww)}});if(cur.volume>prevVol+0.01||cur.maxWeight>prevMax+0.01||cur.totalReps>prevReps){improved++;rows.push({name:cur.exercise.exercise,status:'up',text:prevVol>0&&cur.volume>prevVol?`↑ Volumen ${Math.round(cur.volume-prevVol)} kg`:'↑ Mejor rendimiento'});}else if(cur.volume+0.01<prevVol||cur.maxWeight+0.01<prevMax||cur.totalReps<prevReps){worse++;rows.push({name:cur.exercise.exercise,status:'down',text:'↓ Menor rendimiento que la última vez'});}else{same++;rows.push({name:cur.exercise.exercise,status:'same',text:'→ Similar a la última sesión'});}});return {rows,improved,worse,same};
  }
  function showFinishSummary(data){
    let o=q('v48FinishOverlay');
    if(!o){o=document.createElement('div');o.id='v48FinishOverlay';o.className='v48-finish-overlay';o.innerHTML=`<div class="v48-finish-card"><div class="v48-finish-head"><div><div class="v48-finish-title">🏆 Entrenamiento terminado</div><div class="v48-finish-sub">Resumen de esta sesión</div></div><button class="v48-finish-close" type="button">×</button></div><div class="v48-finish-grid"><div><strong id="v48FinishExercises">0</strong><span>ejercicios</span></div><div><strong id="v48FinishSets">0</strong><span>series hechas</span></div><div><strong id="v48FinishVolume">0</strong><span>kg de volumen</span></div><div><strong id="v48FinishWeight">0</strong><span>peso máximo</span></div></div><div class="v49-comparison" id="v49Comparison"></div><button class="v48-finish-ok" type="button">Continuar</button></div>`;document.body.appendChild(o);o.querySelector('.v48-finish-close').onclick=()=>o.classList.remove('show');o.querySelector('.v48-finish-ok').onclick=()=>o.classList.remove('show')}
    q('v48FinishExercises').textContent=String(data.count||0);q('v48FinishSets').textContent=String(data.setsDone||0);q('v48FinishVolume').textContent=`${Math.round((data.totalVolume||0)*10)/10}`;q('v48FinishWeight').textContent=`${Math.round((data.maxWeight||0)*10)/10} kg`;
    const cmp=data.comparison||{rows:[],improved:0,worse:0,same:0};const box=q('v49Comparison');if(box){const top=cmp.improved>cmp.worse?'📈 Mejoraste respecto a tus sesiones anteriores':cmp.worse>cmp.improved?'📉 Algunas marcas bajaron hoy':'➡️ Rendimiento estable';box.innerHTML=`<div class="v49-comparison-head"><strong>${top}</strong><span>${cmp.improved} mejor · ${cmp.same} igual · ${cmp.worse} menor</span></div>${cmp.rows.slice(0,8).map(r=>`<div class="v49-comparison-row ${r.status}"><span>${esc(r.name)}</span><span>${esc(r.text)}</span></div>`).join('')}`}
    o.classList.add('show');
    o.querySelectorAll('.v49-queued-note').forEach(n=>n.remove());if(Number(data.queuedCount)>0){const note=document.createElement('div');note.className='v49-queued-note';note.textContent=`⚠️ ${data.queuedCount} ejercicio(s) quedaron en cola local y se sincronizarán cuando haya conexión.`;o.querySelector('.v49-comparison')?.after(note);}
  }
  async function cancelWorkout(){
    if(!activeSession)return;
    const ok=confirm('¿Cancelar este entrenamiento? Se cerrará la Vista de entrenamiento y se eliminarán los registros creados durante esta sesión.');
    if(!ok)return;
    const sessionId=String(activeSession.id||'');
    pauseTimer();stopClock();await unwake();
    try{if(sessionId&&currentUser?.id){const {error}=await sb.from('workout_logs').delete().eq('user_id',currentUser.id).like('notes',`%${sessionId}%`);if(error)console.warn('No se pudieron eliminar todos los registros de la sesión cancelada:',error)}}catch(e){console.warn('Cancelación offline:',e)}
    clear();activeSession=null;updateMini();q('v28WorkoutOverlay')?.classList.remove('show');v32TrainingActive(false);document.body.style.overflow='';
    try{await loadWorkoutLogs();renderWorkoutHistory();renderWorkoutAnalytics?.();renderDashboard()}catch(_){ }
  }
  function closeView(){save();q('v28WorkoutOverlay')?.classList.remove('show');v32TrainingActive(false);document.body.style.overflow='';updateMini()}
  function openView(){
    if(activeSession){q('v28WorkoutOverlay')?.classList.add('show');v32TrainingActive(true);document.body.style.overflow='hidden';updateFull();startClock();if(timerRunning){syncTimer();startTimer()}wake();return;}
    if(!list().length && !navigator.onLine){const cached=cacheRead('workoutExercisesAll');workoutExercises=Array.isArray(cached)?cached.filter(x=>Number(x.day)===Number(workoutDay)):[];}
    if(!list().length){alert(`No hay ejercicios cargados para ${DAYS[workoutDay]}.`);return}
    const s=read();if(s){try{restore(s);}catch(err){console.warn('No se pudo restaurar la sesión; se crea una nueva:',err);clear();newSession();}}else newSession();
    q('v28WorkoutOverlay')?.classList.add('show');v32TrainingActive(true);document.body.style.overflow='hidden';updateFull();startClock();if(timerRunning){syncTimer();startTimer()}wake();
  }
  function restoreOnLoad(){const s=read();if(!s){v32TrainingActive(false);return}try{restore(s);v32TrainingActive(false);updateMini();startClock();if(timerRunning)syncTimer()}catch(err){console.warn('Sesión de entrenamiento incompatible; se limpia la sesión local:',err);clear();activeSession=null;v32TrainingActive(false);updateMini();}}
  function bind(){q('v28WorkoutClose')?.addEventListener('click',closeView);q('v28PrevBtn')?.addEventListener('click',prev);q('v28NextBtn')?.addEventListener('click',next);q('v28FinishBtn')?.addEventListener('click',finish);q('v49CancelWorkout')?.addEventListener('click',cancelWorkout);q('v28TimerModeStopwatch')?.addEventListener('click',()=>setMode('stopwatch'));q('v28TimerModeCountdown')?.addEventListener('click',()=>setMode('countdown'));q('v28TimerStart')?.addEventListener('click',startTimer);q('v28TimerPause')?.addEventListener('click',pauseTimer);q('v28TimerReset')?.addEventListener('click',resetTimer);q('v28TimerStart')&&(q('v28TimerStart').onclick=(e)=>{e.preventDefault();startTimer();q('v28TimerStart').classList.remove('v98-timer-press');void q('v28TimerStart').offsetWidth;q('v28TimerStart').classList.add('v98-timer-press')});q('v28TimerPause')&&(q('v28TimerPause').onclick=(e)=>{e.preventDefault();pauseTimer();q('v28TimerPause').classList.remove('v98-timer-press');void q('v28TimerPause').offsetWidth;q('v28TimerPause').classList.add('v98-timer-press')});q('v28TimerReset')&&(q('v28TimerReset').onclick=(e)=>{e.preventDefault();resetTimer();q('v28TimerReset').classList.remove('v98-timer-press');void q('v28TimerReset').offsetWidth;q('v28TimerReset').classList.add('v98-timer-press')});q('v31MiniOpen')?.addEventListener('click',openView);q('v31MiniFinish')?.addEventListener('click',finish);window.addEventListener('beforeunload',()=>{if(timerRunning)syncTimer();save()});window.addEventListener('pagehide',()=>{if(timerRunning)syncTimer();save()});document.addEventListener('visibilitychange',()=>{if(activeSession&&timerRunning)syncTimer();if(document.visibilityState==='visible'&&activeSession)wake()});document.addEventListener('keydown',e=>{if(!q('v28WorkoutOverlay')?.classList.contains('show'))return;if(e.key==='Escape'){closeView()}else if(e.key==='ArrowRight'){next()}else if(e.key==='ArrowLeft'){prev()}else if(e.code==='Space'){e.preventDefault();timerRunning?pauseTimer():startTimer()}});window.openWorkoutMode=openView;restoreOnLoad()}
  window.addEventListener('online',()=>{flushPendingWorkoutLogs().catch(()=>{})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind()
})();
