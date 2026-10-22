/* Agenda FICH — Etapa 4 de Alimentación: alimentos propios, recetas e historial real.
   Este módulo solo interactúa con los módulos nutricionales; no modifica Entrenamiento. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const txt=v=>String(v??'').trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const esc=v=>{const d=document.createElement('div');d.textContent=v??'';return d.innerHTML};
  const fmt=v=>{const n=Math.round(num(v)*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1)};
  const normalizeSearchText=value=>txt(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-AR');
  const categoryKey=value=>{
    const key=normalizeSearchText(value).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    const aliases={breakfast:'breakfast',desayuno:'breakfast',media_manana:'media_manana',mid_morning:'media_manana',media_morning:'media_manana',pre:'pre',pre_entrenamiento:'pre',pre_workout:'pre',post:'post',post_entrenamiento:'post',post_workout:'post',lunch:'lunch',almuerzo:'lunch',snack:'snack',merienda:'snack',dinner:'dinner',cena:'dinner',colacion:'colacion',colacion_nocturna:'colacion',sleep:'sleep',before_sleep:'sleep',antes_de_dormir:'sleep'};
    return aliases[key]||'other';
  };
  function filterHistoryRows(rows,query='',category='all'){
    const tokens=normalizeSearchText(query).split(/\s+/).filter(Boolean);
    return (Array.isArray(rows)?rows:[]).filter(row=>{
      if(category&&category!=='all'&&categoryKey(row?.meal_type)!==category)return false;
      if(!tokens.length)return true;
      const snap=row?.item_snapshot&&typeof row.item_snapshot==='object'?row.item_snapshot:{};
      const haystack=normalizeSearchText([row?.food_name,row?.brand,row?.meal_title,row?.meal_time,row?.consumed_date,row?.unit,snap.name,snap.brand,snap.source,snap.preparation_state,snap.categories].filter(v=>v!==null&&v!==undefined).join(' '));
      return tokens.every(token=>haystack.includes(token));
    });
  }
  function filterRecipes(recipes,query='',mode='all'){
    const tokens=normalizeSearchText(query).split(/\s+/).filter(Boolean);
    return (Array.isArray(recipes)?recipes:[]).filter(recipe=>{
      const instructions=Array.isArray(recipe?.instructions)?recipe.instructions.filter(txt):[];
      const hasParent=!!(recipe?.parent_recipe_id||recipe?.parentRecipeId);
      if(mode==='with_steps'&&!instructions.length)return false;
      if(mode==='without_steps'&&instructions.length)return false;
      if(mode==='variants'&&!hasParent)return false;
      if(mode==='originals'&&hasParent)return false;
      if(!tokens.length)return true;
      const ingredients=Array.isArray(recipe?.ingredients)?recipe.ingredients.flatMap(item=>[item?.name,item?.food_name,item?.brand,item?.notes,item?.preparation_state,item?.preparationState]):[];
      const haystack=normalizeSearchText([recipe?.name,recipe?.notes,...ingredients,...instructions].filter(v=>v!==null&&v!==undefined).join(' '));
      return tokens.every(token=>haystack.includes(token));
    });
  }
  function filterUserFoods(rows,query='',preparation='all'){
    const tokens=normalizeSearchText(query).split(/\s+/).filter(Boolean);
    return (Array.isArray(rows)?rows:[]).filter(food=>{
      const state=String(food?.preparationState||food?.preparation_state||'unspecified').toLowerCase();
      if(preparation&&preparation!=='all'&&state!==preparation)return false;
      if(!tokens.length)return true;
      const haystack=normalizeSearchText([food?.name,food?.brand,food?.source,food?.recordSource,food?.categories,food?.labels,food?.ingredients,state].filter(v=>v!==null&&v!==undefined).join(' '));
      return tokens.every(token=>haystack.includes(token));
    });
  }
  let historyDays=30;
  let historyRowsCache=[];
  let recipeRowsCache=[];
  let userFoodRowsCache=[];
  let modalTrigger=null;
  let previousBodyOverflow='';
  let activeWakeLock=null;
  let cookingModeActive=false;

  function data(){return window.AgendaNutritionData||null}
  function foods(){return window.AgendaFoodCatalog||null}
  function pendingFoods(){return foods()?.getPendingMealFoods?.()||[]}
  function notify(message,state='info'){
    const previous=$('nutritionAdvancedToast');if(previous)previous.remove();
    const node=document.createElement('div');node.id='nutritionAdvancedToast';node.className=`nutrition-advanced-toast is-${state}`;node.setAttribute('role',state==='warning'?'alert':'status');node.setAttribute('aria-live',state==='warning'?'assertive':'polite');node.textContent=message;document.body.appendChild(node);
    setTimeout(()=>node.remove(),4200);
  }
  function closeModal(){
    const node=$('nutritionAdvancedModal');
    cookingModeActive=false;
    if(activeWakeLock){const lock=activeWakeLock;activeWakeLock=null;try{lock.release().catch(()=>{})}catch(_){}}
    if(node){
      node.remove();
      document.body.style.overflow=previousBodyOverflow;
      const target=modalTrigger;modalTrigger=null;
      if(target?.isConnected)requestAnimationFrame(()=>{try{target.focus({preventScroll:true})}catch(_){target.focus()}});
    }
  }
  function mountModal(title,subtitle,content){
    closeModal();
    modalTrigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    previousBodyOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const overlay=document.createElement('div');overlay.id='nutritionAdvancedModal';overlay.className='nutrition-advanced-overlay';
    overlay.innerHTML=`<section class="nutrition-advanced-modal" role="dialog" aria-modal="true" aria-labelledby="nutritionAdvancedTitle" aria-describedby="nutritionAdvancedDescription" tabindex="-1"><header class="nutrition-advanced-head"><div><h3 id="nutritionAdvancedTitle">${esc(title)}</h3><p id="nutritionAdvancedDescription">${esc(subtitle)}</p></div><button type="button" class="nutrition-advanced-close" id="nutritionAdvancedClose" aria-label="Cerrar ventana">×</button></header><div class="nutrition-advanced-body" id="nutritionAdvancedBody"></div></section>`;
    document.body.appendChild(overlay);
    $('nutritionAdvancedBody').innerHTML=content;
    $('nutritionAdvancedClose')?.addEventListener('click',closeModal);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()});
    overlay.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();closeModal();return;}
      if(e.key!=='Tab')return;
      const focusable=[...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
        .filter(el=>!el.hidden&&el.getAttribute('aria-hidden')!=='true'&&el.getClientRects().length);
      if(!focusable.length){e.preventDefault();overlay.querySelector('[role="dialog"]')?.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){e.preventDefault();first.focus();}
    });
    requestAnimationFrame(()=>{
      if(!overlay.contains(document.activeElement)){
        const first=overlay.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])');
        first?.focus({preventScroll:true});
      }
    });
    return overlay;
  }
  function customFoodModal(existingFood=null){
    const editing=Boolean(existingFood?.userFoodId);
    mountModal(editing?'Editar alimento propio':'＋ Crear alimento propio',editing?'Actualizá los datos nutricionales de tu alimento. Las comidas ya registradas conservan su propia instantánea.':'Cargá los valores nutricionales por 100 g. Se guardará en Mis alimentos, separado por cuenta.',`
      <form id="nutritionCustomFoodForm" class="nutrition-advanced-form">
        <div class="field"><label for="nutritionCustomFoodName">Nombre *</label><input class="input" id="nutritionCustomFoodName" required maxlength="120" autocomplete="off" placeholder="Ej.: Panqueque casero"></div>
        <div class="field"><label for="nutritionCustomFoodBrand">Marca o descripción breve</label><input class="input" id="nutritionCustomFoodBrand" maxlength="100" placeholder="Opcional"></div>
        <div class="nutrition-advanced-grid">
          <div class="field"><label for="nutritionCustomFoodCalories">Calorías / 100 g *</label><input class="input" id="nutritionCustomFoodCalories" type="number" min="0" max="1000" step="0.1" required value="0"></div>
          <div class="field"><label for="nutritionCustomFoodProtein">Proteínas (g) *</label><input class="input" id="nutritionCustomFoodProtein" type="number" min="0" max="100" step="0.1" required value="0"></div>
          <div class="field"><label for="nutritionCustomFoodCarbs">Carbohidratos (g) *</label><input class="input" id="nutritionCustomFoodCarbs" type="number" min="0" max="100" step="0.1" required value="0"></div>
          <div class="field"><label for="nutritionCustomFoodFat">Grasas (g) *</label><input class="input" id="nutritionCustomFoodFat" type="number" min="0" max="100" step="0.1" required value="0"></div>
          <div class="field"><label for="nutritionCustomFoodFiber">Fibra (g)</label><input class="input" id="nutritionCustomFoodFiber" type="number" min="0" max="100" step="0.1" value="0"></div>
          <div class="field"><label for="nutritionCustomFoodServing">Porción habitual (g)</label><input class="input" id="nutritionCustomFoodServing" type="number" min="0.1" max="10000" step="0.1" value="100"></div>
          <div class="field"><label for="nutritionCustomFoodPrep">Estado del alimento</label><select class="input" id="nutritionCustomFoodPrep"><option value="unspecified">No especificado</option><option value="raw">Crudo</option><option value="cooked">Cocido</option><option value="prepared">Preparado</option></select></div>
          <div class="field"><label for="nutritionCustomFoodDensity">Densidad (g/ml)</label><input class="input" id="nutritionCustomFoodDensity" type="number" min="0.0001" max="10000" step="0.0001" placeholder="Dejar vacío si no se conoce"></div>
          <div class="field"><label for="nutritionCustomFoodUnitWeight">Peso de una unidad (g)</label><input class="input" id="nutritionCustomFoodUnitWeight" type="number" min="0.1" max="100000" step="0.1" placeholder="Ej.: 120"></div><div class="field"><label for="nutritionCustomFoodPortionWeight">Peso de una porción (g)</label><input class="input" id="nutritionCustomFoodPortionWeight" type="number" min="0.1" max="100000" step="0.1" placeholder="Ej.: 180"></div>
        </div>
        <p class="nutrition-advanced-note">Ingresá los nutrientes por 100 g correspondientes al estado elegido. Los ml solo se convierten si ingresás una densidad; unidades y porciones solo si conocés su peso en gramos. El estado no transforma automáticamente los valores nutricionales.</p>
        <div class="nutrition-advanced-status" id="nutritionCustomFoodStatus" role="status" aria-live="polite"></div>
        <div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cancelar</button><button type="submit" class="nutrition-advanced-primary" id="nutritionCustomFoodSave">${editing?'Guardar cambios':'Guardar alimento'}</button></div>
      </form>`);
    if(editing){
      $('nutritionCustomFoodName').value=txt(existingFood.name);
      $('nutritionCustomFoodBrand').value=txt(existingFood.brand);
      $('nutritionCustomFoodCalories').value=String(num(existingFood.calories));
      $('nutritionCustomFoodProtein').value=String(num(existingFood.protein));
      $('nutritionCustomFoodCarbs').value=String(num(existingFood.carbs));
      $('nutritionCustomFoodFat').value=String(num(existingFood.fat));
      $('nutritionCustomFoodFiber').value=String(num(existingFood.fiber));
      $('nutritionCustomFoodServing').value=String(num(existingFood.servingQuantity)||100);
      $('nutritionCustomFoodPrep').value=String(existingFood.preparationState||'unspecified');
      $('nutritionCustomFoodDensity').value=existingFood.densityGPerMl?String(existingFood.densityGPerMl):'';
      $('nutritionCustomFoodUnitWeight').value=existingFood.gramsPerUnit?String(existingFood.gramsPerUnit):'';
      $('nutritionCustomFoodPortionWeight').value=existingFood.gramsPerPortion?String(existingFood.gramsPerPortion):'';
    }
    $('nutritionCustomFoodName')?.focus();
    document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    $('nutritionCustomFoodForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const status=$('nutritionCustomFoodStatus'),save=$('nutritionCustomFoodSave');
      const name=txt($('nutritionCustomFoodName')?.value);
      const values={calories:num($('nutritionCustomFoodCalories')?.value),protein:num($('nutritionCustomFoodProtein')?.value),carbs:num($('nutritionCustomFoodCarbs')?.value),fat:num($('nutritionCustomFoodFat')?.value),fiber:num($('nutritionCustomFoodFiber')?.value)};
      if(!name){if(status)status.textContent='Ingresá un nombre.';return}
      const densityRaw=txt($('nutritionCustomFoodDensity')?.value),unitWeightRaw=txt($('nutritionCustomFoodUnitWeight')?.value),portionWeightRaw=txt($('nutritionCustomFoodPortionWeight')?.value);
      const density=densityRaw===''?null:Number(densityRaw),unitWeight=unitWeightRaw===''?null:Number(unitWeightRaw),portionWeight=portionWeightRaw===''?null:Number(portionWeightRaw);
      if((density!==null&&(!Number.isFinite(density)||density<=0))||(unitWeight!==null&&(!Number.isFinite(unitWeight)||unitWeight<=0))||(portionWeight!==null&&(!Number.isFinite(portionWeight)||portionWeight<=0))){if(status)status.textContent='La densidad y los pesos por unidad o porción deben ser mayores que cero, o dejarse vacíos si no se conocen.';return}
      if(Object.values(values).some(v=>v<0)||values.protein>100||values.carbs>100||values.fat>100||values.fiber>100||values.calories>1000||values.protein+values.carbs+values.fat>100.5){if(status)status.textContent='Revisá los valores por 100 g: no pueden ser negativos, superar los límites ni sumar más de 100 g entre proteínas, carbohidratos y grasas.';return}
      if(!data()?.saveUserFood){if(status)status.textContent='La persistencia nutricional todavía no está disponible.';return}
      if(save){save.disabled=true;save.textContent='Guardando…'}
      try{
        const customKey=(value)=>txt(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'alimento';
        const brand=txt($('nutritionCustomFoodBrand')?.value);
        const food={name,brand,source:'Alimento personalizado',sourceType:editing?(existingFood.recordSource||'custom'):'custom',externalId:editing?(existingFood.externalId||existingFood.id):`custom-${customKey(name)}-${customKey(brand||'sin-marca')}`,fingerprint:editing?existingFood.fingerprint:undefined,userFoodId:editing?existingFood.userFoodId:null,unit:'g',preparationState:String($('nutritionCustomFoodPrep')?.value||'unspecified'),densityGPerMl:density,gramsPerUnit:unitWeight,gramsPerPortion:portionWeight,defaultQuantity:Math.max(.1,num($('nutritionCustomFoodServing')?.value)||100),servingQuantity:Math.max(.1,num($('nutritionCustomFoodServing')?.value)||100),servingSize:editing?(existingFood.servingSize||'Porción habitual'):'Porción habitual',calories:values.calories,protein:values.protein,carbs:values.carbs,fat:values.fat,fiber:values.fiber,isGeneric:editing?existingFood.isGeneric===true:false,ingredients:editing?txt(existingFood.ingredients):'',categories:editing?txt(existingFood.categories):'Personalizado',labels:editing?txt(existingFood.labels):'',imageUrl:editing?txt(existingFood.imageUrl):''};
        const result=await data().saveUserFood(food);
        if(!result?.ok)throw new Error('Supabase no confirmó el guardado. Revisá la conexión y las migraciones de catálogo.');
        closeModal();
        if(editing){notify(`Alimento actualizado: ${name}`,'success');openUserFoodsModal();}
        else{
          foods()?.select?.(result.food||food);
          const panel=$('nutritionFoodCatalog');if(panel?.hidden)$('nutritionFoodCatalogToggle')?.click();
          if($('nutritionFoodCatalogStatus'))$('nutritionFoodCatalogStatus').textContent=`✓ ${name} guardado en Mis alimentos. Ajustá la cantidad y agregalo a la comida.`;
          notify(`Alimento propio guardado: ${name}`,'success');
        }
      }catch(err){console.warn('Alimento personalizado:',err);if(status)status.textContent=`No se pudo guardar: ${err?.message||'error desconocido'}`;if(save){save.disabled=false;save.textContent=editing?'Guardar cambios':'Guardar alimento'}}
    });
  }


  function renderUserFoodCards(list,statusText=''){
    userFoodRowsCache=Array.isArray(list)?list:[];
    const host=$('nutritionUserFoodsList'),status=$('nutritionUserFoodsStatus');
    if(!host)return;
    const query=$('nutritionUserFoodsSearch')?.value||'';
    const preparation=$('nutritionUserFoodsPreparation')?.value||'all';
    const filtered=filterUserFoods(userFoodRowsCache,query,preparation);
    if(status)status.textContent=(query.trim()||preparation!=='all')?`Mostrando ${filtered.length} de ${userFoodRowsCache.length} alimentos propios.`:(statusText||`${userFoodRowsCache.length} alimentos propios.`);
    if(!userFoodRowsCache.length){host.innerHTML='<div class="nutrition-advanced-empty">Todavía no guardaste alimentos personalizados. Podés crear uno y volver acá para editarlo.</div>';return}
    if(!filtered.length){host.innerHTML='<div class="nutrition-advanced-empty">No encontramos alimentos con esos filtros. Probá otra búsqueda o limpiá los filtros.</div>';return}
    host.innerHTML=filtered.map(food=>`<article class="nutrition-user-food-card"><div class="nutrition-user-food-main"><strong>${esc(food.name)}</strong><small>${food.brand?esc(food.brand)+' · ':''}Por 100 g · ${food.preparationState==='raw'?'Crudo':food.preparationState==='cooked'?'Cocido':food.preparationState==='prepared'?'Preparado':'estado no especificado'}</small><span>${fmt(food.calories)} kcal · P ${fmt(food.protein)} g · C ${fmt(food.carbs)} g · G ${fmt(food.fat)} g${food.fiber!=null?' · Fibra '+fmt(food.fiber)+' g':''}</span><small>Porción habitual: ${fmt(food.servingQuantity||100)} g${food.densityGPerMl?` · Densidad ${fmt(food.densityGPerMl)} g/ml`:''}${food.gramsPerUnit?` · Unidad ${fmt(food.gramsPerUnit)} g`:''}${food.gramsPerPortion?` · Porción ${fmt(food.gramsPerPortion)} g`:''}</small></div><div class="nutrition-user-food-actions"><button type="button" class="nutrition-advanced-secondary" data-user-food-edit="${esc(food.userFoodId)}">Editar</button><button type="button" class="nutrition-advanced-danger" data-user-food-delete="${esc(food.userFoodId)}">Eliminar</button></div></article>`).join('');
    host.querySelectorAll('[data-user-food-edit]').forEach(button=>button.addEventListener('click',()=>{
      const food=userFoodRowsCache.find(item=>String(item.userFoodId)===button.dataset.userFoodEdit);
      if(food)customFoodModal(food);
    }));
    host.querySelectorAll('[data-user-food-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const food=userFoodRowsCache.find(item=>String(item.userFoodId)===button.dataset.userFoodDelete);if(!food)return;
      if(!confirm(`¿Eliminar “${food.name}” de Mis alimentos? Las comidas e historiales ya guardados conservarán sus valores registrados.`))return;
      button.disabled=true;
      try{
        await data().deleteUserFood(food.userFoodId);
        const next=userFoodRowsCache.filter(item=>String(item.userFoodId)!==String(food.userFoodId));
        renderUserFoodCards(next,`Alimento eliminado. Quedan ${next.length} alimentos propios.`);
        notify('Alimento eliminado de Mis alimentos. Los registros anteriores se conservan.','success');
      }catch(err){button.disabled=false;if(status)status.textContent=`No se pudo eliminar el alimento: ${err?.message||'error'}`;}
    }));
  }
  async function openUserFoodsModal(){
    userFoodRowsCache=[];
    mountModal('🥗 Mis alimentos','Editá tus alimentos personalizados. Los valores guardados dentro de comidas anteriores se conservan como instantáneas.',`<div class="nutrition-browse-toolbar"><label for="nutritionUserFoodsSearch">Buscar en mis alimentos<input class="input" type="search" id="nutritionUserFoodsSearch" maxlength="160" placeholder="Nombre, marca, ingrediente…" autocomplete="off"></label><label for="nutritionUserFoodsPreparation">Preparación<select class="input" id="nutritionUserFoodsPreparation"><option value="all">Todos los estados</option><option value="raw">Crudo</option><option value="cooked">Cocido</option><option value="prepared">Preparado</option><option value="unspecified">Sin especificar</option></select></label><button type="button" class="nutrition-advanced-secondary" id="nutritionUserFoodsClear">Limpiar</button></div><div class="nutrition-advanced-status" id="nutritionUserFoodsStatus" role="status" aria-live="polite">Cargando tus alimentos…</div><div class="nutrition-user-food-list" id="nutritionUserFoodsList"></div><div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" id="nutritionUserFoodCreateBtn">＋ Crear alimento</button><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cerrar</button></div>`);
    document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    $('nutritionUserFoodCreateBtn')?.addEventListener('click',()=>customFoodModal());
    $('nutritionUserFoodsSearch')?.addEventListener('input',()=>renderUserFoodCards(userFoodRowsCache));
    $('nutritionUserFoodsPreparation')?.addEventListener('change',()=>renderUserFoodCards(userFoodRowsCache));
    $('nutritionUserFoodsClear')?.addEventListener('click',()=>{if($('nutritionUserFoodsSearch'))$('nutritionUserFoodsSearch').value='';if($('nutritionUserFoodsPreparation'))$('nutritionUserFoodsPreparation').value='all';renderUserFoodCards(userFoodRowsCache);$('nutritionUserFoodsSearch')?.focus()});
    try{
      if(!data()?.loadUserFoods)throw new Error('El módulo de persistencia todavía no ofrece la lista de alimentos.');
      const list=await data().loadUserFoods();
      renderUserFoodCards(list,`${list.length} alimento${list.length===1?'':'s'} personalizado${list.length===1?'':'s'}.`);
    }catch(err){console.warn('Mis alimentos:',err);const status=$('nutritionUserFoodsStatus');if(status)status.textContent=`No se pudieron cargar tus alimentos. ${err?.message||'Comprobá tu conexión.'}`;}
  }

  function recipeTotals(items,finishedWeightG=null){
    if(data()?.calculateRecipe)return data().calculateRecipe(items,finishedWeightG);
    const weight=(items||[]).reduce((s,x)=>s+Math.max(0,num(x.quantity_in_grams??x.quantity)),0);
    const total=(items||[]).reduce((a,x)=>{const f=Math.max(0,num(x.quantity_in_grams??x.quantity))/100;a.calories+=num(x.calories_per_100g)*f;a.protein+=num(x.protein_per_100g)*f;a.carbs+=num(x.carbs_per_100g)*f;a.fat+=num(x.fat_per_100g)*f;return a},{calories:0,protein:0,carbs:0,fat:0});
    const factor=weight?100/weight:0;return {total_weight_g:weight,calories_per_100g:total.calories*factor,protein_per_100g:total.protein*factor,carbs_per_100g:total.carbs*factor,fat_per_100g:total.fat*factor,total_calories:total.calories,total_protein_g:total.protein,total_carbs_g:total.carbs,total_fat_g:total.fat,unknownMetrics:[]};
  }
  const RECIPE_METRICS={calories:{label:'energía',unit:'kcal',total:'total_calories',per100:'calories_per_100g'},protein:{label:'proteínas',unit:'g',total:'total_protein_g',per100:'protein_per_100g'},carbs:{label:'carbohidratos',unit:'g',total:'total_carbs_g',per100:'carbs_per_100g'},fat:{label:'grasas',unit:'g',total:'total_fat_g',per100:'fat_per_100g'},fiber:{label:'fibra',unit:'g',total:'total_fiber_g',per100:'fiber_per_100g'}};
  function recipeMetricUnknown(total,key){return Array.isArray(total?.unknownMetrics)&&total.unknownMetrics.includes(key)}
  function recipeMetricValue(total,key,amount,per100=false){const metric=RECIPE_METRICS[key];if(!metric)return '—';if(recipeMetricUnknown(total,key))return 'Datos incompletos';return `${fmt(amount)} ${metric.unit}`}
  function recipeNutritionSummary(recipe){
    const items=Array.isArray(recipe?.ingredients)?recipe.ingredients:[];
    try{
      const total=recipeTotals(items,recipe?.finished_weight_g??null);
      const keys=['calories','protein','carbs','fat'];
      const parts=keys.map(key=>`${RECIPE_METRICS[key].label}: ${recipeMetricValue(total,key,total[RECIPE_METRICS[key].per100],true)}`);
      if(recipeMetricUnknown(total,'fiber'))parts.push('fibra: Datos incompletos');
      return `${parts.join(' · ')} / 100 g`;
    }catch(_){return 'Información nutricional no calculable: revisá cantidades y equivalencias.'}
  }
  function recipeIngredientMetricUnknown(item,key){
    const api=data();
    if(typeof api?.recipeIngredientMissingMetrics==='function')return api.recipeIngredientMissingMetrics(item).has(key);
    if(typeof api?.missingMacroMetrics==='function'&&api.missingMacroMetrics(item).includes(key))return true;
    return false;
  }
  function recipeIngredientNutritionSummary(item){
    const fields=[['calories','calories_per_100g','kcal'],['protein','protein_per_100g','g'],['carbs','carbs_per_100g','g'],['fat','fat_per_100g','g']];
    return fields.map(([key,field,unit])=>`${RECIPE_METRICS[key].label}: ${recipeIngredientMetricUnknown(item,key)?'No informado':`${fmt(item[field]??item[key])} ${unit}`}`).join(' · ')+' / 100 g';
  }
  function saveRecipeModal(existingRecipe=null){
    const editing=Boolean(existingRecipe?.id);
    const creatingVariant=Boolean(existingRecipe&&!editing&&(existingRecipe.parent_recipe_id||existingRecipe.parentRecipeId));
    const sourceIngredients=Array.isArray(existingRecipe?.ingredients)?existingRecipe.ingredients:pendingFoods();
    let editorIngredients=(Array.isArray(sourceIngredients)?sourceIngredients:[])
      .filter(item=>item&&num(item.quantity)>0)
      .map(item=>({...item,consumed:false,consumed_at:null}));
    if(!editorIngredients.length&&!editing){notify('Agregá al menos un alimento a la receta antes de guardarla.','warning');return}
    const modalTitle=editing?'✏️ Editar receta':creatingVariant?'📚 Crear variante de receta':'📖 Guardar comida como receta';
    const modalSubtitle=editing?'Modificá ingredientes, instrucciones y tiempos. Las comidas y preparaciones guardadas anteriormente conservan su instantánea.':creatingVariant?'Esta variante se guarda como receta independiente. Los cambios no modifican la receta original.':'Revisá ingredientes, pasos y tiempos antes de guardar esta preparación.';
    mountModal(modalTitle,modalSubtitle,`
      <form id="nutritionRecipeSaveForm" class="nutrition-advanced-form">
        <div class="nutrition-advanced-recipe-preview" id="nutritionRecipePreview"><strong>Calculando preparación…</strong></div>
        <div class="field"><label for="nutritionRecipeName">Nombre de la receta *</label><input class="input" id="nutritionRecipeName" maxlength="120" required autocomplete="off" placeholder="Ej.: Avena con yogur y banana" value="${esc(existingRecipe?.name||'')}"></div>
        <div class="field"><label for="nutritionRecipeNotes">Notas generales</label><textarea class="input" id="nutritionRecipeNotes" rows="2" maxlength="1000" placeholder="Consejos, sustituciones o notas personales">${esc(existingRecipe?.notes||'')}</textarea></div>
        <section class="nutrition-recipe-procedure" aria-labelledby="nutritionRecipeInstructionsTitle">
          <div class="field"><label for="nutritionRecipeInstructions" id="nutritionRecipeInstructionsTitle">Instrucciones paso a paso</label><textarea class="input" id="nutritionRecipeInstructions" rows="5" maxlength="12000" placeholder="Un paso por línea. Ej.:
1. Lavar y cortar los ingredientes.
2. Calentar la sartén.
3. Cocinar hasta el punto deseado.">${esc(Array.isArray(existingRecipe?.instructions)?existingRecipe.instructions.join('\n'):'')}</textarea><small>Se guardan hasta 40 pasos, con un máximo de 1000 caracteres por paso. Las líneas vacías se ignoran.</small></div>
          <div class="nutrition-advanced-grid">
            <div class="field"><label for="nutritionRecipePrepTime">Preparación (min)</label><input class="input" id="nutritionRecipePrepTime" type="number" min="0" max="1440" step="1" value="${esc(existingRecipe?.prep_time_minutes??0)}"><small>Tiempo estimado de preparación.</small></div>
            <div class="field"><label for="nutritionRecipeCookTime">Cocción (min)</label><input class="input" id="nutritionRecipeCookTime" type="number" min="0" max="1440" step="1" value="${esc(existingRecipe?.cook_time_minutes??0)}"><small>Puede quedar en cero si no aplica.</small></div>
          </div>
        </section>
        <div class="field"><label for="nutritionRecipeServings">¿Cuántas porciones rinde?</label><input class="input" id="nutritionRecipeServings" type="number" min="0.1" max="1000" step="0.1" value="${esc(existingRecipe?.servings||1)}" required><small>Se usa para calcular cuánto ingrediente agregar al elegir una porción.</small></div>
        <div class="field"><label for="nutritionRecipeFinishedWeight">Peso final preparado (g), opcional</label><input class="input" id="nutritionRecipeFinishedWeight" type="number" min="0.1" max="1000000" step="0.1" value="${esc(existingRecipe?.finished_weight_g||'')}" placeholder="Vacío = estimar sumando los ingredientes"><small>Pesá la preparación terminada y cargá el peso real. Si se deja vacío, la aplicación usa la suma de los ingredientes convertidos a gramos.</small></div>
        <section class="nutrition-recipe-editor-section" aria-labelledby="nutritionRecipeIngredientTitle">
          <div class="nutrition-recipe-editor-head"><strong id="nutritionRecipeIngredientTitle">Ingredientes y cantidades</strong><span id="nutritionRecipeIngredientCount"></span></div>
          <div id="nutritionRecipeIngredientEditor" class="nutrition-recipe-ingredient-editor"></div>
          <div class="e25-recipe-undo" id="nutritionRecipeUndo" hidden role="status" aria-live="polite"><span id="nutritionRecipeUndoText">Ingrediente quitado.</span><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipeUndoBtn">Deshacer</button></div>
        </section>
        <section class="nutrition-recipe-add-ingredient" aria-label="Agregar un ingrediente">
          <label for="nutritionRecipeIngredientSearch">Agregar ingrediente</label>
          <div class="nutrition-recipe-search-row"><input class="input" id="nutritionRecipeIngredientSearch" autocomplete="off" placeholder="Ej.: arroz cocido, leche…"><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipeIngredientSearchBtn">Buscar</button></div>
          <div class="nutrition-recipe-search-results" id="nutritionRecipeIngredientResults" aria-live="polite"></div>
        </section>
        <p class="nutrition-advanced-note">Los nutrientes se recalculan con los valores guardados por 100 g. Si agregás un alimento nuevo, comprobá que el resultado corresponda a su versión cruda, cocida o preparada.</p>
        <div class="nutrition-advanced-status" id="nutritionRecipeSaveStatus" role="status" aria-live="polite"></div>
        <div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cancelar</button><button type="submit" class="nutrition-advanced-primary" id="nutritionRecipeSaveBtn">${editing?'Guardar cambios':'Guardar receta'}</button></div>
      </form>`);
    const ingredientHost=$('nutritionRecipeIngredientEditor');
    const preview=$('nutritionRecipePreview');
    const status=$('nutritionRecipeSaveStatus');
    const undoHost=$('nutritionRecipeUndo'),undoText=$('nutritionRecipeUndoText'),undoButton=$('nutritionRecipeUndoBtn');
    const removedIngredients=[];
    let undoTimer=0,recipeSaving=false,baselineSignature='';
    const recipeEditorSignature=()=>JSON.stringify({name:txt($('nutritionRecipeName')?.value),notes:txt($('nutritionRecipeNotes')?.value),instructions:txt($('nutritionRecipeInstructions')?.value),prep:txt($('nutritionRecipePrepTime')?.value),cook:txt($('nutritionRecipeCookTime')?.value),servings:txt($('nutritionRecipeServings')?.value),finishedWeight:txt($('nutritionRecipeFinishedWeight')?.value),ingredients:editorIngredients});
    const hasRecipeChanges=()=>Boolean(baselineSignature)&&recipeEditorSignature()!==baselineSignature;
    function cleanupRecipeEditorGuards(){
      if(undoTimer){clearTimeout(undoTimer);undoTimer=0;}
      if(typeof window!=='undefined'&&window.__agendaE25RecipeBeforeUnload){window.removeEventListener('beforeunload',window.__agendaE25RecipeBeforeUnload);window.__agendaE25RecipeBeforeUnload=null;}
    }
    function recipeUndoRender(){
      if(undoTimer){clearTimeout(undoTimer);undoTimer=0;}
      const now=Date.now();while(removedIngredients.length&&removedIngredients[removedIngredients.length-1].expiresAt<=now)removedIngredients.pop();
      const last=removedIngredients[removedIngredients.length-1];
      if(undoHost)undoHost.hidden=!last;
      if(last&&undoText)undoText.textContent=`«${last.item.name||'Ingrediente'}» se quitó. Podés recuperarlo durante unos segundos.`;
      if(last)undoTimer=setTimeout(recipeUndoRender,Math.max(20,last.expiresAt-Date.now()+10));
    }
    if(undoButton)undoButton.addEventListener('click',()=>{
      recipeUndoRender();const removed=removedIngredients.pop();if(!removed)return;
      editorIngredients.splice(Math.min(removed.index,editorIngredients.length),0,removed.item);
      renderIngredientEditor();recipeUndoRender();
      if(status)status.textContent=`Se restauró «${removed.item.name||'el ingrediente'}».`;
    });
    function updatePreview(){
      const finishedRaw=txt($('nutritionRecipeFinishedWeight')?.value);
      let total;
      try{total=recipeTotals(editorIngredients,finishedRaw===''?null:Number(finishedRaw));}
      catch(err){total=null;if(status)status.textContent=err?.message||'No se puede calcular una equivalencia fiable a gramos.';}
      if(preview){
        if(!total)preview.innerHTML='<strong>No se puede calcular la receta con las unidades actuales.</strong><span>Revisá las equivalencias de los ingredientes en Mis alimentos.</span>';
        else {
          const macroText=['calories','protein','carbs','fat'].map(key=>`${RECIPE_METRICS[key].label}: ${recipeMetricValue(total,key,total[RECIPE_METRICS[key].total])}`).join(' · ');
          const unknown=(Array.isArray(total.unknownMetrics)?total.unknownMetrics:[]).filter(key=>RECIPE_METRICS[key]);
          const warning=unknown.length?`<span class="e25-recipe-data-warning" role="status">Datos incompletos: ${unknown.map(key=>RECIPE_METRICS[key].label).join(', ')}. Completá los nutrientes del alimento para calcular un total fiable.</span>`:'';
          preview.innerHTML=`<strong>${editorIngredients.length} ingrediente${editorIngredients.length===1?'':'s'} · ${fmt(total.ingredient_weight_g??total.total_weight_g)} g en ingredientes · ${total.finished_weight_g?`peso final: ${fmt(total.finished_weight_g)} g`:`peso estimado: ${fmt(total.total_weight_g)} g`}</strong><span>${macroText} para toda la preparación · valores por 100 g calculados con ${total.finished_weight_g?'el peso final':'el peso estimado'}</span>${warning}`;
        }
      }
      const count=$('nutritionRecipeIngredientCount');if(count)count.textContent=`${editorIngredients.length} elemento${editorIngredients.length===1?'':'s'}`;
    }

    function renderIngredientEditor(){
      if(!ingredientHost)return;
      if(!editorIngredients.length){ingredientHost.innerHTML='<div class="nutrition-advanced-empty">No hay ingredientes. Buscá uno abajo para agregarlo.</div>';updatePreview();return}
      ingredientHost.innerHTML=editorIngredients.map((item,index)=>`<article class="nutrition-recipe-editor-item"><div class="nutrition-recipe-editor-item-main"><strong>${esc(item.name||'Alimento')}</strong><small>${item.brand?esc(item.brand)+' · ':''}${item.preparation_state&&item.preparation_state!=='unspecified'?(item.preparation_state==='raw'?'Crudo · ':item.preparation_state==='cooked'?'Cocido · ':'Preparado · '):''}${esc(recipeIngredientNutritionSummary(item))}</small></div><label class="nutrition-recipe-editor-quantity">Cantidad (${esc(item.unit||'g')})<input class="input" type="number" min="0.1" max="100000" step="0.1" value="${esc(fmt(item.quantity))}" data-recipe-ingredient-qty="${index}"></label><button type="button" class="nutrition-advanced-danger nutrition-recipe-editor-remove" data-recipe-ingredient-remove="${index}" aria-label="Quitar ${esc(item.name||'ingrediente')}">Quitar</button></article>`).join('');
      ingredientHost.querySelectorAll('[data-recipe-ingredient-qty]').forEach(input=>input.addEventListener('change',()=>{
        const index=Number(input.dataset.recipeIngredientQty),quantity=Number(input.value);
        if(!Number.isFinite(quantity)||quantity<=0){if(status)status.textContent='Cada ingrediente debe tener una cantidad mayor que cero.';input.value=fmt(editorIngredients[index]?.quantity||100);return}
        const previous=editorIngredients[index];
        const nextQuantity=Math.round(quantity*10)/10;
        const qg=data()?.weightInGrams?.(previous,nextQuantity);
        editorIngredients[index]={...previous,quantity:nextQuantity,quantity_in_grams:qg===null||qg===undefined?previous.quantity_in_grams:Math.round(qg*1000)/1000};
        if(status)status.textContent='';updatePreview();
      }));
      ingredientHost.querySelectorAll('[data-recipe-ingredient-remove]').forEach(button=>button.addEventListener('click',()=>{
        const index=Number(button.dataset.recipeIngredientRemove),item=editorIngredients[index];
        if(!item)return;
        removedIngredients.push({item:{...item},index,expiresAt:Date.now()+8000});
        editorIngredients=editorIngredients.filter((_,i)=>i!==index);
        renderIngredientEditor();recipeUndoRender();
        if(status)status.textContent=`Se quitó «${item.name||'el ingrediente'}». Podés deshacerlo durante 8 segundos.`;
      }));
      updatePreview();
    }
    renderIngredientEditor();
    baselineSignature=recipeEditorSignature();
    const recipeOverlay=$('nutritionAdvancedModal');
    if(recipeOverlay){
      const onRecipeCloseAttempt=event=>{
        const wantsClose=event.type==='keydown'&&event.key==='Escape'||event.type==='click'&&(event.target===recipeOverlay||event.target?.closest?.('#nutritionAdvancedClose,[data-advanced-close]'));
        if(!wantsClose||recipeSaving)return;
        if(hasRecipeChanges()){
          const discard=window.confirm('¿Descartar los cambios de la receta?\n\nLos ingredientes, cantidades o instrucciones que modificaste no se guardaron.');
          if(!discard){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();return;}
        }
        cleanupRecipeEditorGuards();
      };
      recipeOverlay.addEventListener('click',onRecipeCloseAttempt,true);
      recipeOverlay.addEventListener('keydown',onRecipeCloseAttempt,true);
    }
    if(typeof window!=='undefined'){
      const beforeUnload=event=>{if(hasRecipeChanges()&&!recipeSaving){event.preventDefault();event.returnValue='';return ''}};
      window.__agendaE25RecipeBeforeUnload=beforeUnload;window.addEventListener('beforeunload',beforeUnload);
    }
    $('nutritionRecipeFinishedWeight')?.addEventListener('input',updatePreview);
    $('nutritionRecipeName')?.focus();document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    const searchButton=$('nutritionRecipeIngredientSearchBtn');
    async function searchRecipeIngredients(){
      const query=txt($('nutritionRecipeIngredientSearch')?.value),results=$('nutritionRecipeIngredientResults');
      if(!results)return;
      if(!query){results.textContent='Escribí el nombre de un alimento para buscar.';return}
      searchButton.disabled=true;searchButton.textContent='Buscando…';results.textContent='Buscando primero en tus alimentos…';
      try{
        const pack=await data().searchWithLocalFirst(query,foods()?.search);
        const matches=(Array.isArray(pack?.results)?pack.results:[]).slice(0,8);
        if(!matches.length){results.textContent='No se encontraron alimentos. Probá otro nombre o agregá primero el alimento a Mis alimentos.';return}
        results.innerHTML=matches.map((food,index)=>`<button type="button" class="nutrition-recipe-search-result" data-recipe-search-result="${index}"><span><strong>${esc(food.name)}</strong><small>${food.brand?esc(food.brand)+' · ':''}${esc(food.source||'Catálogo')} · ${fmt(food.calories)} kcal / 100 g</small></span><span aria-hidden="true">＋</span></button>`).join('');
        results.querySelectorAll('[data-recipe-search-result]').forEach(button=>button.addEventListener('click',()=>{
          const food=matches[Number(button.dataset.recipeSearchResult)];if(!food)return;
          const unit=data()?.defaultUnit?.(food)||'g';
          const quantity=Math.max(.1,num(food.defaultQuantity)|| (unit==='unit'||unit==='portion'?1:100));
          const item=data().snapshot?data().snapshot(food,quantity,unit,food.preparationState||'unspecified'):{...food,quantity,unit,calories_per_100g:num(food.calories),protein_per_100g:num(food.protein),carbs_per_100g:num(food.carbs),fat_per_100g:num(food.fat),fiber_per_100g:num(food.fiber)};
          editorIngredients.push({...item,name:food.name,brand:food.brand||'',quantity,unit,preparation_state:item.preparation_state||food.preparationState||'unspecified',calories_per_100g:num(food.calories??food.calories_per_100g),protein_per_100g:num(food.protein??food.protein_per_100g),carbs_per_100g:num(food.carbs??food.carbs_per_100g),fat_per_100g:num(food.fat??food.fat_per_100g),fiber_per_100g:num(food.fiber??food.fiber_per_100g),consumed:false,consumed_at:null});
          $('nutritionRecipeIngredientSearch').value='';results.innerHTML='';if(status)status.textContent=`${food.name} agregado a la receta.`;renderIngredientEditor();
        }));
      }catch(err){console.warn('Buscar ingrediente para receta:',err);results.textContent='No se pudo buscar el alimento. Comprobá la conexión o usá Mis alimentos.';}
      finally{searchButton.disabled=false;searchButton.textContent='Buscar'}
    }
    searchButton?.addEventListener('click',searchRecipeIngredients);
    $('nutritionRecipeIngredientSearch')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchRecipeIngredients()}});
    $('nutritionRecipeSaveForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const btn=$('nutritionRecipeSaveBtn');
      const name=txt($('nutritionRecipeName')?.value),servings=num($('nutritionRecipeServings')?.value);
      const ingredients=editorIngredients.filter(item=>num(item.quantity)>0).map(item=>({...item,consumed:false,consumed_at:null}));
      if(!name||servings<=0){if(status)status.textContent='Ingresá un nombre y una cantidad de porciones válida.';return}
      if(!ingredients.length){if(status)status.textContent='La receta debe contener al menos un ingrediente con cantidad.';return}
      if(!data()?.saveRecipe){if(status)status.textContent='La función de recetas no está disponible.';return}
      recipeSaving=true;
      if(btn){btn.disabled=true;btn.textContent='Guardando…'}
      try{
        const finishedWeightText=txt($('nutritionRecipeFinishedWeight')?.value);
        const instructions=txt($('nutritionRecipeInstructions')?.value).split(/\r?\n/).map(step=>step.trim()).filter(Boolean);
        const prepTimeMinutes=Number($('nutritionRecipePrepTime')?.value||0),cookTimeMinutes=Number($('nutritionRecipeCookTime')?.value||0);
        const res=await data().saveRecipe({id:existingRecipe?.id||null,parentRecipeId:existingRecipe?.parent_recipe_id||existingRecipe?.parentRecipeId||null,name,notes:txt($('nutritionRecipeNotes')?.value),instructions,prepTimeMinutes,cookTimeMinutes,servings,finishedWeightG:finishedWeightText===''?null:Number(finishedWeightText),ingredients});
        cleanupRecipeEditorGuards();closeModal();notify(`${editing?'Receta actualizada':creatingVariant?'Variante guardada':'Receta guardada'}: ${res.recipe.name}`,'success');openRecipesModal();
      }catch(err){recipeSaving=false;console.warn('Guardar receta:',err);if(status)status.textContent=`No se pudo guardar la receta. Comprobá la conexión y los permisos de Supabase. ${err?.message||''}`;if(btn){btn.disabled=false;btn.textContent=editing?'Guardar cambios':'Guardar receta'}}
    });
  }
  function localIsoDate(date=new Date()){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  async function requestCookingWakeLock(statusElement){
    if(!cookingModeActive)return;
    if(typeof navigator==='undefined'||!navigator.wakeLock?.request){if(statusElement)statusElement.textContent='El navegador no permite mantener la pantalla activa; podés continuar con el modo paso a paso.';return;}
    try{
      const lock=await navigator.wakeLock.request('screen');
      if(!cookingModeActive){try{await lock.release()}catch(_){};return;}
      activeWakeLock=lock;
      lock.addEventListener('release',()=>{if(activeWakeLock===lock)activeWakeLock=null;});
      if(statusElement)statusElement.textContent='La pantalla permanecerá activa mientras este modo esté abierto.';
    }catch(_){if(statusElement)statusElement.textContent='No se pudo bloquear la suspensión de pantalla. El modo paso a paso sigue disponible.';}
  }
  function openRecipeCookingMode(recipe){
    const steps=(Array.isArray(recipe.instructions)?recipe.instructions:[]).map(txt).filter(Boolean);
    if(!steps.length){notify('Esta receta todavía no tiene pasos. Editala para agregarlos.','warning');return;}
    let index=0;
    mountModal(`👩‍🍳 ${recipe.name}`,'Modo de cocina: avanzá paso a paso sin modificar la receta guardada.',`
      <section class="nutrition-recipe-cook-mode" aria-live="polite">
        <div class="nutrition-recipe-cook-meta"><span>${Math.max(0,num(recipe.prep_time_minutes))} min de preparación</span><span>${Math.max(0,num(recipe.cook_time_minutes))} min de cocción</span></div>
        <div class="nutrition-recipe-cook-progress"><div id="nutritionRecipeCookProgress" role="progressbar" aria-label="Progreso de preparación" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="1"><span id="nutritionRecipeCookProgressBar"></span></div><small id="nutritionRecipeCookCounter"></small></div>
        <article class="nutrition-recipe-cook-step"><span class="nutrition-recipe-cook-step-label" id="nutritionRecipeCookStepLabel"></span><p id="nutritionRecipeCookStepText"></p></article>
        <p class="nutrition-recipe-cook-wake-status" id="nutritionRecipeCookWakeStatus" role="status" aria-live="polite">Intentando mantener la pantalla activa…</p>
        <div class="nutrition-advanced-actions nutrition-recipe-cook-actions"><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipeCookPrev">Anterior</button><button type="button" class="nutrition-advanced-primary" id="nutritionRecipeCookNext">Siguiente paso</button><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipeCookBack">Volver a recetas</button></div>
      </section>`);
    cookingModeActive=true;
    const render=()=>{
      const progress=$('nutritionRecipeCookProgress'),bar=$('nutritionRecipeCookProgressBar'),counter=$('nutritionRecipeCookCounter'),label=$('nutritionRecipeCookStepLabel'),content=$('nutritionRecipeCookStepText'),previous=$('nutritionRecipeCookPrev'),next=$('nutritionRecipeCookNext');
      if(!progress||!bar||!counter||!label||!content||!previous||!next)return;
      const done=index+1;progress.setAttribute('aria-valuenow',String(done));bar.style.width=`${Math.round(done/steps.length*100)}%`;counter.textContent=`Paso ${done} de ${steps.length}`;label.textContent=`PASO ${done}`;content.textContent=steps[index];previous.disabled=index===0;next.textContent=index===steps.length-1?'Terminar preparación':'Siguiente paso';
    };
    $('nutritionRecipeCookPrev')?.addEventListener('click',()=>{if(index>0){index--;render()}});
    $('nutritionRecipeCookNext')?.addEventListener('click',()=>{if(index<steps.length-1){index++;render()}else{closeModal();notify('Terminaste de recorrer las instrucciones. Registrá la preparación cuando quieras guardar el rendimiento real.','success');openRecipesModal()}});
    $('nutritionRecipeCookBack')?.addEventListener('click',()=>{closeModal();openRecipesModal()});
    render();requestCookingWakeLock($('nutritionRecipeCookWakeStatus'));
  }
  function openRecipePreparationModal(recipe){
    if(!data()?.recordRecipePreparation){notify('La función de historial de preparaciones no está disponible. Aplicá la migración SQL de E4A.','warning');return}
    let operationKey='';
    try{operationKey=window.crypto?.randomUUID?.()||`recipe-prep-${Date.now()}-${Math.random().toString(36).slice(2,18)}`}catch(_){operationKey=`recipe-prep-${Date.now()}-${Math.random().toString(36).slice(2,18)}`}
    mountModal('🧾 Registrar preparación',`Registrá esta tanda de “${recipe.name}”. Se guardará una instantánea independiente de la receta actual.`,`
      <form id="nutritionRecipePreparationForm" class="nutrition-advanced-form">
        <div class="nutrition-recipe-preparation-snapshot"><strong>${esc(recipe.name)}</strong><span>${(Array.isArray(recipe.ingredients)?recipe.ingredients:[]).length} ingredientes · ${Math.max(0,num(recipe.prep_time_minutes))+Math.max(0,num(recipe.cook_time_minutes))} min estimados</span><small>La preparación histórica conservará los ingredientes, instrucciones y datos nutricionales tal como están hoy.</small></div>
        <div class="nutrition-advanced-grid">
          <div class="field"><label for="nutritionRecipePreparedOn">Fecha de preparación</label><input class="input" id="nutritionRecipePreparedOn" type="date" value="${localIsoDate()}" required></div>
          <div class="field"><label for="nutritionRecipeServingsMade">Porciones obtenidas</label><input class="input" id="nutritionRecipeServingsMade" type="number" min="0.1" max="1000" step="0.1" value="${esc(recipe.servings||1)}" required></div>
          <div class="field"><label for="nutritionRecipeActualWeight">Peso final real (g), opcional</label><input class="input" id="nutritionRecipeActualWeight" type="number" min="0.1" max="100000000" step="0.1" value="${esc(recipe.finished_weight_g||'')}" placeholder="Si lo pesaste"></div>
        </div>
        <div class="field"><label for="nutritionRecipePreparationNotes">Notas de esta tanda</label><textarea class="input" id="nutritionRecipePreparationNotes" rows="3" maxlength="2000" placeholder="Cambios, resultado, textura o rendimiento obtenido…"></textarea></div>
        <p class="nutrition-advanced-note">Registrar la preparación no agrega consumos ficticios ni descuenta automáticamente ingredientes de la despensa.</p>
        <div class="nutrition-advanced-status" id="nutritionRecipePreparationStatus" role="status" aria-live="polite"></div>
        <div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipePreparationCancel">Volver a recetas</button><button type="submit" class="nutrition-advanced-primary" id="nutritionRecipePreparationSave">Guardar preparación</button></div>
      </form>`);
    $('nutritionRecipePreparationCancel')?.addEventListener('click',()=>{closeModal();openRecipesModal()});
    $('nutritionRecipePreparationForm')?.addEventListener('submit',async event=>{
      event.preventDefault();const button=$('nutritionRecipePreparationSave'),status=$('nutritionRecipePreparationStatus');
      const preparedOn=txt($('nutritionRecipePreparedOn')?.value),servingsMade=Number($('nutritionRecipeServingsMade')?.value),weightText=txt($('nutritionRecipeActualWeight')?.value);
      if(!preparedOn||!Number.isFinite(Date.parse(`${preparedOn}T00:00:00Z`))||servingsMade<=0){if(status)status.textContent='Revisá la fecha y las porciones obtenidas.';return}
      if(button){button.disabled=true;button.textContent='Guardando…'}
      try{
        const result=await data().recordRecipePreparation({recipeId:recipe.id,operationKey,preparedOn,finishedWeightG:weightText===''?null:Number(weightText),servingsMade,notes:txt($('nutritionRecipePreparationNotes')?.value)});
        closeModal();notify(result.duplicate?'Esta preparación ya estaba registrada; no se duplicó.':'Preparación guardada con su instantánea histórica.','success');openRecipesModal();
      }catch(error){console.warn('Registrar preparación:',error);if(status)status.textContent=`No se pudo guardar la preparación. Verificá la migración sql/25-nutrition-recipes-advanced.sql y la conexión. ${error?.message||''}`;if(button){button.disabled=false;button.textContent='Reintentar guardado'}}
    });
  }
  async function openRecipePreparationHistory(recipeId=null,recipeName=''){
    mountModal('📚 Historial de preparaciones',recipeId?`Tandas registradas para “${recipeName}”. Cada entrada conserva la receta tal como estaba al prepararla.`:'Todas las preparaciones guardadas, incluso las que corresponden a recetas editadas o eliminadas.',`<div class="nutrition-advanced-status" id="nutritionRecipePreparationHistoryStatus" role="status" aria-live="polite">Cargando historial…</div><div class="nutrition-recipe-preparation-history" id="nutritionRecipePreparationHistoryList"></div><div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipeHistoryBack">Volver a recetas</button></div>`);
    $('nutritionRecipeHistoryBack')?.addEventListener('click',()=>{closeModal();openRecipesModal()});
    const status=$('nutritionRecipePreparationHistoryStatus'),host=$('nutritionRecipePreparationHistoryList');
    try{
      if(!data()?.loadRecipePreparationHistory)throw new Error('Aplicá la migración de E4A para habilitar el historial.');
      const rows=await data().loadRecipePreparationHistory({recipeId:recipeId||undefined,limit:100});
      if(!rows.length){status.textContent=recipeId?'Todavía no hay preparaciones registradas para esta receta.':'Todavía no hay preparaciones registradas.';host.innerHTML='';return}
      status.textContent=`${rows.length} preparación${rows.length===1?'':'es'} en el historial.`;
      host.innerHTML=rows.map(row=>{
        const snap=row.recipe_snapshot&&typeof row.recipe_snapshot==='object'?row.recipe_snapshot:{};
        const ingredientCount=Array.isArray(snap.ingredients)?snap.ingredients.length:0;
        const day=txt(row.prepared_on)?new Date(`${row.prepared_on}T12:00:00`).toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}):'Fecha no disponible';
        const weight=row.finished_weight_g?`${fmt(row.finished_weight_g)} g reales`:'Peso real no registrado';
        const nutrition=Array.isArray(snap.ingredients)&&snap.ingredients.length?recipeNutritionSummary(snap):(snap.calories_per_100g!=null?`${fmt(snap.calories_per_100g)} kcal / 100 g · P ${fmt(snap.protein_per_100g)} g · C ${fmt(snap.carbs_per_100g)} g · G ${fmt(snap.fat_per_100g)} g`:'');
        const steps=Array.isArray(snap.instructions)?snap.instructions.length:0;
        return `<article class="nutrition-recipe-preparation-history-item"><header><strong>${esc(row.recipe_name||snap.name||'Receta')}</strong><time datetime="${esc(row.prepared_on||'')}">${esc(day)}</time></header><p>${ingredientCount} ingrediente${ingredientCount===1?'':'s'} · ${fmt(row.servings_made)} porciones · ${esc(weight)}${steps?` · ${steps} pasos`:''}</p>${nutrition?`<small>${esc(nutrition)}</small>`:''}${row.notes?`<blockquote>${esc(row.notes)}</blockquote>`:''}</article>`;
      }).join('');
    }catch(error){status.textContent=`No se pudo cargar el historial. Comprobá la migración y los permisos de Supabase. ${error?.message||''}`;host.innerHTML='';}
  }

  function showRecipeCards(recipes,statusText=''){
    recipeRowsCache=Array.isArray(recipes)?recipes:[];
    renderRecipeCards(recipeRowsCache,statusText);
  }
  function renderRecipeCards(recipes,statusText=''){
    const host=$('nutritionRecipeList');if(!host)return;
    const status=$('nutritionRecipeListStatus');
    const query=$('nutritionRecipeSearch')?.value||'';
    const mode=$('nutritionRecipeFilter')?.value||'all';
    const filtered=filterRecipes(recipes,query,mode);
    if(status)status.textContent=(query.trim()||mode!=='all')?`Mostrando ${filtered.length} de ${recipes.length} recetas.`:(statusText||`${recipes.length} recetas guardadas.`);
    if(!recipes.length){host.innerHTML='<div class="nutrition-advanced-empty">Todavía no guardaste recetas. Abrí una comida con alimentos y tocá “Guardar como receta”.</div>';return}
    if(!filtered.length){host.innerHTML='<div class="nutrition-advanced-empty">No encontramos recetas con esos filtros. Probá otras palabras o limpiá la búsqueda.</div>';return}
    host.innerHTML=filtered.map(recipe=>{
      const ingredients=Array.isArray(recipe.ingredients)?recipe.ingredients:[];
      const instructions=Array.isArray(recipe.instructions)?recipe.instructions.filter(step=>txt(step)):[];
      const prepTime=Math.max(0,num(recipe.prep_time_minutes)),cookTime=Math.max(0,num(recipe.cook_time_minutes));
      const parent=recipe.parent_recipe_id?recipes.find(item=>String(item.id)===String(recipe.parent_recipe_id)):null;
      const timeSummary=(prepTime||cookTime)?`<small>Preparación ${prepTime} min · cocción ${cookTime} min · total ${prepTime+cookTime} min</small>`:'';
      const procedureSummary=instructions.length?`<small>${instructions.length} paso${instructions.length===1?'':'s'} de preparación${parent?` · Variante de ${esc(parent.name)}`:''}</small>`:parent?`<small>Variante de ${esc(parent.name)}</small>`:'';
      return `<article class="nutrition-recipe-card" data-recipe-card="${esc(recipe.id)}"><div class="nutrition-recipe-card-main"><strong>${esc(recipe.name)}</strong><small>${ingredients.length} ingrediente${ingredients.length===1?'':'s'} · ${recipe.finished_weight_g?`peso final ${fmt(recipe.finished_weight_g)} g`:`peso estimado ${fmt(recipe.total_weight_g)} g`} · rinde ${fmt(recipe.servings)} porción/porciones</small>${timeSummary}${procedureSummary}<span class="e25-recipe-nutrition-summary">${esc(recipeNutritionSummary(recipe))}</span>${recipe.notes?`<p>${esc(recipe.notes)}</p>`:''}</div><div class="nutrition-recipe-card-controls"><label>Porciones a agregar<input class="input" type="number" min="0.1" max="100" step="0.1" value="1" data-recipe-portions="${esc(recipe.id)}"></label><button type="button" class="nutrition-advanced-primary" data-recipe-add="${esc(recipe.id)}">Agregar a esta comida</button><button type="button" class="nutrition-advanced-secondary" data-recipe-cook="${esc(recipe.id)}" ${instructions.length?'':'disabled'}>Cocinar paso a paso</button><button type="button" class="nutrition-advanced-secondary" data-recipe-log="${esc(recipe.id)}">Registrar preparación</button><button type="button" class="nutrition-advanced-secondary" data-recipe-history="${esc(recipe.id)}">Historial</button><button type="button" class="nutrition-advanced-secondary" data-recipe-variant="${esc(recipe.id)}">Crear variante</button><button type="button" class="nutrition-advanced-secondary" data-recipe-edit="${esc(recipe.id)}">Editar receta</button><button type="button" class="nutrition-advanced-danger" data-recipe-delete="${esc(recipe.id)}">Eliminar</button></div></article>`;
    }).join('');
    host.querySelectorAll('[data-recipe-cook]').forEach(button=>button.addEventListener('click',()=>{
      const recipe=recipeRowsCache.find(r=>String(r.id)===button.dataset.recipeCook);if(recipe)openRecipeCookingMode(recipe);
    }));
    host.querySelectorAll('[data-recipe-log]').forEach(button=>button.addEventListener('click',()=>{
      const recipe=recipeRowsCache.find(r=>String(r.id)===button.dataset.recipeLog);if(recipe)openRecipePreparationModal(recipe);
    }));
    host.querySelectorAll('[data-recipe-history]').forEach(button=>button.addEventListener('click',()=>{
      const recipe=recipeRowsCache.find(r=>String(r.id)===button.dataset.recipeHistory);if(recipe)openRecipePreparationHistory(recipe.id,recipe.name);
    }));
    host.querySelectorAll('[data-recipe-variant]').forEach(button=>button.addEventListener('click',()=>{
      const recipe=recipeRowsCache.find(r=>String(r.id)===button.dataset.recipeVariant);if(!recipe)return;
      const baseName=`${recipe.name} — variante`;
      saveRecipeModal({...recipe,id:null,parent_recipe_id:recipe.id,name:baseName,ingredients:(Array.isArray(recipe.ingredients)?recipe.ingredients:[]).map(item=>({...item})),instructions:[...(Array.isArray(recipe.instructions)?recipe.instructions:[])]});
    }));
    host.querySelectorAll('[data-recipe-edit]').forEach(button=>button.addEventListener('click',()=>{
      const recipe=recipeRowsCache.find(r=>String(r.id)===button.dataset.recipeEdit);
      if(recipe)saveRecipeModal(recipe);
    }));
    host.querySelectorAll('[data-recipe-add]').forEach(button=>button.addEventListener('click',()=>{
      const recipe=recipeRowsCache.find(r=>String(r.id)===button.dataset.recipeAdd);if(!recipe)return;
      const portionInput=host.querySelector(`[data-recipe-portions="${CSS.escape(String(recipe.id))}"]`);const portions=num(portionInput?.value);
      if(portions<=0){if(status)status.textContent='Ingresá una cantidad de porciones mayor que cero.';return}
      const servings=Math.max(.1,num(recipe.servings)||1),scale=portions/servings;
      const ingredients=(Array.isArray(recipe.ingredients)?recipe.ingredients:[]).filter(x=>num(x.quantity)>0).map(item=>{const quantity=Math.round(num(item.quantity)*scale*10)/10;const qg=data()?.weightInGrams?.(item,quantity);return {...item,quantity,quantity_in_grams:qg===null||qg===undefined?item.quantity_in_grams:Math.round(qg*1000)/1000,consumed:false,consumed_at:null}});
      if(!ingredients.length){if(status)status.textContent='Esta receta no tiene ingredientes guardados.';return}
      const current=pendingFoods();foods()?.setPendingMealFoods?.([...current,...ingredients]);
      closeModal();notify(`${recipe.name}: se agregaron ${fmt(portions)} porciones a la comida.`,'success');
    }));
    host.querySelectorAll('[data-recipe-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const recipe=recipeRowsCache.find(r=>String(r.id)===button.dataset.recipeDelete);if(!recipe)return;
      if(!confirm(`¿Eliminar la receta “${recipe.name}”? Los ingredientes ya guardados en comidas anteriores no se borrarán.`))return;
      button.disabled=true;
      try{await data().deleteRecipe(recipe.id);showRecipeCards(recipeRowsCache.filter(r=>String(r.id)!==String(recipe.id)),'Receta eliminada.');notify('Receta eliminada.','success')}
      catch(err){button.disabled=false;if(status)status.textContent=`No se pudo eliminar la receta: ${err?.message||'error'}`}
    }));
  }
  async function openRecipesModal(){
    recipeRowsCache=[];
    mountModal('📖 Mis recetas','Buscá por nombre, notas, ingredientes o instrucciones. Los filtros solo cambian la vista; no alteran las recetas guardadas.',`<div class="nutrition-browse-toolbar nutrition-recipe-browse-toolbar"><label for="nutritionRecipeSearch">Buscar recetas<input class="input" type="search" id="nutritionRecipeSearch" maxlength="160" placeholder="Nombre, ingrediente, instrucciones…" autocomplete="off"></label><label for="nutritionRecipeFilter">Mostrar<select class="input" id="nutritionRecipeFilter"><option value="all">Todas las recetas</option><option value="with_steps">Con instrucciones</option><option value="without_steps">Sin instrucciones</option><option value="variants">Variantes</option><option value="originals">Recetas originales</option></select></label><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipeClearFilters">Limpiar</button></div><div class="nutrition-recipe-list-toolbar"><button type="button" class="nutrition-advanced-secondary" id="nutritionRecipeAllHistoryBtn">Ver historial de preparaciones</button></div><div class="nutrition-advanced-status" id="nutritionRecipeListStatus" role="status" aria-live="polite">Cargando recetas…</div><div class="nutrition-recipe-list" id="nutritionRecipeList"></div><div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cerrar</button></div>`);
    document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    $('nutritionRecipeAllHistoryBtn')?.addEventListener('click',()=>openRecipePreparationHistory());
    $('nutritionRecipeSearch')?.addEventListener('input',()=>renderRecipeCards(recipeRowsCache));
    $('nutritionRecipeFilter')?.addEventListener('change',()=>renderRecipeCards(recipeRowsCache));
    $('nutritionRecipeClearFilters')?.addEventListener('click',()=>{if($('nutritionRecipeSearch'))$('nutritionRecipeSearch').value='';if($('nutritionRecipeFilter'))$('nutritionRecipeFilter').value='all';renderRecipeCards(recipeRowsCache);$('nutritionRecipeSearch')?.focus()});
    try{const recipes=await data().loadRecipes();showRecipeCards(recipes,recipes.length?`${recipes.length} receta${recipes.length===1?'':'s'} guardada${recipes.length===1?'':'s'}.`:'No hay recetas guardadas todavía.');}
    catch(err){console.warn('Cargar recetas:',err);const status=$('nutritionRecipeListStatus');if(status)status.textContent=`No se pudieron cargar las recetas. Ejecutá sql/07-nutrition-advanced.sql y comprobá tu conexión. ${err?.message||''}`;const host=$('nutritionRecipeList');if(host)host.innerHTML='';}
  }
  function groupByDate(rows){const map=new Map();for(const row of rows){const key=String(row.consumed_date||'');if(!map.has(key))map.set(key,[]);map.get(key).push(row)}return [...map.entries()]}
  function renderHistoryResults(){
    const host=$('nutritionHistoryResults'),status=$('nutritionHistoryStatus');if(!host||!status)return;
    if(!Array.isArray(historyRowsCache)||!historyRowsCache.length){status.textContent=`No hay consumos registrados en los últimos ${historyDays} días.`;host.innerHTML='<div class="nutrition-advanced-empty">Cuando marques alimentos como consumidos, aparecerán acá con la fecha real del consumo.</div>';return}
    const query=$('nutritionHistorySearch')?.value||'',category=$('nutritionHistoryCategory')?.value||'all';
    const rows=filterHistoryRows(historyRowsCache,query,category);
    if(!rows.length){status.textContent=`No hay resultados para los filtros actuales (${historyRowsCache.length} registros en el período).`;host.innerHTML='<div class="nutrition-advanced-empty">No encontramos consumos que coincidan. Probá otras palabras, cambiá la categoría o limpiá los filtros.</div>';return}
    status.textContent=(query.trim()||category!=='all')?`Mostrando ${rows.length} de ${historyRowsCache.length} registros del período.`:`${rows.length} registro${rows.length===1?'':'s'} en los últimos ${historyDays} días.`;
    const groups=groupByDate(rows);
    host.innerHTML=groups.map(([date,items])=>{
      const total=items.reduce((a,item)=>({calories:a.calories+num(item.calories),protein:a.protein+num(item.protein_g),carbs:a.carbs+num(item.carbs_g),fat:a.fat+num(item.fat_g)}),{calories:0,protein:0,carbs:0,fat:0});
      const human=new Date(`${date}T12:00:00`).toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
      return `<section class="nutrition-history-day"><header><strong>${esc(human)}</strong><span>${items.length} registro${items.length===1?'':'s'} · ${Math.round(total.calories)} kcal · P ${fmt(total.protein)} g · C ${fmt(total.carbs)} g · G ${fmt(total.fat)} g</span></header><div class="nutrition-history-items">${items.map(item=>`<div class="nutrition-history-item"><div><strong>${esc(item.food_name||'Alimento')}</strong><small>${esc(item.meal_title||'Comida')}${item.meal_time?' · '+esc(item.meal_time):''} · ${fmt(item.quantity)} ${esc(item.unit||'g')}${item.item_snapshot?.preparation_state&&item.item_snapshot.preparation_state!=='unspecified'?' · '+(item.item_snapshot.preparation_state==='raw'?'crudo':item.item_snapshot.preparation_state==='cooked'?'cocido':'preparado'):''}</small></div><span>${fmt(item.calories)} kcal</span></div>`).join('')}</div></section>`;
    }).join('');
  }
  async function loadHistory(){
    const host=$('nutritionHistoryResults'),status=$('nutritionHistoryStatus');if(!host||!status)return;
    host.innerHTML='';status.textContent='Cargando historial…';status.setAttribute('aria-busy','true');
    try{
      const rows=await data().loadConsumptionHistory(historyDays);historyRowsCache=Array.isArray(rows)?rows:[];status.setAttribute('aria-busy','false');renderHistoryResults();
    }catch(err){console.warn('Historial de consumo:',err);historyRowsCache=[];status.setAttribute('aria-busy','false');status.textContent=`No se pudo cargar el historial. Ejecutá sql/07-nutrition-advanced.sql. ${err?.message||''}`;host.innerHTML='<div class="nutrition-advanced-empty">No se modificó ningún registro. Comprobá la conexión y volvé a intentar.</div>';}
  }
  function openHistoryModal(){
    historyRowsCache=[];
    mountModal('📅 Historial de consumo','Buscá alimentos o comidas y filtrá por categoría. Estos datos representan consumos registrados, no comidas solamente planificadas.',`<div class="nutrition-advanced-history-toolbar"><label for="nutritionHistoryRange">Período</label><select class="input" id="nutritionHistoryRange"><option value="7">Últimos 7 días</option><option value="30" selected>Últimos 30 días</option><option value="90">Últimos 90 días</option></select></div><div class="nutrition-browse-toolbar nutrition-history-browse-toolbar"><label for="nutritionHistorySearch">Buscar en el historial<input class="input" type="search" id="nutritionHistorySearch" maxlength="160" placeholder="Alimento, comida o marca…" autocomplete="off"></label><label for="nutritionHistoryCategory">Categoría<select class="input" id="nutritionHistoryCategory"><option value="all">Todas las categorías</option><option value="breakfast">Desayuno</option><option value="media_manana">Media mañana</option><option value="pre">Pre entrenamiento</option><option value="post">Post entrenamiento</option><option value="lunch">Almuerzo</option><option value="snack">Merienda</option><option value="dinner">Cena</option><option value="colacion">Colación</option><option value="sleep">Antes de dormir</option><option value="other">Otra / sin categoría</option></select></label><button type="button" class="nutrition-advanced-secondary" id="nutritionHistoryClearFilters">Limpiar</button></div><div class="nutrition-advanced-status" id="nutritionHistoryStatus" role="status" aria-live="polite" aria-busy="true">Cargando…</div><div class="nutrition-history-results" id="nutritionHistoryResults"></div><div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cerrar</button></div>`);
    document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    $('nutritionHistoryRange')?.addEventListener('change',e=>{historyDays=Number(e.target.value)||30;loadHistory()});
    $('nutritionHistorySearch')?.addEventListener('input',renderHistoryResults);
    $('nutritionHistoryCategory')?.addEventListener('change',renderHistoryResults);
    $('nutritionHistoryClearFilters')?.addEventListener('click',()=>{if($('nutritionHistorySearch'))$('nutritionHistorySearch').value='';if($('nutritionHistoryCategory'))$('nutritionHistoryCategory').value='all';renderHistoryResults();$('nutritionHistorySearch')?.focus()});
    historyDays=30;loadHistory();
  }
  function bind(){
    $('nutritionCreateCustomFoodBtn')?.addEventListener('click',()=>customFoodModal());
    $('nutritionManageCustomFoodsBtn')?.addEventListener('click',openUserFoodsModal);
    $('nutritionOpenRecipesBtn')?.addEventListener('click',openRecipesModal);
    $('nutritionMealBuilderSaveRecipe')?.addEventListener('click',saveRecipeModal);
    $('nutritionHistoryBtn')?.addEventListener('click',openHistoryModal);
    document.addEventListener('agenda:nutrition-history-warning',event=>notify(`Consumo guardado, pero falta guardar en el historial. ${event.detail?.message||''}`,'warning'));
    document.addEventListener('visibilitychange',()=>{if(cookingModeActive&&document.visibilityState==='visible'&&!activeWakeLock)requestCookingWakeLock($('nutritionRecipeCookWakeStatus'))});
  }
  window.AgendaNutritionAdvanced={openCustomFood:customFoodModal,openUserFoods:openUserFoodsModal,openRecipes:openRecipesModal,openHistory:openHistoryModal,saveRecipe:saveRecipeModal,normalizeSearchText,categoryKey,filterHistoryRows,filterRecipes,filterUserFoods};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
