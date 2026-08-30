(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  function seriesValues(v){
    const text=String(v??'');const out={};let m;const re=/S(\d+)\s*:\s*([^·|/]+)/g;
    while((m=re.exec(text))){const n=Number(String(m[2]).replace(',','.').match(/-?\d+(?:\.\d+)?/)?.[0]||0);out[Number(m[1])]=n}
    if(Object.keys(out).length)return out;
    const parts=text.split('/').map(x=>Number(String(x).replace(',','.').match(/-?\d+(?:\.\d+)?/)?.[0]||0));
    parts.forEach((n,i)=>{out[i+1]=n});return out;
  }
  function numWeight(v){const vals=Object.values(seriesValues(v));return vals.length?Math.max(...vals):0}
  function repsTotal(v){return Object.values(seriesValues(v)).reduce((a,b)=>a+(Number.isFinite(b)?b:0),0)}
  function volume(log){const rs=seriesValues(log?.reps),ws=seriesValues(log?.weight);let total=0;Object.keys(rs).forEach(k=>{const r=Number(rs[k]),w=Number(ws[k]);if(r>0&&w>0)total+=r*w});return total}
  function logsFor(name){return (workoutLogs||[]).filter(l=>String(l.exercise_name||'').trim().toLowerCase()===String(name||'').trim().toLowerCase()).sort((a,b)=>String(b.performed_at||'').localeCompare(String(a.performed_at||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')))}
  function bests(logs){let maxW=0,maxV=0,maxReps=0;logs.forEach(l=>{maxW=Math.max(maxW,numWeight(l.weight));maxV=Math.max(maxV,volume(l));maxReps=Math.max(maxReps,repsTotal(l.reps))});return {maxW,maxV,maxReps}}
  function compare(a,b){
    if(!a||!b)return {cls:'first',text:'🆕 Primer punto de comparación para este ejercicio.'};
    const va=volume(a),vb=volume(b),wa=numWeight(a.weight),wb=numWeight(b.weight),ra=repsTotal(a.reps),rb=repsTotal(b.reps);
    const score=(va>vb?1:0)+(wa>wb?1:0)+(ra>rb?1:0)-(va<vb?1:0)-(wa<wb?1:0)-(ra<rb?1:0);
    if(score>0)return {cls:'up',text:`📈 Vas mejor: volumen ${va&&vb?Math.round((va/vb-1)*100):0}% respecto al registro anterior.`};
    if(score<0)return {cls:'down',text:'📉 Bajó alguna métrica respecto al registro anterior. No pasa nada: queda registrado para comparar.'};
    return {cls:'same',text:'➡️ Rendimiento similar al registro anterior.'};
  }
  function mount(){
    const host=q('v28CurrentNote');if(!host||q('v51TrainingInsights'))return;
    const box=document.createElement('section');box.id='v51TrainingInsights';box.className='v51-training-insights';box.innerHTML='<div class="v51-ti-head"><div><strong>📈 Progreso del ejercicio</strong><span>Comparación automática con tu historial.</span></div><span id="v51PrBadge" class="v51-pr-badge" style="display:none">🏆 Récord</span></div><div class="v51-ti-grid"><div class="v51-ti-card"><strong id="v51MaxWeight">—</strong><span>Peso máximo</span></div><div class="v51-ti-card"><strong id="v51MaxVolume">—</strong><span>Mayor volumen</span></div><div class="v51-ti-card"><strong id="v51MaxReps">—</strong><span>Más reps</span></div><div class="v51-ti-card"><strong id="v51LastDate">—</strong><span>Último registro</span></div></div><div id="v51Trend" class="v51-ti-status first">Cargando…</div>';
    host.parentNode.insertBefore(box,host.nextSibling);
  }
  function render(){
    try{
      mount();const name=q('v28CurrentName')?.textContent?.trim();if(!name||!q('v51TrainingInsights'))return;
      const logs=logsFor(name),b=bests(logs),last=logs[0],prev=logs[1];
      q('v51MaxWeight').textContent=b.maxW?`${b.maxW} kg`:'—';q('v51MaxVolume').textContent=b.maxV?`${Math.round(b.maxV)} kg`:'—';q('v51MaxReps').textContent=b.maxReps?String(b.maxReps):'—';q('v51LastDate').textContent=last?.performed_at||'—';
      const c=compare(last,prev);const tr=q('v51Trend');tr.className='v51-ti-status '+c.cls;tr.textContent=c.text;
      const pr=q('v51PrBadge');const currentWeight=numWeight(q('v48SetList')?.querySelector('input:nth-of-type(2)')?.value||'');const hasNewWeight=currentWeight&&currentWeight>=b.maxW&&b.maxW>0;pr.style.display=hasNewWeight?'inline-flex':'none';
    }catch(e){console.warn('V51 training insights',e)}
  }
  function bind(){
    const n=q('v28CurrentName');if(n)new MutationObserver(()=>setTimeout(render,0)).observe(n,{childList:true,characterData:true,subtree:true});
    document.addEventListener('input',e=>{if(e.target?.classList?.contains('v48-set-input'))render()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render()});
    setInterval(()=>{if(q('v28WorkoutOverlay')?.classList.contains('show'))render()},5000);
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.agendaV51TrainingInsights=render;
})();
