/* Agenda FICH — duplicar comidas.
   Aislado de la lógica de entrenamiento. */
(function(){
  'use strict';

  const COPY_STYLE_ID='nutritionMealCopyStyles';
  const MODAL_ID='nutritionMealCopyModal';
  const $=id=>document.getElementById(id);
  let observer=null;
  let sourceMeal=null;
  let sourceItems=[];
  let sourceItemsLoaded=false;
  let saving=false;

  function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
  function safeText(v){return String(v??'').trim()}
  function number(v){const n=Number(v);return Number.isFinite(n)?n:0}

  function injectStyles(){
    if($(COPY_STYLE_ID))return;
    const s=document.createElement('style');
    s.id=COPY_STYLE_ID;
    s.textContent=`
      .nutrition-meal-copy-btn{min-width:34px}
      .nutrition-meal-copy-overlay{position:fixed;inset:0;z-index:10050;background:rgba(10,16,24,.62);display:flex;align-items:center;justify-content:center;padding:18px}
      .nutrition-meal-copy-modal{width:min(560px,100%);max-height:min(88vh,760px);overflow:auto;background:var(--card,#fff);color:var(--text,#111);border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.28);border:1px solid rgba(127,127,127,.2)}
      .nutrition-meal-copy-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(127,127,127,.18)}
      .nutrition-meal-copy-head h3{margin:0 0 4px;font-size:1.1rem}
      .nutrition-meal-copy-head p{margin:0;opacity:.72;font-size:.88rem}
      .nutrition-meal-copy-close{border:0;background:transparent;font-size:1.4rem;line-height:1;cursor:pointer;padding:4px 8px;border-radius:10px}
      .nutrition-meal-copy-body{padding:18px 20px;display:grid;gap:14px}
      .nutrition-meal-copy-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .nutrition-meal-copy-preview{padding:12px 14px;border-radius:12px;background:rgba(127,127,127,.08);font-size:.9rem}
      .nutrition-meal-copy-preview strong{display:block;margin-bottom:3px}
      .nutrition-meal-copy-status{font-size:.86rem;opacity:.78}
      .nutrition-meal-copy-actions{display:flex;justify-content:flex-end;gap:10px;padding:0 20px 18px}
      .nutrition-meal-copy-actions button{border:0;border-radius:11px;padding:10px 14px;cursor:pointer;font-weight:600}
      .nutrition-meal-copy-cancel{background:rgba(127,127,127,.12)}
      .nutrition-meal-copy-save{background:var(--accent,#2563eb);color:#fff}
      .nutrition-meal-copy-save:disabled{opacity:.6;cursor:not-allowed}
      @media(max-width:560px){.nutrition-meal-copy-grid{grid-template-columns:1fr}.nutrition-meal-copy-overlay{padding:10px}.nutrition-meal-copy-modal{border-radius:15px}}
    `;
    document.head.appendChild(s);
  }

  function closeModal(){
    const overlay=$(MODAL_ID);
    if(overlay)overlay.remove();
    sourceMeal=null;sourceItems=[];sourceItemsLoaded=false;saving=false;
  }

  function mealOrderIndex(type){
    try{
      const custom=window.AgendaNutritionMealOrder?.getOrder?.();
      if(Array.isArray(custom)){
        const i=custom.indexOf(type);
        if(i>=0)return i;
      }
    }catch(_){ }
    try{return (Array.isArray(MEAL_TYPES)?MEAL_TYPES:[]).findIndex(m=>m.key===type)}catch(_){return 0}
  }

  function mealLabelSafe(type){
    try{return typeof mealLabel==='function'?mealLabel(type):(MEAL_TYPES.find(m=>m.key===type)?.label||type)}catch(_){return type}
  }

  function buildModal(meal){
    closeModal();
    sourceMeal=meal;
    injectStyles();

    const overlay=document.createElement('div');
    overlay.id=MODAL_ID;
    overlay.className='nutrition-meal-copy-overlay';
    overlay.innerHTML=`
      <div class="nutrition-meal-copy-modal" role="dialog" aria-modal="true" aria-labelledby="nutritionMealCopyTitle">
        <div class="nutrition-meal-copy-head">
          <div><h3 id="nutritionMealCopyTitle">⧉ Duplicar comida</h3><p>Creá una copia sin modificar la comida original.</p></div>
          <button type="button" class="nutrition-meal-copy-close" id="nutritionMealCopyClose" aria-label="Cerrar">×</button>
        </div>
        <div class="nutrition-meal-copy-body">
          <div class="nutrition-meal-copy-preview"><strong>${esc(meal.title||'Comida')}</strong><span>Origen: ${esc(DAYS[Number(meal.day)]||'Día actual')} · ${esc(mealLabelSafe(meal.meal_type))}${meal.meal_time?' · '+esc(meal.meal_time):''}</span></div>
          <div class="field"><label for="nutritionMealCopyTitleInput">Título de la copia</label><input class="input" id="nutritionMealCopyTitleInput" value="${esc((meal.title||'Comida')+' (copia)')}" autocomplete="off"></div>
          <div class="nutrition-meal-copy-grid">
            <div class="field"><label for="nutritionMealCopyDay">Día de destino</label><select class="input" id="nutritionMealCopyDay">${DAYS.map((d,i)=>`<option value="${i}" ${Number(meal.day)===i?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
            <div class="field"><label for="nutritionMealCopyType">Tipo de comida</label><select class="input" id="nutritionMealCopyType">${(Array.isArray(MEAL_TYPES)?MEAL_TYPES:[]).map(m=>`<option value="${esc(m.key)}" ${m.key===meal.meal_type?'selected':''}>${esc(m.label)}</option>`).join('')}</select></div>
          </div>
          <div class="nutrition-meal-copy-grid">
            <div class="field"><label for="nutritionMealCopyTime">Horario</label><input class="input" id="nutritionMealCopyTime" type="time" value="${esc(meal.meal_time||'')}"></div>
            <div class="field"><label for="nutritionMealCopyDescription">Descripción</label><input class="input" id="nutritionMealCopyDescription" value="${esc(meal.description||'')}"></div>
          </div>
          <div class="nutrition-meal-copy-status" id="nutritionMealCopyStatus">Cargando los alimentos estructurados de la comida…</div>
        </div>
        <div class="nutrition-meal-copy-actions">
          <button type="button" class="nutrition-meal-copy-cancel" id="nutritionMealCopyCancel">Cancelar</button>
          <button type="button" class="nutrition-meal-copy-save" id="nutritionMealCopySave" disabled>Duplicar comida</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    $('nutritionMealCopyClose')?.addEventListener('click',closeModal);
    $('nutritionMealCopyCancel')?.addEventListener('click',closeModal);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()});
    document.addEventListener('keydown',handleEscape,{once:true});
    $('nutritionMealCopySave')?.addEventListener('click',saveCopy);

    loadSourceItems();
    setTimeout(()=>$('nutritionMealCopyTitleInput')?.focus(),30);
  }

  function handleEscape(e){if(e.key==='Escape')closeModal()}

  async function loadSourceItems(){
    const status=$('nutritionMealCopyStatus');
    const save=$('nutritionMealCopySave');
    sourceItemsLoaded=false;
    try{
      if(!sourceMeal?.id||!window.AgendaNutritionData?.loadMealItems)throw new Error('No hay soporte para alimentos estructurados.');
      sourceItems=await window.AgendaNutritionData.loadMealItems(sourceMeal.id);
      sourceItemsLoaded=true;
      if(status)status.textContent=sourceItems.length?`✓ Se copiarán ${sourceItems.length} alimento${sourceItems.length===1?'':'s'} y todas sus cantidades.`:'Esta comida no tiene alimentos estructurados. Se copiarán sus datos nutricionales actuales.';
    }catch(err){
      console.warn('No se pudieron cargar los alimentos de la comida original:',err);
      sourceItems=[];sourceItemsLoaded=true;
      if(status)status.textContent='No se pudieron cargar los alimentos estructurados. Se duplicará la comida con sus datos nutricionales.';
    }finally{
      if(save)save.disabled=false;
    }
  }

  async function saveCopy(){
    if(saving||!sourceMeal)return;
    const title=safeText($('nutritionMealCopyTitleInput')?.value);
    const day=Number($('nutritionMealCopyDay')?.value);
    const type=safeText($('nutritionMealCopyType')?.value);
    const time=safeText($('nutritionMealCopyTime')?.value);
    const description=safeText($('nutritionMealCopyDescription')?.value);
    const status=$('nutritionMealCopyStatus');
    const save=$('nutritionMealCopySave');
    if(!title){if(status)status.textContent='Escribí un título para la copia.';$('nutritionMealCopyTitleInput')?.focus();return}
    if(!Number.isInteger(day)||day<0||day>6){if(status)status.textContent='Elegí un día válido.';return}
    if(!type){if(status)status.textContent='Elegí un tipo de comida válido.';return}
    if(typeof sb==='undefined'||!sb||typeof currentUser==='undefined'||!currentUser?.id){if(status)status.textContent='Necesitás tener una sesión iniciada para duplicar la comida.';return}

    saving=true;if(save){save.disabled=true;save.textContent='Duplicando…'}
    try{
      const payload={
        user_id:currentUser.id,
        day,
        meal_type:type,
        meal_order:mealOrderIndex(type),
        title,
        foods:sourceMeal.foods||null,
        calories:sourceMeal.calories??null,
        protein_g:sourceMeal.protein_g??null,
        carbs_g:sourceMeal.carbs_g??null,
        fat_g:sourceMeal.fat_g??null,
        meal_time:time||null,
        description:description||null
      };
      const {data,error}=await sb.from('nutrition_meals').insert(payload).select('id').single();
      if(error)throw error;
      const newId=data?.id;
      if(newId&&sourceItemsLoaded&&sourceItems.length&&window.AgendaNutritionData?.persistMealItems){
        await window.AgendaNutritionData.persistMealItems(newId,sourceItems.map(item=>({...item,consumed:false,consumed_at:null})));
      }

      closeModal();
      if(typeof loadNutritionMeals==='function')await loadNutritionMeals();
      if(typeof renderNutritionList==='function')renderNutritionList();
      if(typeof renderNutritionGoals==='function')renderNutritionGoals();
      if(typeof renderDashboard==='function')renderDashboard();
      if(typeof renderConflicts==='function')renderConflicts();
      if(typeof showNutritionCopyToast==='function')showNutritionCopyToast(`Comida duplicada en ${DAYS[day]} · ${mealLabelSafe(type)} ✓`);
      else showToast(`Comida duplicada en ${DAYS[day]} · ${mealLabelSafe(type)} ✓`);
    }catch(err){
      console.error('No se pudo duplicar la comida:',err);
      if(status)status.textContent=`No se pudo duplicar la comida: ${err?.message||'error desconocido'}`;
      if(save){save.disabled=false;save.textContent='Duplicar comida'}
      saving=false;
    }
  }

  function showToast(message){
    const old=$('nutritionMealCopyToast');if(old)old.remove();
    const toast=document.createElement('div');toast.id='nutritionMealCopyToast';toast.textContent=message;
    toast.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10060;background:#111827;color:#fff;padding:11px 14px;border-radius:12px;box-shadow:0 10px 35px rgba(0,0,0,.25);font-size:.9rem;max-width:min(420px,calc(100vw - 36px))';
    document.body.appendChild(toast);setTimeout(()=>toast.remove(),3200);
  }

  function decorate(){
    const list=$('mealList');
    if(!list)return;
    const meals=Array.isArray(nutritionMeals)?nutritionMeals.filter(m=>m.meal_type===activeMealType):[];
    [...list.querySelectorAll('.meal-card')].forEach((card,index)=>{
      if(card.querySelector('.nutrition-meal-copy-btn'))return;
      const meal=meals[index];
      if(!meal?.id)return;
      const actions=card.querySelector('.meal-actions');
      if(!actions)return;
      const btn=document.createElement('button');
      btn.type='button';btn.className='meal-action nutrition-meal-copy-btn';btn.textContent='⧉';btn.title='Duplicar comida';btn.setAttribute('aria-label',`Duplicar ${meal.title||'comida'}`);
      btn.addEventListener('click',()=>buildModal(meal));
      actions.insertBefore(btn,actions.lastElementChild||null);
    });
  }

  function init(){
    injectStyles();
    const list=$('mealList');
    if(!list)return setTimeout(init,250);
    decorate();
    observer=new MutationObserver(()=>{queueMicrotask(decorate)});
    observer.observe(list,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
