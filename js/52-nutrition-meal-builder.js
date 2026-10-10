(function(){
  'use strict';

  /*
   * Constructor estructurado de comidas.
   * Mantiene compatibilidad con las comidas antiguas y convierte la selección
   * de alimentos en cantidades + macros calculados automáticamente.
   */
  const $=id=>document.getElementById(id);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const text=v=>String(v??'').trim();
  let manualBackup=null;
  let bound=false;
  let editingMealId=null;
  let loadingRestore=false;
  let originalOpen=null;

  function provider(){return window.AgendaFoodCatalog||null}
  function getItems(){return provider()?.getPendingMealFoods?.()||[]}
  function setItems(items){const p=provider();p?.setPendingMealFoods?.(items);if(!p?.setPendingMealFoods?.__builderWrapped)render()}

  function macroTotal(items){
    return (Array.isArray(items)?items:[]).reduce((acc,item)=>{
      const qty=Math.max(0,num(item?.quantity)||0);
      const factor=qty/100;
      acc.calories+=num(item?.calories_per_100g)*factor;
      acc.protein+=num(item?.protein_per_100g)*factor;
      acc.carbs+=num(item?.carbs_per_100g)*factor;
      acc.fat+=num(item?.fat_per_100g)*factor;
      return acc;
    },{calories:0,protein:0,carbs:0,fat:0});
  }

  function round1(v){return Math.round(v*10)/10}
  function fmt(v){const n=round1(v);return Number.isInteger(n)?String(n):n.toFixed(1)}

  function syncSummary(items,totals){
    const foods=$('mealFoods');
    const calories=$('mealCalories'),protein=$('mealProtein'),carbs=$('mealCarbs'),fat=$('mealFat');
    const has=items.length>0;
    if(has){
      if(!manualBackup){
        manualBackup={calories:calories?.value??'',protein:protein?.value??'',carbs:carbs?.value??'',fat:fat?.value??''};
      }
      const summary=items.map(item=>`${text(item.name)||'Alimento'} · ${fmt(num(item.quantity)||0)} ${text(item.unit)||'g'}`).join(', ');
      if(foods){foods.value=summary;foods.readOnly=true;foods.classList.add('nutrition-auto-field');foods.title='Se genera automáticamente a partir de los alimentos cargados.';}
      if(calories)calories.value=fmt(totals.calories);
      if(protein)protein.value=fmt(totals.protein);
      if(carbs)carbs.value=fmt(totals.carbs);
      if(fat)fat.value=fmt(totals.fat);
      [calories,protein,carbs,fat].forEach(el=>{if(el){el.readOnly=true;el.classList.add('nutrition-auto-field');el.setAttribute('aria-readonly','true');}});
    }else{
      if(foods){foods.readOnly=false;foods.classList.remove('nutrition-auto-field');foods.removeAttribute('title');}
      [calories,protein,carbs,fat].forEach(el=>{if(el){el.readOnly=false;el.classList.remove('nutrition-auto-field');el.removeAttribute('aria-readonly');}});
      if(manualBackup){
        if(calories)calories.value=manualBackup.calories;
        if(protein)protein.value=manualBackup.protein;
        if(carbs)carbs.value=manualBackup.carbs;
        if(fat)fat.value=manualBackup.fat;
        manualBackup=null;
      }
    }
  }

  function renderTotals(items){
    const totalsHost=$('nutritionMealBuilderTotals');
    const totals=macroTotal(items);
    if(totalsHost)totalsHost.innerHTML=`
      <div><span>🔥 Calorías planificadas</span><strong>${fmt(totals.calories)} kcal</strong></div>
      <div><span>🥩 Proteínas</span><strong>${fmt(totals.protein)} g</strong></div>
      <div><span>🍚 Carbohidratos</span><strong>${fmt(totals.carbs)} g</strong></div>
      <div><span>🥑 Grasas</span><strong>${fmt(totals.fat)} g</strong></div>`;
    syncSummary(items,totals);
    return totals;
  }

  function previewQuantity(index,raw,row){
    if(String(raw??'').trim()===''){
      const preview=getItems().map((entry,i)=>i===index?{...entry,quantity:0}:entry);
      const totalNode=row?.querySelector('.nutrition-meal-builder-item-total-value');
      if(totalNode)totalNode.textContent='0 kcal';
      renderTotals(preview);
      return;
    }
    const qty=Number(raw);
    if(!Number.isFinite(qty)||qty<0)return;
    const preview=getItems().map((entry,i)=>i===index?{...entry,quantity:qty}:entry);
    const item=preview[index];
    const totalNode=row?.querySelector('.nutrition-meal-builder-item-total-value');
    if(totalNode)totalNode.textContent=`${fmt(num(item?.calories_per_100g)*qty/100)} kcal`;
    renderTotals(preview);
  }

  function render(){
    const host=$('nutritionMealBuilderList');
    const empty=$('nutritionMealBuilderEmpty');
    const status=$('nutritionMealBuilderStatus');
    if(!host||!$('nutritionMealBuilderTotals'))return;
    const items=getItems();
    host.innerHTML='';
    if(empty)empty.hidden=items.length>0;

    items.forEach((item,index)=>{
      const row=document.createElement('div');
      row.className='nutrition-meal-builder-item';
      row.innerHTML=`
        <div class="nutrition-meal-builder-item-main">
          <div class="nutrition-meal-builder-item-name">${esc(item.name||'Alimento')}</div>
          ${item.brand?`<div class="nutrition-meal-builder-item-brand">${esc(item.brand)}</div>`:''}
          <div class="nutrition-meal-builder-item-macros">
            <span>${fmt(num(item.calories_per_100g))} kcal/100</span>
            <span>${fmt(num(item.protein_per_100g))} P</span>
            <span>${fmt(num(item.carbs_per_100g))} C</span>
            <span>${fmt(num(item.fat_per_100g))} G</span>
          </div>
        </div>
        <div class="nutrition-meal-builder-item-qty">
          <label>Cantidad</label>
          <div class="nutrition-meal-builder-qty-wrap"><input class="input nutrition-meal-builder-qty" type="number" min="0.1" step="0.1" inputmode="decimal" value="${esc(fmt(num(item.quantity)||100))}" data-index="${index}"/><span>${esc(text(item.unit)||'g')}</span></div>
        </div>
        <div class="nutrition-meal-builder-item-total">
          <span>Total</span>
          <strong class="nutrition-meal-builder-item-total-value"></strong>
          <label class="nutrition-meal-consumed-toggle"><input type="checkbox" class="nutrition-meal-builder-consumed" data-index="${index}" ${item.consumed?'checked':''}><span>Consumido</span></label>
        </div>
        <div class="nutrition-meal-builder-item-actions">
          <button type="button" class="nutrition-meal-builder-duplicate" data-index="${index}" aria-label="Duplicar ${esc(item.name||'alimento')}" title="Duplicar alimento">⧉</button>
          <button type="button" class="nutrition-meal-builder-remove" data-index="${index}" aria-label="Quitar ${esc(item.name||'alimento')}" title="Quitar alimento">×</button>
        </div>`;
      const totalNode=row.querySelector('.nutrition-meal-builder-item-total-value');
      const factor=Math.max(0,num(item.quantity)||0)/100;
      const itemTotal=num(item.calories_per_100g)*factor;
      if(totalNode)totalNode.textContent=`${fmt(itemTotal)} kcal`;
      const qtyInput=row.querySelector('.nutrition-meal-builder-qty');
      qtyInput?.addEventListener('input',event=>previewQuantity(index,event.target.value,row));
      qtyInput?.addEventListener('change',event=>{
        const raw=String(event.target.value??'').trim();
        const parsed=Number(raw);
        const quantity=raw!==''&&Number.isFinite(parsed)&&parsed>0?parsed:0.1;
        event.target.value=fmt(quantity);
        const nextItems=getItems().map((entry,i)=>i===index?{...entry,quantity}:entry);
        setItems(nextItems);
      });
      row.querySelector('.nutrition-meal-builder-duplicate')?.addEventListener('click',()=>{
        const current=getItems();
        const entry=current[index];
        if(!entry)return;
        const copy={...entry,consumed:false,consumed_at:null};
        const nextItems=[...current.slice(0,index+1),copy,...current.slice(index+1)];
        setItems(nextItems);
      });
      row.querySelector('.nutrition-meal-builder-remove')?.addEventListener('click',()=>{
        const nextItems=getItems().filter((_,i)=>i!==index);
        setItems(nextItems);
      });
      row.querySelector('.nutrition-meal-builder-consumed')?.addEventListener('change',event=>{
        const checked=!!event.target.checked;
        const nextItems=getItems().map((entry,i)=>i===index?{...entry,consumed:checked,consumed_at:checked?new Date().toISOString():null}:entry);
        setItems(nextItems);
      });
      host.appendChild(row);
    });

    renderTotals(items);
    if(status){
      status.textContent=loadingRestore?'Cargando los alimentos guardados de esta comida…':items.length?`${items.length} alimento${items.length===1?'':'s'} · macros calculados automáticamente`:'Agregá alimentos para calcular la comida automáticamente.';
      status.classList.toggle('is-loading',loadingRestore);
      status.classList.toggle('is-ready',!loadingRestore&&items.length>0);
    }
  }

  function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}

  function setLoading(isLoading){
    loadingRestore=!!isLoading;
    const save=$('saveMealBtn');
    if(save){
      if(isLoading){save.dataset.nutritionBuilderPrevText=save.textContent||'Guardar comida';save.disabled=true;save.textContent='Cargando alimentos…';}
      else{save.disabled=false;save.textContent=save.dataset.nutritionBuilderPrevText||'Guardar comida';}
    }
    render();
  }

  function openAddFood(){
    const toggle=$('nutritionFoodCatalogToggle');
    if(toggle){toggle.click();setTimeout(()=>$('nutritionFoodSearch')?.focus(),40)}
  }

  function resetState(){
    manualBackup=null;
    editingMealId=null;
    loadingRestore=false;
    try{provider()?.clearPendingMealFoods?.()}catch(_){}
    render();
  }

  function bind(){
    if(bound)return;
    const host=$('nutritionMealBuilderList');
    if(!host)return;
    bound=true;
    $('nutritionMealBuilderAdd')?.addEventListener('click',openAddFood);
    $('nutritionMealBuilderClear')?.addEventListener('click',()=>setItems([]));
    document.addEventListener('agenda:nutrition-pending-foods-changed',()=>render());
    document.addEventListener('agenda:nutrition-meal-items-restored',event=>{
      if(editingMealId&&event.detail?.mealId&&String(event.detail.mealId)!==String(editingMealId))return;
      loadingRestore=false;
      render();
      const save=$('saveMealBtn');if(save)save.disabled=false;
    });

    const p=provider();
    if(p?.setPendingMealFoods&&!p.setPendingMealFoods.__builderWrapped){
      const originalSet=p.setPendingMealFoods;
      const wrapped=function(items){originalSet.call(p,items);render()};
      wrapped.__builderWrapped=true;
      p.setPendingMealFoods=wrapped;
    }

    const currentOpen=window.openNutritionModal;
    if(typeof currentOpen==='function'&&!currentOpen.__builderWrapped){
      originalOpen=currentOpen;
      const wrappedOpen=function(meal=null){
        resetState();
        editingMealId=meal?.id||null;
        setLoading(!!meal?.id);
        originalOpen(meal);
        setTimeout(render,0);
      };
      wrappedOpen.__builderWrapped=true;
      window.openNutritionModal=wrappedOpen;
    }

    if(document.readyState!=='loading')setTimeout(render,30);
  }

  function init(){bind()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
