(function(){
  'use strict';

  /*
   * Capa preparada para Open Food Facts.
   * No hace consultas externas todavía: deja una interfaz estable para conectar
   * la API más adelante sin cambiar el formulario de nutrición.
   */
  const $=id=>document.getElementById(id);
  let selectedFood=null;
  let expanded=false;
  let pendingMealFoods=[];
  let pendingMealContext=null;

  function safeNumber(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function dateKeyInCordoba(value=new Date()){
    const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;
  }
  function text(v){return String(v??'').trim()}
  function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}

  function normalize(item){
    if(!item||typeof item!=='object')return null;
    const n=item.nutrients||item.nutrition||item;
    return {
      id:String(item.id||item.code||item.gtin||item.barcode||item._id||''),
      name:String(item.name||item.product_name||item.product_name_es||item.title||'Alimento'),
      brand:String(item.brand||item.brands||''),
      sourceType:String(item.sourceType||item.source_type||''),
      catalogId:item.catalogId||item.catalog_id||null,
      userFoodId:item.userFoodId||item.user_food_id||null,
      externalId:String(item.externalId||item.external_id||item.code||item.id||''),
      aliases:String(item.aliases||''),
      fiber:safeNumber(n.fiber||n.fiber_g||n['fiber_100g']),
      isGeneric:item.isGeneric!==false && item.is_generic!==false,
      // Los valores nutricionales del catálogo se expresan por 100 g.
      // El tamaño de porción solo se usa como cantidad inicial, nunca como divisor.
      quantityBase:100,
      defaultQuantity:safeNumber(item.defaultQuantity||item.serving_size_g||item.servingQuantity||item.serving_quantity||100)||100,
      unit:String(item.unit||'g'),
      calories:safeNumber(n.calories||n.energy_kcal||n['energy-kcal_100g']),
      protein:safeNumber(n.protein||n.proteins||n.proteins_g||n['proteins_100g']),
      carbs:safeNumber(n.carbs||n.carbohydrates||n.carbs_g||n['carbohydrates_100g']),
      fat:safeNumber(n.fat||n.fat_g||n['fat_100g']),
      quantity:String(item.quantity||''),
      servingSize:String(item.servingSize||item.serving_size||''),
      servingQuantity:safeNumber(item.servingQuantity||item.serving_quantity),
      brand:String(item.brand||item.brands||''),
      ingredients:String(item.ingredients||item.ingredients_text||''),
      categories:String(item.categories||''),
      labels:String(item.labels||''),
      imageUrl:String(item.imageUrl||item.image_front_url||item.image_url||''),
      source:String(item.source||'Catálogo externo'),
      nutriScore:String(item.nutriScore||item.nutrition_grades||item.nutriscore_grade||'')
    };
  }

  function calc(item,amount){
    const f=normalize(item); if(!f)return null;
    const raw=String(amount??'').trim();
    const parsed=raw===''?f.defaultQuantity:Number(raw);
    const qty=Number.isFinite(parsed)?Math.max(0,parsed):(f.defaultQuantity||100);
    // Las columnas calories/protein/carbs/fat del catálogo son valores por 100 g.
    const factor=qty/100;
    return {
      calories:Math.round(f.calories*factor*10)/10,
      protein:Math.round(f.protein*factor*10)/10,
      carbs:Math.round(f.carbs*factor*10)/10,
      fat:Math.round(f.fat*factor*10)/10,
      quantity:qty,
      unit:f.unit
    };
  }

  function setStatus(msg){const el=$('nutritionFoodCatalogStatus');if(el)el.textContent=msg||''}

  function renderResults(items){
    const host=$('nutritionFoodCatalogResults'); if(!host)return;
    const list=(Array.isArray(items)?items:[]).map(normalize).filter(Boolean);
    host.innerHTML='';
    if(!list.length){
      host.innerHTML='<div class="nutrition-food-catalog-status">No hay resultados para mostrar.</div>';
      return;
    }
    list.slice(0,10).forEach(food=>{
      const b=document.createElement('button');b.type='button';b.className='nutrition-food-result';
      const brand=food.brand?`<span class="nutrition-food-result-brand">${esc(food.brand)}</span>`:'';
      const serving=food.servingQuantity?`<span>Porción: <b>${esc(food.servingQuantity)} g</b></span>`:'';
      const packageQty=food.quantity?`<span>Envase: <b>${esc(food.quantity)}</b></span>`:'';
      b.innerHTML=`
        <span class="nutrition-food-result-main">
          <span class="nutrition-food-result-title">${esc(food.name)}</span>
          ${brand}
          <span class="nutrition-food-result-macros">
            <span><b>${esc(food.calories)}</b> kcal</span>
            <span><b>${esc(food.protein)} g</b> P</span>
            <span><b>${esc(food.carbs)} g</b> C</span>
            <span><b>${esc(food.fat)} g</b> G</span>
          </span>
          ${(serving||packageQty)?`<span class="nutrition-food-result-details">${serving}${packageQty}</span>`:''}
        </span>
        <span class="nutrition-food-result-tag">${esc(food.source)}</span>`;
      b.addEventListener('click',()=>{
        selectFood(food);
      });
      host.appendChild(b);
    });
  }

  function splitIngredients(raw){
    const source=text(raw);
    if(!source)return [];
    const normalized=source.replace(/[•·]/g,',').replace(/\r?\n|\s*;\s*/g,',');
    const out=[];
    let current='';
    let depth=0;
    for(const ch of normalized){
      if(ch==='('||ch==='['||ch==='{')depth++;
      if(ch===')'||ch===']'||ch==='}')depth=Math.max(0,depth-1);
      if(ch===','&&depth===0){
        const item=current.trim();
        if(item)out.push(item);
        current='';
      }else{
        current+=ch;
      }
    }
    const last=current.trim();
    if(last)out.push(last);
    return out.filter((item,i)=>item&&out.indexOf(item)===i).slice(0,40);
  }

  function renderSelected(){
    const box=$('nutritionFoodSelected'); if(!box)return;
    const catalog=$('nutritionFoodCatalog');
    if(catalog)catalog.classList.toggle('has-selection',Boolean(selectedFood));
    const apply=$('nutritionFoodApply');
    const save=$('nutritionFoodSave');
    const actions=$('nutritionFoodCatalogActions');
    if(!selectedFood){box.hidden=true;if(apply)apply.hidden=true;if(save)save.hidden=true;if(actions)actions.hidden=true;return}
    box.hidden=false;
    const qtyEl=$('nutritionFoodQuantity');
    const qty=safeNumber(qtyEl?.value)||selectedFood.defaultQuantity||100;
    const totals=calc(selectedFood,qty);
    const ingredients=splitIngredients(selectedFood.ingredients);
    const details=[selectedFood.brand?`<span><b>Marca</b>${esc(selectedFood.brand)}</span>`:'',selectedFood.quantity?`<span><b>Envase</b>${esc(selectedFood.quantity)}</span>`:'',selectedFood.servingSize?`<span><b>Porción</b>${esc(selectedFood.servingSize)}</span>`:''].filter(Boolean).join('');
    const ingredientHtml=ingredients.length
      ? `<div class="nutrition-food-ingredients"><div class="nutrition-food-section-title">🧾 Ingredientes</div><ul>${ingredients.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`
      : `<div class="nutrition-food-ingredients is-empty"><div class="nutrition-food-section-title">🧾 Ingredientes</div><p>Open Food Facts no informó una lista de ingredientes para este producto.</p></div>`;
    const meta=[selectedFood.categories?`<span>${esc(selectedFood.categories)}</span>`:'',selectedFood.labels?`<span>${esc(selectedFood.labels)}</span>`:'',selectedFood.nutriScore?`<span>Nutri-Score: ${esc(selectedFood.nutriScore.toUpperCase())}</span>`:''].filter(Boolean).join('');
    box.innerHTML=`
      <div class="nutrition-food-selected-head">
        <div class="nutrition-food-selected-title"><span class="nutrition-food-check">✓</span><div><strong>${esc(selectedFood.name)}</strong><small>Fuente: ${esc(selectedFood.source||'Catálogo de alimentos')}</small></div></div>
      </div>
      ${details?`<div class="nutrition-food-selected-meta">${details}</div>`:''}
      <div class="nutrition-food-selected-nutrition">
        <div><b>${esc(selectedFood.calories)}</b><span>kcal / 100 g</span></div>
        <div><b>${esc(selectedFood.protein)} g</b><span>proteínas</span></div>
        <div><b>${esc(selectedFood.carbs)} g</b><span>carbohidratos</span></div>
        <div><b>${esc(selectedFood.fat)} g</b><span>grasas</span></div>
      </div>
      <div class="nutrition-food-selected-total"><span>Para ${qty} ${esc(selectedFood.unit)}</span><b>${totals.calories} kcal · ${totals.protein} g P · ${totals.carbs} g C · ${totals.fat} g G</b></div>
      <details class="nutrition-food-more-details"><summary>Ver ingredientes y detalles del producto</summary><div class="nutrition-food-more-details-body">${ingredientHtml}${meta?`<div class="nutrition-food-selected-tags">${meta}</div>`:''}</div></details>`;
    if(apply){apply.hidden=false;apply.disabled=false;}
    if(save){save.hidden=false;save.disabled=false;save.textContent='☆ Guardar en mis alimentos';}
    if(actions)actions.hidden=false;
  }

  function selectFood(food){
    selectedFood=normalize(food);
    const q=$('nutritionFoodQuantity');if(q)q.value=selectedFood.defaultQuantity||100;
    setStatus(`Seleccionado: ${selectedFood.name}. Ajustá los gramos y agregalo a la comida.`);
    renderSelected();
    document.dispatchEvent(new CustomEvent('agenda:nutrition-selected-food-changed',{detail:{food:selectedFood}}));
    // En resultados largos, llevar la selección y la cantidad a la vista para que el siguiente paso sea evidente.
    const selectionPanel=$('nutritionFoodSelected')?.closest('.nutrition-food-selection-panel');
    if(selectionPanel){
      const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      window.setTimeout(()=>selectionPanel.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'}),30);
    }
  }

  async function saveSelectedToUser(){
    if(!selectedFood)return;
    const provider=window.AgendaNutritionData;
    if(!provider?.saveUserFood){setStatus('La persistencia de alimentos todavía no está disponible.');return}
    const save=$('nutritionFoodSave');
    if(save){save.disabled=true;save.textContent='Guardando…';}
    try{
      const result=await provider.saveUserFood(selectedFood);
      if(result?.ok){setStatus('✓ Alimento guardado en Mis alimentos. La próxima vez aparecerá primero.');if(save){save.textContent='✓ Guardado en mis alimentos';save.disabled=true;}}
      else {setStatus('No se pudo guardar el alimento todavía.');if(save){save.disabled=false;save.textContent='☆ Guardar en mis alimentos';}}
    }catch(err){
      console.warn('Guardar alimento:',err);
      setStatus('No se pudo guardar el alimento. Revisá la conexión con Supabase.');
      if(save){save.disabled=false;save.textContent='☆ Guardar en mis alimentos';}
    }
  }

  function applySelected(){
    if(!selectedFood)return;
    const raw=String($('nutritionFoodQuantity')?.value??'').trim();
    const parsed=raw===''?(selectedFood.defaultQuantity||100):Number(raw);
    const qty=Number.isFinite(parsed)?Math.max(0,parsed):(selectedFood.defaultQuantity||100);
    if(qty<=0){setStatus('Ingresá una cantidad mayor que cero para agregar el alimento.');return;}
    const totals=calc(selectedFood,qty); if(!totals)return;
    const title=$('mealTitle'),foods=$('mealFoods');
    const set=(id,val)=>{const el=$(id);if(el)el.value=val};
    set('mealCalories',totals.calories);set('mealProtein',totals.protein);set('mealCarbs',totals.carbs);set('mealFat',totals.fat);
    if(title&&!title.value.trim())title.value=selectedFood.name;
    if(foods){
      const details=[selectedFood.name,selectedFood.brand?`Marca: ${selectedFood.brand}`:'',selectedFood.quantity?`Envase: ${selectedFood.quantity}`:''].filter(Boolean).join(' · ');
      const suffix=`${details} · ${qty} ${selectedFood.unit}`;
      foods.value=foods.value.trim()?`${foods.value.trim()}, ${suffix}`:suffix;
    }
    const desc=$('mealDescription');
    if(desc && !desc.value.trim()) {
      const parts=[selectedFood.ingredients?`Ingredientes: ${selectedFood.ingredients}`:'',selectedFood.categories?`Categorías: ${selectedFood.categories}`:'',selectedFood.labels?`Etiquetas: ${selectedFood.labels}`:'',selectedFood.servingSize?`Porción declarada: ${selectedFood.servingSize}`:'',selectedFood.nutriScore?`Nutri-Score: ${selectedFood.nutriScore}`:''].filter(Boolean);
      if(parts.length)desc.value=parts.join(' | ');
    }
    if(window.AgendaNutritionData?.snapshot){
      pendingMealFoods.push(window.AgendaNutritionData.snapshot(selectedFood,qty));
      document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:pendingMealFoods.length}}));
    }
    // Al usar un alimento externo o del catálogo, lo guardamos también en el catálogo personal.
    window.AgendaNutritionData?.saveUserFood?.(selectedFood).catch?.(err=>console.warn('No se pudo guardar automáticamente en Mis alimentos:',err));
    document.dispatchEvent(new CustomEvent('agenda:nutrition-food-added',{detail:{food:selectedFood,quantity:qty}}));
    setStatus(`✓ ${selectedFood.name} agregado a la comida${pendingMealFoods.length>1?` · ${pendingMealFoods.length} alimentos listos para guardar`:''}.`);
  }

  async function restoreMealItems(mealId){
    pendingMealFoods=[];
    document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:0,mealId}}));
    if(!mealId||!window.AgendaNutritionData?.loadMealItems){
      document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-items-restored',{detail:{mealId:mealId||null,count:0,ok:true}}));
      return;
    }
    try{
      const rows=await window.AgendaNutritionData.loadMealItems(mealId);
      pendingMealFoods=(rows||[]).map(row=>{
        const stamp=row.consumed_at||null;
        const consumedToday=Boolean(row.consumed&&stamp&&dateKeyInCordoba(stamp)===dateKeyInCordoba(new Date()));
        if(row.consumed&&stamp&&window.AgendaNutritionData?.recordConsumptionHistory){window.AgendaNutritionData.recordConsumptionHistory(row,stamp).catch(err=>console.warn('Historial nutricional pendiente:',err));}
        return {
          catalog_id:row.catalog_id||null,user_food_id:row.user_food_id||null,source:row.source||'external',external_id:row.external_id||null,
          name:row.name||'Alimento',brand:row.brand||'',quantity:Number(row.quantity)||100,unit:row.unit||'g',serving_size:row.serving_size||'',
          calories_per_100g:Number(row.calories_per_100g)||0,protein_per_100g:Number(row.protein_per_100g)||0,carbs_per_100g:Number(row.carbs_per_100g)||0,
          fat_per_100g:Number(row.fat_per_100g)||0,fiber_per_100g:Number(row.fiber_per_100g)||0,ingredients:row.ingredients||'',categories:row.categories||'',labels:row.labels||'',image_url:row.image_url||'',consumed:consumedToday,consumed_at:consumedToday?stamp:null
        };
      });
      pendingMealContext={mealId:String(mealId)};
      document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:pendingMealFoods.length,mealId}}));
      document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-items-restored',{detail:{mealId,count:pendingMealFoods.length,ok:true}}));
    }catch(err){
      console.warn('No se pudieron recuperar los alimentos estructurados de la comida:',err);
      document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-items-restored',{detail:{mealId,count:0,ok:false}}));
    }
  }

  let searchRequestId=0;

  async function onFind(){
    const q=$('nutritionFoodSearch')?.value.trim()||'';
    const findBtn=$('nutritionFoodCatalogFind');
    if(!q){setStatus('Escribí un alimento para buscar.');renderResults([]);return}

    const requestId=++searchRequestId;
    if(findBtn)findBtn.disabled=true;
    setStatus('Buscando primero en tus alimentos y en el catálogo propio…');
    renderResults([]);

    try{
      const externalSearch=window.AgendaFoodCatalog?.search;
      const localFirst=window.AgendaNutritionData?.searchWithLocalFirst;
      let pack;
      if(typeof localFirst==='function'){
        pack=await localFirst(q,externalSearch);
      }else if(typeof externalSearch==='function'){
        pack={results:await externalSearch(q),source:'online'};
      }else{
        throw new Error('El buscador de alimentos todavía no está listo.');
      }
      if(requestId!==searchRequestId)return;
      const results=Array.isArray(pack?.results)?pack.results:[];
      const source=pack?.source||'online';
      if(!results.length){setStatus('No encontré resultados para esa búsqueda.');renderResults([]);return}
      const localCount=Number(pack?.localCount)||0;
      const externalCount=Number(pack?.externalCount)||0;
      let label='Resultados de Open Food Facts.';
      if(source==='local') label=`${localCount} resultado${localCount===1?'':'s'} del catálogo propio.`;
      else if(source==='local+online') label=`${localCount} del catálogo propio + ${externalCount} de Open Food Facts, ordenados por relevancia.`;
      setStatus(`${results.length} resultado${results.length===1?'':'s'} · ${label}`);
      renderResults(results);
    }catch(err){
      if(requestId!==searchRequestId)return;
      console.warn('Catálogo de alimentos:',err);
      const message=err?.name==='AbortError'?'La búsqueda tardó demasiado. Probá de nuevo.':'No se pudo consultar el catálogo. Revisá la conexión y probá de nuevo.';
      setStatus(message);
      renderResults([]);
    }finally{
      if(requestId===searchRequestId&&findBtn)findBtn.disabled=false;
    }
  }

  function open(){expanded=true;const panel=$('nutritionFoodCatalog');if(panel)panel.hidden=false;const toggle=$('nutritionFoodCatalogToggle');if(toggle)toggle.setAttribute('aria-expanded','true');if(!$('nutritionFoodSearch')?.value)setStatus('Buscá un alimento por nombre en Open Food Facts.');}
  function close(){expanded=false;const panel=$('nutritionFoodCatalog');if(panel)panel.hidden=true;const toggle=$('nutritionFoodCatalogToggle');if(toggle)toggle.setAttribute('aria-expanded','false');}
  function toggle(){expanded?close():open()}
  function reset(context=null){selectedFood=null;pendingMealFoods=[];pendingMealContext=context||null;document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:0}}));document.dispatchEvent(new CustomEvent('agenda:nutrition-selected-food-changed',{detail:{food:null}}));const q=$('nutritionFoodSearch');if(q)q.value='';const qty=$('nutritionFoodQuantity');if(qty)qty.value=100;const results=$('nutritionFoodCatalogResults');if(results)results.innerHTML='';setStatus('Primero busca en tus alimentos y en el catálogo propio.');renderSelected()}

  function bind(){
    const toggleBtn=$('nutritionFoodCatalogToggle');if(toggleBtn&&!toggleBtn.dataset.bound){toggleBtn.dataset.bound='1';toggleBtn.addEventListener('click',toggle)}
    const find=$('nutritionFoodCatalogFind');if(find&&!find.dataset.bound){find.dataset.bound='1';find.addEventListener('click',onFind)}
    const search=$('nutritionFoodSearch');if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();onFind()}})}
    const qty=$('nutritionFoodQuantity');if(qty&&!qty.dataset.bound){qty.dataset.bound='1';qty.addEventListener('input',renderSelected)}
    const apply=$('nutritionFoodApply');if(apply&&!apply.dataset.bound){apply.dataset.bound='1';apply.addEventListener('click',applySelected)}
    const save=$('nutritionFoodSave');if(save&&!save.dataset.bound){save.dataset.bound='1';save.addEventListener('click',saveSelectedToUser)}
    if(typeof window.openNutritionModal==='function'&&!window.openNutritionModal.__foodCatalogWrapped){
      const original=window.openNutritionModal;
      const wrapped=function(meal=null){
        const context={mealId:meal?.id?String(meal.id):null,day:(typeof nutritionDay!=='undefined'?Number(nutritionDay):null),mealType:String(meal?.meal_type||activeMealType||'')};
        reset(context);
        original(meal);
        reset(context);
        if(meal?.id)setTimeout(()=>restoreMealItems(meal.id),0);
      };
      wrapped.__foodCatalogWrapped=true;window.openNutritionModal=wrapped;
    }
    window.AgendaFoodCatalog={
      normalize,
      calculate:calc,
      renderResults,
      select:selectFood,
      search:window.AgendaFoodCatalog?.search||null,
      getProductDetails:window.AgendaFoodCatalog?.getProductDetails||null,
      getPendingMealFoods:()=>pendingMealFoods.slice(),
      setPendingMealFoods:items=>{pendingMealFoods=Array.isArray(items)?items.slice():[]},
      clearPendingMealFoods:()=>{reset(pendingMealContext)},
      getPendingMealContext:()=>pendingMealContext?{...pendingMealContext}:null,
      getSelectedFood:()=>selectedFood,
      saveSelectedToUser,
      ready:true
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
