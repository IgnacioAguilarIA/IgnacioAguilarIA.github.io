(function(){
  'use strict';
  const KEY='agendaTrainingV92Insights';
  const q=id=>document.getElementById(id);
  const escText=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const userKey=()=>`${KEY}:${window.currentUser?.id||'guest'}`;
  function readPrefs(){try{return JSON.parse(localStorage.getItem(userKey())||'{}')||{}}catch(_){return {}}}
  function writePrefs(p){try{localStorage.setItem(userKey(),JSON.stringify(p||{}))}catch(_){} }
  function fmtDate(v){if(!v)return '—';const d=new Date(String(v)+'T12:00:00');if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function parseSeries(log){
    const reps=[],weights=[],rirs=[];
    const notes=String(log?.notes||'');
    const detailRe=/S(\d+)\s+([^·|]+?)\s+reps\s+·\s+([^·|]+?)\s+kg\s+·\s+RIR\s+([^·|]+)/g;
    let m;
    while((m=detailRe.exec(notes))){
      const i=Math.max(0,Number(m[1])-1);
      reps[i]=String(m[2]).trim(); weights[i]=String(m[3]).trim(); rirs[i]=String(m[4]).trim();
    }
    const parseKV=(text,target)=>String(text||'').split('·').forEach(part=>{
      const x=part.match(/S(\d+)\s*:\s*(.*)/);
      if(x)target[Number(x[1])-1]=String(x[2]).trim();
    });
    if(!reps.some(Boolean))parseKV(log?.reps,reps);
    if(!weights.some(Boolean))parseKV(log?.weight,weights);
    const rirAvg=num(log?.rir);
    const count=Math.max(num(log?.sets_completed)||0,reps.length,weights.length,rirs.length);
    if(rirAvg!==null){for(let i=0;i<count;i++)if(rirs[i]==null||rirs[i]==='')rirs[i]=String(rirAvg)}
    const out=[];
    for(let i=0;i<count;i++){
      const r=num(reps[i]),w=num(weights[i]),rr=num(rirs[i]);
      if(r!==null||w!==null||rr!==null)out.push({set:i+1,reps:r,weight:w,rir:rr});
    }
    return out;
  }
  function logsForExercise(name){
    return (Array.isArray(workoutLogs)?workoutLogs:[])
      .filter(l=>String(l.exercise_name||'')===String(name||''))
      .sort((a,b)=>String(b.performed_at||'').localeCompare(String(a.performed_at||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
  }
  function sessionStats(log){
    const series=parseSeries(log);let totalReps=0,volume=0,maxWeight=0,rirSum=0,rirN=0;
    series.forEach(s=>{
      if(s.reps!==null)totalReps+=s.reps;
      if(s.reps!==null&&s.weight!==null)volume+=s.reps*s.weight;
      if(s.weight!==null)maxWeight=Math.max(maxWeight,s.weight);
      if(s.rir!==null){rirSum+=s.rir;rirN++;}
    });
    return {series,totalReps,volume,maxWeight,avgRir:rirN?rirSum/rirN:null,doneSets:num(log?.sets_completed)||series.length};
  }
  function uniqueExercises(){
    const map=new Map();
    (Array.isArray(workoutLogs)?workoutLogs:[]).forEach(l=>{const n=String(l.exercise_name||'').trim();if(n)map.set(n,n)});
    (Array.isArray(workoutExercises)?workoutExercises:[]).forEach(e=>{const n=String(e.exercise||'').trim();if(n)map.set(n,n)});
    return [...map.values()].sort((a,b)=>a.localeCompare(b,'es'));
  }
  function latestSelection(){const p=readPrefs();return p.exercise||uniqueExercises()[0]||''}
  function createPanel(){
    if(q('v92TrainingInsights'))return q('v92TrainingInsights');
    const host=q('workoutPanel');
    if(!host)return null;
    const el=document.createElement('section');
    el.id='v92TrainingInsights';el.className='v92-training-insights';
    el.innerHTML=`
      <div class="v92-ti-head"><div><h3>📚 Seguimiento avanzado</h3><p>Historial detallado, comparación serie por serie y evolución del ejercicio.</p></div><span class="v92-ti-badge" id="v92TiBadge">Listo</span></div>
      <div class="v92-ti-controls"><label>Ejercicio<select id="v92TiExercise"></select></label><label>Sesión<select id="v92TiSession"></select></label><label>Comparar con<select id="v92TiCompareSession"></select></label><button id="v92TiRefresh" type="button">↻ Actualizar</button></div>
      <div class="v92-ti-grid" id="v92TiStats"></div>
      <div class="v92-ti-body"><div class="v92-ti-card"><div class="v92-ti-card-head"><strong>Detalle de la sesión</strong><span id="v92TiSessionMeta">—</span></div><div id="v92TiDetail"></div></div><div class="v92-ti-card"><div class="v92-ti-card-head"><strong>Comparación entre sesiones</strong><span id="v92TiCompareMeta">—</span></div><div id="v92TiCompare"></div></div></div><div class="v92-ti-card v94-history-card"><div class="v92-ti-card-head"><strong>🗂 Historial del ejercicio</strong><span>Elegí cualquier sesión para verla</span></div><div id="v94HistoryList"></div></div>
      <div class="v92-ti-suggest" id="v92TiSuggestion"></div>
    `;
    const analytics=host.querySelector('.exercise-progress')||host.querySelector('.workout-list');
    if(analytics)host.insertBefore(el,analytics);else host.appendChild(el);
    q('v92TiRefresh').addEventListener('click',renderAll);
    q('v92TiExercise').addEventListener('change',()=>{const p=readPrefs();p.exercise=q('v92TiExercise').value;p.sessionIndex=0;writePrefs(p);populateSessions();renderAll();});
    q('v92TiSession').addEventListener('change',()=>{const p=readPrefs();p.sessionIndex=Number(q('v92TiSession').value)||0;writePrefs(p);renderAll();});
    q('v92TiCompareSession')?.addEventListener('change',()=>{const p=readPrefs();p.compareIndex=Number(q('v92TiCompareSession').value);writePrefs(p);renderAll();});
    return el;
  }
  function populateExercises(){
    const sel=q('v92TiExercise');if(!sel)return;
    const ex=uniqueExercises(),selected=latestSelection();
    sel.innerHTML='';
    if(!ex.length){sel.innerHTML='<option value="">Sin registros todavía</option>';return;}
    ex.forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;if(name===selected)o.selected=true;sel.appendChild(o)});
    if(sel.value!==selected){const p=readPrefs();p.exercise=sel.value;writePrefs(p)}
  }
  function populateSessions(){
    const sel=q('v92TiSession'),name=q('v92TiExercise')?.value; if(!sel)return;
    const logs=logsForExercise(name);sel.innerHTML='';
    if(!logs.length){sel.innerHTML='<option value="0">Sin sesiones</option>';return;}
    logs.forEach((l,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${fmtDate(l.performed_at)} · ${i===0?'Más reciente':`Hace ${i} registro${i===1?'':'s'}`}`;sel.appendChild(o)});
    const p=readPrefs();const idx=Math.min(Math.max(0,Number(p.sessionIndex)||0),logs.length-1);sel.value=String(idx);p.sessionIndex=idx;writePrefs(p);
    populateCompareSessions(logs,idx);
  }
  function populateCompareSessions(logs,currentIdx){const sel=q('v92TiCompareSession');if(!sel)return;sel.innerHTML='';const options=logs.map((l,i)=>({l,i})).filter(x=>x.i!==currentIdx);if(!options.length){sel.innerHTML='<option value="">Sin otra sesión</option>';return;}const p=readPrefs();let cmp=Number(p.compareIndex);if(!Number.isFinite(cmp)||cmp===currentIdx||!logs[cmp])cmp=options[0].i;options.forEach(({l,i})=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${fmtDate(l.performed_at)} · ${i<currentIdx?'más antigua':'otra sesión'}`;if(i===cmp)o.selected=true;sel.appendChild(o)});p.compareIndex=cmp;writePrefs(p);}
  function renderHistoryList(name,logs,currentIdx){const host=q('v94HistoryList');if(!host)return;if(!logs.length){host.innerHTML='<div class="v92-ti-empty">Todavía no hay sesiones registradas para este ejercicio.</div>';return;}host.innerHTML=logs.slice(0,12).map((l,i)=>`<button type="button" class="v94-history-item ${i===currentIdx?'active':''}" data-i="${i}"><strong>${fmtDate(l.performed_at)}</strong><span>${sessionStats(l).totalReps} reps · ${Math.round(sessionStats(l).volume*10)/10} kg</span></button>`).join('');host.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const p=readPrefs();p.sessionIndex=Number(b.dataset.i)||0;writePrefs(p);populateSessions();renderAll();}));}
  
  function renderStats(cur,prev){
    const host=q('v92TiStats');if(!host)return;
    const logs=logsForExercise(q('v92TiExercise')?.value);let bestW=0,bestV=0,bestR=0;logs.forEach(l=>{const z=sessionStats(l);bestW=Math.max(bestW,z.maxWeight||0);bestV=Math.max(bestV,z.volume||0);bestR=Math.max(bestR,z.totalReps||0)});const cards=[['Series hechas',cur?.doneSets??0],['Reps totales',cur?.totalReps??0],['Volumen',`${Math.round((cur?.volume||0)*10)/10} kg`],['Peso máx.',`${Math.round((cur?.maxWeight||0)*10)/10} kg`],['🏆 Mejor volumen',`${Math.round(bestV*10)/10} kg`],['🏆 Más reps',bestR]];
    host.innerHTML=cards.map(([a,b])=>`<div class="v92-ti-stat"><strong>${escText(b)}</strong><span>${escText(a)}</span></div>`).join('');
  }
  function renderDetail(log){
    const host=q('v92TiDetail'),meta=q('v92TiSessionMeta'); if(!host)return;
    if(!log){host.innerHTML='<div class="v92-ti-empty">No hay una sesión registrada para este ejercicio.</div>';if(meta)meta.textContent='—';return;}
    const s=sessionStats(log); if(meta)meta.textContent=`${fmtDate(log.performed_at)} · ${s.doneSets} series`;
    if(!s.series.length){host.innerHTML='<div class="v92-ti-empty">Este registro no tiene datos por serie suficientes.</div>';return;}
    host.innerHTML=`<div class="v92-ti-table"><div class="v92-ti-row v92-ti-row-head"><span>Serie</span><span>Reps</span><span>Kg</span><span>RIR</span></div>${s.series.map(x=>`<div class="v92-ti-row"><span>S${x.set}</span><span>${x.reps??'—'}</span><span>${x.weight??'—'}</span><span>${x.rir??'—'}</span></div>`).join('')}</div>`;
  }
  function renderCompare(currentLog,previousLog){
    const host=q('v92TiCompare'),meta=q('v92TiCompareMeta');if(!host)return;
    if(!previousLog){if(meta)meta.textContent='Sin sesión anterior';host.innerHTML='<div class="v92-ti-empty">No hay una sesión anterior de este ejercicio para comparar.</div>';return;}
    const a=sessionStats(currentLog),b=sessionStats(previousLog);if(meta)meta.textContent=`Anterior: ${fmtDate(previousLog.performed_at)}`;
    const n=Math.max(a.series.length,b.series.length),rows=[];
    for(let i=0;i<n;i++){
      const c=a.series[i]||{},p=b.series[i]||{};
      const dr=(c.reps??null)!==null&&(p.reps??null)!==null?c.reps-p.reps:null;
      const dw=(c.weight??null)!==null&&(p.weight??null)!==null?c.weight-p.weight:null;
      const dv=(c.reps!=null&&c.weight!=null&&p.reps!=null&&p.weight!=null)?(c.reps*c.weight)-(p.reps*p.weight):null;
      const cls=dv!=null?(dv>0?'up':dv<0?'down':'same'):'same';
      const detail=[dr==null?'':`reps ${dr>0?'+':''}${dr}`,dw==null?'':`kg ${dw>0?'+':''}${Math.round(dw*10)/10}`,dv==null?'':`vol ${dv>0?'+':''}${Math.round(dv)}`].filter(Boolean).join(' · ')||'Sin dato comparable';
      rows.push(`<div class="v92-ti-row"><span>S${i+1}</span><span>${p.reps??'—'} → ${c.reps??'—'}</span><span>${p.weight??'—'} → ${c.weight??'—'}</span><span class="${cls}">${escText(detail)}</span></div>`);
    }
    host.innerHTML=`<div class="v92-ti-compare-grid"><div class="v92-ti-row v92-ti-row-head"><span>Serie</span><span>Reps</span><span>Kg</span><span>Cambio</span></div>${rows.join('')}</div><div class="v92-ti-totals"><span>Volumen: ${Math.round(b.volume*10)/10} → ${Math.round(a.volume*10)/10} kg</span><span>Reps: ${b.totalReps} → ${a.totalReps}</span></div>`;
  }
  function renderSuggestion(current,previous,name){
    const host=q('v92TiSuggestion');if(!host)return;
    if(!current){host.innerHTML='';return;}
    if(!previous){host.innerHTML=`<div><strong>💡 Primera referencia</strong><span>Esta es la primera sesión disponible para ${escText(name)}. A partir de acá la app ya puede empezar a medir tu evolución.</span></div>`;return;}
    const dv=current.volume-previous.volume,dr=current.totalReps-previous.totalReps,dm=current.maxWeight-previous.maxWeight;
    let title='➡️ Rendimiento similar',text='La sesión quedó bastante cerca de la anterior.';
    if(dv>0||dr>0){title='📈 Mejor registro que la sesión anterior';text='Subieron una o más métricas. Podés usar este dato como referencia para la próxima sesión.';}
    else if(dv<0||dr<0){title='📉 Rendimiento menor';text='Algunas métricas bajaron respecto a la sesión anterior. No hace falta forzar el progreso; usá este registro como referencia.';}
    const extra=dm?` · peso máximo ${dm>0?'+':''}${Math.round(dm*10)/10} kg`:'';
    host.innerHTML=`<div><strong>${title}</strong><span>${text}${extra}</span></div>`;
  }
  function renderAll(){
    if(!q('v92TrainingInsights'))createPanel();
    populateExercises();populateSessions();
    const name=q('v92TiExercise')?.value;const logs=logsForExercise(name);const idx=Math.min(Number(q('v92TiSession')?.value)||0,Math.max(0,logs.length-1));
    const cmpIdxRaw=Number(q('v92TiCompareSession')?.value);const cmpIdx=(Number.isFinite(cmpIdxRaw)&&cmpIdxRaw!==idx&&logs[cmpIdxRaw])?cmpIdxRaw:(idx+1<logs.length?idx+1:null);
    const current=logs[idx]||null,previous=cmpIdx!=null?logs[cmpIdx]:null;
    renderHistoryList(name,logs,idx);
    const cs=current?sessionStats(current):null,ps=previous?sessionStats(previous):null;
    renderStats(cs,ps);renderDetail(current);renderCompare(current,previous);renderSuggestion(cs,ps,name||'este ejercicio');
    const badge=q('v92TiBadge');if(badge)badge.textContent=current?`${logs.length} sesión${logs.length===1?'':'es'}`:'Sin registros';
  }

  /* V93 - capa avanzada de entrenamiento: PRs, tendencia, objetivo y resumen final.
     No modifica el estado de la sesión ni los controles de Reps/Peso/RIR. */
  function goalKey(name){return `${KEY}:goal:${String(name||'').trim().toLowerCase()}`}
  function getGoal(name){try{const v=localStorage.getItem(goalKey(name));return v==null?'':v}catch(_){return ''}}
  function setGoal(name,value){try{if(String(value||'').trim())localStorage.setItem(goalKey(name),String(value));else localStorage.removeItem(goalKey(name))}catch(_){} }
  function formatDelta(v,unit=''){const n=Number(v)||0;return `${n>0?'+':''}${Math.round(n*10)/10}${unit}`}
  function renderUpgrade(){
    const host=q('v93TrainingUpgrade'); const name=q('v92TiExercise')?.value; if(!host||!name)return;
    const logs=logsForExercise(name).slice(0,12); const stats=logs.map(sessionStats);
    const latest=stats[0]||null, prior=stats[1]||null;
    let bestW=0,bestV=0,bestR=0,bestRir=null;
    stats.forEach(z=>{bestW=Math.max(bestW,z.maxWeight||0);bestV=Math.max(bestV,z.volume||0);bestR=Math.max(bestR,z.totalReps||0);if(z.avgRir!=null)bestRir=bestRir==null?z.avgRir:Math.min(bestRir,z.avgRir)});
    const goal=getGoal(name);
    const progress=goal&&latest?.maxWeight?Math.min(100,latest.maxWeight/Number(goal)*100):0;
    const trend=stats.slice(0,8).reverse(); const maxVol=Math.max(1,...trend.map(z=>z.volume||0));
    const bars=trend.map((z,i)=>`<div class="v93-bar-wrap" title="${escText(z.volume?Math.round(z.volume)+' kg':'Sin volumen')}"><span class="v93-bar" style="height:${Math.max(8,Math.round((z.volume||0)/maxVol*74))}px"></span><small>${i+1}</small></div>`).join('');
    const dVol=latest&&prior?latest.volume-prior.volume:null, dRep=latest&&prior?latest.totalReps-prior.totalReps:null, dW=latest&&prior?latest.maxWeight-prior.maxWeight:null;
    let rec='Mantené el rendimiento actual y buscá repetir la calidad de las series.';
    if(latest&&prior){
      if(dW>0 || dVol>0 || dRep>0) rec='📈 Hay progreso respecto a la sesión anterior. Priorizá consolidar este rendimiento antes de subir otra vez.';
      else if(dW<0 || dVol<0 || dRep<0) rec='🧠 El rendimiento bajó respecto a la sesión anterior. Podés priorizar recuperar las reps antes de aumentar el peso.';
      else if(latest.avgRir!=null && latest.avgRir<=1.5) rec='💡 El rendimiento fue estable con RIR relativamente bajo. Una próxima sesión puede centrarse en consolidar las reps.';
    }
    host.innerHTML=`
      <div class="v93-up-head"><div><strong>📈 Rendimiento y progresión</strong><span>Resumen histórico y objetivo para ${escText(name)}.</span></div></div>
      <div class="v93-up-grid">
        <div class="v93-up-card"><span>🏆 Peso máximo</span><strong>${Math.round(bestW*10)/10} kg</strong>${dW!=null?`<small>${escText(formatDelta(dW,' kg'))} vs anterior</small>`:''}</div>
        <div class="v93-up-card"><span>📦 Mejor volumen</span><strong>${Math.round(bestV*10)/10} kg</strong>${dVol!=null?`<small>${escText(formatDelta(dVol,' kg'))} vs anterior</small>`:''}</div>
        <div class="v93-up-card"><span>🔢 Más reps</span><strong>${bestR}</strong>${dRep!=null?`<small>${escText(formatDelta(dRep,' reps'))} vs anterior</small>`:''}</div>
        <div class="v93-up-card"><span>🎯 Objetivo de peso</span><strong>${goal?escText(goal)+' kg':'Sin objetivo'}</strong><small>${goal&&latest?.maxWeight?`${Math.round(progress)}% alcanzado`:'Guardá una meta opcional'}</small></div>
      </div>
      <div class="v93-up-lower">
        <div class="v93-up-card"><div class="v93-up-card-title">📊 Tendencia de volumen · últimas ${trend.length} sesiones</div><div class="v93-bars">${bars||'<span class="v93-muted">Todavía no hay suficientes registros.</span>'}</div></div>
        <div class="v93-up-card"><div class="v93-up-card-title">🎯 Objetivo</div><div class="v93-goal-row"><input id="v93GoalInput" type="number" min="0" step="0.5" inputmode="decimal" placeholder="Peso objetivo (kg)" value="${escText(goal)}"><button id="v93GoalSave" type="button">Guardar</button></div>${goal&&latest?.maxWeight?`<div class="v93-goal-bar"><span style="width:${progress}%"></span></div>`:''}<small class="v93-muted">La meta es local y no modifica tu rutina.</small></div>
      </div>
      <div class="v93-recommendation"><strong>${escText(rec)}</strong></div>`;
    q('v93GoalSave')?.addEventListener('click',()=>{setGoal(name,q('v93GoalInput')?.value||'');renderUpgrade();});
  }
  function createUpgradePanel(){
    if(q('v93TrainingUpgrade'))return q('v93TrainingUpgrade');
    const base=q('v92TrainingInsights'); if(!base)return null;
    const el=document.createElement('section');el.id='v93TrainingUpgrade';el.className='v93-training-upgrade';
    base.after(el);renderUpgrade();return el;
  }
  function renderFinishUpgrade(){
    const overlay=q('v48FinishOverlay'); if(!overlay||!overlay.classList.contains('show'))return;
    if(q('v93FinishUpgrade'))return;
    const cmp=q('v49Comparison'); if(!cmp)return;
    const rows=[...cmp.querySelectorAll('.v49-comparison-row')];
    const up=rows.filter(x=>x.classList.contains('up')).length,down=rows.filter(x=>x.classList.contains('down')).length,same=rows.filter(x=>x.classList.contains('same')).length;
    const box=document.createElement('div');box.id='v93FinishUpgrade';box.className='v93-finish-upgrade';
    let title='➡️ Sesión estable'; if(up>down)title='📈 Buena sesión'; else if(down>up)title='🧠 Sesión para consolidar';
    box.innerHTML=`<strong>${title}</strong><span>${up} mejoraron · ${same} se mantuvieron · ${down} bajaron.</span><small>Usá este resumen como referencia para la próxima sesión; no modifica automáticamente tus ejercicios.</small>`;
    cmp.after(box);
  }
  function upgradeSafe(){try{createUpgradePanel();renderUpgrade();renderFinishUpgrade()}catch(e){console.warn('V93 entrenamiento:',e)}}

  function safeRender(){try{if(!q('workoutPanel'))return;renderAll();upgradeSafe()}catch(e){console.warn('V93 entrenamiento:',e)}}
  let last=0;
  function throttled(){const now=Date.now();if(now-last<500)return;last=now;safeRender()}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(safeRender,900));
  window.addEventListener('online',()=>setTimeout(safeRender,700));
  setInterval(()=>{if(document.visibilityState==='visible')upgradeSafe()},2000);
  setInterval(()=>{if(document.visibilityState==='visible'&&q('workoutPanel')?.classList.contains('open'))safeRender()},20000);
  window.addEventListener('storage',e=>{if(e.key&&e.key.startsWith('agendaTraining'))throttled()});
})();
