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

  function safeNumber(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}

  function normalize(item){
    if(!item||typeof item!=='object')return null;
    const n=item.nutrients||item.nutrition||item;
    return {
      id:String(item.id||item.code||item.gtin||item.barcode||item._id||''),
      name:String(item.name||item.product_name||item.product_name_es||item.title||'Alimento'),
      brand:String(item.brand||item.brands||''),
      quantityBase:safeNumber(item.quantityBase||item.serving_size_g||item.serving_quantity||100)||100,
      unit:String(item.unit||'g'),
      calories:safeNumber(n.calories||n.energy_kcal||n['energy-kcal_100g']),
      protein:safeNumber(n.protein||n.proteins||n.proteins_g||n['proteins_100g']),
      carbs:safeNumber(n.carbs||n.carbohydrates||n.carbs_g||n['carbohydrates_100g']),
      fat:safeNumber(n.fat||n.fat_g||n['fat_100g']),
      source:String(item.source||'Catálogo externo')
    };
  }

  function calc(item,amount){
    const f=normalize(item); if(!f)return null;
    const qty=safeNumber(amount)||f.quantityBase||100;
    const factor=qty/(f.quantityBase||100);
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
      const brand=food.brand?` · ${esc(food.brand)}`:'';
      b.innerHTML=`<span class="nutrition-food-result-main"><span class="nutrition-food-result-title">${esc(food.name)}</span><span class="nutrition-food-result-sub">Base: ${esc(food.quantityBase)} ${esc(food.unit)}${brand}</span></span><span class="nutrition-food-result-tag">${esc(food.source)}</span>`;
      b.addEventListener('click',()=>selectFood(food));
      host.appendChild(b);
    });
  }

  function renderSelected(){
    const box=$('nutritionFoodSelected'); if(!box)return;
    const apply=$('nutritionFoodApply');
    if(!selectedFood){box.hidden=true;if(apply)apply.hidden=true;return}
    box.hidden=false;
    const qtyEl=$('nutritionFoodQuantity');
    const qty=safeNumber(qtyEl?.value)||selectedFood.quantityBase||100;
    const totals=calc(selectedFood,qty);
    box.innerHTML=`<strong>✅ ${esc(selectedFood.name)}</strong><small>${qty} ${esc(selectedFood.unit)} · ${totals.calories} kcal · ${totals.protein} g proteína · ${totals.carbs} g carbos · ${totals.fat} g grasas</small>`;
    if(apply)apply.hidden=false;
  }

  function selectFood(food){selectedFood=normalize(food);const q=$('nutritionFoodQuantity');if(q)q.value=selectedFood.quantityBase||100;setStatus('Alimento seleccionado. Ajustá la cantidad y aplicalo al formulario.');renderSelected()}

  function applySelected(){
    if(!selectedFood)return;
    const qty=safeNumber($('nutritionFoodQuantity')?.value)||selectedFood.quantityBase||100;
    const totals=calc(selectedFood,qty); if(!totals)return;
    const title=$('mealTitle'),foods=$('mealFoods');
    if(title&&!title.value.trim())title.value=selectedFood.name;
    if(foods){
      const suffix=`${selectedFood.name} · ${qty} ${selectedFood.unit}`;
      foods.value=foods.value.trim()?`${foods.value.trim()}, ${suffix}`:suffix;
    }
    const set=(id,val)=>{const el=$(id);if(el)el.value=val};
    set('mealCalories',totals.calories);set('mealProtein',totals.protein);set('mealCarbs',totals.carbs);set('mealFat',totals.fat);
    setStatus('Datos aplicados al formulario. Podés modificarlos antes de guardar.');
  }

  async function onFind(){
    const q=$('nutritionFoodSearch')?.value.trim()||'';
    if(!q){setStatus('Escribí un alimento para buscar.');renderResults([]);return}
    setStatus('La interfaz ya está lista para recibir resultados de Open Food Facts.');
    renderResults([]);
    /*
     * Punto único de integración futura:
     * window.AgendaFoodCatalog.search(q) debe devolver una lista de items.
     */
    try{
      const external=await Promise.resolve(window.AgendaFoodCatalog?.search?.(q));
      if(Array.isArray(external)){
        setStatus(external.length?`${external.length} resultados encontrados.`:'No encontré resultados.');
        renderResults(external);
      }
    }catch(err){console.warn('Catálogo de alimentos:',err);setStatus('No se pudo consultar el catálogo.');}
  }

  function open(){expanded=true;const panel=$('nutritionFoodCatalog');if(panel)panel.hidden=false;const toggle=$('nutritionFoodCatalogToggle');if(toggle)toggle.setAttribute('aria-expanded','true');if(!$('nutritionFoodSearch')?.value)setStatus('Preparado para conectar el catálogo externo.');}
  function close(){expanded=false;const panel=$('nutritionFoodCatalog');if(panel)panel.hidden=true;const toggle=$('nutritionFoodCatalogToggle');if(toggle)toggle.setAttribute('aria-expanded','false');}
  function toggle(){expanded?close():open()}
  function reset(){selectedFood=null;const q=$('nutritionFoodSearch');if(q)q.value='';const qty=$('nutritionFoodQuantity');if(qty)qty.value=100;const results=$('nutritionFoodCatalogResults');if(results)results.innerHTML='';setStatus('Preparado para conectar el catálogo externo.');renderSelected()}

  function bind(){
    const toggleBtn=$('nutritionFoodCatalogToggle');if(toggleBtn&&!toggleBtn.dataset.bound){toggleBtn.dataset.bound='1';toggleBtn.addEventListener('click',toggle)}
    const find=$('nutritionFoodCatalogFind');if(find&&!find.dataset.bound){find.dataset.bound='1';find.addEventListener('click',onFind)}
    const search=$('nutritionFoodSearch');if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();onFind()}})}
    const qty=$('nutritionFoodQuantity');if(qty&&!qty.dataset.bound){qty.dataset.bound='1';qty.addEventListener('input',renderSelected)}
    const apply=$('nutritionFoodApply');if(apply&&!apply.dataset.bound){apply.dataset.bound='1';apply.addEventListener('click',applySelected)}
    if(typeof window.openNutritionModal==='function'&&!window.openNutritionModal.__foodCatalogWrapped){
      const original=window.openNutritionModal;
      const wrapped=function(meal=null){original(meal);reset()};
      wrapped.__foodCatalogWrapped=true;window.openNutritionModal=wrapped;
    }
    window.AgendaFoodCatalog={
      normalize,
      calculate:calc,
      renderResults,
      select:selectFood,
      search:window.AgendaFoodCatalog?.search||null,
      ready:true
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
