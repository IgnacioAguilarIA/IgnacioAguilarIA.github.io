(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const cache=new Map();
  let observer=null;
  let renderTimer=null;
  let activeDateKey='';

  function uid(){return String((typeof currentUser!=='undefined'&&currentUser?.id)||'guest')}
  function cacheKey(mealId){return `${uid()}::${String(mealId)}`}
  function localItemsKey(mealId){return `agendaNutritionMealItemsCache:${uid()}:${String(mealId)}`}
  function queueKey(){return `agendaNutritionPendingConsumption:${uid()}`}
  function fallbackKey(itemId){return `agendaNutritionConsumed:${uid()}:${String(itemId)}`}
  function dateKeyInCordoba(value=new Date()){
    const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;
  }
  function readFallback(itemId){try{const raw=localStorage.getItem(fallbackKey(itemId));if(raw==='1')return true;if(raw==='0'||!raw)return false;const [value,date]=raw.split('|');return value==='1'&&date===dateKeyInCordoba(new Date())}catch(_){return false}}
  function writeFallback(itemId,value){try{localStorage.setItem(fallbackKey(itemId),`${value?'1':'0'}|${dateKeyInCordoba(new Date())}`)}catch(_){}}
  function clearFallback(itemId){try{localStorage.removeItem(fallbackKey(itemId))}catch(_){}}
  function readPending(){try{const v=JSON.parse(localStorage.getItem(queueKey())||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return {}}}
  function writePending(queue){try{localStorage.setItem(queueKey(),JSON.stringify(queue));return true}catch(_){return false}}
  function writeItemCache(mealId,items){try{localStorage.setItem(localItemsKey(mealId),JSON.stringify({saved_at:Date.now(),items:(items||[]).map(x=>({...x,persisted:!!x.persisted}))}));}catch(_){}}
  function readItemCache(mealId){try{const parsed=JSON.parse(localStorage.getItem(localItemsKey(mealId))||'null');return Array.isArray(parsed?.items)?parsed.items:[]}catch(_){return []}}
  function notifySync(status,message){try{document.dispatchEvent(new CustomEvent('agenda:nutrition-consumption-sync-status',{detail:{status,message}}))}catch(_){}}
  function queuePending(item,next){const queue=readPending();queue[String(item.id)]={consumed:!!next,consumed_at:next?new Date().toISOString():null,queued_at:new Date().toISOString(),meal_id:String(item.meal_id||'')};if(!writePending(queue)){notifySync('error','No se pudo guardar localmente el cambio pendiente de consumo.');return false}notifySync('pending',navigator.onLine?'Cambio de consumo pendiente de sincronización.':'Sin conexión: el cambio quedó guardado en este dispositivo.');return true}
  async function flushPending(){
    if(!navigator.onLine||uid()==='guest'||!window.AgendaNutritionData?.setMealItemConsumed)return;
    const queue=readPending();const ids=Object.keys(queue);if(!ids.length)return;
    let saved=0,failed=null;
    for(const id of ids){const entry=queue[id];try{const result=await window.AgendaNutritionData.setMealItemConsumed(id,!!entry.consumed,entry.consumed_at,entry.queued_at);if(result?.ok===false||result?.skipped)throw new Error('Supabase no confirmó el cambio.');delete queue[id];clearFallback(id);saved++;for(const [key,value] of cache.entries()){if(!key.startsWith(`${uid()}::`))continue;const rows=value?.items;if(Array.isArray(rows)){const item=rows.find(x=>String(x.id)===String(id));if(item){item.consumed=!!entry.consumed;item.consumed_at=entry.consumed?entry.consumed_at:null;writeItemCache(String(item.meal_id||key.slice(key.indexOf('::')+2)),rows)}}}}catch(err){failed=err;break}}
    if(!writePending(queue)){notifySync('error','No se pudo actualizar la cola local de sincronización.');return}
    if(Object.keys(queue).length)notifySync('pending',`Quedan ${Object.keys(queue).length} cambio(s) de consumo pendientes. ${failed?.message||''}`.trim());
    else if(saved)notifySync('saved','Los cambios de consumo pendientes se sincronizaron con tu cuenta.');
    if(saved){try{document.dispatchEvent(new CustomEvent('agenda:nutrition-consumption-queue-flushed',{detail:{saved}}))}catch(_){}}
  }
  function findMeal(mealId){
    const list=(typeof nutritionMeals!=='undefined'&&Array.isArray(nutritionMeals))?nutritionMeals:[];
    return list.find(m=>String(m?.id||'')===String(mealId))||null;
  }
  function makeFallbackItem(meal){
    if(!meal)return null;
    const id=`fallback-meal:${String(meal.id||'')}`;
    const label=String(meal.foods||meal.title||'Comida').trim()||'Comida';
    return {
      id,
      meal_id:String(meal.id||''),
      name:label,
      quantity:100,
      unit:'plan',
      calories_per_100g:Number(meal.calories)||0,
      protein_per_100g:Number(meal.protein_g)||0,
      carbs_per_100g:Number(meal.carbs_g)||0,
      fat_per_100g:Number(meal.fat_g)||0,
      fiber_per_100g:0,
      consumed:readFallback(id),
      consumed_at:null,
      __fallback:true
    };
  }
  function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
  function fmt(v){const n=Math.round((Number(v)||0)*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1)}

  async function getItems(mealId,force=false){
    if(!mealId)return [];
    const mapKey=cacheKey(mealId);
    if(!force&&cache.has(mapKey)){
      const entry=cache.get(mapKey);
      if(entry?.promise)return entry.promise;
      const cached=Array.isArray(entry?.items)?entry.items:[];
      let changed=false;const today=dateKeyInCordoba(new Date());
      cached.forEach(item=>{
        if(item.persisted&&item.consumed&&item.consumed_at&&dateKeyInCordoba(item.consumed_at)!==today){item.consumed=false;item.consumed_at=null;changed=true;}
      });
      if(changed)writeItemCache(mealId,cached);
      return cached;
    }
    const loader=(async()=>{
      try{
        const raw=await window.AgendaNutritionData?.loadMealItems?.(String(mealId)) || [];
        const pending=readPending();
        let items=(Array.isArray(raw)?raw:[]).map(item=>{
          const queued=pending[String(item.id)];
          const hasServerState=typeof item.consumed==='boolean';
          if(hasServerState&&!queued)clearFallback(item.id);
          // Backfill idempotente: conserva el día histórico, sin sumar nuevamente el
          // alimento al resumen de hoy si se había marcado en una fecha anterior.
          if(item.consumed&&item.consumed_at&&window.AgendaNutritionData?.recordConsumptionHistory){
            window.AgendaNutritionData.recordConsumptionHistory(item,item.consumed_at).catch(err=>notifySync('warning',`No se pudo actualizar el historial de consumo. Revisá sql/07-nutrition-advanced.sql. ${err?.message||''}`));
          }
          const stamp=queued?(queued.consumed_at||null):(item.consumed_at||null);
          const sameDay=!!stamp&&dateKeyInCordoba(stamp)===dateKeyInCordoba(new Date());
          const queuedToday=!!queued?.consumed&&sameDay;
          const serverToday=!!item.consumed&&sameDay;
          const consumed=queued?(queuedToday): (hasServerState?serverToday:readFallback(item.id));
          return {...item,persisted:true,consumed,consumed_at:consumed?stamp:null};
        });
        // Una respuesta online vacía es autoritativa: no resucitamos alimentos
        // que fueron eliminados y permanecen solo en una copia local antigua.
        if(!items.length){const fallback=makeFallbackItem(findMeal(mealId));if(fallback)items=[fallback]}
        cache.set(mapKey,{items});
        if(items.some(x=>x.persisted))writeItemCache(mealId,items);
        if(Object.keys(pending).length)flushPending().catch(()=>{});
        return items;
      }catch(err){
        console.warn('No se pudieron cargar los alimentos consumibles; se intenta usar la copia local:',err);
        const pending=readPending();
        const today=dateKeyInCordoba(new Date());
        let items=readItemCache(mealId).map(item=>{
          const queued=pending[String(item.id)];const requested=queued?!!queued.consumed:!!item.consumed;
          const stamp=queued?(queued.consumed_at||null):(item.consumed_at||null);
          const consumed=item.persisted?requested&&!!stamp&&dateKeyInCordoba(stamp)===today:requested;
          return {...item,persisted:!!item.persisted,consumed,consumed_at:consumed?stamp:null};
        });
        if(items.length){notifySync('pending','Mostrando los alimentos guardados en este dispositivo; falta confirmar la sincronización.')}else{const fallback=makeFallbackItem(findMeal(mealId));items=fallback?[fallback]:[];notifySync('warning','No se pudieron recuperar los alimentos detallados; se muestra el resumen de respaldo de la comida.')}
        cache.set(mapKey,{items});return items;
      }
    })();
    cache.set(mapKey,{items:[],promise:loader});
    return loader;
  }

  function invalidate(mealId){if(mealId)cache.delete(cacheKey(mealId));}
  function emitChange(detail){try{document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-item-consumption-changed',{detail}));}catch(_){}}
  function setPanelBusy(card,busy){card?.querySelectorAll?.('.nutrition-consumption-toggle,.nutrition-consumption-all').forEach(button=>{button.disabled=!!busy})}

  function summarize(items){
    const list=Array.isArray(items)?items:[];
    const consumed=list.filter(x=>x.consumed===true).length;
    return {total:list.length,consumed};
  }

  function renderCardItems(card,items){
    if(!card)return;
    let host=card.querySelector('.nutrition-consumption-panel');
    if(!items.length){if(host)host.remove();return;}
    if(!host){
      host=document.createElement('div');
      host.className='nutrition-consumption-panel';
      card.querySelector('.meal-card-head')?.insertAdjacentElement('afterend',host);
    }
    const info=summarize(items);
    host.innerHTML=`
      <div class="nutrition-consumption-head">
        <div><strong>🍽️ Alimentos de esta comida</strong><span>${info.consumed}/${info.total} consumidos</span></div>
        <button type="button" class="nutrition-consumption-all" data-consumption-action="toggle-all">${info.consumed===info.total?'↺ Marcar ninguno':'✓ Marcar todos'}</button>
      </div>
      <div class="nutrition-consumption-list">
        ${items.map((item,i)=>{
          const checked=!!item.consumed;
          const qty=Number(item.quantity)||0;
          const unit=item.unit||'g';
          const calories=Number(item.calories_per_100g)||0;
          const protein=Number(item.protein_per_100g)||0;
          const carbs=Number(item.carbs_per_100g)||0;
          const fat=Number(item.fat_per_100g)||0;
          const factor=item.__fallback?1:(Math.max(0,qty)/100);
          const qtyLabel=item.__fallback?'Plan completo':`${fmt(qty)} ${esc(unit)}`;
          const plannedMacros=`${fmt(calories*factor)} kcal · P ${fmt(protein*factor)} g · C ${fmt(carbs*factor)} g · G ${fmt(fat*factor)} g`;
          const macroLabel=checked
            ? plannedMacros
            : `${qtyLabel} · ${plannedMacros} · Pendiente`;
          return `<div class="nutrition-consumption-item ${checked?'is-consumed':''}">
            <span class="nutrition-consumption-check" aria-hidden="true">${checked?'✓':''}</span>
            <span class="nutrition-consumption-name"><strong>${esc(item.name||'Alimento')}</strong><small>${macroLabel}</small></span>
            <button type="button" class="nutrition-consumption-toggle" data-consumption-index="${i}" aria-pressed="${checked?'true':'false'}">${checked?'✓ Consumido':'○ Consumir'}</button>
          </div>`;
        }).join('')}
      </div>`;

    host.querySelectorAll('[data-consumption-index]').forEach(button=>{
      button.addEventListener('click',async event=>{
        event.preventDefault();
        event.stopPropagation();
        const index=Number(button.dataset.consumptionIndex);
        if(!Number.isInteger(index)||!items[index]||button.disabled)return;
        button.disabled=true;
        try{await toggleItem(card,items[index],!items[index].consumed)}finally{button.disabled=false}
      });
    });
    host.querySelector('[data-consumption-action="toggle-all"]')?.addEventListener('click',async event=>{
      event.preventDefault();
      event.stopPropagation();
      const button=event.currentTarget;
      if(button?.disabled)return;
      const next=info.consumed!==info.total;
      if(button)button.disabled=true;
      try{await toggleAll(card,items,next)}finally{if(button)button.disabled=false}
    });
  }

  async function persistItemConsumption(item,next){
    if(item.persisted&&item.id){
      if(navigator.onLine){
        try{
          const save=window.AgendaNutritionData?.setMealItemConsumed;
          if(typeof save!=='function')throw new Error('No está disponible el guardado del estado de consumo.');
          const result=await save(item.id,!!next);
          if(result?.ok===false||result?.skipped)throw new Error('No se pudo confirmar el guardado del estado de consumo.');
          const queue=readPending();delete queue[String(item.id)];writePending(queue);clearFallback(item.id);
          if(result?.historyOk===false)notifySync('warning',`Consumo guardado, pero no se pudo actualizar el historial. Ejecutá sql/07-nutrition-advanced.sql. ${result.historyError||''}`.trim());
          else if(!Object.keys(queue).length)notifySync('saved','Consumo sincronizado con tu cuenta.');
          return {ok:true};
        }catch(err){
          if(!queuePending(item,next))throw err;
          return {ok:true,pending:true,error:err};
        }
      }
      if(!queuePending(item,next))throw new Error('No se pudo guardar el cambio sin conexión.');
      return {ok:true,pending:true};
    }
    if(item.id)writeFallback(item.id,!!next);
    return {ok:true,local:true};
  }

  async function toggleItem(card,item,next){
    const previous=!!item.consumed;
    const previousAt=item.consumed_at||null;
    item.consumed=!!next;
    item.consumed_at=item.consumed?new Date().toISOString():null;
    renderCardItems(card,cache.get(cacheKey(card.dataset.mealId))?.items||[]);
    writeItemCache(card.dataset.mealId,cache.get(cacheKey(card.dataset.mealId))?.items||[]);
    setPanelBusy(card,true);
    emitChange({mealId:String(card.dataset.mealId||''),itemId:item.id?String(item.id):null,item:{...item},consumed:item.consumed});
    try{
      await persistItemConsumption(item,item.consumed);
    }catch(err){
      item.consumed=previous;
      item.consumed_at=previousAt;
      if(item.id){if(item.persisted)clearFallback(item.id);else writeFallback(item.id,previous)}
      renderCardItems(card,cache.get(cacheKey(card.dataset.mealId))?.items||[]);
      writeItemCache(card.dataset.mealId,cache.get(cacheKey(card.dataset.mealId))?.items||[]);
      emitChange({mealId:String(card.dataset.mealId||''),itemId:item.id?String(item.id):null,item:{...item},consumed:previous,rollback:true});
      console.warn('No se pudo guardar el estado consumido:',err);
      try{window.showToast?.('No se pudo guardar el estado de consumo. Se revirtió el cambio.')}catch(_){ }
    }finally{
      setPanelBusy(card,false);
    }
  }

  async function toggleAll(card,items,next){
    const previous=items.map(item=>({item,consumed:!!item.consumed,consumed_at:item.consumed_at||null}));
    const stamp=next?new Date().toISOString():null;
    items.forEach(item=>{item.consumed=!!next;item.consumed_at=stamp});
    renderCardItems(card,items);writeItemCache(card.dataset.mealId,items);setPanelBusy(card,true);
    emitChange({mealId:String(card.dataset.mealId||''),bulk:true,items:items.map(item=>({...item})),consumed:!!next});
    try{
      for(const item of items)await persistItemConsumption(item,next);
      writeItemCache(card.dataset.mealId,items);
    }catch(err){
      previous.forEach(entry=>{entry.item.consumed=entry.consumed;entry.item.consumed_at=entry.consumed_at});
      previous.forEach(entry=>{if(entry.item.id){if(entry.item.persisted)clearFallback(entry.item.id);else writeFallback(entry.item.id,entry.consumed)}});
      renderCardItems(card,items);writeItemCache(card.dataset.mealId,items);
      emitChange({mealId:String(card.dataset.mealId||''),bulk:true,items:items.map(item=>({...item})),consumed:null,rollback:true});
      console.warn('No se pudo conservar localmente todo el cambio de consumo:',err);
      try{window.showToast?.('No se pudo guardar localmente el cambio completo. Se revirtieron los cambios no conservados.')}catch(_){ }
    }finally{setPanelBusy(card,false)}
  }

  async function decorate(){
    const list=$('mealList');
    if(!list)return;
    const cards=[...list.querySelectorAll('.meal-card[data-meal-id]')];
    for(const card of cards){
      const mealId=String(card.dataset.mealId||'');
      if(!mealId)continue;
      const items=await getItems(mealId);
      if(items.length)renderCardItems(card,items);
      else card.querySelector('.nutrition-consumption-panel')?.remove();
    }
  }

  function schedule(){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{renderTimer=null;decorate().catch(()=>{})},40);
  }

  function init(){
    const list=$('mealList');
    if(!list){setTimeout(init,250);return}
    if(!observer){
      observer=new MutationObserver(records=>{
        // Los cambios internos del panel de consumo los provoca este mismo módulo.
        // Ignorarlos evita que el MutationObserver reconstruya el botón justo
        // después de presionarlo, lo que lo dejaba prácticamente imposible de usar.
        const relevant=records.some(record=>{
          const target=record.target?.closest?.('.nutrition-consumption-panel');
          if(target)return false;
          return [...(record.addedNodes||[]),...(record.removedNodes||[])].some(node=>{
            if(node.nodeType!==1)return true;
            return !node.closest?.('.nutrition-consumption-panel');
          });
        });
        if(relevant)schedule();
      });
      observer.observe(list,{childList:true,subtree:true});
    }
    document.addEventListener('agenda:nutrition-meal-items-saved',event=>{
      invalidate(event.detail?.mealId);
      const queue=readPending();(event.detail?.removedIds||[]).forEach(id=>{delete queue[String(id)];clearFallback(id)});writePending(queue);
      schedule();
    });
    window.addEventListener('online',()=>{flushPending().catch(()=>{});cache.clear();schedule()});
    window.addEventListener('offline',()=>notifySync('pending','Sin conexión: los cambios de consumo se conservarán localmente mientras sea posible.'));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)flushPending().catch(()=>{})});
    if(window.sb?.auth?.onAuthStateChange&&!window.__agendaNutritionConsumptionAuthBound){window.__agendaNutritionConsumptionAuthBound=true;window.sb.auth.onAuthStateChange(()=>{cache.clear();setTimeout(schedule,0)})}
    activeDateKey=dateKeyInCordoba(new Date());
    setInterval(()=>{
      const today=dateKeyInCordoba(new Date());
      if(today!==activeDateKey){activeDateKey=today;cache.clear();schedule();}
      if(navigator.onLine&&Object.keys(readPending()).length)flushPending().catch(()=>{});
    },60000);
    document.addEventListener('agenda:nutrition-meal-items-restored',event=>{invalidate(event.detail?.mealId);schedule()});
    document.addEventListener('agenda:nutrition-meal-deleted',event=>{
      const mealId=String(event.detail?.mealId||'');if(!mealId)return;
      const queue=readPending();for(const [id,entry] of Object.entries(queue)){if(String(entry?.meal_id||'')===mealId)delete queue[id]}
      writePending(queue);cache.delete(cacheKey(mealId));try{localStorage.removeItem(localItemsKey(mealId))}catch(_){}
      if(!Object.keys(queue).length)notifySync('saved','Comida eliminada y cambios pendientes depurados.');
    });
    decorate().catch(()=>{});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.AgendaNutritionConsumption={refresh:schedule,invalidate,flushPending};
})();
