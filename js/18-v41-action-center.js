(function(){
  const q=id=>document.getElementById(id);
  let nextTask=null;
  function nowAR(){try{return typeof getArgentinaNow==='function'?getArgentinaNow():new Date()}catch(_){return new Date()}}
  function todayIdx(){try{return typeof getTodayIndex==='function'?getTodayIndex():((nowAR().getDay()+6)%7)}catch(_){return 0}}
  function p2(n){return String(n).padStart(2,'0')}
  function tmin(t){return Number(t?.hour||0)*60+Number(t?.minute||0)}
  function priority(t){return String(t?.priority||'normal').toLowerCase()}
  function score(t){const now=nowAR(), idx=todayIdx(), d=Number(t?.day)||0;let dayDiff=d-idx;if(dayDiff<0)dayDiff+=7;const delta=dayDiff*1440+(tmin(t)-now.getHours()*60-now.getMinutes());let s=0;if(priority(t)==='urgent')s+=10000;if(priority(t)==='high')s+=5000;if(dayDiff===0&&delta<0)s+=8000;s+=Math.max(0,6000-Math.max(0,delta));return s}
  function pick(){return (Array.isArray(tasks)?tasks:[]).filter(t=>!t.completed).slice().sort((a,b)=>score(b)-score(a))[0]||null}
  function taskAbsDate(t){const now=nowAR(), idx=todayIdx();let dayDiff=(Number(t?.day)||0)-idx;if(dayDiff<0)dayDiff+=7;const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());d.setDate(d.getDate()+dayDiff);d.setHours(Number(t?.hour)||0,Number(t?.minute)||0,0,0);return d}
  function fmtRemain(ms){if(ms<=0)return 'Ya debería haber empezado';const min=Math.ceil(ms/60000);if(min<60)return `Empieza en ${min} min`;const h=Math.floor(min/60),m=min%60;return `Empieza en ${h}h${m?` ${m}m`:''}`}
  function render(){
    const panel=q('v41ActionPanel');if(!panel)return;
    q('v41Clock').textContent=`${p2(nowAR().getHours())}:${p2(nowAR().getMinutes())}`;
    nextTask=pick();
    if(!nextTask){q('v41TaskTitle').textContent='No hay tareas pendientes';q('v41TaskMeta').textContent='Podés usar el inbox o planificar el resto del día.';q('v41Countdown').textContent='✓ Día libre';return}
    const day=DAYS?.[Number(nextTask.day)]||'Día';const pri=priority(nextTask)==='urgent'?' · 🔴 Urgente':priority(nextTask)==='high'?' · 🟠 Alta':'';
    q('v41TaskTitle').textContent=nextTask.title||'Tarea';q('v41TaskMeta').textContent=`${day} · ${p2(Number(nextTask.hour)||0)}:${p2(Number(nextTask.minute)||0)}${pri}`;q('v41Countdown').textContent=fmtRemain(taskAbsDate(nextTask)-nowAR());
  }
  async function snooze(mins){
    if(!nextTask||!currentUser)return;
    const d=Number(nextTask.day)||0;let total=tmin(nextTask)+Number(mins||0);let nd=d;while(total>=1440){total-=1440;nd=(nd+1)%7}
    while(total<0){total+=1440;nd=(nd+6)%7}
    nextTask.day=nd;nextTask.hour=Math.floor(total/60);nextTask.minute=total%60;
    const payload={day:nd,hour:nextTask.hour,minute:nextTask.minute};
    if(navigator.onLine){const {error}=await sb.from('tasks').update(payload).eq('id',nextTask.id);if(error){alert(error.message);return}}
    else{
      try{
        const key=`agendaV40:queue:${currentUser.id}`;const raw=localStorage.getItem(key);const queue=raw?JSON.parse(raw):[];const id=String(nextTask.id);let merged=false;for(let i=queue.length-1;i>=0;i--){if(String(queue[i].id)===id){if(queue[i].kind==='create'){queue[i].payload={...queue[i].payload,...payload};merged=true;break}if(queue[i].kind==='update'){queue[i].payload={...queue[i].payload,...payload};merged=true;break}}}
        if(!merged)queue.push({kind:'update',id,payload,at:new Date().toISOString(),qid:`q-${Date.now()}-sn`});localStorage.setItem(key,JSON.stringify(queue));
      }catch(e){console.warn('snooze offline',e)}
    }
    const local=Array.isArray(tasks)?tasks.find(t=>String(t.id)===String(nextTask.id)):null;if(local)Object.assign(local,payload);try{cacheWrite?.('tasks',tasks);localStorage.setItem(`agendaV40:tasks:${currentUser.id}`,JSON.stringify(tasks||[]))}catch(_){ }
    try{createDays?.();renderSchedule?.();renderDashboard?.();renderTodayTimeline?.();render40?.()}catch(_){ }
    render();if(navigator.onLine){try{await loadTasks();render()}catch(_){}}
  }
  function complete(){if(nextTask)try{toggleTaskComplete?.(nextTask)}catch(_){}setTimeout(render,150)}
  function open(){if(!nextTask)return;try{selectedDay=Number(nextTask.day)||0;createDays?.();renderSchedule?.();v32SetSection?.('agenda');openTaskModal?.(Number(nextTask.hour)||7,Number(nextTask.minute)||0,nextTask)}catch(_){} }
  function focus(){if(nextTask)try{openFocus?.(nextTask)}catch(_){} }
  function closeShortcuts(){q('v41ShortcutsOverlay')?.classList.remove('show');q('v41ShortcutsOverlay')?.setAttribute('aria-hidden','true')}
  function init(){
    q('v41CompleteBtn')?.addEventListener('click',complete);q('v41OpenBtn')?.addEventListener('click',open);q('v41FocusBtn')?.addEventListener('click',focus);
    document.querySelectorAll('[data-v41-snooze]').forEach(b=>b.addEventListener('click',()=>snooze(Number(b.dataset.v41Snooze)||15)));
    q('v41ShortcutsBtn')?.addEventListener('click',()=>{q('v41ShortcutsOverlay')?.classList.add('show');q('v41ShortcutsOverlay')?.setAttribute('aria-hidden','false')});q('v41ShortcutsClose')?.addEventListener('click',closeShortcuts);q('v41ShortcutsOverlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeShortcuts()});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){closeShortcuts();return}
      const tag=(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag)||e.target?.isContentEditable)return;
      if(e.altKey&&e.key.toLowerCase()==='n'){e.preventDefault();try{const n=nowAR();openTaskModal?.(Math.max(7,Math.min(22,n.getHours())),n.getMinutes())}catch(_){}return}
      if(e.altKey&&e.key.toLowerCase()==='i'){e.preventDefault();const inp=document.getElementById('v38InboxInput');if(inp){v32SetSection?.('home');setTimeout(()=>inp.focus(),80)}return}
      if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();try{openFocus?.(nextTask)}catch(_){}return}
      if(e.shiftKey&&e.key==='?'){e.preventDefault();q('v41ShortcutsBtn')?.click()}
    });
    setInterval(render,30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render()});window.addEventListener('online',render);window.addEventListener('offline',render);render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
