const SUPABASE_URL='https://lfxqdqtkniqhloonisxu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_VqXwNNTwwkd_T2sWcTZ3eg_vphUilwA';
let sb=null;
let supabaseReadyPromise=null;

function ensureSupabase(){
  if(window.supabase?.createClient){
    if(!sb) sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return Promise.resolve(sb);
  }
  if(supabaseReadyPromise)return supabaseReadyPromise;
  supabaseReadyPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.async=true;
    script.onload=()=>{
      try{
        if(!window.supabase?.createClient)throw new Error('La librería de Supabase no quedó disponible.');
        sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        resolve(sb);
      }catch(err){reject(err)}
    };
    script.onerror=()=>reject(new Error('No se pudo cargar la librería de Supabase. Revisá tu conexión a Internet o el bloqueo del CDN.'));
    document.head.appendChild(script);
  });
  return supabaseReadyPromise;
}

const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const HOURS=[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
const TZ='America/Argentina/Cordoba';
let currentUser=null, selectedDay=getArgentinaWeekday(), selectedHour=7, currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear(), tasks=[], personalDates=[], sharedEvents=[], editingDateId=null, tooltip=null, authMode='login', conflictShowIgnored=false, ignoredConflicts=new Set();
let editingTaskId=null;
let workoutLogs=[], loggingExerciseId=null;
let workoutDay=selectedDay, workoutExercises=[], editingExerciseId=null;
let nutritionDay=selectedDay, nutritionMeals=[], editingMealId=null, activeMealType='pre';
const AUTO_REFRESH_MS=60000;
const REMINDER_PREF_KEY='agendaReminderPrefs';
let reminderTimer=null;
let remindersEnabled=localStorage.getItem(REMINDER_PREF_KEY)==='on';
let reminderLeadMinutes=Number(localStorage.getItem('agendaReminderLead')||10);
let lastReminderKey=localStorage.getItem('agendaLastReminderKey')||'';
let autoRefreshTimer=null;
let refreshInProgress=false;
const MEAL_TYPES=[
  {key:'pre',label:'Pre entrenamiento'},
  {key:'post',label:'Post entrenamiento'},
  {key:'lunch',label:'Almuerzo'},
  {key:'snack',label:'Merienda'},
  {key:'dinner',label:'Cena'},
  {key:'sleep',label:'Antes de dormir'}
];

let nutritionGoals={calories:2500,protein:160,carbs:300,fat:70};

const $=id=>document.getElementById(id);
function goalsStorageKey(){return currentUser?`agendaNutritionGoals:${currentUser.id}`:'agendaNutritionGoals:local';}
function loadNutritionGoals(){try{const raw=localStorage.getItem(goalsStorageKey());if(raw){nutritionGoals={...nutritionGoals,...JSON.parse(raw)}}}catch{}}
function saveNutritionGoals(){localStorage.setItem(goalsStorageKey(),JSON.stringify(nutritionGoals));}

DAYS.forEach((d,i)=>{const o=document.createElement('option');o.value=i;o.textContent=d;$('taskDayInput')?.appendChild(o);});
for(let m=0;m<60;m++){const o=document.createElement('option');o.value=m;o.textContent=String(m).padStart(2,'0');$('taskMinuteInput')?.appendChild(o);}
function argentinaParts(){const p=new Intl.DateTimeFormat('es-AR',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(new Date()); const o={}; p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value}); return o;}
function todayISO(){const p=argentinaParts();return `${p.year}-${p.month}-${p.day}`;}
function getArgentinaWeekday(){const map={lun:0,mar:1,mié:2,jue:3,vie:4,sáb:5,dom:6};return map[(argentinaParts().weekday||'lun').toLowerCase().replace('.','')]??0;}
function iso(y,m,d){return `${String(y).padStart(4,'0')}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function fmtDate(s){return new Date(s+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});}
function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML;}

function authMessage(text,type='error'){const el=$('authMsg');el.textContent=text;el.className='msg show '+type;}
function setAuthMode(mode){authMode=mode;$('loginTab').classList.toggle('active',mode==='login');$('registerTab').classList.toggle('active',mode==='register');$('authSubmit').textContent=mode==='login'?'Entrar':'Crear cuenta';$('authMsg').className='msg';}
$('loginTab').onclick=()=>setAuthMode('login');
$('registerTab').onclick=()=>setAuthMode('register');
$('authForm').onsubmit=async e=>{
  e.preventDefault();
  const email=$('authEmail').value.trim();
  const password=$('authPassword').value;
  if(!email||!password){authMessage('Completá email y contraseña.');return;}
  authMessage('Conectando con Supabase...','ok');
  try{
    const client=await ensureSupabase();
    if(authMode==='register'){
      const {data,error}=await client.auth.signUp({email,password});
      if(error){authMessage(error.message);return;}
      if(!data.session){authMessage('Cuenta creada. Revisá tu email si la confirmación está activada.','ok');return;}
    }else{
      const {error}=await client.auth.signInWithPassword({email,password});
      if(error){authMessage(error.message);return;}
    }
  }catch(err){
    console.error('Supabase Auth:',err);
    authMessage(err?.message||'No se pudo conectar con Supabase.');
  }
};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();};

$('reminderBtn').onclick=e=>{e.preventDefault();e.stopPropagation();$('reminderPanel').classList.toggle('open');updateReminderUI();};
$('reminderClose').onclick=()=>{$('reminderPanel').classList.remove('open');};
$('reminderLead').onchange=()=>{reminderLeadMinutes=Number($('reminderLead').value);localStorage.setItem('agendaReminderLead',String(reminderLeadMinutes));updateReminderUI();};
$('reminderEnable').onclick=()=>{if(remindersEnabled)disableReminders();else enableReminders();};
document.addEventListener('click',e=>{const panel=$('reminderPanel');const btn=$('reminderBtn');const settingsBtn=$('settingsReminderBtn');if(panel?.classList.contains('open')&&!panel.contains(e.target)&&e.target!==btn&&e.target!==settingsBtn)panel.classList.remove('open');});


async function init(){
  try{
    const client=await ensureSupabase();
    const {data:{session}}=await client.auth.getSession();
    await handleSession(session);
    client.auth.onAuthStateChange(async(_event,session)=>{try{await handleSession(session)}catch(err){console.error('Cambio de sesión:',err)}});
  }catch(err){
    console.error('Inicialización de Supabase:',err);
    $('authScreen').classList.remove('hidden');
    $('app').classList.add('hidden');
    authMessage(err?.message||'No se pudo inicializar Supabase.');
  }
}
async function handleSession(session){
  if(!session){
    currentUser=null;
    stopAutoRefresh();
    stopReminderTimer();
    $('authScreen').classList.remove('hidden');
    $('app').classList.add('hidden');
    return;
  }
  currentUser=session.user;
  seedFromCache();
  loadNutritionGoals();
  $('authScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('userEmail').textContent=currentUser.email||'';
  loadIgnoredConflicts();
  await refreshAll();
  startAutoRefresh();
  if(remindersEnabled) startReminderTimer();
}

function ignoredConflictStorageKey(){return currentUser?`agendaIgnoredConflicts:${currentUser.id}`:'agendaIgnoredConflicts:guest';}
function loadIgnoredConflicts(){try{const raw=localStorage.getItem(ignoredConflictStorageKey());const arr=raw?JSON.parse(raw):[];ignoredConflicts=new Set(Array.isArray(arr)?arr:[]);}catch{ignoredConflicts=new Set();}}
function saveIgnoredConflicts(){localStorage.setItem(ignoredConflictStorageKey(),JSON.stringify([...ignoredConflicts]));}
function conflictKey(c){const aId=c.a?.id||c.a?.title||'a';const bId=c.b?.id||c.b?.title||'b';return [c.kind,aId,bId,c.a?minutesOfItem(c.a):'',c.kind==='task-task'?minutesOfItem(c.b):c.b?c.b._minutes:''].join('|');}
function formatSuggestedSlots(day){const blocked=new Set();tasks.filter(t=>Number(t.day)===day).forEach(t=>blocked.add(minutesOfItem(t)));const meals=(nutritionMeals||[]).filter(m=>Number(m.day)===day&&m.meal_time);meals.forEach(m=>{const [h,mi]=String(m.meal_time).split(':').map(Number);blocked.add((h||0)*60+(mi||0));});const suggestions=[];for(let min=7*60;min<=22*60+45;min+=15){if(blocked.has(min))continue;const prev=min-15,next=min+15;if(!blocked.has(prev)&&!blocked.has(next))suggestions.push(clockFromMinutes(min));if(suggestions.length>=3)break;}return suggestions;}
function showConflictSuggestion(c){const title=c.a?.title||'Actividad';const options=formatSuggestedSlots(selectedDay);if(!options.length){alert(`No encontré un hueco claro para reubicar «${title}».`);return;}const panel=document.createElement('div');panel.className='reschedule-panel';panel.innerHTML=`<strong>💡 Opciones para «${esc(title)}»</strong><div class="reschedule-options"></div>`;const target=c.a;const opts=panel.querySelector('.reschedule-options');options.forEach(time=>{const b=document.createElement('button');b.className='reschedule-option';b.textContent=time;b.onclick=async()=>{const [h,m]=time.split(':').map(Number);const {error}=await sb.from('tasks').update({hour:h,minute:m}).eq('id',target.id);if(error){alert(error.message);return;}panel.remove();await loadTasks();renderSchedule();renderDashboard();renderConflicts();};opts.appendChild(b)});const host=document.querySelector('.conflict-list');if(host)host.appendChild(panel);setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),30);}

async function refreshAll(){
  if(!currentUser || refreshInProgress) return;
  if(typeof invalidateGlobalSearchCache==='function') invalidateGlobalSearchCache();
  if(document.querySelector('.overlay.show')) return;
  refreshInProgress=true;
  setRefreshStatus('Actualizando…','updating');
  try{
    await Promise.all([loadTasks(),loadPersonalDates(),loadSharedEvents(),loadWorkoutExercises(),loadWorkoutLogs(),loadNutritionMeals()]);
    createDays();
    renderSchedule();
    buildMonthOptions();
    renderCalendar();
    updateStats();
    renderDashboard();
    renderWorkoutDays();
    renderWorkoutList();
    renderWorkoutHistory();
    renderNutritionDays();
    renderMealTabs();
    renderNutritionList();
    renderConflicts();
    updateNotice();
    updateReminderUI();
    checkReminders();
    setRefreshStatus('Actualizado '+new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),'ok');
  }catch(err){
    console.error(err);
    setRefreshStatus('Error al actualizar','');
  }finally{
    refreshInProgress=false;
  }
}

function setRefreshStatus(text,cls=''){
  const el=$('refreshStatus');
  if(!el) return;
  el.textContent=text;
  el.className='refresh-status'+(cls?' '+cls:'');
}

function startAutoRefresh(){
  stopAutoRefresh();
  autoRefreshTimer=setInterval(()=>{
    if(document.visibilityState==='visible') refreshAll();
  },AUTO_REFRESH_MS);
}

function stopAutoRefresh(){
  if(autoRefreshTimer){clearInterval(autoRefreshTimer);autoRefreshTimer=null;}
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && currentUser) refreshAll();
});


function getArgentinaNow(){return new Date(new Date().toLocaleString('en-US',{timeZone:TZ}));}
function getTodayIndex(){return getArgentinaWeekday();}
function pad2(n){return String(n).padStart(2,'0');}
function reminderDateForTask(task){
  const now=getArgentinaNow();
  const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const currentDay=getTodayIndex();
  let delta=task.day-currentDay;
  if(delta<0) delta+=7;
  d.setDate(d.getDate()+delta);
  d.setHours(Number(task.hour)||0,Number(task.minute)||0,0,0);
  d.setMinutes(d.getMinutes()-reminderLeadMinutes);
  return d;
}
function reminderDateForMeal(meal){
  if(!meal.meal_time) return null;
  const [hh,mm]=meal.meal_time.split(':').map(Number);
  const now=getArgentinaNow();
  const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const currentDay=getTodayIndex();
  let delta=meal.day-currentDay;
  if(delta<0) delta+=7;
  d.setDate(d.getDate()+delta);
  d.setHours(hh||0,mm||0,0,0);
  d.setMinutes(d.getMinutes()-reminderLeadMinutes);
  return d;
}
function buildReminderCandidates(){
  const candidates=[];
  tasks.filter(t=>!t.completed).forEach(t=>candidates.push({when:reminderDateForTask(t),title:t.title,body:t.description||'Tarea programada',kind:'task',id:t.id,meta:`${DAYS[t.day]} · ${pad2(Number(t.hour)||0)}:${pad2(Number(t.minute)||0)}`}));
  nutritionMeals.filter(m=>m.meal_time).forEach(m=>{const when=reminderDateForMeal(m); if(when)candidates.push({when,title:m.title,body:m.description||m.foods||'Comida programada',kind:'meal',id:m.id,meta:`${DAYS[m.day]} · ${m.meal_time}`});});
  return candidates.filter(x=>x.when instanceof Date && !isNaN(x.when)).sort((a,b)=>a.when-b.when);
}
function updateNextReminder(){
  const el=$('nextReminder'); if(!el) return;
  const candidates=buildReminderCandidates(); const now=getArgentinaNow();
  const next=candidates.find(x=>x.when>=now);
  if(!next){el.textContent='No hay próximos recordatorios.';return;}
  el.innerHTML=`<strong>Próximo:</strong> ${esc(next.title)} · ${esc(next.meta)}`;
}
function updateReminderUI(){
  const btn=$('reminderBtn'), enable=$('reminderEnable'), lead=$('reminderLead');
  if(!btn||!enable||!lead) return;
  lead.value=String(reminderLeadMinutes);
  btn.classList.toggle('active',remindersEnabled);
  btn.textContent=remindersEnabled?'🔔 Recordatorios activos':'🔔 Recordatorios';
  enable.classList.toggle('active',remindersEnabled);
  enable.textContent=remindersEnabled?'Recordatorios activados':'Activar recordatorios';
  updateNextReminder();
}
async function enableReminders(){
  if(!('Notification' in window)){alert('Tu navegador no admite notificaciones.');return;}
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){alert('No se concedió permiso para las notificaciones. Podés activarlo desde la configuración del navegador.');return;}
  remindersEnabled=true; localStorage.setItem(REMINDER_PREF_KEY,'on'); updateReminderUI(); startReminderTimer();
}
function disableReminders(){remindersEnabled=false;localStorage.setItem(REMINDER_PREF_KEY,'off');stopReminderTimer();updateReminderUI();}
function checkReminders(){
  if(!remindersEnabled || !currentUser || !document.hidden) {
    // Visible or background both can notify; keep running while app is open.
  }
  const now=getArgentinaNow();
  const candidates=buildReminderCandidates();
  const hit=candidates.find(x=>Math.abs(x.when-now)<32000 && !localStorage.getItem(`rem_${x.kind}_${x.id}_${x.when.toISOString()}`));
  if(!hit)return;
  const key=`rem_${hit.kind}_${hit.id}_${hit.when.toISOString()}`;
  localStorage.setItem(key,'1');
  lastReminderKey=key;
  try{new Notification(hit.kind==='task'?'📚 Recordatorio de tarea':'🍽️ Recordatorio de comida',{body:`${hit.title}\n${hit.meta}`});}catch(e){console.warn(e)}
  updateNextReminder();
}
function startReminderTimer(){stopReminderTimer(); if(!remindersEnabled)return; reminderTimer=setInterval(checkReminders,30000); updateNextReminder();}
function stopReminderTimer(){if(reminderTimer){clearInterval(reminderTimer);reminderTimer=null;}}

function cacheKey(name){return currentUser?`agendaCache:${currentUser.id}:${name}`:`agendaCache:guest:${name}`}
function cacheWrite(name,value){try{localStorage.setItem(cacheKey(name),JSON.stringify({saved_at:Date.now(),value}))}catch{}}
function cacheRead(name){try{const raw=localStorage.getItem(cacheKey(name));return raw?JSON.parse(raw).value:null}catch{return null}}
function seedFromCache(){const a=cacheRead('tasks');if(Array.isArray(a))tasks=a;const b=cacheRead('personalDates');if(Array.isArray(b))personalDates=b;const c=cacheRead('workoutExercisesAll');if(Array.isArray(c))workoutExercises=c.filter(x=>Number(x.day)===Number(workoutDay));const d=cacheRead('workoutLogs');if(Array.isArray(d))workoutLogs=d;const e=cacheRead('nutritionMealsAll');if(Array.isArray(e))nutritionMeals=e.filter(x=>Number(x.day)===Number(nutritionDay))}
function updateOfflineState(){document.body.classList.toggle('offline',!navigator.onLine)}
window.addEventListener('online',()=>{updateOfflineState();if(currentUser)refreshAll()});window.addEventListener('offline',updateOfflineState);updateOfflineState();
async function loadTasks(){const {data,error}=await sb.from('tasks').select('*').order('hour',{ascending:true}).order('minute',{ascending:true});if(error){console.error(error);const c=cacheRead('tasks');tasks=Array.isArray(c)?c:[]}else{tasks=data||[];cacheWrite('tasks',tasks)}}
async function loadPersonalDates(){const {data,error}=await sb.from('personal_dates').select('*').order('date',{ascending:true});if(error){console.error(error);const c=cacheRead('personalDates');personalDates=Array.isArray(c)?c:[]}else{personalDates=data||[];cacheWrite('personalDates',personalDates)}}
async function loadSharedEvents(){try{const res=await fetch('./data/events.json?ts='+Date.now(),{cache:'no-store'});if(!res.ok)throw new Error('events.json no disponible');const data=await res.json();sharedEvents=Array.isArray(data)?data:(data.events||[]);$('calendarStatus').textContent='Eventos compartidos cargados.';}catch(e){console.warn(e);sharedEvents=[];$('calendarStatus').textContent='No se pudo cargar data/events.json; feriados/paros compartidos pueden no aparecer.';}}

function createDays(){const c=$('days');c.innerHTML='';DAYS.forEach((d,i)=>{const b=document.createElement('button');b.className='day-btn'+(i===selectedDay?' active':'');b.textContent=d;b.onclick=()=>{selectedDay=i;workoutDay=i;nutritionDay=i;createDays();renderSchedule();updateStats();renderDashboard();renderConflicts();renderWorkoutDays();renderNutritionDays();loadWorkoutExercises().then(()=>{renderWorkoutList();renderWorkoutHistory();});loadNutritionMeals().then(()=>{renderMealTabs();renderNutritionList();renderNutritionGoals();renderDashboard();});};c.appendChild(b);});}
function taskSort(a,b){return (Number(a.hour)||0)-(Number(b.hour)||0)||(Number(a.minute)||0)-(Number(b.minute)||0)||String(a.title||'').localeCompare(String(b.title||''));}
function minutesOfItem(x){return (Number(x.hour)||0)*60+(Number(x.minute)||0)}
function clockFromMinutes(total){return `${pad2(Math.floor(total/60))}:${pad2(total%60)}`}
function renderConflicts(){
  const panel=$('conflictPanel'),list=$('conflictList'),count=$('conflictCount');
  if(!panel||!list||!count)return;
  const dayTasks=tasks.filter(t=>Number(t.day)===selectedDay).sort(taskSort);
  const dayMeals=(nutritionMeals||[]).filter(m=>Number(m.day)===selectedDay && m.meal_time).map(m=>{const [h,mi]=String(m.meal_time).split(':').map(Number);return {...m,_minutes:(h||0)*60+(mi||0)}}).sort((a,b)=>a._minutes-b._minutes);
  const conflicts=[];
  for(let i=0;i<dayTasks.length;i++){
    for(let j=i+1;j<dayTasks.length;j++){
      const a=dayTasks[i],b=dayTasks[j],diff=Math.abs(minutesOfItem(a)-minutesOfItem(b));
      if(diff===0||diff<=15)conflicts.push({kind:'task-task',severity:diff===0?'same':'near',a,b,diff});
    }
  }
  dayTasks.forEach(task=>{dayMeals.forEach(meal=>{const diff=Math.abs(minutesOfItem(task)-meal._minutes);if(diff<=15)conflicts.push({kind:'task-meal',severity:diff===0?'same':'near',a:task,b:meal,diff});});});
  const active=conflicts.filter(c=>!ignoredConflicts.has(conflictKey(c)));
  const ignored=conflicts.filter(c=>ignoredConflicts.has(conflictKey(c)));
  if(!conflicts.length){panel.classList.remove('show');count.textContent='0';list.innerHTML='';return;}
  panel.classList.add('show');
  count.textContent=String(active.length);
  const filter=document.createElement('div');filter.className='conflict-filterbar';
  const info=document.createElement('div');info.className='conflict-meta';info.textContent=active.length?`${active.length} conflicto(s) activo(s)${ignored.length?` · ${ignored.length} ignorado(s)`:''}`:`No hay conflictos activos${ignored.length?` · ${ignored.length} ignorado(s)`:''}.`;
  const toggle=document.createElement('button');toggle.textContent=conflictShowIgnored?'Ocultar ignorados':'Mostrar ignorados';toggle.className=conflictShowIgnored?'active':'';toggle.onclick=()=>{conflictShowIgnored=!conflictShowIgnored;renderConflicts();};
  filter.append(info,toggle);
  list.innerHTML='';list.appendChild(filter);
  const visible=conflictShowIgnored?conflicts:active;
  if(!visible.length){const safe=document.createElement('div');safe.className='conflict-safe';safe.textContent='✓ No hay conflictos activos para este día.';list.appendChild(safe);return;}
  visible.slice(0,12).forEach(c=>{
    const wrap=document.createElement('div');wrap.className='conflict-item';if(ignoredConflicts.has(conflictKey(c)))wrap.style.opacity='.58';
    const icon=document.createElement('div');icon.className='conflict-icon';icon.textContent=c.severity==='same'?'⛔':'⚠️';
    const main=document.createElement('div');main.className='conflict-main';
    let titleA=c.a.title,timeA=clockFromMinutes(minutesOfItem(c.a)),titleB,timeB;
    if(c.kind==='task-task'){titleB=c.b.title;timeB=clockFromMinutes(minutesOfItem(c.b));}else{titleB='🍽️ '+c.b.title;timeB=c.b.meal_time;}
    const t=document.createElement('div');t.className='conflict-title';t.textContent=`${titleA} ↔ ${titleB}`;
    const m=document.createElement('div');m.className='conflict-meta';m.innerHTML=c.severity==='same'?`Ambas están programadas a las <strong>${esc(timeA)}</strong>.`:`Están separadas por solo <strong>${c.diff} min</strong> (${esc(timeA)} y ${esc(timeB)}).`;
    if(ignoredConflicts.has(conflictKey(c)))m.innerHTML+=' <strong>· Ignorado</strong>';
    main.append(t,m);
    const actions=document.createElement('div');actions.className='conflict-actions';
    const view=document.createElement('button');view.className='conflict-action';view.textContent='Ver horario';view.onclick=()=>{removeTooltip();scrollToTime(Math.min(minutesOfItem(c.a),c.kind==='task-task'?minutesOfItem(c.b):c.b._minutes));};
    const suggest=document.createElement('button');suggest.className='conflict-suggest';suggest.textContent='Sugerir';suggest.onclick=()=>showConflictSuggestion(c);
    const ignore=document.createElement('button');ignore.className='conflict-ignore';ignore.textContent=ignoredConflicts.has(conflictKey(c))?'Reactivar':'Ignorar';ignore.onclick=()=>{const key=conflictKey(c);if(ignoredConflicts.has(key))ignoredConflicts.delete(key);else ignoredConflicts.add(key);saveIgnoredConflicts();renderConflicts();};
    actions.append(view,suggest,ignore);wrap.append(icon,main,actions);list.appendChild(wrap);
  });
  if(visible.length>12){const more=document.createElement('div');more.className='conflict-meta';more.textContent=`Hay ${visible.length-12} conflicto(s) más.`;list.appendChild(more);}
}
function scrollToTime(totalMinutes){const hour=Math.floor(totalMinutes/60);const idx=HOURS.indexOf(hour);const rows=document.querySelectorAll('.hour');if(idx>=0&&rows[idx])rows[idx].scrollIntoView({behavior:'smooth',block:'center'});}

function renderSchedule(){const c=$('schedule');c.innerHTML='';HOURS.forEach(hour=>{const row=document.createElement('div');row.className='hour';const t=document.createElement('div');t.className='time';t.textContent=String(hour).padStart(2,'0')+':00';t.onclick=()=>openTaskModal(hour,0);const s=document.createElement('div');s.className='slot';s.onclick=()=>openTaskModal(hour,0);const list=tasks.filter(x=>x.day===selectedDay&&Number(x.hour)===hour).sort(taskSort);if(!list.length){const e=document.createElement('div');e.className='empty';e.textContent='Tocá para agregar';s.appendChild(e);}list.forEach(task=>{const card=document.createElement('div');card.className='task'+(task.completed?' completed':'');const check=document.createElement('input');check.type='checkbox';check.className='task-complete';check.checked=!!task.completed;check.title=task.completed?'Marcar como pendiente':'Marcar como completada';check.onclick=ev=>{ev.stopPropagation();toggleTaskComplete(task)};const actionWrap=document.createElement('div');actionWrap.className='task-actions';const edit=document.createElement('button');edit.className='edit-task';edit.textContent='✎';edit.title='Editar tarea';edit.onclick=ev=>{ev.stopPropagation();openTaskModal(Number(task.hour)||7,Number(task.minute)||0,task)};const del=document.createElement('button');del.className='delete-task';del.textContent='×';del.title='Eliminar tarea';del.onclick=ev=>{ev.stopPropagation();deleteTask(task.id)};actionWrap.append(edit,del);const tm=document.createElement('div');tm.className='task-time';tm.textContent=`${pad2(Number(task.hour)||0)}:${pad2(Number(task.minute)||0)}`;const h=document.createElement('h4');h.textContent=task.title;const p=document.createElement('p');p.textContent=task.description||'';card.append(check,actionWrap,tm,h,p);if(task.completed){const status=document.createElement('div');status.className='task-status';status.textContent='✓ Completada';card.appendChild(status);}card.onclick=ev=>ev.stopPropagation();enableTooltip(card,task.title,task.description||'Sin descripción',`${DAYS[selectedDay]} · ${pad2(Number(task.hour)||0)}:${pad2(Number(task.minute)||0)}`);s.appendChild(card)});row.append(t,s);c.appendChild(row);});renderConflicts();}

function renderDashboard(){
  const now = new Date();
  $('dashboardDate').textContent = now.toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long'});
  const dayTasks = tasks.filter(x=>x.day===selectedDay).sort(taskSort);
  const nowAR=getArgentinaNow();
  const currentMinutes=nowAR.getHours()*60+nowAR.getMinutes();
  const pendingTask = dayTasks.find(x=>!x.completed && ((Number(x.hour)||0)*60+(Number(x.minute)||0))>=currentMinutes) || dayTasks.find(x=>!x.completed);
  if(pendingTask){$('dashNextTask').textContent=pendingTask.title;$('dashNextTaskMeta').textContent=`${DAYS[selectedDay]} · ${pad2(Number(pendingTask.hour)||0)}:${pad2(Number(pendingTask.minute)||0)}${pendingTask.description?' · '+pendingTask.description:''}`;}
  else if(dayTasks.length){$('dashNextTask').textContent='✓ Día completado';$('dashNextTaskMeta').textContent='Terminaste todas las tareas cargadas para este día.';}
  else{$('dashNextTask').textContent='Sin tareas';$('dashNextTaskMeta').textContent='No tenés tareas cargadas para este día.';}
  const todaysExercises=workoutExercises.filter(x=>x.day===workoutDay);if(todaysExercises.length){$('dashWorkout').textContent=`${todaysExercises.length} ${todaysExercises.length===1?'ejercicio':'ejercicios'}`;$('dashWorkoutMeta').textContent=`Rutina de ${DAYS[workoutDay]}`;$('dashWorkoutChip').textContent=`${todaysExercises.length} ${todaysExercises.length===1?'ejercicio':'ejercicios'}`;}else{$('dashWorkout').textContent='Sin rutina cargada';$('dashWorkoutMeta').textContent=`No hay ejercicios guardados para ${DAYS[workoutDay]}.`;$('dashWorkoutChip').textContent='0 ejercicios';}
  const todaysMeals=nutritionMeals.filter(x=>x.day===nutritionDay);const mealCount=todaysMeals.length;const kcal=todaysMeals.reduce((sum,x)=>sum+(Number(x.calories)||0),0);const protein=todaysMeals.reduce((sum,x)=>sum+(Number(x.protein_g)||0),0);$('dashMeals').textContent=`${mealCount} ${mealCount===1?'comida':'comidas'}`;$('dashMealMeta').textContent=mealCount?`${Math.round(kcal)} kcal · ${Math.round(protein)} g de proteína cargada`:'Todavía no cargaste comidas para hoy.';$('dashMealProgress').style.width=`${Math.min(100,(mealCount/6)*100)}%`;
  const usedHours=new Set(dayTasks.map(x=>x.hour)).size;const completed=dayTasks.filter(x=>x.completed).length;const progress=dayTasks.length?Math.round((completed/dayTasks.length)*100):0;$('dashTaskCount').textContent=`${completed}/${dayTasks.length} completadas`;$('dashTaskMeta').textContent=`${usedHours} de ${HOURS.length} bloques horarios ocupados`;$('dashTaskProgress').style.width=`${progress}%`;$('dashTaskProgressText').textContent=dayTasks.length?`${progress}% completado`:'Sin tareas para calcular progreso';
  renderInsights();
  renderNutritionGoals();
  renderTodayTimeline();
}



renderSmartDashboard();

function renderTodayTimeline(){
  const list=$('todayTimelineList');
  if(!list) return;
  const now=getArgentinaNow();
  const todayIdx=getTodayIndex();
  const nowMin=now.getHours()*60+now.getMinutes();
  const items=[];
  tasks.filter(t=>Number(t.day)===todayIdx).forEach(t=>items.push({minutes:minutesOfItem(t),title:t.title,description:t.description||'',type:'Tarea',done:!!t.completed,id:t.id}));
  nutritionMeals.filter(m=>Number(m.day)===nutritionDay && m.meal_time).forEach(m=>{
    const [h,mi]=String(m.meal_time).split(':').map(Number);
    items.push({minutes:(h||0)*60+(mi||0),title:m.title||mealLabel(m.meal_type),description:m.description||m.foods||'',type:mealLabel(m.meal_type),done:false,id:m.id});
  });
  items.sort((a,b)=>a.minutes-b.minutes);
  list.innerHTML='';
  if(!items.length){list.innerHTML='<div class="dashboard-empty">No hay actividades con horario para hoy.</div>'; $('todayNowBadge').textContent='Libre'; return;}
  const upcoming=items.find(x=>!x.done && x.minutes>=nowMin) || items.find(x=>!x.done);
  $('todayNowBadge').textContent=upcoming?`Siguiente ${clockFromMinutes(upcoming.minutes)}`:'Día completado';
  items.slice(0,8).forEach(item=>{
    const el=document.createElement('div');
    el.className='timeline-item'+(item.done?' done':'')+(upcoming&&item.id===upcoming.id?' next':'');
    el.innerHTML=`<div class="timeline-time">${clockFromMinutes(item.minutes)}</div><div class="timeline-line"></div><div class="timeline-main"><div class="timeline-title">${esc(item.title)}</div><div class="timeline-sub">${esc(item.description||item.type)}</div></div><div class="timeline-type">${esc(item.type)}</div>`;
    list.appendChild(el);
  });
}

// Instalable como app cuando el navegador lo admite.
let deferredInstallPrompt=null;
document.getElementById('smartCompleteNext').addEventListener('click',async()=>{const next=getUpcomingActivity();if(!next||next.kind!=='task'){alert('No hay una tarea pendiente próxima.');return;}const task=tasks.find(t=>t.id===next.id);if(task)await toggleTaskComplete(task);});
document.getElementById('smartOpenSchedule').addEventListener('click',()=>{document.getElementById('schedule').scrollIntoView({behavior:'smooth',block:'start'});});
document.getElementById('smartOpenWorkout').addEventListener('click',()=>{$('workoutToggle').click();setTimeout(()=>$('workoutPanel').scrollIntoView({behavior:'smooth',block:'start'}),120);});
document.getElementById('smartOpenNutrition').addEventListener('click',()=>{$('nutritionToggle').click();setTimeout(()=>$('nutritionPanel').scrollIntoView({behavior:'smooth',block:'start'}),120);});

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  $('installAppBtn')?.classList.add('show');
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  $('installAppBtn')?.classList.remove('show');
});
$('installAppBtn').onclick=async()=>{
  if(!deferredInstallPrompt){
    alert('En iPhone: Safari → Compartir → Agregar a pantalla de inicio. En Android/Chrome, usá el menú del navegador → Instalar aplicación.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  $('installAppBtn')?.classList.remove('show');
};

function openQuickActions(){const o=$('quickActions');if(o)o.classList.add('show')}
function closeQuickActions(){const o=$('quickActions');if(o)o.classList.remove('show')}
function setMobileNav(id){document.querySelectorAll('.mobile-nav-btn').forEach(b=>b.classList.remove('active'));$(id)?.classList.add('active')}
function setupV24Nav(){
 $('quickAddFab')?.addEventListener('click',openQuickActions);$('quickActionsClose')?.addEventListener('click',closeQuickActions);$('quickActions')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeQuickActions()});
 $('quickTaskBtn')?.addEventListener('click',()=>{closeQuickActions();const n=getArgentinaNow();openTaskModal(Math.max(7,Math.min(22,n.getHours())),n.getMinutes())});$('quickMealBtn')?.addEventListener('click',()=>{closeQuickActions();openNutritionPanel();setTimeout(()=>openNutritionModal(),120)});$('quickExerciseBtn')?.addEventListener('click',()=>{closeQuickActions();openWorkoutPanel();setTimeout(()=>openExerciseModal(),120)});$('quickDateBtn')?.addEventListener('click',()=>{closeQuickActions();openDateModal(null,todayISO())});
 // La navegación de secciones es gestionada por V32 (un único menú flotante).
}
// quickAddFab handled by setupV24Nav()

function startOfWeekMonday(dateObj){const d=new Date(dateObj);d.setHours(12,0,0,0);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d;}
function dateKeyFromDate(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}
function localDateForDay(dayIndex){const start=startOfWeekMonday(getArgentinaNow());const d=new Date(start);d.setDate(start.getDate()+dayIndex);return d;}
function computeCurrentStreak(){let streak=0;const today=getArgentinaNow();for(let i=0;i<30;i++){const d=new Date(today);d.setDate(today.getDate()-i);const key=dateKeyFromDate(d);const wd=(d.getDay()+6)%7;const completed=tasks.some(t=>Number(t.day)===wd&&t.completed)||workoutLogs.some(l=>String(l.performed_at)===key);if(completed)streak++;else if(i===0)continue;else break;}return streak;}
function renderInsights(){const el=$('insightsWeek');if(!el)return;el.innerHTML='';let activeDays=0;let completedWeek=0,totalWeek=0;const weekStart=startOfWeekMonday(getArgentinaNow());for(let i=0;i<7;i++){const d=localDateForDay(i);const key=dateKeyFromDate(d);const dayTasks=tasks.filter(t=>Number(t.day)===i);const done=dayTasks.filter(t=>t.completed).length;totalWeek+=dayTasks.length;completedWeek+=done;const pct=dayTasks.length?Math.round(done/dayTasks.length*100):0;const hasWorkout=workoutLogs.some(l=>String(l.performed_at)===key);const hasMeals=nutritionMeals.some(m=>Number(m.day)===i);if(pct>0||hasWorkout||hasMeals)activeDays++;const card=document.createElement('div');card.className='insight-day'+(i===selectedDay?' today':'');card.innerHTML=`<div class="insight-day-name">${DAYS[i].slice(0,3)}</div><div class="insight-day-date">${pad2(d.getDate())}/${pad2(d.getMonth()+1)}</div><div class="insight-progress"><span style="width:${pct}%"></span></div><div class="insight-day-meta">${pct}% tareas · ${hasWorkout?'🏋️ ':''}${hasMeals?'🍽️':''}</div>`;el.appendChild(card);}const sessions=workoutLogs.filter(l=>{const d=new Date(String(l.performed_at)+'T12:00:00');const end=new Date(weekStart);end.setDate(end.getDate()+7);return d>=weekStart&&d<end}).length;const meals=nutritionMeals.length;const pct=totalWeek?Math.round(completedWeek/totalWeek*100):0;$('weekTasksPct').textContent=pct+'%';$('weekWorkoutCount').textContent=String(sessions);$('weekMealCount').textContent=String(meals);$('weekActiveDays').textContent=`${activeDays}/7`;$('streakBadge').textContent=`🔥 ${computeCurrentStreak()} días`;const detail=$('weeklyDetail');detail.innerHTML='';[`✓ ${completedWeek}/${totalWeek} tareas completadas`,`🏋️ ${sessions} sesiones esta semana`,`🍽️ ${meals} comidas cargadas`].forEach(t=>{const el=document.createElement('span');el.className='tag';el.textContent=t;detail.appendChild(el)});}
function renderNutritionGoals(){const c=$('nutritionGoals');if(!c)return;const meals=nutritionMeals.filter(m=>Number(m.day)===nutritionDay);const totals={calories:0,protein:0,carbs:0,fat:0};meals.forEach(m=>{totals.calories+=Number(m.calories)||0;totals.protein+=Number(m.protein_g)||0;totals.carbs+=Number(m.carbs_g)||0;totals.fat+=Number(m.fat_g)||0});const items=[['🔥','Calorías','calories','kcal'],['🥩','Proteínas','protein','g'],['🍚','Carbohidratos','carbs','g'],['🥑','Grasas','fat','g']];c.innerHTML='';items.forEach(([icon,label,key,unit])=>{const card=document.createElement('div');card.className='goal-card';const pct=nutritionGoals[key]>0?Math.min(100,totals[key]/nutritionGoals[key]*100):0;card.innerHTML=`<h4>${icon} ${label}</h4><strong>${key==='calories'?Math.round(totals[key]):Math.round(totals[key]*10)/10} / ${nutritionGoals[key]} ${unit}</strong><div class="goal-bar"><span style="width:${pct}%"></span></div><span>${Math.round(pct)}% del objetivo</span>`;c.appendChild(card)});$('nutritionGoalSummary').innerHTML=`<strong>Objetivos diarios:</strong> ${nutritionGoals.calories} kcal · ${nutritionGoals.protein} g proteína · ${nutritionGoals.carbs} g carbohidratos · ${nutritionGoals.fat} g grasas`;}
function openGoalsModal(){loadNutritionGoals();$('goalCalories').value=nutritionGoals.calories;$('goalProtein').value=nutritionGoals.protein;$('goalCarbs').value=nutritionGoals.carbs;$('goalFat').value=nutritionGoals.fat;$('goalOverlay').classList.add('show');}
function closeGoalsModal(){$('goalOverlay').classList.remove('show');}

function getTodayTaskItems(){return tasks.filter(t=>Number(t.day)===selectedDay).sort(taskSort);}
function getUpcomingActivity(){const now=getArgentinaNow();const nowMin=now.getHours()*60+now.getMinutes();const dayItems=buildReminderCandidates().filter(x=>{const d=x.when.getDate()===now.getDate()&&x.when.getMonth()===now.getMonth()&&x.when.getFullYear()===now.getFullYear();return d;}).map(x=>({minutes:x.when.getHours()*60+x.when.getMinutes(),title:x.title,description:x.meta||'',kind:x.kind,id:x.id})).sort((a,b)=>a.minutes-b.minutes);return dayItems.find(x=>x.minutes>=nowMin)||dayItems.find(x=>x.kind==='task');}
function renderSmartDashboard(){const all=getTodayTaskItems();const done=all.filter(t=>t.completed).length;const pct=all.length?Math.round(done/all.length*100):0;const next=getUpcomingActivity();const conflicts=document.querySelectorAll('.conflict-item').length;const dayMeals=nutritionMeals.filter(m=>Number(m.day)===nutritionDay);const mealTarget=6;const mealPct=Math.min(100,Math.round(dayMeals.length/mealTarget*100));const todaysExercises=workoutExercises.filter(x=>Number(x.day)===workoutDay);const workoutLogsToday=workoutLogs.filter(l=>String(l.performed_at)===dateKeyFromDate(getArgentinaNow()));$('smartTasksDone').textContent=pct+'%';$('smartNextCount').textContent=Math.max(0,all.length-done);$('smartCompletedCount').textContent=done;$('smartConflictCount').textContent=conflicts;$('smartStreak').textContent=computeCurrentStreak()+' días';$('smartWorkoutState').textContent=workoutLogsToday.length?`${workoutLogsToday.length} sesión(es)`:(todaysExercises.length?`${todaysExercises.length} ejercicios`:'Sin rutina');$('smartNutritionState').textContent=`${mealPct}%`;$('smartBadge').textContent=conflicts?`⚠️ ${conflicts} conflicto(s)`:next?'🕒 En agenda':'✓ Todo tranquilo';$('smartNowBar').style.width=pct+'%';if(!next){$('smartNowTitle').textContent='Sin actividad próxima';$('smartNowMeta').textContent='No hay tareas ni comidas programadas para hoy.';}else{const now=getArgentinaNow();const nowMin=now.getHours()*60+now.getMinutes();const delta=next.minutes-nowMin;$('smartNowTitle').textContent=next.title;$('smartNowMeta').textContent=`${clockFromMinutes(next.minutes)} · ${delta>0?`en ${delta} min`:'ahora mismo'} · ${next.kind==='task'?'Tarea':'Comida'}`;}}
function updateStats(){const todayCount=tasks.filter(x=>x.day===selectedDay).length;const used=new Set(tasks.filter(x=>x.day===selectedDay).map(x=>x.hour)).size;$('totalTasks').textContent=tasks.length;$('todayTasks').textContent=todayCount;$('freeHours').textContent=HOURS.length-used;}

function openTaskModal(hour,minute=0,task=null){
  editingTaskId=task?.id||null;
  selectedHour=Number(hour)||7;
  $('taskModalTitle').textContent=task?'✎ Editar tarea':'➕ Agregar tarea';
  $('taskModalInfo').textContent=task?`${DAYS[Number(task.day)||0]} · ${pad2(Number(task.hour)||7)}:${pad2(Number(task.minute)||0)}`:`${DAYS[selectedDay]} · ${pad2(selectedHour)}:${pad2(minute)}`;
  $('taskDayInput').value=String(task?.day??selectedDay);
  $('taskHourInput').value=Number(task?.hour??selectedHour);
  $('taskMinuteInput').value=Number(task?.minute??minute);
  $('taskTitleInput').value=task?.title||'';
  $('taskDescInput').value=task?.description||'';
  $('saveTaskBtn').textContent=task?'Guardar cambios':'Guardar tarea';
  $('taskOverlay').classList.add('show');
  setTimeout(()=>$('taskTitleInput').focus(),80);
}
function closeTaskModal(){ $('taskOverlay').classList.remove('show'); editingTaskId=null; }
$('taskDayInput').onchange=()=>updateTaskModalInfo();
$('taskHourInput').oninput=()=>{let h=Math.max(7,Math.min(22,Number($('taskHourInput').value)||7));$('taskHourInput').value=h;updateTaskModalInfo()};
$('taskMinuteInput').onchange=updateTaskModalInfo;
function updateTaskModalInfo(){const d=Number($('taskDayInput').value)||selectedDay;const h=Math.max(7,Math.min(22,Number($('taskHourInput').value)||7));const m=Math.max(0,Math.min(59,Number($('taskMinuteInput').value)||0));$('taskModalInfo').textContent=`${DAYS[d]} · ${pad2(h)}:${pad2(m)}`;}
$('saveTaskBtn').onclick=async()=>{
  const title=$('taskTitleInput').value.trim();
  const description=$('taskDescInput').value.trim();
  const day=Math.max(0,Math.min(6,Number($('taskDayInput').value)||selectedDay));
  const hour=Math.max(7,Math.min(22,Number($('taskHourInput').value)||selectedHour));
  const minute=Math.max(0,Math.min(59,Number($('taskMinuteInput').value)||0));
  if(!title)return alert('Escribí el título.');
  let error=null;
  if(editingTaskId){
    ({error}=await sb.from('tasks').update({title,description,day,hour,minute}).eq('id',editingTaskId));
  }else{
    ({error}=await sb.from('tasks').insert({user_id:currentUser.id,title,description,day,hour,minute,completed:false}));
  }
  if(error){alert(error.message);return;}
  closeTaskModal();
  selectedDay=day;
  await loadTasks();
  createDays();
  renderSchedule();
  updateStats();
  renderDashboard();
  renderConflicts();
};
async function toggleTaskComplete(task){
  const next=!task.completed;
  task.completed=next;
  removeTooltip();
  renderSchedule();
  renderDashboard();
  const {error}=await sb.from('tasks').update({completed:next}).eq('id',task.id);
  if(error){task.completed=!next;renderSchedule();renderDashboard();alert(error.message);}
}

async function deleteTask(id){
  removeTooltip();
  const {error}=await sb.from('tasks').delete().eq('id',id);
  if(error){alert(error.message);return;}
  await loadTasks();
  removeTooltip();
  renderSchedule();
  updateStats();
  setRefreshStatus('Actualizado','ok');
}


function setPanelOpen(panelId, iconId, open){
  const panel=$(panelId);
  const icon=$(iconId);
  panel.classList.toggle('open',open);
  icon.textContent=open?'−':'+';
}
function setTabActive(tabId, active){
  $(tabId).classList.toggle('active', active);
}
function toggleCalendarPanel(){
  const willOpen=!$('calendarPanel').classList.contains('open');
  setPanelOpen('calendarPanel','calendarIcon',willOpen);
  setPanelOpen('workoutPanel','workoutIcon',false);
  setPanelOpen('nutritionPanel','nutritionIcon',false);
  setTabActive('calendarToggle',willOpen);
  setTabActive('workoutToggle',false);
  setTabActive('nutritionToggle',false);
  if(willOpen){
    requestAnimationFrame(()=>{
      $('calendarPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
    });
  }
}
function openWorkoutPanel(){
  const willOpen=!$('workoutPanel').classList.contains('open');
  setPanelOpen('workoutPanel','workoutIcon',willOpen);
  setPanelOpen('calendarPanel','calendarIcon',false);
  setPanelOpen('nutritionPanel','nutritionIcon',false);
  setTabActive('workoutToggle',willOpen);
  setTabActive('calendarToggle',false);
  setTabActive('nutritionToggle',false);
  if(willOpen){
    requestAnimationFrame(()=>{
      $('workoutPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
    });
  }
}

function renderNutritionDays(){const c=$('nutritionDays');c.innerHTML='';DAYS.forEach((d,i)=>{const b=document.createElement('button');b.className='workout-day-btn'+(i===nutritionDay?' active':'');b.textContent=d;b.onclick=()=>{nutritionDay=i;renderNutritionDays();renderNutritionList();renderNutritionGoals();renderDashboard();};c.appendChild(b);});}
function renderMealTabs(){const c=$('mealTabs');c.innerHTML='';MEAL_TYPES.forEach(m=>{const b=document.createElement('button');b.className='meal-tab'+(m.key===activeMealType?' active':'');b.textContent=m.label;b.onclick=()=>{activeMealType=m.key;renderMealTabs();renderNutritionList();renderNutritionGoals();renderDashboard();};c.appendChild(b);});}
async function loadNutritionMeals(){const {data,error}=await sb.from('nutrition_meals').select('*').eq('day',nutritionDay).order('meal_order',{ascending:true}).order('meal_time',{ascending:true});if(error){console.error(error);const c=cacheRead('nutritionMealsAll');nutritionMeals=Array.isArray(c)?c.filter(x=>Number(x.day)===Number(nutritionDay)):[]}else{nutritionMeals=data||[];let all=cacheRead('nutritionMealsAll');all=Array.isArray(all)?all:[];all=all.filter(x=>Number(x.day)!==Number(nutritionDay));all.push(...nutritionMeals);cacheWrite('nutritionMealsAll',all)}}
function mealLabel(key){return MEAL_TYPES.find(m=>m.key===key)?.label||key;}
function renderNutritionList(){const c=$('mealList');c.innerHTML='';const list=nutritionMeals.filter(m=>m.meal_type===activeMealType);if(!list.length){const e=document.createElement('div');e.className='meal-empty';e.textContent='No hay ninguna comida cargada para '+DAYS[nutritionDay]+' en '+mealLabel(activeMealType)+'. Tocá “Agregar comida” para crearla.';c.appendChild(e);return;}list.forEach(meal=>{const card=document.createElement('div');card.className='meal-card';const top=document.createElement('div');top.className='meal-card-head';const left=document.createElement('div');const name=document.createElement('div');name.className='meal-name';name.textContent=meal.title;left.appendChild(name);if(meal.foods){const foods=document.createElement('div');foods.className='meal-foods';foods.textContent=meal.foods;left.appendChild(foods);}if(meal.description){const desc=document.createElement('div');desc.className='meal-description';desc.textContent=meal.description;left.appendChild(desc);}const meta=document.createElement('div');meta.className='meal-meta';const chips=[meal.calories!=null?`Cal: ${meal.calories}`:null,meal.protein_g!=null?`Prot: ${meal.protein_g} g`:null,meal.carbs_g!=null?`Carbs: ${meal.carbs_g} g`:null,meal.fat_g!=null?`Grasas: ${meal.fat_g} g`:null,meal.meal_time?`Hora: ${meal.meal_time}`:null].filter(Boolean);chips.forEach(t=>{const ch=document.createElement('span');ch.className='meal-chip';ch.textContent=t;meta.appendChild(ch);});if(chips.length)left.appendChild(meta);const actions=document.createElement('div');actions.className='meal-actions';const edit=document.createElement('button');edit.className='meal-action';edit.textContent='✎';edit.title='Editar';edit.onclick=()=>openNutritionModal(meal);const del=document.createElement('button');del.className='meal-action delete';del.textContent='×';del.title='Eliminar';del.onclick=()=>deleteMeal(meal.id);actions.append(edit,del);top.append(left,actions);card.appendChild(top);enableTooltip(card,meal.title,meal.description||meal.foods||'Sin descripción',`${DAYS[nutritionDay]} · ${mealLabel(meal.meal_type)}`);c.appendChild(card);});}
function openNutritionPanel(){const willOpen=!$('nutritionPanel').classList.contains('open');setPanelOpen('nutritionPanel','nutritionIcon',willOpen);setPanelOpen('calendarPanel','calendarIcon',false);setPanelOpen('workoutPanel','workoutIcon',false);setTabActive('nutritionToggle',willOpen);setTabActive('calendarToggle',false);setTabActive('workoutToggle',false);if(willOpen){renderNutritionDays();renderMealTabs();loadNutritionMeals().then(renderNutritionList);requestAnimationFrame(()=>$('nutritionPanel').scrollIntoView({behavior:'smooth',block:'nearest'}));}}
function openNutritionModal(meal=null){editingMealId=meal?.id||null;$('nutritionModalTitle').textContent=meal?'✎ Editar comida':'＋ Agregar comida';$('nutritionModalInfo').textContent=`${DAYS[nutritionDay]} · ${mealLabel(meal?.meal_type||activeMealType)}`;$('mealType').value=meal?.meal_type||activeMealType;$('mealTitle').value=meal?.title||'';$('mealFoods').value=meal?.foods||'';$('mealCalories').value=meal?.calories??'';$('mealProtein').value=meal?.protein_g??'';$('mealCarbs').value=meal?.carbs_g??'';$('mealFat').value=meal?.fat_g??'';$('mealTime').value=meal?.meal_time||'';$('mealDescription').value=meal?.description||'';$('cancelMealBtn').classList.remove('hidden');$('cancelMealBtn').textContent='Cancelar';$('nutritionOverlay').classList.add('show');setTimeout(()=>$('mealTitle').focus(),80)}
function closeNutritionModal(){$('nutritionOverlay').classList.remove('show');editingMealId=null;}
$('saveMealBtn').onclick=async()=>{const meal_type=$('mealType').value;const payload={meal_type,title:$('mealTitle').value.trim(),foods:$('mealFoods').value.trim(),calories:Number($('mealCalories').value)||null,protein_g:Number($('mealProtein').value)||null,carbs_g:Number($('mealCarbs').value)||null,fat_g:Number($('mealFat').value)||null,meal_time:$('mealTime').value||null,description:$('mealDescription').value.trim()};if(!payload.title)return alert('Escribí el nombre de la comida.');if(editingMealId){const {error}=await sb.from('nutrition_meals').update(payload).eq('id',editingMealId);if(error){alert(error.message);return}}else{payload.user_id=currentUser.id;payload.day=nutritionDay;payload.meal_order=MEAL_TYPES.findIndex(m=>m.key===meal_type);const {error}=await sb.from('nutrition_meals').insert(payload);if(error){alert(error.message);return}}closeNutritionModal();await loadNutritionMeals();renderNutritionList();renderNutritionGoals();renderDashboard();renderConflicts();};
async function deleteMeal(id){if(!confirm('¿Eliminar esta comida?'))return;const {error}=await sb.from('nutrition_meals').delete().eq('id',id);if(error)alert(error.message);else{await loadNutritionMeals();renderNutritionList();renderNutritionGoals();renderDashboard();renderConflicts();}}

function renderWorkoutDays(){const c=$('workoutDays');c.innerHTML='';DAYS.forEach((d,i)=>{const b=document.createElement('button');b.className='workout-day-btn'+(i===workoutDay?' active':'');b.textContent=d;b.onclick=async()=>{workoutDay=i;renderWorkoutDays();await loadWorkoutExercises();renderWorkoutList();renderWorkoutHistory();renderWorkoutAnalytics();renderDashboard();};c.appendChild(b)});}
async function loadWorkoutExercises(){
  const useCached=()=>{const c=cacheRead('workoutExercisesAll');const cached=Array.isArray(c)?c.filter(x=>Number(x.day)===Number(workoutDay)):[];if(cached.length||!navigator.onLine){workoutExercises=cached;return true}return false};
  if(!navigator.onLine){useCached();return}
  try{const {data,error}=await sb.from('workout_exercises').select('*').eq('day',workoutDay).order('position',{ascending:true}).order('created_at',{ascending:true});if(error)throw error;workoutExercises=data||[];let all=cacheRead('workoutExercisesAll');all=Array.isArray(all)?all:[];all=all.filter(x=>Number(x.day)!==Number(workoutDay));all.push(...workoutExercises);cacheWrite('workoutExercisesAll',all)}catch(error){console.error('Entrenamiento:',error);useCached()}}
async function loadWorkoutLogs(){const {data,error}=await sb.from('workout_logs').select('*').order('performed_at',{ascending:false}).order('created_at',{ascending:false}).limit(100);if(error){console.error(error);const c=cacheRead('workoutLogs');workoutLogs=Array.isArray(c)?c:[]}else{workoutLogs=data||[];cacheWrite('workoutLogs',workoutLogs)}}
function renderWorkoutStats(){
  const now=new Date();
  const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-30);
  const recent=workoutLogs.filter(l=>new Date(l.performed_at+'T12:00:00')>=cutoff);
  const sets=recent.reduce((s,l)=>s+(Number(l.sets_completed)||0),0);
  const exerciseCount=workoutExercises.length;
  const last=workoutLogs[0];
  $('workoutStatSessions').textContent=recent.length;
  $('workoutStatSets').textContent=sets;
  $('workoutStatExercises').textContent=exerciseCount;
  $('workoutStatLast').textContent=last?fmtDate(last.performed_at).replace(' de ',' ').slice(0,6):'—';
}
function renderWorkoutAnalytics(){
  const bars=$('weeklyBars'); if(!bars)return; bars.innerHTML='';
  const now=new Date(); now.setHours(12,0,0,0);
  const weeks=[0,1,2,3].map(offset=>{const end=new Date(now); end.setDate(end.getDate()-offset*7); const start=new Date(end); start.setDate(start.getDate()-6); return {start,end};}).reverse();
  const counts=weeks.map(w=>workoutLogs.filter(l=>{const d=new Date(l.performed_at+'T12:00:00');return d>=w.start&&d<=w.end;}).length);
  const max=Math.max(1,...counts);
  counts.forEach((count,i)=>{const wrap=document.createElement('div');wrap.className='week-bar';const val=document.createElement('div');val.className='week-bar-value';val.textContent=count;const track=document.createElement('div');track.className='week-bar-track';const fill=document.createElement('div');fill.className='week-bar-fill';fill.style.height=(count/max*100)+'%';track.appendChild(fill);const label=document.createElement('div');label.className='week-bar-label';label.textContent=i===3?'Esta semana':`Sem ${i+1}`;wrap.append(val,track,label);bars.appendChild(wrap);});
  const total=counts.reduce((a,b)=>a+b,0); $('analyticsSummary').textContent=`${total} ${total===1?'sesión':'sesiones'}`;
  const countsByEx={}; workoutLogs.slice(0,100).forEach(l=>{const key=l.exercise_name||'Ejercicio';countsByEx[key]=(countsByEx[key]||0)+1;});
  const top=Object.entries(countsByEx).sort((a,b)=>b[1]-a[1])[0]; const h=$('highlightExercise'); if(!top){h.innerHTML='<div class="highlight-name">Sin registros todavía</div><div class="highlight-meta">Registrá una sesión desde un ejercicio para empezar a ver tu progreso.</div>';return;} h.innerHTML=`<div class="highlight-name">${esc(top[0])}</div><div class="highlight-meta">${top[1]} ${top[1]===1?'registro reciente':'registros recientes'}.</div><div class="highlight-chip">⭐ Ejercicio con más seguimiento</div>`;
}
function parseSeriesMap(value){
  const text=String(value??'').replace(/,/g,'.').trim();
  const out=[];
  if(!text)return out;
  let m;
  const labeled=/S\s*(\d+)\s*:\s*(-?\d+(?:\.\d+)?)/gi;
  while((m=labeled.exec(text))) out.push({set:Number(m[1]),value:Number(m[2])});
  if(out.length)return out.sort((a,b)=>a.set-b.set);
  const plain=text.split(/[\/|·,;]+/).map(x=>x.trim()).filter(Boolean);
  plain.forEach((part,i)=>{
    const n=part.match(/-?\d+(?:\.\d+)?/);
    if(n)out.push({set:i+1,value:Number(n[0])});
  });
  return out;
}
function parseNumericValues(value){return parseSeriesMap(value).map(x=>x.value).filter(Number.isFinite)}
function parseWeightValue(value){const a=parseNumericValues(value);return a.length?Math.max(...a):null}
function parseRepValue(value){const a=parseNumericValues(value);return a.length?a.reduce((x,y)=>x+y,0):null}
function parseRirValue(value){const a=parseNumericValues(value);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function parseVolumeValue(log){
  const rs=parseSeriesMap(log?.reps),ws=parseSeriesMap(log?.weight);if(!rs.length||!ws.length)return 0;
  const wm=new Map(ws.map(x=>[x.set,x.value]));
  return rs.reduce((sum,x)=>{const w=wm.get(x.set);return sum+(x.value>0&&Number.isFinite(w)&&w>0?x.value*w:0)},0);
}
function renderExerciseProgress(){
  const select=$('progressExerciseSelect'),wrap=$('progressChartWrap'),summary=$('progressSummary'),legend=$('progressLegend'),metric=$('progressMetricLabel');
  if(!select||!wrap||!summary||!legend)return;
  const names=[...new Set((workoutLogs||[]).map(l=>String(l.exercise_name||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const previous=select.value;
  select.innerHTML='';
  names.forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;select.appendChild(o)});
  if(!names.length){wrap.innerHTML='<div class="progress-empty">Todavía no hay registros para comparar.<br>Registrá sesiones desde “Registrar sesión”.</div>';summary.innerHTML='';legend.innerHTML='';if(metric)metric.textContent='Sin datos';return;}
  select.value=names.includes(previous)?previous:names[0];
  const selected=select.value;
  const logs=(workoutLogs||[]).filter(l=>String(l.exercise_name||'').trim()===selected).slice().sort((a,b)=>{
    const d=String(a.performed_at||'').localeCompare(String(b.performed_at||''));
    return d||String(a.created_at||'').localeCompare(String(b.created_at||''));
  });
  const points=logs.map(l=>({date:String(l.performed_at||''),weight:parseWeightValue(l.weight),reps:parseRepValue(l.reps),rir:parseRirValue(l.rir),volume:parseVolumeValue(l),raw:l}));
  const previousWeights=points.filter(p=>p.weight!==null);
  const last=points.at(-1),firstWeight=previousWeights[0]?.weight??null,lastWeight=previousWeights.at(-1)?.weight??null;
  const delta=firstWeight!==null&&lastWeight!==null?lastWeight-firstWeight:null;
  const bestReps=Math.max(...points.map(p=>p.reps??-Infinity));
  const bestVolume=Math.max(...points.map(p=>p.volume||0));
  const avgRirVals=points.map(p=>p.rir).filter(v=>v!==null);
  summary.innerHTML='';
  [['Registros',points.length],['Último peso',lastWeight!==null?`${lastWeight} kg`:'—'],['Cambio peso',delta===null?'—':`${delta>0?'+':''}${Number(delta.toFixed(2))} kg`],['Mayor volumen',bestVolume?`${Math.round(bestVolume)} kg`:'—']].forEach(([label,val])=>{const d=document.createElement('div');d.className='progress-stat';d.innerHTML=`<strong>${esc(String(val))}</strong><span>${label}</span>`;summary.appendChild(d)});
  if(metric)metric.textContent='Elegí qué métrica querés analizar';
  let metricButtons=$('progressMetricButtons');
  if(!metricButtons){metricButtons=document.createElement('div');metricButtons.id='progressMetricButtons';metricButtons.className='progress-metric-buttons';wrap.parentNode.insertBefore(metricButtons,wrap)}
  const metricKey=window.__progressMetricKey||'weight';
  metricButtons.innerHTML='';
  [['weight','Peso (kg)'],['reps','Reps totales'],['rir','RIR promedio'],['volume','Volumen (kg)']].forEach(([key,label])=>{const b=document.createElement('button');b.type='button';b.className='progress-metric-btn'+(key===metricKey?' active':'');b.textContent=label;b.onclick=()=>{window.__progressMetricKey=key;renderExerciseProgress()};metricButtons.appendChild(b)});
  const currentMetric=window.__progressMetricKey||'weight';
  const series=points.map((p,i)=>({x:i,value:p[currentMetric],date:p.date})).filter(p=>p.value!==null&&p.value!==undefined&&Number.isFinite(p.value));
  const labels={weight:'Peso (kg)',reps:'Reps totales',rir:'RIR promedio',volume:'Volumen (kg)'};
  if(metric)metric.textContent=`Mostrando ${labels[currentMetric]}`;
  wrap.innerHTML='';
  if(!series.length){wrap.innerHTML='<div class="progress-empty">No hay valores numéricos suficientes para esta métrica en este ejercicio.</div>';legend.innerHTML='';return;}
  const W=900,H=270,padL=58,padR=20,padT=20,padB=42,cw=W-padL-padR,ch=H-padT-padB;
  const svgNS='http://www.w3.org/2000/svg',svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.classList.add('progress-chart');
  const values=series.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min),lo=currentMetric==='rir'?Math.max(0,min-span*.15):Math.max(0,min-span*.15),hi=max+span*.15;
  for(let i=0;i<=5;i++){const y=padT+ch*i/5,line=document.createElementNS(svgNS,'line');line.setAttribute('x1',padL);line.setAttribute('x2',W-padR);line.setAttribute('y1',y);line.setAttribute('y2',y);line.setAttribute('stroke','rgba(148,163,184,.12)');svg.appendChild(line);const tx=document.createElementNS(svgNS,'text');tx.setAttribute('x',padL-8);tx.setAttribute('y',y+4);tx.setAttribute('text-anchor','end');tx.setAttribute('font-size','10');tx.setAttribute('fill','#64748b');tx.textContent=Number((hi-(hi-lo)*i/5).toFixed(1));svg.appendChild(tx)}
  const coords=series.map((p,i)=>{const x=series.length===1?padL+cw/2:padL+cw*i/(series.length-1);const y=padT+ch-((p.value-lo)/(hi-lo))*ch;return {...p,x,y}});
  const path=document.createElementNS(svgNS,'path');path.setAttribute('fill','none');path.setAttribute('stroke','#60a5fa');path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('d',coords.map((c,i)=>(i?'L':'M')+c.x.toFixed(2)+' '+c.y.toFixed(2)).join(' '));svg.appendChild(path);
  coords.forEach(c=>{const circle=document.createElementNS(svgNS,'circle');circle.setAttribute('cx',c.x);circle.setAttribute('cy',c.y);circle.setAttribute('r','5');circle.setAttribute('fill','#0f172a');circle.setAttribute('stroke','#60a5fa');circle.setAttribute('stroke-width','3');const title=document.createElementNS(svgNS,'title');title.textContent=`${c.date} · ${labels[currentMetric]}: ${Number(c.value.toFixed(2))}`;circle.appendChild(title);svg.appendChild(circle)});
  const idxs=[0,Math.floor((coords.length-1)/2),coords.length-1].filter((v,i,a)=>a.indexOf(v)===i);idxs.forEach(i=>{const c=coords[i],tx=document.createElementNS(svgNS,'text');tx.setAttribute('x',c.x);tx.setAttribute('y',H-11);tx.setAttribute('text-anchor','middle');tx.setAttribute('font-size','10');tx.setAttribute('fill','#64748b');tx.textContent=c.date.slice(5);svg.appendChild(tx)});
  wrap.appendChild(svg);
  legend.innerHTML='';
  const latestLabel=last?last[currentMetric]:null;const best=currentMetric==='weight'?Math.max(...values):Math.max(...values);const pills=[`Mejor: ${Number(best.toFixed(2))}${currentMetric==='weight'||currentMetric==='volume'?' kg':''}`,latestLabel!==null&&latestLabel!==undefined?`Último: ${Number(latestLabel.toFixed(2))}${currentMetric==='weight'||currentMetric==='volume'?' kg':''}`:null,currentMetric==='rir'&&avgRirVals.length?`RIR medio: ${Number((avgRirVals.reduce((a,b)=>a+b,0)/avgRirVals.length).toFixed(1))}`:null].filter(Boolean);
  pills.forEach(t=>{const p=document.createElement('span');p.className='progress-pill';p.textContent=t;legend.appendChild(p)});
}
function renderWorkoutHistory(){
  renderWorkoutStats();
  renderWorkoutAnalytics();
  renderExerciseProgress();
  const c=$('workoutHistoryList');if(!c)return;c.innerHTML='';
  if(!workoutLogs.length){const e=document.createElement('div');e.className='workout-empty';e.style.minHeight='100px';e.textContent='Todavía no registraste sesiones. Usá “Registrar sesión” en un ejercicio.';c.appendChild(e);return;}
  workoutLogs.slice(0,12).forEach(log=>{
    const row=document.createElement('div');row.className='history-row';
    const date=document.createElement('div');date.className='history-date';date.textContent=fmtDate(log.performed_at);
    const main=document.createElement('div');const ex=workoutExercises.find(x=>x.id===log.exercise_id);const name=document.createElement('div');name.className='history-exercise';name.textContent=log.exercise_name||ex?.exercise||'Ejercicio';const meta=document.createElement('div');meta.className='history-meta';meta.textContent=`${log.sets_completed||'-'} series · ${log.reps||'-'} reps · ${log.weight||'-'} · RIR ${log.rir??'-'}${log.notes?' · '+log.notes:''}`;main.append(name,meta);
    const del=document.createElement('button');del.className='history-delete';del.textContent='×';del.title='Eliminar registro';del.onclick=()=>deleteWorkoutLog(log.id);
    row.append(date,main,del);c.appendChild(row);
  });
}
function openWorkoutLogModal(ex){
  loggingExerciseId=ex.id;
  $('logModalTitle').textContent='＋ Registrar sesión';
  $('logModalInfo').textContent=`${DAYS[workoutDay]} · ${ex.exercise}`;
  $('logDate').value=todayISO();
  $('logSets').value=ex.sets??'';
  $('logReps').value=ex.reps??'';
  $('logWeight').value=ex.weight??'';
  $('logRir').value=ex.rir??'';
  $('logNotes').value='';
  $('workoutLogOverlay').classList.add('show');
}
function closeWorkoutLogModal(){ $('workoutLogOverlay').classList.remove('show'); loggingExerciseId=null; }
$('progressExerciseSelect').addEventListener('change',renderExerciseProgress);
$('saveWorkoutLogBtn').onclick=async()=>{
  const ex=workoutExercises.find(x=>x.id===loggingExerciseId);if(!ex)return;
  const payload={user_id:currentUser.id,exercise_id:ex.id,exercise_name:ex.exercise,performed_at:$('logDate').value||todayISO(),sets_completed:Number($('logSets').value)||null,reps:$('logReps').value.trim(),weight:$('logWeight').value.trim(),rir:$('logRir').value===''?null:Number($('logRir').value),notes:$('logNotes').value.trim()};
  const {error}=await sb.from('workout_logs').insert(payload);if(error){alert(error.message);return;}closeWorkoutLogModal();await loadWorkoutLogs();renderWorkoutHistory();renderDashboard();
};
async function deleteWorkoutLog(id){if(!confirm('¿Eliminar este registro de entrenamiento?'))return;const {error}=await sb.from('workout_logs').delete().eq('id',id);if(error){alert(error.message);return}await loadWorkoutLogs();renderWorkoutHistory();renderDashboard();}

function renderWorkoutList(){const c=$('workoutList');c.innerHTML='';if(workoutExercises.length){const start=document.createElement('button');start.type='button';start.className='v28-start-workout';start.textContent='▶ Iniciar vista de entrenamiento';start.onclick=()=>openWorkoutMode();c.appendChild(start);}if(!workoutExercises.length){const e=document.createElement('div');e.className='workout-empty';e.textContent='No hay ejercicios cargados para '+DAYS[workoutDay]+'. Tocá “Agregar ejercicio” para crear la rutina.';c.appendChild(e);return;}workoutExercises.forEach((ex,index)=>{const card=document.createElement('div');card.className='exercise-card';const top=document.createElement('div');top.className='exercise-top';const leftWrap=document.createElement('div');leftWrap.className='exercise-left-wrap';const order=document.createElement('div');order.className='exercise-order';const num=document.createElement('div');num.className='exercise-order-num';num.textContent=String(index+1);const up=document.createElement('button');up.type='button';up.className='exercise-move';up.textContent='↑';up.title='Subir ejercicio';up.disabled=index===0;up.onclick=()=>moveExercise(index,-1);const down=document.createElement('button');down.type='button';down.className='exercise-move';down.textContent='↓';down.title='Bajar ejercicio';down.disabled=index===workoutExercises.length-1;down.onclick=()=>moveExercise(index,1);order.append(num,up,down);const left=document.createElement('div');const name=document.createElement('div');name.className='exercise-name';name.textContent=ex.exercise;const chips=document.createElement('div');chips.className='exercise-meta';[[`Series: ${ex.sets||'-'}`],[`Reps: ${ex.reps||'-'}`],[`RIR: ${ex.rir??'-'}`],[`Descanso: ${ex.rest_seconds?ex.rest_seconds+'s':'-'}`],[`Peso: ${ex.weight||'-'}`],[`Tempo: ${ex.tempo||'-'}`]].forEach(([txt])=>{const ch=document.createElement('span');ch.className='exercise-chip';ch.textContent=txt;chips.appendChild(ch)});left.append(name,chips);if(ex.notes){const note=document.createElement('div');note.className='exercise-note';note.textContent=ex.notes;left.appendChild(note)}leftWrap.append(order,left);const actions=document.createElement('div');actions.className='exercise-actions';const edit=document.createElement('button');edit.className='exercise-action';edit.textContent='✎';edit.title='Editar';edit.onclick=()=>openExerciseModal(ex);const del=document.createElement('button');del.className='exercise-action delete';del.textContent='×';del.title='Eliminar';del.onclick=()=>deleteExercise(ex.id);actions.append(edit,del);top.append(leftWrap,actions);card.append(top);const log=document.createElement('button');log.className='log-btn';log.textContent='＋ Registrar sesión';log.onclick=()=>openWorkoutLogModal(ex);card.appendChild(log);c.appendChild(card)})}
async function moveExercise(index,direction){const targetIndex=index+direction;if(targetIndex<0||targetIndex>=workoutExercises.length)return;const a=workoutExercises[index],b=workoutExercises[targetIndex];if(!a?.id||!b?.id)return;const posA=Number(a.position)||index+1,posB=Number(b.position)||targetIndex+1;let res=await sb.from('workout_exercises').update({position:999999}).eq('id',a.id);if(res.error){alert(res.error.message);return}res=await sb.from('workout_exercises').update({position:posA}).eq('id',b.id);if(res.error){await sb.from('workout_exercises').update({position:posA}).eq('id',a.id);alert(res.error.message);return}res=await sb.from('workout_exercises').update({position:posB}).eq('id',a.id);if(res.error){alert(res.error.message);return}await loadWorkoutExercises();renderWorkoutList();renderWorkoutHistory();if(typeof renderWorkoutAnalytics==='function')renderWorkoutAnalytics();renderDashboard()}
function openExerciseModal(ex=null){editingExerciseId=ex?.id||null;$('workoutModalTitle').textContent=ex?'✎ Editar ejercicio':'＋ Agregar ejercicio';$('workoutModalInfo').textContent=DAYS[workoutDay];$('exerciseName').value=ex?.exercise||'';$('exerciseSets').value=ex?.sets??'';$('exerciseReps').value=ex?.reps??'';$('exerciseRir').value=ex?.rir??'';$('exerciseRest').value=ex?.rest_seconds??'';$('exerciseWeight').value=ex?.weight??'';$('exerciseTempo').value=ex?.tempo??'';$('exerciseNotes').value=ex?.notes??'';$('cancelExerciseBtn').classList.toggle('hidden',!ex);$('workoutOverlay').classList.add('show');setTimeout(()=>$('exerciseName').focus(),80)}
function closeExerciseModal(){ $('workoutOverlay').classList.remove('show'); editingExerciseId=null; }
$('saveExerciseBtn').onclick=async()=>{const payload={exercise:$('exerciseName').value.trim(),sets:Number($('exerciseSets').value)||null,reps:$('exerciseReps').value.trim(),rir:$('exerciseRir').value===''?null:Number($('exerciseRir').value),rest_seconds:Number($('exerciseRest').value)||null,weight:$('exerciseWeight').value.trim(),tempo:$('exerciseTempo').value.trim(),notes:$('exerciseNotes').value.trim()};if(!payload.exercise)return alert('Escribí el nombre del ejercicio.');if(editingExerciseId){const {error}=await sb.from('workout_exercises').update(payload).eq('id',editingExerciseId);if(error){alert(error.message);return}}else{payload.user_id=currentUser.id;payload.day=workoutDay;payload.position=workoutExercises.length+1;const {error}=await sb.from('workout_exercises').insert(payload);if(error){alert(error.message);return}}closeExerciseModal();await loadWorkoutExercises();renderWorkoutList();renderWorkoutHistory();renderDashboard();}
async function deleteExercise(id){if(!confirm('¿Eliminar este ejercicio?'))return;const {error}=await sb.from('workout_exercises').delete().eq('id',id);if(error)alert(error.message);else{await loadWorkoutExercises();renderWorkoutList();renderWorkoutHistory();renderDashboard();}}
$('workoutLogCloseBtn').onclick=closeWorkoutLogModal;$('workoutLogOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeWorkoutLogModal()});
$('calendarToggle').onclick=toggleCalendarPanel;$('workoutToggle').onclick=openWorkoutPanel;$('nutritionToggle').onclick=openNutritionPanel;$('addExerciseBtn').onclick=()=>openExerciseModal();$('addMealBtn').onclick=()=>openNutritionModal();$('workoutCloseBtn').onclick=closeExerciseModal;$('cancelExerciseBtn').onclick=closeExerciseModal;$('workoutOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeExerciseModal()});$('nutritionCloseBtn').onclick=closeNutritionModal;$('cancelMealBtn').onclick=closeNutritionModal;$('nutritionOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeNutritionModal()});

function buildMonthOptions(){const sel=$('calendarMonth');if(sel.options.length)return;['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=m;sel.appendChild(o)});sel.value=currentMonth;$('calendarYear').value=currentYear;}
function eventsForDate(d){return sharedEvents.filter(e=>(e.date||e.fecha)===d).map(e=>({kind:e.type||e.tipo||'important',title:e.title||e.titulo||'Evento',description:e.description||e.descripcion||'',meta:e.scope||e.alcance||e.source||e.fuente||''}));}
function personalForDate(d){return personalDates.filter(e=>e.date===d).map(e=>({kind:e.type,title:e.title,description:e.description||'',meta:'Tu fecha'}));}
function mapKind(k){k=String(k).toLowerCase();if(k.includes('holiday')||k.includes('feriado'))return'holiday';if(k.includes('teacher')||k.includes('docente'))return'teacher';if(k.includes('nonteacher')||k.includes('nodocente')||k.includes('no docente'))return'nonteacher';if(k.includes('university')||k.includes('universit'))return'university';if(k.includes('important'))return'important';return'occupied';}
function renderCalendar(){
  const grid=$('monthGrid');
  grid.innerHTML='';

  ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].forEach(x=>{
    const w=document.createElement('div');
    w.className='weekday';
    w.textContent=x;
    grid.appendChild(w);
  });

  const first=new Date(currentYear,currentMonth,1);
  const last=new Date(currentYear,currentMonth+1,0);
  const start=(first.getDay()+6)%7;

  for(let i=0;i<start;i++){
    const b=document.createElement('div');
    b.className='day-cell';
    b.style.visibility='hidden';
    grid.appendChild(b);
  }

  const today=todayISO();

  for(let d=1;d<=last.getDate();d++){
    const date=iso(currentYear,currentMonth,d);
    const cell=document.createElement('div');
    cell.className='day-cell'+(date===today?' today':'');

    const n=document.createElement('div');
    n.className='day-num';
    n.textContent=d;
    cell.appendChild(n);

    const events=[
      ...eventsForDate(date).map(ev=>({...ev, personal:false})),
      ...personalDates.filter(e=>e.date===date).map(e=>({
        kind:e.type,
        title:e.title,
        description:e.description||'',
        meta:'Tu fecha · '+fmtDate(e.date),
        personal:true,
        item:e
      }))
    ];

    events.slice(0,5).forEach(ev=>{
      const el=document.createElement('div');
      const cls=mapKind(ev.kind);
      el.className='event '+cls;
      el.textContent=(cls==='holiday'?'🇦🇷 ':cls==='teacher'?'🟠 ':cls==='nonteacher'?'🔴 ':cls==='university'?'🟣 ':cls==='important'?'⭐ ':'📌 ')+ev.title;

      enableTooltip(el,ev.title,ev.description||'Sin descripción',ev.meta||fmtDate(date));

      if(ev.personal){
        el.title='Editar fecha';
        el.onclick=(event)=>{
          event.stopPropagation();
          openDateModal(ev.item);
        };
      }

      cell.appendChild(el);
    });

    cell.onclick=()=>openDateModal(null,date);
    grid.appendChild(cell);
  }
}
$('calendarMonth').onchange=()=>{currentMonth=Number($('calendarMonth').value);renderCalendar()};$('calendarYear').onchange=()=>{currentYear=Number($('calendarYear').value);renderCalendar()};


function openDateModal(item=null,defaultDate=''){editingDateId=item?.id||null;$('dateModalTitle').textContent=item?'✎ Editar fecha':'＋ Agregar fecha';$('dateModalInfo').textContent=item?'Modificá tu fecha':'Fecha personal';$('dateInput').value=item?item.date:defaultDate;$('dateType').value=item?.type||'ocupado';$('dateTitle').value=item?.title||'';$('dateDescription').value=item?.description||'';$('deleteDateBtn').classList.toggle('hidden',!item);$('dateOverlay').classList.add('show');}
function closeDateModal(){$('dateOverlay').classList.remove('show');editingDateId=null;}
$('addDateBtn').onclick=()=>openDateModal();$('saveDateBtn').onclick=async()=>{const date=$('dateInput').value,type=$('dateType').value,title=$('dateTitle').value.trim(),description=$('dateDescription').value.trim();if(!date||!title)return alert('Completá fecha y título.');if(editingDateId){const {error}=await sb.from('personal_dates').update({date,type,title,description}).eq('id',editingDateId);if(error)return alert(error.message)}else{const {error}=await sb.from('personal_dates').insert({user_id:currentUser.id,date,type,title,description});if(error)return alert(error.message)}closeDateModal();await loadPersonalDates();renderCalendar();updateNotice();};$('deleteDateBtn').onclick=async()=>{if(!editingDateId)return;if(!confirm('¿Eliminar esta fecha?'))return;const {error}=await sb.from('personal_dates').delete().eq('id',editingDateId);if(error)alert(error.message);else{closeDateModal();await loadPersonalDates();renderCalendar();updateNotice();}};

function updateNotice(){const today=todayISO();const events=[...eventsForDate(today),...personalForDate(today)];if(!events.length){$('notice').classList.remove('show');return;}$('noticeTitle').textContent='Aviso de hoy';$('noticeText').textContent=events.map(e=>e.title).join(' · ');$('notice').classList.add('show');}

function removeTooltip(){if(tooltip){tooltip.remove();tooltip=null}}
function enableTooltip(el,title,desc,meta){
  if(window.innerWidth<=700)return;
  el.addEventListener('mouseenter',()=>{
    if(!document.body.contains(el)) return;
    removeTooltip();
    tooltip=document.createElement('div');
    tooltip.className='message-tooltip';
    tooltip.innerHTML=`<div class="tooltip-title">${esc(title)}</div><div class="tooltip-desc">${esc(desc||'Sin descripción')}</div><div class="tooltip-meta">${esc(meta||'')}</div>`;
    document.body.appendChild(tooltip);
    requestAnimationFrame(()=>{
      if(!document.body.contains(el) || !tooltip) return;
      const r=el.getBoundingClientRect();
      let left=r.left+r.width/2-tooltip.offsetWidth/2;
      let top=r.top-tooltip.offsetHeight-14;
      if(left<12)left=12;
      if(left+tooltip.offsetWidth>innerWidth-12)left=innerWidth-tooltip.offsetWidth-12;
      if(top<12)top=r.bottom+14;
      tooltip.style.left=left+'px';
      tooltip.style.top=top+'px';
      requestAnimationFrame(()=>tooltip&&tooltip.classList.add('show'));
    });
  });
  el.addEventListener('mouseleave',removeTooltip);
  el.addEventListener('click',removeTooltip);
}

$('taskOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeTaskModal()});$('dateOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDateModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTaskModal();closeDateModal();closeGoalsModal();removeTooltip()}});
window.addEventListener('resize',removeTooltip);window.addEventListener('scroll',removeTooltip,true);


function setImportProgress(text,show=true){const e=$('importProgress');if(!e)return;e.textContent=text;e.classList.toggle('show',show)}

async function importMyData(file, selected={tasks:true,dates:true,exercises:true,logs:true,meals:true}){
  if(!currentUser){alert('Primero iniciá sesión.');return}
  let parsed;
  try{parsed=JSON.parse(await file.text());}catch(err){throw new Error('El archivo no contiene un JSON válido.')}
  const tasksIn=selected.tasks&&Array.isArray(parsed.tasks)?parsed.tasks:[];
  const datesIn=selected.dates&&Array.isArray(parsed.personal_dates)?parsed.personal_dates:[];
  const exercisesIn=selected.exercises&&Array.isArray(parsed.workout_exercises)?parsed.workout_exercises:[];
  const logsIn=selected.logs&&Array.isArray(parsed.workout_logs)?parsed.workout_logs:[];
  const mealsIn=selected.meals&&Array.isArray(parsed.nutrition_meals)?parsed.nutrition_meals:[]
  const total=tasksIn.length+datesIn.length+exercisesIn.length+logsIn.length+mealsIn.length;
  if(!total)throw new Error('No encontré tareas, fechas, entrenamientos ni comidas en el archivo.')
  const replace=confirm('¿Querés REEMPLAZAR los datos actuales de esta cuenta?\n\nAceptar = reemplazar los datos personales actuales.\nCancelar = conservarlos y AGREGAR los importados.')
  setImportProgress(replace?'Preparando reemplazo…':'Preparando importación…')
  if(replace){
    const tables=[];if(selected.logs)tables.push('workout_logs');if(selected.exercises)tables.push('workout_exercises');if(selected.meals)tables.push('nutrition_meals');if(selected.tasks)tables.push('tasks');if(selected.dates)tables.push('personal_dates');
    for(const table of tables){
      const {error}=await sb.from(table).delete().eq('user_id',currentUser.id);
      if(error)throw new Error(`No pude limpiar ${table}: ${error.message}`)
    }
  }
  const clean=(obj,drop=[])=>{const c={...obj};drop.forEach(k=>delete c[k]);return c}
  const taskRows=tasksIn.map(t=>clean(t,['id','user_id','created_at','updated_at']));
  if(taskRows.length){const rows=taskRows.map(t=>({...t,user_id:currentUser.id}));const {error}=await sb.from('tasks').insert(rows);if(error)throw new Error('Error importando tareas: '+error.message)}
  setImportProgress(`Tareas importadas: ${taskRows.length}`)
  const dateRows=datesIn.map(d=>clean(d,['id','user_id','created_at','updated_at']));
  if(dateRows.length){const rows=dateRows.map(d=>({...d,user_id:currentUser.id}));const {error}=await sb.from('personal_dates').insert(rows);if(error)throw new Error('Error importando fechas: '+error.message)}
  setImportProgress(`Fechas importadas: ${dateRows.length}`)

  const exerciseMap=new Map();
  for(const ex of exercisesIn){
    const row=clean(ex,['id','user_id','created_at','updated_at']);
    row.user_id=currentUser.id;
    const {data,error}=await sb.from('workout_exercises').insert(row).select('*').single();
    if(error)throw new Error('Error importando ejercicio: '+error.message);
    if(ex.id && data?.id)exerciseMap.set(String(ex.id),data.id);
  }
  setImportProgress(`Ejercicios importados: ${exercisesIn.length}`)

  const logRows=[];
  for(const log of logsIn){
    const row=clean(log,['id','user_id','created_at','updated_at']);
    row.user_id=currentUser.id;
    if(log.exercise_id && exerciseMap.has(String(log.exercise_id)))row.exercise_id=exerciseMap.get(String(log.exercise_id));
    else delete row.exercise_id;
    logRows.push(row)
  }
  if(logRows.length){const {error}=await sb.from('workout_logs').insert(logRows);if(error)throw new Error('Error importando historial: '+error.message)}
  setImportProgress(`Historial importado: ${logRows.length}`)
  const mealRows=mealsIn.map(m=>{const row=clean(m,['id','user_id','created_at','updated_at']);row.user_id=currentUser.id;return row});
  if(mealRows.length){const {error}=await sb.from('nutrition_meals').insert(mealRows);if(error)throw new Error('Error importando alimentación: '+error.message)}
  setImportProgress(`Importación completa: ${total} elementos.`)
  await Promise.all([loadTasks(),loadPersonalDates(),loadWorkoutExercises(),loadWorkoutLogs(),loadNutritionMeals()]);
  createDays();renderSchedule();updateStats();renderDashboard();renderWorkoutDays();renderWorkoutList();renderWorkoutHistory();renderNutritionDays();renderMealTabs();renderNutritionList();renderNutritionGoals();renderConflicts();updateNotice();updateReminderUI();
  closeSettings();
  setTimeout(()=>setImportProgress('',false),2500)
  alert(`Importación terminada.\n\nTareas: ${taskRows.length}\nFechas: ${dateRows.length}\nEjercicios: ${exercisesIn.length}\nSesiones: ${logRows.length}\nComidas: ${mealRows.length}`)
}

// El shell visual se dibuja SIEMPRE antes de consultar Supabase o events.json.
function renderImmediateShell(){
  try{createDays()}catch(e){console.warn('Días iniciales:',e)}
  try{buildMonthOptions();renderCalendar()}catch(e){console.warn('Calendario inicial:',e)}
  try{renderSchedule()}catch(e){console.warn('Horario inicial:',e)}
}
renderImmediateShell();

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
setupV24Nav();
init();
setRefreshStatus('Listo');

$('goCalendarBtn').onclick=()=>toggleCalendarPanel();
$('goWorkoutBtn').onclick=()=>openWorkoutPanel();
$('goNutritionBtn').onclick=()=>openNutritionPanel();
$('nutritionGoalBtn').onclick=openGoalsModal;$('goalCloseBtn').onclick=closeGoalsModal;$('goalOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeGoalsModal()});$('saveGoalsBtn').onclick=()=>{nutritionGoals={calories:Number($('goalCalories').value)||0,protein:Number($('goalProtein').value)||0,carbs:Number($('goalCarbs').value)||0,fat:Number($('goalFat').value)||0};saveNutritionGoals();closeGoalsModal();renderNutritionGoals();renderDashboard();};
