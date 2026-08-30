(function(){
  const q=id=>document.getElementById(id);
  function badge(btnId,count){
    const b=q(btnId); if(!b)return;
    let el=b.querySelector('.nav-badge');
    if(!el){el=document.createElement('span');el.className='nav-badge';b.appendChild(el)}
    const n=Math.max(0,Number(count)||0); el.textContent=n>99?'99+':String(n);
    b.classList.toggle('has-badge',n>0);
  }
  function updateNavBadges(){
    try{
      const today=typeof getTodayIndex==='function'?getTodayIndex():selectedDay;
      const pending=(tasks||[]).filter(t=>Number(t.day)===Number(today)&&!t.completed).length;
      const urgent=(tasks||[]).filter(t=>Number(t.day)===Number(today)&&!t.completed&&(Number(t.priority)<=1||String(t.priority||'').toLowerCase()==='urgent')).length;
      const cal=(typeof sharedEvents!=='undefined'?sharedEvents:[]).filter(e=>String(e.date||e.fecha||'')===String(typeof todayISO==='function'?todayISO():'' )).length + (personalDates||[]).filter(e=>String(e.date||'')===String(typeof todayISO==='function'?todayISO():'' )).length;
      const meals=(nutritionMeals||[]).filter(m=>Number(m.day)===Number(today)).length;
      const workouts=(workoutLogs||[]).filter(l=>String(l.performed_at||'')===String(typeof todayISO==='function'?todayISO():'' )).length;
      badge('mobileNavSchedule',pending+urgent);
      badge('mobileNavCalendar',cal);
      badge('mobileNavWorkout',workouts);
      badge('mobileNavFood',meals);
    }catch(_){}
  }
  function bindTop(){
    const b=q('v42TopBtn'); if(!b)return;
    const onScroll=()=>b.classList.toggle('show',window.scrollY>420);
    window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
    b.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  }
  function init(){
    bindTop(); updateNavBadges(); setInterval(updateNavBadges,30000);
    window.addEventListener('online',updateNavBadges);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updateNavBadges()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
