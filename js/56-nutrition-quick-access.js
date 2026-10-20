/* Agenda FICH — accesos rápidos de Alimentación.
   Favoritos y recientes separados por usuario y limitados a este navegador.
   Este módulo no modifica rutinas ni persistencia de Entrenamiento. */
(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const MAX_RECENT=10;
  const MAX_FAVORITES=50;
  const KEY_PREFIX='agenda-nutrition-quick-access-v1:';
  let activeTab='recent';
  let selectedFood=null;

  function text(v){return String(v??'').trim()}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function fmt(v){const n=Math.round(num(v)*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1)}
  function escapeHtml(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
  function normalize(v){return text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
  function normalizeUnit(value){
    const v=normalize(value);
    if(['g','gram','grams','gramo','gramos'].includes(v))return 'g';
    if(['ml','milliliter','milliliters','mililitro','mililitros'].includes(v))return 'ml';
    if(['unit','units','unidad','unidades','piece','pieces','pieza','piezas'].includes(v))return 'unit';
    if(['portion','portions','porcion','porciones','racion','raciones'].includes(v))return 'portion';
    return '';
  }
  function normalizePreparation(value){
    const v=text(value).toLowerCase();
    return ['raw','cooked','prepared','unspecified'].includes(v)?v:'unspecified';
  }
  function unitLabel(value){return ({g:'g',ml:'ml',unit:'unidad(es)',portion:'porción(es)'})[value]||value||'g'}

  function accountId(){
    try{if(typeof currentUser!=='undefined'&&currentUser?.id)return String(currentUser.id)}catch(_){ }
    return 'guest';
  }
  function storageKey(){return KEY_PREFIX+accountId()}
  function blankStore(){return {version:1,favorites:[],recent:[]}}
  function readStore(){
    try{
      const raw=localStorage.getItem(storageKey());
      if(!raw)return blankStore();
      const parsed=JSON.parse(raw);
      return {version:1,favorites:Array.isArray(parsed?.favorites)?parsed.favorites.slice(0,MAX_FAVORITES):[],recent:Array.isArray(parsed?.recent)?parsed.recent.slice(0,MAX_RECENT):[]};
    }catch(_){return blankStore()}
  }
  function writeStore(store){
    try{localStorage.setItem(storageKey(),JSON.stringify(store));return true}
    catch(err){console.warn('No se pudieron guardar los accesos rápidos de Alimentación:',err);return false}
  }
  function foodKey(food){return normalize(food?.name)+'|'+normalize(food?.brand||'')}
  function cleanFood(food,quantity){
    if(!food||typeof food!=='object')return null;
    const qty=Math.max(0.1,num(quantity)||num(food.defaultQuantity)||num(food.servingQuantity)||100);
    return {
      id:text(food.id||food.code||food.externalId||food.external_id),
      name:text(food.name)||'Alimento',
      brand:text(food.brand),
      source:text(food.source||food.sourceType||'Catálogo de alimentos'),
      sourceType:text(food.sourceType||food.source_type||''),
      catalogId:food.catalogId||food.catalog_id||null,
      userFoodId:food.userFoodId||food.user_food_id||null,
      externalId:text(food.externalId||food.external_id||food.code||food.id),
      aliases:text(food.aliases),
      unit:text(food.unit)||'g',
      preparationState:text(food.preparationState||food.preparation_state)||'unspecified',
      densityGPerMl:num(food.densityGPerMl??food.density_g_per_ml)||null,
      gramsPerUnit:num(food.gramsPerUnit??food.grams_per_unit)||null,
      gramsPerPortion:num(food.gramsPerPortion??food.grams_per_portion)||null,
      defaultQuantity:qty,
      servingQuantity:num(food.servingQuantity||food.serving_quantity)||null,
      servingSize:text(food.servingSize||food.serving_size),
      quantity:text(food.quantity||food.quantity_label),
      calories:num(food.calories||food.calories_per_100g),
      protein:num(food.protein||food.protein_per_100g),
      carbs:num(food.carbs||food.carbs_per_100g),
      fat:num(food.fat||food.fat_per_100g),
      fiber:num(food.fiber||food.fiber_per_100g),
      ingredients:text(food.ingredients),
      categories:text(food.categories||food.category),
      labels:text(food.labels),
      imageUrl:text(food.imageUrl||food.image_url),
      isGeneric:food.isGeneric!==false&&food.is_generic!==false,
      nutritionMissing:Array.isArray(food.nutritionMissing)?food.nutritionMissing.map(String).filter(Boolean).slice(0,8):(Array.isArray(food.nutrition_missing)?food.nutrition_missing.map(String).filter(Boolean).slice(0,8):[]),
      nutritionQualityStatus:text(food.nutritionQualityStatus||food.nutrition_quality_status||'legacy_unverified'),
      nutritionVerifiedAt:food.nutritionVerifiedAt||food.nutrition_verified_at||null,
      sourceLabel:text(food.sourceLabel||food.data_source_label||food.source||food.sourceType||'Origen no registrado'),
      sourceUrl:text(food.sourceUrl||food.source_url),
      lastQuantity:(num(food.lastQuantity??food.last_quantity)>0&&num(food.lastQuantity??food.last_quantity)<=1000000)?num(food.lastQuantity??food.last_quantity):null,
      lastUnit:normalizeUnit(food.lastUnit||food.last_unit),
      lastPreparationState:normalizePreparation(food.lastPreparationState||food.last_preparation_state||food.preparationState||food.preparation_state),
      lastUsedAt:text(food.lastUsedAt||food.last_used_at),
      useCount:Math.max(0,Math.min(1000000,Math.floor(num(food.useCount??food.use_count))))
    };
  }
  function getLists(){
    const store=readStore();
    store.favorites=store.favorites.map(item=>cleanFood(item)).filter(Boolean);
    store.recent=store.recent.map(item=>cleanFood(item,item.lastQuantity||item.defaultQuantity)).filter(Boolean);
    return store;
  }
  function isFavorite(food,store=getLists()){
    const key=foodKey(food);
    return !!key&&store.favorites.some(item=>foodKey(item)===key);
  }
  function toggleFavorite(food){
    const clean=cleanFood(food);
    if(!clean?.name)return false;
    const store=readStore();
    const key=foodKey(clean);
    const index=store.favorites.findIndex(item=>foodKey(item)===key);
    if(index>=0)store.favorites.splice(index,1);
    else store.favorites.unshift(clean);
    store.favorites=store.favorites.slice(0,MAX_FAVORITES);
    const ok=writeStore(store);
    render();syncFavoriteButton();
    try{document.dispatchEvent(new CustomEvent('agenda:nutrition-quick-access-changed',{detail:{saved:ok}}))}catch(_){}
    return ok;
  }
  function recordRecent(food,quantity,unit='g',preparationState='unspecified'){
    const clean=cleanFood(food,quantity);
    if(!clean?.name)return;
    const q=num(quantity);
    clean.lastQuantity=Math.max(0.1,Math.min(1000000,q||clean.defaultQuantity||100));
    clean.defaultQuantity=clean.lastQuantity;
    clean.lastUnit=normalizeUnit(unit)||'g';
    clean.lastPreparationState=normalizePreparation(preparationState||food.preparationState||food.preparation_state);
    clean.lastUsedAt=new Date().toISOString();
    const store=readStore();
    const key=foodKey(clean);
    const previous=store.recent.find(item=>foodKey(item)===key);
    clean.useCount=Math.min(1000000,Math.max(0,Math.floor(num(previous?.useCount??previous?.use_count)))+1);
    store.recent=[clean,...store.recent.filter(item=>foodKey(item)!==key)].slice(0,MAX_RECENT);
    // Los favoritos reutilizan también la última cantidad válida del alimento.
    store.favorites=store.favorites.map(item=>foodKey(item)===key?{
      ...item,lastQuantity:clean.lastQuantity,defaultQuantity:clean.lastQuantity,lastUnit:clean.lastUnit,
      lastPreparationState:clean.lastPreparationState,lastUsedAt:clean.lastUsedAt,useCount:clean.useCount
    }:item).slice(0,MAX_FAVORITES);
    const saved=writeStore(store);
    render();
    try{document.dispatchEvent(new CustomEvent('agenda:nutrition-quick-access-changed',{detail:{saved}}))}catch(_){}
  }

  function resolveQuickAmount(food){
    if(!food||typeof food!=='object')return {ok:false,reason:'No se encontró un alimento válido.'};
    const missing=Array.isArray(food.nutritionMissing)?food.nutritionMissing:(Array.isArray(food.nutrition_missing)?food.nutrition_missing:[]);
    const quality=text(food.nutritionQualityStatus||food.nutrition_quality_status).toLowerCase();
    if(missing.length)return {ok:false,reason:`Faltan datos nutricionales de ${missing.map(String).join(', ')}. Revisalos antes de agregar este alimento.`};
    if(quality==='incomplete')return {ok:false,reason:'Este alimento está marcado con información nutricional incompleta. Revisá sus datos antes de agregarlo.'};
    const storedUnit=normalizeUnit(food.lastUnit||food.last_unit);
    let unit=storedUnit;
    let quantity;
    if(storedUnit){
      quantity=num(food.lastQuantity??food.last_quantity);
    }else if(!food.lastQuantity&&!food.last_quantity&&normalizeUnit(food.unit)==='g'){
      // Favoritos antiguos que nunca registraron una cantidad pueden usar su
      // cantidad predeterminada en gramos. Si existe una cantidad usada antes
      // pero no guardó su unidad, no la reinterpretamos silenciosamente.
      unit='g';quantity=num(food.defaultQuantity??food.servingQuantity??food.serving_quantity)||100;
    }else{
      // En datos de versiones anteriores, la cantidad puede haber sido ml/unidad
      // aunque no se guardara su unidad. El valor seguro es el preset explícito
      // de 100 g, no reinterpretar una cantidad ambigua como gramos.
      unit='g';quantity=100;
    }
    if(!unit)unit='g';
    if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000)return {ok:false,reason:'La última cantidad no es válida. Elegí una cantidad manualmente.'};
    const density=num(food.densityGPerMl??food.density_g_per_ml);
    const gramsPerUnit=num(food.gramsPerUnit??food.grams_per_unit);
    const gramsPerPortion=num(food.gramsPerPortion??food.grams_per_portion);
    if(unit==='ml'&&density<=0)return {ok:false,reason:'Este alimento no tiene densidad fiable para convertir ml a gramos.'};
    if(unit==='unit'&&gramsPerUnit<=0)return {ok:false,reason:'Este alimento no tiene equivalencia fiable de unidad a gramos.'};
    if(unit==='portion'&&gramsPerPortion<=0)return {ok:false,reason:'Este alimento no tiene equivalencia fiable de porción a gramos.'};
    if(!['g','ml','unit','portion'].includes(unit))return {ok:false,reason:'La unidad guardada ya no es compatible. Elegí la cantidad manualmente.'};
    return {ok:true,quantity,unit,preparationState:normalizePreparation(food.lastPreparationState||food.last_preparation_state||food.preparationState||food.preparation_state),label:`${fmt(quantity)} ${unitLabel(unit)}`};
  }

  function setQuickStatus(message){
    const host=$('nutritionFoodQuickStatus');
    if(host)host.textContent=message||'';
    const catalogStatus=$('nutritionFoodCatalogStatus');
    if(catalogStatus&&message)catalogStatus.textContent=message;
  }

  function quickAddFood(food,button){
    const amount=resolveQuickAmount(food);
    if(!amount.ok){
      selectFood(food);
      setQuickStatus(`No se agregó automáticamente. ${amount.reason} Podés revisar los datos y la cantidad en el formulario.`);
      return;
    }
    const picker=window.AgendaFoodCatalog?.select;
    if(typeof picker!=='function'){
      setQuickStatus('El formulario de alimentos todavía no está listo. Usá “Elegir cantidad” para continuar.');
      return;
    }
    const owner=accountId();
    let added=false;
    const key=foodKey(food);
    const onAdded=event=>{
      if(event.detail?.food&&foodKey(event.detail.food)===key)added=true;
    };
    document.addEventListener('agenda:nutrition-food-added',onAdded);
    if(button)button.disabled=true;
    try{
      picker(cleanFood(food,amount.quantity));
      const catalog=$('nutritionFoodCatalog');
      if(catalog?.hidden){const toggle=$('nutritionFoodCatalogToggle');if(toggle)toggle.click()}
      setTimeout(()=>{
        try{
          if(owner!==accountId()){
            setQuickStatus('Cambió la cuenta activa. No se agregó el alimento; abrí la comida de la cuenta correcta e intentá nuevamente.');
            return;
          }
          const qty=$('nutritionFoodQuantity');
          const unitSelect=$('nutritionFoodQuantityUnit');
          const prep=$('nutritionFoodPreparationState');
          const apply=$('nutritionFoodApply');
          if(!qty||!unitSelect||!prep||!apply){
            setQuickStatus('No se pudo abrir el formulario de registro rápido. Usá “Elegir cantidad” para continuar.');
            return;
          }
          const available=Array.from(unitSelect.options||[]).some(option=>option.value===amount.unit);
          if(!available){
            setQuickStatus('La unidad utilizada anteriormente ya no está disponible para este alimento. Revisá la cantidad manualmente.');
            qty.focus?.();qty.select?.();
            return;
          }
          unitSelect.value=amount.unit;
          unitSelect.dispatchEvent(new Event('change',{bubbles:true}));
          qty.value=String(amount.quantity);
          qty.dispatchEvent(new Event('input',{bubbles:true}));
          qty.dispatchEvent(new Event('change',{bubbles:true}));
          prep.value=amount.preparationState;
          prep.dispatchEvent(new Event('change',{bubbles:true}));
          if(apply.disabled){
            const reason=$('nutritionFoodCatalogStatus')?.textContent||'Los datos no cumplen las validaciones del formulario.';
            setQuickStatus(`No se agregó automáticamente. ${reason} Usá “Elegir cantidad” para revisar los datos.`);
            return;
          }
          apply.click();
          if(added){
            setQuickStatus(`✓ ${text(food.name)||'Alimento'} · ${amount.label} agregado al borrador de esta comida. Guardá la comida para conservar el cambio.`);
            render();
          }else{
            const reason=$('nutritionFoodCatalogStatus')?.textContent||'No se confirmó que el alimento se haya agregado.';
            setQuickStatus(`No se pudo confirmar el registro rápido. ${reason}`);
          }
        }catch(err){
          console.warn('Registro rápido de Alimentación:',err);
          setQuickStatus('Ocurrió un error al agregar el alimento. Revisá la selección y volvé a intentarlo.');
        }finally{
          document.removeEventListener('agenda:nutrition-food-added',onAdded);
          if(button&&!added)button.disabled=false;
        }
      },60);
    }catch(err){
      document.removeEventListener('agenda:nutrition-food-added',onAdded);
      if(button)button.disabled=false;
      console.warn('Registro rápido de Alimentación:',err);
      setQuickStatus('No se pudo iniciar el registro rápido. Usá “Elegir cantidad” para continuar.');
    }
  }

  function setTab(tab){
    activeTab=tab==='favorites'?'favorites':'recent';
    const recent=$('nutritionFoodRecentTab');
    const favorites=$('nutritionFoodFavoritesTab');
    if(recent){recent.classList.toggle('is-active',activeTab==='recent');recent.setAttribute('aria-selected',String(activeTab==='recent'));}
    if(favorites){favorites.classList.toggle('is-active',activeTab==='favorites');favorites.setAttribute('aria-selected',String(activeTab==='favorites'));}
    render();
  }
  function selectFood(food){
    const picker=window.AgendaFoodCatalog?.select;
    if(typeof picker!=='function')return;
    const clean=cleanFood(food,food?.lastQuantity||food?.defaultQuantity||food?.servingQuantity||100);
    picker(clean);
    const catalog=$('nutritionFoodCatalog');
    if(catalog?.hidden){const toggle=$('nutritionFoodCatalogToggle');if(toggle)toggle.click()}
    setTimeout(()=>{
      const qty=$('nutritionFoodQuantity');
      if(qty){qty.focus();qty.select?.()}
    },35);
  }
  function createCard(food,mode,store){
    const card=document.createElement('div');
    card.className='nutrition-food-quick-card';
    const main=document.createElement('button');
    main.type='button';main.className='nutrition-food-quick-main';
    const quickAmount=resolveQuickAmount(food);
    main.innerHTML=`<strong>${escapeHtml(food.name)}</strong>${food.brand?`<small>${escapeHtml(food.brand)}</small>`:''}<span>${escapeHtml(fmt(food.calories))} kcal · ${escapeHtml(fmt(food.protein))} P · ${escapeHtml(fmt(food.carbs))} C · ${escapeHtml(fmt(food.fat))} G / 100 g</span><em>${mode==='recent'&&food.lastUsedAt?'Última cantidad: ': 'Registro rápido: '}${escapeHtml(quickAmount.ok?quickAmount.label:'elegir cantidad')}</em>`;
    main.addEventListener('click',()=>selectFood(food));
    const actions=document.createElement('div');actions.className='nutrition-food-quick-actions';
    const use=document.createElement('button');use.type='button';use.className='nutrition-food-quick-use';use.textContent='Elegir cantidad';use.addEventListener('click',()=>selectFood(food));
    actions.appendChild(use);
    const quick=document.createElement('button');quick.type='button';quick.className='nutrition-food-quick-add';
    const amount=resolveQuickAmount(food);
    quick.textContent=amount.ok?`＋ Agregar ${amount.label}`:'＋ Revisar alimento';
    quick.setAttribute('aria-label',amount.ok?`Agregar ${food.name}, ${amount.label}, a la comida actual`:`Revisar ${food.name} antes de agregarlo`);
    quick.title=amount.ok?'Agrega al borrador actual con la última cantidad y unidad compatibles. Después tenés que guardar la comida.':amount.reason;
    quick.addEventListener('click',()=>quickAddFood(food,quick));
    actions.appendChild(quick);
    const fav=document.createElement('button');fav.type='button';fav.className='nutrition-food-quick-fav';
    const favorite=isFavorite(food,store);
    fav.textContent=mode==='favorites'?'Quitar':(favorite?'★ Favorito':'☆ Favorito');
    fav.setAttribute('aria-pressed',String(favorite));
    fav.addEventListener('click',()=>{
      toggleFavorite(food);
      if(mode==='favorites'&&activeTab==='favorites')render();
    });
    actions.appendChild(fav);
    card.append(main,actions);
    return card;
  }
  function render(){
    const host=$('nutritionFoodQuickList');
    if(!host)return;
    const store=getLists();
    const foods=activeTab==='favorites'?store.favorites:store.recent;
    host.innerHTML='';
    if(!foods.length){
      const empty=document.createElement('div');empty.className='nutrition-food-quick-empty';
      empty.textContent=activeTab==='favorites'
        ?'Todavía no hay favoritos. Seleccioná un alimento y tocá “Agregar a favoritos”, o guardá uno desde Recientes.'
        :'Todavía no hay alimentos recientes. Al agregar un alimento a una comida aparecerá acá para reutilizarlo rápido.';
      host.appendChild(empty);
    }else{
      foods.forEach(food=>host.appendChild(createCard(food,activeTab,store)));
    }
    syncFavoriteButton(store);
  }
  function syncFavoriteButton(store=getLists()){
    const button=$('nutritionFoodFavoriteToggle');
    if(!button)return;
    const food=window.AgendaFoodCatalog?.getSelectedFood?.()||selectedFood;
    if(!food){button.textContent='☆ Agregar a favoritos';button.setAttribute('aria-pressed','false');return}
    const favorite=isFavorite(food,store);
    button.textContent=favorite?'★ En favoritos · quitar':'☆ Agregar a favoritos';
    button.setAttribute('aria-pressed',String(favorite));
    button.title=favorite?'Quitar este alimento de favoritos':'Guardar este alimento en favoritos';
  }
  function bind(){
    $('nutritionFoodRecentTab')?.addEventListener('click',()=>setTab('recent'));
    $('nutritionFoodFavoritesTab')?.addEventListener('click',()=>setTab('favorites'));
    $('nutritionFoodFavoriteToggle')?.addEventListener('click',()=>{
      const food=window.AgendaFoodCatalog?.getSelectedFood?.();
      if(!food)return;
      toggleFavorite(food);
    });
    document.addEventListener('agenda:nutrition-food-added',event=>{
      if(event.detail?.food)recordRecent(event.detail.food,event.detail.quantity,event.detail.unit,event.detail.preparationState);
    });
    document.addEventListener('agenda:nutrition-selected-food-changed',event=>{
      selectedFood=event.detail?.food||null;
      syncFavoriteButton();
    });
    $('nutritionFoodCatalogToggle')?.addEventListener('click',()=>{setTimeout(render,0)});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
    window.addEventListener('storage',event=>{if(event.key===storageKey())render()});
    // Al cambiar de sesión, la app alterna la visibilidad del contenedor principal.
    // Volvemos a leer la clave de la cuenta activa antes de mostrar accesos guardados.
    const app=$('app');
    if(typeof MutationObserver==='function'){
      if(app){
        const appObserver=new MutationObserver(()=>{if(!app.classList.contains('hidden'))render()});
        appObserver.observe(app,{attributes:true,attributeFilter:['class']});
      }
      // También cubre un cambio de usuario sin transición visible entre pantallas.
      const userLabel=$('userEmail');
      if(userLabel){
        const userObserver=new MutationObserver(()=>{selectedFood=null;render()});
        userObserver.observe(userLabel,{childList:true,characterData:true,subtree:true});
      }
    }
    render();
  }

  window.AgendaNutritionShortcuts={refresh:render,recordRecent,toggleFavorite,isFavorite,resolveQuickAmount};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
