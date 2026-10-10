/* Agenda FICH — Etapa 4 de Alimentación: alimentos propios, recetas e historial real.
   Este módulo solo interactúa con los módulos nutricionales; no modifica Entrenamiento. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const txt=v=>String(v??'').trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const esc=v=>{const d=document.createElement('div');d.textContent=v??'';return d.innerHTML};
  const fmt=v=>{const n=Math.round(num(v)*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1)};
  let historyDays=30;
  let modalTrigger=null;
  let previousBodyOverflow='';

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
    overlay.innerHTML=`<section class="nutrition-advanced-modal" role="dialog" aria-modal="true" aria-labelledby="nutritionAdvancedTitle"><header class="nutrition-advanced-head"><div><h3 id="nutritionAdvancedTitle">${esc(title)}</h3><p>${esc(subtitle)}</p></div><button type="button" class="nutrition-advanced-close" id="nutritionAdvancedClose" aria-label="Cerrar ventana">×</button></header><div class="nutrition-advanced-body" id="nutritionAdvancedBody"></div></section>`;
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
  function customFoodModal(){
    mountModal('＋ Crear alimento propio','Cargá los valores nutricionales por 100 g. Se guardará en Mis alimentos, separado por cuenta.',`
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
        </div>
        <p class="nutrition-advanced-note">Ingresá los valores por 100 g, no por la porción completa. La cantidad que uses en una comida se calcula aparte.</p>
        <div class="nutrition-advanced-status" id="nutritionCustomFoodStatus" role="status" aria-live="polite"></div>
        <div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cancelar</button><button type="submit" class="nutrition-advanced-primary" id="nutritionCustomFoodSave">Guardar alimento</button></div>
      </form>`);
    $('nutritionCustomFoodName')?.focus();
    document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    $('nutritionCustomFoodForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const status=$('nutritionCustomFoodStatus'),save=$('nutritionCustomFoodSave');
      const name=txt($('nutritionCustomFoodName')?.value);
      const values={calories:num($('nutritionCustomFoodCalories')?.value),protein:num($('nutritionCustomFoodProtein')?.value),carbs:num($('nutritionCustomFoodCarbs')?.value),fat:num($('nutritionCustomFoodFat')?.value),fiber:num($('nutritionCustomFoodFiber')?.value)};
      if(!name){if(status)status.textContent='Ingresá un nombre.';return}
      if(Object.values(values).some(v=>v<0)||values.protein>100||values.carbs>100||values.fat>100||values.fiber>100||values.calories>1000||values.protein+values.carbs+values.fat>100.5){if(status)status.textContent='Revisá los valores por 100 g: no pueden ser negativos, superar los límites ni sumar más de 100 g entre proteínas, carbohidratos y grasas.';return}
      if(!data()?.saveUserFood){if(status)status.textContent='La persistencia nutricional todavía no está disponible.';return}
      if(save){save.disabled=true;save.textContent='Guardando…'}
      try{
        const customKey=(value)=>txt(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'alimento';
        const food={name,brand:txt($('nutritionCustomFoodBrand')?.value),source:'Alimento personalizado',sourceType:'custom',externalId:`custom-${customKey(name)}-${customKey($('nutritionCustomFoodBrand')?.value||'sin-marca')}`,unit:'g',defaultQuantity:Math.max(.1,num($('nutritionCustomFoodServing')?.value)||100),servingQuantity:Math.max(.1,num($('nutritionCustomFoodServing')?.value)||100),servingSize:'Porción habitual',calories:values.calories,protein:values.protein,carbs:values.carbs,fat:values.fat,fiber:values.fiber,isGeneric:false,ingredients:'',categories:'Personalizado',labels:'',imageUrl:''};
        const result=await data().saveUserFood(food);
        if(!result?.ok)throw new Error('Supabase no confirmó el guardado. Revisá la conexión y las migraciones de catálogo.');
        closeModal();foods()?.select?.(result.food||food);
        const panel=$('nutritionFoodCatalog');if(panel?.hidden)$('nutritionFoodCatalogToggle')?.click();
        if($('nutritionFoodCatalogStatus'))$('nutritionFoodCatalogStatus').textContent=`✓ ${name} guardado en Mis alimentos. Ajustá la cantidad y agregalo a la comida.`;
        notify(`Alimento propio guardado: ${name}`,'success');
      }catch(err){console.warn('Alimento personalizado:',err);if(status)status.textContent=`No se pudo guardar: ${err?.message||'error desconocido'}`;if(save){save.disabled=false;save.textContent='Guardar alimento'}}
    });
  }

  function recipeTotals(items){
    if(data()?.calculateRecipe)return data().calculateRecipe(items);
    const weight=(items||[]).reduce((s,x)=>s+Math.max(0,num(x.quantity)),0);
    const total=(items||[]).reduce((a,x)=>{const f=Math.max(0,num(x.quantity))/100;a.calories+=num(x.calories_per_100g)*f;a.protein+=num(x.protein_per_100g)*f;a.carbs+=num(x.carbs_per_100g)*f;a.fat+=num(x.fat_per_100g)*f;return a},{calories:0,protein:0,carbs:0,fat:0});
    const factor=weight?100/weight:0;return {total_weight_g:weight,calories_per_100g:total.calories*factor,protein_per_100g:total.protein*factor,carbs_per_100g:total.carbs*factor,fat_per_100g:total.fat*factor,total_calories:total.calories,total_protein_g:total.protein,total_carbs_g:total.carbs,total_fat_g:total.fat};
  }
  function saveRecipeModal(){
    const list=pendingFoods().filter(x=>num(x.quantity)>0);
    if(!list.length){notify('Agregá al menos un alimento a la comida antes de guardarla como receta.','warning');return}
    const total=recipeTotals(list);
    mountModal('📖 Guardar comida como receta','La receta conserva ingredientes y cantidades. Después podés agregar porciones a cualquier comida.',`
      <form id="nutritionRecipeSaveForm" class="nutrition-advanced-form">
        <div class="nutrition-advanced-recipe-preview"><strong>${list.length} ingrediente${list.length===1?'':'s'} · ${fmt(total.total_weight_g)} g en total</strong><span>${fmt(total.total_calories)} kcal · P ${fmt(total.total_protein_g)} g · C ${fmt(total.total_carbs_g)} g · G ${fmt(total.total_fat_g)} g para toda la preparación</span></div>
        <div class="field"><label for="nutritionRecipeName">Nombre de la receta *</label><input class="input" id="nutritionRecipeName" maxlength="120" required autocomplete="off" placeholder="Ej.: Avena con yogur y banana"></div>
        <div class="field"><label for="nutritionRecipeNotes">Notas o preparación</label><textarea class="input" id="nutritionRecipeNotes" rows="2" maxlength="1000" placeholder="Opcional"></textarea></div>
        <div class="field"><label for="nutritionRecipeServings">¿Cuántas porciones rinde?</label><input class="input" id="nutritionRecipeServings" type="number" min="0.1" max="1000" step="0.1" value="1" required><small>Se usa para calcular cuánto ingrediente agregar al elegir una porción.</small></div>
        <p class="nutrition-advanced-note">Los macros se calculan a partir de los ingredientes cargados y sus cantidades, usando los valores por 100 g.</p>
        <div class="nutrition-advanced-status" id="nutritionRecipeSaveStatus" role="status" aria-live="polite"></div>
        <div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cancelar</button><button type="submit" class="nutrition-advanced-primary" id="nutritionRecipeSaveBtn">Guardar receta</button></div>
      </form>`);
    $('nutritionRecipeName')?.focus();document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    $('nutritionRecipeSaveForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const status=$('nutritionRecipeSaveStatus'),btn=$('nutritionRecipeSaveBtn');
      const name=txt($('nutritionRecipeName')?.value),servings=num($('nutritionRecipeServings')?.value);
      if(!name||servings<=0){if(status)status.textContent='Ingresá un nombre y una cantidad de porciones válida.';return}
      if(!data()?.saveRecipe){if(status)status.textContent='La función de recetas no está disponible.';return}
      if(btn){btn.disabled=true;btn.textContent='Guardando…'}
      try{
        const res=await data().saveRecipe({name,notes:txt($('nutritionRecipeNotes')?.value),servings,ingredients:list});
        closeModal();notify(`Receta guardada: ${res.recipe.name}`,'success');openRecipesModal();
      }catch(err){console.warn('Guardar receta:',err);if(status)status.textContent=`No se pudo guardar la receta. ¿Ejecutaste sql/07-nutrition-advanced.sql? ${err?.message||''}`;if(btn){btn.disabled=false;btn.textContent='Guardar receta'}}
    });
  }
  function showRecipeCards(recipes,statusText=''){
    const host=$('nutritionRecipeList');if(!host)return;
    const status=$('nutritionRecipeListStatus');if(status)status.textContent=statusText;
    if(!recipes.length){host.innerHTML='<div class="nutrition-advanced-empty">Todavía no guardaste recetas. Abrí una comida con alimentos y tocá “Guardar como receta”.</div>';return}
    host.innerHTML=recipes.map(recipe=>{
      const ingredients=Array.isArray(recipe.ingredients)?recipe.ingredients:[];
      return `<article class="nutrition-recipe-card" data-recipe-card="${esc(recipe.id)}"><div class="nutrition-recipe-card-main"><strong>${esc(recipe.name)}</strong><small>${ingredients.length} ingrediente${ingredients.length===1?'':'s'} · ${fmt(recipe.total_weight_g)} g · rinde ${fmt(recipe.servings)} porción/porciones</small><span>${fmt(recipe.calories_per_100g)} kcal · P ${fmt(recipe.protein_per_100g)} g · C ${fmt(recipe.carbs_per_100g)} g · G ${fmt(recipe.fat_per_100g)} g / 100 g</span>${recipe.notes?`<p>${esc(recipe.notes)}</p>`:''}</div><div class="nutrition-recipe-card-controls"><label>Porciones a agregar<input class="input" type="number" min="0.1" max="100" step="0.1" value="1" data-recipe-portions="${esc(recipe.id)}"></label><button type="button" class="nutrition-advanced-primary" data-recipe-add="${esc(recipe.id)}">Agregar a esta comida</button><button type="button" class="nutrition-advanced-danger" data-recipe-delete="${esc(recipe.id)}">Eliminar</button></div></article>`;
    }).join('');
    host.querySelectorAll('[data-recipe-add]').forEach(button=>button.addEventListener('click',()=>{
      const recipe=recipes.find(r=>String(r.id)===button.dataset.recipeAdd);if(!recipe)return;
      const portionInput=host.querySelector(`[data-recipe-portions="${CSS.escape(String(recipe.id))}"]`);const portions=num(portionInput?.value);
      if(portions<=0){if(status)status.textContent='Ingresá una cantidad de porciones mayor que cero.';return}
      const servings=Math.max(.1,num(recipe.servings)||1),scale=portions/servings;
      const ingredients=(Array.isArray(recipe.ingredients)?recipe.ingredients:[]).filter(x=>num(x.quantity)>0).map(item=>({...item,quantity:Math.round(num(item.quantity)*scale*10)/10,consumed:false,consumed_at:null}));
      if(!ingredients.length){if(status)status.textContent='Esta receta no tiene ingredientes guardados.';return}
      const current=pendingFoods();foods()?.setPendingMealFoods?.([...current,...ingredients]);
      closeModal();notify(`${recipe.name}: se agregaron ${fmt(portions)} porciones a la comida.`,'success');
    }));
    host.querySelectorAll('[data-recipe-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const recipe=recipes.find(r=>String(r.id)===button.dataset.recipeDelete);if(!recipe)return;
      if(!confirm(`¿Eliminar la receta “${recipe.name}”? Los ingredientes ya guardados en comidas anteriores no se borrarán.`))return;
      button.disabled=true;
      try{await data().deleteRecipe(recipe.id);showRecipeCards(recipes.filter(r=>String(r.id)!==String(recipe.id)),'Receta eliminada.');notify('Receta eliminada.','success')}
      catch(err){button.disabled=false;if(status)status.textContent=`No se pudo eliminar la receta: ${err?.message||'error'}`}
    }));
  }
  async function openRecipesModal(){
    mountModal('📖 Mis recetas','Guardá preparaciones y agregá porciones calculadas a la comida que estás editando.',`<div class="nutrition-advanced-status" id="nutritionRecipeListStatus" role="status" aria-live="polite">Cargando recetas…</div><div class="nutrition-recipe-list" id="nutritionRecipeList"></div><div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cerrar</button></div>`);
    document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    try{const recipes=await data().loadRecipes();showRecipeCards(recipes,recipes.length?`${recipes.length} receta${recipes.length===1?'':'s'} guardada${recipes.length===1?'':'s'}.`:'No hay recetas guardadas todavía.');}
    catch(err){console.warn('Cargar recetas:',err);const status=$('nutritionRecipeListStatus');if(status)status.textContent=`No se pudieron cargar las recetas. Ejecutá sql/07-nutrition-advanced.sql y comprobá tu conexión. ${err?.message||''}`;const host=$('nutritionRecipeList');if(host)host.innerHTML='';}
  }
  function groupByDate(rows){const map=new Map();for(const row of rows){const key=String(row.consumed_date||'');if(!map.has(key))map.set(key,[]);map.get(key).push(row)}return [...map.entries()]}
  async function loadHistory(){
    const host=$('nutritionHistoryResults'),status=$('nutritionHistoryStatus');if(!host||!status)return;
    host.innerHTML='';status.textContent='Cargando historial…';
    try{
      const rows=await data().loadConsumptionHistory(historyDays);const groups=groupByDate(rows);
      if(!rows.length){status.textContent=`No hay consumos registrados en los últimos ${historyDays} días.`;host.innerHTML='<div class="nutrition-advanced-empty">Cuando marques alimentos como consumidos, aparecerán acá con la fecha real del consumo.</div>';return}
      status.textContent=`${rows.length} registro${rows.length===1?'':'s'} en los últimos ${historyDays} días.`;
      host.innerHTML=groups.map(([date,items])=>{
        const total=items.reduce((a,item)=>({calories:a.calories+num(item.calories),protein:a.protein+num(item.protein_g),carbs:a.carbs+num(item.carbs_g),fat:a.fat+num(item.fat_g)}),{calories:0,protein:0,carbs:0,fat:0});
        const human=new Date(`${date}T12:00:00`).toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
        return `<section class="nutrition-history-day"><header><strong>${esc(human)}</strong><span>${Math.round(total.calories)} kcal · P ${fmt(total.protein)} g · C ${fmt(total.carbs)} g · G ${fmt(total.fat)} g</span></header><div class="nutrition-history-items">${items.map(item=>`<div class="nutrition-history-item"><div><strong>${esc(item.food_name||'Alimento')}</strong><small>${esc(item.meal_title||'Comida')}${item.meal_time?' · '+esc(item.meal_time):''} · ${fmt(item.quantity)} ${esc(item.unit||'g')}</small></div><span>${fmt(item.calories)} kcal</span></div>`).join('')}</div></section>`;
      }).join('');
    }catch(err){console.warn('Historial de consumo:',err);status.textContent=`No se pudo cargar el historial. Ejecutá sql/07-nutrition-advanced.sql. ${err?.message||''}`;host.innerHTML='';}
  }
  function openHistoryModal(){
    mountModal('📅 Historial de consumo','Consultá lo que marcaste como consumido por fecha. Los valores reflejan los registros guardados, no comidas solamente planificadas.',`<div class="nutrition-advanced-history-toolbar"><label for="nutritionHistoryRange">Período</label><select class="input" id="nutritionHistoryRange"><option value="7">Últimos 7 días</option><option value="30" selected>Últimos 30 días</option><option value="90">Últimos 90 días</option></select></div><div class="nutrition-advanced-status" id="nutritionHistoryStatus" role="status" aria-live="polite">Cargando…</div><div class="nutrition-history-results" id="nutritionHistoryResults"></div><div class="nutrition-advanced-actions"><button type="button" class="nutrition-advanced-secondary" data-advanced-close>Cerrar</button></div>`);
    document.querySelectorAll('[data-advanced-close]').forEach(b=>b.addEventListener('click',closeModal));
    $('nutritionHistoryRange')?.addEventListener('change',e=>{historyDays=Number(e.target.value)||30;loadHistory()});historyDays=30;loadHistory();
  }
  function bind(){
    $('nutritionCreateCustomFoodBtn')?.addEventListener('click',customFoodModal);
    $('nutritionOpenRecipesBtn')?.addEventListener('click',openRecipesModal);
    $('nutritionMealBuilderSaveRecipe')?.addEventListener('click',saveRecipeModal);
    $('nutritionHistoryBtn')?.addEventListener('click',openHistoryModal);
    document.addEventListener('agenda:nutrition-history-warning',event=>notify(`Consumo guardado, pero falta guardar en el historial. ${event.detail?.message||''}`,'warning'));
  }
  window.AgendaNutritionAdvanced={openCustomFood:customFoodModal,openRecipes:openRecipesModal,openHistory:openHistoryModal,saveRecipe:saveRecipeModal};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
