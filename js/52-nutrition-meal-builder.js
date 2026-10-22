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
  function grams(item,quantity=item?.quantity){return window.AgendaNutritionData?.weightInGrams?window.AgendaNutritionData.weightInGrams(item,quantity):(String(item?.unit||'g')==='g'?Math.max(0,num(quantity)):null)}
  function getItems(){return provider()?.getPendingMealFoods?.()||[]}
  function setItems(items){const p=provider();p?.setPendingMealFoods?.(items);if(!p?.setPendingMealFoods?.__builderWrapped)render()}

  const MACRO_KEYS=['calories','protein','carbs','fat'];
  const MACRO_LABELS={calories:'calorías',protein:'proteínas',carbs:'carbohidratos',fat:'grasas'};
  function missingMetrics(item){
    try{
      const data=window.AgendaNutritionData;
      if(typeof data?.missingMacroMetrics==='function')return data.missingMacroMetrics(item);
    }catch(_){}
    const fields=Array.isArray(item?.nutrition_missing_fields)?item.nutrition_missing_fields:(Array.isArray(item?.nutritionMissing)?item.nutritionMissing:[]);
    const normalized=fields.map(value=>text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim());
    const aliases={calories:['caloria','calorias','calorie','calories','energy','kcal'],protein:['proteina','proteinas','protein','proteins'],carbs:['carbohidrato','carbohidratos','carbohydrate','carbohydrates','carbs'],fat:['grasa','grasas','fat','fats']};
    if(String(item?.nutrition_quality_status||item?.nutritionQualityStatus||'').toLowerCase()==='incomplete'&&!fields.length)return [...MACRO_KEYS];
    return MACRO_KEYS.filter(key=>normalized.some(name=>aliases[key].some(alias=>name===alias||name.startsWith(alias+' ')||name.includes(' '+alias+' ')||name.endsWith(' '+alias))));
  }

  function macroTotal(items){
    const totals={calories:0,protein:0,carbs:0,fat:0,unconvertible:[],unknownMetrics:[]};
    const unknown=new Set();
    (Array.isArray(items)?items:[]).forEach(item=>{
      const weight=grams(item);
      if(weight===null){
        totals.unconvertible.push(text(item?.name)||'Alimento');
        MACRO_KEYS.forEach(key=>unknown.add(key));
        return;
      }
      const factor=weight/100;
      missingMetrics(item).forEach(key=>{if(MACRO_KEYS.includes(key))unknown.add(key)});
      totals.calories+=num(item?.calories_per_100g)*factor;
      totals.protein+=num(item?.protein_per_100g)*factor;
      totals.carbs+=num(item?.carbs_per_100g)*factor;
      totals.fat+=num(item?.fat_per_100g)*factor;
    });
    totals.unknownMetrics=[...unknown];
    return totals;
  }
  // API pequeña para que las reglas de cálculo puedan probarse sin abrir Supabase.
  window.AgendaNutritionMealBuilderMath={macroTotal,missingMetrics};

  function round1(v){return Math.round(v*10)/10}
  function fmt(v){const n=round1(v);return Number.isInteger(n)?String(n):n.toFixed(1)}

  function syncSummary(items,totals){
    const foods=$('mealFoods');
    const fields={calories:$('mealCalories'),protein:$('mealProtein'),carbs:$('mealCarbs'),fat:$('mealFat')};
    const has=items.length>0;
    if(has){
      if(!manualBackup){
        manualBackup=Object.fromEntries(Object.entries(fields).map(([key,el])=>[key,el?.value??'']));
      }
      const summary=items.map(item=>`${text(item.name)||'Alimento'} · ${fmt(num(item.quantity)||0)} ${text(item.unit)||'g'}`).join(', ');
      if(foods){foods.value=summary;foods.readOnly=true;foods.classList.add('nutrition-auto-field');foods.title='Se genera automáticamente a partir de los alimentos cargados.';}
      Object.entries(fields).forEach(([key,el])=>{
        if(!el)return;
        const incomplete=totals.unknownMetrics.includes(key);
        el.value=incomplete?'':fmt(totals[key]);
        el.dataset.nutritionValueStatus=incomplete?'incomplete':'calculated';
        el.classList.toggle('nutrition-data-incomplete',incomplete);
        el.title=incomplete?`No se puede calcular ${MACRO_LABELS[key]} con certeza porque al menos un alimento no informa ese nutriente.`:'Calculado a partir de los alimentos de esta comida.';
        el.setAttribute('aria-label',incomplete?`${MACRO_LABELS[key]}: dato incompleto`:`${MACRO_LABELS[key]} calculadas: ${el.value}`);
        el.readOnly=true;el.classList.add('nutrition-auto-field');el.setAttribute('aria-readonly','true');
      });
    }else{
      if(foods){foods.readOnly=false;foods.classList.remove('nutrition-auto-field');foods.removeAttribute('title');}
      Object.entries(fields).forEach(([key,el])=>{if(el){el.readOnly=false;el.classList.remove('nutrition-auto-field','nutrition-data-incomplete');el.removeAttribute('aria-readonly');el.removeAttribute('title');el.removeAttribute('aria-label');delete el.dataset.nutritionValueStatus;}});
      if(manualBackup){
        Object.entries(fields).forEach(([key,el])=>{if(el)el.value=manualBackup[key]??'';});
        manualBackup=null;
      }
    }
  }

  function renderTotals(items){
    const totalsHost=$('nutritionMealBuilderTotals');
    const totals=macroTotal(items);
    const cards=[
      ['calories','🔥 Calorías','kcal'],['protein','🥩 Proteínas','g'],['carbs','🍚 Carbohidratos','g'],['fat','🥑 Grasas','g']
    ];
    if(totalsHost)totalsHost.innerHTML=cards.map(([key,label,unit])=>{
      const incomplete=totals.unknownMetrics.includes(key);
      return `<div class="${incomplete?'has-incomplete-value':''}"><span>${label}</span><strong${incomplete?' class="nutrition-incomplete-value" title="Hay al menos un alimento sin este dato nutricional."':''}>${incomplete?'Dato incompleto':`${fmt(totals[key])} ${unit}`}</strong></div>`;
    }).join('')+
      `${totals.unknownMetrics.length?`<div class="nutrition-data-incomplete-warning" role="note"><strong>Totales parciales no presentados como exactos.</strong><span>Faltan datos de ${esc(totals.unknownMetrics.map(key=>MACRO_LABELS[key]).join(', '))}. Revisá los alimentos señalados; esos nutrientes no se cuentan como cero.</span></div>`:''}`+
      `${totals.unconvertible.length?`<div class="nutrition-unit-warning" role="alert">No se puede convertir con fiabilidad: ${esc(totals.unconvertible.join(', '))}. Elegí gramos o definí su equivalencia en Mis alimentos.</div>`:''}`;
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
    const weight=grams(item,qty);
    if(totalNode)totalNode.textContent=weight===null?'Revisar unidad':(missingMetrics(item).includes('calories')?'Dato incompleto':`${fmt(num(item?.calories_per_100g)*weight/100)} kcal`);
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
      const itemMissing=missingMetrics(item);
      const macroField={calories:'calories_per_100g',protein:'protein_per_100g',carbs:'carbs_per_100g',fat:'fat_per_100g'};
      const macroChip=(key,label,unit)=>itemMissing.includes(key)
        ? `<span class="nutrition-item-macro-missing" title="Este dato no fue informado por la fuente.">${label}: dato faltante</span>`
        : `<span>${label}: ${fmt(num(item[macroField[key]]))} ${unit}/100 g</span>`;
      const sourceLabel=text(item.data_source_label||item.sourceLabel||item.source||item.recordSource);
      row.innerHTML=`
        <div class="nutrition-meal-builder-item-main">
          <div class="nutrition-meal-builder-item-name">${esc(item.name||'Alimento')}</div>
          ${item.preparation_state&&item.preparation_state!=='unspecified'?`<span class="nutrition-food-preparation-mini">${item.preparation_state==='raw'?'Crudo':item.preparation_state==='cooked'?'Cocido':'Preparado'}</span>`:''}
          ${item.brand?`<div class="nutrition-meal-builder-item-brand">${esc(item.brand)}</div>`:''}
          ${sourceLabel?`<div class="nutrition-meal-builder-item-source">Procedencia: ${esc(sourceLabel)}</div>`:''}
          <div class="nutrition-meal-builder-item-macros">
            ${macroChip('calories','Calorías','kcal')}
            ${macroChip('protein','Proteínas','g')}
            ${macroChip('carbs','Carbohidratos','g')}
            ${macroChip('fat','Grasas','g')}
          </div>
          ${itemMissing.length?`<div class="nutrition-meal-builder-item-quality" role="note">Datos nutricionales incompletos: ${esc(itemMissing.map(key=>MACRO_LABELS[key]).join(', '))}. No se interpretan como cero.</div>`:''}
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
      const weight=grams(item);
      if(totalNode)totalNode.textContent=weight===null?'Revisar unidad':(itemMissing.includes('calories')?'Dato incompleto':`${fmt(num(item.calories_per_100g)*weight/100)} kcal`);
      const qtyInput=row.querySelector('.nutrition-meal-builder-qty');
      qtyInput?.addEventListener('input',event=>previewQuantity(index,event.target.value,row));
      qtyInput?.addEventListener('change',event=>{
        const raw=String(event.target.value??'').trim();
        const parsed=Number(raw);
        const quantity=raw!==''&&Number.isFinite(parsed)&&parsed>0?parsed:0.1;
        event.target.value=fmt(quantity);
        const nextItems=getItems().map((entry,i)=>{if(i!==index)return entry;const quantityInGrams=grams(entry,quantity);return {...entry,quantity,quantity_in_grams:quantityInGrams===null?entry.quantity_in_grams:Math.round(quantityInGrams*1000)/1000}});
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
    const invalidItems=items.filter(item=>grams(item)===null);
    const totals=macroTotal(items);
    if(status){
      status.textContent=loadingRestore?'Cargando los alimentos guardados de esta comida…':invalidItems.length?`Hay ${invalidItems.length} alimento(s) sin una conversión fiable a gramos. Corregilos antes de guardar.`:totals.unknownMetrics.length?`${items.length} alimento${items.length===1?'':'s'} · faltan datos de ${totals.unknownMetrics.map(key=>MACRO_LABELS[key]).join(', ')}. Los totales afectados no se cuentan como cero.`:items.length?`${items.length} alimento${items.length===1?'':'s'} · cantidades convertidas a gramos para calcular los macros`:'Agregá alimentos para calcular la comida automáticamente.';
      status.classList.toggle('is-loading',loadingRestore);
      status.classList.toggle('is-ready',!loadingRestore&&items.length>0&&!invalidItems.length&&!totals.unknownMetrics.length);
      status.classList.toggle('has-unit-error',invalidItems.length>0);
      status.classList.toggle('has-data-warning',!loadingRestore&&totals.unknownMetrics.length>0);
    }
    const save=$('saveMealBtn');if(save){save.disabled=loadingRestore||invalidItems.length>0;save.title=invalidItems.length?'Corregí las unidades sin equivalencia a gramos antes de guardar.':'';}
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
