(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const userKey=name=>`agendaV34:${currentUser?.id||'guest'}:${name}`;
  const getJSON=(name,fallback)=>{try{const r=localStorage.getItem(userKey(name));return r?JSON.parse(r):fallback}catch(_){return fallback}};
  const setJSON=(name,v)=>{try{localStorage.setItem(userKey(name),JSON.stringify(v))}catch(_){}};
  const days=Array.isArray(DAYS)?DAYS:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const pad=n=>String(n).padStart(2,'0');
  function todayIndex(){try{return typeof getTodayIndex==='function'?getTodayIndex():new Date().getDay()===0?6:new Date().getDay()-1}catch(_){return 0}}
  function todayDate(){try{return typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}}
  function taskPriority(t){return typeof getPriority==='function'?getPriority(t):'normal'}
  const rank={urgent:0,high:1,normal:2,low:3};
  function timeMin(t){return Number(t.hour||0)*60+Number(t.minute||0)}
  function homeTasks(){const d=todayIndex();return (tasks||[]).filter(t=>Number(t.day)===d).slice().sort((a,b)=>timeMin(a)-timeMin(b)||rank[taskPriority(a)]-rank[taskPriority(b)])}
  function minutesNow(){const n=typeof getArgentinaNow==='function'?getArgentinaNow():new Date();return n.getHours()*60+n.getMinutes()}
  function nextTask(list){const now=minutesNow();return list.filter(t=>!t.completed&&timeMin(t)>=now).sort((a,b)=>timeMin(a)-timeMin(b)||rank[taskPriority(a)]-rank[taskPriority(b)])[0]||list.filter(t=>!t.completed).sort((a,b)=>timeMin(a)-timeMin(b)||rank[taskPriority(a)]-rank[taskPriority(b)])[0]||null}
  function freeSlots(list){const busy=list.map(timeMin).sort((a,b)=>a-b);const slots=[];for(let h=7;h<=21;h++){const s=h*60,e=s+60;if(!busy.some(x=>x>=s&&x<e))slots.push(`${pad(h)}:00`)}return slots.slice(0,4)}

  function buildHome(){
    if(q('v34Home'))return;
    const anchor=q('v33Tools')||q('smartPanel')||q('dashboard');if(!anchor)return;
    const sec=document.createElement('section');sec.id='v34Home';sec.className='v34-home v32-home-pane';sec.dataset.v33Pane='home';sec.dataset.v34Pane='home';
    sec.innerHTML=`<div class="v34-head"><div><h3>🧠 Asistente de tu día</h3><p id="v34DateLabel">Hoy</p></div><div class="streak-badge" id="v34SmartBadge">Todo tranquilo</div></div><div class="v34-grid"><div class="v34-card"><h4>🎯 Próxima prioridad</h4><div class="v34-main" id="v34NextTitle">Sin tareas pendientes</div><div class="v34-sub" id="v34NextMeta">Tu agenda está libre por ahora.</div><div class="v34-progress"><span id="v34DayProgress"></span></div><div class="v34-actions"><button class="v34-btn primary" id="v34FocusNext" type="button">Enfocar</button><button class="v34-btn" id="v34AddRecurring" type="button">🔁 Recurrente</button></div></div><div class="v34-card"><h4>📊 Estado del día</h4><div id="v34DayStats" class="v34-list"></div></div><div class="v34-card"><h4>🕒 Tiempo libre</h4><div id="v34FreeList" class="v34-list"></div><div class="v34-actions"><button class="v34-btn" id="v34SmartPlanBtn" type="button">🧭 Recalcular plan</button></div></div></div><div class="v34-insight-grid"><div class="v34-insight"><strong id="v34Pending">0</strong><span>pendientes hoy</span></div><div class="v34-insight"><strong id="v34Done">0%</strong><span>tareas completadas</span></div><div class="v34-insight"><strong id="v34Urgent">0</strong><span>urgentes</span></div><div class="v34-insight"><strong id="v34HabitDone">0</strong><span>hábitos de hoy</span></div></div>`;
    anchor.after(sec);
    q('v34FocusNext').onclick=()=>typeof focusNextTask==='function'?focusNextTask():v34Focus();
    q('v34SmartPlanBtn').onclick=renderHome;
    q('v34AddRecurring').onclick=openRecurring;
  }
  function renderHome(){
    const sec=q('v34Home');if(!sec)return;const list=homeTasks();const done=list.filter(t=>t.completed).length;const pending=list.length-done;const urgent=list.filter(t=>!t.completed&&taskPriority(t)==='urgent').length;const next=nextTask(list);
    q('v34DateLabel').textContent=`${days[todayIndex()]} · ${todayDate()}`;
    q('v34NextTitle').textContent=next?next.title:'No hay tareas pendientes';
    q('v34NextMeta').textContent=next?`${pad(next.hour)}:${pad(next.minute)} · ${taskPriority(next)==='urgent'?'🔴 Urgente':taskPriority(next)==='high'?'🟠 Alta':'Tarea pendiente'}`:'Aprovechá el día para planificar algo importante.';
    q('v34DayProgress').style.width=(list.length?Math.round(done/list.length*100):0)+'%';
    q('v34Pending').textContent=String(pending);q('v34Done').textContent=(list.length?Math.round(done/list.length*100):100)+'%';q('v34Urgent').textContent=String(urgent);
    const hb=(typeof habits!=='undefined'?habits:getJSON('habits',[]))||[];const td=todayDate();q('v34HabitDone').textContent=String(hb.filter(h=>(h.doneDates||[]).includes(td)).length);
    const badge=q('v34SmartBadge');if(urgent>0){badge.textContent=`⚠️ ${urgent} urgente${urgent>1?'s':''}`;badge.className='streak-badge'}else if(next){badge.textContent='✅ Día organizado'}else{badge.textContent='🌿 Todo tranquilo'}
    const stats=q('v34DayStats');stats.innerHTML='';[[list.length,'actividades'],[done,'completadas'],[pending,'pendientes'],[urgent,'urgentes']].forEach(([n,l])=>{const r=document.createElement('div');r.className='v34-row';r.innerHTML=`<div><strong>${n}</strong><small>${l}</small></div>`;stats.appendChild(r)});
    const free=q('v34FreeList');free.innerHTML='';const slots=freeSlots(list);if(!slots.length){free.innerHTML='<div class="v34-row"><div><strong>Agenda bastante ocupada</strong><small>No encontré bloques libres de una hora.</small></div></div>'}else slots.forEach(x=>{const r=document.createElement('div');r.className='v34-row';r.innerHTML=`<span class="v34-time">${x}</span><div><strong class="v34-free">Bloque libre</strong><small>Buen momento para estudiar, descansar o hacer una tarea rápida.</small></div>`;free.appendChild(r)});
  }
  function v34Focus(){const list=homeTasks(),next=nextTask(list);if(!next){alert('No tenés tareas pendientes para hoy.');return}if(typeof v32SetSection==='function')v32SetSection('agenda');selectedDay=todayIndex();createDays?.();renderSchedule?.();setTimeout(()=>{const card=[...document.querySelectorAll('.task')].find(el=>el.textContent.includes(next.title)&&el.textContent.includes(`${pad(next.hour)}:${pad(next.minute)}`));card?.scrollIntoView({behavior:'smooth',block:'center'});},180)}

  function buildRecurring(){
    if(q('v34RecurringDays').children.length)return;
    q('v34RecurringMinute').innerHTML='';for(let m=0;m<60;m++) {const o=document.createElement('option');o.value=m;o.textContent=pad(m);q('v34RecurringMinute').appendChild(o)}
    days.forEach((d,i)=>{const lab=document.createElement('label');lab.className='v34-day-check'+(i===todayIndex()?' active':'');lab.innerHTML=`<input type="checkbox" value="${i}" ${i===todayIndex()?'checked':''}><span>${d.slice(0,3)}</span>`;lab.querySelector('input').onchange=e=>lab.classList.toggle('active',e.target.checked);q('v34RecurringDays').appendChild(lab)});
  }
  function openRecurring(){buildRecurring();q('v34RecurringOverlay').classList.add('show');q('v34RecurringOverlay').setAttribute('aria-hidden','false');q('v34RecurringTitle').focus()}
  function closeRecurring(){q('v34RecurringOverlay').classList.remove('show');q('v34RecurringOverlay').setAttribute('aria-hidden','true')}
  async function saveRecurring(){
    if(!currentUser?.id){alert('Primero iniciá sesión.');return}
    const title=q('v34RecurringTitle').value.trim();if(!title){alert('Escribí un título.');return}
    const selected=[...q('v34RecurringDays').querySelectorAll('input:checked')].map(x=>Number(x.value));if(!selected.length){alert('Elegí al menos un día.');return}
    const hour=Math.max(7,Math.min(22,Number(q('v34RecurringHour').value)||18));const minute=Math.max(0,Math.min(59,Number(q('v34RecurringMinute').value)||0));const description=q('v34RecurringDesc').value.trim();const priority=q('v34RecurringPriority').value||'normal';
    const rows=selected.map(day=>({user_id:currentUser.id,title,description,day,hour,minute,completed:false}));
    const {data,error}=await sb.from('tasks').insert(rows).select('*');if(error){alert(error.message);return}
    const pkey=`agendaV33:${currentUser.id}:priorities`;try{const pm=JSON.parse(localStorage.getItem(pkey)||'{}');(data||rows).forEach(t=>{if(t?.id)pm[String(t.id)]=priority});localStorage.setItem(pkey,JSON.stringify(pm))}catch(_){}
    (data||rows).forEach(t=>{if(t?.id&&typeof setPriority==='function')setPriority(t,priority)});
    closeRecurring();q('v34RecurringTitle').value='';q('v34RecurringDesc').value='';await loadTasks();createDays?.();renderSchedule?.();updateStats?.();renderDashboard?.();renderConflicts?.();renderHome();alert(`Se crearon ${selected.length} tareas recurrentes.`);
  }

  function addCalendarFilters(){
    const panel=q('calendarPanel');if(!panel||q('v34CalendarFilters'))return;const h=panel.querySelector('.cal-head');if(!h)return;const bar=document.createElement('div');bar.id='v34CalendarFilters';bar.className='v34-filterbar';bar.innerHTML=`<button class="v34-filter active" data-filter="all" type="button">Todo</button><button class="v34-filter" data-filter="holiday" type="button">🇦🇷 Feriados</button><button class="v34-filter" data-filter="teacher" type="button">🟠 Docentes</button><button class="v34-filter" data-filter="nonteacher" type="button">🔴 No docentes</button><button class="v34-filter" data-filter="university" type="button">🟣 Universidad</button><button class="v34-filter" data-filter="important" type="button">⭐ Importantes</button><button class="v34-filter" data-filter="occupied" type="button">📌 Ocupado</button>`;h.after(bar);bar.onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;bar.querySelectorAll('.v34-filter').forEach(x=>x.classList.toggle('active',x===b));applyCalendarFilter(b.dataset.filter)};
  }
  function applyCalendarFilter(filter){document.querySelectorAll('#monthGrid .event').forEach(el=>{if(filter==='all'){el.style.display='';return;}const ok=el.classList.contains(filter);el.style.display=ok?'':'none';});}
  function wrapCalendar(){if(typeof renderCalendar!=='function'||renderCalendar.__v34)return;const old=renderCalendar;const wrapped=function(){const r=old.apply(this,arguments);setTimeout(()=>{addCalendarFilters();applyCalendarFilter(q('v34CalendarFilters')?.querySelector('.active')?.dataset.filter||'all')},0);return r};wrapped.__v34=true;window.renderCalendar=wrapped}

  function enhanceTaskOverdue(){
    document.querySelectorAll('.task').forEach(card=>{if(card.dataset.v34Checked==='1')return;const title=card.querySelector('h4')?.textContent||'';const tm=card.querySelector('.task-time')?.textContent||'';const m=tm.match(/(\d{1,2}):(\d{2})/);if(!m)return;const t=(tasks||[]).find(x=>String(x.title)===title&&Number(x.day)===Number(selectedDay)&&Number(x.hour)===Number(m[1])&&Number(x.minute)===Number(m[2]));if(!t||t.completed){card.dataset.v34Checked='1';return}if(Number(selectedDay)===todayIndex()&&timeMin(t)<minutesNow()){card.classList.add('v34-overdue');const tag=document.createElement('div');tag.className='v34-overdue-label';tag.textContent='⏰ Pendiente';card.appendChild(tag)}card.dataset.v34Checked='1'});
  }

  function smartSearch(){
    const input=q('v15SearchInput');if(!input||input.dataset.v34==='1')return;input.dataset.v34='1';input.setAttribute('autocomplete','off');
    const hints=document.createElement('div');hints.className='v34-filterbar';hints.style.padding='8px 12px 0';hints.innerHTML=`<button class="v34-filter" data-smart="pending" type="button">Pendientes</button><button class="v34-filter" data-smart="today" type="button">Hoy</button><button class="v34-filter" data-smart="urgent" type="button">Urgentes</button>`;input.parentElement?.parentElement?.appendChild(hints);hints.onclick=e=>{const b=e.target.closest('[data-smart]');if(!b)return;const kind=b.dataset.smart;closeSearch?.();if(typeof v32SetSection==='function')v32SetSection('agenda');selectedDay=todayIndex();createDays?.();renderSchedule?.();setTimeout(()=>{if(kind==='urgent'){const target=[...document.querySelectorAll('.task')].find(el=>el.querySelector('.v33-priority')?.dataset.priority==='urgent'&&!el.classList.contains('completed'));target?.scrollIntoView({behavior:'smooth',block:'center'});}else if(kind==='pending'){const target=[...document.querySelectorAll('.task')].find(el=>!el.classList.contains('completed'));target?.scrollIntoView({behavior:'smooth',block:'center'});}else{document.getElementById('schedule')?.scrollIntoView({behavior:'smooth',block:'start'});}},220)};
  }
  function patch(){
    buildHome();buildRecurring();wrapCalendar();smartSearch();
    if(q('v34RecurringClose'))q('v34RecurringClose').onclick=closeRecurring;
    if(q('v34RecurringOverlay'))q('v34RecurringOverlay').onclick=e=>{if(e.target===e.currentTarget)closeRecurring()};
    if(q('v34RecurringSave'))q('v34RecurringSave').onclick=saveRecurring;
    const grid=document.querySelector('.quick-actions-grid');if(grid&&!q('v34QuickRecurring')){const b=document.createElement('button');b.id='v34QuickRecurring';b.type='button';b.innerHTML='🔁<span>Recurrente</span>';grid.appendChild(b);b.onclick=()=>{closeQuickActions?.();openRecurring()};}
    if(typeof renderDashboard==='function'&&!renderDashboard.__v34){const old=renderDashboard;const w=function(){const r=old.apply(this,arguments);setTimeout(renderHome,0);return r};w.__v34=true;window.renderDashboard=w}
    if(typeof renderSchedule==='function'&&!renderSchedule.__v34){const old=renderSchedule;const w=function(){const r=old.apply(this,arguments);setTimeout(enhanceTaskOverdue,0);return r};w.__v34=true;window.renderSchedule=w}
    renderHome();setTimeout(enhanceTaskOverdue,0);
  }
  function init(){
    try{patch();document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRecurring();});window.addEventListener('focus',renderHome);setInterval(renderHome,30000)}catch(e){console.warn('V34',e)}
    const mo=new MutationObserver(()=>{try{buildHome();wrapCalendar();smartSearch();enhanceTaskOverdue()}catch(_){}});mo.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
