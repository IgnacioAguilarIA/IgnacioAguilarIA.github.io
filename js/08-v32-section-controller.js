(function(){
  const SECTION_NAMES=new Set(['home','agenda','calendar','workout','nutrition']);
  const DATA_PANE='[data-v33-pane]';

  function resetViews(){
    document.querySelectorAll(DATA_PANE).forEach(el=>el.classList.add('v33-section-hidden'));
    document.querySelectorAll('.v32-home-pane,.v32-agenda-pane,.v32-calendar-pane,.v32-workout-pane,.v32-nutrition-pane').forEach(el=>el.classList.remove('v32-section-active'));
  }

  function showPane(name){
    document.querySelectorAll('[data-v33-pane="'+name+'"],.v32-'+name+'-pane').forEach(el=>{
      el.classList.remove('v33-section-hidden');
      if(el.classList.contains('v32-home-pane')||el.classList.contains('v32-agenda-pane')||el.classList.contains('v32-calendar-pane')||el.classList.contains('v32-workout-pane')||el.classList.contains('v32-nutrition-pane')) el.classList.add('v32-section-active');
    });
  }

  function syncNavigation(name){
    document.querySelectorAll('[data-v32-section]').forEach(btn=>{
      const active=btn.dataset.v32Section===name;
      btn.classList.toggle('active',active);
      if(active)btn.setAttribute('aria-current','page'); else btn.removeAttribute('aria-current');
    });
  }

  function closeSectionPanels(){
    const panels=[['calendarPanel','calendarIcon'],['workoutPanel','workoutIcon'],['nutritionPanel','nutritionIcon']];
    panels.forEach(([panelId,iconId])=>{
      const panel=document.getElementById(panelId);
      const icon=document.getElementById(iconId);
      panel?.classList.remove('open');
      if(icon)icon.textContent='+';
    });
  }

  async function setSection(name,options={}){
    if(!SECTION_NAMES.has(name))name='home';
    resetViews();
    closeSectionPanels();

    if(name==='home'){
      showPane('home');
    }else if(name==='agenda'){
      showPane('agenda');
    }else if(name==='calendar'){
      showPane('calendar');
      document.getElementById('calendarPanel')?.classList.add('open');
      const icon=document.getElementById('calendarIcon'); if(icon)icon.textContent='−';
      if(typeof loadSharedEvents==='function'){try{await loadSharedEvents();}catch(err){console.warn('Calendario:',err)}}
      if(typeof renderCalendar==='function')renderCalendar();
      if(typeof updateNotice==='function')updateNotice();
    }else if(name==='workout'){
      showPane('workout');
      document.getElementById('workoutPanel')?.classList.add('open');
      const icon=document.getElementById('workoutIcon'); if(icon)icon.textContent='−';
      if(typeof renderWorkoutDays==='function')renderWorkoutDays();
      if(typeof loadWorkoutExercises==='function'){try{await loadWorkoutExercises();}catch(err){console.warn('Entrenamiento:',err)}}
      renderWorkoutList?.(); renderWorkoutHistory?.(); renderWorkoutAnalytics?.();
    }else if(name==='nutrition'){
      showPane('nutrition');
      document.getElementById('nutritionPanel')?.classList.add('open');
      const icon=document.getElementById('nutritionIcon'); if(icon)icon.textContent='−';
      renderNutritionDays?.(); renderMealTabs?.();
      if(typeof loadNutritionMeals==='function'){try{await loadNutritionMeals();}catch(err){console.warn('Alimentación:',err)}}
      renderNutritionList?.(); renderNutritionGoals?.();
    }

    syncNavigation(name);
    localStorage.setItem('agendaV32Section',name);
    if(options.scroll!==false)window.scrollTo({top:0,behavior:'smooth'});
  }

  function bind(){
    document.querySelectorAll('[data-v32-section]').forEach(btn=>{
      if(btn.dataset.v32Bound==='1')return;
      btn.dataset.v32Bound='1';
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setSection(btn.dataset.v32Section)});
    });
    const saved=localStorage.getItem('agendaV32Section');
    setSection(SECTION_NAMES.has(saved)?saved:'home',{scroll:false});
  }

  let currentSection='home';
  const observeDynamicPanes=new MutationObserver(mutations=>{
    mutations.forEach(m=>m.addedNodes.forEach(node=>{
      if(node.nodeType!==1)return;
      if(node.matches?.(DATA_PANE)){node.classList.add('v33-section-hidden');if(node.getAttribute('data-v33-pane')===currentSection)node.classList.remove('v33-section-hidden');}
      node.querySelectorAll?.(DATA_PANE).forEach(el=>{el.classList.add('v33-section-hidden');if(el.getAttribute('data-v33-pane')===currentSection)el.classList.remove('v33-section-hidden');});
    }));
  });
  observeDynamicPanes.observe(document.body,{childList:true,subtree:true});

  const originalSetSection=setSection;
  setSection=async function(name,options={}){currentSection=SECTION_NAMES.has(name)?name:'home';return originalSetSection(currentSection,options)};

  window.v32SetSection=setSection;
  window.v32GetSection=()=>localStorage.getItem('agendaV32Section')||'home';
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
