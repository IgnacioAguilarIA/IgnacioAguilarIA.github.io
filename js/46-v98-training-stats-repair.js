(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  function exerciseNames(){
    const seen=new Map();
    (Array.isArray(window.workoutLogs)?window.workoutLogs:[]).forEach(l=>{const n=String(l.exercise_name||'').trim();if(n)seen.set(n.toLowerCase(),n)});
    (Array.isArray(window.workoutExercises)?window.workoutExercises:[]).forEach(e=>{const n=String(e.exercise||'').trim();if(n)seen.set(n.toLowerCase(),n)});
    return [...seen.values()].sort((a,b)=>a.localeCompare(b,'es'));
  }
  function syncProgressSelect(){
    const sel=q('progressExerciseSelect');if(!sel)return;
    const previous=sel.value,names=exerciseNames();
    if(!names.length){sel.innerHTML='<option value="">Sin registros todavía</option>';sel.disabled=true;return}
    sel.disabled=false;
    if([...sel.options].map(o=>o.value).join('\u0001')!==names.join('\u0001')){
      sel.innerHTML='';names.forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;sel.appendChild(o)});
    }
    sel.value=names.includes(previous)?previous:names[0];
  }
  function patchMain(){
    if(typeof window.renderExerciseProgress==='function' && !window.renderExerciseProgress.__v98repair){
      const original=window.renderExerciseProgress;
      function wrapped(){syncProgressSelect();return original();}
      wrapped.__v98repair=true;wrapped.__v98repairOriginal=original;window.renderExerciseProgress=wrapped;
    }
    if(typeof window.renderWorkoutHistory==='function' && !window.renderWorkoutHistory.__v98repair){
      const original=window.renderWorkoutHistory;
      function wrapped(){syncProgressSelect();return original.apply(this,arguments)}
      wrapped.__v98repair=true;wrapped.__v98repairOriginal=original;window.renderWorkoutHistory=wrapped;
    }
  }
  function patchV92(){
    const host=q('v92TrainingInsights');if(!host)return;
    const ex=q('v92TiExercise'),session=q('v92TiSession'),cmp=q('v92TiCompareSession'),refresh=q('v92TiRefresh');
    [ex,session,cmp,refresh].forEach(el=>{if(el)el.setAttribute('aria-label',el.getAttribute('aria-label')||el.previousElementSibling?.textContent||el.textContent||'Control')});
    if(session)session.disabled=ex?.options.length<=0;
    if(cmp)cmp.disabled=cmp.options.length<=0||String(cmp.value)==='';
  }
  function patch(){patchMain();patchV92();try{syncProgressSelect()}catch(_){}}
  function init(){patch();setTimeout(patch,1200);setTimeout(patch,3000);document.addEventListener('click',()=>setTimeout(patch,120),true);document.addEventListener('change',()=>setTimeout(patch,60),true);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(patch,120)});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
