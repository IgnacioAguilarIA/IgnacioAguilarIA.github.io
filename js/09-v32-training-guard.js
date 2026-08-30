(function(){
  function sync(){
    const open=document.getElementById('v28WorkoutOverlay')?.classList.contains('show');
    document.body.classList.toggle('v32-training-active',!!open);
  }
  function renderV33(){try{habits=readJSON('habits',[]);notes=readJSON('notes',[]);priorityMap=readJSON('priorities',{});renderV33Plan();renderHabits();renderNotes();setTimeout(decorateTasks,0)}catch(_){} }
  function init(){
    sync();
    const o=document.getElementById('v28WorkoutOverlay');
    if(o)new MutationObserver(sync).observe(o,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
