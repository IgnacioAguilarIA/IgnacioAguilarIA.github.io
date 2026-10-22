(function(){
  'use strict';
  const DAY_NAMES=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const MEALS=[['desayuno','Desayuno'],['media_manana','Media mañana'],['almuerzo','Almuerzo'],['merienda','Merienda'],['cena','Cena'],['colacion','Colación']];
  const $=id=>document.getElementById(id);
  let modal=null, activeWeek='', rows=[], templates=[], templateItems=new Map(), recipes=[], weeklyTemplates=[], weeklyTemplatesRevision='', weeklyTemplatesLoaded=false, busy=false, token=0, editRow=null, duplicateSourceRow=null, authReloadPending=false, draftKey='';
  const duplicateOperationKeys=new Map();
  const clean=v=>String(v??'').trim();
  const normalize=v=>clean(v).toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  function uid(){try{return typeof currentUser!=='undefined'&&currentUser?.id?String(currentUser.id):String(window.currentUser?.id||'')}catch(_){return String(window.currentUser?.id||'')}}
  function assertOwner(who){if(!who||uid()!==who)throw new Error('La cuenta activa cambió. La operación se canceló para evitar mezclar datos entre cuentas.')}
  async function getClient(){if(typeof ensureSupabase!=='function')throw new Error('Supabase no está disponible. Revisá la conexión e intentá de nuevo.');return ensureSupabase()}
  function strictIso(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!m)return null;const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return null;return String(value)}
  function addDays(iso,n){const [y,m,d]=iso.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d+n));return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`}
  function mondayIso(value){const iso=strictIso(value);if(!iso)throw new Error('Elegí una fecha válida para la semana.');const [y,m,d]=iso.split('-').map(Number);const weekday=new Date(Date.UTC(y,m-1,d)).getUTCDay();return addDays(iso,-((weekday+6)%7))}
  function currentMonday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));return mondayIso(`${o.year}-${o.month}-${o.day}`)}
  function id(){try{return crypto.randomUUID()}catch(_){return `${Date.now()}-${Math.random().toString(16).slice(2)}`}}
  function sourcePlanKey(sourceId,day,mealType,time){return `template:${String(sourceId)}:${Number(day)}:${String(mealType)}:${String(time||'no-time')}`}
  function status(msg,type='info'){if(!modal?.status)return;modal.status.textContent=msg;modal.status.dataset.state=type;modal.status.hidden=!msg;if(modal.postApplyShoppingHandoff){modal.postApplyShoppingHandoff.hidden=true;modal.postApplyShoppingWeek=''}}
  function safeNum(v){if(v===null||v===undefined||clean(v)==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
  function cloneJson(value,fallback){try{return value===undefined||value===null?fallback:JSON.parse(JSON.stringify(value))}catch(_){return fallback}}
  function nextSortOrder(day){const values=rows.filter(row=>Number(row.day_offset)===Number(day)).map(row=>safeNum(row.sort_order)).filter(v=>v!==null);return values.length?Math.max(...values)+1:0}
  function nutritionSummary(snapshot){
    const data=snapshot&&typeof snapshot==='object'?snapshot:{};
    const missing=new Set((Array.isArray(data.nutrition_missing_metrics)?data.nutrition_missing_metrics:[]).map(v=>String(v).toLowerCase()));
    const metrics=[['calories','calories','kcal'],['protein_g','protein','g prot.'],['carbs_g','carbs','g carb.'],['fat_g','fat','g grasas'],['fiber_g','fiber','g fibra']];
    const parts=[];
    for(const [field,metric,unit] of metrics){if(missing.has(metric)||missing.has(field))continue;const value=safeNum(data[field]);if(value===null)continue;const rounded=Math.round((value+Number.EPSILON)*10)/10;parts.push(`${rounded} ${unit}`)}
    return parts.length?parts.join(' · '):'';
  }
  function duplicatePlanPayload(row,targetDay,week,who,planKey,sortOrder,updatedAt=new Date().toISOString()){
    assertOwner(who);
    const day=Number(targetDay);
    if(!row||!clean(row.id)||clean(row.user_id)!==String(who)||clean(row.week_start)!==String(week))throw new Error('La comida no pertenece a la cuenta y semana activas. No se creó la copia.');
    if(!Number.isInteger(day)||day<0||day>6)throw new Error('Elegí un día de destino válido.');
    if(!clean(planKey))throw new Error('No se pudo crear una clave segura para la copia.');
    const title=(clean(row.title)||'Comida sin nombre');
    return {user_id:String(who),week_start:String(week),day_offset:day,meal_type:MEALS.some(x=>x[0]===row.meal_type)?row.meal_type:'colacion',title:(title.endsWith(' (copia)')?title:`${title} (copia)`).slice(0,160),planned_time:/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(row.planned_time))?clean(row.planned_time):null,notes:clean(row.notes).slice(0,2000),source_meal_id:null,plan_key:String(planKey),sort_order:Number.isFinite(Number(sortOrder))?Number(sortOrder):0,ingredients_snapshot:(Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot.filter(item=>item&&clean(item.name)).map(item=>cloneJson(item,{})):[]),nutrition_snapshot:cloneJson(row.nutrition_snapshot,{}),updated_at:updatedAt};
  }
  function orderedDayRows(planRows,day){
    return (Array.isArray(planRows)?planRows:[]).filter(row=>Number(row.day_offset)===Number(day)).slice().sort((a,b)=>String(a.planned_time||'99:99').localeCompare(String(b.planned_time||'99:99'))||Number(a.sort_order)-Number(b.sort_order)||String(a.id).localeCompare(String(b.id)));
  }
  function dayRowsSignature(planRows,day){
    const fields=['id','user_id','week_start','day_offset','meal_type','title','planned_time','notes','source_meal_id','plan_key','sort_order','updated_at','ingredients_snapshot','nutrition_snapshot'];
    return JSON.stringify(orderedDayRows(planRows,day).map(row=>{
      const out={};for(const field of fields)out[field]=row[field]===undefined?null:row[field];return out;
    }).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
  }
  function dayCopyStats(sourceRows){
    const source=Array.isArray(sourceRows)?sourceRows:[];let ingredients=0,unknownQuantities=0,incompleteNutrition=0;
    for(const row of source){const items=Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot:[];ingredients+=items.filter(item=>item&&clean(item.name)).length;for(const item of items){if(item&&clean(item.name)&&(item.quantity_known===false||safeNum(item.quantity)===null))unknownQuantities++}const snap=row.nutrition_snapshot&&typeof row.nutrition_snapshot==='object'?row.nutrition_snapshot:{};if((Array.isArray(snap.nutrition_missing_metrics)&&snap.nutrition_missing_metrics.length)||['calories','protein_g','carbs_g','fat_g','fiber_g'].some(key=>snap[key]===null||snap[key]===undefined))incompleteNutrition++}
    return {meals:source.length,ingredients,unknownQuantities,incompleteNutrition};
  }
  function dayCopyPlanKey(operationKey,rowId){return `manual:day-copy:${clean(operationKey)}:${encodeURIComponent(String(rowId||'')).slice(0,120)}`;}
  const WEEK_TEMPLATE_LIMIT=12, WEEK_TEMPLATE_MEAL_LIMIT=80, WEEK_TEMPLATE_JSON_LIMIT=50000;
  function weeklyTemplatePlanKey(templateId,itemId){
    const a=clean(templateId),b=clean(itemId);
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(a)||!/^[a-zA-Z0-9_-]{8,100}$/.test(b))throw new Error('La plantilla contiene una clave de comida inválida.');
    return `manual:week-template:${a}:${b}`;
  }
  function normalizeWeeklyTemplates(value){
    if(value===null||value===undefined)return [];
    if(!Array.isArray(value))throw new Error('Las plantillas guardadas tienen un formato inesperado. No se modificó ninguna plantilla.');
    if(value.length>WEEK_TEMPLATE_LIMIT)throw new Error(`Hay más de ${WEEK_TEMPLATE_LIMIT} plantillas guardadas. Eliminá alguna antes de guardar otra.`);
    const ids=new Set();
    const out=value.map(raw=>{
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Una plantilla está dañada y no se cargó. No se modificó ninguna plantilla.');
      const templateId=clean(raw.id),name=clean(raw.name),created=clean(raw.created_at),sourceWeek=clean(raw.source_week),items=Array.isArray(raw.items)?raw.items:[];
      if(!/^[a-zA-Z0-9_-]{8,100}$/.test(templateId)||ids.has(templateId))throw new Error('Una plantilla tiene un identificador inválido o repetido.');ids.add(templateId);
      if(!name||name.length>80)throw new Error('Una plantilla tiene un nombre inválido.');
      if(!strictIso(sourceWeek)||mondayIso(sourceWeek)!==sourceWeek)throw new Error('Una plantilla contiene una semana de origen inválida.');
      if(!created||!Number.isFinite(Date.parse(created)))throw new Error('Una plantilla contiene una fecha de creación inválida.');
      if(!items.length||items.length>WEEK_TEMPLATE_MEAL_LIMIT)throw new Error(`La plantilla «${name}» no tiene comidas o supera el máximo de ${WEEK_TEMPLATE_MEAL_LIMIT}.`);
      const itemIds=new Set();
      const normalizedItems=items.map(item=>{
        if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`La plantilla «${name}» contiene una comida inválida.`);
        const itemId=clean(item.item_id),day=Number(item.day_offset),mealType=clean(item.meal_type),title=clean(item.title);
        if(!/^[a-zA-Z0-9_-]{8,100}$/.test(itemId)||itemIds.has(itemId))throw new Error(`La plantilla «${name}» contiene una clave de comida inválida.`);itemIds.add(itemId);
        if(!Number.isInteger(day)||day<0||day>6||!MEALS.some(x=>x[0]===mealType)||!title||title.length>160)throw new Error(`La plantilla «${name}» contiene datos de comida inválidos.`);
        const ingredients=Array.isArray(item.ingredients_snapshot)?item.ingredients_snapshot.filter(x=>x&&clean(x.name)).map(x=>cloneJson(x,{})):[];
        if(ingredients.length>200)throw new Error(`La comida «${title}» contiene demasiados ingredientes para una plantilla.`);
        const nutrition=item.nutrition_snapshot&&typeof item.nutrition_snapshot==='object'&&!Array.isArray(item.nutrition_snapshot)?cloneJson(item.nutrition_snapshot,{}):{};
        const t=clean(item.planned_time);
        return {item_id:itemId,day_offset:day,meal_type:mealType,title:title.slice(0,160),planned_time:/^([01]\d|2[0-3]):[0-5]\d$/.test(t)?t:null,notes:clean(item.notes).slice(0,2000),sort_order:Number.isFinite(Number(item.sort_order))?Number(item.sort_order):0,ingredients_snapshot:ingredients,nutrition_snapshot:nutrition};
      });
      return {id:templateId,name,created_at:created,source_week:sourceWeek,items:normalizedItems,meal_count:normalizedItems.length};
    });
    if(JSON.stringify(out).length>WEEK_TEMPLATE_JSON_LIMIT)throw new Error('Las plantillas ocuparían demasiado espacio. Eliminá alguna o guardá menos comidas por plantilla.');
    return out;
  }
  function renameWeeklyPlanTemplate(value,templateId,requestedName){
    const normalized=normalizeWeeklyTemplates(value),target=normalized.find(item=>item.id===String(templateId));
    if(!target)throw new Error('La plantilla ya no existe. Actualizá la lista.');
    const name=clean(requestedName);
    if(!name||name.length>80)throw new Error('El nombre debe tener entre 1 y 80 caracteres.');
    if(normalized.some(item=>item.id!==target.id&&normalize(item.name)===normalize(name)))throw new Error('Ya existe otra plantilla con ese nombre. Elegí un nombre diferente.');
    return normalizeWeeklyTemplates(normalized.map(item=>item.id===target.id?{...item,name}:item));
  }
  function uniqueWeeklyTemplateCopyName(sourceName,templates){
    const existing=new Set((Array.isArray(templates)?templates:[]).map(item=>normalize(item?.name)));
    const base=clean(sourceName)||'Plantilla';
    const firstSuffix=' (copia)';const first=`${base.slice(0,80-firstSuffix.length).trimEnd()}${firstSuffix}`;
    if(!existing.has(normalize(first)))return first;
    for(let n=2;n<=99;n++){const suffix=` (copia ${n})`;const candidate=`${base.slice(0,80-suffix.length).trimEnd()}${suffix}`;if(!existing.has(normalize(candidate)))return candidate;}
    throw new Error('No se pudo generar un nombre único para la copia. Renombrá alguna plantilla e intentá de nuevo.');
  }
  function duplicateWeeklyPlanTemplate(value,templateId,newTemplateId=id(),createdAt=new Date().toISOString(),itemIdFactory=id,requestedName=''){
    const normalized=normalizeWeeklyTemplates(value);
    if(normalized.length>=WEEK_TEMPLATE_LIMIT)throw new Error(`Llegaste al máximo de ${WEEK_TEMPLATE_LIMIT} plantillas. Eliminá alguna antes de duplicar otra.`);
    const source=normalized.find(item=>item.id===String(templateId));
    if(!source)throw new Error('La plantilla que querés duplicar ya no existe. Actualizá la lista.');
    const nextId=clean(newTemplateId);
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(nextId)||normalized.some(item=>item.id===nextId))throw new Error('No se pudo crear un identificador independiente para la copia.');
    const name=clean(requestedName)||uniqueWeeklyTemplateCopyName(source.name,normalized);
    if(!name||name.length>80)throw new Error('El nombre de la copia debe tener entre 1 y 80 caracteres.');
    if(normalized.some(item=>normalize(item.name)===normalize(name)))throw new Error('Ya existe una plantilla con ese nombre. Elegí otro nombre.');
    const usedItemIds=new Set(normalized.flatMap(item=>item.items.map(entry=>entry.item_id)));
    const clonedItems=source.items.map(item=>{
      let newItemId='',attempt=0;
      do{newItemId=clean(itemIdFactory());attempt++;}while(usedItemIds.has(newItemId)&&attempt<5);
      if(!/^[a-zA-Z0-9_-]{8,100}$/.test(newItemId)||usedItemIds.has(newItemId))throw new Error('No se pudo crear una clave independiente para cada comida. No se duplicó la plantilla.');
      usedItemIds.add(newItemId);
      return {...cloneJson(item,{}),item_id:newItemId,ingredients_snapshot:cloneJson(item.ingredients_snapshot,[]),nutrition_snapshot:cloneJson(item.nutrition_snapshot,{})};
    });
    const copy={...cloneJson(source,{}),id:nextId,name,created_at:createdAt,items:clonedItems,meal_count:clonedItems.length};
    return normalizeWeeklyTemplates([copy,...normalized]);
  }
  function weeklyTemplateSummary(template){
    const item=normalizeWeeklyTemplates([template])[0],days=DAY_NAMES.map((name,index)=>({day:index,name,count:item.items.filter(meal=>meal.day_offset===index).length})).filter(day=>day.count>0);
    let ingredients=0,unknownQuantities=0,incompleteNutrition=0;
    for(const meal of item.items){const list=Array.isArray(meal.ingredients_snapshot)?meal.ingredients_snapshot:[];ingredients+=list.length;for(const ingredient of list)if(ingredient.quantity_known===false||safeNum(ingredient.quantity)===null)unknownQuantities++;
      const nutrition=meal.nutrition_snapshot&&typeof meal.nutrition_snapshot==='object'?meal.nutrition_snapshot:{};
      const missing=Array.isArray(nutrition.nutrition_missing_metrics)?nutrition.nutrition_missing_metrics:[];
      if(missing.length||['calories','protein_g','carbs_g','fat_g','fiber_g'].some(key=>nutrition[key]===null||nutrition[key]===undefined))incompleteNutrition++;
    }
    return {meals:item.items.length,daysUsed:days.length,days,ingredients,unknownQuantities,incompleteNutrition};
  }
  function compareWeeklyPlanTemplates(templateA,templateB){
    const left=normalizeWeeklyTemplates([templateA])[0],right=normalizeWeeklyTemplates([templateB])[0];
    if(left.id===right.id)throw new Error('Elegí dos plantillas diferentes para compararlas.');
    const baseKey=item=>`${Number(item.day_offset)}|${String(item.meal_type)}|${normalize(item.title)}|${clean(item.planned_time)}`;
    const makeMap=template=>{const map=new Map(),seen=new Map();const items=template.items.slice().sort((a,b)=>Number(a.day_offset)-Number(b.day_offset)||MEALS.findIndex(x=>x[0]===a.meal_type)-MEALS.findIndex(x=>x[0]===b.meal_type)||String(a.planned_time||'99:99').localeCompare(String(b.planned_time||'99:99'))||normalize(a.title).localeCompare(normalize(b.title))||Number(a.sort_order)-Number(b.sort_order)||String(a.item_id).localeCompare(String(b.item_id)));for(const item of items){const base=baseKey(item),n=seen.get(base)||0;seen.set(base,n+1);map.set(`${base}|${n}`,item)}return map};
    const leftMap=makeMap(left),rightMap=makeMap(right),keys=[...new Set([...leftMap.keys(),...rightMap.keys()])];
    keys.sort((ka,kb)=>{const a=leftMap.get(ka)||rightMap.get(ka),b=leftMap.get(kb)||rightMap.get(kb);return Number(a.day_offset)-Number(b.day_offset)||MEALS.findIndex(x=>x[0]===a.meal_type)-MEALS.findIndex(x=>x[0]===b.meal_type)||String(a.planned_time||'99:99').localeCompare(String(b.planned_time||'99:99'))||normalize(a.title).localeCompare(normalize(b.title))||ka.localeCompare(kb)});
    const stable=value=>{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`};
    const quantityState=item=>{const quantity=safeNum(item?.quantity);return item?.quantity_known===false||quantity===null?{known:false,value:null}:{known:true,value:quantity}};
    const metricState=(snapshot,field,aliases)=>{const data=snapshot&&typeof snapshot==='object'?snapshot:{},missing=new Set((Array.isArray(data.nutrition_missing_metrics)?data.nutrition_missing_metrics:[]).map(v=>String(v).toLowerCase()));const value=safeNum(data[field]);const unknown=aliases.some(alias=>missing.has(alias))||value===null;return unknown?{known:false,value:null}:{known:true,value};};
    const metricLabels=[['calories','energía',['calories'],'kcal'],['protein_g','protein',['protein','protein_g'],'g'],['carbs_g','carbohidratos',['carbs','carbs_g'],'g'],['fat_g','grasas',['fat','fat_g'],'g'],['fiber_g','fibra',['fiber','fiber_g'],'g']];
    function ingredientDiffs(a,b){const leftItems=Array.isArray(a?.ingredients_snapshot)?a.ingredients_snapshot.filter(item=>item&&clean(item.name)):[],rightItems=Array.isArray(b?.ingredients_snapshot)?b.ingredients_snapshot.filter(item=>item&&clean(item.name)):[];const indexed=list=>{const map=new Map(),counts=new Map();for(const item of list){const base=normalize(item.name),n=counts.get(base)||0;counts.set(base,n+1);map.set(`${base}|${n}`,item)}return map};const lm=indexed(leftItems),rm=indexed(rightItems),all=[...new Set([...lm.keys(),...rm.keys()])].sort();const changes=[];for(const key of all){const x=lm.get(key),y=rm.get(key);if(!x){changes.push(`Ingrediente nuevo en B: ${clean(y.name)}.`);continue}if(!y){changes.push(`Ingrediente que solo está en A: ${clean(x.name)}.`);continue}const qx=quantityState(x),qy=quantityState(y);if(qx.known!==qy.known)changes.push(`Cantidad de «${clean(x.name)}»: ${qx.known?`${qx.value} ${clean(x.unit)}`.trim():'desconocida'} → ${qy.known?`${qy.value} ${clean(y.unit)}`.trim():'desconocida'}.`);else if(qx.known&&(Math.abs(qx.value-qy.value)>0.0001||clean(x.unit).toLowerCase()!==clean(y.unit).toLowerCase()))changes.push(`Cantidad de «${clean(x.name)}»: ${qx.value} ${clean(x.unit)} → ${qy.value} ${clean(y.unit)}.`);const qualityFields=['quality','provenance','source','food_source','nutrition_verified_at','conversion_factor','preparation','cooked_state'];const metaX={},metaY={};for(const field of qualityFields){if(x[field]!==undefined)metaX[field]=x[field];if(y[field]!==undefined)metaY[field]=y[field]}if(stable(metaX)!==stable(metaY))changes.push(`Cambió la procedencia o calidad de «${clean(x.name)}».`)}return changes}
    const rows=keys.map(key=>{const a=leftMap.get(key)||null,b=rightMap.get(key)||null;let kind='same';const changes=[];if(!a){kind='added';changes.push('La comida solo está en la plantilla B.')}else if(!b){kind='removed';changes.push('La comida solo está en la plantilla A.')}else{
        if(clean(a.notes)!==clean(b.notes))changes.push('Las notas son diferentes.');
        changes.push(...ingredientDiffs(a,b));
        for(const [field,label,aliases,unit] of metricLabels){const x=metricState(a.nutrition_snapshot,field,aliases),y=metricState(b.nutrition_snapshot,field,aliases);if(x.known!==y.known)changes.push(`${label}: ${x.known?`${x.value} ${unit}`:'dato desconocido'} → ${y.known?`${y.value} ${unit}`:'dato desconocido'}.`);else if(x.known&&Math.abs(x.value-y.value)>0.05)changes.push(`${label}: ${x.value} ${unit} → ${y.value} ${unit}.`)}
        const ax=a.nutrition_snapshot?.source_recipe,bx=b.nutrition_snapshot?.source_recipe;if((ax?.planned_servings??null)!==(bx?.planned_servings??null))changes.push(`Porciones previstas: ${ax?.planned_servings??'sin indicar'} → ${bx?.planned_servings??'sin indicar'}.`);
        if(changes.length)kind='changed';
      }
      return {day:Number(a?.day_offset??b?.day_offset),mealType:a?.meal_type||b?.meal_type,title:a?.title||b?.title||'Comida sin nombre',kind,left:a,right:b,changes};
    });
    const dayRows=DAY_NAMES.map((name,day)=>({day,name,rows:rows.filter(row=>row.day===day)})).filter(day=>day.rows.length);
    const count=kind=>rows.filter(row=>row.kind===kind).length;
    const changedIngredientDetails=rows.filter(row=>row.kind==='changed').flatMap(row=>row.changes).filter(text=>/Ingrediente|Cantidad de|procedencia o calidad/i.test(text)).length;
    return {left:{id:left.id,name:left.name,meals:left.items.length},right:{id:right.id,name:right.name,meals:right.items.length},summary:{same:count('same'),changed:count('changed'),onlyInA:count('removed'),onlyInB:count('added'),ingredientDifferences:changedIngredientDetails,daysAffected:new Set(rows.filter(row=>row.kind!=='same').map(row=>row.day)).size,incompleteNutritionA:weeklyTemplateSummary(left).incompleteNutrition,incompleteNutritionB:weeklyTemplateSummary(right).incompleteNutrition},days:dayRows,hasDifferences:rows.some(row=>row.kind!=='same')};
  }
  function createWeeklyPlanTemplate(planRows,week,who,name,templateId=id(),createdAt=new Date().toISOString(),itemIdFactory=id){
    assertOwner(who);const normalizedName=clean(name);
    if(!strictIso(week)||mondayIso(week)!==week)throw new Error('La semana de origen debe comenzar un lunes.');
    if(!normalizedName||normalizedName.length>80)throw new Error('El nombre de la plantilla debe tener entre 1 y 80 caracteres.');
    const source=Array.isArray(planRows)?planRows:[];
    if(!source.length)throw new Error('La semana no tiene comidas para guardar como plantilla.');
    if(source.length>WEEK_TEMPLATE_MEAL_LIMIT)throw new Error(`Esta semana supera el límite de ${WEEK_TEMPLATE_MEAL_LIMIT} comidas por plantilla.`);
    const seen=new Set();
    const items=source.map(row=>{
      if(!row||!clean(row.id)||clean(row.user_id)!==String(who)||clean(row.week_start)!==String(week))throw new Error('Una comida no pertenece a la cuenta y semana activa. No se guardó la plantilla.');
      if(seen.has(String(row.id)))throw new Error('La semana contiene una comida duplicada en la vista. Actualizá el plan antes de guardar la plantilla.');seen.add(String(row.id));
      const day=Number(row.day_offset);if(!Number.isInteger(day)||day<0||day>6)throw new Error('La semana contiene una comida con día inválido.');
      const itemId=String(itemIdFactory());
      return {item_id:itemId,day_offset:day,meal_type:MEALS.some(x=>x[0]===row.meal_type)?row.meal_type:'colacion',title:(clean(row.title)||'Comida sin nombre').slice(0,160),planned_time:/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(row.planned_time))?clean(row.planned_time):null,notes:clean(row.notes).slice(0,2000),sort_order:Number.isFinite(Number(row.sort_order))?Number(row.sort_order):0,ingredients_snapshot:(Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot.filter(x=>x&&clean(x.name)).map(x=>cloneJson(x,{})):[]),nutrition_snapshot:row.nutrition_snapshot&&typeof row.nutrition_snapshot==='object'&&!Array.isArray(row.nutrition_snapshot)?cloneJson(row.nutrition_snapshot,{}):{}};
    });
    return normalizeWeeklyTemplates([{id:String(templateId),name:normalizedName,created_at:createdAt,source_week:week,items,meal_count:items.length}])[0];
  }
  function weekRowsSignature(planRows,ignoredPlanKeys=[]){
    const ignored=new Set(Array.isArray(ignoredPlanKeys)?ignoredPlanKeys.map(String):[]);
    const fields=['id','user_id','week_start','day_offset','meal_type','title','planned_time','notes','source_meal_id','plan_key','sort_order','updated_at','ingredients_snapshot','nutrition_snapshot'];
    return JSON.stringify((Array.isArray(planRows)?planRows:[]).filter(row=>!ignored.has(String(row?.plan_key||''))).map(row=>{const out={};for(const field of fields)out[field]=row[field]===undefined?null:row[field];return out}).sort((a,b)=>Number(a.day_offset)-Number(b.day_offset)||String(a.id).localeCompare(String(b.id))));
  }
  function previewWeeklyTemplate(template,planRows,week,who,options={}){
    assertOwner(who);if(!strictIso(week)||mondayIso(week)!==week)throw new Error('La semana de destino debe comenzar un lunes.');
    const normalized=normalizeWeeklyTemplates([template])[0],supplied=Array.isArray(planRows)?planRows:[];
    const requested=Array.isArray(options?.selectedItemIds)?options.selectedItemIds.map(String):null;
    const requestedOverrides=options?.targetDayByItemId&&typeof options.targetDayByItemId==='object'&&!Array.isArray(options.targetDayByItemId)?options.targetDayByItemId:null;
    let selectedItemIds=null,workingTemplate=normalized,effectiveTargetDays={};
    if(requested){
      const unique=[...new Set(requested)];
      if(!unique.length)throw new Error('Seleccioná al menos una comida de la plantilla.');
      if(unique.length!==requested.length)throw new Error('La selección contiene comidas repetidas. Actualizá la selección antes de continuar.');
      const valid=new Set(normalized.items.map(item=>item.item_id));
      if(unique.some(itemId=>!valid.has(itemId)))throw new Error('Una comida seleccionada ya no pertenece a esta plantilla. Actualizá y volvé a seleccionar.');
      if(requestedOverrides&&Object.keys(requestedOverrides).some(itemId=>!unique.includes(String(itemId))))throw new Error('Hay un día de destino para una comida que no está seleccionada. Actualizá la selección.');
      selectedItemIds=normalized.items.filter(item=>unique.includes(item.item_id)).map(item=>item.item_id);
      const overrides=new Map();
      for(const [itemId,rawDay] of Object.entries(requestedOverrides||{})){
        const day=Number(rawDay);
        if(!Number.isInteger(day)||day<0||day>6)throw new Error('Elegí un día de destino válido para cada comida seleccionada.');
        overrides.set(String(itemId),day);
      }
      const selectedItems=normalized.items.filter(item=>selectedItemIds.includes(item.item_id)).map(item=>{
        const destination=overrides.has(item.item_id)?overrides.get(item.item_id):Number(item.day_offset);
        effectiveTargetDays[item.item_id]=destination;
        return {...item,source_day_offset:Number(item.day_offset),day_offset:destination};
      });
      workingTemplate={...normalized,items:selectedItems};
    } else if(requestedOverrides){
      throw new Error('La asignación personalizada requiere seleccionar las comidas explícitamente.');
    }
    const dayMoves=requested?workingTemplate.items.filter(item=>Number(item.source_day_offset)!==Number(item.day_offset)).map(item=>({item_id:item.item_id,title:item.title,from_day:Number(item.source_day_offset),to_day:Number(item.day_offset)})):[];
    const includeOccupiedDays=!!requested||options===true||options?.includeOccupiedDays===true;
    for(const row of supplied)if(!row||clean(row.user_id)!==String(who)||clean(row.week_start)!==String(week))throw new Error('La vista del destino contiene una comida de otra cuenta o semana. Actualizá el plan.');
    const keyByItem=new Map(workingTemplate.items.map(item=>[item.item_id,weeklyTemplatePlanKey(workingTemplate.id,item.item_id)]));
    const allKeys=[...keyByItem.values()],templateRows=supplied.filter(row=>allKeys.includes(String(row.plan_key||'')));
    for(const row of templateRows){const item=workingTemplate.items.find(x=>weeklyTemplatePlanKey(workingTemplate.id,x.item_id)===String(row.plan_key));if(!item||Number(row.day_offset)!==item.day_offset)throw new Error('Una comida de esta plantilla ya existe en otro día. No se moverá ni sobrescribirá automáticamente; revisá el plan.');}
    const days=[];
    for(let day=0;day<7;day++){
      const items=workingTemplate.items.filter(item=>item.day_offset===day),target=supplied.filter(row=>Number(row.day_offset)===day);
      if(!items.length){days.push({day,status:'empty',items:[],addCount:0,alreadyCount:0,existingCount:target.length});continue}
      const expected=new Set(items.map(item=>keyByItem.get(item.item_id))),already=target.filter(row=>expected.has(String(row.plan_key||''))),unrelated=target.filter(row=>!expected.has(String(row.plan_key||'')));
      if(unrelated.length&&!includeOccupiedDays){days.push({day,status:'skip',items,addCount:0,alreadyCount:already.length,existingCount:target.length,unrelatedCount:unrelated.length});continue}
      const existingKeys=new Set(already.map(row=>String(row.plan_key))),missing=items.filter(item=>!existingKeys.has(keyByItem.get(item.item_id)));
      const dayStatus=missing.length?(unrelated.length?'merge':'add'):'already';
      days.push({day,status:dayStatus,items:missing,allItems:items,addCount:missing.length,alreadyCount:already.length,existingCount:target.length,unrelatedCount:unrelated.length});
    }
    const ignoredKeys=allKeys;
    const counts={mealsToAdd:days.reduce((n,d)=>n+d.addCount,0),mealsAlreadyPresent:days.reduce((n,d)=>n+d.alreadyCount,0),daysSkipped:days.filter(d=>d.status==='skip').length,daysToApply:days.filter(d=>d.status==='add'||d.status==='merge').length,daysMerged:days.filter(d=>d.status==='merge').length};
    // E39: una revisión consolidada por comida, con destinos ocupados y avisos de calidad.
    // Es solo informativa: nunca modifica rows, la plantilla ni el borrador del plan.
    const reviewItems=workingTemplate.items.map(item=>{
      const itemKey=weeklyTemplatePlanKey(normalized.id,item.item_id),targetDay=Number(item.day_offset),sourceDay=Number(item.source_day_offset??item.day_offset);
      const already=supplied.find(row=>String(row.plan_key||'')===itemKey);
      const dayInfo=days.find(day=>day.day===targetDay)||{status:'empty',existingCount:0,unrelatedCount:0};
      const destinationRows=supplied.filter(row=>Number(row.day_offset)===targetDay&&!allKeys.includes(String(row.plan_key||'')));
      const action=already?'already':dayInfo.status==='skip'?'skip':'add';
      const ingredients=Array.isArray(item.ingredients_snapshot)?item.ingredients_snapshot.filter(ingredient=>ingredient&&clean(ingredient.name)):[];
      const unknownQuantityCount=ingredients.filter(ingredient=>ingredient.quantity_known===false||safeNum(ingredient.quantity)===null).length;
      const nutrition=item.nutrition_snapshot&&typeof item.nutrition_snapshot==='object'?item.nutrition_snapshot:{};
      const missingMetrics=Array.isArray(nutrition.nutrition_missing_metrics)?nutrition.nutrition_missing_metrics:[];
      const incompleteNutrition=missingMetrics.length>0||['calories','protein_g','carbs_g','fat_g','fiber_g'].some(field=>nutrition[field]===null||nutrition[field]===undefined);
      return {item_id:item.item_id,title:clean(item.title)||'Comida sin nombre',meal_type:item.meal_type,source_day:sourceDay,target_day:targetDay,planned_time:item.planned_time||'',action,existing_destination_count:destinationRows.length,existing_destination_titles:destinationRows.slice(0,3).map(row=>clean(row.title)||'Comida sin nombre'),unknown_quantity_count:unknownQuantityCount,incomplete_nutrition:incompleteNutrition};
    });
    const reviewDays=new Set(reviewItems.filter(item=>item.action!=='already'&&item.existing_destination_count>0).map(item=>item.target_day));
    const uniqueOccupiedRows=new Map();for(const item of reviewItems){if(item.action==='already'||!item.existing_destination_count)continue;const key=String(item.target_day);if(!uniqueOccupiedRows.has(key))uniqueOccupiedRows.set(key,[])}
    for(const day of reviewDays){const existing=supplied.filter(row=>Number(row.day_offset)===day&&!allKeys.includes(String(row.plan_key||'')));uniqueOccupiedRows.set(String(day),existing)}
    const changeReview={items:reviewItems,summary:{toAdd:reviewItems.filter(item=>item.action==='add').length,alreadyPresent:reviewItems.filter(item=>item.action==='already').length,skipped:reviewItems.filter(item=>item.action==='skip').length,moved:reviewItems.filter(item=>item.source_day!==item.target_day).length,occupiedDays:reviewDays.size,preservedExistingMeals:[...uniqueOccupiedRows.values()].reduce((total,list)=>total+list.length,0),unknownQuantities:reviewItems.reduce((total,item)=>total+item.unknown_quantity_count,0),incompleteNutrition:reviewItems.filter(item=>item.incomplete_nutrition).length}};
    return {template_id:normalized.id,template_name:normalized.name,target_week:week,includeOccupiedDays,selected_item_ids:selectedItemIds,target_day_overrides:requested?effectiveTargetDays:null,day_moves:dayMoves,selected_meal_count:workingTemplate.items.length,template_meal_count:normalized.items.length,days,counts,change_review:changeReview,ignoredPlanKeys:ignoredKeys,target_signature:weekRowsSignature(supplied,ignoredKeys),template_signature:JSON.stringify(normalized)};
  }
  function weeklyTemplatePayloads(template,preview,planRows,week,who,updatedAt=new Date().toISOString()){
    assertOwner(who);const normalized=normalizeWeeklyTemplates([template])[0];
    if(preview?.template_id!==normalized.id||preview?.target_week!==week||preview?.template_signature!==JSON.stringify(normalized))throw new Error('La vista previa no corresponde a esta plantilla y semana. Generá una nueva.');
    if(!strictIso(week)||mondayIso(week)!==week)throw new Error('La semana de destino debe comenzar un lunes.');
    const current=Array.isArray(planRows)?planRows:[];for(const row of current)if(!row||clean(row.user_id)!==String(who)||clean(row.week_start)!==String(week))throw new Error('El plan de destino contiene una comida de otra cuenta o semana.');
    const fresh=previewWeeklyTemplate(normalized,current,week,who,{includeOccupiedDays:preview.includeOccupiedDays===true,...(Array.isArray(preview.selected_item_ids)?{selectedItemIds:preview.selected_item_ids,targetDayByItemId:preview.target_day_overrides||{}}:{})});const payloads=[];
    if(fresh.target_signature!==preview.target_signature)throw new Error('El plan cambió desde la vista previa. Revisá los cambios y generá una nueva vista previa.');
    for(const dayInfo of fresh.days){if(dayInfo.status!=='add'&&dayInfo.status!=='merge')continue;const existing=current.filter(row=>Number(row.day_offset)===dayInfo.day),sortValues=existing.map(row=>safeNum(row.sort_order)).filter(v=>v!==null);let sort=sortValues.length?Math.max(...sortValues)+1:0;
      for(const item of dayInfo.items){payloads.push({user_id:String(who),week_start:week,day_offset:item.day_offset,meal_type:item.meal_type,title:item.title,planned_time:item.planned_time,notes:item.notes,source_meal_id:null,plan_key:weeklyTemplatePlanKey(normalized.id,item.item_id),sort_order:sort++,ingredients_snapshot:cloneJson(item.ingredients_snapshot,[]),nutrition_snapshot:cloneJson(item.nutrition_snapshot,{}),updated_at:updatedAt});}
    }
    if(payloads.length>WEEK_TEMPLATE_MEAL_LIMIT)throw new Error('La plantilla supera el límite seguro de comidas por operación.');
    if(new Set(payloads.map(x=>x.plan_key)).size!==payloads.length)throw new Error('La plantilla generaría claves duplicadas. No se aplicó ningún cambio.');
    return payloads;
  }
  function copyDayPlanPayloads(sourceRows,sourceDay,targetDay,week,who,operationKey,targetRows=[],updatedAt=new Date().toISOString()){
    assertOwner(who);const from=Number(sourceDay),to=Number(targetDay);
    if(!Number.isInteger(from)||from<0||from>6||!Number.isInteger(to)||to<0||to>6)throw new Error('Elegí días de origen y destino válidos.');
    if(from===to)throw new Error('El día de destino debe ser distinto del día de origen.');
    if(!strictIso(week)||mondayIso(week)!==week)throw new Error('La semana activa debe comenzar un lunes.');
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(clean(operationKey)))throw new Error('No se pudo crear una clave segura para esta copia.');
    const suppliedSource=Array.isArray(sourceRows)?sourceRows:[];if(suppliedSource.some(row=>Number(row?.day_offset)!==from))throw new Error('Una comida de origen no pertenece al día seleccionado. Actualizá el plan antes de copiarlo.');
    const source=orderedDayRows(suppliedSource,from);if(!source.length)throw new Error('El día de origen no tiene comidas para copiar.');
    const ids=new Set();for(const row of source){if(!row||!clean(row.id)||clean(row.user_id)!==String(who)||clean(row.week_start)!==String(week)||Number(row.day_offset)!==from)throw new Error('Una comida de origen no pertenece a la cuenta, semana y día activos. No se copió el día.');if(ids.has(String(row.id)))throw new Error('El día de origen contiene una comida duplicada en la vista. Actualizá el plan antes de copiarlo.');ids.add(String(row.id))}
    const destination=Array.isArray(targetRows)?targetRows:[];for(const row of destination){if(!row||clean(row.user_id)!==String(who)||clean(row.week_start)!==String(week)||Number(row.day_offset)!==to)throw new Error('Una comida de destino no pertenece a la cuenta, semana y día activos. No se copió el día.')}
    const base=destination.map(row=>safeNum(row.sort_order)).filter(v=>v!==null);let sort=base.length?Math.max(...base)+1:0;
    const payloads=source.map(row=>{
      const key=dayCopyPlanKey(operationKey,row.id);
      const payload=duplicatePlanPayload(row,to,week,who,key,sort++,updatedAt);return payload;
    });
    if(new Set(payloads.map(row=>row.plan_key)).size!==source.length)throw new Error('No se pudieron generar claves únicas para todas las comidas.');
    return payloads;
  }
  function movePlanPayload(row,targetDay,week,who,planKey,sortOrder,updatedAt=new Date().toISOString()){
    assertOwner(who);
    const day=Number(targetDay);
    if(!row||!clean(row.id)||clean(row.user_id)!==String(who)||clean(row.week_start)!==String(week))throw new Error('La comida no pertenece a la cuenta y semana activas. No se movió.');
    if(!Number.isInteger(day)||day<0||day>6)throw new Error('Elegí un día de destino válido.');
    if(day===Number(row.day_offset))throw new Error('La comida ya está en ese día.');
    if(!clean(planKey))throw new Error('No se pudo crear una clave segura para el movimiento.');
    return {day_offset:day,source_meal_id:null,plan_key:String(planKey),sort_order:Number.isFinite(Number(sortOrder))?Number(sortOrder):0,updated_at:updatedAt};
  }
  function safeSnapshotItems(items){
    const metadataKeys=['catalog_id','food_id','external_id','barcode','gtin','source','source_type','source_url','data_source_label','data_source_url','nutrition_quality_status','nutrition_missing_fields','nutrition_missing_metrics','nutrition_verified_at','density_g_per_ml','grams_per_unit','grams_per_portion','serving_size','serving_quantity','quantity_label','sourceType','sourceUrl','dataSourceLabel','dataSourceUrl','nutritionQualityStatus','nutritionMissing','nutritionMissingFields','nutritionVerifiedAt','densityGPerMl','gramsPerUnit','gramsPerPortion','servingSize','servingQuantity','quantityLabel'];
    return (Array.isArray(items)?items:[]).filter(x=>x&&clean(x.name)).map(x=>{
      const rawUnit=clean(x.unit),quantity=safeNum(x.quantity),quantityKnown=x.quantity_known!==false&&quantity!==null&&quantity>=0&&!!rawUnit;
      const out={name:clean(x.name).slice(0,240),brand:clean(x.brand).slice(0,160),quantity:quantityKnown?quantity:null,quantity_known:quantityKnown,unit:rawUnit||'sin unidad',preparation_state:['raw','cooked','prepared','unspecified'].includes(clean(x.preparation_state))?clean(x.preparation_state):'unspecified',categories:clean(x.categories||x.category)||'Otros'};
      for(const key of metadataKeys){if(!Object.prototype.hasOwnProperty.call(x,key))continue;const value=x[key];
        if(Array.isArray(value)){out[key]=value.slice(0,40).map(v=>clean(v).slice(0,180)).filter(Boolean);continue}
        if(typeof value==='number'){if(Number.isFinite(value)&&Math.abs(value)<=1e9)out[key]=value;continue}
        if(typeof value==='boolean'){out[key]=value;continue}
        if(typeof value==='string'){out[key]=value.slice(0,1200);continue}
      }
      for(const key of ['quality','provenance']){const value=x[key];if(!value||typeof value!=='object'||Array.isArray(value))continue;try{const serialized=JSON.stringify(value);if(serialized.length<=4096)out[key]=JSON.parse(serialized)}catch(_){} }
      return out;
    });
  }
  function round3(value){return Math.round((Number(value)+Number.EPSILON)*1000)/1000}
  function snapshotForTemplate(meal){const items=safeSnapshotItems(templateItems.get(String(meal.id))||[]);const nutrition={};for(const key of ['calories','protein_g','carbs_g','fat_g'])nutrition[key]=safeNum(meal[key]);return {ingredients:items,nutrition}}
  function clonePlanSnapshot(row){
    const ingredients=Array.isArray(row?.ingredients_snapshot)?row.ingredients_snapshot.filter(item=>item&&clean(item.name)).map(item=>cloneJson(item,{})):[];
    const nutrition=cloneJson(row?.nutrition_snapshot,{});
    return {ingredients,nutrition};
  }
  function scaleRecipeSnapshot(row,plannedServings,updatedAt=new Date().toISOString()){
    const snapshot=row?.nutrition_snapshot&&typeof row.nutrition_snapshot==='object'?row.nutrition_snapshot:{};
    const source=snapshot.source_recipe&&typeof snapshot.source_recipe==='object'?snapshot.source_recipe:null;
    const previous=safeNum(source?.planned_servings),yieldServings=safeNum(source?.yield_servings),next=safeNum(plannedServings);
    if(!source||!clean(source.id)||!clean(source.name))throw new Error('Esta comida no conserva el origen de una receta; no se pueden ajustar sus porciones automáticamente.');
    if(previous===null||previous<=0||previous>1000||yieldServings===null||yieldServings<=0)throw new Error('La receta tiene un rendimiento guardado inválido. Revisá la receta original antes de ajustar las porciones.');
    if(next===null||next<0.1||next>1000)throw new Error('Las porciones previstas deben estar entre 0,1 y 1.000.');
    const factor=next/previous;
    if(!Number.isFinite(factor)||factor<=0||factor>10000)throw new Error('El cambio de porciones está fuera del rango seguro.');
    const originalItems=Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot:[];
    const ingredients=originalItems.filter(item=>item&&clean(item.name)).map(item=>{
      const out=cloneJson(item,{}),quantity=safeNum(item.quantity),unit=clean(item.unit);
      const known=item.quantity_known!==false&&quantity!==null&&quantity>=0&&!!unit;
      if(known){const value=quantity*factor;if(!Number.isFinite(value)||value<0||value>1000000)throw new Error(`La cantidad de «${clean(item.name)}» quedaría fuera del rango permitido. Reducí las porciones o revisá ese ingrediente.`);out.quantity=round3(value);out.quantity_known=true}
      else {out.quantity=null;out.quantity_known=false}
      return out;
    });
    const nutrition=cloneJson(snapshot,{});
    const missing=new Set((Array.isArray(nutrition.nutrition_missing_metrics)?nutrition.nutrition_missing_metrics:[]).map(value=>String(value).toLowerCase().replace(/[^a-z0-9_]/g,'')));
    const metricByField={calories:['calories','calories_kcal'],protein_g:['protein','protein_g'],carbs_g:['carbs','carbohydrates','carbs_g'],fat_g:['fat','fat_g'],fiber_g:['fiber','fiber_g']};
    for(const [field,aliases] of Object.entries(metricByField)){
      if(aliases.some(alias=>missing.has(alias))){nutrition[field]=null;continue}
      const value=safeNum(nutrition[field]);
      if(value===null)continue;
      const scaled=value*factor;
      if(!Number.isFinite(scaled)||scaled<0||scaled>1e12)throw new Error(`El total nutricional «${field}» quedaría fuera del rango seguro.`);
      nutrition[field]=round3(scaled);
    }
    const nextSource={...cloneJson(source,{}),planned_servings:next,scale:round3(next/yieldServings)};
    nutrition.source_recipe=nextSource;
    return {ingredients_snapshot:ingredients,nutrition_snapshot:nutrition,previous_servings:previous,planned_servings:next,scale_factor:round3(factor),updated_at:updatedAt};
  }
  function snapshotForRecipe(recipe,plannedServings){
    if(!recipe||!clean(recipe.id)||!clean(recipe.name))throw new Error('Elegí una receta guardada válida.');
    const servings=safeNum(plannedServings),yieldServings=safeNum(recipe.servings);
    if(servings===null||servings<=0||servings>1000)throw new Error('Las porciones a preparar deben estar entre 0,1 y 1.000.');
    if(yieldServings===null||yieldServings<=0)throw new Error('La receta no tiene un rendimiento válido. Revisá su cantidad de porciones.');
    const scale=servings/yieldServings;
    const raw=Array.isArray(recipe.ingredients)?recipe.ingredients.filter(x=>x&&clean(x.name)):[];
    if(!raw.length)throw new Error('La receta no tiene ingredientes detallados. Abrila y agregá ingredientes antes de planificarla.');
    const ingredients=safeSnapshotItems(raw.map(item=>{
      const quantity=safeNum(item.quantity),unit=clean(item.unit);
      if(quantity===null||quantity<=0)throw new Error(`El ingrediente «${clean(item.name)}» no tiene una cantidad válida. Corregí la receta antes de planificarla.`);
      if(!unit)throw new Error(`El ingrediente «${clean(item.name)}» no tiene una unidad definida. Corregí la receta antes de planificarla.`);
      const scaled=quantity*scale;
      if(!Number.isFinite(scaled)||scaled<=0||scaled>1000000)throw new Error(`La cantidad calculada para «${clean(item.name)}» supera el rango admitido. Revisá las porciones y la receta.`);
      return {...item,quantity:Math.max(0.001,round3(scaled)),unit};
    }));
    if(!ingredients.length)throw new Error('No se encontraron ingredientes utilizables en la receta.');
    const weight=safeNum(recipe.total_weight_g);
    const totalForLegacy=key=>{const per100=safeNum(recipe[key]);return per100===null||weight===null||weight<=0?null:round3(per100*weight/100*scale)};
    let calculation=null,calculationFailed=false;
    const calculate=window.AgendaNutritionData?.calculateRecipe;
    if(typeof calculate==='function'){
      try{calculation=calculate(recipe.ingredients,recipe.finished_weight_g??null)}
      catch(_){calculationFailed=true}
    }
    const unknown=new Set(Array.isArray(calculation?.unknownMetrics)?calculation.unknownMetrics:[]);
    if(calculationFailed)for(const key of ['calories','protein','carbs','fat','fiber'])unknown.add(key);
    const nutrientMap={calories:['calories','total_calories','calories_per_100g'],protein_g:['protein','total_protein_g','protein_per_100g'],carbs_g:['carbs','total_carbs_g','carbs_per_100g'],fat_g:['fat','total_fat_g','fat_per_100g'],fiber_g:['fiber','total_fiber_g','fiber_per_100g']};
    const totalFor=(key)=>{
      const [metric,totalKey,per100Key]=nutrientMap[key];
      if(unknown.has(metric))return null;
      if(calculation&&Number.isFinite(Number(calculation[totalKey])))return round3(Number(calculation[totalKey])*scale);
      if(calculationFailed)return null;
      return totalForLegacy(per100Key);
    };
    const source={id:String(recipe.id),name:clean(recipe.name).slice(0,160),yield_servings:yieldServings,planned_servings:servings,scale:round3(scale),updated_at:clean(recipe.updated_at)||null,snapshot_version:2};
    const nutrition={calories:totalFor('calories'),protein_g:totalFor('protein_g'),carbs_g:totalFor('carbs_g'),fat_g:totalFor('fat_g'),fiber_g:totalFor('fiber_g'),nutrition_missing_metrics:[...unknown],nutrition_quality_status:unknown.size?'incomplete':'calculated',source_recipe:source};
    return {ingredients,nutrition};
  }
  function templatePlanPayload(meal,day,week,who){const snap=snapshotForTemplate(meal);return {user_id:who,week_start:week,day_offset:Number(day),meal_type:MEALS.some(x=>x[0]===meal.meal_type)?meal.meal_type:'colacion',title:clean(meal.title)||'Comida sin nombre',planned_time:/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(meal.meal_time))?clean(meal.meal_time):null,notes:'',source_meal_id:meal.id,plan_key:sourcePlanKey(meal.id,day,MEALS.some(x=>x[0]===meal.meal_type)?meal.meal_type:'colacion',/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(meal.meal_time))?clean(meal.meal_time):''),sort_order:Number(meal.meal_order)||0,ingredients_snapshot:snap.ingredients,nutrition_snapshot:snap.nutrition,updated_at:new Date().toISOString()}}
  function formRowPayload(form,who,week,existing){
    const day=Number(form.elements.day_offset.value);
    if(!Number.isInteger(day)||day<0||day>6)throw new Error('Elegí un día válido.');
    const mealType=form.elements.meal_type.value;
    if(!MEALS.some(x=>x[0]===mealType))throw new Error('Elegí una categoría de comida válida.');
    const title=clean(form.elements.title.value);
    if(!title)throw new Error('El nombre de la comida es obligatorio.');
    const time=clean(form.elements.planned_time.value);
    if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('La hora debe tener formato HH:MM.');
    const notes=clean(form.elements.notes.value);
    if(notes.length>2000)throw new Error('Las notas no pueden superar los 2.000 caracteres.');
    const templateId=clean(form.elements.source_meal_id.value);
    const template=templateId?templates.find(m=>String(m.id)===templateId):null;
    if(templateId&&!template)throw new Error('La comida de origen ya no está disponible. Actualizá la plantilla o elegí una comida manual.');
    const recipeId=clean(form.elements.source_recipe_id.value);
    const recipe=recipeId?recipes.find(r=>String(r.id)===recipeId):null;
    if(recipeId&&!recipe)throw new Error('La receta seleccionada ya no está disponible. Actualizá las recetas e intentá de nuevo.');
    if(template&&recipe)throw new Error('Elegí una plantilla o una receta, no ambas.');
    let snap;
    const existingRecipe=existing?.nutrition_snapshot&&typeof existing.nutrition_snapshot==='object'?existing.nutrition_snapshot.source_recipe:null;
    if(recipe)snap=snapshotForRecipe(recipe,form.elements.recipe_servings.value);
    else if(existing&&existing.source_meal_id&&String(existing.source_meal_id)===String(template?.id||''))snap=clonePlanSnapshot(existing);
    else if(template)snap=snapshotForTemplate(template);
    else if(existing&&existingRecipe){
      const plannedValue=form.elements.existing_recipe_servings?.value;
      const nextServings=safeNum(plannedValue),previousServings=safeNum(existingRecipe.planned_servings);
      if(nextServings===null)throw new Error('Indicá las porciones previstas de esta receta (entre 0,1 y 1.000).');
      snap=nextServings===previousServings?clonePlanSnapshot(existing):(()=>{const scaled=scaleRecipeSnapshot(existing,nextServings);return {ingredients:scaled.ingredients_snapshot,nutrition:scaled.nutrition_snapshot}})();
    }
    else if(existing)snap=clonePlanSnapshot(existing);
    else if(duplicateSourceRow)snap=clonePlanSnapshot(duplicateSourceRow);
    else snap={ingredients:[],nutrition:{}};
    const key=existing?.plan_key||draftKey||(template?sourcePlanKey(template.id,day,mealType,time):`manual:${id()}`);
    return {user_id:who,week_start:week,day_offset:day,meal_type:mealType,title:title.slice(0,160),planned_time:time||null,notes,source_meal_id:template?.id||null,plan_key:key,sort_order:existing?Number(existing.sort_order)||0:nextSortOrder(day),ingredients_snapshot:snap.ingredients,nutrition_snapshot:snap.nutrition,updated_at:new Date().toISOString()};
  }
  function mealLabel(type){return MEALS.find(x=>x[0]===type)?.[1]||'Comida'}
  function formatWeek(week){const end=addDays(week,6);const fmt=s=>{const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('es-AR',{timeZone:'UTC',day:'2-digit',month:'short'}).format(new Date(Date.UTC(y,m-1,d,12)))};return `${fmt(week)} – ${fmt(end)}`}
  const WEEK_CSV_HEADERS=['Tipo de registro','Semana desde','Día','Categoría','Comida','Hora','Ingrediente','Marca','Cantidad','Cantidad definida','Unidad','Preparación','Categoría del ingrediente','Notas','Calorías de referencia','Proteínas de referencia (g)','Carbohidratos de referencia (g)','Grasas de referencia (g)','Fibra de referencia (g)','Receta de origen','Porciones previstas','Rendimiento base de la receta'];
  function csvCell(value){let v=String(value??'');if(/^[\s\uFEFF]*[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}
  function weekCsvRows(planRows,week){
    const output=[];
    for(const row of (Array.isArray(planRows)?planRows:[])){
      const day=DAY_NAMES[Number(row.day_offset)]||'Día sin definir';
      const snap=row.nutrition_snapshot&&typeof row.nutrition_snapshot==='object'?row.nutrition_snapshot:{};
      const recipe=snap.source_recipe&&typeof snap.source_recipe==='object'?snap.source_recipe:{};
      const mealBase=['Comida',week,day,mealLabel(row.meal_type),clean(row.title),clean(row.planned_time),'','','','','','', '',clean(row.notes),snap.calories??'',snap.protein_g??'',snap.carbs_g??'',snap.fat_g??'',snap.fiber_g??'',clean(recipe.name),recipe.planned_servings??'',recipe.yield_servings??''];
      output.push(mealBase);
      for(const ingredient of (Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot:[])){
        if(!ingredient||!clean(ingredient.name))continue;
        output.push(['Ingrediente',week,day,mealLabel(row.meal_type),clean(row.title),clean(row.planned_time),clean(ingredient.name),clean(ingredient.brand),ingredient.quantity??'',ingredient.quantity_known===false?'No':'Sí',clean(ingredient.unit),clean(ingredient.preparation_state),clean(ingredient.categories||ingredient.category),clean(row.notes),'','','','','',clean(recipe.name),recipe.planned_servings??'',recipe.yield_servings??'']);
      }
    }
    return output;
  }
  function weekCsvText(planRows,week){return '\uFEFF'+[WEEK_CSV_HEADERS,...weekCsvRows(planRows,week)].map(row=>row.map(csvCell).join(';')).join('\r\n')}
  function downloadCsvFile(filename,csv){const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  function exportWeekCsv(){if(!modal)return;const who=uid();try{assertOwner(who);if(!rows.length){status('Esta semana no tiene comidas para exportar.','info');return}const csv=weekCsvText(rows,activeWeek);downloadCsvFile(`agenda-fich-plan-semanal-${activeWeek}.csv`,csv);status(`Plan de ${formatWeek(activeWeek)} exportado con ${rows.length} comidas y sus ingredientes como instantáneas.`, 'success')}catch(error){status(`No se pudo exportar el plan: ${error?.message||'error desconocido'}. No se modificaron datos.`, 'error')}}
  function makeShell(trigger){const overlay=document.createElement('div');overlay.className='nutrition-plan-editor-overlay';overlay.id='nutritionWeeklyPlanEditor';const dialog=document.createElement('section');dialog.className='nutrition-plan-editor-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','nutritionWeeklyPlanTitle');dialog.tabIndex=-1;const head=document.createElement('header');head.className='nutrition-plan-editor-head';const heading=document.createElement('div');const h=document.createElement('h2');h.id='nutritionWeeklyPlanTitle';h.textContent='Planificar semana';const p=document.createElement('p');p.textContent='Plan con fechas propias, separado de tu rutina habitual. Las compras se generan desde las comidas guardadas aquí.';heading.append(h,p);const close=document.createElement('button');close.type='button';close.className='nutrition-plan-editor-close';close.textContent='Cerrar';close.addEventListener('click',closeModal);head.append(heading,close);const body=document.createElement('div');body.className='nutrition-plan-editor-body';dialog.append(head,body);overlay.append(dialog);overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()});dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeModal();return}if(e.key!=='Tab')return;const list=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(n=>n.offsetParent!==null);if(!list.length){e.preventDefault();dialog.focus();return}const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});document.body.append(overlay);dialog.focus();close.focus();return {overlay,dialog,body,trigger}}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function makeSelect(name,label,options){const wrap=el('label','nutrition-plan-field');wrap.appendChild(el('span','',label));const s=document.createElement('select');s.name=name;s.required=true;for(const o of options){const opt=document.createElement('option');opt.value=o.value;opt.textContent=o.label;s.appendChild(opt)}wrap.appendChild(s);return {wrap,control:s}}
  function makeField(name,label,type='text',placeholder=''){const wrap=el('label','nutrition-plan-field');wrap.appendChild(el('span','',label));const input=document.createElement('input');input.name=name;input.type=type;if(placeholder)input.placeholder=placeholder;if(type==='text')input.maxLength=160;wrap.appendChild(input);return {wrap,control:input}}
  function buildForm(){
    const form=document.createElement('form');form.className='nutrition-plan-edit-form';form.hidden=true;
    const day=makeSelect('day_offset','Día de la semana',DAY_NAMES.map((name,i)=>({value:String(i),label:name})));
    const type=makeSelect('meal_type','Categoría',MEALS.map(x=>({value:x[0],label:x[1]})));
    const templateOptions=[{value:'',label:'Comida manual (sin plantilla)'}];
    for(const m of templates)templateOptions.push({value:String(m.id),label:`${DAY_NAMES[Number(m.day)]||'Rutina'} · ${mealLabel(m.meal_type)} · ${clean(m.title)||'Sin título'}`.slice(0,180)});
    const source=makeSelect('source_meal_id','Copiar ingredientes de la rutina (opcional)',templateOptions);source.control.required=false;
    const recipeSource=makeSelect('source_recipe_id','O elegir una receta guardada (opcional)',[{value:'',label:'Sin receta guardada'}]);recipeSource.control.required=false;
    const recipeHelp=el('small','nutrition-plan-field-help','Al elegir una receta, las cantidades se ajustan a las porciones que planeás preparar. La comida guardará una instantánea para que las ediciones futuras de la receta no alteren este plan.');recipeSource.wrap.appendChild(recipeHelp);
    const portions=makeField('recipe_servings','Porciones de la receta','number');portions.control.min='0.1';portions.control.max='1000';portions.control.step='0.1';portions.control.value='1';portions.control.disabled=true;portions.control.required=false;
    const existingPortions=makeField('existing_recipe_servings','Ajustar porciones previstas','number');existingPortions.control.min='0.1';existingPortions.control.max='1000';existingPortions.control.step='0.1';existingPortions.control.required=false;existingPortions.control.disabled=true;existingPortions.wrap.classList.add('nutrition-plan-existing-portions');existingPortions.wrap.hidden=true;
    const existingPortionsHelp=el('small','nutrition-plan-existing-portions-help','Cambia solo esta comida planificada. La receta guardada no se modifica.');existingPortionsHelp.setAttribute('aria-live','polite');existingPortions.wrap.appendChild(existingPortionsHelp);
    source.control.addEventListener('change',()=>{if(source.control.value)recipeSource.control.value='';setRecipePortionState();applyTemplateToForm()});
    recipeSource.control.addEventListener('change',()=>{if(recipeSource.control.value)source.control.value='';setRecipePortionState();applyRecipeToForm()});
    existingPortions.control.addEventListener('input',updateExistingPortionsHelp);
    const title=makeField('title','Nombre de la comida','text','Ej.: Ensalada de arroz');title.control.required=true;title.control.maxLength=160;
    const time=makeField('planned_time','Horario (opcional)','time');
    const notesWrap=el('label','nutrition-plan-field nutrition-plan-field-wide');notesWrap.appendChild(el('span','','Notas (opcional)'));
    const notes=document.createElement('textarea');notes.name='notes';notes.maxLength=2000;notes.rows=2;notes.placeholder='Preparación, recordatorios o cambios…';notesWrap.appendChild(notes);
    const actions=el('div','nutrition-plan-form-actions');const save=document.createElement('button');save.type='submit';save.className='small-btn primary';save.textContent='Guardar comida';const cancel=document.createElement('button');cancel.type='button';cancel.className='small-btn';cancel.textContent='Cancelar';cancel.addEventListener('click',resetForm);actions.append(save,cancel);
    form.append(day.wrap,type.wrap,source.wrap,recipeSource.wrap,portions.wrap,existingPortions.wrap,title.wrap,time.wrap,notesWrap,actions);form.addEventListener('submit',saveForm);
    return {node:form,day:day.control,type:type.control,source:source.control,recipeSource:recipeSource.control,recipeHelp,portions:portions.control,existingPortions:existingPortions.control,existingPortionsWrap:existingPortions.wrap,existingPortionsHelp,title:title.control,time:time.control,notes,save};
  }
  function rebuildTemplateOptions(){if(!modal?.form)return;const select=modal.form.source;const keep=select.value;select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Comida manual (sin plantilla)';select.appendChild(blank);for(const m of templates){const o=document.createElement('option');o.value=String(m.id);o.textContent=`${DAY_NAMES[Number(m.day)]||'Rutina'} · ${mealLabel(m.meal_type)} · ${clean(m.title)||'Sin título'}`.slice(0,180);select.appendChild(o)}if(templates.some(m=>String(m.id)===keep))select.value=keep}
  function rebuildRecipeOptions(){if(!modal?.form)return;const select=modal.form.recipeSource;const keep=select.value;select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Sin receta guardada';select.appendChild(blank);for(const r of recipes){const o=document.createElement('option');o.value=String(r.id);o.textContent=clean(r.name).slice(0,160)||'Receta sin nombre';select.appendChild(o)}if(recipes.some(r=>String(r.id)===keep))select.value=keep}
  function setRecipePortionState(){if(!modal?.form)return;const active=!!modal.form.recipeSource.value;modal.form.portions.disabled=!active;modal.form.portions.required=active;if(!active){modal.form.portions.value='1';modal.form.recipeHelp.textContent='Al elegir una receta, las cantidades se ajustan a las porciones que planeás preparar. La comida guardará una instantánea para que las ediciones futuras de la receta no alteren este plan.'}else{modal.form.recipeHelp.textContent='Se escalan ingredientes y nutrientes según las porciones elegidas. La receta original no se modifica.'}setExistingPortionState()}
  function setExistingPortionState(){if(!modal?.form)return;const source=editRow?.nutrition_snapshot&&typeof editRow.nutrition_snapshot==='object'?editRow.nutrition_snapshot.source_recipe:null;const active=!!source&&!modal.form.source.value&&!modal.form.recipeSource.value;modal.form.existingPortionsWrap.hidden=!active;modal.form.existingPortions.disabled=!active;modal.form.existingPortions.required=active;if(active)updateExistingPortionsHelp()}
  function updateExistingPortionsHelp(){if(!modal?.form)return;const source=editRow?.nutrition_snapshot&&typeof editRow.nutrition_snapshot==='object'?editRow.nutrition_snapshot.source_recipe:null;const previous=safeNum(source?.planned_servings),next=safeNum(modal.form.existingPortions.value);if(!source||previous===null||previous<=0){modal.form.existingPortionsHelp.textContent='No hay un rendimiento válido para calcular el cambio de porciones.';return}if(next===null||next<0.1||next>1000){modal.form.existingPortionsHelp.textContent='Ingresá entre 0,1 y 1.000 porciones para ver el ajuste.';return}const factor=next/previous;modal.form.existingPortionsHelp.textContent=next===previous?'Se conservarán las cantidades y los nutrientes tal como están guardados.':`Se ajustarán cantidades y nutrientes conocidos ×${new Intl.NumberFormat('es-AR',{maximumFractionDigits:3}).format(factor)}. Los datos desconocidos seguirán marcados como incompletos; la receta original no cambia.`}
  function applyTemplateToForm(){if(!modal?.form)return;const m=templates.find(x=>String(x.id)===String(modal.form.source.value));if(!m)return;modal.form.title.value=clean(m.title);modal.form.type.value=MEALS.some(x=>x[0]===m.meal_type)?m.meal_type:'colacion';modal.form.time.value=/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(m.meal_time))?clean(m.meal_time):''}
  function applyRecipeToForm(){if(!modal?.form)return;const r=recipes.find(x=>String(x.id)===String(modal.form.recipeSource.value));if(!r)return;modal.form.title.value=clean(r.name).slice(0,160);setRecipePortionState();if(!clean(modal.form.notes.value)&&clean(r.notes))modal.form.notes.value=clean(r.notes).slice(0,2000)}
  function resetForm(){if(!modal)return;editRow=null;duplicateSourceRow=null;draftKey='';modal.form.node.reset();modal.form.source.value='';modal.form.recipeSource.value='';setRecipePortionState();modal.form.node.hidden=true;modal.form.save.textContent='Guardar comida';modal.add.hidden=false}
  function startAdd(day=0){if(!modal)return;editRow=null;duplicateSourceRow=null;draftKey=`manual:${id()}`;modal.form.node.reset();modal.form.day.value=String(day);modal.form.source.value='';modal.form.recipeSource.value='';setRecipePortionState();modal.form.node.hidden=false;modal.form.save.textContent='Guardar comida';modal.add.hidden=true;modal.form.title.focus()}
  function startEdit(row,focusPortions=false){if(!modal)return;draftKey='';duplicateSourceRow=null;editRow=row;const f=modal.form;f.node.reset();f.day.value=String(row.day_offset);f.type.value=row.meal_type;f.source.value=row.source_meal_id&&templates.some(m=>String(m.id)===String(row.source_meal_id))?String(row.source_meal_id):'';f.recipeSource.value='';f.title.value=clean(row.title);f.time.value=clean(row.planned_time);f.notes.value=clean(row.notes);const source=row.nutrition_snapshot&&typeof row.nutrition_snapshot==='object'?row.nutrition_snapshot.source_recipe:null;f.existingPortions.value=source&&safeNum(source.planned_servings)!==null?String(source.planned_servings):'';setRecipePortionState();if(source&&f.recipeHelp)f.recipeHelp.textContent=`Esta comida conserva la instantánea de «${clean(source.name)||'la receta'}» para ${safeNum(source.planned_servings)??'?'} porciones. Podés ajustar las porciones sin modificar la receta guardada.`;f.node.hidden=false;f.save.textContent='Guardar cambios';modal.add.hidden=true;(focusPortions&&source?f.existingPortions:f.title).focus()}
  function startDuplicate(row){
    if(!modal||busy||!row)return;
    editRow=null;duplicateSourceRow=row;draftKey=`manual:${id()}`;
    const f=modal.form;f.node.reset();f.day.value=String(row.day_offset);f.type.value=MEALS.some(x=>x[0]===row.meal_type)?row.meal_type:'colacion';
    f.source.value='';f.recipeSource.value='';f.portions.value='1';f.title.value=`${clean(row.title)||'Comida'} (copia)`.slice(0,160);
    f.time.value=clean(row.planned_time);f.notes.value=clean(row.notes);setRecipePortionState();
    f.node.hidden=false;f.save.textContent='Guardar copia';modal.add.hidden=true;f.title.focus();
    status('Editá el día o el horario de la copia si hace falta. Se conservan los ingredientes y la instantánea nutricional; la comida original no se modifica.','info');
  }
  async function loadTemplates(who){templates=[];templateItems=new Map();if(!window.AgendaNutritionPlanner?.loadPlan)return;const plan=await window.AgendaNutritionPlanner.loadPlan();assertOwner(who);templates=(Array.isArray(plan.meals)?plan.meals:[]).filter(m=>/^[0-9a-f-]{36}$/i.test(String(m.id)));templateItems=new Map();for(const meal of templates)templateItems.set(String(meal.id),(plan.byMeal?.get?.(String(meal.id))||[]).map(i=>({...i})));rebuildTemplateOptions()}
  async function loadSavedRecipes(who){recipes=[];const api=window.AgendaNutritionData;if(!api||typeof api.loadRecipes!=='function')throw new Error('El módulo de recetas guardadas no está disponible.');const loaded=await api.loadRecipes();assertOwner(who);recipes=(Array.isArray(loaded)?loaded:[]).filter(r=>r&&clean(r.id)&&clean(r.name));rebuildRecipeOptions()}
  async function readWeeklyTemplatePreferences(who){
    assertOwner(who);const client=await getClient();assertOwner(who);
    const result=await client.from('nutrition_preferences').select('user_id,weekly_plan_templates,updated_at').eq('user_id',who).maybeSingle();
    if(result.error){const message=String(result.error.message||'');if(/weekly_plan_templates|column .* does not exist|schema cache/i.test(message))throw new Error('Falta aplicar la migración sql/29-nutrition-weekly-plan-templates.sql en Supabase. No se guardó ni modificó ninguna plantilla.');throw result.error;}
    assertOwner(who);const data=result.data||null;
    return {row:data,templates:normalizeWeeklyTemplates(data?.weekly_plan_templates||[]),revision:String(data?.updated_at||'')};
  }
  async function writeWeeklyTemplatePreferences(who,current,nextTemplates){
    assertOwner(who);const client=await getClient();assertOwner(who);const normalized=normalizeWeeklyTemplates(nextTemplates);const serialized=JSON.stringify(normalized);
    if(serialized.length>WEEK_TEMPLATE_JSON_LIMIT)throw new Error('Las plantillas superan el límite de almacenamiento seguro. Eliminá alguna o guardá menos comidas.');
    if(current.row){if(!current.revision)throw new Error('No se puede comprobar la versión de las preferencias. Actualizá la página y volvé a intentarlo.');
      const result=await client.from('nutrition_preferences').update({weekly_plan_templates:normalized,updated_at:new Date().toISOString()}).eq('user_id',who).eq('updated_at',current.revision).select('user_id,weekly_plan_templates,updated_at').maybeSingle();
      if(result.error)throw result.error;if(!result.data)throw new Error('Las preferencias cambiaron desde que las abriste. Actualizá las plantillas y volvé a intentarlo.');assertOwner(who);return {row:result.data,templates:normalizeWeeklyTemplates(result.data.weekly_plan_templates||[]),revision:String(result.data.updated_at||'')};
    }
    const result=await client.from('nutrition_preferences').insert({user_id:who,weekly_plan_templates:normalized}).select('user_id,weekly_plan_templates,updated_at').single();
    if(result.error){if(result.error.code==='23505')throw new Error('Las preferencias se crearon en otra sesión. Actualizá las plantillas y volvé a intentarlo.');throw result.error;}
    if(!result.data)throw new Error('El servidor no confirmó el guardado de la plantilla.');assertOwner(who);return {row:result.data,templates:normalizeWeeklyTemplates(result.data.weekly_plan_templates||[]),revision:String(result.data.updated_at||'')};
  }
  async function loadSavedWeekTemplates(who){const pref=await readWeeklyTemplatePreferences(who);assertOwner(who);weeklyTemplates=pref.templates;weeklyTemplatesRevision=pref.revision;weeklyTemplatesLoaded=true;if(modal)renderSavedWeekTemplates(modal);return pref;}
  async function readRows(who,week){const c=await getClient();assertOwner(who);const all=[];for(let offset=0;offset<10000;offset+=250){const r=await c.from('nutrition_weekly_plan_items').select('id,user_id,week_start,day_offset,meal_type,title,planned_time,notes,source_meal_id,plan_key,sort_order,ingredients_snapshot,nutrition_snapshot,created_at,updated_at').eq('user_id',who).eq('week_start',week).order('day_offset',{ascending:true}).order('planned_time',{ascending:true,nullsFirst:false}).order('sort_order',{ascending:true}).range(offset,offset+249);if(r.error)throw r.error;assertOwner(who);const batch=Array.isArray(r.data)?r.data:[];all.push(...batch);if(batch.length<250)return all;}throw new Error('Hay demasiadas comidas planificadas para cargarlas en una sola vista. Exportá tus datos y revisá el plan.')}
  function setWeekControlsDisabled(shell,disabled){if(!shell)return;for(const control of [shell.date,shell.prev,shell.next,shell.refresh,shell.add,shell.import,shell.copyDayToggle,shell.weekTemplatesToggle])if(control)control.disabled=!!disabled;if(shell.export)shell.export.disabled=!!disabled||rows.length===0;if(!disabled&&shell.import)shell.import.disabled=rows.length>0||templates.length===0;for(const control of shell.grid?.querySelectorAll('button,select')||[])control.disabled=!!disabled;for(const control of shell.copyDayPanel?.querySelectorAll('button,select,input')||[])control.disabled=!!disabled;for(const control of shell.weekTemplatesPanel?.querySelectorAll('button,input,select,textarea')||[])control.disabled=!!disabled;if(!disabled&&shell.copyDayPanel){refreshCopyDayOptions(shell);updateCopyDayButtonState(shell)}if(!disabled&&shell.weekTemplatesPanel){updateWeeklyTemplateButtons(shell)}}
  async function loadWeek(force=false){if(!modal||(busy&&!force))return;const who=uid(),week=activeWeek,request=++token;const shell=modal;if(shell.weekTemplatesPreviewData)clearWeeklyTemplatePreview(shell,'La semana se está actualizando. Generá una vista previa nueva antes de aplicar una plantilla.');if(!who){rows=[];if(shell.export)shell.export.disabled=true;shell.grid.replaceChildren();status('Iniciá sesión para planificar una semana.','error');return}busy=true;if(shell.copyDayPreview)clearCopyDayPreview(shell,'La semana se está actualizando. Después de cargarla, generá una vista previa nueva.');rows=[];setWeekControlsDisabled(shell,true);shell.grid.setAttribute('aria-busy','true');shell.grid.replaceChildren();status('Cargando plan de la semana…');try{const found=await readRows(who,week);assertOwner(who);if(request!==token||modal!==shell)return;rows=found;let templateError='',recipeError='',weeklyTemplateError='';try{await loadTemplates(who)}catch(e){templateError=e?.message||'No se pudieron cargar las plantillas de la rutina'}try{await loadSavedWeekTemplates(who)}catch(e){weeklyTemplateError=e?.message||'No se pudieron cargar las plantillas semanales'}try{await loadSavedRecipes(who)}catch(e){recipes=[];rebuildRecipeOptions();recipeError=e?.message||'No se pudieron cargar las recetas guardadas'}assertOwner(who);if(request!==token||modal!==shell)return;rebuildTemplateOptions();rebuildRecipeOptions();renderWeek();renderSavedWeekTemplates(shell);const warnings=[templateError?'No se pudieron cargar las plantillas de la rutina; podés seguir editando el plan.':'',weeklyTemplateError?`${weeklyTemplateError} La planificación normal sigue disponible.`:'',recipeError?'No se pudieron cargar las recetas guardadas; podés seguir usando comidas manuales y la rutina.':''].filter(Boolean);status(`${formatWeek(week)} · ${rows.length} comidas planificadas.${warnings.length?' '+warnings.join(' '):''}`,warnings.length?'info':'success');shell.import.disabled=rows.length>0||templates.length===0;updateWeeklyTemplateButtons(shell)}catch(error){if(request===token&&modal===shell){status(`No se pudo cargar el plan semanal: ${error?.message||'error desconocido'}. No se modificaron registros.`, 'error');shell.grid.replaceChildren()}}finally{if(modal===shell){busy=false;setWeekControlsDisabled(shell,false);shell.grid.removeAttribute('aria-busy');if(authReloadPending){authReloadPending=false;setTimeout(()=>{if(modal===shell)loadWeek(true)},0)}}}}
  function renderWeek(){
    if(!modal)return;modal.grid.replaceChildren();
    for(let day=0;day<7;day++){
      const dayRows=orderedDayRows(rows,day);
      const card=el('article','nutrition-plan-day-card');const header=el('header','nutrition-plan-day-header');const h=el('h3','',DAY_NAMES[day]);
      header.append(h,el('span','nutrition-plan-count',String(dayRows.length)));card.appendChild(header);
      if(!dayRows.length)card.appendChild(el('p','nutrition-plan-empty','Sin comidas planificadas.'));
      for(const row of dayRows){
        const item=el('article','nutrition-plan-meal');item.dataset.mealId=String(row.id);
        const title=el('strong','',clean(row.title)||'Comida sin nombre');
        const meta=el('p','',`${mealLabel(row.meal_type)}${row.planned_time?` · ${row.planned_time}`:''} · ${(Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot.length:0)} ingredientes`);item.append(title,meta);
        const recipeSnapshot=row.nutrition_snapshot&&typeof row.nutrition_snapshot==='object'?row.nutrition_snapshot:{};const recipeSource=recipeSnapshot.source_recipe||null;
        if(recipeSource&&clean(recipeSource.name))item.appendChild(el('p','nutrition-plan-source-meta',`Receta: ${clean(recipeSource.name)} · ${safeNum(recipeSource.planned_servings)??'?'} de ${safeNum(recipeSource.yield_servings)??'?'} porciones · ingredientes guardados como instantánea`));
        const summary=nutritionSummary(recipeSnapshot);if(summary)item.appendChild(el('p','nutrition-plan-nutrition-summary',`Nutrición guardada: ${summary}`));
        const missingNutrients=Array.isArray(recipeSnapshot.nutrition_missing_metrics)?recipeSnapshot.nutrition_missing_metrics:[];
        if(missingNutrients.length)item.appendChild(el('p','e25-recipe-data-warning','Datos nutricionales incompletos: '+missingNutrients.map(key=>({calories:'energía',protein:'proteínas',carbs:'carbohidratos',fat:'grasas',fiber:'fibra'}[key]||key)).join(', ')+'. Revisá los alimentos de la receta.'));
        if(clean(row.notes))item.appendChild(el('p','nutrition-plan-note',clean(row.notes)));
        const actions=el('div','nutrition-plan-row-actions');
        const edit=document.createElement('button');edit.type='button';edit.className='small-btn';edit.textContent='Editar';edit.addEventListener('click',()=>startEdit(row));
        if(recipeSource&&safeNum(recipeSource.planned_servings)!==null){const adjust=document.createElement('button');adjust.type='button';adjust.className='small-btn nutrition-plan-adjust-portions-e30';adjust.textContent='Ajustar porciones';adjust.setAttribute('aria-label',`Ajustar porciones para ${clean(row.title)||'comida sin nombre'}`);adjust.addEventListener('click',()=>startEdit(row,true));actions.appendChild(adjust)}
        const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='small-btn';duplicate.textContent='Duplicar';duplicate.setAttribute('aria-label',`Duplicar ${clean(row.title)||'comida sin nombre'}`);duplicate.addEventListener('click',()=>startDuplicate(row));
        const organize=document.createElement('button');organize.type='button';organize.className='small-btn';organize.textContent='Mover / organizar';organize.setAttribute('aria-expanded','false');
        const transferId=`nutrition-plan-transfer-${String(row.id).replace(/[^a-zA-Z0-9_-]/g,'')}`;organize.setAttribute('aria-controls',transferId);
        const transfer=el('div','nutrition-plan-transfer');transfer.id=transferId;transfer.hidden=true;
        const transferLabel=el('label','nutrition-plan-transfer-label');transferLabel.appendChild(el('span','',`Destino para «${clean(row.title)||'comida sin nombre'}»`));
        const target=document.createElement('select');target.setAttribute('aria-label',`Día de destino para ${clean(row.title)||'comida sin nombre'}`);
        DAY_NAMES.forEach((name,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=name;target.appendChild(option)});target.value=String(row.day_offset);transferLabel.appendChild(target);
        const transferActions=el('div','nutrition-plan-transfer-actions');
        const move=document.createElement('button');move.type='button';move.className='small-btn primary';move.textContent='Mover comida';move.setAttribute('aria-label',`Mover ${clean(row.title)||'comida'} al día seleccionado`);move.addEventListener('click',()=>movePlanRow(row,target.value));
        const copy=document.createElement('button');copy.type='button';copy.className='small-btn';copy.textContent='Duplicar en este día';copy.setAttribute('aria-label',`Duplicar ${clean(row.title)||'comida'} en el día seleccionado`);copy.addEventListener('click',()=>duplicatePlanRow(row,target.value));
        const cancel=document.createElement('button');cancel.type='button';cancel.className='small-btn';cancel.textContent='Cancelar';cancel.addEventListener('click',()=>{transfer.hidden=true;organize.setAttribute('aria-expanded','false');organize.focus()});
        transferActions.append(move,copy,cancel);transfer.append(transferLabel,el('p','nutrition-plan-transfer-help','Mover conserva ingredientes y nutrientes, y cambia solo el día. Duplicar crea una copia independiente; después podés editarla. La lista de compras se actualiza cuando volvés a generar su vista previa.'));transfer.appendChild(transferActions);
        organize.addEventListener('click',()=>{const opening=transfer.hidden;transfer.hidden=!opening;organize.setAttribute('aria-expanded',String(opening));if(opening)target.focus()});
        const del=document.createElement('button');del.type='button';del.className='small-btn';del.textContent='Quitar';del.addEventListener('click',()=>deleteRow(row));
        actions.append(edit,duplicate,organize,del);item.append(actions,transfer);card.appendChild(item);
      }
      const add=document.createElement('button');add.type='button';add.className='nutrition-plan-add-day';add.textContent=`＋ Agregar a ${DAY_NAMES[day].toLocaleLowerCase('es')}`;add.addEventListener('click',()=>startAdd(day));card.appendChild(add);modal.grid.appendChild(card);
    }
    refreshCopyDayOptions(modal);
  }
  function finishBusy(shell){busy=false;if(modal===shell&&authReloadPending){authReloadPending=false;setTimeout(()=>{if(modal===shell)loadWeek(true)},0)}}
  async function saveForm(event){
    event.preventDefault();if(!modal||busy)return;
    const shell=modal,who=uid(),week=activeWeek;let payload;
    try{assertOwner(who);payload=formRowPayload(shell.form.node,who,week,editRow,duplicateSourceRow)}catch(e){status(e.message,'error');return}
    const editing=editRow,duplicating=!!duplicateSourceRow;busy=true;setWeekControlsDisabled(shell,true);shell.form.save.disabled=true;
    shell.form.save.textContent=editing?'Guardando cambios…':duplicating?'Guardando copia…':'Guardando comida…';
    try{
      const client=await getClient();assertOwner(who);
      if(editing){
        let query=client.from('nutrition_weekly_plan_items').update(payload).eq('id',String(editing.id)).eq('user_id',who).eq('week_start',week);
        if(editing.updated_at!==null&&editing.updated_at!==undefined&&String(editing.updated_at)!=='')query=query.eq('updated_at',editing.updated_at);else query=query.is('updated_at',null);
        const result=await query.select('id').single();
        if(result.error){if(result.error.code==='PGRST116'){const stale=new Error('Esta comida cambió desde que abriste el editor.');stale.code='STALE_WEEK_ROW';throw stale}throw result.error}
        if(!result.data){const stale=new Error('Esta comida cambió desde que abriste el editor.');stale.code='STALE_WEEK_ROW';throw stale}
      }else{
        const result=await client.from('nutrition_weekly_plan_items').upsert(payload,{onConflict:'user_id,week_start,plan_key'}).select('id').single();
        if(result.error)throw result.error;if(!result.data)throw new Error('El servidor no confirmó el guardado.');
      }
      assertOwner(who);resetForm();await loadWeek(true);
      if(modal===shell){const recipeSource=payload.nutrition_snapshot&&typeof payload.nutrition_snapshot==='object'?payload.nutrition_snapshot.source_recipe:null;status(`${duplicating?'Copia creada y confirmada por Supabase. La comida original no se modificó.':'Comida planificada y confirmada por Supabase.'}${recipeSource?` La instantánea conserva «${clean(recipeSource.name)}» para ${recipeSource.planned_servings} porciones.`:''} Regenerá la lista de compras si necesitás reflejar este cambio.`, 'success')}
    }catch(error){
      if(modal===shell&&error?.code==='STALE_WEEK_ROW'){
        try{await loadWeek(true)}catch(_){}
        const fresh=rows.find(row=>String(row.id)===String(editing?.id));if(fresh)editRow=fresh;
        status('Esta comida cambió en el servidor. No sobrescribí la versión más reciente. Tus cambios del formulario siguen aquí sin guardar; revisalos y volvé a pulsar «Guardar cambios» si corresponde.','error');
      }else if(modal===shell)status(`No se pudo guardar la comida: ${error?.message||'error desconocido'}. El estado no se presenta como guardado; podés reintentar.`, 'error');
    }finally{
      finishBusy(shell);
      if(modal===shell){setWeekControlsDisabled(shell,false);shell.form.save.disabled=false;shell.form.save.textContent=editRow?'Guardar cambios':duplicateSourceRow?'Guardar copia':'Guardar comida'}
    }
  }
  function nextSortForDay(day,excludingId=''){
    const current=rows.filter(item=>Number(item.day_offset)===Number(day)&&String(item.id)!==String(excludingId)).map(item=>safeNum(item.sort_order)).filter(v=>v!==null);
    return current.length?Math.max(...current)+1:0;
  }
  async function readCurrentPlanRow(client,row,who,week){
    assertOwner(who);
    const result=await client.from('nutrition_weekly_plan_items').select('id,user_id,week_start,day_offset,meal_type,title,planned_time,notes,source_meal_id,plan_key,sort_order,ingredients_snapshot,nutrition_snapshot,updated_at').eq('id',String(row.id)).eq('user_id',who).eq('week_start',week).single();
    if(result.error)throw result.error;if(!result.data)throw new Error('La comida ya no está disponible. Actualizá la semana e intentá de nuevo.');
    assertOwner(who);
    if(String(result.data.updated_at||'')!==String(row.updated_at||''))throw new Error('Esta comida cambió desde que se cargó la semana. Actualicé los datos; revisá el plan y volvé a intentarlo.');
    return result.data;
  }
  async function movePlanRow(row,targetDay){
    if(!modal||busy)return;const day=Number(targetDay);if(!Number.isInteger(day)||day<0||day>6){status('Elegí un día de destino válido.','error');return}
    if(day===Number(row.day_offset)){status('La comida ya está en ese día. No se hicieron cambios.','info');return}
    const shell=modal,who=uid(),week=activeWeek;let success=false;
    try{
      assertOwner(who);if(!rows.some(item=>String(item.id)===String(row.id)&&String(item.updated_at||'')===String(row.updated_at||'')))throw new Error('Esta comida ya cambió en la vista. Actualizá la semana antes de moverla.');
      busy=true;setWeekControlsDisabled(shell,true);status('Moviendo la comida y comprobando la versión guardada…','info');
      const client=await getClient();assertOwner(who);await readCurrentPlanRow(client,row,who,week);
      const payload=movePlanPayload(row,day,week,who,`manual:${id()}`,nextSortForDay(day,String(row.id)),new Date().toISOString());
      let query=client.from('nutrition_weekly_plan_items').update(payload).eq('id',String(row.id)).eq('user_id',who).eq('week_start',week);
      if(row.updated_at!==null&&row.updated_at!==undefined&&String(row.updated_at)!=='')query=query.eq('updated_at',row.updated_at);else query=query.is('updated_at',null);
      const result=await query.select('id').single();if(result.error)throw result.error;if(!result.data)throw new Error('El servidor no confirmó el movimiento.');assertOwner(who);success=true;
      await loadWeek(true);if(modal===shell)status(`«${clean(row.title)||'La comida'}» se movió a ${DAY_NAMES[day]}. Se conservaron ingredientes y nutrientes; regenerá la lista de compras para reflejar el cambio.`,'success');
    }catch(error){if(modal===shell){try{await loadWeek(true)}catch(_){}status(`No se pudo mover la comida: ${error?.message||'error desconocido'}. No se presenta el cambio como guardado.`, 'error')}}
    finally{if(modal===shell&&!success)setWeekControlsDisabled(shell,false);finishBusy(shell)}
  }
  async function duplicatePlanRow(row,targetDay){
    if(!modal||busy)return;const day=Number(targetDay);if(!Number.isInteger(day)||day<0||day>6){status('Elegí un día de destino válido.','error');return}
    const shell=modal,who=uid(),week=activeWeek,keyMap=`${row.id}:${week}:${day}`;let success=false;
    try{
      assertOwner(who);if(!rows.some(item=>String(item.id)===String(row.id)&&String(item.updated_at||'')===String(row.updated_at||'')))throw new Error('Esta comida ya cambió en la vista. Actualizá la semana antes de duplicarla.');
      busy=true;setWeekControlsDisabled(shell,true);status('Preparando una copia independiente…','info');
      const client=await getClient();assertOwner(who);const source=await readCurrentPlanRow(client,row,who,week);
      let operationKey=duplicateOperationKeys.get(keyMap);if(!operationKey){operationKey=`manual:copy:${id()}`;duplicateOperationKeys.set(keyMap,operationKey)}
      const payload=duplicatePlanPayload(source,day,week,who,operationKey,nextSortForDay(day),new Date().toISOString());
      const result=await client.from('nutrition_weekly_plan_items').upsert(payload,{onConflict:'user_id,week_start,plan_key'}).select('id').single();if(result.error)throw result.error;if(!result.data)throw new Error('El servidor no confirmó la copia. Podés reintentar sin crear otra copia con esta operación.');assertOwner(who);success=true;duplicateOperationKeys.delete(keyMap);
      await loadWeek(true);if(modal===shell)status(`Se creó «${clean(payload.title)}» en ${DAY_NAMES[day]}. La comida original y su historial permanecen intactos. Regenerá la lista de compras si corresponde.`,'success');
    }catch(error){if(modal===shell){try{await loadWeek(true)}catch(_){}status(`No se pudo duplicar la comida: ${error?.message||'error desconocido'}. La operación no se informa como completada.`, 'error')}}
    finally{if(modal===shell&&!success)setWeekControlsDisabled(shell,false);finishBusy(shell)}
  }
  async function deleteRow(row){if(!modal||busy||!confirm(`¿Quitar «${row.title}» de la semana? La comida habitual no se modifica.`))return;const shell=modal,who=uid(),week=activeWeek;try{assertOwner(who);busy=true;setWeekControlsDisabled(shell,true);const c=await getClient();assertOwner(who);const res=await c.from('nutrition_weekly_plan_items').delete().eq('id',String(row.id)).eq('user_id',who).eq('week_start',week).select('id').single();if(res.error)throw res.error;if(!res.data)throw new Error('El servidor no confirmó la eliminación.');assertOwner(who);await loadWeek(true);if(modal===shell)status('Comida quitada del plan semanal. La rutina habitual y el historial no fueron modificados. Regenerá la lista de compras si corresponde.','success')}catch(error){if(modal===shell)status(`No se pudo quitar la comida: ${error?.message||'error desconocido'}.`,'error')}finally{finishBusy(shell);if(modal===shell)setWeekControlsDisabled(shell,false)}}
  async function importRoutine(){if(!modal||busy)return;const shell=modal,who=uid(),week=activeWeek;if(rows.length){status('La semana ya tiene comidas. No se sobrescribió nada; agregá o editá comidas individualmente.','error');return}if(!templates.length){status('No hay comidas en la rutina habitual para copiar.','error');return}if(!confirm(`¿Copiar ${templates.length} comidas de tu rutina habitual a la semana ${formatWeek(week)}? Esto crea una planificación fechada y no modifica la rutina.`))return;busy=true;setWeekControlsDisabled(shell,true);status('Copiando la rutina a la semana…');try{assertOwner(who);const payloads=[];for(const meal of templates){const day=Number(meal.day);if(!Number.isInteger(day)||day<0||day>6)continue;payloads.push(templatePlanPayload(meal,day,week,who))}if(!payloads.length)throw new Error('No se encontraron comidas de rutina válidas.');const c=await getClient();assertOwner(who);const res=await c.from('nutrition_weekly_plan_items').upsert(payloads,{onConflict:'user_id,week_start,plan_key',ignoreDuplicates:true}).select('id');if(res.error)throw res.error;assertOwner(who);await loadWeek(true);if(modal===shell)status(`Rutina copiada: ${Array.isArray(res.data)?res.data.length:payloads.length} comidas agregadas. Podés ajustar cada día sin cambiar tu rutina habitual.`,'success')}catch(error){if(modal===shell)status(`No se pudo copiar la rutina: ${error?.message||'error desconocido'}. No se informa como completada; comprobá la semana antes de reintentar.`,'error')}finally{finishBusy(shell);if(modal===shell)setWeekControlsDisabled(shell,false)}}
  function changeWeek(delta){if(!modal||busy)return;activeWeek=addDays(activeWeek,delta);modal.date.value=activeWeek;resetForm();loadWeek()}
  function clearCopyDayPreview(shell,message=''){
    if(!shell?.copyDayPanel)return;shell.copyDayPreview=null;shell.copyDayOperationKey='';shell.copyDayConfirm.disabled=true;shell.copyDayPreviewBox.hidden=true;shell.copyDayPreviewList.replaceChildren();shell.copyDayPreviewSummary.textContent=message||'Elegí los días y generá una vista previa. Todavía no se guardó ningún cambio.';
  }
  function refreshCopyDayOptions(shell){
    if(!shell?.copyDaySource||!shell.copyDayTarget)return;const oldSource=shell.copyDaySource.value,oldTarget=shell.copyDayTarget.value;const counts=Array.from({length:7},(_,day)=>rows.filter(row=>Number(row.day_offset)===day).length);
    shell.copyDaySource.replaceChildren();for(let day=0;day<7;day++){const option=document.createElement('option');option.value=String(day);option.textContent=`${DAY_NAMES[day]} · ${counts[day]} ${counts[day]===1?'comida':'comidas'}`;option.disabled=counts[day]===0;shell.copyDaySource.appendChild(option)}
    const chosenSource=Number.isInteger(Number(oldSource))&&counts[Number(oldSource)]>0?Number(oldSource):counts.findIndex(count=>count>0);if(chosenSource>=0)shell.copyDaySource.value=String(chosenSource);else shell.copyDaySource.value='0';
    shell.copyDayTarget.replaceChildren();for(let day=0;day<7;day++){const option=document.createElement('option');option.value=String(day);option.textContent=`${DAY_NAMES[day]} · ${counts[day]} existentes`;option.disabled=day===chosenSource;shell.copyDayTarget.appendChild(option)}
    let chosenTarget=Number(oldTarget);if(!Number.isInteger(chosenTarget)||chosenTarget<0||chosenTarget>6||chosenTarget===chosenSource){chosenTarget=(chosenSource+1)%7}shell.copyDayTarget.value=String(chosenTarget);
    shell.copyDayToggle.disabled=counts.reduce((a,b)=>a+b,0)===0;shell.copyDaySource.disabled=counts.reduce((a,b)=>a+b,0)===0;shell.copyDayTarget.disabled=counts.reduce((a,b)=>a+b,0)===0;
    updateCopyDayButtonState(shell);
  }
  function updateCopyDayButtonState(shell){if(!shell?.copyDayConfirm)return;shell.copyDayPreviewBtn.disabled=busy||!rows.some(row=>Number(row.day_offset)===Number(shell.copyDaySource.value));shell.copyDayConfirm.disabled=busy||!shell.copyDayPreview}
  function buildCopyDayPanel(){
    const panel=el('section','nutrition-plan-copy-day-panel');panel.id='nutritionPlanCopyDayPanel';panel.hidden=true;panel.setAttribute('aria-labelledby','nutritionPlanCopyDayTitle');
    const heading=el('h3','','Copiar un día completo');const intro=el('p','nutrition-plan-copy-day-intro','Reutilizá un día en otro. Las comidas del destino se conservan; cada comida copiada tendrá una identidad independiente.');
    const fields=el('div','nutrition-plan-copy-day-fields');const sourceLabel=el('label','nutrition-plan-field');sourceLabel.appendChild(el('span','','Día de origen'));const source=document.createElement('select');source.setAttribute('aria-label','Día de origen para copiar');sourceLabel.appendChild(source);
    const targetLabel=el('label','nutrition-plan-field');targetLabel.appendChild(el('span','','Día de destino'));const target=document.createElement('select');target.setAttribute('aria-label','Día de destino de la copia');targetLabel.appendChild(target);fields.append(sourceLabel,targetLabel);
    const previewBox=el('div','nutrition-plan-copy-day-preview');previewBox.hidden=true;previewBox.setAttribute('role','region');previewBox.setAttribute('aria-label','Vista previa de copia de día');previewBox.setAttribute('aria-live','polite');const summary=el('p','nutrition-plan-copy-day-preview-summary','Elegí los días y generá una vista previa. Todavía no se guardó ningún cambio.');const list=document.createElement('ul');list.className='nutrition-plan-copy-day-preview-list';previewBox.append(summary,list);
    const actions=el('div','nutrition-plan-copy-day-actions');const previewButton=document.createElement('button');previewButton.type='button';previewButton.className='small-btn';previewButton.textContent='Previsualizar copia';const confirmButton=document.createElement('button');confirmButton.type='button';confirmButton.className='small-btn primary';confirmButton.textContent='Copiar comidas';confirmButton.disabled=true;const cancelButton=document.createElement('button');cancelButton.type='button';cancelButton.className='small-btn';cancelButton.textContent='Cerrar';
    previewButton.addEventListener('click',previewCopyDay);confirmButton.addEventListener('click',commitCopyDay);cancelButton.addEventListener('click',()=>{panel.hidden=true;clearCopyDayPreview(modal);if(modal?.copyDayToggle){modal.copyDayToggle.setAttribute('aria-expanded','false');modal.copyDayToggle.focus()}});
    const changed=()=>{clearCopyDayPreview(modal,'Cambiaste los días. Generá una nueva vista previa; todavía no se guardó nada.')};source.addEventListener('change',()=>{if(Number(target.value)===Number(source.value))target.value=String((Number(source.value)+1)%7);refreshCopyDayOptions(modal);changed()});target.addEventListener('change',changed);
    actions.append(previewButton,confirmButton,cancelButton);panel.append(heading,intro,fields,previewBox,actions);
    return {panel,source,target,previewBox,summary,list,previewButton,confirmButton,cancelButton};
  }
  function previewCopyDay(){
    if(!modal||busy)return;const shell=modal;if(!shell.form.node.hidden){status('Guardá o cancelá la comida que estás editando antes de copiar un día.','error');return}
    const from=Number(shell.copyDaySource.value),to=Number(shell.copyDayTarget.value);if(!Number.isInteger(from)||from<0||from>6||!Number.isInteger(to)||to<0||to>6||from===to){clearCopyDayPreview(shell,'Elegí dos días distintos y válidos.');status('El día de origen y el de destino deben ser distintos.','error');return}
    const source=orderedDayRows(rows,from),destination=orderedDayRows(rows,to);if(!source.length){clearCopyDayPreview(shell,'El día elegido no tiene comidas para copiar.');status('Elegí un día de origen que tenga al menos una comida.','error');return}
    const stats=dayCopyStats(source),operationKey=`daycopy-${id()}`;shell.copyDayOperationKey=operationKey;shell.copyDayPreview={week:activeWeek,who:uid(),sourceDay:from,targetDay:to,sourceSignature:dayRowsSignature(rows,from),targetSignature:dayRowsSignature(rows,to),sourceIds:source.map(row=>String(row.id)),operationKey};
    shell.copyDayPreviewBox.hidden=false;shell.copyDayPreviewSummary.textContent=`Se agregarán ${stats.meals} comidas de ${DAY_NAMES[from]} a ${DAY_NAMES[to]}, con ${stats.ingredients} ingredientes en total. El destino ya tiene ${destination.length} ${destination.length===1?'comida':'comidas'} y ninguna será reemplazada.`;
    shell.copyDayPreviewList.replaceChildren();for(const row of source){const li=document.createElement('li');const title=el('strong','',clean(row.title)||'Comida sin nombre');const meta=el('span','',`${mealLabel(row.meal_type)}${row.planned_time?` · ${row.planned_time}`:''} · ${(Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot.filter(item=>item&&clean(item.name)).length:0)} ingredientes`);li.append(title,meta);if(row.nutrition_snapshot&&Array.isArray(row.nutrition_snapshot.nutrition_missing_metrics)&&row.nutrition_snapshot.nutrition_missing_metrics.length)li.appendChild(el('small','nutrition-plan-copy-day-warning','Información nutricional incompleta'));shell.copyDayPreviewList.appendChild(li)}
    const notices=[];if(stats.unknownQuantities)notices.push(`${stats.unknownQuantities} ingredientes sin cantidad definida`);if(stats.incompleteNutrition)notices.push(`${stats.incompleteNutrition} comidas con nutrientes incompletos`);if(notices.length){const li=el('li','nutrition-plan-copy-day-warning',`Aviso: ${notices.join(' y ')}; esos datos seguirán identificados como incompletos.`);shell.copyDayPreviewList.appendChild(li)}shell.copyDayConfirm.textContent=`Copiar ${stats.meals} ${stats.meals===1?'comida':'comidas'}`;shell.copyDayConfirm.disabled=false;status(`Vista previa preparada: ${stats.meals} comidas. Todavía no se guardó ningún cambio.`,'info');
  }
  async function commitCopyDay(){
    if(!modal||busy)return;const shell=modal,preview=shell.copyDayPreview;if(!preview){status('Generá una vista previa antes de copiar.','error');return}if(!shell.form.node.hidden){status('Guardá o cancelá la comida que estás editando antes de copiar un día.','error');return}
    const who=uid(),week=activeWeek;if(preview.who!==who||preview.week!==week||preview.sourceDay!==Number(shell.copyDaySource.value)||preview.targetDay!==Number(shell.copyDayTarget.value)){clearCopyDayPreview(shell,'La cuenta, la semana o los días cambiaron. Volvé a previsualizar.');status('La vista previa ya no coincide con el plan actual.','error');return}
    if(dayRowsSignature(rows,preview.sourceDay)!==preview.sourceSignature||dayRowsSignature(rows,preview.targetDay)!==preview.targetSignature){clearCopyDayPreview(shell,'La semana cambió. Actualizá y generá una nueva vista previa.');status('El plan cambió desde la vista previa. No se copió nada. Actualizá y revisá los cambios.','error');return}
    busy=true;setWeekControlsDisabled(shell,true);status('Verificando el origen y el destino antes de copiar…','info');let success=false;
    try{
      assertOwner(who);const client=await getClient();assertOwner(who);const latest=await readRows(who,week);assertOwner(who);
      const expectedKeys=preview.sourceIds.map(rowId=>dayCopyPlanKey(preview.operationKey,rowId));const existingDestinationKeys=new Set(latest.filter(row=>Number(row.day_offset)===preview.targetDay).map(row=>String(row.plan_key||'')));
      if(expectedKeys.length&&expectedKeys.every(key=>existingDestinationKeys.has(key))){
        const recoveredCount=expectedKeys.length;shell.copyDayPreview=null;shell.copyDayOperationKey='';shell.copyDayPanel.hidden=true;shell.copyDayToggle.setAttribute('aria-expanded','false');await loadWeek(true);
        if(modal===shell){shell.copyDayToggle.focus();status(`El servidor confirma que la copia de ${recoveredCount} ${recoveredCount===1?'comida ya estaba':'comidas ya estaban'} guardada. No se generaron duplicados; el plan se volvió a cargar.`,'success')}
        return;
      }
      if(dayRowsSignature(latest,preview.sourceDay)!==preview.sourceSignature||dayRowsSignature(latest,preview.targetDay)!==preview.targetSignature){await loadWeek(true);if(modal===shell)status('El origen o el destino cambió desde la vista previa. No se copió nada; revisá los datos nuevos y generá otra vista previa.','error');return}
      const sourceRows=orderedDayRows(latest,preview.sourceDay),targetRows=orderedDayRows(latest,preview.targetDay);const payloads=copyDayPlanPayloads(sourceRows,preview.sourceDay,preview.targetDay,week,who,preview.operationKey,targetRows,new Date().toISOString());
      const response=await client.from('nutrition_weekly_plan_items').upsert(payloads,{onConflict:'user_id,week_start,plan_key',ignoreDuplicates:true}).select('id,plan_key');if(response.error)throw response.error;assertOwner(who);
      const saved=await readRows(who,week);assertOwner(who);const savedKeys=new Set(saved.map(row=>String(row.plan_key||'')));const missing=payloads.filter(row=>!savedKeys.has(row.plan_key));if(missing.length)throw new Error(`El servidor todavía no confirma ${missing.length} ${missing.length===1?'comida':'comidas'} de la copia. Podés reintentar la misma vista previa sin duplicar lo ya guardado.`);
      success=true;const copiedCount=payloads.length;shell.copyDayPreview=null;shell.copyDayOperationKey='';shell.copyDayPanel.hidden=true;shell.copyDayToggle.setAttribute('aria-expanded','false');await loadWeek(true);if(modal===shell){shell.copyDayToggle.focus();status(`Se copiaron ${copiedCount} ${copiedCount===1?'comida':'comidas'} de ${DAY_NAMES[preview.sourceDay]} a ${DAY_NAMES[preview.targetDay]}. Las comidas que ya existían en el destino se conservaron. Regenerá la vista previa de compras si corresponde.`,'success')}
    }catch(error){if(modal===shell)status(`No se pudo confirmar la copia: ${error?.message||'error desconocido'}. La vista previa y su clave de reintento se conservaron; reintentá sin generar una operación nueva.`,'error')}
    finally{finishBusy(shell);if(modal===shell)setWeekControlsDisabled(shell,false)}
  }
  function buildWeekTemplatesPanel(){
    const panel=el('section','nutrition-week-templates-panel-e32');panel.id='nutritionWeekTemplatesPanelE32';panel.hidden=true;panel.setAttribute('aria-labelledby','nutritionWeekTemplatesTitleE32');
    const heading=el('h3','','Plantillas semanales');heading.id='nutritionWeekTemplatesTitleE32';
    const intro=el('p','nutrition-week-templates-intro-e32','Guardá una semana como plantilla reutilizable por tu cuenta. Al aplicarla a otra semana, se agrega solo en los días vacíos; los días con comidas propias se conservan y se marcan como omitidos.');
    const saveRow=el('div','nutrition-week-templates-save-row-e32');const nameLabel=el('label','nutrition-plan-field');nameLabel.appendChild(el('span','','Nombre de la plantilla'));const name=document.createElement('input');name.type='text';name.maxLength=80;name.placeholder='Ej.: Semana de cursada';name.setAttribute('aria-label','Nombre de la plantilla semanal');nameLabel.appendChild(name);
    const save=document.createElement('button');save.type='button';save.className='small-btn primary';save.textContent='Guardar semana actual';save.addEventListener('click',saveCurrentWeekTemplate);saveRow.append(nameLabel,save);
    const help=el('p','nutrition-week-templates-help-e32','Las plantillas se sincronizan con tu cuenta mediante Supabase. Requiere la migración sql/29-nutrition-weekly-plan-templates.sql. Máximo: 12 plantillas y 80 comidas por plantilla.');
    const mergeLabel=el('label','nutrition-week-template-merge-option-e33');const mergeToggle=document.createElement('input');mergeToggle.type='checkbox';mergeToggle.checked=false;mergeToggle.setAttribute('aria-describedby','nutritionWeekTemplateMergeHelpE33');const mergeText=el('span','','Combinar también en días ocupados');mergeLabel.append(mergeToggle,mergeText);const mergeHelp=el('p','nutrition-week-template-merge-help-e33','Desactivado: se omiten días con comidas. Activado: se agregan solo las comidas faltantes y se conservan todas las que ya existen. No se reemplaza ni elimina ningún registro.');mergeHelp.id='nutritionWeekTemplateMergeHelpE33';mergeToggle.addEventListener('change',()=>clearWeeklyTemplatePreview(modal,'Cambiaste el modo de aplicación. Generá una nueva vista previa antes de confirmar. No se modificó el plan.'));
    const list=el('div','nutrition-week-templates-list-e32');list.setAttribute('aria-label','Plantillas guardadas');
    const comparePanel=el('section','nutrition-week-template-compare-e35');comparePanel.id='nutritionWeekTemplateCompareE35';comparePanel.hidden=true;comparePanel.setAttribute('aria-labelledby','nutritionWeekTemplateCompareTitleE35');comparePanel.setAttribute('aria-live','polite');
    const compareTitle=el('h4','','Comparar plantillas');compareTitle.id='nutritionWeekTemplateCompareTitleE35';
    const compareSummary=el('p','nutrition-week-template-compare-summary-e35','Elegí dos plantillas para comparar sus comidas, ingredientes y nutrientes.');
    const compareDifferences=el('div','nutrition-week-template-compare-differences-e35');
    const compareClear=document.createElement('button');compareClear.type='button';compareClear.className='small-btn';compareClear.textContent='Limpiar comparación';compareClear.addEventListener('click',()=>{shellSafeClearTemplateCompare(modal);});
    comparePanel.append(compareTitle,compareSummary,compareDifferences,compareClear);
    const preview=el('section','nutrition-week-templates-preview-e32');preview.hidden=true;preview.setAttribute('aria-label','Vista previa de aplicación de plantilla');preview.setAttribute('aria-live','polite');const previewSummary=el('p','nutrition-week-templates-preview-summary-e32','Elegí una plantilla para revisar cómo se aplicará en la semana seleccionada.');const previewList=el('ul','nutrition-week-templates-preview-list-e32');
    const changeReview=el('section','nutrition-week-template-change-review-e39');changeReview.setAttribute('aria-label','Revisión consolidada de cambios');
    const changeReviewHeading=el('h4','','Revisión consolidada de cambios');
    const changeReviewStats=el('div','nutrition-week-template-change-review-stats-e39');
    const shoppingImpact=el('section','nutrition-week-template-shopping-impact-e40');shoppingImpact.setAttribute('aria-label','Impacto estimado en la lista de compras');shoppingImpact.setAttribute('aria-live','polite');
    const shoppingImpactHeading=el('h5','','Impacto estimado en la lista de compras');
    const shoppingImpactSummary=el('p','nutrition-week-template-shopping-impact-summary-e40','Se calculará de forma informativa. No se modificará la lista de compras ni la despensa.');
    const shoppingImpactStats=el('div','nutrition-week-template-shopping-impact-stats-e40');
    const shoppingImpactNotices=el('div','nutrition-week-template-shopping-impact-notices-e40');
    const shoppingImpactDetails=document.createElement('details');shoppingImpactDetails.className='nutrition-week-template-shopping-impact-details-e40';
    const shoppingImpactDetailsSummary=document.createElement('summary');shoppingImpactDetailsSummary.textContent='Ver productos que podrían cambiar en la lista';
    const shoppingImpactList=el('ul','nutrition-week-template-shopping-impact-list-e40');shoppingImpactDetails.append(shoppingImpactDetailsSummary,shoppingImpactList);
    shoppingImpact.append(shoppingImpactHeading,shoppingImpactSummary,shoppingImpactStats,shoppingImpactNotices,shoppingImpactDetails);
    const changeReviewDetails=document.createElement('details');changeReviewDetails.className='nutrition-week-template-change-review-details-e39';
    const changeReviewSummary=document.createElement('summary');changeReviewSummary.textContent='Ver detalle de cada comida y sus posibles conflictos';
    const changeReviewList=el('ul','nutrition-week-template-change-review-list-e39');changeReviewDetails.append(changeReviewSummary,changeReviewList);changeReview.append(changeReviewHeading,changeReviewStats,shoppingImpact,changeReviewDetails);preview.append(previewSummary,previewList,changeReview);
    const actions=el('div','nutrition-week-templates-actions-e32');const confirm=document.createElement('button');confirm.type='button';confirm.className='small-btn primary';confirm.textContent='Aplicar en esta semana';confirm.disabled=true;confirm.addEventListener('click',commitWeeklyTemplate);const cancel=document.createElement('button');cancel.type='button';cancel.className='small-btn';cancel.textContent='Cancelar vista previa';cancel.addEventListener('click',()=>clearWeeklyTemplatePreview(modal,'La vista previa se canceló. No se modificó el plan.'));actions.append(confirm,cancel);
    panel.append(heading,intro,saveRow,help,mergeLabel,mergeHelp,list,comparePanel,preview,actions);
    return {panel,name,save,list,mergeToggle,comparePanel,compareSummary,compareDifferences,compareClear,preview,previewSummary,previewList,changeReview,changeReviewStats,shoppingImpact,shoppingImpactSummary,shoppingImpactStats,shoppingImpactNotices,shoppingImpactDetails,shoppingImpactList,changeReviewDetails,changeReviewList,confirm,cancel,previewData:null};
  }
  function buildPostApplyShoppingHandoff(){
    const panel=el('section','nutrition-week-template-shopping-handoff-e41');panel.hidden=true;panel.setAttribute('aria-label','Siguiente paso: revisar la lista de compras');panel.setAttribute('aria-live','polite');
    const heading=el('h4','','Plan guardado · compras por revisar');
    const message=el('p','nutrition-week-template-shopping-handoff-message-e41','La planificación y la lista de compras se guardan por separado. Al abrir compras, este editor se cerrará para evitar superponer ventanas; la lista abrirá en la semana guardada y requerirá su propia revisión y confirmación.');
    const impactDetails=document.createElement('details');impactDetails.className='nutrition-week-template-post-apply-impact-e42';impactDetails.setAttribute('aria-label','Desglose estimado del impacto en compras');impactDetails.dataset.state='pending';
    const impactDetailsSummary=el('summary','nutrition-week-template-post-apply-impact-summary-e42','Ver desglose estimado de compras · solo lectura');
    const impactSummary=el('p','nutrition-week-template-post-apply-impact-description-e42','La estimación se calculará durante la vista previa de la plantilla.');
    const impactStats=el('div','nutrition-week-template-post-apply-impact-stats-e42');
    const impactNotices=el('div','nutrition-week-template-post-apply-impact-notices-e42');
    const impactList=el('ul','nutrition-week-template-post-apply-impact-list-e42');
    const reportActions=el('div','nutrition-week-template-post-apply-export-actions-e43');
    const copyReport=document.createElement('button');copyReport.type='button';copyReport.className='small-btn';copyReport.textContent='Copiar informe';copyReport.disabled=true;copyReport.setAttribute('aria-label','Copiar el informe estimado de impacto en compras');
    const downloadReport=document.createElement('button');downloadReport.type='button';downloadReport.className='small-btn';downloadReport.textContent='Descargar CSV';downloadReport.disabled=true;downloadReport.setAttribute('aria-label','Descargar el informe estimado de impacto en compras en CSV');
    reportActions.append(copyReport,downloadReport);
    const reportStatus=el('p','nutrition-week-template-post-apply-export-status-e43','');reportStatus.setAttribute('role','status');reportStatus.setAttribute('aria-live','polite');
    impactDetails.append(impactDetailsSummary,impactSummary,impactStats,impactNotices,impactList,reportActions,reportStatus);
    const actions=el('div','nutrition-week-template-shopping-handoff-actions-e41');
    const button=document.createElement('button');button.type='button';button.className='small-btn primary';button.textContent='Revisar lista de compras';button.setAttribute('aria-label','Revisar la lista de compras de la semana recién guardada');
    actions.appendChild(button);panel.append(heading,message,impactDetails,actions);
    return {panel,heading,message,button,impactDetails,impactDetailsSummary,impactSummary,impactStats,impactNotices,impactList,copyReport,downloadReport,reportStatus};
  }
  function renderPostApplyShoppingImpactE42(shell,impact){
    if(!shell?.postApplyShoppingImpactStats||!shell?.postApplyShoppingImpactList)return;
    const stats=shell.postApplyShoppingImpactStats,notices=shell.postApplyShoppingImpactNotices,list=shell.postApplyShoppingImpactList,details=shell.postApplyShoppingImpactDetails;
    stats.replaceChildren();notices.replaceChildren();list.replaceChildren();
    const available=!!(impact?.available&&impact?.counts),counts=available?impact.counts:{};
    shell.postApplyShoppingImpactDataE43=available?impact:null;
    if(shell.postApplyShoppingCopyReportE43)shell.postApplyShoppingCopyReportE43.disabled=!available;
    if(shell.postApplyShoppingDownloadReportE43)shell.postApplyShoppingDownloadReportE43.disabled=!available;
    if(shell.postApplyShoppingReportStatusE43)shell.postApplyShoppingReportStatusE43.textContent='';
    details.dataset.state=available?'available':'unavailable';
    shell.postApplyShoppingImpactDetailsSummary.textContent=available?'Ver desglose estimado de compras · solo lectura':'Estimación de compras no disponible';
    if(!available){
      shell.postApplyShoppingImpactSummary.textContent=impact?.message||'No se pudo obtener una estimación completa antes de guardar el plan. Abrí compras para generar una revisión actualizada; no se modificó ninguna compra.';
      list.appendChild(el('li','nutrition-week-template-post-apply-impact-item-e42','La lista de compras sigue intacta. Para obtener datos actuales, usá la revisión oficial de compras.'));
      return;
    }
    const quantity=value=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
    const stat=(label,value,key)=>{const card=el('div','nutrition-week-template-post-apply-impact-stat-e42');card.dataset.metric=key;card.append(el('span','',label),el('strong','',String(quantity(value))));stats.appendChild(card)};
    stat('Nuevos productos',counts.added,'added');stat('Por actualizar',counts.updated,'updated');stat('Por reactivar',counts.reactivated,'reactivated');stat('Por archivar',counts.archive,'archive');stat('Comprados por revisar',counts.purchasedConflicts,'purchased');stat('Cantidades sin definir',counts.unknown,'unknown');
    shell.postApplyShoppingImpactSummary.textContent=impact.noPlanChanges?'La plantilla no añade comidas nuevas al plan, por lo que no se estiman cambios de compras.':`Estimación informativa calculada antes de guardar el plan de ${formatWeek(impact.week||shell.postApplyShoppingWeek||'')}. Es solo una proyección: no guarda la lista ni descuenta existencias. Si los datos cambiaron desde entonces, compras generará una revisión actualizada.`;
    if(quantity(counts.purchasedConflicts)>0)notices.appendChild(el('p','nutrition-week-template-post-apply-impact-warning-e42',`${quantity(counts.purchasedConflicts)} producto${quantity(counts.purchasedConflicts)===1?' comprado cambia':'s comprados cambian'} respecto del plan. Al revisar compras, las cantidades marcadas como compradas se conservan por defecto.`));
    if(impact.pantryUnavailable)notices.appendChild(el('p','nutrition-week-template-post-apply-impact-note-e42','No se pudo consultar la despensa; la estimación no descuenta existencias.'));
    else if(quantity(impact.pantryCovered)>0)notices.appendChild(el('p','nutrition-week-template-post-apply-impact-note-e42',`La despensa cubriría ${quantity(impact.pantryCovered)} producto${quantity(impact.pantryCovered)===1?' completo':'s completos'}. El inventario no se modificó.`));
    const groups=[
      ['Nuevos productos',impact.diff?.added||[],item=>`${clean(item.name)||'Producto sin nombre'} · ${shoppingImpactQuantity(item)}`],
      ['Productos que cambiarían',impact.diff?.updated||[],entry=>`${clean(entry.item?.name)||'Producto sin nombre'} · ${shoppingImpactQuantity(entry.previous)} → ${shoppingImpactQuantity(entry.item)}`],
      ['Productos que volverían a la lista',impact.diff?.reactivated||[],item=>`${clean(item.name)||'Producto sin nombre'} · ${shoppingImpactQuantity(item)}`],
      ['Pendientes que se archivarían',impact.diff?.archive||[],item=>`${clean(item.name)||'Producto sin nombre'} · ${shoppingImpactQuantity(item)}`],
      ['Compras cuya cantidad requiere revisión',impact.diff?.purchasedConflicts||[],item=>`${clean(item.name)||'Producto sin nombre'} · comprado: ${shoppingImpactQuantity(item)}`],
      ['Cantidades desconocidas',impact.diff?.unknown||[],item=>`${clean(item.name)||'Producto sin nombre'} · ${shoppingImpactQuantity(item)}`]
    ];
    let total=0;
    for(const [title,items,format] of groups){if(!Array.isArray(items)||!items.length)continue;const group=el('li','nutrition-week-template-post-apply-impact-group-e42',title);list.appendChild(group);for(const item of items.slice(0,5)){list.appendChild(el('li','nutrition-week-template-post-apply-impact-item-e42',format(item)));total++}if(items.length>5){list.appendChild(el('li','nutrition-week-template-post-apply-impact-more-e42',`Y ${items.length-5} producto${items.length-5===1?' más':'s más'}…`));total++}}
    if(!total)list.appendChild(el('li','nutrition-week-template-post-apply-impact-item-e42','No se prevén cambios de productos en esta estimación.'));
    shell.postApplyShoppingImpactDetailsSummary.textContent=`Ver desglose estimado de compras · ${total} ${total===1?'detalle':'detalles'} · solo lectura`;
  }
  // E43: genera un informe completo de solo lectura. No depende de los elementos
  // visibles (que están limitados a cinco filas por grupo) y nunca escribe en Supabase.
  function postApplyShoppingReportRowsE43(impact){
    const diff=impact?.diff||{},byKey=new Map();
    const itemKey=item=>String(item?.item_key||`${clean(item?.name)}|${clean(item?.brand)}|${clean(item?.unit)}|${clean(item?.preparation_state)}`);
    const ensure=(item)=>{const key=itemKey(item);if(!byKey.has(key))byKey.set(key,{key,type:'',previous:null,projected:null,base:item||{},notes:[]});return byKey.get(key)};
    const addNote=(row,note)=>{if(note&&!row.notes.includes(note))row.notes.push(note)};
    for(const item of (Array.isArray(diff.added)?diff.added:[])){const row=ensure(item);row.type='Nuevo';row.projected=item;row.base=item;}
    for(const entry of (Array.isArray(diff.updated)?diff.updated:[])){const row=ensure(entry.item||entry.previous);row.type='Actualizar';row.previous=entry.previous||null;row.projected=entry.item||null;row.base=entry.item||entry.previous||{};}
    for(const entry of (Array.isArray(diff.reactivated)?diff.reactivated:[])){const row=ensure(entry.item||entry.previous);if(!row.type)row.type='Reactivar';row.previous=entry.previous||null;row.projected=entry.item||null;row.base=entry.item||entry.previous||{};addNote(row,'El producto volvería a la lista activa.');}
    for(const item of (Array.isArray(diff.archive)?diff.archive:[])){const row=ensure(item);if(!row.type)row.type='Archivar pendiente';row.previous=row.previous||item;row.base=row.base||item;addNote(row,'El pendiente se archivaría; no se elimina del historial.');}
    for(const item of (Array.isArray(diff.purchasedConflicts)?diff.purchasedConflicts:[])){const row=ensure(item);if(!row.type)row.type='Revisar compra';row.previous=row.previous||item;row.base=row.projected||row.base||item;addNote(row,'Ya figura como comprado; revisar la cantidad antes de sincronizar.');}
    for(const item of (Array.isArray(diff.unknown)?diff.unknown:[])){const row=ensure(item);if(!row.type)row.type='Cantidad desconocida';row.projected=row.projected||item;row.base=item||row.base;addNote(row,'La cantidad o unidad no está definida; no se inventó un valor.');}
    return [...byKey.values()].map(row=>{
      const current=row.previous,projected=row.projected,base=projected||current||row.base||{};
      const quantity=item=>{if(!item)return '';if(item.quantity_known===false||safeNum(item.quantity)===null||safeNum(item.quantity)<0)return 'Cantidad sin definir';return shoppingImpactQuantity(item)};
      const unit=clean(projected?.unit||current?.unit||base.unit);
      const category=clean(projected?.category||current?.category||base.category||base.categories);
      const prep=clean(projected?.preparation_state||current?.preparation_state||base.preparation_state);
      const purchased=current?.checked===true||base?.checked===true?'Sí':'No';
      if(!row.notes.length&&row.type==='Nuevo')addNote(row,'Producto nuevo estimado a partir del plan propuesto.');
      return {type:row.type||'Cambio estimado',name:clean(base.name||current?.name||projected?.name)||'Producto sin nombre',brand:clean(base.brand||current?.brand||projected?.brand),previousQuantity:quantity(current),projectedQuantity:quantity(projected),unit,preparation:prep,category,purchased,notes:row.notes.join(' ')};
    });
  }
  function postApplyShoppingCsvE43(impact,week,capturedAt){
    const headers=['Informe generado','Semana','Tipo de cambio','Producto','Marca','Cantidad anterior','Cantidad estimada','Unidad','Preparación','Categoría','Ya comprado','Observaciones'];
    const rows=postApplyShoppingReportRowsE43(impact);
    const generatedAt=capturedAt?new Date(capturedAt).toLocaleString('es-AR'):'No disponible';
    const disclaimer='Estimación informativa capturada antes de guardar el plan; no es una lista sincronizada y no modifica compras ni despensa.';
    const body=rows.length?rows.map(row=>[generatedAt,week,row.type,row.name,row.brand,row.previousQuantity,row.projectedQuantity,row.unit,row.preparation,row.category,row.purchased,[row.notes,disclaimer].filter(Boolean).join(' ')]):[[generatedAt,week,'Sin cambios','','','','','','','','',`No se estiman cambios de compras. ${disclaimer}`]];
    // Cabecera fija y CSV formula-safe usando el mismo escapado que el exportador del plan.
    return '\uFEFF'+[headers,...body].map(row=>row.map(csvCell).join(';')).join('\r\n');
  }
  function postApplyShoppingPlainTextE43(impact,week,capturedAt){
    const rows=postApplyShoppingReportRowsE43(impact);const counts=impact?.counts||{};
    const timestamp=capturedAt?new Date(capturedAt).toLocaleString('es-AR'):'No disponible';
    const lines=[`AgendaFICH · Estimación de impacto en compras`,`Semana: ${week}`,`Informe generado: ${timestamp}`,`Nuevos: ${Number(counts.added)||0} · Actualizaciones: ${Number(counts.updated)||0} · Reactivaciones: ${Number(counts.reactivated)||0} · A archivar: ${Number(counts.archive)||0} · Comprados por revisar: ${Number(counts.purchasedConflicts)||0} · Cantidades desconocidas: ${Number(counts.unknown)||0}`,'','IMPORTANTE: esta es una estimación informativa capturada antes de guardar el plan. No es la lista oficial sincronizada y no modifica compras ni despensa.',''];
    if(!rows.length)lines.push('No se estiman cambios de productos.');
    else for(const row of rows)lines.push(`${row.type}: ${row.name}${row.brand?` (${row.brand})`:''} · anterior: ${row.previousQuantity||'—'} · estimada: ${row.projectedQuantity||'—'} · categoría: ${row.category||'Otros'}${row.notes?` · ${row.notes}`:''}`);
    return lines.join('\n');
  }
  function downloadPostApplyShoppingReportE43(shell){
    const impact=shell?.postApplyShoppingImpactDataE43,week=shell?.postApplyShoppingWeek,owner=shell?.postApplyShoppingOwnerE43;
    if(!impact?.available||!week){if(shell?.postApplyShoppingReportStatusE43)shell.postApplyShoppingReportStatusE43.textContent='No hay una estimación disponible para exportar.';return}
    if(!owner||uid()!==owner){shell.postApplyShoppingReportStatusE43.textContent='La cuenta activa cambió. Cerrá y volvé a generar el informe con la cuenta correcta.';return}
    try{const csv=postApplyShoppingCsvE43(impact,week,shell.postApplyShoppingImpactCapturedAtE43);const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`agenda-fich-estimacion-compras-${week}-e43.csv`;link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);shell.postApplyShoppingReportStatusE43.textContent=`Informe CSV preparado con ${postApplyShoppingReportRowsE43(impact).length} productos/diferencias. Es solo una estimación; la lista oficial no cambió.`}catch(error){shell.postApplyShoppingReportStatusE43.textContent=`No se pudo preparar el CSV: ${error?.message||'error desconocido'}. La lista de compras no se modificó.`}
  }
  async function copyPostApplyShoppingReportE43(shell){
    const impact=shell?.postApplyShoppingImpactDataE43,week=shell?.postApplyShoppingWeek,owner=shell?.postApplyShoppingOwnerE43;
    if(!impact?.available||!week){if(shell?.postApplyShoppingReportStatusE43)shell.postApplyShoppingReportStatusE43.textContent='No hay una estimación disponible para copiar.';return}
    if(!owner||uid()!==owner){shell.postApplyShoppingReportStatusE43.textContent='La cuenta activa cambió. Cerrá y volvé a generar el informe con la cuenta correcta.';return}
    const text=postApplyShoppingPlainTextE43(impact,week,shell.postApplyShoppingImpactCapturedAtE43);
    try{
      if(window.navigator?.clipboard?.writeText)await window.navigator.clipboard.writeText(text);
      else {const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=!!document.execCommand?.('copy');area.remove();if(!ok)throw new Error('El navegador no permitió copiar el texto. Usá Descargar CSV.');}
      if(!modal||shell.postApplyShoppingOwnerE43!==uid())throw new Error('La cuenta cambió durante la operación.');
      shell.postApplyShoppingReportStatusE43.textContent='Informe copiado. Recordá que es una estimación de solo lectura, no una lista sincronizada.';
    }catch(error){shell.postApplyShoppingReportStatusE43.textContent=`No se pudo copiar el informe: ${error?.message||'error desconocido'}. Podés descargarlo en CSV.`}
  }
  function showPostApplyShoppingHandoff(shell,week,impact){
    if(!shell?.postApplyShoppingHandoff)return;
    shell.postApplyShoppingWeek=week;
    shell.postApplyShoppingOwnerE43=uid();
    shell.postApplyShoppingImpactCapturedAtE43=new Date().toISOString();
    shell.postApplyShoppingHeading.textContent=`Plan guardado · ${formatWeek(week)}`;
    const counts=impact?.available&&impact?.counts?impact.counts:null;
    const impactText=counts?` La estimación informativa anterior señaló ${Number(counts.added)||0} ${Number(counts.added)===1?'producto nuevo':'productos nuevos'}, ${Number(counts.updated)||0} ${Number(counts.updated)===1?'producto por actualizar':'productos por actualizar'} y ${Number(counts.unknown)||0} ${Number(counts.unknown)===1?'cantidad desconocida':'cantidades desconocidas'}.`:' No hubo una estimación completa de compras, por lo que conviene revisar la lista desde el plan ya guardado.';
    shell.postApplyShoppingMessage.textContent=`El plan ya está guardado. La lista de compras todavía no se modificó.${impactText} Abrí la lista para generar una revisión oficial y confirmar esa operación por separado.`;
    renderPostApplyShoppingImpactE42(shell,impact);
    shell.postApplyShoppingImpactDetails.open=false;
    shell.postApplyShoppingButton.textContent=`Revisar compras · ${week}`;
    shell.postApplyShoppingHandoff.hidden=false;
  }
  function updateWeeklyTemplateButtons(shell){if(!shell?.weekTemplatesPanel)return;shell.weekTemplatesSave.disabled=busy||rows.length===0||weeklyTemplates.length>=WEEK_TEMPLATE_LIMIT;for(const control of shell.weekTemplatesList.querySelectorAll('button,input,select')){let disabled=busy||(control.dataset.requiresTemplateSlot==='true'&&weeklyTemplates.length>=WEEK_TEMPLATE_LIMIT);const action=control.dataset.e36SelectionAction;if(action){const selection=control.closest('.nutrition-week-template-meal-selection-e36'),checks=selection?[...selection.querySelectorAll('input[type=checkbox]')]:[],selected=checks.filter(input=>input.checked).length;if(action==='preview')disabled=disabled||selected===0;else if(action==='select-all')disabled=disabled||selected===checks.length;else if(action==='clear')disabled=disabled||selected===0}const bulkAction=control.dataset.e38BulkAction;if(bulkAction){const selection=control.closest('.nutrition-week-template-meal-selection-e36'),checks=selection?[...selection.querySelectorAll('input[type=checkbox]')]:[],selectedChecks=checks.filter(input=>input.checked),selectedCount=selectedChecks.length;if(bulkAction==='assign-day'){const target=Number(selection?.querySelector('.nutrition-week-template-bulk-target-select-e38')?.value);disabled=disabled||selectedCount===0||!selectedChecks.some(input=>{const row=input.closest('.nutrition-week-template-meal-selection-item-e37'),day=row?.querySelector('.nutrition-week-template-target-day-e37');return day&&Number(day.value)!==target})}else if(bulkAction==='restore-days'){disabled=disabled||selectedCount===0||!selectedChecks.some(input=>{const row=input.closest('.nutrition-week-template-meal-selection-item-e37'),day=row?.querySelector('.nutrition-week-template-target-day-e37');return day&&Number(day.value)!==Number(day.dataset.sourceDay)})}}control.disabled=disabled}if(shell.weekTemplatesConfirm)shell.weekTemplatesConfirm.disabled=busy||!shell.weekTemplatesPreviewData||shell.weekTemplatesPreviewData.counts.mealsToAdd===0;}
  function clearWeeklyTemplatePreview(shell,message='Elegí una plantilla y revisá los días antes de aplicarla. No se guardó ningún cambio.'){
    if(!shell?.weekTemplatesPanel)return;shell.weekTemplatesPreviewData=null;shell.weekTemplatesPreview.hidden=true;shell.weekTemplatesPreviewList.replaceChildren();shell.weekTemplatesPreviewSummary.textContent=message;shell.weekTemplatesConfirm.disabled=true;if(shell.weekTemplatesChangeReviewStats)shell.weekTemplatesChangeReviewStats.replaceChildren();if(shell.weekTemplatesChangeReviewList)shell.weekTemplatesChangeReviewList.replaceChildren();if(shell.weekTemplatesChangeReviewDetails)shell.weekTemplatesChangeReviewDetails.open=false;if(shell.weekTemplatesShoppingImpactSummary){shell.weekTemplatesShoppingImpactSummary.textContent='Se calculará de forma informativa. No se modificará la lista de compras ni la despensa.';shell.weekTemplatesShoppingImpactStats.replaceChildren();shell.weekTemplatesShoppingImpactNotices.replaceChildren();shell.weekTemplatesShoppingImpactList.replaceChildren();shell.weekTemplatesShoppingImpactDetails.open=false;}
  }
  function shellSafeClearTemplateCompare(shell){if(!shell)return;shell.weekTemplateCompareIds=[];renderSavedWeekTemplates(shell);const next=shell.weekTemplatesList?.querySelector('.nutrition-week-template-compare-toggle-e35');next?.focus();}
  function toggleWeeklyTemplateComparison(templateId){if(!modal||busy)return;const shell=modal,ids=Array.isArray(shell.weekTemplateCompareIds)?shell.weekTemplateCompareIds.slice():[],index=ids.indexOf(String(templateId));if(index>=0)ids.splice(index,1);else if(ids.length>=2){status('Podés comparar dos plantillas a la vez. Quitá una selección antes de elegir otra.','info');return}else ids.push(String(templateId));shell.weekTemplateCompareIds=ids;renderSavedWeekTemplates(shell);const picked=weeklyTemplates.filter(item=>ids.includes(item.id));if(picked.length===1)status(`Seleccionaste «${picked[0].name}». Elegí una segunda plantilla para compararlas.`,'info');else if(picked.length===2)status(`Comparando «${picked[0].name}» con «${picked[1].name}». No se modificó ninguna plantilla.`,'success');else status('Se limpió la selección de comparación. No se modificó ninguna plantilla.','info')}
  function renderTemplateComparisonSide(label,item){const side=el('div','nutrition-week-template-compare-side-e35');side.appendChild(el('span','nutrition-week-template-compare-side-label-e35',label));if(!item){side.appendChild(el('p','nutrition-week-template-compare-absent-e35','No figura en esta plantilla.'));return side}side.appendChild(el('strong','',clean(item.title)||'Comida sin nombre'));const type=MEALS.find(entry=>entry[0]===item.meal_type)?.[1]||item.meal_type;side.appendChild(el('p','nutrition-week-template-compare-meta-e35',`${type}${item.planned_time?` · ${item.planned_time}`:''}`));if(clean(item.notes))side.appendChild(el('p','nutrition-week-template-compare-notes-e35',`Notas: ${clean(item.notes).slice(0,300)}`));const ingredients=Array.isArray(item.ingredients_snapshot)?item.ingredients_snapshot.filter(value=>value&&clean(value.name)):[];if(ingredients.length){const list=el('ul','nutrition-week-template-compare-ingredients-e35');for(const ingredient of ingredients.slice(0,30)){const value=safeNum(ingredient.quantity),quantity=ingredient.quantity_known===false||value===null?'cantidad desconocida':`${value} ${clean(ingredient.unit)}`.trim();list.appendChild(el('li','',`${clean(ingredient.name)} · ${quantity}`))}if(ingredients.length>30)list.appendChild(el('li','',`y ${ingredients.length-30} ingredientes más`));side.appendChild(list)}else side.appendChild(el('p','nutrition-week-template-compare-meta-e35','Sin ingredientes guardados'));const summary=nutritionSummary(item.nutrition_snapshot);side.appendChild(el('p','nutrition-week-template-compare-meta-e35',summary||'Información nutricional incompleta o no disponible'));return side}
  function renderWeeklyTemplateComparison(shell){if(!shell?.weekTemplatesComparePanel)return;const valid=new Set(weeklyTemplates.map(item=>item.id));shell.weekTemplateCompareIds=(Array.isArray(shell.weekTemplateCompareIds)?shell.weekTemplateCompareIds:[]).filter((value,index,array)=>valid.has(value)&&array.indexOf(value)===index).slice(0,2);const selected=shell.weekTemplateCompareIds.map(id=>weeklyTemplates.find(item=>item.id===id)).filter(Boolean);shell.weekTemplatesComparePanel.hidden=selected.length===0;shell.weekTemplatesCompareDifferences.replaceChildren();if(!selected.length){shell.weekTemplatesCompareSummary.textContent='Elegí dos plantillas para comparar sus comidas, ingredientes y nutrientes.';return}if(selected.length===1){shell.weekTemplatesCompareSummary.textContent=`Seleccionaste «${selected[0].name}». Elegí una segunda plantilla para ver qué comidas, cantidades o nutrientes cambian.`;return}let result;try{result=compareWeeklyPlanTemplates(selected[0],selected[1])}catch(error){shell.weekTemplatesCompareSummary.textContent=error?.message||'No se pudieron comparar las plantillas.';return}const count=result.summary;shell.weekTemplatesCompareSummary.textContent=`A: «${result.left.name}» (${result.left.meals} ${result.left.meals===1?'comida':'comidas'}) · B: «${result.right.name}» (${result.right.meals} ${result.right.meals===1?'comida':'comidas'}). ${count.same} iguales, ${count.changed} modificadas, ${count.onlyInA} solo en A, ${count.onlyInB} solo en B. ${count.ingredientDifferences} diferencias de ingredientes/cantidades en ${count.daysAffected} días.`;if(!result.hasDifferences){shell.weekTemplatesCompareDifferences.appendChild(el('p','nutrition-week-template-compare-identical-e35','No se detectaron diferencias en las comidas, cantidades, ingredientes o nutrientes conocidos.'));return}for(const day of result.days){const diffRows=day.rows.filter(row=>row.kind!=='same');if(!diffRows.length)continue;const daySection=el('section','nutrition-week-template-compare-day-e35');daySection.appendChild(el('h5','',day.name));for(const itemRow of diffRows){const article=el('article',`nutrition-week-template-compare-row-e35 is-${itemRow.kind}`);const header=el('div','nutrition-week-template-compare-row-heading-e35');const mealType=MEALS.find(entry=>entry[0]===itemRow.mealType)?.[1]||itemRow.mealType;header.append(el('strong','',`${mealType} · ${itemRow.title}`),el('span',`nutrition-week-template-compare-badge-e35 is-${itemRow.kind}`,itemRow.kind==='added'?'Solo en B':itemRow.kind==='removed'?'Solo en A':'Modificada'));const columns=el('div','nutrition-week-template-compare-columns-e35');columns.append(renderTemplateComparisonSide(`A · ${result.left.name}`,itemRow.left),renderTemplateComparisonSide(`B · ${result.right.name}`,itemRow.right));article.append(header,columns);if(itemRow.changes.length){const changeList=el('ul','nutrition-week-template-compare-changes-e35');for(const change of itemRow.changes)changeList.appendChild(el('li','',change));article.appendChild(changeList)}daySection.appendChild(article)}shell.weekTemplatesCompareDifferences.appendChild(daySection)} }
  function renderSavedWeekTemplates(shell){
    if(!shell?.weekTemplatesList)return;shell.weekTemplatesList.replaceChildren();
    if(!weeklyTemplatesLoaded){shell.weekTemplatesList.appendChild(el('p','nutrition-week-templates-empty-e32','Las plantillas aún no se pudieron cargar. Comprobá la conexión y la migración de Supabase.'));renderWeeklyTemplateComparison(shell);return}
    if(!weeklyTemplates.length){shell.weekTemplatesList.appendChild(el('p','nutrition-week-templates-empty-e32','Todavía no guardaste plantillas semanales. Organizá una semana y guardala para reutilizarla más adelante.'));renderWeeklyTemplateComparison(shell);return}
    for(const template of weeklyTemplates){
      const card=el('article','nutrition-week-template-card-e32 nutrition-week-template-card-e34');card.dataset.templateId=template.id;
      const top=el('div','nutrition-week-template-card-top-e32');const text=el('div','nutrition-week-template-card-text-e32');
      text.append(el('strong','',template.name),el('span','',`${template.items.length} comidas · origen ${formatWeek(template.source_week)} · guardada ${new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(template.created_at))}`));top.append(text);
      const actions=el('div','nutrition-week-template-card-actions-e32');
      const details=document.createElement('button');details.type='button';details.className='small-btn';details.textContent='Detalles';details.setAttribute('aria-expanded','false');details.setAttribute('aria-controls',`weeklyTemplateDetails-${template.id}`);details.setAttribute('aria-label',`Ver detalles de ${template.name}`);
      const preview=document.createElement('button');preview.type='button';preview.className='small-btn';preview.textContent='Previsualizar';preview.setAttribute('aria-label',`Previsualizar plantilla ${template.name} en la semana ${formatWeek(activeWeek)}`);preview.addEventListener('click',()=>previewSavedWeeklyTemplate(template.id));
      const selectionToggle=document.createElement('button');selectionToggle.type='button';selectionToggle.className='small-btn nutrition-week-template-meal-select-toggle-e36';selectionToggle.textContent='Elegir comidas';selectionToggle.setAttribute('aria-expanded',String(shell.weekTemplateSelectionOpenId===template.id));selectionToggle.setAttribute('aria-controls',`weeklyTemplateMealSelection-${template.id}`);selectionToggle.setAttribute('aria-label',`Elegir comidas de ${template.name}`);
      const compare=document.createElement('button');compare.type='button';compare.className='small-btn nutrition-week-template-compare-toggle-e35';compare.textContent=(shell.weekTemplateCompareIds||[]).includes(template.id)?'Seleccionada':'Comparar';compare.setAttribute('aria-pressed',String((shell.weekTemplateCompareIds||[]).includes(template.id)));compare.setAttribute('aria-label',`${(shell.weekTemplateCompareIds||[]).includes(template.id)?'Quitar plantilla':'Comparar plantilla'} ${template.name}`);compare.addEventListener('click',()=>toggleWeeklyTemplateComparison(template.id));
      const rename=document.createElement('button');rename.type='button';rename.className='small-btn';rename.textContent='Renombrar';rename.setAttribute('aria-label',`Renombrar plantilla ${template.name}`);rename.setAttribute('aria-expanded','false');rename.dataset.renameTemplateId=template.id;
      const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='small-btn';duplicate.textContent='Duplicar';duplicate.setAttribute('aria-label',`Duplicar plantilla ${template.name}`);duplicate.dataset.requiresTemplateSlot='true';
      const remove=document.createElement('button');remove.type='button';remove.className='small-btn';remove.textContent='Eliminar';remove.setAttribute('aria-label',`Eliminar plantilla ${template.name}`);remove.addEventListener('click',()=>deleteSavedWeeklyTemplate(template.id));
      actions.append(details,preview,selectionToggle,compare,rename,duplicate,remove);top.append(actions);card.appendChild(top);
      let selectedSet=shell.weekTemplateSelectedItemIds.get(template.id);
      if(!(selectedSet instanceof Set))selectedSet=new Set(template.items.map(item=>item.item_id));
      else {const validItems=new Set(template.items.map(item=>item.item_id));selectedSet=new Set([...selectedSet].filter(value=>validItems.has(value)))}
      shell.weekTemplateSelectedItemIds.set(template.id,selectedSet);
      const selectionPanel=el('section','nutrition-week-template-meal-selection-e36');selectionPanel.id=`weeklyTemplateMealSelection-${template.id}`;selectionPanel.hidden=shell.weekTemplateSelectionOpenId!==template.id;selectionPanel.setAttribute('aria-label',`Selección de comidas de ${template.name}`);
      const selectionHeading=el('h4','',`Elegir comidas de «${template.name}»`);const selectionHelp=el('p','nutrition-week-template-meal-selection-help-e36','Marcá solo las comidas que querés agregar a la semana actual. Las comidas que ya existen se conservan; no se reemplaza ninguna.');
      const selectionSummary=el('p','nutrition-week-template-meal-selection-summary-e36');
      const selectionTools=el('div','nutrition-week-template-meal-selection-tools-e36');const selectAll=document.createElement('button');selectAll.type='button';selectAll.className='small-btn';selectAll.dataset.e36SelectionAction='select-all';selectAll.textContent='Seleccionar todas';const clearSelection=document.createElement('button');clearSelection.type='button';clearSelection.className='small-btn';clearSelection.dataset.e36SelectionAction='clear';clearSelection.textContent='Limpiar selección';selectionTools.append(selectAll,clearSelection);
      const targetDays=shell.weekTemplateTargetDays.get(template.id) instanceof Map?shell.weekTemplateTargetDays.get(template.id):new Map(template.items.map(item=>[item.item_id,Number(item.day_offset)]));
      const validTargetIds=new Set(template.items.map(item=>item.item_id));for(const key of [...targetDays.keys()])if(!validTargetIds.has(key))targetDays.delete(key);for(const item of template.items)if(!targetDays.has(item.item_id))targetDays.set(item.item_id,Number(item.day_offset));shell.weekTemplateTargetDays.set(template.id,targetDays);
      const bulkTools=el('div','nutrition-week-template-bulk-actions-e38');bulkTools.setAttribute('role','group');bulkTools.setAttribute('aria-label',`Acciones en bloque para las comidas seleccionadas de ${template.name}`);
      const bulkTargetWrap=el('label','nutrition-week-template-bulk-target-wrap-e38');bulkTargetWrap.appendChild(el('span','','Día común para las comidas seleccionadas'));const bulkTargetSelect=document.createElement('select');bulkTargetSelect.className='nutrition-week-template-bulk-target-select-e38';bulkTargetSelect.setAttribute('aria-label','Día común para las comidas seleccionadas');for(let day=0;day<7;day++){const option=document.createElement('option');option.value=String(day);option.textContent=DAY_NAMES[day];bulkTargetSelect.appendChild(option)}bulkTargetWrap.appendChild(bulkTargetSelect);
      const bulkApply=document.createElement('button');bulkApply.type='button';bulkApply.className='small-btn';bulkApply.dataset.e38BulkAction='assign-day';bulkApply.textContent='Asignar día a seleccionadas';
      const bulkReset=document.createElement('button');bulkReset.type='button';bulkReset.className='small-btn';bulkReset.dataset.e38BulkAction='restore-days';bulkReset.textContent='Restaurar días originales';
      const bulkHelp=el('p','nutrition-week-template-bulk-help-e38','Estas acciones solo afectan las comidas marcadas. Podés seguir ajustando cada destino individualmente antes de previsualizar.');bulkTools.append(bulkTargetWrap,bulkApply,bulkReset,bulkHelp);
      const selectionList=el('div','nutrition-week-template-meal-selection-list-e36');selectionList.setAttribute('role','group');selectionList.setAttribute('aria-label',`Comidas disponibles en ${template.name}`);
      const orderedItems=template.items.slice().sort((a,b)=>Number(a.day_offset)-Number(b.day_offset)||MEALS.findIndex(entry=>entry[0]===a.meal_type)-MEALS.findIndex(entry=>entry[0]===b.meal_type)||String(a.planned_time||'99:99').localeCompare(String(b.planned_time||'99:99'))||Number(a.sort_order)-Number(b.sort_order)||String(a.item_id).localeCompare(String(b.item_id)));
      const itemChecks=[];
      for(const [index,item] of orderedItems.entries()){
        const line=el('div','nutrition-week-template-meal-selection-item-e37');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selectedSet.has(item.item_id);checkbox.value=item.item_id;checkbox.id=`weeklyTemplateMeal-${template.id}-${index}`;
        const mealLabel=MEALS.find(entry=>entry[0]===item.meal_type)?.[1]||item.meal_type;const description=`${DAY_NAMES[item.day_offset]} · ${mealLabel} · ${clean(item.title)||'Comida sin nombre'}${item.planned_time?` · ${item.planned_time}`:''}`;
        const text=document.createElement('label');text.className='nutrition-week-template-meal-selection-description-e37';text.htmlFor=checkbox.id;text.textContent=description;
        const targetWrap=el('label','nutrition-week-template-target-day-wrap-e37');targetWrap.appendChild(el('span','','Día de destino'));const targetSelect=document.createElement('select');targetSelect.className='nutrition-week-template-target-day-e37';targetSelect.dataset.sourceDay=String(item.day_offset);targetSelect.setAttribute('aria-label',`Día de destino para ${clean(item.title)||'comida sin nombre'}`);for(let day=0;day<7;day++){const option=document.createElement('option');option.value=String(day);option.textContent=DAY_NAMES[day];targetSelect.appendChild(option)}targetSelect.value=String(targetDays.get(item.item_id));targetWrap.appendChild(targetSelect);
        line.append(checkbox,text,targetWrap);selectionList.appendChild(line);itemChecks.push({checkbox,item,targetSelect});checkbox.addEventListener('change',()=>{if(checkbox.checked)selectedSet.add(item.item_id);else selectedSet.delete(item.item_id);invalidateSelectionPreview('Cambiaste la selección de comidas. Generá una nueva vista previa antes de confirmar. No se modificó el plan.');updateSelectionSummary()});targetSelect.addEventListener('change',()=>{targetDays.set(item.item_id,Number(targetSelect.value));bulkTargetSelect.value=targetSelect.value;invalidateSelectionPreview('Cambiaste el día de destino. Generá una nueva vista previa antes de confirmar. No se modificó el plan.');updateSelectionSummary()});
      }
      const firstSelectedForBulk=itemChecks.find(({item})=>selectedSet.has(item.item_id));if(firstSelectedForBulk)bulkTargetSelect.value=String(targetDays.get(firstSelectedForBulk.item.item_id));
      const invalidateSelectionPreview=(message='Cambiaste la selección o el destino de una comida. Generá una nueva vista previa antes de confirmar. No se modificó el plan.')=>{if(modal===shell&&shell.weekTemplatesPreviewData)clearWeeklyTemplatePreview(shell,message)};
      const selectedTargetOverrides=()=>Object.fromEntries([...selectedSet].map(itemId=>[itemId,Number(targetDays.get(itemId))]));
      const updateSelectionSummary=()=>{const moved=[...selectedSet].filter(itemId=>{const item=template.items.find(entry=>entry.item_id===itemId);return item&&Number(targetDays.get(itemId))!==Number(item.day_offset)}).length;const selectedCount=selectedSet.size;const bulkTarget=Number(bulkTargetSelect.value);const canBulkAssign=selectedCount>0&&[...selectedSet].some(itemId=>Number(targetDays.get(itemId))!==bulkTarget);const canBulkReset=selectedCount>0&&[...selectedSet].some(itemId=>{const item=template.items.find(entry=>entry.item_id===itemId);return item&&Number(targetDays.get(itemId))!==Number(item.day_offset)});selectionSummary.textContent=`${selectedCount} de ${template.items.length} ${template.items.length===1?'comida seleccionada':'comidas seleccionadas'}${moved?` · ${moved} ${moved===1?'cambia':'cambian'} de día`:''}.`;selectAll.disabled=busy||selectedCount===template.items.length;clearSelection.disabled=busy||selectedCount===0;selectionApply.disabled=busy||selectedCount===0;bulkTargetSelect.disabled=busy||selectedCount===0;bulkApply.disabled=busy||!canBulkAssign;bulkReset.disabled=busy||!canBulkReset};
      bulkTargetSelect.addEventListener('change',updateSelectionSummary);
      bulkApply.addEventListener('click',()=>{if(busy||!selectedSet.size)return;const destination=Number(bulkTargetSelect.value);let changed=0;for(const {checkbox,item,targetSelect} of itemChecks){if(!selectedSet.has(item.item_id))continue;if(Number(targetDays.get(item.item_id))!==destination)changed++;targetDays.set(item.item_id,destination);targetSelect.value=String(destination)}if(!changed){status(`${selectedSet.size===1?'La comida seleccionada ya está asignada':'Las comidas seleccionadas ya están asignadas'} a ${DAY_NAMES[destination]}. No se modificó el plan.`,'info');updateSelectionSummary();return}invalidateSelectionPreview(`Asignaste ${DAY_NAMES[destination]} a ${changed} ${changed===1?'comida':'comidas'}. Generá una nueva vista previa antes de confirmar. No se modificó el plan.`);updateSelectionSummary();status(`Se asignó ${DAY_NAMES[destination]} a ${changed} ${changed===1?'comida':'comidas'}. Revisá los destinos y generá una vista previa nueva.`,'success')});
      bulkReset.addEventListener('click',()=>{if(busy||!selectedSet.size)return;let changed=0;for(const {checkbox,item,targetSelect} of itemChecks){if(!selectedSet.has(item.item_id))continue;const original=Number(item.day_offset);if(Number(targetDays.get(item.item_id))!==original)changed++;targetDays.set(item.item_id,original);targetSelect.value=String(original)}if(!changed){status(`${selectedSet.size===1?'La comida seleccionada ya conserva su día original.':'Las comidas seleccionadas ya conservan sus días originales.'} No se modificó el plan.`,'info');updateSelectionSummary();return}invalidateSelectionPreview(`Se restauraron los días originales de ${changed} ${changed===1?'comida':'comidas'}. Generá una nueva vista previa antes de confirmar. No se modificó el plan.`);updateSelectionSummary();status(`Se restauraron los días originales de ${changed} ${changed===1?'comida':'comidas'}. Generá una nueva vista previa para confirmar los cambios.`,'success')});
      selectAll.addEventListener('click',()=>{for(const {checkbox,item} of itemChecks){checkbox.checked=true;selectedSet.add(item.item_id)}invalidateSelectionPreview();updateSelectionSummary()});
      clearSelection.addEventListener('click',()=>{for(const {checkbox} of itemChecks)checkbox.checked=false;selectedSet.clear();invalidateSelectionPreview();updateSelectionSummary()});
      const selectionActions=el('div','nutrition-week-template-meal-selection-actions-e36');const selectionApply=document.createElement('button');selectionApply.type='button';selectionApply.className='small-btn primary';selectionApply.dataset.e36SelectionAction='preview';selectionApply.textContent='Previsualizar seleccionadas';selectionApply.addEventListener('click',()=>previewSavedWeeklyTemplate(template.id,[...selectedSet],selectedTargetOverrides()));selectionActions.appendChild(selectionApply);
      selectionPanel.append(selectionHeading,selectionHelp,selectionSummary,selectionTools,bulkTools,selectionList,selectionActions);
      selectionToggle.addEventListener('click',()=>{const opening=shell.weekTemplateSelectionOpenId!==template.id;if(opening&&!shell.weekTemplateSelectedItemIds.has(template.id))shell.weekTemplateSelectedItemIds.set(template.id,new Set(template.items.map(item=>item.item_id)));shell.weekTemplateSelectionOpenId=opening?template.id:'';renderSavedWeekTemplates(shell);const next= shell.weekTemplatesList.querySelector(`[data-template-id="${template.id}"] .nutrition-week-template-meal-select-toggle-e36`);next?.focus()});
      updateSelectionSummary();card.appendChild(selectionPanel);
      const detail=el('section','nutrition-week-template-detail-e34');detail.id=`weeklyTemplateDetails-${template.id}`;detail.hidden=true;detail.setAttribute('role','region');detail.setAttribute('aria-label',`Detalles de ${template.name}`);detail.tabIndex=-1;
      const summary=weeklyTemplateSummary(template);const statRow=el('div','nutrition-week-template-stats-e34');
      for(const [label,value] of [['Días con comidas',summary.daysUsed],['Ingredientes',summary.ingredients],['Cantidades por revisar',summary.unknownQuantities],['Comidas con nutrición incompleta',summary.incompleteNutrition]]){const stat=el('div','nutrition-week-template-stat-e34');stat.append(el('span','',label),el('strong','',String(value)));statRow.appendChild(stat)}
      const dayList=el('ul','nutrition-week-template-days-e34');for(const day of summary.days){const li=el('li','',`${day.name}: ${day.count} ${day.count===1?'comida':'comidas'}`);dayList.appendChild(li)}
      detail.append(statRow,dayList);
      details.addEventListener('click',()=>{const opening=detail.hidden;detail.hidden=!opening;details.setAttribute('aria-expanded',String(opening));if(opening)detail.focus?.()});
      const renameForm=el('form','nutrition-week-template-rename-e34');renameForm.id=`weeklyTemplateRename-${template.id}`;renameForm.hidden=true;renameForm.noValidate=true;rename.setAttribute('aria-controls',renameForm.id);const renameLabel=el('label','nutrition-plan-field');renameLabel.appendChild(el('span','','Nuevo nombre de plantilla'));const nameInput=document.createElement('input');nameInput.type='text';nameInput.maxLength=80;nameInput.required=true;nameInput.value=template.name;nameInput.setAttribute('aria-label',`Nuevo nombre de plantilla ${template.name}`);renameLabel.appendChild(nameInput);const renameActions=el('div','nutrition-week-template-rename-actions-e34');const saveName=document.createElement('button');saveName.type='submit';saveName.className='small-btn primary';saveName.textContent='Guardar nombre';const cancelName=document.createElement('button');cancelName.type='button';cancelName.className='small-btn';cancelName.textContent='Cancelar';renameActions.append(saveName,cancelName);renameForm.append(renameLabel,renameActions);
      rename.addEventListener('click',()=>{for(const otherForm of shell.weekTemplatesList.querySelectorAll('.nutrition-week-template-rename-e34'))otherForm.hidden=true;for(const otherButton of shell.weekTemplatesList.querySelectorAll('button[data-rename-template-id]'))otherButton.setAttribute('aria-expanded','false');renameForm.hidden=false;rename.setAttribute('aria-expanded','true');nameInput.value=template.name;nameInput.focus();nameInput.select()});cancelName.addEventListener('click',()=>{renameForm.hidden=true;rename.setAttribute('aria-expanded','false');rename.focus()});renameForm.addEventListener('submit',event=>{event.preventDefault();renameSavedWeeklyTemplate(template.id,nameInput.value)});
      duplicate.addEventListener('click',()=>duplicateSavedWeeklyTemplate(template.id));
      card.append(detail,renameForm);shell.weekTemplatesList.appendChild(card);
    }
    renderWeeklyTemplateComparison(shell);updateWeeklyTemplateButtons(shell);
  }
  async function renameSavedWeeklyTemplate(templateId,requestedName){
    if(!modal||busy)return;const shell=modal,who=uid(),target=weeklyTemplates.find(item=>item.id===templateId),name=clean(requestedName);if(!target)return;
    try{assertOwner(who);if(!name||name.length>80)throw new Error('Escribí un nombre de entre 1 y 80 caracteres.');if(weeklyTemplates.some(item=>item.id!==templateId&&normalize(item.name)===normalize(name)))throw new Error('Ya existe otra plantilla con ese nombre. Elegí un nombre diferente.');
      busy=true;setWeekControlsDisabled(shell,true);status('Comprobando la versión de las plantillas antes de renombrar…','info');const fresh=await readWeeklyTemplatePreferences(who);assertOwner(who);if(fresh.revision!==weeklyTemplatesRevision)throw new Error('Las plantillas cambiaron desde otra sesión. Actualizá la lista antes de renombrar.');
      const next=renameWeeklyPlanTemplate(fresh.templates,templateId,name);const saved=await writeWeeklyTemplatePreferences(who,fresh,next);weeklyTemplates=saved.templates;weeklyTemplatesRevision=saved.revision;weeklyTemplatesLoaded=true;clearWeeklyTemplatePreview(shell,'La lista cambió porque se renombró una plantilla. Generá una nueva vista previa antes de aplicar.');renderSavedWeekTemplates(shell);status(`Plantilla renombrada a «${name}». Su contenido y las comidas ya planificadas permanecen intactos.`,'success');
    }catch(error){if(modal===shell)status(`No se pudo renombrar la plantilla: ${error?.message||'error desconocido'}. No se modificó la plantilla.`, 'error')}finally{finishBusy(shell);if(modal===shell){setWeekControlsDisabled(shell,false);updateWeeklyTemplateButtons(shell)}}
  }
  async function duplicateSavedWeeklyTemplate(templateId){
    if(!modal||busy)return;const shell=modal,who=uid();
    try{assertOwner(who);if(weeklyTemplates.length>=WEEK_TEMPLATE_LIMIT)throw new Error(`Llegaste al máximo de ${WEEK_TEMPLATE_LIMIT} plantillas. Eliminá alguna antes de duplicar otra.`);
      busy=true;setWeekControlsDisabled(shell,true);status('Comprobando la versión de las plantillas antes de duplicar…','info');const fresh=await readWeeklyTemplatePreferences(who);assertOwner(who);if(fresh.revision!==weeklyTemplatesRevision)throw new Error('Las plantillas cambiaron desde otra sesión. Actualizá la lista antes de duplicar.');
      const next=duplicateWeeklyPlanTemplate(fresh.templates,templateId,id(),new Date().toISOString(),id);const copy=next[0];const saved=await writeWeeklyTemplatePreferences(who,fresh,next);weeklyTemplates=saved.templates;weeklyTemplatesRevision=saved.revision;weeklyTemplatesLoaded=true;clearWeeklyTemplatePreview(shell,'Se duplicó una plantilla. Generá una nueva vista previa para asegurarte de aplicar la versión correcta.');renderSavedWeekTemplates(shell);status(`Plantilla duplicada como «${copy.name}». La copia tiene identificadores independientes; la plantilla original y las comidas ya planificadas no cambiaron.`,'success');
    }catch(error){if(modal===shell)status(`No se pudo duplicar la plantilla: ${error?.message||'error desconocido'}. No se modificó ninguna plantilla.`, 'error')}finally{finishBusy(shell);if(modal===shell){setWeekControlsDisabled(shell,false);updateWeeklyTemplateButtons(shell)}}
  }
  async function saveCurrentWeekTemplate(){
    if(!modal||busy)return;const shell=modal,who=uid(),week=activeWeek,name=clean(shell.weekTemplatesName.value);
    try{assertOwner(who);if(!rows.length)throw new Error('La semana no tiene comidas para guardar como plantilla.');if(!name||name.length>80)throw new Error('Escribí un nombre de entre 1 y 80 caracteres.');if(weeklyTemplates.length>=WEEK_TEMPLATE_LIMIT)throw new Error(`Llegaste al máximo de ${WEEK_TEMPLATE_LIMIT} plantillas. Eliminá una para guardar otra.`);if(weeklyTemplates.some(t=>normalize(t.name)===normalize(name)))throw new Error('Ya existe una plantilla con ese nombre. Elegí otro nombre para no confundirlas.');
      busy=true;setWeekControlsDisabled(shell,true);status('Comprobando la semana y guardando la plantilla en tu cuenta…','info');const latest=await readRows(who,week);assertOwner(who);if(weekRowsSignature(latest)!==weekRowsSignature(rows))throw new Error('La semana cambió mientras preparabas la plantilla. Actualizá el plan y volvé a intentarlo.');const prepared=createWeeklyPlanTemplate(latest,week,who,name,id(),new Date().toISOString());const fresh=await readWeeklyTemplatePreferences(who);assertOwner(who);if(fresh.revision!==weeklyTemplatesRevision)throw new Error('Las plantillas cambiaron desde otra sesión. Actualizalas y volvé a guardar.');if(fresh.templates.some(t=>normalize(t.name)===normalize(name)))throw new Error('Ya existe una plantilla con ese nombre en tu cuenta. Elegí otro nombre.');const saved=await writeWeeklyTemplatePreferences(who,fresh,[prepared,...fresh.templates]);weeklyTemplates=saved.templates;weeklyTemplatesRevision=saved.revision;weeklyTemplatesLoaded=true;renderSavedWeekTemplates(shell);shell.weekTemplatesName.value='';status(`Plantilla «${prepared.name}» guardada y sincronizada con tu cuenta. La planificación original no se modificó.`,'success');
    }catch(error){if(modal===shell)status(`No se pudo guardar la plantilla: ${error?.message||'error desconocido'}. La semana original no se modificó.`, 'error')}finally{finishBusy(shell);if(modal===shell){setWeekControlsDisabled(shell,false);updateWeeklyTemplateButtons(shell)}}
  }
  async function deleteSavedWeeklyTemplate(templateId){
    if(!modal||busy)return;const shell=modal,who=uid(),target=weeklyTemplates.find(t=>t.id===templateId);if(!target)return;if(!confirm(`¿Eliminar la plantilla «${target.name}»? Las comidas ya copiadas a semanas planificadas no se modificarán.`))return;
    try{assertOwner(who);busy=true;setWeekControlsDisabled(shell,true);status('Comprobando la versión de las plantillas…','info');const fresh=await readWeeklyTemplatePreferences(who);assertOwner(who);if(fresh.revision!==weeklyTemplatesRevision)throw new Error('Las plantillas cambiaron desde otra sesión. Actualizá la lista antes de eliminar.');const next=fresh.templates.filter(t=>t.id!==templateId);if(next.length===fresh.templates.length)throw new Error('La plantilla ya no existe. Actualizá la lista.');const saved=await writeWeeklyTemplatePreferences(who,fresh,next);weeklyTemplates=saved.templates;weeklyTemplatesRevision=saved.revision;clearWeeklyTemplatePreview(shell,'La plantilla se eliminó. Las comidas planificadas previamente permanecen intactas.');renderSavedWeekTemplates(shell);status(`Plantilla «${target.name}» eliminada. Las comidas ya planificadas no se modificaron.`,'success');
    }catch(error){if(modal===shell)status(`No se pudo eliminar la plantilla: ${error?.message||'error desconocido'}.`, 'error')}finally{finishBusy(shell);if(modal===shell){setWeekControlsDisabled(shell,false);updateWeeklyTemplateButtons(shell)}}
  }
  async function previewSavedWeeklyTemplate(templateId,selectedItemIds=null,targetDayByItemId=null){
    if(!modal||busy)return;const shell=modal,who=uid(),week=activeWeek;try{assertOwner(who);if(!shell.form.node.hidden)throw new Error('Guardá o cancelá la comida que estás editando antes de aplicar una plantilla.');if(Array.isArray(selectedItemIds)&&!selectedItemIds.length)throw new Error('Seleccioná al menos una comida para previsualizar.');busy=true;setWeekControlsDisabled(shell,true);status('Actualizando el plan y la plantilla antes de generar la vista previa…','info');const [latest,pref]=await Promise.all([readRows(who,week),readWeeklyTemplatePreferences(who)]);assertOwner(who);rows=latest;weeklyTemplates=pref.templates;weeklyTemplatesRevision=pref.revision;weeklyTemplatesLoaded=true;renderWeek();renderSavedWeekTemplates(shell);const template=weeklyTemplates.find(t=>t.id===templateId);if(!template)throw new Error('La plantilla ya no existe. Actualizá la lista.');const preview=previewWeeklyTemplate(template,latest,week,who,{includeOccupiedDays:Array.isArray(selectedItemIds)?true:!!shell.weekTemplatesMergeToggle?.checked,...(Array.isArray(selectedItemIds)?{selectedItemIds,targetDayByItemId:targetDayByItemId||{}}:{})});preview.who=who;preview.preference_revision=pref.revision;status('Calculando el posible impacto en la lista de compras (solo lectura)…','info');try{const planner=window.AgendaNutritionPlanner;if(!planner||typeof planner.previewPlanShoppingImpact!=='function')throw new Error('El módulo de compras no ofrece una estimación de impacto.');const proposed=weeklyTemplatePayloads(template,preview,latest,week,who,new Date().toISOString());preview.shopping_impact=await planner.previewPlanShoppingImpact(who,week,latest,proposed);assertOwner(who)}catch(impactError){preview.shopping_impact={available:false,message:impactError?.message||'No se pudo consultar la lista de compras. No se escribió ningún cambio.'}}previewDataSet(shell,preview);const moved=preview.day_moves?.length||0;status(Array.isArray(selectedItemIds)?`Vista previa de ${preview.selected_meal_count} comidas seleccionadas de «${template.name}»${moved?`, con ${moved} ${moved===1?'comida reubicada':'comidas reubicadas'} en otro día`:''}, para la semana ${formatWeek(week)}. Todavía no se guardó ningún cambio.`:`Vista previa de «${template.name}» lista para la semana ${formatWeek(week)}. Todavía no se guardó ningún cambio.`,'success');
    }catch(error){if(modal===shell){clearWeeklyTemplatePreview(shell,'No se pudo generar la vista previa. Actualizá los datos e intentá de nuevo.');status(`No se pudo previsualizar la plantilla: ${error?.message||'error desconocido'}. No se modificó el plan.`, 'error')}}finally{finishBusy(shell);if(modal===shell){setWeekControlsDisabled(shell,false);updateWeeklyTemplateButtons(shell)}}
  }
  function shoppingImpactQuantity(item){
    const planner=window.AgendaNutritionPlanner;
    if(!item||item.quantity_known===false||safeNum(item.quantity)===null||safeNum(item.quantity)<0)return 'cantidad sin definir';
    const number=new Intl.NumberFormat('es-AR',{maximumFractionDigits:3}).format(Number(item.quantity));
    const unit=planner?.canonicalUnit?planner.canonicalUnit(item.unit):clean(item.unit);
    const label=({g:'g',kg:'kg',ml:'ml',l:'L',unit:'unidad',portion:'porción',plan:''})[unit]??unit;
    return label?`${number} ${label}`:number;
  }
  function renderWeeklyTemplateShoppingImpact(shell,impact){
    const section=shell?.weekTemplatesShoppingImpact;if(!section)return;
    const summary=shell.weekTemplatesShoppingImpactSummary,stats=shell.weekTemplatesShoppingImpactStats,notices=shell.weekTemplatesShoppingImpactNotices,list=shell.weekTemplatesShoppingImpactList,details=shell.weekTemplatesShoppingImpactDetails;
    stats.replaceChildren();notices.replaceChildren();list.replaceChildren();details.open=false;
    const addStat=(label,value)=>{const card=el('div','nutrition-week-template-shopping-impact-stat-e40');card.append(el('span','',label),el('strong','',String(value)));stats.appendChild(card)};
    if(!impact){summary.textContent='Se calculará de forma informativa. No se modificará la lista de compras ni la despensa.';section.dataset.state='empty';return}
    if(!impact.available){summary.textContent=`No se pudo calcular una estimación fiable. ${impact.message||'La lista de compras no fue modificada.'} Podés continuar con la revisión del plan y consultar la lista de compras por separado.`;section.dataset.state='unavailable';return}
    if(impact.noPlanChanges){summary.textContent=impact.message||'Esta operación no agrega comidas; no se prevén cambios de compras atribuibles a esta plantilla.';section.dataset.state='no-change';return}
    const counts=impact.counts||{};
    const metrics=[['Nuevos en lista',counts.added||0],['A actualizar',counts.updated||0],['A reactivar',counts.reactivated||0],['A archivar',counts.archive||0],['Comprados por revisar',counts.purchasedConflicts||0],['Cantidades sin definir',counts.unknown||0]];
    for(const [label,value] of metrics)addStat(label,value);
    const planDelta=impact.planDelta||{};
    summary.textContent=`Si después de aplicar el plan elegís «Generar desde el plan», la lista podría incorporar ${counts.added||0} producto${counts.added===1?'':'s'}, actualizar ${counts.updated||0}, reactivar ${counts.reactivated||0} y archivar ${counts.archive||0} pendiente${counts.archive===1?'':'s'}. Esta vista es de solo lectura: no modifica compras ni descuenta despensa.`;
    if((counts.purchasedConflicts||0)>0){const warning=el('p','nutrition-week-template-shopping-impact-warning-e40',`${counts.purchasedConflicts} producto${counts.purchasedConflicts===1?' comprado cambia':'s comprados cambian'} respecto del plan. Al regenerar la lista, se conservarán por defecto las cantidades marcadas como compradas.`);notices.appendChild(warning)}
    if(impact.pantryUnavailable){const note=el('p','nutrition-week-template-shopping-impact-note-e40','No se pudo consultar la despensa; la estimación usa los ingredientes del plan sin descontar existencias.')}else if((impact.pantryCovered||0)>0){const note=el('p','nutrition-week-template-shopping-impact-note-e40',`Según el inventario actual, la despensa cubriría ${impact.pantryCovered} producto${impact.pantryCovered===1?' completo':'s completos'}. El inventario no se modificó.`);notices.appendChild(note)}
    const groups=[
      ['Nuevos productos',impact.diff?.added||[],item=>`${item.name} · ${shoppingImpactQuantity(item)}`],
      ['Productos que cambiarían',impact.diff?.updated||[],entry=>`${entry.item.name} · ${shoppingImpactQuantity(entry.previous)} → ${shoppingImpactQuantity(entry.item)}`],
      ['Productos que volverían a la lista',impact.diff?.reactivated||[],entry=>`${entry.item.name} · ${shoppingImpactQuantity(entry.item)}`],
      ['Pendientes que se archivarían',impact.diff?.archive||[],item=>`${item.name} · ${shoppingImpactQuantity(item)}`],
      ['Compras cuya cantidad requiere revisión',impact.diff?.purchasedConflicts||[],item=>`${item.name} · comprado: ${shoppingImpactQuantity(item)} · plan: ${shoppingImpactQuantity((impact.diff?.desired||[]).find(row=>String(row.item_key)===String(item.item_key)))}`],
      ['Cantidades desconocidas',impact.diff?.unknown||[],item=>`${item.name} · ${shoppingImpactQuantity(item)}`]
    ];
    let totalRows=0;
    for(const [title,items,format] of groups){if(!items.length)continue;const heading=el('li','nutrition-week-template-shopping-impact-group-e40');heading.textContent=title;list.appendChild(heading);for(const entry of items.slice(0,4)){const li=el('li','nutrition-week-template-shopping-impact-item-e40',format(entry));list.appendChild(li);totalRows++}if(items.length>4){const li=el('li','nutrition-week-template-shopping-impact-more-e40',`Y ${items.length-4} producto${items.length-4===1?' más':'s más'}…`);list.appendChild(li)}}
    if(!totalRows){const li=el('li','nutrition-week-template-shopping-impact-item-e40','No se prevén cambios en los productos que ya figuran en la lista.');list.appendChild(li)}
    details.querySelector('summary').textContent=`Ver productos que podrían cambiar (${totalRows})`;
    section.dataset.state='available';
  }
  function renderWeeklyTemplateChangeReview(shell,preview){
    const review=preview.change_review;if(!shell?.weekTemplatesChangeReviewStats||!shell?.weekTemplatesChangeReviewList||!review)return;
    renderWeeklyTemplateShoppingImpact(shell,preview.shopping_impact||null);
    shell.weekTemplatesChangeReviewStats.replaceChildren();shell.weekTemplatesChangeReviewList.replaceChildren();
    const stats=[['Por agregar',review.summary.toAdd],['Ya presentes',review.summary.alreadyPresent],['Días ocupados',review.summary.occupiedDays],['Comidas existentes conservadas',review.summary.preservedExistingMeals],['Cantidades desconocidas',review.summary.unknownQuantities],['Comidas con nutrientes incompletos',review.summary.incompleteNutrition]];
    for(const [label,value] of stats){const card=el('div','nutrition-week-template-change-review-stat-e39');card.append(el('span','',label),el('strong','',String(value)));shell.weekTemplatesChangeReviewStats.appendChild(card)}
    const mealLabel=item=>MEALS.find(entry=>entry[0]===item.meal_type)?.[1]||item.meal_type||'Comida';
    const actionLabels={add:'Se agregará',already:'Ya aplicada',skip:'Día omitido'};
    for(const item of review.items){const li=el('li','nutrition-week-template-change-review-item-e39');li.dataset.action=item.action;const top=el('div','nutrition-week-template-change-review-item-top-e39');top.append(el('strong','',item.title));const badge=el('span',`nutrition-week-template-change-review-badge-e39 is-${item.action}`,actionLabels[item.action]||'Revisar');top.appendChild(badge);li.appendChild(top);
      const route=item.source_day===item.target_day?`${DAY_NAMES[item.target_day]} · ${mealLabel(item)}`:`${DAY_NAMES[item.source_day]} → ${DAY_NAMES[item.target_day]} · ${mealLabel(item)}`;
      li.appendChild(el('p','nutrition-week-template-change-review-route-e39',`${route}${item.planned_time?` · ${item.planned_time}`:''}`));
      if(item.action==='already')li.appendChild(el('p','nutrition-week-template-change-review-note-e39','Esta comida ya está aplicada en el destino; no se volverá a duplicar.'));
      if(item.action==='skip'){
        li.appendChild(el('p','nutrition-week-template-change-review-warning-e39',`Este día está ocupado y se omitirá. Se conservarán ${item.existing_destination_count} ${item.existing_destination_count===1?'comida existente':'comidas existentes'}.`));
        if(item.existing_destination_titles?.length)li.appendChild(el('p','nutrition-week-template-change-review-existing-e39',`En el destino: ${item.existing_destination_titles.join(' · ')}${item.existing_destination_count>item.existing_destination_titles.length?' · y otras':''}`));
      }else if(item.action==='add'&&item.existing_destination_count){
        const occupiedCount=item.existing_destination_count;const occupiedPhrase=occupiedCount===1?'comida ajena a esta selección':'comidas ajenas a esta selección';
        li.appendChild(el('p','nutrition-week-template-change-review-warning-e39',`El día de destino ya tiene ${occupiedCount} ${occupiedPhrase}; se conservarán sin cambios.`));
        if(item.existing_destination_titles?.length)li.appendChild(el('p','nutrition-week-template-change-review-existing-e39',`Ya existen: ${item.existing_destination_titles.join(' · ')}${item.existing_destination_count>item.existing_destination_titles.length?' · y otras':''}`));
      }
      const warnings=[];if(item.unknown_quantity_count)warnings.push(`${item.unknown_quantity_count} ${item.unknown_quantity_count===1?'ingrediente tiene una cantidad':'ingredientes tienen cantidades'} desconocida(s)`);if(item.incomplete_nutrition)warnings.push('nutrientes incompletos');if(warnings.length)li.appendChild(el('p','nutrition-week-template-change-review-warning-e39',`Revisar datos: ${warnings.join(' y ')}. Se conservarán como incompletos; no se inventarán valores.`));
      shell.weekTemplatesChangeReviewList.appendChild(li);
    }
    shell.weekTemplatesChangeReviewDetails.open=false;
    shell.weekTemplatesChangeReviewDetails.querySelector('summary').textContent=`Ver detalle de cada comida y sus posibles conflictos (${review.items.length})`;
  }
  function previewDataSet(shell,preview){
    shell.weekTemplatesPreviewData=preview;shell.weekTemplatesPreview.hidden=false;shell.weekTemplatesPreviewList.replaceChildren();const c=preview.counts;
    const alreadyText=c.mealsAlreadyPresent===1?'1 comida de esta selección ya está aplicada':`${c.mealsAlreadyPresent} comidas de esta selección ya están aplicadas`;
    const skippedText=c.daysSkipped===1?'se omite 1 día':`se omiten ${c.daysSkipped} días`;
    const mergeNote=preview.selected_item_ids?` Selección parcial: ${preview.selected_meal_count} de ${preview.template_meal_count} comidas. Se combinarán solo las seleccionadas, conservando todo lo existente.`:preview.includeOccupiedDays?` Modo combinar activado: ${c.daysMerged} ${c.daysMerged===1?'día ocupado recibirá':'días ocupados recibirán'} comidas nuevas sin reemplazar las existentes.`:' Los días ocupados se omiten por defecto.';
    const moves=Array.isArray(preview.day_moves)?preview.day_moves:[];const movedNote=moves.length?` Se reubicarán ${moves.length} ${moves.length===1?'comida':'comidas'} en días distintos a los de la plantilla (${moves.map(move=>`${clean(move.title)||'Comida sin nombre'}: ${DAY_NAMES[move.from_day]} → ${DAY_NAMES[move.to_day]}`).join('; ')}).`:' Se conservarán los días de origen de las comidas seleccionadas.';
    shell.weekTemplatesPreviewSummary.textContent=`«${preview.template_name}»: se agregarán ${c.mealsToAdd} ${c.mealsToAdd===1?'comida':'comidas'} en ${c.daysToApply} ${c.daysToApply===1?'día':'días'}; ${alreadyText} y ${skippedText}. No se reemplazará ninguna comida existente.${mergeNote}${preview.selected_item_ids?movedNote:''}`;
    for(const day of preview.days){if(day.status==='empty')continue;let label;const existingLabel=n=>`${n} ${n===1?'comida existente':'comidas existentes'}`;const mealCountLabel=n=>`${n} ${n===1?'comida':'comidas'}`;if(day.status==='skip')label=`omitido · ${existingLabel(day.existingCount)}`;else if(day.status==='already')label=`${mealCountLabel(day.alreadyCount)} de esta plantilla ya aplicadas`;else if(day.status==='merge')label=`agregar ${mealCountLabel(day.addCount)} · conservar ${existingLabel(day.unrelatedCount)}`;else label=`agregar ${mealCountLabel(day.addCount)}`;const li=el('li','',`${DAY_NAMES[day.day]}: ${label}`);if(day.status==='skip')li.classList.add('is-skip');if(day.status==='already')li.classList.add('is-already');if(day.status==='merge')li.classList.add('is-merge');shell.weekTemplatesPreviewList.appendChild(li)}
    shell.weekTemplatesConfirm.disabled=busy||c.mealsToAdd===0;
    if(c.mealsToAdd===0)shell.weekTemplatesPreviewSummary.textContent+=' No hay cambios para aplicar; elegí otra semana o revisá las comidas existentes.';
    renderWeeklyTemplateChangeReview(shell,preview);
  }
  async function commitWeeklyTemplate(){
    if(!modal||busy||!modal.weekTemplatesPreviewData)return;const shell=modal,preview=shell.weekTemplatesPreviewData,who=uid(),week=activeWeek;if(preview.who!==who||preview.target_week!==week){clearWeeklyTemplatePreview(shell,'Cambió la cuenta o la semana. Generá una nueva vista previa.');status('Cambió la cuenta o la semana; no se aplicó la plantilla.','error');return}
    try{assertOwner(who);busy=true;setWeekControlsDisabled(shell,true);status('Verificando versión de la semana y la plantilla antes de aplicar…','info');const [latest,pref]=await Promise.all([readRows(who,week),readWeeklyTemplatePreferences(who)]);assertOwner(who);const template=pref.templates.find(t=>t.id===preview.template_id);if(!template)throw new Error('La plantilla se eliminó desde otra sesión. No se aplicó ningún cambio.');if(pref.revision!==preview.preference_revision||JSON.stringify(template)!==preview.template_signature)throw new Error('La plantilla cambió desde la vista previa. Generá una nueva antes de aplicar.');
      const freshPreview=previewWeeklyTemplate(template,latest,week,who,{includeOccupiedDays:preview.includeOccupiedDays===true,...(Array.isArray(preview.selected_item_ids)?{selectedItemIds:preview.selected_item_ids,targetDayByItemId:preview.target_day_overrides||{}}:{})});if(freshPreview.target_signature!==preview.target_signature)throw new Error('El plan de destino cambió desde la vista previa. No se sobrescribió nada; revisá el plan y generá otra vista previa.');
      const payloads=weeklyTemplatePayloads(template,preview,latest,week,who,new Date().toISOString());if(!payloads.length){weeklyTemplates=pref.templates;weeklyTemplatesRevision=pref.revision;rows=latest;renderWeek();clearWeeklyTemplatePreview(shell,'No hay comidas nuevas para agregar. La plantilla ya está aplicada o no hay días compatibles.');status('No había cambios pendientes. Ninguna comida fue reemplazada.','info');return}
      if(preview.shopping_impact?.available&&preview.shopping_impact.existingSignature&&window.AgendaNutritionPlanner?.getShoppingListSignature){const currentShoppingSignature=await window.AgendaNutritionPlanner.getShoppingListSignature(who,week);assertOwner(who);if(currentShoppingSignature!==preview.shopping_impact.existingSignature){clearWeeklyTemplatePreview(shell,'La lista de compras cambió desde la revisión. Generá una vista previa nueva para actualizar el impacto estimado; no se modificó el plan.');throw new Error('La lista de compras cambió desde la vista previa. No se aplicó la plantilla; generá una nueva revisión.')}}
      const client=await getClient();assertOwner(who);const result=await client.from('nutrition_weekly_plan_items').upsert(payloads,{onConflict:'user_id,week_start,plan_key',ignoreDuplicates:true}).select('id,plan_key');if(result.error)throw result.error;assertOwner(who);
      const saved=await readRows(who,week);assertOwner(who);const allKeys=new Set(saved.map(r=>String(r.plan_key||'')));const missing=payloads.filter(p=>!allKeys.has(p.plan_key));if(missing.length)throw new Error(`Supabase todavía no confirma ${missing.length} comida(s). Podés reintentar la misma vista previa sin duplicar las que ya se guardaron.`);
      rows=saved;weeklyTemplates=pref.templates;weeklyTemplatesRevision=pref.revision;renderWeek();clearWeeklyTemplatePreview(shell,'Plantilla aplicada y confirmada.');const selectedText=Array.isArray(preview.selected_item_ids)?(payloads.length===1?' seleccionada':' seleccionadas'):'';status(`Plantilla «${template.name}» aplicada: ${payloads.length===1?'se agregó':'se agregaron'} ${payloads.length} ${payloads.length===1?'comida':'comidas'}${selectedText}. Todas las comidas que ya existían se conservaron${preview.includeOccupiedDays?' también en los días combinados':''}. La lista de compras todavía no se modificó.`,'success');showPostApplyShoppingHandoff(shell,week,preview.shopping_impact);
    }catch(error){if(modal===shell)status(`No se pudo confirmar la plantilla: ${error?.message||'error desconocido'}. La vista previa se conserva si todavía es válida; podés revisar y reintentar.`, 'error')}
    finally{finishBusy(shell);if(modal===shell){setWeekControlsDisabled(shell,false);updateWeeklyTemplateButtons(shell)}}
  }
  function openModal(){if(modal)return;const trigger=document.activeElement;const shell=makeShell(trigger);const toolbar=el('div','nutrition-plan-toolbar');const weekWrap=el('label','nutrition-plan-week-label');weekWrap.appendChild(el('span','','Semana (fecha de lunes)'));const date=document.createElement('input');date.type='date';date.value=currentMonday();date.addEventListener('change',()=>{try{activeWeek=mondayIso(date.value);date.value=activeWeek;resetForm();loadWeek()}catch(e){status(e.message,'error');date.value=activeWeek}});weekWrap.appendChild(date);const prev=document.createElement('button');prev.type='button';prev.className='small-btn';prev.textContent='← Anterior';prev.addEventListener('click',()=>changeWeek(-7));const next=document.createElement('button');next.type='button';next.className='small-btn';next.textContent='Siguiente →';next.addEventListener('click',()=>changeWeek(7));const refresh=document.createElement('button');refresh.type='button';refresh.className='small-btn';refresh.textContent='Actualizar';refresh.addEventListener('click',()=>loadWeek());const add=document.createElement('button');add.type='button';add.className='small-btn primary';add.textContent='＋ Agregar comida';add.addEventListener('click',()=>startAdd(0));const copyDayToggle=document.createElement('button');copyDayToggle.type='button';copyDayToggle.className='small-btn nutrition-plan-copy-day-toggle-e31';copyDayToggle.id='nutritionPlanCopyDayToggleE31';copyDayToggle.textContent='Copiar día completo';copyDayToggle.title='Copiar las comidas de un día a otro sin reemplazar las comidas del destino';copyDayToggle.setAttribute('aria-expanded','false');copyDayToggle.setAttribute('aria-controls','nutritionPlanCopyDayPanel');copyDayToggle.addEventListener('click',()=>{if(!shell.form.node.hidden){status('Guardá o cancelá la comida que estás editando antes de copiar un día.','error');return}const opening=shell.copyDayPanel.hidden;shell.copyDayPanel.hidden=!opening;copyDayToggle.setAttribute('aria-expanded',String(opening));if(opening){refreshCopyDayOptions(shell);shell.copyDaySource.focus()}});const weekTemplatesToggle=document.createElement('button');weekTemplatesToggle.type='button';weekTemplatesToggle.className='small-btn nutrition-week-templates-toggle-e32';weekTemplatesToggle.id='nutritionWeekTemplatesToggleE32';weekTemplatesToggle.textContent='Plantillas semanales';weekTemplatesToggle.title='Guardar y reutilizar una semana completa sin reemplazar comidas existentes';weekTemplatesToggle.setAttribute('aria-expanded','false');weekTemplatesToggle.setAttribute('aria-controls','nutritionWeekTemplatesPanelE32');weekTemplatesToggle.addEventListener('click',()=>{if(!shell.form.node.hidden){status('Guardá o cancelá la comida que estás editando antes de abrir las plantillas.','error');return}const opening=shell.weekTemplatesPanel.hidden;shell.weekTemplatesPanel.hidden=!opening;weekTemplatesToggle.setAttribute('aria-expanded',String(opening));if(opening){renderSavedWeekTemplates(shell);shell.weekTemplatesName.focus()}});const imp=document.createElement('button');imp.type='button';imp.className='small-btn';imp.textContent='Copiar rutina habitual';imp.addEventListener('click',importRoutine);const exp=document.createElement('button');exp.type='button';exp.className='small-btn';exp.textContent='Exportar plan CSV';exp.title='Descargar la semana fechada y las instantáneas de ingredientes';exp.disabled=true;exp.addEventListener('click',exportWeekCsv);toolbar.append(weekWrap,prev,next,refresh,add,copyDayToggle,weekTemplatesToggle,imp,exp);const copyDay=buildCopyDayPanel();const weeklyPanel=buildWeekTemplatesPanel();const st=el('p','nutrition-plan-editor-status','');st.setAttribute('role','status');st.setAttribute('aria-live','polite');const postApplyShopping=buildPostApplyShoppingHandoff();const grid=el('div','nutrition-plan-week-grid');const form=buildForm();shell.body.append(toolbar,copyDay.panel,weeklyPanel.panel,st,postApplyShopping.panel,form.node,grid);shell.date=date;shell.prev=prev;shell.next=next;shell.refresh=refresh;shell.add=add;shell.copyDayToggle=copyDayToggle;shell.weekTemplatesToggle=weekTemplatesToggle;shell.copyDayPanel=copyDay.panel;shell.copyDaySource=copyDay.source;shell.copyDayTarget=copyDay.target;shell.copyDayPreviewBox=copyDay.previewBox;shell.copyDayPreviewSummary=copyDay.summary;shell.copyDayPreviewList=copyDay.list;shell.copyDayPreviewBtn=copyDay.previewButton;shell.copyDayConfirm=copyDay.confirmButton;shell.copyDayCancel=copyDay.cancelButton;shell.copyDayPreview=null;shell.copyDayOperationKey='';shell.weekTemplatesPanel=weeklyPanel.panel;shell.weekTemplatesName=weeklyPanel.name;shell.weekTemplatesSave=weeklyPanel.save;shell.weekTemplatesList=weeklyPanel.list;shell.weekTemplatesMergeToggle=weeklyPanel.mergeToggle;shell.weekTemplatesComparePanel=weeklyPanel.comparePanel;shell.weekTemplatesCompareSummary=weeklyPanel.compareSummary;shell.weekTemplatesCompareDifferences=weeklyPanel.compareDifferences;shell.weekTemplatesCompareClear=weeklyPanel.compareClear;shell.weekTemplateCompareIds=[];shell.weekTemplatesPreview=weeklyPanel.preview;shell.weekTemplatesPreviewSummary=weeklyPanel.previewSummary;shell.weekTemplatesPreviewList=weeklyPanel.previewList;shell.weekTemplatesChangeReview=weeklyPanel.changeReview;shell.weekTemplatesChangeReviewStats=weeklyPanel.changeReviewStats;shell.weekTemplatesShoppingImpact=weeklyPanel.shoppingImpact;shell.weekTemplatesShoppingImpactSummary=weeklyPanel.shoppingImpactSummary;shell.weekTemplatesShoppingImpactStats=weeklyPanel.shoppingImpactStats;shell.weekTemplatesShoppingImpactNotices=weeklyPanel.shoppingImpactNotices;shell.weekTemplatesShoppingImpactDetails=weeklyPanel.shoppingImpactDetails;shell.weekTemplatesShoppingImpactList=weeklyPanel.shoppingImpactList;shell.weekTemplatesChangeReviewDetails=weeklyPanel.changeReviewDetails;shell.weekTemplatesChangeReviewList=weeklyPanel.changeReviewList;shell.weekTemplatesConfirm=weeklyPanel.confirm;shell.weekTemplatesCancel=weeklyPanel.cancel;shell.weekTemplatesPreviewData=null;shell.postApplyShoppingHandoff=postApplyShopping.panel;shell.postApplyShoppingHeading=postApplyShopping.heading;shell.postApplyShoppingMessage=postApplyShopping.message;shell.postApplyShoppingButton=postApplyShopping.button;shell.postApplyShoppingImpactDetails=postApplyShopping.impactDetails;shell.postApplyShoppingImpactDetailsSummary=postApplyShopping.impactDetailsSummary;shell.postApplyShoppingImpactSummary=postApplyShopping.impactSummary;shell.postApplyShoppingImpactStats=postApplyShopping.impactStats;shell.postApplyShoppingImpactNotices=postApplyShopping.impactNotices;shell.postApplyShoppingImpactList=postApplyShopping.impactList;shell.postApplyShoppingCopyReportE43=postApplyShopping.copyReport;shell.postApplyShoppingDownloadReportE43=postApplyShopping.downloadReport;shell.postApplyShoppingReportStatusE43=postApplyShopping.reportStatus;shell.postApplyShoppingImpactDataE43=null;shell.postApplyShoppingOwnerE43='';shell.postApplyShoppingImpactCapturedAtE43='';shell.postApplyShoppingWeek='';postApplyShopping.copyReport.addEventListener('click',()=>copyPostApplyShoppingReportE43(shell));postApplyShopping.downloadReport.addEventListener('click',()=>downloadPostApplyShoppingReportE43(shell));postApplyShopping.button.addEventListener('click',()=>{const targetWeek=shell.postApplyShoppingWeek;if(!targetWeek){shell.postApplyShoppingMessage.textContent='Volvé a aplicar una plantilla para seleccionar la semana correcta. No se modificó ninguna compra.';return}const planner=window.AgendaNutritionPlanner;if(!planner||typeof planner.openShopping!=='function'){shell.postApplyShoppingMessage.textContent='La lista de compras no está disponible en esta carga. Recargá la aplicación y abrila desde Alimentación; no se modificó ninguna compra.';return}try{closeModal();planner.openShopping({week:targetWeek})}catch(error){if(shell.trigger?.isConnected){let notice=document.getElementById('nutritionShoppingHandoffErrorE41');if(!notice){notice=document.createElement('p');notice.id='nutritionShoppingHandoffErrorE41';notice.setAttribute('role','alert');notice.className='nutrition-week-template-shopping-handoff-message-e41';(document.getElementById('nutritionPanel')||shell.trigger.parentElement)?.appendChild(notice)}notice.textContent=`El plan quedó guardado, pero no se pudo abrir la lista de compras: ${error?.message||'error desconocido'}. No se modificó ninguna compra.`}}});shell.weekTemplateSelectionOpenId='';shell.weekTemplateSelectedItemIds=new Map();shell.weekTemplateTargetDays=new Map();shell.import=imp;shell.export=exp;shell.status=st;shell.grid=grid;shell.form=form;modal=shell;activeWeek=currentMonday();date.value=activeWeek;loadWeek()}
  function closeModal(){if(busy&&modal)return;token++;if(!modal)return;const shell=modal;modal=null;rows=[];templates=[];templateItems=new Map();editRow=null;duplicateSourceRow=null;duplicateOperationKeys.clear();shell.overlay.remove();if(shell.trigger?.isConnected)shell.trigger.focus()}
  async function getShoppingSource(who,week){
    assertOwner(who);
    const normalized=mondayIso(week);
    if(normalized!==week)throw new Error('La semana de la lista debe comenzar un lunes.');
    const c=await getClient();assertOwner(who);const plan=[];const page=250;
    for(let offset=0;offset<10000;offset+=page){
      const res=await c.from('nutrition_weekly_plan_items').select('id,user_id,week_start,day_offset,meal_type,title,planned_time,ingredients_snapshot').eq('user_id',who).eq('week_start',week).order('day_offset',{ascending:true}).order('planned_time',{ascending:true,nullsFirst:false}).range(offset,offset+page-1);
      if(res.error)throw res.error;assertOwner(who);
      const batch=Array.isArray(res.data)?res.data:[];plan.push(...batch);
      if(batch.length<page)break;
      if(offset+page>=10000)throw new Error('El plan tiene demasiadas comidas para generar una compra.');
    }
    const items=[];
    for(const meal of plan){
      const snap=Array.isArray(meal.ingredients_snapshot)?meal.ingredients_snapshot:[];
      for(const item of snap){if(!item||!clean(item.name))continue;items.push({...item,meal_id:String(meal.id),user_id:who,categories:item.categories||item.category||'Otros'});}
    }
    return {meals:plan,items};
  }
  async function refreshForAuth(){token++;weeklyTemplates=[];weeklyTemplatesRevision='';weeklyTemplatesLoaded=false;if(modal){rows=[];templates=[];templateItems=new Map();recipes=[];modal.weekTemplateSelectedItemIds=new Map();modal.weekTemplateTargetDays=new Map();modal.weekTemplateSelectionOpenId='';clearWeeklyTemplatePreview(modal,'La sesión cambió. Se borró la vista previa para evitar mezclar cuentas.');duplicateOperationKeys.clear();modal.grid.replaceChildren();activeWeek=currentMonday();modal.date.value=activeWeek;status('La sesión cambió. Comprobando la cuenta activa…');if(busy)authReloadPending=true;else loadWeek(true)}}
  function init(){const actions=$('nutritionPanel')?.querySelector('.nutrition-actions');if(actions&&!$('nutritionPlanWeekEditorBtn')){const b=document.createElement('button');b.type='button';b.id='nutritionPlanWeekEditorBtn';b.className='small-btn nutrition-week-tool-btn nutrition-plan-entry-btn';b.textContent='🗓️ Planificar semana';b.title='Organizar comidas por fecha sin modificar la rutina habitual';b.addEventListener('click',openModal);actions.appendChild(b)}if(window.sb?.auth?.onAuthStateChange&&!window.__agendaNutritionWeeklyPlanAuthBound){window.__agendaNutritionWeeklyPlanAuthBound=true;window.sb.auth.onAuthStateChange(()=>setTimeout(refreshForAuth,0))}}
  window.AgendaNutritionWeeklyPlan={strictIso,mondayIso,addDays,safeSnapshotItems,snapshotForTemplate,snapshotForRecipe,clonePlanSnapshot,scaleRecipeSnapshot,templatePlanPayload,sourcePlanKey,duplicatePlanPayload,movePlanPayload,orderedDayRows,dayRowsSignature,dayCopyStats,dayCopyPlanKey,copyDayPlanPayloads,createWeeklyPlanTemplate,normalizeWeeklyTemplates,renameWeeklyPlanTemplate,uniqueWeeklyTemplateCopyName,duplicateWeeklyPlanTemplate,weeklyTemplateSummary,compareWeeklyPlanTemplates,weekRowsSignature,weeklyTemplatePlanKey,previewWeeklyTemplate,weeklyTemplatePayloads,nutritionSummary,getShoppingSource,weekCsvRows,weekCsvText,csvCell,postApplyShoppingReportRowsE43,postApplyShoppingCsvE43,postApplyShoppingPlainTextE43,open:openModal};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
