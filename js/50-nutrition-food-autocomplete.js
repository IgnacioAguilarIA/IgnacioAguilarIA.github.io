(function(){
  'use strict';

  /*
   * Autocompletado profesional para Alimentación.
   * - Busca en el catálogo local en memoria para responder al instante.
   * - Consulta Open Food Facts solo después de una pausa breve al escribir.
   * - Mantiene el catálogo local primero y los resultados online debajo.
   * - No modifica ni intercepta la lógica de entrenamiento.
   */
  const $=id=>document.getElementById(id);
  const text=v=>String(v??'').trim();

  const CONFIG={
    minChars:2,
    localDebounceMs:160,
    onlineDebounceMs:520,
    maxLocal:8,
    maxOnline:8,
    maxIndexCatalog:2000,
    maxIndexUser:1000
  };

  let localIndex={userId:'',items:[],ready:false,promise:null};
  let inputTimer=0;
  let onlineTimer=0;
  let requestId=0;
  let activeIndex=-1;
  let lastSuggestionItems=[];
  let bound=false;

  // El título de la comida tiene su propio autocompletado.
  let titleInputTimer=0;
  let titleOnlineTimer=0;
  let titleRequestId=0;
  let titleActiveIndex=-1;
  let titleSuggestionItems=[];

  function normalizeSearch(v){
    return text(v)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9ñü]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function escapeHtml(v){
    const d=document.createElement('div');
    d.textContent=v??'';
    return d.innerHTML;
  }

  function num(v){
    const n=Number(v);
    return Number.isFinite(n)?n:0;
  }

  function hasNumericValue(value){
    return value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value));
  }

  function normalizedQualityToken(value){
    return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }

  const REQUIRED_NUTRIENTS=[
    {field:'calories_per_100g',label:'calorías',aliases:['caloria','calorias','calories','energy','kcal']},
    {field:'protein_per_100g',label:'proteínas',aliases:['proteina','proteinas','protein','proteins']},
    {field:'carbs_per_100g',label:'carbohidratos',aliases:['carbohidrato','carbohidratos','carbohydrate','carbohydrates','carbs']},
    {field:'fat_per_100g',label:'grasas',aliases:['grasa','grasas','fat','fats']}
  ];

  function missingNutritionFields(row){
    const declared=Array.isArray(row?.nutrition_missing_fields)?row.nutrition_missing_fields:
      (Array.isArray(row?.nutritionMissing)?row.nutritionMissing:[]);
    const missing=declared.map(text).filter(Boolean);
    const normalizedDeclared=missing.map(normalizedQualityToken);
    const declarationCovers=metric=>normalizedDeclared.some(name=>metric.aliases.some(alias=>{
      const token=normalizedQualityToken(alias);
      return name===token||name.startsWith(token+' ')||name.includes(' '+token+' ')||name.endsWith(' '+token);
    }));
    for(const metric of REQUIRED_NUTRIENTS){
      if(!hasNumericValue(row?.[metric.field])&&!declarationCovers(metric))missing.push(metric.label);
    }
    const quality=String(row?.nutrition_quality_status||row?.nutritionQualityStatus||'').trim().toLowerCase();
    if(quality==='incomplete'&&!missing.length)missing.push('datos nutricionales por revisar');
    return [...new Set(missing)];
  }

  function canonicalUnitKey(value){
    const unit=normalizedQualityToken(value||'g');
    if(['g','gram','grams','gramo','gramos'].includes(unit))return 'g';
    if(['ml','milliliter','milliliters','mililitro','mililitros'].includes(unit))return 'ml';
    if(['unit','units','unidad','unidades','piece','pieces','pieza','piezas'].includes(unit))return 'unit';
    if(['portion','portions','porcion','porciones','racion','raciones'].includes(unit))return 'portion';
    return unit||'g';
  }

  // Identidad de variante: no fusiona silenciosamente la misma comida en
  // estado crudo/cocido, con otra unidad o con una porción distinta.
  function foodVariantKey(food){
    return [
      normalizeSearch(food?.name),normalizeSearch(food?.brand),
      normalizedQualityToken(food?.preparationState||food?.preparation_state||'unspecified'),
      canonicalUnitKey(food?.unit),normalizeSearch(food?.quantity),normalizeSearch(food?.servingSize||food?.serving_size),
      hasNumericValue(food?.densityGPerMl??food?.density_g_per_ml)?String(Number(food?.densityGPerMl??food?.density_g_per_ml)):'',
      hasNumericValue(food?.gramsPerUnit??food?.grams_per_unit)?String(Number(food?.gramsPerUnit??food?.grams_per_unit)):'',
      hasNumericValue(food?.gramsPerPortion??food?.grams_per_portion)?String(Number(food?.gramsPerPortion??food?.grams_per_portion)):''
    ].join('|');
  }

  function activeSuggestionKey(items,index){
    return index>=0&&items?.[index]?foodVariantKey(items[index]):'';
  }

  function currentUserId(){
    return typeof currentUser!=='undefined'&&currentUser?.id?String(currentUser.id):'';
  }

  function relevance(food,q){
    const needle=normalizeSearch(q);
    const name=normalizeSearch(food?.name);
    const aliases=normalizeSearch(food?.aliases||'');
    const brand=normalizeSearch(food?.brand||'');
    const category=normalizeSearch(food?.categories||'');
    const hay=[name,aliases,brand,category].filter(Boolean).join(' ');
    if(!needle||!hay)return 0;

    if(name===needle)return 1200;
    if(name.startsWith(needle+' '))return 1090;
    if(name.startsWith(needle))return 1030;
    if(name.includes(' '+needle+' '))return 980;
    if(aliases===needle)return 950;
    if(aliases.split(' ').some(w=>w===needle))return 930;
    if(name.includes(needle))return 890;

    const words=needle.split(' ').filter(Boolean);
    const hits=words.filter(w=>hay.includes(w)).length;
    return hits?600+(hits/words.length)*180:0;
  }

  function dedupe(items){
    const seen=new Set();
    return (Array.isArray(items)?items:[]).filter(item=>{
      if(!item)return false;
      const key=[normalizeSearch(item.name),normalizeSearch(item.brand),text(item.externalId||item.id)].join('|');
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  function fromCatalogRow(row){
    return {
      id:String(row.id||''),
      code:'',
      name:text(row.name)||'Alimento',
      brand:text(row.brand),
      quantity:text(row.quantity_label||row.quantity),
      servingSize:text(row.serving_size),
      servingQuantity:num(row.serving_quantity)||null,
      quantityBase:100,
      unit:text(row.unit)||'g',
      preparationState:text(row.preparation_state)||'unspecified',
      densityGPerMl:num(row.density_g_per_ml)||null,
      gramsPerUnit:num(row.grams_per_unit)||null,
      gramsPerPortion:num(row.grams_per_portion)||null,
      calories:hasNumericValue(row.calories_per_100g)?Number(row.calories_per_100g):0,
      protein:hasNumericValue(row.protein_per_100g)?Number(row.protein_per_100g):0,
      carbs:hasNumericValue(row.carbs_per_100g)?Number(row.carbs_per_100g):0,
      fat:hasNumericValue(row.fat_per_100g)?Number(row.fat_per_100g):0,
      fiber:hasNumericValue(row.fiber_per_100g)?Number(row.fiber_per_100g):0,
      ingredients:text(row.ingredients),
      categories:text(row.category||row.categories),
      labels:text(row.labels),
      imageUrl:text(row.image_url),
      source:'Catálogo propio',
      sourceType:'food_catalog',
      sourceLabel:text(row.data_source_label||row.source)||'Catálogo propio',
      sourceUrl:text(row.source_url),
      nutritionQualityStatus:text(row.nutrition_quality_status)||(missingNutritionFields(row).length?'incomplete':'legacy_unverified'),
      nutritionMissing:missingNutritionFields(row),
      nutritionVerifiedAt:row.nutrition_verified_at||null,
      catalogId:row.id||null,
      userFoodId:null,
      externalId:'',
      aliases:text(row.aliases),
      isGeneric:row.is_generic!==false
    };
  }

  function fromUserRow(row){
    return {
      id:String(row.external_id||row.id||''),
      code:text(row.external_id),
      name:text(row.name)||'Alimento',
      brand:text(row.brand),
      quantity:text(row.quantity_label||row.quantity),
      servingSize:text(row.serving_size),
      servingQuantity:num(row.serving_quantity)||null,
      quantityBase:100,
      unit:text(row.unit)||'g',
      preparationState:text(row.preparation_state)||'unspecified',
      densityGPerMl:num(row.density_g_per_ml)||null,
      gramsPerUnit:num(row.grams_per_unit)||null,
      gramsPerPortion:num(row.grams_per_portion)||null,
      calories:hasNumericValue(row.calories_per_100g)?Number(row.calories_per_100g):0,
      protein:hasNumericValue(row.protein_per_100g)?Number(row.protein_per_100g):0,
      carbs:hasNumericValue(row.carbs_per_100g)?Number(row.carbs_per_100g):0,
      fat:hasNumericValue(row.fat_per_100g)?Number(row.fat_per_100g):0,
      fiber:hasNumericValue(row.fiber_per_100g)?Number(row.fiber_per_100g):0,
      ingredients:text(row.ingredients),
      categories:text(row.categories),
      labels:text(row.labels),
      imageUrl:text(row.image_url),
      source:'Mis alimentos',
      sourceType:'user_food',
      sourceLabel:text(row.data_source_label||row.source)||'Carga manual',
      sourceUrl:text(row.data_source_url),
      nutritionQualityStatus:text(row.nutrition_quality_status)||(missingNutritionFields(row).length?'incomplete':'legacy_unverified'),
      nutritionMissing:missingNutritionFields(row),
      nutritionVerifiedAt:row.nutrition_verified_at||null,
      catalogId:row.catalog_id||null,
      userFoodId:row.id||null,
      externalId:text(row.external_id),
      aliases:'',
      isGeneric:row.is_generic!==false
    };
  }

  async function loadLocalIndex(force=false){
    const uid=currentUserId();
    if(!uid)return [];
    if(!force&&localIndex.ready&&localIndex.userId===uid)return localIndex.items;
    if(!force&&localIndex.promise&&localIndex.userId===uid)return localIndex.promise;

    localIndex={userId:uid,items:[],ready:false,promise:null};
    localIndex.promise=(async()=>{
      try{
        if(typeof ensureSupabase!=='function')throw new Error('Supabase no disponible');
        const c=await ensureSupabase();
        const [catalogRes,userRes]=await Promise.all([
          c.from('food_catalog')
            .select('id,name,brand,category,aliases,serving_size,serving_quantity,unit,preparation_state,density_g_per_ml,grams_per_unit,grams_per_portion,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,source,source_url,data_source_label,nutrition_quality_status,nutrition_missing_fields,nutrition_verified_at,locale,is_generic,active')
            .eq('active',true).limit(CONFIG.maxIndexCatalog),
          c.from('user_foods')
            .select('id,user_id,catalog_id,source,external_id,fingerprint,name,brand,quantity_label,serving_size,serving_quantity,unit,preparation_state,density_g_per_ml,grams_per_unit,grams_per_portion,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,ingredients,categories,labels,image_url,is_generic,data_source_label,data_source_url,nutrition_quality_status,nutrition_missing_fields,nutrition_verified_at,updated_at')
            .eq('user_id',uid).order('updated_at',{ascending:false}).limit(CONFIG.maxIndexUser)
        ]);

        if(catalogRes.error)throw catalogRes.error;
        if(userRes.error)throw userRes.error;

        const user=(userRes.data||[]).map(fromUserRow);
        const catalog=(catalogRes.data||[]).map(fromCatalogRow);
        // Mis alimentos tiene prioridad frente al catálogo compartido.
        const seen=new Set();
        const items=[];
        [...user,...catalog].forEach(item=>{
          const key=foodVariantKey(item);
          if(seen.has(key))return;
          seen.add(key);
          items.push(item);
        });

        localIndex.items=items;
        localIndex.ready=true;
        return items;
      }catch(err){
        localIndex.items=[];
        localIndex.ready=false;
        console.warn('Autocompletado: no se pudo cargar el índice local.',err);
        return [];
      }finally{
        localIndex.promise=null;
      }
    })();

    return localIndex.promise;
  }

  async function searchLocalFast(query){
    const q=normalizeSearch(query);
    if(!q||q.length<CONFIG.minChars)return [];
    const items=await loadLocalIndex();
    if(items.length){
      return items
        .map(item=>({item,score:relevance(item,q)}))
        .filter(x=>x.score>0)
        .sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name,'es'))
        .map(x=>x.item)
        .slice(0,CONFIG.maxLocal);
    }

    // Fallback compatible con instalaciones donde todavía no se haya cargado
    // el índice o con una Supabase sin el nuevo catálogo.
    try{
      const data=window.AgendaNutritionData;
      if(typeof data?.searchLocal==='function'){
        const pack=await data.searchLocal(q);
        return dedupe([...(pack?.user||[]),...(pack?.catalog||[])]).sort((a,b)=>relevance(b,q)-relevance(a,q)).slice(0,CONFIG.maxLocal);
      }
    }catch(err){console.warn('Autocompletado: fallback local falló.',err)}
    return [];
  }

  function ensureBoxStructure(box){
    if(!box)return null;
    // La caja visual contiene dos regiones hermanas: resultados seleccionables
    // y un estado de carga/resultado vacío. El estado nunca se presenta como opción.
    box.removeAttribute('role');
    let list=[...box.children].find(node=>node.classList?.contains('nutrition-food-autocomplete-list'));
    if(!list){
      const existing=[...box.childNodes];
      list=document.createElement('div');
      list.className='nutrition-food-autocomplete-list';
      box.replaceChildren(list);
      existing.filter(node=>node!==list).forEach(node=>list.appendChild(node));
    }
    list.id=`${box.id}-listbox`;
    list.setAttribute('role','listbox');
    list.setAttribute('aria-label',box.id==='nutritionMealTitleAutocomplete'?'Sugerencias para el nombre de la comida':'Resultados de búsqueda de alimentos');
    let status=[...box.children].find(node=>node.classList?.contains('nutrition-food-autocomplete-state'));
    if(!status){
      status=document.createElement('div');
      status.className='nutrition-food-autocomplete-state';
      status.hidden=true;
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      status.setAttribute('aria-atomic','true');
      box.appendChild(status);
    }
    return {list,status};
  }

  function configureCombobox(input,box,expanded=undefined){
    if(!input||!box)return;
    const parts=ensureBoxStructure(box);
    input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-haspopup','listbox');
    input.setAttribute('aria-controls',parts.list.id);
    if(expanded!==undefined)input.setAttribute('aria-expanded',String(!!expanded));
    if(expanded===false)input.removeAttribute('aria-activedescendant');
  }

  function setPopupMessage(box,message,kind='empty'){
    if(!box)return;
    const parts=ensureBoxStructure(box);
    parts.list.replaceChildren();
    parts.status.className=`nutrition-food-autocomplete-state nutrition-food-autocomplete-${kind}`;
    parts.status.replaceChildren();
    if(kind==='loading'){
      const spinner=document.createElement('span');
      spinner.className='nutrition-food-autocomplete-spinner';
      spinner.setAttribute('aria-hidden','true');
      parts.status.appendChild(spinner);
    }
    const copy=document.createElement('span');
    copy.textContent=message;
    parts.status.appendChild(copy);
    parts.status.hidden=false;
    box.hidden=false;
    const input=$(box.id==='nutritionMealTitleAutocomplete'?'mealTitle':'nutritionFoodSearch');
    configureCombobox(input,box,true);
  }

  function clearPopupMessage(box){
    if(!box)return;
    const parts=ensureBoxStructure(box);
    parts.status.hidden=true;
    parts.status.replaceChildren();
  }

  function ensureBox(){
    let box=$('nutritionFoodAutocomplete');
    if(!box){
      const input=$('nutritionFoodSearch');
      const parent=input?.closest('.nutrition-food-catalog-search');
      if(!parent)return null;
      box=document.createElement('div');
      box.id='nutritionFoodAutocomplete';
      box.className='nutrition-food-autocomplete';
      box.hidden=true;
      parent.appendChild(box);
    }
    const input=$('nutritionFoodSearch');
    configureCombobox(input,box,box.hidden?false:undefined);
    return box;
  }

  function ensureTitleBox(){
    let box=$('nutritionMealTitleAutocomplete');
    if(!box){
      const input=$('mealTitle');
      const parent=input?.closest('.nutrition-meal-title-wrap');
      if(!parent)return null;
      box=document.createElement('div');
      box.id='nutritionMealTitleAutocomplete';
      box.className='nutrition-food-autocomplete nutrition-meal-title-autocomplete';
      box.hidden=true;
      parent.appendChild(box);
    }
    const input=$('mealTitle');
    configureCombobox(input,box,box.hidden?false:undefined);
    return box;
  }

  function syncAccessibleOptions(box,input,activeIndex=-1){
    if(!box||!input)return;
    const parts=ensureBoxStructure(box);
    const options=[...parts.list.querySelectorAll('.nutrition-food-autocomplete-item')];
    options.forEach(option=>{
      const index=Number(option.dataset.index);
      option.id=`${box.id}-option-${Number.isFinite(index)?index:options.indexOf(option)}`;
      option.setAttribute('role','option');
      option.setAttribute('aria-selected',String(Number.isFinite(index)&&index===activeIndex));
      option.setAttribute('tabindex','-1');
    });
    const active=options.find(option=>Number(option.dataset.index)===activeIndex);
    if(active)input.setAttribute('aria-activedescendant',active.id);
    else input.removeAttribute('aria-activedescendant');
  }

  function sourceClass(source){
    const s=normalizeSearch(source);
    if(s.includes('open food facts'))return 'online';
    if(s.includes('mis alimentos'))return 'personal';
    return 'local';
  }

  function renderGroup(label,items,groupType,offset){
    if(!items.length)return '';
    const groupClass=groupType==='online'?'nutrition-food-autocomplete-group online':'nutrition-food-autocomplete-group';
    return `
      <div class="${groupClass}" data-group="${groupType}" role="group" aria-label="${escapeHtml(label)}">
        <div class="nutrition-food-autocomplete-group-label"><span>${escapeHtml(label)}</span><small>${items.length} resultado${items.length===1?'':'s'}</small></div>
        ${items.map((food,i)=>{
          const idx=offset+i;
          const brand=food.brand?`<span class="nutrition-food-autocomplete-brand">${escapeHtml(food.brand)}</span>`:'';
          const source=sourceClass(food.source);
          const missing=Array.isArray(food.nutritionMissing)?food.nutritionMissing:[];
          const incomplete=missing.length>0||String(food.nutritionQualityStatus||'').toLowerCase()==='incomplete';
          const macros=incomplete
            ? `<span class="nutrition-food-autocomplete-quality" role="note">Datos incompletos${missing.length?`: faltan ${escapeHtml(missing.join(', '))}`:''}</span>`
            : `<span class="nutrition-food-autocomplete-macros">
                <span>${escapeHtml(food.calories)} kcal</span>
                <span>${escapeHtml(food.protein)} P</span>
                <span>${escapeHtml(food.carbs)} C</span>
                <span>${escapeHtml(food.fat)} G</span>
              </span>`;
          const prepLabels={raw:'Crudo',cooked:'Cocido',prepared:'Preparado'};
          const prep=prepLabels[String(food.preparationState||food.preparation_state||'').toLowerCase()];
          const prepBadge=prep?`<span class="nutrition-food-autocomplete-variant">${prep}</span>`:'';
          return `
            <button type="button" class="nutrition-food-autocomplete-item" data-index="${idx}" data-source="${source}">
              <span class="nutrition-food-autocomplete-main">
                <span class="nutrition-food-autocomplete-title">${escapeHtml(food.name)}</span>
                ${brand}${prepBadge}
                ${macros}
              </span>
              <span class="nutrition-food-autocomplete-pill">${escapeHtml(food.source)}</span>
            </button>`;
        }).join('')}
      </div>`;
  }

  function paint(items,localCount,onlineLoading=false){
    const box=ensureBox();
    if(!box)return;
    const parts=ensureBoxStructure(box);
    const previousActiveKey=activeSuggestionKey(lastSuggestionItems,activeIndex);
    const local=Array.isArray(items?.local)?items.local:[];
    const online=Array.isArray(items?.online)?items.online:[];
    const merged=[...local,...online];
    lastSuggestionItems=merged;
    activeIndex=previousActiveKey?merged.findIndex(item=>foodVariantKey(item)===previousActiveKey):-1;

    if(!merged.length){
      parts.list.replaceChildren();
      setPopupMessage(box,onlineLoading?'Buscando coincidencias en el catálogo…':'No encontré coincidencias. Podés seguir escribiendo o usar “Buscar en Open Food Facts”.',onlineLoading?'loading':'empty');
      syncAccessibleOptions(box,$('nutritionFoodSearch'),-1);
      return;
    }

    const personal=local.filter(item=>item?.sourceType==='user_food');
    const catalog=local.filter(item=>item?.sourceType!=='user_food');
    let html='';
    let offset=0;
    if(personal.length){html+=renderGroup('Mis alimentos',personal,'local',offset);offset+=personal.length;}
    if(catalog.length){html+=renderGroup('Catálogo de la aplicación',catalog,'local',offset);offset+=catalog.length;}
    if(online.length)html+=renderGroup('Open Food Facts',online,'online',offset);
    parts.list.innerHTML=html;
    clearPopupMessage(box);
    if(onlineLoading){
      const status=parts.status;
      status.className='nutrition-food-autocomplete-state nutrition-food-autocomplete-loading';
      status.replaceChildren();
      const spinner=document.createElement('span');spinner.className='nutrition-food-autocomplete-spinner';spinner.setAttribute('aria-hidden','true');
      const message=document.createElement('span');message.textContent='Buscando más resultados en Open Food Facts…';
      status.append(spinner,message);status.hidden=false;
    }
    box.hidden=false;
    configureCombobox($('nutritionFoodSearch'),box,true);
    syncAccessibleOptions(box,$('nutritionFoodSearch'),-1);

    parts.list.querySelectorAll('.nutrition-food-autocomplete-item').forEach(button=>{
      const idx=Number(button.dataset.index);
      button.classList.toggle('is-active',idx===activeIndex);
      button.addEventListener('click',()=>selectSuggestion(idx));
    });
    syncAccessibleOptions(box,$('nutritionFoodSearch'),activeIndex);
  }

  function paintTitle(items,onlineLoading=false){
    const box=ensureTitleBox();
    if(!box)return;
    const parts=ensureBoxStructure(box);
    const previousActiveKey=activeSuggestionKey(titleSuggestionItems,titleActiveIndex);
    const local=Array.isArray(items?.local)?items.local:[];
    const online=Array.isArray(items?.online)?items.online:[];
    const merged=[...local,...online];
    titleSuggestionItems=merged;
    titleActiveIndex=previousActiveKey?merged.findIndex(item=>foodVariantKey(item)===previousActiveKey):-1;

    if(!merged.length){
      parts.list.replaceChildren();
      setPopupMessage(box,onlineLoading?'Buscando coincidencias para el nombre de la comida…':'No encontré coincidencias. Podés escribir el nombre igualmente.',onlineLoading?'loading':'empty');
      syncAccessibleOptions(box,$('mealTitle'),-1);
      return;
    }

    const personal=local.filter(item=>item?.sourceType==='user_food');
    const catalog=local.filter(item=>item?.sourceType!=='user_food');
    let html='';
    let offset=0;
    if(personal.length){html+=renderGroup('Mis alimentos',personal,'local',offset);offset+=personal.length;}
    if(catalog.length){html+=renderGroup('Catálogo de la aplicación',catalog,'local',offset);offset+=catalog.length;}
    if(online.length)html+=renderGroup('Open Food Facts',online,'online',offset);
    parts.list.innerHTML=html;
    clearPopupMessage(box);
    if(onlineLoading){
      const status=parts.status;
      status.className='nutrition-food-autocomplete-state nutrition-food-autocomplete-loading';
      status.replaceChildren();
      const spinner=document.createElement('span');spinner.className='nutrition-food-autocomplete-spinner';spinner.setAttribute('aria-hidden','true');
      const message=document.createElement('span');message.textContent='Buscando alternativas en Open Food Facts…';
      status.append(spinner,message);status.hidden=false;
    }
    box.hidden=false;
    configureCombobox($('mealTitle'),box,true);
    parts.list.querySelectorAll('.nutrition-food-autocomplete-item').forEach(button=>{
      const idx=Number(button.dataset.index);
      button.classList.toggle('is-active',idx===titleActiveIndex);
      button.addEventListener('click',()=>selectTitleSuggestion(idx));
    });
    syncAccessibleOptions(box,$('mealTitle'),titleActiveIndex);
  }

  function setStatus(message){
    const el=$('nutritionFoodCatalogStatus');
    if(el)el.textContent=message||'';
  }

  function selectSuggestion(index){
    const food=lastSuggestionItems[index];
    if(!food)return;
    requestId++;
    window.clearTimeout(inputTimer);
    window.clearTimeout(onlineTimer);
    const input=$('nutritionFoodSearch');
    if(input)input.value=food.name;
    const selector=window.AgendaFoodCatalog?.select;
    if(typeof selector==='function')selector(food);
    const box=ensureBox();
    if(box)box.hidden=true;
    configureCombobox(input,box,false);
    setStatus(`✓ ${food.name} seleccionado desde ${food.source}. Ajustá la cantidad y agregalo a la comida.`);
    setTimeout(()=>{
      $('nutritionFoodQuantity')?.focus();
      $('nutritionFoodQuantity')?.select?.();
    },40);
  }

  function selectTitleSuggestion(index){
    const food=titleSuggestionItems[index];
    if(!food)return;
    titleRequestId++;
    window.clearTimeout(titleInputTimer);
    window.clearTimeout(titleOnlineTimer);
    const title=$('mealTitle');
    if(title)title.value=food.name;
    hideTitleAutocomplete();
    setStatus(`✓ Nombre de comida sugerido: «${food.name}». Para agregar ingredientes, usá “Buscar o elegir alimento”.`);
  }

  async function performTitleSearch(query,id){
    const q=text(query);
    if(id!==titleRequestId)return;
    if(q.length<CONFIG.minChars){
      hideTitleAutocomplete();
      return;
    }

    let local=[];
    try{local=await searchLocalFast(q)}catch(err){console.warn('Autocompletado del título:',err)}
    if(id!==titleRequestId)return;
    paintTitle({local,online:[]},true);
    const title=$('mealTitle');
    if(title)title.setAttribute('aria-expanded','true');

    window.clearTimeout(titleOnlineTimer);
    titleOnlineTimer=window.setTimeout(async()=>{
      const onlineId=id;
      if(onlineId!==titleRequestId)return;
      const off=window.AgendaFoodCatalogOFF?.search;
      if(typeof off!=='function'){
        paintTitle({local,online:[]},false);
        return;
      }
      try{
        const external=await off(q);
        if(onlineId!==titleRequestId)return;
        const localKeys=new Set(local.map(foodVariantKey));
        const online=dedupe(external).filter(item=>!localKeys.has(foodVariantKey(item)))
          .sort((a,b)=>relevance(b,q)-relevance(a,q)).slice(0,CONFIG.maxOnline);
        paintTitle({local,online},false);
      }catch(err){
        if(onlineId!==titleRequestId)return;
        paintTitle({local,online:[]},false);
      }
    },CONFIG.onlineDebounceMs);
  }

  function onTitleInput(event){
    const q=text(event?.target?.value);
    titleRequestId++;
    const id=titleRequestId;
    titleActiveIndex=-1;
    window.clearTimeout(titleInputTimer);
    window.clearTimeout(titleOnlineTimer);
    const box=ensureTitleBox();
    if(!box)return;
    if(q.length<CONFIG.minChars){
      hideTitleAutocomplete();
      return;
    }
    box.hidden=false;
    setPopupMessage(box,'Buscando en el catálogo de la aplicación…','loading');
    titleInputTimer=window.setTimeout(()=>performTitleSearch(q,id),CONFIG.localDebounceMs);
  }

  function setTitleActive(delta){
    const box=ensureTitleBox();
    const buttons=[...box?.querySelectorAll('.nutrition-food-autocomplete-item')||[]];
    if(!buttons.length)return;
    titleActiveIndex=(titleActiveIndex+delta+buttons.length)%buttons.length;
    buttons.forEach((b,i)=>b.classList.toggle('is-active',Number(b.dataset.index)===titleActiveIndex));
    syncAccessibleOptions(box,$('mealTitle'),titleActiveIndex);
    buttons.find(b=>Number(b.dataset.index)===titleActiveIndex)?.scrollIntoView({block:'nearest'});
  }

  function onTitleKeyDown(event){
    const box=ensureTitleBox();
    const visible=!!box&&!box.hidden;
    if(event.key==='ArrowDown'&&visible){event.preventDefault();setTitleActive(1);return}
    if(event.key==='ArrowUp'&&visible){event.preventDefault();setTitleActive(-1);return}
    if(event.key==='Enter'&&visible&&titleActiveIndex>=0){event.preventDefault();selectTitleSuggestion(titleActiveIndex);return}
    if(event.key==='Escape'&&visible){event.preventDefault();hideTitleAutocomplete();return}
  }

  function hideTitleAutocomplete(){
    const box=ensureTitleBox();
    if(box)box.hidden=true;
    configureCombobox($('mealTitle'),box,false);
    titleActiveIndex=-1;
    box?.querySelectorAll('.nutrition-food-autocomplete-item.is-active').forEach(option=>option.classList.remove('is-active'));
    syncAccessibleOptions(box,$('mealTitle'),-1);
  }

  function hide(){
    const box=ensureBox();
    if(box)box.hidden=true;
    configureCombobox($('nutritionFoodSearch'),box,false);
    activeIndex=-1;
    box?.querySelectorAll('.nutrition-food-autocomplete-item.is-active').forEach(option=>option.classList.remove('is-active'));
    syncAccessibleOptions(box,$('nutritionFoodSearch'),-1);
  }

  function show(){
    const box=ensureBox();
    if(!box)return;
    const parts=ensureBoxStructure(box);
    if(parts.list.querySelector('.nutrition-food-autocomplete-item')||(!parts.status.hidden&&parts.status.textContent.trim())){
      box.hidden=false;
      configureCombobox($('nutritionFoodSearch'),box,true);
    }
  }

  function setActive(delta){
    const box=ensureBox();
    const buttons=[...box?.querySelectorAll('.nutrition-food-autocomplete-item')||[]];
    if(!buttons.length)return;
    activeIndex=(activeIndex+delta+buttons.length)%buttons.length;
    buttons.forEach(b=>b.classList.toggle('is-active',Number(b.dataset.index)===activeIndex));
    syncAccessibleOptions(box,$('nutritionFoodSearch'),activeIndex);
    buttons.find(b=>Number(b.dataset.index)===activeIndex)?.scrollIntoView({block:'nearest'});
  }

  async function performSearch(query,id){
    const q=text(query);
    if(id!==requestId)return;
    if(q.length<CONFIG.minChars){
      hide();
      setStatus('Escribí al menos 2 letras para ver sugerencias.');
      return;
    }

    let local=[];
    try{local=await searchLocalFast(q)}catch(err){console.warn('Autocompletado local:',err)}
    if(id!==requestId)return;

    paint({local,online:[]},local.length,true);
    setStatus(local.length?`${local.length} sugerencia${local.length===1?'':'s'} del catálogo local. Buscando alternativas…`:'Buscando coincidencias…');

    window.clearTimeout(onlineTimer);
    onlineTimer=window.setTimeout(async()=>{
      const onlineId=id;
      if(onlineId!==requestId)return;
      const off=window.AgendaFoodCatalogOFF?.search;
      if(typeof off!=='function'){
        paint({local,online:[]},local.length,false);
        setStatus(local.length?`${local.length} sugerencia${local.length===1?'':'s'} del catálogo local.`:'El buscador online todavía no está disponible.');
        return;
      }
      try{
        const external=await off(q);
        if(onlineId!==requestId)return;
        const localKeys=new Set(local.map(foodVariantKey));
        const online=dedupe(external).filter(item=>!localKeys.has(foodVariantKey(item)))
          .sort((a,b)=>relevance(b,q)-relevance(a,q)).slice(0,CONFIG.maxOnline);
        paint({local,online},local.length,false);
        setStatus(`${local.length} del catálogo de la aplicación + ${online.length} de Open Food Facts.`);
      }catch(err){
        if(onlineId!==requestId)return;
        paint({local,online:[]},local.length,false);
        setStatus(local.length?`${local.length} resultado${local.length===1?'':'s'} del catálogo local. Open Food Facts no respondió ahora.`:'No pude consultar Open Food Facts ahora.');
      }
    },CONFIG.onlineDebounceMs);
  }

  function onInput(event){
    const q=text(event?.target?.value);
    requestId++;
    const id=requestId;
    activeIndex=-1;
    window.clearTimeout(inputTimer);
    window.clearTimeout(onlineTimer);

    if(q.length<CONFIG.minChars){
      hide();
      if(!q)setStatus('Escribí un alimento y las sugerencias aparecerán automáticamente.');
      else setStatus('Escribí una letra más para empezar la búsqueda.');
      return;
    }

    const box=ensureBox();
    if(box)setPopupMessage(box,'Buscando en el catálogo de la aplicación…','loading');
    inputTimer=window.setTimeout(()=>performSearch(q,id),CONFIG.localDebounceMs);
  }

  function onKeyDown(event){
    const box=ensureBox();
    const visible=!!box&&!box.hidden;
    if(event.key==='ArrowDown'&&visible){event.preventDefault();setActive(1);return}
    if(event.key==='ArrowUp'&&visible){event.preventDefault();setActive(-1);return}
    if(event.key==='Enter'&&visible&&activeIndex>=0){event.preventDefault();selectSuggestion(activeIndex);return}
    if(event.key==='Escape'&&visible){event.preventDefault();hide();return}
  }

  function bind(){
    if(bound)return;
    const input=$('nutritionFoodSearch');
    if(!input)return;
    bound=true;
    const box=ensureBox();
    configureCombobox(input,box,false);
    input.addEventListener('input',onInput);
    input.addEventListener('keydown',onKeyDown);
    input.addEventListener('focus',()=>{show();void loadLocalIndex();});

    document.addEventListener('click',event=>{
      const host=input.closest('.nutrition-food-catalog-search');
      if(host&&!host.contains(event.target))hide();
      const titleHost=$('mealTitle')?.closest('.nutrition-meal-title-wrap');
      if(titleHost&&!titleHost.contains(event.target))hideTitleAutocomplete();
    });

    const titleInput=$('mealTitle');
    if(titleInput&&!titleInput.dataset.foodAutocompleteBound){
      titleInput.dataset.foodAutocompleteBound='1';
      titleInput.addEventListener('input',onTitleInput);
      titleInput.addEventListener('keydown',onTitleKeyDown);
      titleInput.addEventListener('focus',()=>{void loadLocalIndex();});
      configureCombobox(titleInput,ensureTitleBox(),false);
    }

    // Precarga el catálogo una vez, sin bloquear el formulario.
    window.setTimeout(()=>{void loadLocalIndex();},300);

    // Si la modal se vuelve a abrir, el índice sigue en memoria y la búsqueda es inmediata.
    const toggle=$('nutritionFoodCatalogToggle');
    if(toggle&&!toggle.dataset.autocompleteOpenBound){
      toggle.dataset.autocompleteOpenBound='1';
      toggle.addEventListener('click',()=>{window.setTimeout(()=>{void loadLocalIndex();},0)});
    }
  }

  function init(){
    bind();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
