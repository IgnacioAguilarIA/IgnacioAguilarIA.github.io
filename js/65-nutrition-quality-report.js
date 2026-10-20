(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const text=value=>String(value??'').trim();
  const labels={
    source_complete:'Campos principales presentes en la fuente; falta verificar contra el envase',
    user_verified:'Revisado por vos contra la etiqueta',
    manual_unverified:'Carga manual sin verificación registrada',
    incomplete:'Faltan nutrientes en la fuente',
    legacy_unverified:'Registro anterior no verificado'
  };
  const METRICS=[
    {key:'calories',foodColumn:'calories_per_100g',label:'Calorías kcal',aliases:['caloria','calorias','kcal','energia','energy'],upper:950},
    {key:'protein_g',foodColumn:'protein_per_100g',label:'Proteínas g',aliases:['proteina','proteinas','protein','proteins'],upper:100},
    {key:'carbs_g',foodColumn:'carbs_per_100g',label:'Carbohidratos g',aliases:['carbohidrato','carbohidratos','carbohydrate','carbohydrates','carbs'],upper:100},
    {key:'fat_g',foodColumn:'fat_per_100g',label:'Grasas g',aliases:['grasa','grasas','fat','fats'],upper:100},
    {key:'fiber_g',foodColumn:'fiber_per_100g',label:'Fibra g',aliases:['fibra','fibras','fiber','dietary fiber'],upper:100}
  ];
  const HISTORY_METRICS=METRICS.slice(0,4);
  const MEAL_CATEGORIES={
    breakfast:['breakfast','desayuno','desayunos'],
    media_manana:['media manana','media_manana','mid morning','mid_morning','morning snack'],
    pre:['pre','pre entrenamiento','pre-entrenamiento','pre_entrenamiento'],
    post:['post','post entrenamiento','post-entrenamiento','post_entrenamiento'],
    lunch:['lunch','almuerzo','almuerzos'],
    snack:['snack','merienda','meriendas'],
    dinner:['dinner','cena','cenas'],
    colacion:['colacion','colaciones','collation'],
    sleep:['sleep','antes de dormir','antes_de_dormir'],
  };
  let overlay=null,returnFocus=null,busy=false,report=null;
  function esc(value){const node=document.createElement('span');node.textContent=String(value??'');return node.innerHTML}
  function safeUrl(value){const url=text(value);return /^https?:\/\//i.test(url)?url:''}
  function csvCell(value){let s=String(value??'');if(/^[\u0000-\u0020]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  function qualityLabel(status){return labels[String(status||'legacy_unverified')]||labels.legacy_unverified}
  function statusCounts(foods){const out={source_complete:0,user_verified:0,manual_unverified:0,incomplete:0,legacy_unverified:0};for(const food of foods||[]){const key=labels[food.nutrition_quality_status]?food.nutrition_quality_status:'legacy_unverified';out[key]++;}return out}
  function isIsoDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;const [y,m,d]=value.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d}
  function shiftIsoDate(value,days){if(!isIsoDate(value))throw new Error('Fecha inválida.');const [y,m,d]=value.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d+days));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`}
  function todayLocalIso(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
  function defaultRange(date=new Date()){const to=todayLocalIso(date);return {from:shiftIsoDate(to,-29),to}}
  function validateDateRange(from,to,maxDays=366){if(!isIsoDate(from)||!isIsoDate(to))return {ok:false,error:'Elegí una fecha inicial y una fecha final válidas.'};if(from>to)return {ok:false,error:'La fecha inicial no puede ser posterior a la fecha final.'};const days=(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000+1;if(days>maxDays)return {ok:false,error:`El período no puede superar ${maxDays} días. Elegí un rango más corto.`};return {ok:true,days}}
  function previousPeriodRange(from,to){const valid=validateDateRange(from,to);if(!valid.ok)throw new Error(valid.error);const previousTo=shiftIsoDate(from,-1);return {from:shiftIsoDate(from,-valid.days),to:previousTo,days:valid.days}}
  function normaliseMissing(value){return String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
  function missingNames(row){const snap=row?.item_snapshot&&typeof row.item_snapshot==='object'?row.item_snapshot:{};const list=Array.isArray(row?.nutrition_missing_fields)?row.nutrition_missing_fields:Array.isArray(snap.nutrition_missing_fields)?snap.nutrition_missing_fields:Array.isArray(snap.nutritionMissing)?snap.nutritionMissing:[];return list.map(text).filter(Boolean)}
  function valueIsMissing(row,metric){const names=missingNames(row).map(normaliseMissing);return names.some(name=>metric.aliases.some(alias=>{const a=normaliseMissing(alias);return name===a||name.startsWith(a+' ')||name.includes(' '+a+' ')||name.endsWith(' '+a)}))}
  function metricValue(row,metric){const raw=row?.[metric.key];if(raw===null||raw===undefined||String(raw).trim()==='')return null;const value=Number(raw);if(!Number.isFinite(value)||valueIsMissing(row,metric))return null;return value}
  function sumMetric(rows,metric){if(!rows.length)return null;const values=rows.map(row=>metricValue(row,metric));if(values.some(value=>value===null))return null;return values.reduce((sum,value)=>sum+value,0)}
  function dailySummary(history,from,to){
    const validation=validateDateRange(from,to);if(!validation.ok)throw new Error(validation.error);
    const grouped=new Map();for(const row of history||[]){const date=String(row?.consumed_date||'').slice(0,10);if(!isIsoDate(date)||date<from||date>to)continue;if(!grouped.has(date))grouped.set(date,[]);grouped.get(date).push(row)}
    const result=[];for(let date=from;date<=to;date=shiftIsoDate(date,1)){
      const rows=grouped.get(date)||[];const missingCount=rows.filter(row=>HISTORY_METRICS.some(metric=>metricValue(row,metric)===null)||missingNames(row).length>0).length;
      const entry={date,status:rows.length?'Con registros':'Sin registros',records:rows.length,missingRecords:missingCount};
      for(const metric of HISTORY_METRICS)entry[metric.key]=sumMetric(rows,metric);
      result.push(entry);
    }
    return result;
  }
  function dailyOverview(days){const recorded=days.filter(day=>day.records>0);return {daysWithRecords:recorded.length,daysWithoutRecords:days.length-recorded.length,consumptionRecords:recorded.reduce((sum,day)=>sum+day.records,0),daysWithIncompleteNutrients:recorded.filter(day=>day.missingRecords>0).length}}
  function periodMetrics(days){
    const overview=dailyOverview(days||[]);const recorded=(days||[]).filter(day=>day.records>0);const metrics={};
    for(const metric of HISTORY_METRICS){const known=recorded.filter(day=>day[metric.key]!==null&&day[metric.key]!==undefined&&Number.isFinite(Number(day[metric.key])));const missingDays=recorded.length-known.length;const knownTotal=known.reduce((sum,day)=>sum+Number(day[metric.key]),0);metrics[metric.key]={total:recorded.length===0||missingDays>0?null:knownTotal,knownTotal:known.length?knownTotal:null,knownDays:known.length,missingDays,averageKnown:known.length?knownTotal/known.length:null};}
    return {...overview,metrics};
  }
  function comparePeriods(currentDays,previousDays){
    const current=periodMetrics(currentDays||[]),previous=periodMetrics(previousDays||[]);const metrics={};
    for(const metric of HISTORY_METRICS){const a=current.metrics[metric.key],b=previous.metrics[metric.key];const comparable=Number.isFinite(a.total)&&Number.isFinite(b.total);const delta=comparable?a.total-b.total:null;metrics[metric.key]={current:a,previous:b,comparable,delta,percent:comparable&&b.total!==0?(delta/b.total)*100:null};}
    return {current,previous,metrics};
  }
  function mealCategoryKey(value){const key=normaliseMissing(value).replace(/\s+/g,'_');if(!key)return 'other';for(const [canonical,aliases] of Object.entries(MEAL_CATEGORIES)){if(aliases.some(alias=>normaliseMissing(alias).replace(/\s+/g,'_')===key))return canonical;}return 'other'}
  function filterHistoryByMealType(history,mealType='all'){if(!mealType||mealType==='all')return (history||[]).slice();return (history||[]).filter(row=>mealCategoryKey(row?.meal_type)===mealType)}
  function fmtMetric(value){if(value===null||value===undefined||!Number.isFinite(Number(value)))return 'Sin dato';return new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(Number(value))}
  function dailyCsvRows(days){return (days||[]).map(day=>[day.date,day.status,day.records,day.calories===null?'':day.calories,day.protein_g===null?'':day.protein_g,day.carbs_g===null?'':day.carbs_g,day.fat_g===null?'':day.fat_g,day.missingRecords])}
  function historyRows(history){return (history||[]).map(row=>{
    const snap=row.item_snapshot&&typeof row.item_snapshot==='object'?row.item_snapshot:{};
    return [row.consumed_date,row.meal_title,row.meal_type,row.meal_time,row.food_name,row.brand,row.quantity,row.unit,row.calories,row.protein_g,row.carbs_g,row.fat_g,
      snap.data_source_label||snap.sourceLabel||snap.source||'Origen no registrado',snap.data_source_url||snap.sourceUrl||'',snap.nutrition_quality_status||snap.nutritionQualityStatus||'legacy_unverified',
      missingNames(row).join(', '),snap.preparation_state||'',snap.nutrition_verified_at||snap.nutritionVerifiedAt||'',row.meal_item_id,row.created_at];
  })}
  function foodRows(foods){return (foods||[]).map(row=>{const audit=auditFood(row);return [row.name,row.brand,row.source,row.external_id,row.data_source_label,row.data_source_url,row.nutrition_quality_status,Array.isArray(row.nutrition_missing_fields)?row.nutrition_missing_fields.join(', '):'',row.calories_per_100g,row.protein_per_100g,row.carbs_per_100g,row.fat_per_100g,row.fiber_per_100g,row.nutrition_verified_at,row.updated_at,audit.issues.length,audit.issues.map(issue=>issue.title).join(' | ')];})}
  function auditFood(food,now=new Date()){
    const issues=[];const add=(code,severity,title,detail)=>issues.push({code,severity,title,detail});const sourceStatus=labels[food?.nutrition_quality_status]?food.nutrition_quality_status:'legacy_unverified';
    const declared=Array.isArray(food?.nutrition_missing_fields)?food.nutrition_missing_fields.map(text).filter(Boolean):[];
    const values=METRICS.map(metric=>({metric,value:(()=>{const raw=food?.[metric.foodColumn];if(raw===null||raw===undefined||String(raw).trim()==='')return null;const n=Number(raw);return Number.isFinite(n)?n:null})()}));
    const undeclaredMissing=values.filter(({metric,value})=>value===null&&!declared.some(name=>{const normalized=normaliseMissing(name);return metric.aliases.some(alias=>{const a=normaliseMissing(alias);return normalized===a||normalized.startsWith(a+' ')||normalized.includes(' '+a+' ')||normalized.endsWith(' '+a)})}));
    if(declared.length)add('nutrients_declared_missing','warning','Nutrientes incompletos',`La fuente indica datos faltantes: ${declared.join(', ')}. Los valores desconocidos no se interpretan como cero.`);
    if(undeclaredMissing.length)add('nutrients_missing_unmarked','warning','Campos nutricionales sin declarar como faltantes',`No hay valor numérico para: ${undeclaredMissing.map(x=>x.metric.label).join(', ')}. Verificá si corresponde registrar esos nutrientes como faltantes.`);
    for(const {metric,value} of values){if(value===null)continue;if(value<0)add('negative_'+metric.key,'error',`Valor negativo en ${metric.label}`,`El valor almacenado es ${value} por 100 g. Revisá la unidad o la carga; el informe no modifica ni elimina el dato.`);else if(value>metric.upper)add('high_'+metric.key,'warning',`Valor inusualmente alto en ${metric.label}`,`Se registraron ${value} por 100 g, por encima del umbral orientativo de ${metric.upper}. Puede ser válido por una unidad o una fuente particular, así que requiere revisión manual.`)}
    const present=new Set(values.filter(x=>x.value!==null).map(x=>x.metric.key));
    if(['calories','protein_g','carbs_g','fat_g'].every(key=>present.has(key))){const v=Object.fromEntries(values.map(x=>[x.metric.key,x.value]));if(v.protein_g>=0&&v.carbs_g>=0&&v.fat_g>=0&&v.calories>=0){const estimated=v.protein_g*4+v.carbs_g*4+v.fat_g*9;const tolerance=Math.max(60,Math.max(estimated,v.calories)*0.35);if(Math.abs(estimated-v.calories)>tolerance)add('energy_macro_mismatch','warning','Energía y macronutrientes no parecen concordar',`La energía registrada es ${v.calories} kcal/100 g; una estimación sencilla de proteínas, carbohidratos y grasas es ${Math.round(estimated)} kcal/100 g. La diferencia puede deberse a fibra, alcoholes, redondeo o criterios de etiquetado; no es una prueba concluyente.`)}}
    if(sourceStatus==='source_complete'&&declared.length)add('source_status_conflict','warning','Estado de calidad contradictorio','El alimento está marcado como fuente completa, pero también declara nutrientes faltantes. Revisá su estado, sin descartar valores conocidos.');
    if(sourceStatus==='user_verified'&&declared.length)add('verified_missing_conflict','warning','Verificación con datos faltantes','El alimento figura revisado, aunque todavía declara nutrientes faltantes.');
    if(sourceStatus==='incomplete'&&!declared.length&&!undeclaredMissing.length)add('incomplete_without_details','warning','Estado incompleto sin detalle','El registro está marcado como incompleto, pero no declara qué nutrientes faltan. Revisá la trazabilidad del dato.');
    if(sourceStatus==='user_verified'&&!food?.nutrition_verified_at)add('verification_date_missing','warning','Verificación sin fecha','El registro está marcado como revisado, pero no conserva la fecha de esa confirmación.');
    const sourceCode=normaliseMissing(food?.source);const genericSource=['','external','unknown','other','manual','user','source'].includes(sourceCode);
    if(!text(food?.data_source_label)&&!safeUrl(food?.data_source_url)&&(genericSource||!sourceCode))add('source_missing','warning','Procedencia no identificada','No hay una etiqueta de origen ni una URL reconocible. No es posible saber a partir de este registro de dónde proceden los valores.');
    if(food?.nutrition_verified_at){const stamp=Date.parse(food.nutrition_verified_at);if(!Number.isFinite(stamp))add('verification_date_invalid','warning','Fecha de verificación inválida','La fecha guardada no se pudo interpretar.');else if(stamp>now.getTime()+86400000)add('verification_date_future','warning','Fecha de verificación futura','La fecha de revisión es posterior a la fecha actual.');else if(now.getTime()-stamp>730*86400000)add('verification_date_old','info','Verificación antigua','La confirmación registrada tiene más de dos años. Conviene revisar si el envase o la formulación siguen siendo iguales.');}
    return {foodId:food?.id??null,name:text(food?.name)||'Alimento sin nombre',brand:text(food?.brand),status:sourceStatus,source:text(food?.data_source_label||food?.source)||'Origen no registrado',verifiedAt:food?.nutrition_verified_at||null,issues};
  }
  function qualityAudit(foods,now=new Date()){
    const items=(foods||[]).map(food=>auditFood(food,now));const flagged=items.filter(item=>item.issues.length>0);let errors=0,warnings=0,info=0;for(const item of flagged)for(const issue of item.issues){if(issue.severity==='error')errors++;else if(issue.severity==='info')info++;else warnings++;}
    return {foodCount:items.length,flaggedFoods:flagged.length,cleanFoods:items.length-flagged.length,errors,warnings,info,items};
  }
  function auditCsvRows(foods,now=new Date()){
    const rows=[];for(const food of foods||[]){const item=auditFood(food,now);if(!item.issues.length){rows.push([item.foodId,item.name,item.brand,item.status,item.source,'sin_alertas','Sin alertas detectadas','Los valores superaron las reglas orientativas de esta revisión. Esto no certifica su exactitud.',item.verifiedAt||'']);continue;}for(const issue of item.issues)rows.push([item.foodId,item.name,item.brand,item.status,item.source,issue.severity,issue.title,issue.detail,item.verifiedAt||'']);}return rows;
  }
  function downloadCsv(filename,headers,rows){
    const content='\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');
    const blob=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function statusCountsHtml(counts){return Object.entries(counts).map(([key,count])=>`<div class="nutrition-quality-count"><span>${esc(qualityLabel(key))}</span><strong>${count}</strong></div>`).join('')}
  function renderDailySummary(){
    const body=$('nutritionQualityDailyRows');const overviewNode=$('nutritionQualityDailyOverview');if(!body||!overviewNode)return;
    const days=report?.dailySummary||[];const overview=dailyOverview(days);const category=mealCategoryLabel(report?.mealType||'all');
    overviewNode.textContent=`Período: ${days[0]?.date||'—'} a ${days.at(-1)?.date||'—'} · Categoría: ${category}. ${overview.daysWithRecords} día(s) con registros, ${overview.daysWithoutRecords} sin registros, ${overview.consumptionRecords} consumo(s) y ${overview.daysWithIncompleteNutrients} día(s) con nutrientes incompletos. Los días sin registros no se cuentan como cero.`;
    body.innerHTML=days.map(day=>`<tr><td>${esc(day.date)}</td><td>${esc(day.status)}</td><td>${day.records}</td><td>${day.records?esc(fmtMetric(day.calories)): '—'}</td><td>${day.records?esc(fmtMetric(day.protein_g)):'—'}</td><td>${day.records?esc(fmtMetric(day.carbs_g)):'—'}</td><td>${day.records?esc(fmtMetric(day.fat_g)):'—'}</td><td>${day.missingRecords}</td></tr>`).join('');
  }
  function mealCategoryLabel(key){const labels={all:'Todas',breakfast:'Desayuno',media_manana:'Media mañana',pre:'Pre entrenamiento',post:'Post entrenamiento',lunch:'Almuerzo',snack:'Merienda',dinner:'Cena',colacion:'Colación',sleep:'Antes de dormir',other:'Otra / sin categoría'};return labels[key]||labels.all}
  function periodValue(metric){if(metric.total!==null&&metric.total!==undefined)return fmtMetric(metric.total);if(metric.knownTotal!==null&&metric.knownTotal!==undefined)return `Parcial: ${fmtMetric(metric.knownTotal)}`;return 'Sin dato'}
  function renderComparison(){
    const body=$('nutritionQualityComparison');const overview=$('nutritionQualityComparisonOverview');if(!body||!overview)return;
    const comparison=report?.comparison;if(!comparison){body.innerHTML='';overview.textContent=report?.comparisonError?'No se pudo cargar el período anterior. El informe actual sigue disponible; recargá para reintentar la comparación.':'Todavía no hay comparación.';return;}
    const curRange=report.historyRange||{};const prev=report.previousRange||{};const c=comparison.current,p=comparison.previous;
    overview.textContent=`Período actual ${curRange.from} a ${curRange.to}: ${c.daysWithRecords} día(s) con registros y ${c.daysWithoutRecords} sin registros. Período anterior equivalente ${prev.from} a ${prev.to}: ${p.daysWithRecords} día(s) con registros y ${p.daysWithoutRecords} sin registros. La suma se marca como parcial si uno o más días registrados no tienen el nutriente completo.`;
    body.innerHTML=HISTORY_METRICS.map(metric=>{const v=comparison.metrics[metric.key];const current=periodValue(v.current),previous=periodValue(v.previous);let delta='No comparable';if(v.comparable)delta=`${v.delta>0?'+':''}${fmtMetric(v.delta)}${v.percent===null?'':` (${v.percent>0?'+':''}${fmtMetric(v.percent)}%)`}`;const curAvg=v.current.averageKnown===null?'Sin dato':`${fmtMetric(v.current.averageKnown)} (${v.current.knownDays} días con dato)`;const prevAvg=v.previous.averageKnown===null?'Sin dato':`${fmtMetric(v.previous.averageKnown)} (${v.previous.knownDays} días con dato)`;return `<article class="nutrition-quality-comparison-card"><h4>${esc(metric.label)}</h4><dl><div><dt>Total actual</dt><dd>${esc(current)}</dd></div><div><dt>Total anterior</dt><dd>${esc(previous)}</dd></div><div><dt>Diferencia total</dt><dd>${esc(delta)}</dd></div><div><dt>Promedio actual</dt><dd>${esc(curAvg)}</dd></div><div><dt>Promedio anterior</dt><dd>${esc(prevAvg)}</dd></div></dl></article>`}).join('');
  }
  function renderAudit(){
    const overview=$('nutritionQualityAuditOverview'),list=$('nutritionQualityAuditRows');if(!overview||!list)return;const audit=report?.qualityAudit||qualityAudit(report?.foods||[]);
    overview.textContent=`Se revisaron ${audit.foodCount} alimento(s): ${audit.flaggedFoods} requieren atención, ${audit.cleanFoods} no activaron estas reglas; ${audit.errors} alerta(s) de valor negativo, ${audit.warnings} advertencia(s) y ${audit.info} aviso(s) informativo(s). Las reglas son orientativas y no corrigen ni eliminan datos.`;
    if(!audit.flaggedFoods){list.innerHTML='<div class="nutrition-quality-empty">No se detectaron alertas con las reglas automáticas actuales. Esto no significa que los datos estén certificados o sean necesariamente exactos.</div>';return;}
    const entries=[];for(const item of audit.items){for(const issue of item.issues)entries.push({item,issue});}
    const visible=entries.slice(0,150);list.innerHTML=visible.map(({item,issue})=>`<article class="nutrition-quality-audit-item severity-${esc(issue.severity)}"><div><strong>${esc(item.name)}</strong><span>${esc(issue.title)}</span><p>${esc(issue.detail)}</p><small>${esc(item.source)} · Estado: ${esc(qualityLabel(item.status))}${item.verifiedAt?` · Revisado: ${esc(String(item.verifiedAt).slice(0,10))}`:''}</small></div><span class="nutrition-quality-audit-severity">${issue.severity==='error'?'Revisar valor':issue.severity==='info'?'Informativo':'Revisar'}</span></article>`).join('');
    if(entries.length>visible.length){const note=document.createElement('p');note.className='nutrition-quality-note';note.textContent=`Se muestran ${visible.length} de ${entries.length} alertas. La exportación incluye todas.`;list.appendChild(note);}
  }
  function render(){
    if(!overlay||!report)return;
    const foods=report.foods||[];const history=report.filteredHistory||[];const counts=statusCounts(foods);const status=$('nutritionQualityStatus');const list=$('nutritionQualityFoods');
    const range=report.historyRange||{};const from=range.from||$('nutritionQualityFrom').value;const to=range.to||$('nutritionQualityTo').value;
    status.textContent=`Se revisaron ${foods.length} alimento(s) propio(s) y ${history.length} consumo(s) entre ${from} y ${to}. Categoría: ${mealCategoryLabel(report.mealType||'all')}. Los registros anteriores sin procedencia conservan el estado no verificado.`;
    $('nutritionQualityCounts').innerHTML=statusCountsHtml(counts);
    $('nutritionQualityExportHistory').disabled=!history.length||busy;
    $('nutritionQualityExportFoods').disabled=!foods.length||busy;
    $('nutritionQualityExportDaily').disabled=busy||!(report.dailySummary||[]).length;
    $('nutritionQualityExportAudit').disabled=!foods.length||busy;
    renderDailySummary();renderComparison();renderAudit();
    if(!foods.length){list.innerHTML='<div class="nutrition-quality-empty">Todavía no hay alimentos propios guardados. Los registros del catálogo externo se identifican al seleccionarlos y quedan trazados cuando se usan en una comida.</div>';return;}
    const visible=foods.slice(0,120);
    list.innerHTML=visible.map(food=>{
      const statusKey=labels[food.nutrition_quality_status]?food.nutrition_quality_status:'legacy_unverified';
      const missing=Array.isArray(food.nutrition_missing_fields)?food.nutrition_missing_fields:[];
      const sourceUrl=safeUrl(food.data_source_url);const audit=auditFood(food);
      const canVerify=statusKey!=='user_verified'&&missing.length===0;
      const verifyDate=food.nutrition_verified_at?` · Revisado: ${String(food.nutrition_verified_at).slice(0,10)}`:'';
      const alertLine=audit.issues.length?` · ${audit.issues.length} alerta(s) orientativa(s)`:' · Sin alertas de reglas';
      return `<article class="nutrition-quality-food" data-quality-food="${esc(food.id)}"><div class="nutrition-quality-food-main"><strong>${esc(food.name||'Alimento')}</strong><span>${esc(food.brand||'Sin marca')} · ${esc(food.data_source_label||food.source||'Origen no registrado')}</span><small>${esc(qualityLabel(statusKey))}${missing.length?` · Faltan: ${esc(missing.join(', '))}`:''}${esc(verifyDate+alertLine)}</small>${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente original ↗</a>`:''}</div><div class="nutrition-quality-food-actions">${statusKey==='user_verified'?'<span class="nutrition-quality-verified">✓ Verificación registrada</span>':canVerify?`<button type="button" class="small-btn nutrition-quality-verify" data-verify-food="${esc(food.id)}">Confirmé la etiqueta</button>`:'<span class="nutrition-quality-needs-data">Completar datos primero</span>'}</div></article>`;
    }).join('');
    if(foods.length>visible.length){const note=document.createElement('p');note.className='nutrition-quality-note';note.textContent=`Se muestran ${visible.length} de ${foods.length} alimentos. La exportación incluye todos los registros.`;list.appendChild(note);}
  }
  function deriveReport(){if(!report)return;const type=$('nutritionQualityMealType')?.value||'all';report.mealType=type;report.filteredHistory=filterHistoryByMealType(report.history||[],type);const {from,to}=report.historyRange||{};report.dailySummary=dailySummary(report.filteredHistory,from,to);report.dailyOverview=dailyOverview(report.dailySummary);const prior=filterHistoryByMealType(report.previousHistory||[],type);report.previousDailySummary=report.previousRange?dailySummary(prior,report.previousRange.from,report.previousRange.to):[];report.comparison=report.previousRange&&!report.comparisonError?comparePeriods(report.dailySummary,report.previousDailySummary):null;report.qualityAudit=qualityAudit(report.foods||[]);}
  function close(){if(!overlay)return;document.removeEventListener('keydown',onKeyDown);overlay.remove();overlay=null;report=null;busy=false;returnFocus?.focus?.();returnFocus=null;}
  function onKeyDown(event){if(event.key==='Escape'){event.preventDefault();close();return}if(event.key!=='Tab'||!overlay)return;const nodes=[...overlay.querySelectorAll('button:not([disabled]),a[href],select,input,textarea,[tabindex]:not([tabindex="-1"])')].filter(n=>!n.hidden);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  async function refresh(){
    if(busy)return;const from=$('nutritionQualityFrom')?.value||'',to=$('nutritionQualityTo')?.value||'';const valid=validateDateRange(from,to);if(!valid.ok){report=null;clearReportView();renderButtons();setStatus(valid.error);return}
    busy=true;report=null;clearReportView();renderButtons();setStatus('Consultando alimentos, historial y período anterior equivalente…');
    try{
      const api=window.AgendaNutritionData;if(!api?.loadNutritionQualityReport)throw new Error('No está disponible el módulo de datos nutricionales. Recargá la aplicación.');
      const current=await api.loadNutritionQualityReport({from,to});const priorRange=previousPeriodRange(from,to);let previous=null,comparisonError='';
      try{previous=await api.loadNutritionQualityReport({from:priorRange.from,to:priorRange.to,includeFoods:false});}catch(error){comparisonError=error?.message||'Error no especificado';}
      report={...current,previousRange:priorRange,previousHistory:previous?.history||[],comparisonError};deriveReport();render();
      if(comparisonError)setStatus(`El informe actual se cargó, pero no se pudo recuperar el período anterior para comparar. ${comparisonError}`);
    }catch(error){report=null;setStatus(`No se pudo completar el informe. Comprobá la conexión y que hayas ejecutado sql/21-nutrition-quality-provenance.sql. ${error?.message||''}`);}
    finally{busy=false;if(overlay)renderButtons();}
  }
  function rangeMatchesReport(){return !!report&&report.historyRange?.from===$('nutritionQualityFrom')?.value&&report.historyRange?.to===$('nutritionQualityTo')?.value&&report.mealType===($('nutritionQualityMealType')?.value||'all')}
  function renderButtons(){if(!$('nutritionQualityReload'))return;const matches=rangeMatchesReport();$('nutritionQualityReload').disabled=busy;$('nutritionQualityFrom').disabled=busy;$('nutritionQualityTo').disabled=busy;$('nutritionQualityMealType').disabled=busy;$('nutritionQualityExportHistory').disabled=busy||!matches||!report?.history?.length||!report?.filteredHistory?.length;$('nutritionQualityExportFoods').disabled=busy||!report?.foods?.length;$('nutritionQualityExportDaily').disabled=busy||!matches||!(report?.dailySummary?.length);$('nutritionQualityExportAudit').disabled=busy||!report?.foods?.length;}
  function clearReportView(){for(const id of ['nutritionQualityCounts','nutritionQualityFoods','nutritionQualityDailyRows','nutritionQualityComparison','nutritionQualityAuditRows'])if($(id))$(id).replaceChildren();for(const id of ['nutritionQualityDailyOverview','nutritionQualityComparisonOverview','nutritionQualityAuditOverview'])if($(id))$(id).textContent='';}
  function setStatus(message){const node=$('nutritionQualityStatus');if(node)node.textContent=message||''}
  async function verifyFood(id){
    if(busy)return;const food=report?.foods?.find(x=>String(x.id)===String(id));if(!food)return;
    if(!confirm(`¿Confirmás que revisaste la etiqueta o una fuente fiable y verificaste los valores nutricionales de «${food.name}»? Esta acción registra tu confirmación; no certifica el producto de forma independiente.`))return;
    const previousReport=report;const range={from:report?.historyRange?.from,to:report?.historyRange?.to};busy=true;renderButtons();setStatus(`Guardando la verificación de «${food.name}»…`);
    try{
      await window.AgendaNutritionData.markUserFoodVerified(id);
      try{const now=await window.AgendaNutritionData.loadNutritionQualityReport(range);report={...previousReport,...now,previousRange:previousReport.previousRange,previousHistory:previousReport.previousHistory,comparisonError:previousReport.comparisonError};deriveReport();render();setStatus(`Se registró la revisión de «${food.name}» y se actualizó el informe.`);}
      catch(reloadError){report=previousReport;setStatus(`La revisión de «${food.name}» se guardó correctamente, pero no se pudo actualizar el informe. Recargá el panel para ver el estado nuevo. ${reloadError?.message||''}`);}
    }catch(error){report=previousReport;setStatus(`No se pudo registrar la verificación: ${error?.message||'error inesperado'}`);}
    finally{busy=false;renderButtons();}
  }
  function bindModal(){
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    $('nutritionQualityClose').addEventListener('click',close);
    $('nutritionQualityReload').addEventListener('click',refresh);
    for(const id of ['nutritionQualityFrom','nutritionQualityTo'])$(id).addEventListener('change',()=>{renderButtons();if(report&&!rangeMatchesReport())setStatus('Cambiaste el período o la categoría. Aplicá los filtros antes de exportar el historial o el resumen diario.');});
    $('nutritionQualityMealType').addEventListener('change',()=>{if(!report)return;if($('nutritionQualityFrom').value!==report.historyRange?.from||$('nutritionQualityTo').value!==report.historyRange?.to){renderButtons();setStatus('Primero aplicá el período seleccionado; después podrás filtrar la categoría.');return;}deriveReport();render();renderButtons();setStatus(`Filtro aplicado: ${mealCategoryLabel(report.mealType)}.`);});
    const exportRange=()=>`${$('nutritionQualityFrom').value}-a-${$('nutritionQualityTo').value}`;const exportCategory=()=>($('nutritionQualityMealType').value||'all');
    $('nutritionQualityExportHistory').addEventListener('click',()=>{if(!report?.filteredHistory?.length||!rangeMatchesReport())return;downloadCsv(`agenda-fich-historial-nutricional-${exportRange()}-${exportCategory()}.csv`,['Fecha local','Comida','Categoría','Horario','Alimento','Marca','Cantidad','Unidad','Calorías kcal','Proteínas g','Carbohidratos g','Grasas g','Procedencia','URL de origen','Estado de calidad','Nutrientes faltantes','Preparación','Verificado el','ID del consumo','Registro creado'],historyRows(report.filteredHistory));setStatus(`Historial exportado para ${exportRange()} y categoría ${mealCategoryLabel(report.mealType)}.`);});
    $('nutritionQualityExportFoods').addEventListener('click',()=>{if(!report?.foods?.length)return;downloadCsv(`agenda-fich-alimentos-procedencia-${todayLocalIso()}.csv`,['Alimento','Marca','Fuente interna','ID externo','Procedencia visible','URL de origen','Estado de calidad','Nutrientes faltantes','kcal/100g','Proteínas g/100g','Carbohidratos g/100g','Grasas g/100g','Fibra g/100g','Verificado el','Actualizado el','Cantidad de alertas orientativas','Alertas'],foodRows(report.foods));setStatus('Informe de alimentos preparado. Las alertas son orientativas y no se modificaron los datos.');});
    $('nutritionQualityExportDaily').addEventListener('click',()=>{if(!report?.dailySummary?.length||!rangeMatchesReport())return;downloadCsv(`agenda-fich-resumen-diario-${exportRange()}-${exportCategory()}.csv`,['Fecha local','Estado del día','Cantidad de consumos','Calorías kcal','Proteínas g','Carbohidratos g','Grasas g','Registros con nutrientes incompletos'],dailyCsvRows(report.dailySummary));setStatus('Resumen diario exportado. Los días sin registros se distinguen de los días registrados con valores cero.');});
    $('nutritionQualityExportAudit').addEventListener('click',()=>{if(!report?.foods?.length)return;downloadCsv(`agenda-fich-auditoria-calidad-${todayLocalIso()}.csv`,['ID alimento','Alimento','Marca','Estado de calidad','Procedencia','Severidad','Hallazgo','Detalle y limitación','Verificado el'],auditCsvRows(report.foods));setStatus('Auditoría nutricional exportada. Revisá cada alerta manualmente; no hubo correcciones automáticas.');});
    $('nutritionQualityFoods').addEventListener('click',event=>{const button=event.target.closest('[data-verify-food]');if(button)verifyFood(button.dataset.verifyFood);});
    document.addEventListener('keydown',onKeyDown);
  }
  function open(){
    if(overlay)close();returnFocus=document.activeElement;const range=defaultRange();
    overlay=document.createElement('div');overlay.className='nutrition-quality-overlay';overlay.id='nutritionQualityOverlay';overlay.innerHTML=`<section class="nutrition-quality-dialog" role="dialog" aria-modal="true" aria-labelledby="nutritionQualityTitle" aria-describedby="nutritionQualityIntro"><header class="nutrition-quality-head"><div><h2 id="nutritionQualityTitle">Calidad, historial y exportación</h2><p id="nutritionQualityIntro">Revisá la procedencia de tus alimentos, detectá inconsistencias para revisión manual y compará períodos equivalentes. Las alertas son orientativas: no eliminan ni corrigen datos.</p></div><button type="button" id="nutritionQualityClose" class="nutrition-quality-close" aria-label="Cerrar informe">×</button></header><div class="nutrition-quality-filters"><label>Desde<input type="date" id="nutritionQualityFrom" value="${range.from}" required></label><label>Hasta<input type="date" id="nutritionQualityTo" value="${range.to}" required></label><label>Categoría<select id="nutritionQualityMealType"><option value="all">Todas las comidas</option><option value="breakfast">Desayuno</option><option value="media_manana">Media mañana</option><option value="pre">Pre entrenamiento</option><option value="post">Post entrenamiento</option><option value="lunch">Almuerzo</option><option value="snack">Merienda</option><option value="dinner">Cena</option><option value="colacion">Colación</option><option value="sleep">Antes de dormir</option><option value="other">Otra / sin categoría</option></select></label><button type="button" id="nutritionQualityReload" class="small-btn">Aplicar período</button></div><div class="nutrition-quality-toolbar"><button type="button" id="nutritionQualityExportFoods" class="small-btn">Exportar alimentos CSV</button><button type="button" id="nutritionQualityExportHistory" class="small-btn">Exportar historial CSV</button><button type="button" id="nutritionQualityExportDaily" class="small-btn">Exportar resumen diario</button><button type="button" id="nutritionQualityExportAudit" class="small-btn">Exportar auditoría CSV</button></div><p id="nutritionQualityStatus" class="nutrition-quality-status" role="status" aria-live="polite">Preparando informe…</p><div id="nutritionQualityCounts" class="nutrition-quality-counts"></div><section class="nutrition-quality-audit"><header><h3>Auditoría orientativa de calidad nutricional</h3><p id="nutritionQualityAuditOverview" class="nutrition-quality-note"></p></header><div id="nutritionQualityAuditRows" class="nutrition-quality-audit-list"></div></section><section class="nutrition-quality-comparison"><h3>Comparación con el período anterior equivalente</h3><p id="nutritionQualityComparisonOverview" class="nutrition-quality-note"></p><div id="nutritionQualityComparison" class="nutrition-quality-comparison-grid"></div></section><section class="nutrition-quality-daily"><h3>Resumen diario</h3><p id="nutritionQualityDailyOverview" class="nutrition-quality-note"></p><div class="nutrition-quality-table-wrap"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Registros</th><th>kcal</th><th>Proteínas</th><th>Carbohidratos</th><th>Grasas</th><th>Incompletos</th></tr></thead><tbody id="nutritionQualityDailyRows"></tbody></table></div></section><div class="nutrition-quality-list-head"><h3>Mis alimentos</h3><p>«Confirmé la etiqueta» guarda tu confirmación, no una certificación independiente.</p></div><div id="nutritionQualityFoods" class="nutrition-quality-food-list"></div><footer class="nutrition-quality-footer">Los registros antiguos quedan como no verificados cuando no existe información suficiente. Un valor cero se conserva como cero, pero la aplicación no afirma que fuera comprobado si no hay constancia. La comparación de períodos solo calcula diferencias cuando los totales de ambos períodos están completos.</footer></section>`;
    document.body.appendChild(overlay);bindModal();refresh();$('nutritionQualityClose').focus();
  }
  function install(){const historyButton=$('nutritionHistoryBtn');if(!historyButton||$('nutritionQualityOpen'))return;const button=document.createElement('button');button.type='button';button.id='nutritionQualityOpen';button.className='small-btn nutrition-history-btn nutrition-quality-open';button.textContent='🔎 Calidad y exportar';button.addEventListener('click',open);historyButton.insertAdjacentElement('afterend',button);}
  window.AgendaNutritionQualityReports={csvCell,qualityLabel,statusCounts,historyRows,foodRows,isIsoDate,shiftIsoDate,defaultRange,validateDateRange,previousPeriodRange,dailySummary,dailyOverview,periodMetrics,comparePeriods,mealCategoryKey,filterHistoryByMealType,auditFood,qualityAudit,auditCsvRows,dailyCsvRows,open,load:(options)=>window.AgendaNutritionData?.loadNutritionQualityReport?.(options),rangeMatchesReport};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
