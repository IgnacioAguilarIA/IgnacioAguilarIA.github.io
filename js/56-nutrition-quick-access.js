/* Agenda FICH — accesos rápidos de Alimentación.
   Favoritos y recientes separados por usuario y limitados a este navegador.
   Este módulo no modifica rutinas ni persistencia de Entrenamiento. */
(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const MAX_RECENT=10;
  const KEY_PREFIX='agenda-nutrition-quick-access-v1:';
  let activeTab='recent';
  let selectedFood=null;

  function text(v){return String(v??'').trim()}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function fmt(v){const n=Math.round(num(v)*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1)}
  function escapeHtml(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
  function normalize(v){return text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}

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
      return {version:1,favorites:Array.isArray(parsed?.favorites)?parsed.favorites:[],recent:Array.isArray(parsed?.recent)?parsed.recent:[]};
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
      isGeneric:food.isGeneric!==false&&food.is_generic!==false
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
    const ok=writeStore(store);
    render();syncFavoriteButton();
    try{document.dispatchEvent(new CustomEvent('agenda:nutrition-quick-access-changed',{detail:{saved:ok}}))}catch(_){}
    return ok;
  }
  function recordRecent(food,quantity){
    const clean=cleanFood(food,quantity);
    if(!clean?.name)return;
    clean.lastQuantity=Math.max(0.1,num(quantity)||clean.defaultQuantity||100);
    clean.defaultQuantity=clean.lastQuantity;
    const store=readStore();
    const key=foodKey(clean);
    store.recent=[clean,...store.recent.filter(item=>foodKey(item)!==key)].slice(0,MAX_RECENT);
    const saved=writeStore(store);
    render();
    try{document.dispatchEvent(new CustomEvent('agenda:nutrition-quick-access-changed',{detail:{saved}}))}catch(_){}
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
    main.innerHTML=`<strong>${escapeHtml(food.name)}</strong>${food.brand?`<small>${escapeHtml(food.brand)}</small>`:''}<span>${escapeHtml(fmt(food.calories))} kcal · ${escapeHtml(fmt(food.protein))} P · ${escapeHtml(fmt(food.carbs))} C · ${escapeHtml(fmt(food.fat))} G / 100 g</span>${mode==='recent'?`<em>Última cantidad: ${escapeHtml(fmt(food.lastQuantity||food.defaultQuantity||100))} ${escapeHtml(food.unit||'g')}</em>`:''}`;
    main.addEventListener('click',()=>selectFood(food));
    const actions=document.createElement('div');actions.className='nutrition-food-quick-actions';
    const use=document.createElement('button');use.type='button';use.className='nutrition-food-quick-use';use.textContent='Usar';use.addEventListener('click',()=>selectFood(food));
    actions.appendChild(use);
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
      if(event.detail?.food)recordRecent(event.detail.food,event.detail.quantity);
    });
    document.addEventListener('agenda:nutrition-selected-food-changed',event=>{
      selectedFood=event.detail?.food||null;
      syncFavoriteButton();
    });
    $('nutritionFoodCatalogToggle')?.addEventListener('click',()=>{setTimeout(render,0)});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
    window.addEventListener('storage',event=>{if(event.key===storageKey())render()});
    render();
  }

  window.AgendaNutritionShortcuts={refresh:render,recordRecent,toggleFavorite,isFavorite};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
