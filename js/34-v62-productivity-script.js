(function(){
  const q=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,'0');
  const today=()=>typeof getTodayIndex==='function'?getTodayIndex():((new Date().getDay()+6)%7);
  const dur=t=>{try{const m=localStorage.getItem('agendaV46Durations:'+((typeof currentUser!=='undefined'&&currentUser?.id)||'guest'));const a=m?JSON.parse(m):{};return Number(a[String(t?.id)])||30}catch{return 30}};
  const focusToday=()=>{try{const id=(typeof currentUser!=='undefined'&&currentUser?.id)||'guest';const raw=localStorage.getItem('agendaV56Focus:'+id);const x=raw?JSON.parse(raw):null;const key=typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);return Number(x?.days?.[key])||0}catch{return 0}};
  function refresh(){
    const host=q('v62DailyLoad');if(!host)return;
    const idx=today();const list=(typeof tasks!=='undefined'&&Array.isArray(tasks)?tasks:[]).filter(t=>Number(t?.day)===idx&&!t.completed);
    const reserved=list.reduce((a,t)=>a+dur(t),0);const totalWindow=16*60;const free=Math.max(0,totalWindow-reserved);const pct=Math.min(100,Math.round(reserved/totalWindow*100));const focus=focusToday();
    q('v62Reserved').textContent=reserved+' min';q('v62Free').textContent=free+' min';q('v62Focus').textContent=focus+' min';q('v62LoadPct').textContent=pct+'%';q('v62LoadBar').style.width=pct+'%';
    const note=pct>=85?'⚠️ Día muy cargado. Conviene priorizar y dejar margen entre bloques.':pct>=65?'🟡 Día bastante ocupado. Todavía tenés margen para una tarea importante.':'🟢 Tenés buen margen hoy. Podés usar parte del tiempo libre para estudiar, descansar o planificar.';q('v62LoadNote').textContent=note;
  }
  function setCompact(on){document.body.classList.toggle('v62-compact',on);try{localStorage.setItem('agendaV62Compact:'+((typeof currentUser!=='undefined'&&currentUser?.id)||'guest'),on?'1':'0')}catch{};const b=q('v62CompactToggle');if(b)b.textContent=on?'▤ Modo compacto: activo':'▤ Modo compacto de Agenda';}
  function bind(){const b=q('v62CompactToggle');if(b){let on=false;try{on=localStorage.getItem('agendaV62Compact:'+((typeof currentUser!=='undefined'&&currentUser?.id)||'guest'))==='1'}catch{};setCompact(on);b.onclick=()=>setCompact(!document.body.classList.contains('v62-compact'));}refresh();setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
