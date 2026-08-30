(function(){
  const q = id => document.getElementById(id);

  function v25TodayIndex(){
    return typeof getTodayIndex==='function' ? getTodayIndex() : 0;
  }

  function v25TodayKey(){
    return typeof todayISO==='function' ? todayISO() : new Date().toISOString().slice(0,10);
  }

  function v25ComputeStreak(){
    try{
      if(typeof computeCurrentStreak==='function') return computeCurrentStreak();
    }catch(_){}
    return 0;
  }

  function v25UpdateDashboard(){
    try{
      const day = selectedDay;
      const dayTasks = (tasks||[]).filter(t=>Number(t.day)===day);
      const done = dayTasks.filter(t=>t.completed).length;
      const taskPct = dayTasks.length ? Math.round(done/dayTasks.length*100) : 0;
      q('v25TaskPct').textContent = taskPct+'%';
      q('v25TaskSub').textContent = `${done} / ${dayTasks.length} completadas`;
      q('v25TaskBar').style.width = taskPct+'%';

      const todayLogs = (workoutLogs||[]).filter(l=>String(l.performed_at)===v25TodayKey()).length;
      q('v25WorkoutValue').textContent = String(todayLogs);
      q('v25WorkoutSub').textContent = todayLogs===1 ? 'sesión hoy' : 'sesiones hoy';
      q('v25WorkoutBar').style.width = Math.min(100,todayLogs?100:0)+'%';

      const meals = (nutritionMeals||[]).filter(m=>Number(m.day)===nutritionDay).length;
      const mealPct = Math.min(100,Math.round(meals/6*100));
      q('v25MealValue').textContent = `${meals} / 6`;
      q('v25MealSub').textContent = 'comidas cargadas';
      q('v25MealBar').style.width = mealPct+'%';

      q('v25StreakValue').textContent = v25ComputeStreak()+' días';
    }catch(err){console.warn('v25 dashboard',err)}
  }

  function v25SetOffline(on){
    const dot=q('v25OfflineDot'), text=q('v25OfflineText');
    if(!dot||!text)return;
    dot.classList.toggle('off',!on);
    text.textContent = on ? 'Conectado' : 'Sin conexión · datos locales';
  }

  function v25CacheSnapshot(){
    try{
      if(!currentUser)return;
      const key='agendaSnapshot:'+currentUser.id;
      const snap={
        saved_at:new Date().toISOString(),
        tasks:tasks||[],
        personalDates:personalDates||[],
        workoutExercises:workoutExercises||[],
        workoutLogs:workoutLogs||[],
        nutritionMeals:nutritionMeals||[]
      };
      localStorage.setItem(key,JSON.stringify(snap));
    }catch(err){console.warn('No se pudo guardar caché',err)}
  }

  function v25LoadSnapshot(){
    try{
      if(!currentUser)return false;
      const raw=localStorage.getItem('agendaSnapshot:'+currentUser.id);
      if(!raw)return false;
      const snap=JSON.parse(raw);
      if(Array.isArray(snap.tasks)) tasks=snap.tasks;
      if(Array.isArray(snap.personalDates)) personalDates=snap.personalDates;
      if(Array.isArray(snap.workoutExercises)) workoutExercises=snap.workoutExercises;
      if(Array.isArray(snap.workoutLogs)) workoutLogs=snap.workoutLogs;
      if(Array.isArray(snap.nutritionMeals)) nutritionMeals=snap.nutritionMeals;
      createDays?.(); renderSchedule?.(); updateStats?.(); renderDashboard?.(); renderWorkoutDays?.(); renderWorkoutList?.(); renderWorkoutHistory?.(); renderNutritionDays?.(); renderMealTabs?.(); renderNutritionList?.(); renderNutritionGoals?.(); renderConflicts?.();
      return true;
    }catch(err){console.warn('No se pudo leer caché',err);return false}
  }

  async function v25LoadFresh(){
    if(!currentUser)return;
    const loaders=[
      ['tareas', typeof loadTasks==='function'?loadTasks:null],
      ['fechas', typeof loadPersonalDates==='function'?loadPersonalDates:null],
      ['ejercicios', typeof loadWorkoutExercises==='function'?loadWorkoutExercises:null],
      ['historial', typeof loadWorkoutLogs==='function'?loadWorkoutLogs:null],
      ['comidas', typeof loadNutritionMeals==='function'?loadNutritionMeals:null],
    ];
    for(const [name,fn] of loaders){
      if(typeof fn!=='function')continue;
      try{ await fn(); }catch(err){console.warn('v25 '+name,err)}
      try{
        createDays?.(); renderSchedule?.(); updateStats?.(); renderDashboard?.();
        renderWorkoutDays?.(); renderWorkoutList?.(); renderWorkoutHistory?.();
        renderNutritionDays?.(); renderMealTabs?.(); renderNutritionList?.(); renderNutritionGoals?.();
        renderConflicts?.(); renderSmartDashboard?.(); renderTodayTimeline?.();
      }catch(err){console.warn('v25 render '+name,err)}
    }
    v25CacheSnapshot();
    if(typeof loadSharedEvents==='function'){
      try{ await loadSharedEvents(); renderCalendar?.(); updateNotice?.(); }catch(err){console.warn('v25 events',err)}
    }
  }

  function v25OpenQuick(){
    q('v25QuickSheet')?.classList.add('show');
  }
  function v25CloseQuick(){
    q('v25QuickSheet')?.classList.remove('show');
  }

  function v25DoQuick(type){
    v25CloseQuick();
    if(type==='task' && typeof openTaskModal==='function'){
      const now = typeof getArgentinaNow==='function' ? getArgentinaNow() : new Date();
      openTaskModal(Math.max(7,Math.min(22,now.getHours())), Math.max(0,Math.min(59,now.getMinutes())));
    }else if(type==='meal' && typeof openNutritionModal==='function'){
      openNutritionPanel?.(); openNutritionModal();
    }else if(type==='workout' && typeof openExerciseModal==='function'){
      openWorkoutPanel?.(); openExerciseModal();
    }else if(type==='date' && typeof openDateModal==='function'){
      openDateModal(null, v25TodayKey());
    }
  }

  function v25EnsureSearch(){
    const overlay=q('v25SearchOverlay') || q('v15SearchOverlay');
    const input=q('v25SearchInput') || q('v15SearchInput');
    if(!overlay || !input){
      // Search UI is supplied by the existing v23/v24 layer.
      return;
    }
  }

  window.addEventListener('online',()=>{v25SetOffline(true); v25LoadFresh();});
  window.addEventListener('offline',()=>v25SetOffline(false));

  document.addEventListener('DOMContentLoaded',()=>{
    const host = document.querySelector('#dashboard') || document.querySelector('.dashboard') || document.querySelector('#app');
    const anchor = document.querySelector('.stats') || document.querySelector('.dashboard') || document.querySelector('.days');
    if(anchor && !q('v25Goals')) anchor.insertAdjacentHTML('afterend',extra_html);

    if(!q('v25QuickSheet')) document.body.insertAdjacentHTML('beforeend',sheet_html);

    const topbar = document.querySelector('.topbar .userbar');
    if(topbar && !q('v25OfflineDot')){
      const wrap=document.createElement('div');
      wrap.className='v25-offline';
      wrap.innerHTML='<span class="v25-dot" id="v25OfflineDot"></span><span id="v25OfflineText">Conectado</span>';
      topbar.insertBefore(wrap, topbar.firstChild);
    }

    q('v25QuickAddBtn')?.addEventListener('click',v25OpenQuick);
    q('v25QuickClose')?.addEventListener('click',v25CloseQuick);
    q('v25QuickSheet')?.addEventListener('click',e=>{
      if(e.target===e.currentTarget)v25CloseQuick();
      const btn=e.target.closest('[data-v25-action]');
      if(btn)v25DoQuick(btn.dataset.v25Action);
    });

    v25SetOffline(navigator.onLine);
    if(currentUser && !navigator.onLine) v25LoadSnapshot();
    v25UpdateDashboard();

    setInterval(v25UpdateDashboard,30000);
    setInterval(v25CacheSnapshot,60000);
    window.addEventListener('focus',v25UpdateDashboard);
  });
})();
