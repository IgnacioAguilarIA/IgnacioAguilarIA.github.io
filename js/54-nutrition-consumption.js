(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const cache=new Map();
  let observer=null;
  let renderTimer=null;
  let activeDateKey='';
  const pendingFlushes=new Map();
  const itemSyncLocks=new Map();

  function uid(){return String((typeof currentUser!=='undefined'&&currentUser?.id)||'guest')}
  function cacheKey(mealId,userId=uid()){return `${String(userId)}::${String(mealId)}`}
  function localItemsKey(mealId,userId=uid()){return `agendaNutritionMealItemsCache:${String(userId)}:${String(mealId)}`}
  function queueKey(userId=uid()){return `agendaNutritionPendingConsumption:${String(userId)}`}
  function fallbackKey(itemId,userId=uid()){return `agendaNutritionConsumed:${String(userId)}:${String(itemId)}`}
  function dateKeyInCordoba(value=new Date()){
    const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;
  }
  function readFallback(itemId,userId=uid()){try{const raw=localStorage.getItem(fallbackKey(itemId,userId));if(raw==='1')return true;if(raw==='0'||!raw)return false;const [value,date]=raw.split('|');return value==='1'&&date===dateKeyInCordoba(new Date())}catch(_){return false}}
  function writeFallback(itemId,value,userId=uid()){try{localStorage.setItem(fallbackKey(itemId,userId),`${value?'1':'0'}|${dateKeyInCordoba(new Date())}`)}catch(_){}}
  function clearFallback(itemId,userId=uid()){try{localStorage.removeItem(fallbackKey(itemId,userId))}catch(_){}}
  function readPending(userId=uid()){try{const v=JSON.parse(localStorage.getItem(queueKey(userId))||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return {}}}
  function writePending(queue,userId=uid()){try{localStorage.setItem(queueKey(userId),JSON.stringify(queue));return true}catch(_){return false}}
  function writeItemCache(mealId,items,userId=uid()){try{localStorage.setItem(localItemsKey(mealId,userId),JSON.stringify({saved_at:Date.now(),items:(items||[]).map(x=>({...x,persisted:!!x.persisted}))}));}catch(_){}}
  function readItemCache(mealId,userId=uid()){try{const parsed=JSON.parse(localStorage.getItem(localItemsKey(mealId,userId))||'null');return Array.isArray(parsed?.items)?parsed.items:[]}catch(_){return []}}
  function notifySync(status,message,userId=uid()){try{document.dispatchEvent(new CustomEvent('agenda:nutrition-consumption-sync-status',{detail:{status,message,userId:String(userId||'')}}))}catch(_){}}
  function sameQueueEntry(a,b){
    if(!a&&!b)return true;
    if(!a||!b)return false;
    return String(a.queued_at||'')===String(b.queued_at||'')
      &&!!a.consumed===!!b.consumed
      &&String(a.consumed_at||'')===String(b.consumed_at||'')
      &&String(a.meal_id||'')===String(b.meal_id||'');
  }
  function withItemSyncLock(userId,itemId,operation){
    const key=`${String(userId)}::${String(itemId)}`;
    const previous=itemSyncLocks.get(key)||Promise.resolve();
    const task=previous.catch(()=>{}).then(operation);
    const tracked=task.finally(()=>{if(itemSyncLocks.get(key)===tracked)itemSyncLocks.delete(key)});
    itemSyncLocks.set(key,tracked);
    return tracked;
  }
  function reflectSyncedConsumption(owner,id,entry){
    for(const [key,value] of cache.entries()){
      if(!key.startsWith(`${owner}::`))continue;
      const rows=value?.items;
      if(Array.isArray(rows)){
        const item=rows.find(x=>String(x.id)===String(id));
        if(item){item.consumed=!!entry.consumed;item.consumed_at=entry.consumed?entry.consumed_at:null;writeItemCache(String(item.meal_id||key.slice(key.indexOf('::')+2)),rows,owner)}
      }
    }
  }
  function queuePending(item,next,userId=uid(),queuedAt=new Date().toISOString(),expectedPrevious=undefined){
    const queue=readPending(userId);const id=String(item.id);
    // If another operation changed this item while a request was in flight, keep
    // that newer queue entry instead of overwriting it with an older failed request.
    if(expectedPrevious!==undefined&&!sameQueueEntry(queue[id]||null,expectedPrevious||null)){
      if(uid()===userId)notifySync('pending','Hay un cambio de consumo más reciente pendiente de sincronización.',userId);
      return true;
    }
    queue[id]={consumed:!!next,consumed_at:next?new Date(queuedAt).toISOString():null,queued_at:String(queuedAt),meal_id:String(item.meal_id||'')};
    if(!writePending(queue,userId)){if(uid()===userId)notifySync('error','No se pudo guardar localmente el cambio pendiente de consumo.',userId);return false}
    if(uid()===userId)notifySync('pending',navigator.onLine?'Cambio de consumo pendiente de sincronización.':'Sin conexión: el cambio quedó guardado en este dispositivo.',userId);
    return true;
  }
  async function flushPending(){
    const owner=uid();
    if(!navigator.onLine||owner==='guest'||!window.AgendaNutritionData?.setMealItemConsumed)return;
    if(pendingFlushes.has(owner))return pendingFlushes.get(owner);
    const task=(async()=>{
      const initial=readPending(owner);const ids=Object.keys(initial);if(!ids.length)return;
      let saved=0,failed=null,needsAnotherPass=false;
      for(const id of ids){
        if(uid()!==owner)return;
        try{
          const outcome=await withItemSyncLock(owner,id,async()=>{
            if(uid()!==owner)return {state:'account-changed'};
            // Read the latest value only after acquiring the per-item lock.
            const before=readPending(owner);const entry=before[id];
            if(!entry)return {state:'already-removed'};
            const result=await window.AgendaNutritionData.setMealItemConsumed(id,!!entry.consumed,entry.consumed_at,entry.queued_at,owner);
            if(uid()!==owner)return {state:'account-changed'};
            if(result?.ok===false||result?.skipped)throw new Error('Supabase no confirmó el cambio.');
            // The row can be saved even if the history upsert failed; do not drop its retry.
            if(result?.historyOk===false)throw new Error(`El consumo se guardó, pero falta confirmar el historial: ${result.historyError||'error de historial'}`);
            const after=readPending(owner);
            if(!sameQueueEntry(after[id]||null,entry))return {state:'superseded'};
            delete after[id];
            if(!writePending(after,owner))throw new Error('Supabase recibió el cambio, pero no se pudo actualizar la cola local. El reintento se conserva si el navegador puede escribir el almacenamiento.');
            clearFallback(id,owner);
            reflectSyncedConsumption(owner,id,entry);
            return {state:'saved',entry};
          });
          if(outcome?.state==='account-changed')return;
          if(outcome?.state==='superseded'){needsAnotherPass=true;continue}
          if(outcome?.state==='saved')saved++;
        }catch(err){failed=err;break}
      }
      // Never overwrite the live queue with a stale in-memory snapshot. Each item
      // is removed only after comparing it with the exact entry confirmed by server.
      if(uid()!==owner)return;
      const remaining=readPending(owner);const remainingIds=Object.keys(remaining);const remainingCount=remainingIds.length;
      if(!failed&&remainingIds.some(id=>!ids.includes(id)))needsAnotherPass=true;
      if(remainingCount)notifySync('pending',`Quedan ${remainingCount} cambio(s) de consumo pendientes. ${failed?.message||''}`.trim(),owner);
      else if(saved)notifySync('saved','Los cambios de consumo pendientes se sincronizaron con tu cuenta.',owner);
      if(saved){try{document.dispatchEvent(new CustomEvent('agenda:nutrition-consumption-queue-flushed',{detail:{saved,userId:owner}}))}catch(_){}}
      if(needsAnotherPass&&remainingCount&&navigator.onLine)setTimeout(()=>{if(uid()===owner)flushPending().catch(()=>{})},250);
    })();
    pendingFlushes.set(owner,task);
    try{return await task}finally{if(pendingFlushes.get(owner)===task)pendingFlushes.delete(owner)}
  }
  function findMeal(mealId){
    const list=(typeof nutritionMeals!=='undefined'&&Array.isArray(nutritionMeals))?nutritionMeals:[];
    return list.find(m=>String(m?.id||'')===String(mealId))||null;
  }
  function makeFallbackItem(meal,owner=uid()){
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
      consumed:readFallback(id,owner),
      consumed_at:null,
      __fallback:true
    };
  }
  function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
  function fmt(v){const n=Math.round((Number(v)||0)*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1)}
  function grams(item){return window.AgendaNutritionData?.weightInGrams?window.AgendaNutritionData.weightInGrams(item):((String(item?.unit||'g')==='g')?Math.max(0,Number(item?.quantity)||0):null)}
  function missingMetrics(item){
    try{const helper=window.AgendaNutritionData?.missingMacroMetrics;if(typeof helper==='function')return helper(item)}catch(_){}
    const fields=Array.isArray(item?.nutrition_missing_fields)?item.nutrition_missing_fields:(Array.isArray(item?.nutritionMissing)?item.nutritionMissing:[]);
    const normalized=fields.map(value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim());
    const aliases={calories:['caloria','calorias','calorie','calories','energy','kcal'],protein:['proteina','proteinas','protein','proteins'],carbs:['carbohidrato','carbohidratos','carbohydrate','carbohydrates','carbs'],fat:['grasa','grasas','fat','fats']};
    if(String(item?.nutrition_quality_status||item?.nutritionQualityStatus||'').toLowerCase()==='incomplete'&&!fields.length)return ['calories','protein','carbs','fat'];
    return Object.keys(aliases).filter(key=>normalized.some(name=>aliases[key].some(alias=>name===alias||name.startsWith(alias+' ')||name.includes(' '+alias+' ')||name.endsWith(' '+alias))));
  }

  async function getItems(mealId,force=false){
    if(!mealId)return [];
    const owner=uid();
    const mapKey=cacheKey(mealId,owner);
    if(!force&&cache.has(mapKey)){
      const entry=cache.get(mapKey);
      if(entry?.promise)return entry.promise;
      const cached=Array.isArray(entry?.items)?entry.items:[];
      let changed=false;const today=dateKeyInCordoba(new Date());
      cached.forEach(item=>{
        if(item.persisted&&item.consumed&&item.consumed_at&&dateKeyInCordoba(item.consumed_at)!==today){item.consumed=false;item.consumed_at=null;changed=true;}
      });
      if(changed)writeItemCache(mealId,cached,owner);
      return cached;
    }
    const loader=(async()=>{
      try{
        const raw=await window.AgendaNutritionData?.loadMealItems?.(String(mealId),owner) || [];
        if(uid()!==owner)throw new Error('La cuenta activa cambió durante la recuperación de los alimentos.');
        const pending=readPending(owner);
        let items=(Array.isArray(raw)?raw:[]).map(item=>{
          const queued=pending[String(item.id)];
          const hasServerState=typeof item.consumed==='boolean';
          if(hasServerState&&!queued)clearFallback(item.id,owner);
          // Backfill idempotente: conserva el día histórico, sin sumar nuevamente el
          // alimento al resumen de hoy si se había marcado en una fecha anterior.
          if(item.consumed&&item.consumed_at&&window.AgendaNutritionData?.recordConsumptionHistory){
            window.AgendaNutritionData.recordConsumptionHistory(item,item.consumed_at,owner).catch(err=>{if(uid()===owner)notifySync('warning',`No se pudo actualizar el historial de consumo. Revisá sql/07-nutrition-advanced.sql. ${err?.message||''}`,owner)});
          }
          const stamp=queued?(queued.consumed_at||null):(item.consumed_at||null);
          const sameDay=!!stamp&&dateKeyInCordoba(stamp)===dateKeyInCordoba(new Date());
          const queuedToday=!!queued?.consumed&&sameDay;
          const serverToday=!!item.consumed&&sameDay;
          const consumed=queued?(queuedToday): (hasServerState?serverToday:readFallback(item.id,owner));
          return {...item,persisted:true,consumed,consumed_at:consumed?stamp:null};
        });
        // Una respuesta online vacía es autoritativa: no resucitamos alimentos
        // que fueron eliminados y permanecen solo en una copia local antigua.
        if(!items.length){const fallback=makeFallbackItem(findMeal(mealId),owner);if(fallback)items=[fallback]}
        cache.set(mapKey,{items});
        if(items.some(x=>x.persisted))writeItemCache(mealId,items,owner);
        if(uid()===owner&&Object.keys(pending).length)flushPending().catch(()=>{});
        return items;
      }catch(err){
        console.warn('No se pudieron cargar los alimentos consumibles; se intenta usar la copia local:',err);
        const pending=readPending(owner);
        const today=dateKeyInCordoba(new Date());
        let items=readItemCache(mealId,owner).map(item=>{
          const queued=pending[String(item.id)];const requested=queued?!!queued.consumed:!!item.consumed;
          const stamp=queued?(queued.consumed_at||null):(item.consumed_at||null);
          const consumed=item.persisted?requested&&!!stamp&&dateKeyInCordoba(stamp)===today:requested;
          return {...item,persisted:!!item.persisted,consumed,consumed_at:consumed?stamp:null};
        });
        if(items.length){notifySync('pending','Mostrando los alimentos guardados en este dispositivo; falta confirmar la sincronización.',owner)}else{const fallback=makeFallbackItem(findMeal(mealId),owner);items=fallback?[fallback]:[];notifySync('warning','No se pudieron recuperar los alimentos detallados; se muestra el resumen de respaldo de la comida.',owner)}
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
        <button type="button" class="nutrition-consumption-all" data-consumption-action="toggle-all" ${items.some(item=>!item.__fallback&&grams(item)===null)?'disabled title="Hay alimentos sin equivalencia fiable a gramos. Corregilos primero."':''}>${info.consumed===info.total?'↺ Marcar ninguno':'✓ Marcar todos'}</button>
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
          const weight=item.__fallback?null:grams(item);
          const valid=item.__fallback||weight!==null;
          const factor=item.__fallback?1:(weight===null?0:weight/100);
          const prep=item.preparation_state&&item.preparation_state!=='unspecified'?(item.preparation_state==='raw'?' · Crudo':item.preparation_state==='cooked'?' · Cocido':' · Preparado'):'';
          const qtyLabel=item.__fallback?'Plan completo':`${fmt(qty)} ${esc(unit)}${weight!==null?` (≈ ${fmt(weight)} g)`:''}${prep}`;
          const missing=new Set(missingMetrics(item));
          const plannedMacros=valid?[
            missing.has('calories')?'Calorías: dato faltante':`${fmt(calories*factor)} kcal`,
            missing.has('protein')?'Proteínas: dato faltante':`P ${fmt(protein*factor)} g`,
            missing.has('carbs')?'Carbohidratos: dato faltante':`C ${fmt(carbs*factor)} g`,
            missing.has('fat')?'Grasas: dato faltante':`G ${fmt(fat*factor)} g`
          ].join(' · ')+(missing.size?' · Datos incompletos':''):'No calculable: falta una equivalencia fiable a gramos.';
          const sourceLabel=String(item.data_source_label||item.sourceLabel||'').trim();
          const macroLabel=checked
            ? `${plannedMacros}${sourceLabel?` · Procedencia: ${esc(sourceLabel)}`:''}`
            : `${qtyLabel} · ${plannedMacros}${sourceLabel?` · Procedencia: ${esc(sourceLabel)}`:''} · Pendiente`;
          return `<div class="nutrition-consumption-item ${checked?'is-consumed':''}">
            <span class="nutrition-consumption-check" aria-hidden="true">${checked?'✓':''}</span>
            <span class="nutrition-consumption-name"><strong>${esc(item.name||'Alimento')}</strong><small>${macroLabel}</small></span>
            <button type="button" class="nutrition-consumption-toggle" data-consumption-index="${i}" aria-pressed="${checked?'true':'false'}" ${valid?'':'disabled title="Definí la equivalencia a gramos antes de registrar el consumo."'}>${checked?'✓ Consumido':'○ Consumir'}</button>
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

  async function persistItemConsumption(item,next,owner=uid()){
    if(uid()!==owner)throw new Error('La cuenta activa cambió antes de sincronizar el consumo.');
    if(!(item.persisted&&item.id)){if(item.id)writeFallback(item.id,!!next,owner);return {ok:true,local:true}}
    return withItemSyncLock(owner,item.id,async()=>{
      if(uid()!==owner)throw new Error('La cuenta activa cambió antes de sincronizar el consumo.');
      const operationStartedAt=new Date().toISOString();
      const pendingAtStart=readPending(owner)[String(item.id)]||null;
      if(navigator.onLine){
        try{
          const save=window.AgendaNutritionData?.setMealItemConsumed;
          if(typeof save!=='function')throw new Error('No está disponible el guardado del estado de consumo.');
          const result=await save(item.id,!!next,null,operationStartedAt,owner);
          if(uid()!==owner)throw new Error('La cuenta cambió durante el guardado del consumo; el cambio seguirá pendiente para la cuenta original.');
          if(result?.ok===false||result?.skipped)throw new Error('No se pudo confirmar el guardado del estado de consumo.');
          if(result?.historyOk===false){
            if(!queuePending(item,next,owner,operationStartedAt,pendingAtStart))throw new Error(`El consumo se guardó, pero no se pudo conservar un reintento del historial: ${result.historyError||'error de historial'}`);
            notifySync('warning',`Consumo guardado; el historial sigue pendiente y se reintentará. Revisá sql/07-nutrition-advanced.sql. ${result.historyError||''}`.trim(),owner);
            return {ok:true,pending:true,historyPending:true};
          }
          // Do not erase an entry written by a newer operation while this request ran.
          const queue=readPending(owner);
          if(!sameQueueEntry(queue[String(item.id)]||null,pendingAtStart)) {
            notifySync('pending','El consumo se guardó, pero hay un cambio más reciente pendiente de sincronización.',owner);
            return {ok:true,pending:true,superseded:true};
          }
          if(pendingAtStart){delete queue[String(item.id)];if(!writePending(queue,owner))throw new Error('El consumo se guardó, pero no se pudo actualizar la cola local.');}
          clearFallback(item.id,owner);
          if(!Object.keys(readPending(owner)).length)notifySync('saved','Consumo sincronizado con tu cuenta.',owner);
          return {ok:true};
        }catch(err){
          if(!queuePending(item,next,owner,operationStartedAt,pendingAtStart))throw err;
          return {ok:true,pending:true,error:err};
        }
      }
      if(!queuePending(item,next,owner,operationStartedAt,pendingAtStart))throw new Error('No se pudo guardar el cambio sin conexión.');
      return {ok:true,pending:true};
    });
  }

  async function toggleItem(card,item,next){
    const owner=uid();
    const previous=!!item.consumed;
    const previousAt=item.consumed_at||null;
    item.consumed=!!next;
    item.consumed_at=item.consumed?new Date().toISOString():null;
    renderCardItems(card,cache.get(cacheKey(card.dataset.mealId,owner))?.items||[]);
    writeItemCache(card.dataset.mealId,cache.get(cacheKey(card.dataset.mealId,owner))?.items||[],owner);
    setPanelBusy(card,true);
    emitChange({mealId:String(card.dataset.mealId||''),itemId:item.id?String(item.id):null,item:{...item},consumed:item.consumed});
    try{
      await persistItemConsumption(item,item.consumed,owner);
      if(uid()!==owner)return;
    }catch(err){
      if(uid()!==owner)return;
      item.consumed=previous;
      item.consumed_at=previousAt;
      if(item.id){if(item.persisted)clearFallback(item.id,owner);else writeFallback(item.id,previous,owner)}
      renderCardItems(card,cache.get(cacheKey(card.dataset.mealId,owner))?.items||[]);
      writeItemCache(card.dataset.mealId,cache.get(cacheKey(card.dataset.mealId,owner))?.items||[],owner);
      emitChange({mealId:String(card.dataset.mealId||''),itemId:item.id?String(item.id):null,item:{...item},consumed:previous,rollback:true});
      console.warn('No se pudo guardar el estado consumido:',err);
      try{window.showToast?.('No se pudo guardar el estado de consumo. Se revirtió el cambio.')}catch(_){ }
    }finally{
      setPanelBusy(card,false);
    }
  }

  async function toggleAll(card,items,next){
    const owner=uid();
    const previous=items.map(item=>({item,consumed:!!item.consumed,consumed_at:item.consumed_at||null}));
    const stamp=next?new Date().toISOString():null;
    items.forEach(item=>{item.consumed=!!next;item.consumed_at=stamp});
    renderCardItems(card,items);writeItemCache(card.dataset.mealId,items,owner);setPanelBusy(card,true);
    emitChange({mealId:String(card.dataset.mealId||''),bulk:true,items:items.map(item=>({...item})),consumed:!!next});
    try{
      for(const item of items){await persistItemConsumption(item,next,owner);if(uid()!==owner)return;}
      writeItemCache(card.dataset.mealId,items,owner);
    }catch(err){
      if(uid()!==owner)return;
      previous.forEach(entry=>{entry.item.consumed=entry.consumed;entry.item.consumed_at=entry.consumed_at});
      previous.forEach(entry=>{if(entry.item.id){if(entry.item.persisted)clearFallback(entry.item.id,owner);else writeFallback(entry.item.id,entry.consumed,owner)}});
      renderCardItems(card,items);writeItemCache(card.dataset.mealId,items,owner);
      emitChange({mealId:String(card.dataset.mealId||''),bulk:true,items:items.map(item=>({...item})),consumed:null,rollback:true});
      console.warn('No se pudo conservar localmente todo el cambio de consumo:',err);
      try{window.showToast?.('No se pudo guardar localmente el cambio completo. Se revirtieron los cambios no conservados.')}catch(_){ }
    }finally{setPanelBusy(card,false)}
  }

  async function decorate(){
    const list=$('mealList');
    if(!list)return;
    const owner=uid();
    const cards=[...list.querySelectorAll('.meal-card[data-meal-id]')];
    for(const card of cards){
      if(uid()!==owner)return;
      const mealId=String(card.dataset.mealId||'');
      if(!mealId)continue;
      const items=await getItems(mealId);
      if(uid()!==owner)return;
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
      const owner=uid();
      if(event.detail?.userId&&String(event.detail.userId)!==owner)return;
      invalidate(event.detail?.mealId);
      const queue=readPending(owner);(event.detail?.removedIds||[]).forEach(id=>{delete queue[String(id)];clearFallback(id,owner)});writePending(queue,owner);
      schedule();
    });
    window.addEventListener('online',()=>{flushPending().catch(()=>{});cache.clear();schedule()});
    window.addEventListener('offline',()=>notifySync('pending','Sin conexión: los cambios de consumo se conservarán localmente mientras sea posible.',uid()));
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
      const owner=uid();
      if(event.detail?.userId&&String(event.detail.userId)!==owner)return;
      const mealId=String(event.detail?.mealId||'');if(!mealId)return;
      const queue=readPending(owner);for(const [id,entry] of Object.entries(queue)){if(String(entry?.meal_id||'')===mealId)delete queue[id]}
      writePending(queue,owner);cache.delete(cacheKey(mealId,owner));try{localStorage.removeItem(localItemsKey(mealId,owner))}catch(_){}
      if(!Object.keys(queue).length)notifySync('saved','Comida eliminada y cambios pendientes depurados.',owner);
    });
    decorate().catch(()=>{});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.AgendaNutritionConsumption={refresh:schedule,invalidate,flushPending};
})();
