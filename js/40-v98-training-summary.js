(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const escText=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function session(){try{const uid=window.currentUser?.id||'guest';return JSON.parse(localStorage.getItem(`agendaTrainingV31:${uid}`)||'null')}catch(_){return null}}
  function currentActuals(){
    const s=session();
    if(!s||!Array.isArray(s.actuals))return null;
    const exercises=Array.isArray(window.workoutExercises)?window.workoutExercises:[];
    let totalVolume=0,totalReps=0,doneSets=0,totalSets=0,maxWeight=0,best1RM=0,rirSum=0,rirN=0;
    s.actuals.forEach((a,i)=>{
      const ex=exercises[i]||{};
      const sets=Math.max(0,Number(ex.sets)||Math.max(a?.reps?.length||0,a?.weight?.length||0,a?.done?.length||0));
      totalSets+=sets;
      for(let j=0;j<sets;j++){
        const reps=num(a?.reps?.[j]), weight=num(a?.weight?.[j]), rir=num(a?.rir?.[j]);
        if(a?.done?.[j])doneSets++;
        if(reps!==null&&reps>0)totalReps+=reps;
        if(weight!==null&&weight>0){maxWeight=Math.max(maxWeight,weight);}
        if(rir!==null){rirSum+=rir;rirN++}
        if(reps!==null&&weight!==null&&reps>0&&weight>0){
          totalVolume+=reps*weight;
          const est1rm=weight*(1+reps/30);
          best1RM=Math.max(best1RM,est1rm);
        }
      }
    });
    return {s,totalVolume,totalReps,doneSets,totalSets,maxWeight,best1RM,avgRir:rirN?rirSum/rirN:null};
  }
  function restStats(){
    const s=session();if(!s?.id)return null;
    try{
      const d=JSON.parse(localStorage.getItem(`agendaTrainingV94Rest:${s.id}`)||'{"events":[]}')||{};
      const vals=(Array.isArray(d.events)?d.events:[]).map(x=>Number(x.seconds)).filter(Number.isFinite).filter(v=>v>=0&&v<=7200);
      if(!vals.length)return null;
      return {count:vals.length,avg:vals.reduce((a,b)=>a+b,0)/vals.length,min:Math.min(...vals),max:Math.max(...vals)};
    }catch(_){return null}
  }
  function fmtTime(sec){sec=Math.max(0,Math.round(Number(sec)||0));const m=Math.floor(sec/60),s=sec%60;return `${m}m ${String(s).padStart(2,'0')}s`;}
  function addOrUpdatePanel(){
    const overlay=q('v48FinishOverlay'); if(!overlay||!overlay.classList.contains('show'))return;
    let box=q('v98FinishSummary');
    if(!box){
      const card=overlay.querySelector('.v48-finish-card')||overlay;
      box=document.createElement('div');box.id='v98FinishSummary';box.className='v98-finish-summary';
      (card.querySelector('#v49Comparison')||card.lastElementChild||card).before(box);
    }
    const st=currentActuals();
    if(!st){box.innerHTML='';return;}
    const completedPct=st.totalSets?Math.round(st.doneSets/st.totalSets*100):0;
    const duration=st.s?.sessionSeconds||0;
    const rest=restStats();
    const prParts=[];
    const bestWeight=st.maxWeight;
    if(bestWeight>0)prParts.push(`Peso máx. ${bestWeight} kg`);
    if(st.totalVolume>0)prParts.push(`Volumen ${Math.round(st.totalVolume*10)/10} kg`);
    const details=[];
    details.push(`<span><strong>${completedPct}%</strong><small>series completadas</small></span>`);
    details.push(`<span><strong>${st.totalReps}</strong><small>reps registradas</small></span>`);
    details.push(`<span><strong>${Math.round(st.totalVolume*10)/10} kg</strong><small>volumen</small></span>`);
    details.push(`<span><strong>${st.best1RM?Math.round(st.best1RM*10)/10+' kg':'—'}</strong><small>1RM estimado</small></span>`);
    if(rest)details.push(`<span><strong>${escText(fmtTime(rest.avg))}</strong><small>descanso medio</small></span>`);
    box.innerHTML=`<div class="v98-summary-head"><strong>📌 Resumen de rendimiento</strong><span>${duration?`Duración ${escText(fmtTime(duration))}`:'Sesión registrada'}</span></div><div class="v98-summary-grid">${details.join('')}</div><div class="v98-summary-note">${prParts.length?`🏆 Mejores marcas: ${escText(prParts.join(' · '))}. `:''}${st.avgRir!==null?`RIR medio registrado: ${escText(Math.round(st.avgRir*10)/10)}.`:''}</div>`;
  }
  document.addEventListener('click',()=>setTimeout(addOrUpdatePanel,30),true);
  const obs=new MutationObserver(()=>addOrUpdatePanel());
  function init(){const target=document.body;if(target)obs.observe(target,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});setInterval(addOrUpdatePanel,1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
