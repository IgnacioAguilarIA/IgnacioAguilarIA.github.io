(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const num=v=>{const m=String(v??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0};
  const repsTotal=v=>String(v??'').split('/').map(x=>num(x)).reduce((a,b)=>a+b,0);
  const volume=l=>repsTotal(l?.reps)*num(l?.weight);
  const rirVals=v=>String(v??'').split(/[\/,]/).map(x=>num(x)).filter(x=>Number.isFinite(x));
  function getLogs(name){return (typeof workoutLogs!=='undefined'?workoutLogs:[]).filter(l=>String(l.exercise_name||'').trim().toLowerCase()===String(name||'').trim().toLowerCase()).sort((a,b)=>String(a.performed_at||'').localeCompare(String(b.performed_at||''))||String(a.created_at||'').localeCompare(String(b.created_at||'')));}
  function mount(){const anchor=q('v51TrainingInsights');if(!anchor||q('v52TrainingProgress'))return;anchor.parentNode.insertBefore(q('v52TrainingProgress')||document.createElement('span'),anchor.nextSibling);}
  function render(){
    try{
      const host=q('v52TrainingProgress');if(!host)return;
      const overlay=q('v28WorkoutOverlay');if(!overlay?.classList.contains('show')){host.style.display='none';return;}
      const name=q('v28CurrentName')?.textContent?.trim();if(!name){host.style.display='none';return;}
      const logs=getLogs(name);host.style.display='block';
      if(!logs.length){q('v52BestWeight').textContent='—';q('v52BestVolume').textContent='—';q('v52BestReps').textContent='—';q('v52AvgRir').textContent='—';q('v52TrendBadge').textContent='🆕 Primer registro';q('v52TrendChart').innerHTML='';q('v52LiveStatus').textContent='Todavía no hay registros previos de este ejercicio.';q('v52PRBadge').style.display='none';return;}
      const bestW=Math.max(...logs.map(l=>num(l.weight)));const bestV=Math.max(...logs.map(volume));const bestR=Math.max(...logs.map(l=>repsTotal(l.reps)));
      const rirs=logs.flatMap(l=>rirVals(l.rir));const avgRir=rirs.length?(rirs.reduce((a,b)=>a+b,0)/rirs.length).toFixed(1):'—';
      q('v52BestWeight').textContent=bestW?`${bestW} kg`:'—';q('v52BestVolume').textContent=bestV?`${Math.round(bestV)} kg`:'—';q('v52BestReps').textContent=bestR?String(bestR):'—';q('v52AvgRir').textContent=avgRir==='—'?'—':`${avgRir}`;
      const recent=logs.slice(-6);const maxChart=Math.max(1,...recent.map(volume));q('v52TrendChart').innerHTML=recent.map((l,i)=>{const v=volume(l);const h=Math.max(8,Math.round(v/maxChart*100));return `<div class="v52-bar" style="height:${h}%" title="${l.performed_at||''} · ${Math.round(v)} kg"><small>${String(l.performed_at||'').slice(5)}</small></div>`}).join('');
      const last=logs[logs.length-1],prev=logs.length>1?logs[logs.length-2]:null;const lv=volume(last),pv=prev?volume(prev):0;let badge='➡️ Similar',live='';if(prev&&lv>pv){badge=`📈 +${Math.round((lv/pv-1)*100)}% volumen`;live='Mejoraste respecto al último registro.'}else if(prev&&lv<pv){badge=`📉 ${Math.round((1-lv/pv)*100)}% menos`;live='Tu último registro tuvo menor volumen; queda guardado para seguir comparando.'}else if(prev){live='Rendimiento muy parecido al registro anterior.'}else{badge='🆕 Primer registro';live='Este ejercicio ya tiene un punto de referencia para futuras comparaciones.'}q('v52TrendBadge').textContent=badge;
      const currentWeights=[...document.querySelectorAll('#v48SetList input')].filter((_,i)=>i%3===1).map(i=>num(i.value)).filter(Boolean);const liveW=currentWeights.length?Math.max(...currentWeights):0;const isPR=liveW>bestW&&bestW>0;q('v52PRBadge').style.display=isPR?'inline-flex':'none';
      q('v52LiveStatus').innerHTML=`<strong>Último registro:</strong> ${last.performed_at||'—'} · ${last.reps||'—'} reps · ${last.weight||'—'} kg${last.rir!==null&&last.rir!==undefined&&last.rir!==''?` · RIR ${last.rir}`:''}. ${live}`;
    }catch(e){console.warn('V52 progress',e)}
  }
  function bind(){
    const overlay=q('v28WorkoutOverlay');
    if(overlay)new MutationObserver(render).observe(overlay,{attributes:true,attributeFilter:['class']});
    const n=q('v28CurrentName');if(n)new MutationObserver(()=>setTimeout(render,0)).observe(n,{childList:true,characterData:true,subtree:true});
    document.addEventListener('input',e=>{if(e.target?.matches?.('#v48SetList input'))setTimeout(render,0)});
    document.addEventListener('click',e=>{if(e.target?.closest?.('#v28NextBtn,#v28PrevBtn,#v28FinishBtn'))setTimeout(render,700)});
    setInterval(render,5000);render();
  }
  function init(){const src=q('v52TrainingProgress');if(!src)return;const anchor=q('v51TrainingInsights');if(anchor&&src.parentNode!==anchor.parentNode){anchor.parentNode.insertBefore(src,anchor.nextSibling)}bind();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
