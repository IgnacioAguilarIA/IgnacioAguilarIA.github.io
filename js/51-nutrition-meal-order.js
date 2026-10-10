/* Agenda FICH — orden personalizado de comidas por usuario.
   No toca ninguna lógica de entrenamiento. */
(function(){
  'use strict';

  const STORAGE='agendaNutritionMealOrder';
  const DEFAULT_ORDER=['pre','post','lunch','snack','dinner','sleep'];
  let savedOrder=[...DEFAULT_ORDER];
  let draftOrder=[...DEFAULT_ORDER];
  let ready=false;
  let saveBusy=false;
  const PANEL_STATE_KEY='agendaNutritionMealOrderPanelOpen';

  const byId=id=>document.getElementById(id);
  const getMealTypes=()=>Array.isArray(window.MEAL_TYPES)?window.MEAL_TYPES:MEAL_TYPES;
  const labels={
    pre:'Pre entrenamiento', post:'Post entrenamiento', lunch:'Almuerzo',
    snack:'Merienda', dinner:'Cena', sleep:'Antes de dormir'
  };

  function userKey(){
    try{return currentUser?.id?`${STORAGE}:${currentUser.id}`:`${STORAGE}:local`}
    catch(_){return `${STORAGE}:local`}
  }
  function normalizeOrder(order){
    const valid=new Set(DEFAULT_ORDER);
    const out=[];
    (Array.isArray(order)?order:[]).forEach(k=>{
      const key=String(k||'');
      if(valid.has(key)&&!out.includes(key))out.push(key);
    });
    DEFAULT_ORDER.forEach(k=>{if(!out.includes(k))out.push(k)});
    return out;
  }
  function readLocal(){
    try{
      const raw=localStorage.getItem(userKey());
      return normalizeOrder(raw?JSON.parse(raw):DEFAULT_ORDER);
    }catch(_){return [...DEFAULT_ORDER]}
  }
  function writeLocal(order){
    try{localStorage.setItem(userKey(),JSON.stringify(normalizeOrder(order)))}catch(_){}
  }

  function orderToMealTypes(order){
    const types=getMealTypes();
    const map=new Map(types.map(x=>[x.key,x]));
    const sorted=normalizeOrder(order).map(k=>map.get(k)).filter(Boolean);
    if(sorted.length===types.length){
      types.splice(0,types.length,...sorted);
    }
  }

  function renderTabs(){
    try{if(typeof renderMealTabs==='function')renderMealTabs()}catch(err){console.warn('No se pudieron actualizar las pestañas de comidas:',err)}
  }

  function applySavedOrder(order){
    savedOrder=normalizeOrder(order);
    draftOrder=[...savedOrder];
    orderToMealTypes(savedOrder);
    renderTabs();
  }

  async function loadFromCloud(){
    const local=readLocal();
    if(!currentUser?.id||!sb){applySavedOrder(local);return}
    try{
      const {data,error}=await sb.from('nutrition_preferences').select('meal_order').eq('user_id',currentUser.id).maybeSingle();
      if(error)throw error;
      const order=normalizeOrder(data?.meal_order||local);
      writeLocal(order);
      applySavedOrder(order);
    }catch(err){
      console.warn('No se pudo cargar el orden de comidas desde Supabase. Se usa el orden guardado localmente.',err);
      applySavedOrder(local);
    }
  }

  function move(index,direction){
    const next=index+direction;
    if(index<0||index>=draftOrder.length||next<0||next>=draftOrder.length)return;
    const tmp=draftOrder[index];draftOrder[index]=draftOrder[next];draftOrder[next]=tmp;
    renderEditor();
    orderToMealTypes(draftOrder);
    renderTabs();
  }

  function dragStart(e,index){
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',String(index));
    e.currentTarget.classList.add('dragging');
  }
  function dragEnd(e){e.currentTarget.classList.remove('dragging')}
  function dragOver(e,index){
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    e.currentTarget.classList.add('drag-over');
  }
  function dragLeave(e){e.currentTarget.classList.remove('drag-over')}
  function drop(e,targetIndex){
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const source=Number(e.dataTransfer.getData('text/plain'));
    if(!Number.isInteger(source)||source===targetIndex)return;
    const item=draftOrder.splice(source,1)[0];
    draftOrder.splice(targetIndex,0,item);
    renderEditor();
    orderToMealTypes(draftOrder);
    renderTabs();
  }

  function readPanelState(){
    try{return localStorage.getItem(PANEL_STATE_KEY)==='1'}catch(_){return false}
  }
  function setPanelOpen(open,persist=true){
    const box=byId('nutritionMealOrder');
    const toggle=byId('nutritionMealOrderToggle');
    if(!box||!toggle)return;
    box.hidden=!open;
    toggle.setAttribute('aria-expanded',open?'true':'false');
    toggle.textContent=open?'↕ Ocultar orden de comidas':'↕ Ordenar comidas';
    toggle.classList.toggle('is-open',open);
    if(persist){try{localStorage.setItem(PANEL_STATE_KEY,open?'1':'0')}catch(_){}}
  }

  function renderEditor(){
    const host=byId('nutritionMealOrderList');
    const status=byId('nutritionMealOrderStatus');
    if(!host)return;
    host.innerHTML='';
    draftOrder.forEach((key,index)=>{
      const row=document.createElement('div');
      row.className='nutrition-order-row';
      row.draggable=true;
      row.dataset.index=String(index);
      row.innerHTML=`<span class="nutrition-order-rank">${index+1}</span><span class="nutrition-order-grip" aria-hidden="true">⋮⋮</span><span class="nutrition-order-name">${labels[key]||key}</span><div class="nutrition-order-actions"><button type="button" class="nutrition-order-move" data-dir="-1" aria-label="Mover ${labels[key]||key} arriba">↑</button><button type="button" class="nutrition-order-move" data-dir="1" aria-label="Mover ${labels[key]||key} abajo">↓</button></div>`;
      row.addEventListener('dragstart',e=>dragStart(e,index));
      row.addEventListener('dragend',dragEnd);
      row.addEventListener('dragover',e=>dragOver(e,index));
      row.addEventListener('dragleave',dragLeave);
      row.addEventListener('drop',e=>drop(e,index));
      row.querySelectorAll('.nutrition-order-move').forEach(btn=>btn.addEventListener('click',()=>move(index,Number(btn.dataset.dir))));
      host.appendChild(row);
    });
    if(status){
      const same=JSON.stringify(normalizeOrder(draftOrder))===JSON.stringify(normalizeOrder(savedOrder));
      status.textContent=same?'Orden guardado':'Tenés cambios sin guardar';
      status.classList.toggle('is-dirty',!same);
    }
    const save=byId('nutritionMealOrderSave');
    if(save)save.disabled=JSON.stringify(normalizeOrder(draftOrder))===JSON.stringify(normalizeOrder(savedOrder))||saveBusy;
  }

  async function save(){
    const order=normalizeOrder(draftOrder);
    saveBusy=true;renderEditor();
    writeLocal(order);
    orderToMealTypes(order);
    renderTabs();
    const status=byId('nutritionMealOrderStatus');
    if(status)status.textContent='Guardando…';
    try{
      if(!currentUser?.id||!sb)throw new Error('offline');
      const {data:existing,error:readError}=await sb.from('nutrition_preferences').select('user_id').eq('user_id',currentUser.id).maybeSingle();
      if(readError)throw readError;
      if(existing){
        const {error}=await sb.from('nutrition_preferences').update({meal_order:order,updated_at:new Date().toISOString()}).eq('user_id',currentUser.id);
        if(error)throw error;
      }else{
        const {error}=await sb.from('nutrition_preferences').insert({user_id:currentUser.id,meal_order:order});
        if(error)throw error;
      }
      savedOrder=[...order];draftOrder=[...order];
      if(status)status.textContent='Orden guardado en tu cuenta ✓';
    }catch(err){
      savedOrder=[...order];draftOrder=[...order];
      if(status)status.textContent='Orden guardado en este dispositivo. Se sincronizará cuando la cuenta esté disponible.';
      console.warn('No se pudo guardar el orden de comidas en Supabase:',err);
    }finally{
      saveBusy=false;renderEditor();
    }
  }

  function reset(){draftOrder=[...DEFAULT_ORDER];renderEditor();orderToMealTypes(draftOrder);renderTabs()}

  function initUI(){
    const box=byId('nutritionMealOrder');
    const toggle=byId('nutritionMealOrderToggle');
    if(!box||!toggle||box.dataset.ready==='1')return;
    box.dataset.ready='1';
    byId('nutritionMealOrderSave')?.addEventListener('click',save);
    byId('nutritionMealOrderReset')?.addEventListener('click',reset);
    toggle.addEventListener('click',()=>setPanelOpen(box.hidden));
    renderEditor();
    setPanelOpen(readPanelState(),false);
    ready=true;
  }

  async function init(){
    initUI();
    await loadFromCloud();
    initUI();
    try{
      if(sb?.auth?.onAuthStateChange && !window.__agendaNutritionMealOrderAuthBound){
        window.__agendaNutritionMealOrderAuthBound=true;
        sb.auth.onAuthStateChange(()=>setTimeout(loadFromCloud,0));
      }
    }catch(_){}
  }

  window.AgendaNutritionMealOrder={
    reload:loadFromCloud,
    save,
    reset,
    getOrder:()=>[...draftOrder]
  };

  let tries=0;
  function waitForSession(){
    tries+=1;
    if(currentUser?.id||tries>80){init();return}
    setTimeout(waitForSession,250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForSession,{once:true});
  else waitForSession();
})();
