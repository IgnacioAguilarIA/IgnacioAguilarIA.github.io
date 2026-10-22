/* Agenda FICH — Etapa 1 de Alimentación
 * Los objetivos y el consumo real se calculan únicamente con alimentos marcados.
 * El total planificado se muestra por separado y nunca se mezcla con el consumido.
 */
(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const cache=new Map();
  let refreshSeq=0;
  let activeDay=null;
  let refreshTimer=null;
  let refreshing=false;

  function mealsForDay(day){
    const list=(typeof nutritionMeals!=='undefined'&&Array.isArray(nutritionMeals))?nutritionMeals:[];
    return list.filter(m=>Number(m.day)===Number(day));
  }
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function grams(item){return window.AgendaNutritionData?.weightInGrams?window.AgendaNutritionData.weightInGrams(item):((String(item?.unit||'g')==='g')?Math.max(0,num(item?.quantity)):null)}
  function round1(v){return Math.round(num(v)*10)/10}
  function fmt(v,unit){const n=round1(v);return unit==='kcal'?Math.round(n)+' kcal':(Number.isInteger(n)?String(n):n.toFixed(1))+' g'}
  const MACRO_KEYS=['calories','protein','carbs','fat'];
  const MACRO_LABELS={calories:'calorías',protein:'proteínas',carbs:'carbohidratos',fat:'grasas'};
  function emptyMacros(){return {calories:0,protein:0,carbs:0,fat:0}}
  function emptyFlags(){return {calories:false,protein:false,carbs:false,fat:false}}
  function emptyTotals(){return {planned:emptyMacros(),consumed:emptyMacros(),plannedIncomplete:emptyFlags(),consumedIncomplete:emptyFlags(),foodTotal:0,foodConsumed:0,unconvertible:0}}
  function missingMetrics(item){
    try{const helper=window.AgendaNutritionData?.missingMacroMetrics;if(typeof helper==='function')return helper(item)}catch(_){}
    const fields=Array.isArray(item?.nutrition_missing_fields)?item.nutrition_missing_fields:(Array.isArray(item?.nutritionMissing)?item.nutritionMissing:[]);
    const normalized=fields.map(value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim());
    const aliases={calories:['caloria','calorias','calorie','calories','energy','kcal'],protein:['proteina','proteinas','protein','proteins'],carbs:['carbohidrato','carbohidratos','carbohydrate','carbohydrates','carbs'],fat:['grasa','grasas','fat','fats']};
    if(String(item?.nutrition_quality_status||item?.nutritionQualityStatus||'').toLowerCase()==='incomplete'&&!fields.length)return [...MACRO_KEYS];
    return MACRO_KEYS.filter(key=>normalized.some(name=>aliases[key].some(alias=>name===alias||name.startsWith(alias+' ')||name.includes(' '+alias+' ')||name.endsWith(' '+alias))));
  }
  function markAllIncomplete(flags){MACRO_KEYS.forEach(key=>{flags[key]=true})}
  function mergeFlags(target,source){MACRO_KEYS.forEach(key=>{target[key]=!!target[key]||!!source?.[key]})}
  function formatMetric(value,key,unit,incomplete){return incomplete?.[key]?'Datos incompletos':fmt(value,unit)}
  function uid(){return (typeof currentUser!=='undefined'&&currentUser?.id)||'guest'}
  function readFallback(itemId){try{return localStorage.getItem(`agendaNutritionConsumed:${uid()}:${String(itemId)}`)==='1'}catch(_){return false}}
  function clearFallback(itemId){try{localStorage.removeItem(`agendaNutritionConsumed:${uid()}:${String(itemId)}`)}catch(_){ }}
  function consumedValue(item){
    // Si Supabase devolvió el booleano, ese valor es la fuente de verdad.
    // localStorage se usa únicamente para registros antiguos que no tienen el campo.
    return typeof item?.consumed==='boolean'?item.consumed:readFallback(item?.id);
  }

  // Comidas antiguas guardadas solo con macros manuales. Se representan como
  // una única entrada consumible para conservar compatibilidad con esos registros.
  function fallbackItem(meal){
    if(!meal?.id)return null;
    const id=`fallback-meal:${String(meal.id)}`;
    return {
      id,meal_id:String(meal.id),name:String(meal.foods||meal.title||'Comida').trim()||'Comida',
      quantity:100,unit:'plan',calories_per_100g:num(meal.calories),
      protein_per_100g:num(meal.protein_g),carbs_per_100g:num(meal.carbs_g),
      fat_per_100g:num(meal.fat_g),consumed:readFallback(id),consumed_at:null,__fallback:true
    };
  }

  function addItemMacros(target,item,factor,incompleteFlags){
    const missing=new Set(missingMetrics(item));
    MACRO_KEYS.forEach(key=>{
      if(missing.has(key))incompleteFlags[key]=true;
      else target[key]+=num(item[({calories:'calories_per_100g',protein:'protein_per_100g',carbs:'carbs_per_100g',fat:'fat_per_100g'})[key]])*factor;
    });
  }

  function itemTotals(items){
    const totals=emptyTotals();
    (Array.isArray(items)?items:[]).forEach(item=>{
      if(!item||typeof item!=='object')return;
      const weight=item.__fallback?null:grams(item);
      if(!item.__fallback&&weight===null){
        totals.unconvertible++;totals.foodTotal++;markAllIncomplete(totals.plannedIncomplete);
        if(consumedValue(item)){totals.foodConsumed++;markAllIncomplete(totals.consumedIncomplete)}
        return;
      }
      const factor=item.__fallback?1:weight/100;
      totals.foodTotal++;
      addItemMacros(totals.planned,item,factor,totals.plannedIncomplete);
      if(consumedValue(item)){
        totals.foodConsumed++;
        addItemMacros(totals.consumed,item,factor,totals.consumedIncomplete);
      }
    });
    return totals;
  }

  function dayTotals(day=activeDay){
    const totals=emptyTotals();
    mealsForDay(day).forEach(meal=>{
      const items=cache.get(String(meal.id));
      if(!Array.isArray(items))return;
      const mt=itemTotals(items);
      MACRO_KEYS.forEach(key=>{
        totals.planned[key]+=mt.planned[key];
        totals.consumed[key]+=mt.consumed[key];
      });
      mergeFlags(totals.plannedIncomplete,mt.plannedIncomplete);
      mergeFlags(totals.consumedIncomplete,mt.consumedIncomplete);
      totals.foodTotal+=mt.foodTotal;
      totals.foodConsumed+=mt.foodConsumed;
      totals.unconvertible+=mt.unconvertible;
    });
    return totals;
  }

  function set(id,value){const el=$(id);if(el)el.textContent=value}

  function renderGoalCards(consumed,incomplete=emptyFlags()){
    const host=$('nutritionGoals');
    if(!host)return;
    const goals=(typeof nutritionGoals!=='undefined'&&nutritionGoals)||{calories:2500,protein:160,carbs:300,fat:70};
    const items=[['🔥','Calorías','calories','kcal'],['🥩','Proteínas','protein','g'],['🍚','Carbohidratos','carbs','g'],['🥑','Grasas','fat','g']];
    host.innerHTML='';
    items.forEach(([icon,label,key,unit])=>{
      const value=num(consumed[key]);
      const target=Math.max(0,num(goals[key]));
      const unknown=!!incomplete[key];
      const pct=target>0?Math.min(100,value/target*100):0;
      const card=document.createElement('div');
      card.className='goal-card'+(unknown?' has-incomplete-data':'');
      const heading=document.createElement('h4');heading.textContent=`${icon} ${label} consumidas`;
      const amount=document.createElement('strong');
      amount.textContent=unknown?`Datos incompletos · objetivo ${target} ${unit}`:`${key==='calories'?Math.round(value):round1(value)} / ${target} ${unit}`;
      const bar=document.createElement('div');bar.className='goal-bar';bar.hidden=unknown;bar.setAttribute('aria-hidden',unknown?'true':'false');
      const fill=document.createElement('span');fill.style.width=pct+'%';bar.appendChild(fill);
      const percent=document.createElement('span');percent.textContent=unknown?'Completá los datos del alimento para ver el progreso':`${Math.round(pct)}% del objetivo`;
      card.append(heading,amount,bar,percent);host.appendChild(card);
    });
    const summary=$('nutritionGoalSummary');
    if(summary)summary.textContent=`Objetivos diarios: ${num(goals.calories)} kcal · ${num(goals.protein)} g proteína · ${num(goals.carbs)} g carbohidratos · ${num(goals.fat)} g grasas`;
  }

  function render(day=activeDay){
    const host=$('nutritionDaySummary');
    if(!host)return;
    const d=Number(day);
    const meals=mealsForDay(d);
    const totals=dayTotals(d);
    const consumed=totals.consumed;
    const planned=totals.planned;
    const types=typeof MEAL_TYPES!=='undefined'&&Array.isArray(MEAL_TYPES)?MEAL_TYPES:[];
    const plannedTypes=new Set(meals.map(m=>String(m.meal_type||'')).filter(Boolean));
    const covered=Math.min(types.length,plannedTypes.size);
    const plannedPct=types.length?Math.round(covered/types.length*100):0;
    const foodPct=totals.foodTotal?Math.round(totals.foodConsumed/totals.foodTotal*100):0;
    const days=typeof DAYS!=='undefined'&&Array.isArray(DAYS)?DAYS:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    set('nutritionSummaryDay',days[d]||'Día');
    set('nutritionSummaryMeals',`${meals.length} comida${meals.length===1?'':'s'} planificada${meals.length===1?'':'s'} · ${totals.foodConsumed}/${totals.foodTotal} alimentos consumidos${totals.unconvertible?` · ${totals.unconvertible} sin conversión fiable`:''}`);
    const planBar=$('nutritionSummaryMealsBar');if(planBar)planBar.style.width=plannedPct+'%';
    const consumedBar=$('nutritionSummaryConsumedBar');if(consumedBar)consumedBar.style.width=foodPct+'%';

    const value=(target,key,unit,incomplete)=>formatMetric(target[key],key,unit,incomplete);
    set('nutritionSummaryCaloriesPlanned',value(planned,'calories','kcal',totals.plannedIncomplete));
    set('nutritionSummaryProteinPlanned',value(planned,'protein','g',totals.plannedIncomplete));
    set('nutritionSummaryCarbsPlanned',value(planned,'carbs','g',totals.plannedIncomplete));
    set('nutritionSummaryFatPlanned',value(planned,'fat','g',totals.plannedIncomplete));
    set('nutritionSummaryCalories',value(consumed,'calories','kcal',totals.consumedIncomplete));
    set('nutritionSummaryProtein',value(consumed,'protein','g',totals.consumedIncomplete));
    set('nutritionSummaryCarbs',value(consumed,'carbs','g',totals.consumedIncomplete));
    set('nutritionSummaryFat',value(consumed,'fat','g',totals.consumedIncomplete));
    set('nutritionSummaryCaloriesConsumed',`Consumidas: ${value(consumed,'calories','kcal',totals.consumedIncomplete)}`);
    set('nutritionSummaryProteinConsumed',`Consumidas: ${value(consumed,'protein','g',totals.consumedIncomplete)}`);
    set('nutritionSummaryCarbsConsumed',`Consumidos: ${value(consumed,'carbs','g',totals.consumedIncomplete)}`);
    set('nutritionSummaryFatConsumed',`Consumidas: ${value(consumed,'fat','g',totals.consumedIncomplete)}`);
    const qualityNote=$('e23NutritionDataQualityNote');
    const plannedUnknown=MACRO_KEYS.filter(key=>totals.plannedIncomplete[key]);
    const consumedUnknown=MACRO_KEYS.filter(key=>totals.consumedIncomplete[key]);
    const anyUnknown=plannedUnknown.length>0||consumedUnknown.length>0;
    if(qualityNote){qualityNote.hidden=!anyUnknown;qualityNote.textContent=anyUnknown?`Hay alimentos con datos nutricionales incompletos. No se muestran como cero: ${[...new Set([...plannedUnknown,...consumedUnknown])].map(key=>MACRO_LABELS[key]).join(', ')}. Revisá los alimentos señalados.`:'';}
    host.classList.toggle('has-incomplete-data',anyUnknown);
    renderGoalCards(consumed,totals.consumedIncomplete);
    host.classList.toggle('is-refreshing',refreshing);
    try{
      document.dispatchEvent(new CustomEvent('agenda:nutrition-consumed-summary-updated',{
        detail:{day:d,totals:{...consumed},planned:{...planned},consumedIncomplete:{...totals.consumedIncomplete},plannedIncomplete:{...totals.plannedIncomplete},foodTotal:totals.foodTotal,foodConsumed:totals.foodConsumed,unconvertible:totals.unconvertible}
      }));
    }catch(_){ }
  }

  async function loadDay(day=activeDay){
    const d=Number(day);
    activeDay=d;
    const token=++refreshSeq;
    refreshing=true;render(d);
    const meals=mealsForDay(d);
    await Promise.all(meals.map(async meal=>{
      if(!meal?.id)return;
      try{
        const raw=await window.AgendaNutritionData?.loadMealItems?.(String(meal.id))||[];
        if(token!==refreshSeq)return;
        let items=(Array.isArray(raw)?raw:[]).map(item=>{
          const hasServerState=typeof item.consumed==='boolean';
          if(hasServerState)clearFallback(item.id);
          return {...item,consumed:hasServerState?item.consumed:readFallback(item.id),consumed_at:item.consumed_at||null};
        });
        if(!items.length){const fallback=fallbackItem(meal);if(fallback)items=[fallback]}
        cache.set(String(meal.id),items);
      }catch(_){
        if(token!==refreshSeq)return;
        const fallback=fallbackItem(meal);
        cache.set(String(meal.id),fallback?[fallback]:[]);
      }
    }));
    if(token!==refreshSeq)return;
    const activeIds=new Set(meals.map(m=>String(m.id)));
    [...cache.keys()].forEach(id=>{if(!activeIds.has(id))cache.delete(id)});
    refreshing=false;render(d);
  }

  function schedule(day=activeDay){
    if(day!=null)activeDay=Number(day);
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{refreshTimer=null;loadDay(activeDay).catch(()=>{refreshing=false;render(activeDay)})},0);
  }

  function applyConsumptionChange(detail){
    const mealId=String(detail?.mealId||'');
    if(!mealId)return;
    const current=Array.isArray(cache.get(mealId))?[...cache.get(mealId)]:[];
    if(detail.bulk&&Array.isArray(detail.items)){
      const byId=new Map(detail.items.map(item=>[String(item.id),item]));
      const merged=current.map(item=>byId.has(String(item.id))?{...item,...byId.get(String(item.id))}:item);
      // Si el resumen aún no tenía la comida en caché, el evento incluye todos sus alimentos.
      detail.items.forEach(item=>{if(!merged.some(existing=>String(existing.id)===String(item.id)))merged.push({...item})});
      cache.set(mealId,merged);
    }else if(detail.item){
      const item=detail.item;
      const idx=current.findIndex(existing=>String(existing.id)===String(item.id));
      if(idx>=0)current[idx]={...current[idx],...item};else current.push({...item});
      cache.set(mealId,current);
    }
    refreshing=false;render(activeDay);
  }

  function onMealsChanged(){schedule(typeof nutritionDay!=='undefined'?nutritionDay:activeDay)}
  function onMealDeleted(event){const id=String(event.detail?.mealId||'');if(id)cache.delete(id);render(activeDay)}

  function init(){
    const day=typeof nutritionDay!=='undefined'?Number(nutritionDay):0;
    activeDay=day;render(day);schedule(day);
    // Redirige las llamadas del núcleo a la versión basada en alimentos consumidos.
    window.renderNutritionGoals=function(){
      const selected=typeof nutritionDay!=='undefined'?Number(nutritionDay):activeDay;
      if(Number.isFinite(selected)&&selected!==activeDay)schedule(selected);
      else render(selected);
    };
    window.renderNutritionDaySummary=function(){
      const selected=typeof nutritionDay!=='undefined'?Number(nutritionDay):activeDay;
      if(Number.isFinite(selected)&&selected!==activeDay)schedule(selected);
      else render(selected);
    };
    document.addEventListener('agenda:nutrition-meals-loaded',event=>{if(event.detail?.day!=null)loadDay(Number(event.detail.day)).catch(()=>{})});
    document.addEventListener('agenda:nutrition-day-changed',event=>{const d=Number(event.detail?.day);if(Number.isInteger(d))loadDay(d).catch(()=>{})});
    document.addEventListener('agenda:nutrition-meal-saved',onMealsChanged);
    document.addEventListener('agenda:nutrition-meal-items-saved',onMealsChanged);
    document.addEventListener('agenda:nutrition-meal-item-consumption-changed',event=>applyConsumptionChange(event.detail||{}));
    document.addEventListener('agenda:nutrition-meal-deleted',onMealDeleted);
  }

  window.AgendaNutritionLiveSummaryMath={itemTotals,formatMetric,missingMetrics};
  window.AgendaNutritionLiveSummary={
    refresh:()=>schedule(typeof nutritionDay!=='undefined'?nutritionDay:activeDay),
    getConsumedTotals:(day=activeDay)=>{const t=dayTotals(day);return {...t.consumed,incomplete:{...t.consumedIncomplete},foodTotal:t.foodTotal,foodConsumed:t.foodConsumed}},
    getPlannedTotals:(day=activeDay)=>{const t=dayTotals(day);return {...t.planned,incomplete:{...t.plannedIncomplete},foodTotal:t.foodTotal,foodConsumed:t.foodConsumed}}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
