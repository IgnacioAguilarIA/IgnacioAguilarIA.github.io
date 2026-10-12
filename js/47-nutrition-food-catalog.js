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
    const densityValue=item.densityGPerMl??item.density_g_per_ml;
    const gramsValue=item.gramsPerUnit??item.grams_per_unit;
    const portionValue=item.gramsPerPortion??item.grams_per_portion;
    const density=Number.isFinite(Number(densityValue))&&Number(densityValue)>0?Number(densityValue):null;
    const gramsPerUnit=Number.isFinite(Number(gramsValue))&&Number(gramsValue)>0?Number(gramsValue):null;
    const gramsPerPortion=Number.isFinite(Number(portionValue))&&Number(portionValue)>0?Number(portionValue):null;
    const rawUnit=String(item.unit||'g').toLowerCase();
    const canonical=(value)=>{
      const v=String(value||'g').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      if(['g','gram','grams','gramo','gramos'].includes(v))return 'g';
      if(['ml','milliliter','milliliters','mililitro','mililitros'].includes(v))return 'ml';
      if(['unit','units','unidad','unidades','piece','pieces','pieza','piezas'].includes(v))return 'unit';
      if(['portion','portions','porcion','porciones','racion','raciones'].includes(v))return 'portion';
      return v||'g';
    };
    const baseUnit=canonical(rawUnit);
    const unitValid=baseUnit==='g'||(baseUnit==='ml'&&density!==null)||(baseUnit==='unit'&&gramsPerUnit!==null)||(baseUnit==='portion'&&gramsPerPortion!==null);
    const unit=unitValid?baseUnit:'g';
    const serving=Number(item.servingQuantity??item.serving_quantity);
    const explicitDefault=Number(item.defaultQuantity??item.serving_size_g);
    const defaultQuantity=Number.isFinite(explicitDefault)&&explicitDefault>0?explicitDefault:(unit===baseUnit&&Number.isFinite(serving)&&serving>0?serving:(unit==='unit'||unit==='portion'?1:100));
    const prepRaw=String(item.preparationState??item.preparation_state??'unspecified').toLowerCase();
    const prep=window.AgendaNutritionData?.normalizePreparationState?window.AgendaNutritionData.normalizePreparationState(prepRaw,item.name||item.product_name||item.product_name_es):(['raw','cooked','prepared','unspecified'].includes(prepRaw)?prepRaw:'unspecified');
    return {
      id:String(item.id||item.code||item.gtin||item.barcode||item._id||''),
      name:String(item.name||item.product_name||item.product_name_es||item.title||'Alimento'),
      brand:String(item.brand||item.brands||''),
      sourceType:String(item.sourceType||item.source_type||''),
      catalogId:item.catalogId||item.catalog_id||null,
      userFoodId:item.userFoodId||item.user_food_id||null,
      externalId:String(item.externalId||item.external_id||item.code||item.id||''),
      aliases:String(item.aliases||''),
      fiber:safeNumber(n.fiber??n.fiber_g??n['fiber_100g']),
      isGeneric:item.isGeneric!==false&&item.is_generic!==false,
      quantityBase:100,defaultQuantity,unit,densityGPerMl:density,gramsPerUnit,gramsPerPortion,preparationState:prep,
      calories:safeNumber(n.calories??n.energy_kcal??n['energy-kcal_100g']),
      protein:safeNumber(n.protein??n.proteins??n.proteins_g??n['proteins_100g']),
      carbs:safeNumber(n.carbs??n.carbohydrates??n.carbs_g??n['carbohydrates_100g']),
      fat:safeNumber(n.fat??n.fat_g??n['fat_100g']),
      quantity:String(item.quantity||''),servingSize:String(item.servingSize||item.serving_size||''),
      servingQuantity:Number.isFinite(serving)&&serving>0?serving:null,
      ingredients:String(item.ingredients||item.ingredients_text||''),categories:String(item.categories||''),
      labels:String(item.labels||''),imageUrl:String(item.imageUrl||item.image_front_url||item.image_url||''),
      source:String(item.source||'Catálogo externo'),nutriScore:String(item.nutriScore||item.nutrition_grades||item.nutriscore_grade||'')
    };
  }

  function calc(item,amount,unitOverride=null){
    const f=normalize(item);if(!f)return null;
    const raw=String(amount??'').trim();
    const parsed=raw===''?f.defaultQuantity:Number(raw);
    const qty=Number.isFinite(parsed)?Math.max(0,parsed):(f.defaultQuantity||100);
    const unit=String(unitOverride||f.unit||'g');
    const grams=window.AgendaNutritionData?.quantityToGrams
      ? window.AgendaNutritionData.quantityToGrams(f,qty,unit)
      : (unit==='g'?qty:null);
    if(grams===null)return {valid:false,reason:unit==='ml'?'Falta la densidad en g/ml.':'Falta el peso en gramos por unidad o porción.',quantity:qty,unit,weightGrams:null,calories:0,protein:0,carbs:0,fat:0};
    const factor=grams/100;
    return {valid:true,calories:Math.round(f.calories*factor*10)/10,protein:Math.round(f.protein*factor*10)/10,carbs:Math.round(f.carbs*factor*10)/10,fat:Math.round(f.fat*factor*10)/10,quantity:qty,unit,weightGrams:Math.round(grams*1000)/1000};
  }
  function unitOptions(food){
    const options=[['g','Gramos (g)']];
    if(Number(food?.densityGPerMl)>0)options.push(['ml','Mililitros (ml)']);
    if(Number(food?.gramsPerUnit)>0)options.push(['unit','Unidades']);
    if(Number(food?.gramsPerPortion)>0)options.push(['portion','Porciones']);
    return options;
  }
  function populateUnitOptions(food){
    const select=$('nutritionFoodQuantityUnit');if(!select)return;
    const options=unitOptions(food);select.innerHTML=options.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
    const requested=food?.unit;
    const valid=options.some(([value])=>value===requested);
    select.value=valid?requested:'g';
    const quantity=$('nutritionFoodQuantity');if(quantity){quantity.value=valid?(food.defaultQuantity||100):(select.value==='g'?100:1);}
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
      const servingUnit=({g:'g',ml:'ml',unit:'unidades',portion:'porciones'})[food.unit]||'g';
      const serving=food.servingQuantity?`<span>Porción: <b>${esc(food.servingQuantity)} ${servingUnit}</b></span>`:'';
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
    const box=$('nutritionFoodSelected');if(!box)return;
    const catalog=$('nutritionFoodCatalog');if(catalog)catalog.classList.toggle('has-selection',Boolean(selectedFood));
    const apply=$('nutritionFoodApply'),save=$('nutritionFoodSave'),actions=$('nutritionFoodCatalogActions');
    if(!selectedFood){box.hidden=true;if(apply)apply.hidden=true;if(save)save.hidden=true;if(actions)actions.hidden=true;return}
    box.hidden=false;
    const qtyEl=$('nutritionFoodQuantity'),unit=String($('nutritionFoodQuantityUnit')?.value||'g');
    const qtyRaw=String(qtyEl?.value??'').trim();const qty=qtyRaw===''?(selectedFood.defaultQuantity||100):Math.max(0,safeNumber(qtyRaw));
    const prep=String($('nutritionFoodPreparationState')?.value||selectedFood.preparationState||'unspecified');
    const totals=calc(selectedFood,qty,unit);
    const ingredients=splitIngredients(selectedFood.ingredients);
    const details=[selectedFood.brand?`<span><b>Marca</b>${esc(selectedFood.brand)}</span>`:'',selectedFood.quantity?`<span><b>Envase</b>${esc(selectedFood.quantity)}</span>`:'',selectedFood.servingSize?`<span><b>Porción declarada</b>${esc(selectedFood.servingSize)}</span>`:''].filter(Boolean).join('');
    const prepLabels={unspecified:'Estado no especificado',raw:'Crudo',cooked:'Cocido',prepared:'Preparado'};
    const prepNote=prep==='unspecified'?'Indicá el estado si conocés que los valores corresponden a una preparación específica.':`Valores declarados para el alimento ${prepLabels[prep].toLowerCase()}.`;
    const ingredientHtml=ingredients.length?`<div class="nutrition-food-ingredients"><div class="nutrition-food-section-title">🧾 Ingredientes</div><ul>${ingredients.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`:`<div class="nutrition-food-ingredients is-empty"><div class="nutrition-food-section-title">🧾 Ingredientes</div><p>Open Food Facts no informó una lista de ingredientes para este producto.</p></div>`;
    const meta=[selectedFood.categories?`<span>${esc(selectedFood.categories)}</span>`:'',selectedFood.labels?`<span>${esc(selectedFood.labels)}</span>`:'',selectedFood.nutriScore?`<span>Nutri-Score: ${esc(selectedFood.nutriScore.toUpperCase())}</span>`:''].filter(Boolean).join('');
    box.innerHTML=`
      <div class="nutrition-food-selected-head"><div class="nutrition-food-selected-title"><span class="nutrition-food-check">✓</span><div><strong>${esc(selectedFood.name)}</strong><small>Fuente: ${esc(selectedFood.source||'Catálogo de alimentos')}</small></div></div></div>
      ${details?`<div class="nutrition-food-selected-meta">${details}</div>`:''}
      <div class="nutrition-food-selected-nutrition"><div><b>${esc(selectedFood.calories)}</b><span>kcal / 100 g</span></div><div><b>${esc(selectedFood.protein)} g</b><span>proteínas</span></div><div><b>${esc(selectedFood.carbs)} g</b><span>carbohidratos</span></div><div><b>${esc(selectedFood.fat)} g</b><span>grasas</span></div></div>
      <div class="nutrition-food-preparation-chip">Estado: <strong>${esc(prepLabels[prep]||prepLabels.unspecified)}</strong><small>${esc(prepNote)}</small></div>
      <div class="nutrition-food-selected-total"><span>Para ${esc(qty)} ${esc(unit)}${totals?.valid?` (≈ ${esc(totals.weightGrams)} g)`:''}</span><b>${totals?.valid?`${totals.calories} kcal · ${totals.protein} g P · ${totals.carbs} g C · ${totals.fat} g G`:'No se puede calcular con fiabilidad: falta una equivalencia en gramos.'}</b></div>
      <details class="nutrition-food-more-details"><summary>Ver ingredientes y detalles del producto</summary><div class="nutrition-food-more-details-body">${ingredientHtml}${meta?`<div class="nutrition-food-selected-tags">${meta}</div>`:''}</div></details>`;
    if(apply){apply.hidden=false;apply.disabled=!totals?.valid||qty<=0;}
    if(save){save.hidden=false;save.disabled=false;save.textContent='☆ Guardar en mis alimentos';}
    if(actions)actions.hidden=false;
  }

  function selectFood(food){
    selectedFood=normalize(food);
    if(!selectedFood)return;
    populateUnitOptions(selectedFood);
    const prep=$('nutritionFoodPreparationState');if(prep)prep.value=selectedFood.preparationState||'unspecified';
    setStatus(`Seleccionado: ${selectedFood.name}. Elegí una unidad disponible y una cantidad. Los valores por 100 g deben corresponder al estado indicado.`);
    renderSelected();
    document.dispatchEvent(new CustomEvent('agenda:nutrition-selected-food-changed',{detail:{food:selectedFood}}));
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
      const selectedForSave={...selectedFood,preparationState:String($('nutritionFoodPreparationState')?.value||selectedFood.preparationState||'unspecified')};
      const result=await provider.saveUserFood(selectedForSave);
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
    const unit=String($('nutritionFoodQuantityUnit')?.value||'g');
    const preparationState=String($('nutritionFoodPreparationState')?.value||selectedFood.preparationState||'unspecified');
    if(qty<=0){setStatus('Ingresá una cantidad mayor que cero para agregar el alimento.');return;}
    const totals=calc(selectedFood,qty,unit);
    if(!totals?.valid){setStatus(`No se agregó el alimento: ${totals?.reason||'falta una conversión fiable a gramos'}`);return;}
    const title=$('mealTitle'),foods=$('mealFoods');
    const set=(id,val)=>{const el=$(id);if(el)el.value=val};
    set('mealCalories',totals.calories);set('mealProtein',totals.protein);set('mealCarbs',totals.carbs);set('mealFat',totals.fat);
    if(title&&!title.value.trim())title.value=selectedFood.name;
    if(foods){
      const details=[selectedFood.name,selectedFood.brand?`Marca: ${selectedFood.brand}`:'',selectedFood.quantity?`Envase: ${selectedFood.quantity}`:''].filter(Boolean).join(' · ');
      const suffix=`${details} · ${qty} ${unit} (≈ ${totals.weightGrams} g) · ${preparationState==='unspecified'?'estado no especificado':preparationState==='raw'?'crudo':preparationState==='cooked'?'cocido':'preparado'}`;
      foods.value=foods.value.trim()?`${foods.value.trim()}, ${suffix}`:suffix;
    }
    const desc=$('mealDescription');
    if(desc&&!desc.value.trim()){
      const parts=[selectedFood.ingredients?`Ingredientes: ${selectedFood.ingredients}`:'',selectedFood.categories?`Categorías: ${selectedFood.categories}`:'',selectedFood.labels?`Etiquetas: ${selectedFood.labels}`:'',selectedFood.servingSize?`Porción declarada: ${selectedFood.servingSize}`:'',selectedFood.nutriScore?`Nutri-Score: ${selectedFood.nutriScore}`:'',`Estado para estos valores: ${preparationState}`].filter(Boolean);
      if(parts.length)desc.value=parts.join(' | ');
    }
    if(window.AgendaNutritionData?.snapshot){
      try{pendingMealFoods.push(window.AgendaNutritionData.snapshot(selectedFood,qty,unit,preparationState));}
      catch(err){setStatus(err?.message||'No se pudo convertir la cantidad a gramos.');return;}
      document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:pendingMealFoods.length}}));
    }
    window.AgendaNutritionData?.saveUserFood?.({...selectedFood,preparationState}).catch?.(err=>console.warn('No se pudo guardar automáticamente en Mis alimentos:',err));
    document.dispatchEvent(new CustomEvent('agenda:nutrition-food-added',{detail:{food:selectedFood,quantity:qty,unit,quantityInGrams:totals.weightGrams,preparationState}}));
    setStatus(`✓ ${selectedFood.name} agregado: ${qty} ${unit} ≈ ${totals.weightGrams} g${pendingMealFoods.length>1?` · ${pendingMealFoods.length} alimentos listos para guardar`:''}.`);
    renderSelected();
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
          name:row.name||'Alimento',brand:row.brand||'',quantity:Number(row.quantity)||100,unit:row.unit||'g',quantity_in_grams:row.quantity_in_grams??null,preparation_state:row.preparation_state||'unspecified',density_g_per_ml:row.density_g_per_ml??null,grams_per_unit:row.grams_per_unit??null,serving_size:row.serving_size||'',
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
  function reset(context=null){selectedFood=null;pendingMealFoods=[];pendingMealContext=context||null;document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:0}}));document.dispatchEvent(new CustomEvent('agenda:nutrition-selected-food-changed',{detail:{food:null}}));const q=$('nutritionFoodSearch');if(q)q.value='';const qty=$('nutritionFoodQuantity');if(qty)qty.value=100;const unit=$('nutritionFoodQuantityUnit');if(unit)unit.value='g';const prep=$('nutritionFoodPreparationState');if(prep)prep.value='unspecified';const results=$('nutritionFoodCatalogResults');if(results)results.innerHTML='';setStatus('Primero busca en tus alimentos y en el catálogo propio.');renderSelected()}

  function bind(){
    const toggleBtn=$('nutritionFoodCatalogToggle');if(toggleBtn&&!toggleBtn.dataset.bound){toggleBtn.dataset.bound='1';toggleBtn.addEventListener('click',toggle)}
    const find=$('nutritionFoodCatalogFind');if(find&&!find.dataset.bound){find.dataset.bound='1';find.addEventListener('click',onFind)}
    const search=$('nutritionFoodSearch');if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();onFind()}})}
    const qty=$('nutritionFoodQuantity');if(qty&&!qty.dataset.bound){qty.dataset.bound='1';qty.addEventListener('input',renderSelected)}
    const unit=$('nutritionFoodQuantityUnit');if(unit&&!unit.dataset.bound){unit.dataset.bound='1';unit.addEventListener('change',()=>{const q=$('nutritionFoodQuantity');if(q)q.value=unit.value==='unit'||unit.value==='portion'?1:100;renderSelected()})}
    const prep=$('nutritionFoodPreparationState');if(prep&&!prep.dataset.bound){prep.dataset.bound='1';prep.addEventListener('change',renderSelected)}
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
