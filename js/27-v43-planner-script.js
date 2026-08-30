(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const pad=n=>String(Math.max(0,Number(n)||0)).padStart(2,'0');
  const nowAR=()=>typeof getArgentinaNow==='function'?getArgentinaNow():new Date();
  const todayIdx=()=>typeof getTodayIndex==='function'?getTodayIndex():((nowAR().getDay()+6)%7);
  const taskMinutes=t=>Math.max(1,Number(t?.duration_minutes||t?.estimated_minutes||30)||30);
  const priority=t=>typeof getPriority==='function'?getPriority(t):(String(t?.priority||'normal').toLowerCase());
  const localDurationKey=()=>`agendaV43:${currentUser?.id||'guest'}:durations`;
  function durations(){try{const r=localStorage.getItem(localDurationKey());return r?JSON.parse(r):{}}catch{return {}}}
  function saveDurations(v){try{localStorage.setItem(localDurationKey(),JSON.stringify(v))}catch{}}
  function getDuration(t){const map=durations();return Math.max(5,Number(t?.duration_minutes||map[String(t?.id)]||30)||30)}
  function dayTasks(day){return (tasks||[]).filter(t=>Number(t.day)===Number(day)&&!t.completed).sort((a,b)=>(Number(a.hour)*60+Number(a.minute))-(Number(b.hour)*60+Number(b.minute)))}
  function minOf(t){return Number(t?.hour||0)*60+Number(t?.minute||0)}
  function fmt(min){return `${pad(Math.floor(min/60))}:${pad(min%60)}`}
  function renderHours(){const h=q('v43Hours');if(!h)return;h.innerHTML='';for(let x=7;x<=22;x++){const el=document.createElement('div');el.className='v43-hour';el.textContent=`${pad(x)}:00`;h.appendChild(el)}}
  function blockClass(t){const p=priority(t);return `v43-block ${t.completed?'done ':''}${p==='urgent'?'urgent ':p==='high'?'high':''}`}
  function openTask(t,day){try{selectedDay=day;createDays?.();renderSchedule?.();v32SetSection?.('agenda');openTaskModal?.(Number(t.hour)||7,Number(t.minute)||0,t)}catch(_){}
  }
  function renderPlanner(mode='today'){
    const day=mode==='tomorrow'?((todayIdx()+1)%7):todayIdx();const list=dayTasks(day);const track=q('v43Track'),hours=q('v43Hours');if(!track)return;renderHours();track.innerHTML='';
    const start=7*60,end=23*60,totalSpan=end-start;let planned=0,lastEnd=start;let free=0;
    list.forEach(t=>{const st=minOf(t),dur=getDuration(t);const en=Math.min(end,st+dur);planned+=Math.max(0,en-st);if(st>lastEnd)free+=Math.max(0,st-lastEnd);lastEnd=Math.max(lastEnd,en);const block=document.createElement('div');block.className=blockClass(t);block.style.top=`${Math.max(0,(st-start)/totalSpan*100)}%`;block.style.height=`${Math.max(3,(en-st)/totalSpan*100)}%`;block.innerHTML=`<strong>${esc(t.title||'Tarea')}</strong><span>${fmt(st)} · ${dur} min${priority(t)==='urgent'?' · 🔴 Urgente':priority(t)==='high'?' · 🟠 Alta':''}</span>`;block.onclick=()=>openTask(t,day);track.appendChild(block)});if(lastEnd<end)free+=end-lastEnd;
    const hoursAvail=Math.max(1,(end-start));const load=Math.min(100,Math.round(planned/hoursAvail*100));q('v43Planned').textContent=`${planned} min`;q('v43Free').textContent=`${free} min`;q('v43Pending').textContent=String(list.length);q('v43Load').textContent=`${load}%`;q('v43PlannerBadge').textContent=mode==='tomorrow'?'Plan de mañana':'Plan de hoy';const hint=q('v43LoadHint');if(load>=85){hint.className='v43-load bad';hint.textContent='⚠️ Agenda muy cargada. Conviene dejar margen.'}else if(load>=65){hint.className='v43-load warn';hint.textContent='🟠 Agenda intensa. Reservá algún bloque libre.'}else{hint.className='v43-load ok';hint.textContent='🟢 Agenda equilibrada.'}
    q('v43Track').querySelectorAll('.v43-free').forEach(x=>x.remove());
    let prev=start;const gaps=[];list.forEach(t=>{const st=minOf(t);if(st>prev)gaps.push([prev,st]);prev=Math.max(prev,st+getDuration(t))});if(prev<end)gaps.push([prev,end]);gaps.filter(g=>g[1]-g[0]>=30).slice(0,4).forEach((g,i)=>{const el=document.createElement('div');el.className='v43-free';el.style.top=`${((g[0]-start)/totalSpan*100)+1}%`;el.style.height=`${Math.max(3,(g[1]-g[0])/totalSpan*100)}%`;el.textContent=`🟢 Libre · ${fmt(g[0])}–${fmt(g[1])}`;el.style.pointerEvents='none';q('v43Track').appendChild(el)});
  }
  function renderHome(){
    try{
      const ti=todayIdx(),weekStart=typeof startOfWeekMonday==='function'?startOfWeekMonday(nowAR()):(()=>{const d=new Date(nowAR());d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d})();let total=0,done=0,active=0;const overdue=(tasks||[]).filter(t=>Number(t.day)===ti&&!t.completed&&(Number(t.hour)*60+Number(t.minute))<(nowAR().getHours()*60+nowAR().getMinutes())).length;
      for(let i=0;i<7;i++){const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);const dayTs=(tasks||[]).filter(t=>Number(t.day)===i);total+=dayTs.length;done+=dayTs.filter(t=>t.completed).length;if(dayTs.some(t=>t.completed)||(workoutLogs||[]).some(l=>String(l.performed_at)===`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)||(nutritionMeals||[]).some(m=>Number(m.day)===i))active++}
      q('v43WeekDone').textContent=`${total?Math.round(done/total*100):0}%`;q('v43ActiveDays').textContent=`${active}/7`;q('v43Overdue').textContent=String(overdue);q('v43CurrentStreak').textContent=`${typeof computeCurrentStreak==='function'?computeCurrentStreak():0} días`;
      const badge=q('v43HealthBadge');if(overdue>=3){badge.textContent='⚠️ Necesita orden';}else if(overdue>0){badge.textContent='🟠 Con pendientes';}else if(total&&done/total>=.7){badge.textContent='🟢 Muy bien';}else{badge.textContent='🔵 En progreso';}
    }catch(e){console.warn('V43 home',e)}
  }
  function bind(){document.querySelectorAll('[data-v43-day]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-v43-day]').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderPlanner(b.dataset.v43Day)}));q('v43ResetView')?.addEventListener('click',()=>renderPlanner(document.querySelector('[data-v43-day].active')?.dataset.v43Day||'today'));window.addEventListener('resize',()=>renderPlanner(document.querySelector('[data-v43-day].active')?.dataset.v43Day||'today'));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderPlanner();renderHome()}});window.addEventListener('online',()=>{renderPlanner();renderHome()})}
  function init(){if(!q('v43PlannerPanel'))return;bind();renderPlanner();renderHome();setInterval(()=>{renderPlanner(document.querySelector('[data-v43-day].active')?.dataset.v43Day||'today');renderHome()},30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.agendaV43Render=()=>{renderPlanner(document.querySelector('[data-v43-day].active')?.dataset.v43Day||'today');renderHome()};
})();
