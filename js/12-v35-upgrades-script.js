(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,'0');
  const days=Array.isArray(DAYS)?DAYS:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const key=n=>`agendaV35:${currentUser?.id||'guest'}:${n}`;
  const read=(n,f)=>{try{const r=localStorage.getItem(key(n));return r?JSON.parse(r):f}catch(_){return f}};
  const write=(n,v)=>{try{localStorage.setItem(key(n),JSON.stringify(v))}catch(_){}};
  function todayIdx(){try{return typeof getTodayIndex==='function'?getTodayIndex():((new Date().getDay()+6)%7)}catch(_){return 0}}
  function dateForIndex(i){try{if(typeof localDateForDay==='function')return localDateForDay(i);const d=new Date();const diff=i-todayIdx();d.setDate(d.getDate()+diff);return d}catch(_){return new Date()}}
  function dayKey(i){const d=dateForIndex(i);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  function renderWeeklyReview(){
    const home=q('v34Home');if(!home||q('v35Week'))return;
    const week=document.createElement('section');week.id='v35Week';week.className='v35-week v32-home-pane';week.dataset.v33Pane='home';week.innerHTML=`<div class="v35-week-head"><div><h3>📈 Resumen semanal</h3><p>Una vista rápida de cómo viene tu semana.</p></div><span class="streak-badge" id="v35BestDay">—</span></div><div class="v35-week-grid" id="v35WeekGrid"></div><div class="v35-week-summary"><div class="v35-week-stat"><strong id="v35WeekDone">0%</strong><span>tareas completadas</span></div><div class="v35-week-stat"><strong id="v35WeekTotal">0</strong><span>tareas totales</span></div><div class="v35-week-stat"><strong id="v35WeekActive">0/7</strong><span>días activos</span></div><div class="v35-week-stat"><strong id="v35WeekSessions">0</strong><span>sesiones de gym</span></div></div>`;
    home.after(week);
    const grid=q('v35WeekGrid');let total=0,done=0,active=0,best={idx:0,pct:-1};
    for(let i=0;i<7;i++){
      const items=(tasks||[]).filter(t=>Number(t.day)===i);const d=items.length;const c=items.filter(t=>t.completed).length;const pct=d?Math.round(c/d*100):0;if(d||c)active++;if(pct>best.pct){best={idx:i,pct}}total+=d;done+=c;
      const el=document.createElement('div');el.className='v35-week-day'+(i===todayIdx()?' today':'');el.innerHTML=`<strong>${days[i].slice(0,3)}</strong><span>${c}/${d}</span><div class="v35-week-bar"><i style="width:${pct}%"></i></div>`;grid.appendChild(el);
    }
    q('v35WeekDone').textContent=(total?Math.round(done/total*100):100)+'%';q('v35WeekTotal').textContent=String(total);q('v35WeekActive').textContent=`${active}/7`;
    const wkLogs=(workoutLogs||[]).filter(l=>{const d=new Date(String(l.performed_at)+'T12:00:00');const today=dateForIndex(todayIdx());const start=new Date(today);start.setDate(start.getDate()-((today.getDay()+6)%7));const end=new Date(start);end.setDate(start.getDate()+7);return d>=start&&d<end}).length;q('v35WeekSessions').textContent=String(wkLogs);
    q('v35BestDay').textContent=best.pct>0?`⭐ Mejor: ${days[best.idx].slice(0,3)} ${best.pct}%`:'Sin mejor día todavía';
  }

  let focusMinutes=25,focusRemaining=1500,focusTimer=null,focusRunning=false,focusTaskId=null;
  function fmt(sec){const s=Math.max(0,Math.floor(sec));return `${pad(Math.floor(s/60))}:${pad(s%60)}`}
  function pickFocusTask(){const now=typeof getArgentinaNow==='function'?getArgentinaNow():new Date();const min=now.getHours()*60+now.getMinutes();const pending=(tasks||[]).filter(t=>Number(t.day)===todayIdx()&&!t.completed).sort((a,b)=>(Number(a.hour)*60+Number(a.minute)-min)-(Number(b.hour)*60+Number(b.minute)-min));return pending[0]||pending.find(t=>getPriority?.(t)==='urgent')||null}
  function openFocus(task=null){const t=task||pickFocusTask();focusTaskId=t?.id||null;q('v35FocusTaskTitle').textContent=t?t.title:'Sin tarea seleccionada';q('v35FocusTaskMeta').textContent=t?`${days[Number(t.day)]} · ${pad(t.hour)}:${pad(t.minute)}`:'Podés usarlo como temporizador libre.';q('v35FocusOverlay').classList.add('show');q('v35FocusOverlay').setAttribute('aria-hidden','false')}
  window.openFocus=openFocus;
  function closeFocus(){pauseFocus();q('v35FocusOverlay').classList.remove('show');q('v35FocusOverlay').setAttribute('aria-hidden','true')}
  function paintFocus(){q('v35FocusClock').textContent=fmt(focusRemaining);q('v35FocusStart').textContent=focusRunning?'▶ En curso':'▶ Iniciar'}
  function startFocus(){if(focusRunning)return;focusRunning=true;focusTimer=setInterval(()=>{focusRemaining--;paintFocus();if(focusRemaining<=0){pauseFocus();if(navigator.vibrate)try{navigator.vibrate([180,80,180])}catch(_){};alert('¡Bloque de concentración terminado!');}},1000);paintFocus()}
  function pauseFocus(){focusRunning=false;if(focusTimer){clearInterval(focusTimer);focusTimer=null}paintFocus()}
  function resetFocus(){pauseFocus();focusRemaining=focusMinutes*60;paintFocus()}
  async function completeFocusTask(){if(!focusTaskId){alert('No hay una tarea seleccionada.');return}const t=(tasks||[]).find(x=>String(x.id)===String(focusTaskId));if(!t)return; if(typeof toggleTaskComplete==='function')await toggleTaskComplete(t); else {const {error}=await sb.from('tasks').update({completed:true}).eq('id',t.id);if(error){alert(error.message);return}await loadTasks()}renderWeeklyReview();closeFocus()}

  function addAgendaFilters(){
    const target=q('schedule');if(!target||q('v35AgendaTools'))return;const host=document.createElement('div');host.id='v35AgendaTools';host.className='v35-agenda-tools';host.innerHTML=`<button type="button" class="v35-agenda-filter active" data-f35="all">Todas</button><button type="button" class="v35-agenda-filter" data-f35="pending">Pendientes</button><button type="button" class="v35-agenda-filter" data-f35="completed">Completadas</button><button type="button" class="v35-agenda-filter" data-f35="urgent">🔴 Urgentes</button><button type="button" class="v35-agenda-filter" data-f35="high">🟠 Alta</button>`;
    target.parentNode.insertBefore(host,target);host.addEventListener('click',e=>{const b=e.target.closest('[data-f35]');if(!b)return;host.querySelectorAll('.v35-agenda-filter').forEach(x=>x.classList.toggle('active',x===b));applyAgendaFilter(b.dataset.f35)});
  }
  function applyAgendaFilter(mode){document.querySelectorAll('#schedule .task').forEach(card=>{const title=card.querySelector('h4')?.textContent||'';const time=card.querySelector('.task-time')?.textContent||'';const m=time.match(/(\d{1,2}):(\d{2})/);const t=(tasks||[]).find(x=>String(x.title)===title&&Number(x.day)===Number(selectedDay)&&(!m||Number(x.hour)===Number(m[1])));let show=true;if(mode==='pending')show=!!t&&!t.completed;if(mode==='completed')show=!!t&&t.completed;if(mode==='urgent')show=!!t&&!t.completed&&(typeof getPriority==='function'?getPriority(t):'normal')==='urgent';if(mode==='high')show=!!t&&!t.completed&&(typeof getPriority==='function'?getPriority(t):'normal')==='high';card.classList.toggle('v35-hidden-task',!show);});}
  function wrapSchedule(){if(typeof renderSchedule!=='function'||renderSchedule.__v35)return;const old=renderSchedule;const w=function(){const r=old.apply(this,arguments);setTimeout(()=>{addAgendaFilters();const active=q('v35AgendaTools')?.querySelector('.active')?.dataset.f35||'all';applyAgendaFilter(active)},0);return r};w.__v35=true;window.renderSchedule=w}

  function bind(){
    addAgendaFilters();wrapSchedule();
    if(q('v35FocusClose'))q('v35FocusClose').onclick=closeFocus;
    if(q('v35FocusOverlay'))q('v35FocusOverlay').onclick=e=>{if(e.target===e.currentTarget)closeFocus()};
    if(q('v35FocusStart'))q('v35FocusStart').onclick=startFocus;q('v35FocusPause').onclick=pauseFocus;q('v35FocusReset').onclick=resetFocus;q('v35FocusComplete').onclick=completeFocusTask;
    document.querySelectorAll('[data-v35-min]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-v35-min]').forEach(x=>x.classList.toggle('active',x===b));focusMinutes=Number(b.dataset.v35Min)||25;resetFocus()});
    const actions=q('v34Home')?.querySelector('.v34-actions');if(actions&&!q('v35FocusHomeBtn')){const b=document.createElement('button');b.id='v35FocusHomeBtn';b.className='v34-btn';b.type='button';b.textContent='🎯 Concentración';b.onclick=()=>openFocus();actions.appendChild(b)}
    renderWeeklyReview();
    setInterval(()=>{renderWeeklyReview()},60000);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeFocus();if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();openFocus()}});
  }
  function init(){try{bind()}catch(e){console.warn('V35',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
