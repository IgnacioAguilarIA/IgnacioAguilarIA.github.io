(function(){
  'use strict';
  function syncSeriesCounter(){
    try{
      const overlay=document.getElementById('v28WorkoutOverlay');
      if(!overlay||!overlay.classList.contains('show'))return;
      const host=document.getElementById('v47SetList');
      const counter=document.getElementById('v47RepsCounter');
      if(!host||!counter)return;
      const rows=host.querySelectorAll('.v48-set-row');
      const buttons=host.querySelectorAll('.v47-set-check');
      const done=[...buttons].filter(b=>b.classList.contains('done')).length;
      const total=rows.length||buttons.length||0;
      counter.textContent=done+'/'+total+' series';
      const panel=document.getElementById('v47RepsPanel');
      if(panel)panel.classList.toggle('complete',total>0&&done===total);
    }catch(_){ }
  }
  function schedule(){setTimeout(syncSeriesCounter,0);setTimeout(syncSeriesCounter,50)}
  document.addEventListener('click',function(e){
    if(e.target?.closest?.('#v28WorkoutOverlay #v47SetList .v47-set-check'))schedule();
  },true);
  document.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&e.target?.closest?.('#v28WorkoutOverlay #v47SetList .v47-set-check'))schedule();
  },true);
  const overlay=document.getElementById('v28WorkoutOverlay');
  if(overlay){
    new MutationObserver(schedule).observe(overlay,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.syncTrainingSeriesCounter=syncSeriesCounter;
})();
