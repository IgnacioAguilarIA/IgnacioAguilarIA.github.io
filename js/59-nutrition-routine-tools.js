/* Agenda FICH — Etapa B3: repetir días, deshacer la última eliminación y estadísticas con días registrados explícitos.
   Este módulo actúa únicamente sobre Alimentación. */
(function(){
  'use strict';

  const STYLE_ID='nutritionRoutineToolsStyles';
  const COPY_MODAL_ID='nutritionCopyDayModal';
  const STATS_MODAL_ID='nutritionStatsModal';
  const $=id=>document.getElementById(id);
  let copyBusy=false;
  let statsBusy=false;
  let statsRequestSeq=0;
  let undoBusy=false;
  let undoSnapshot=null;
  let undoTimeout=null;
  let undoToast=null;

  function esc(value){const d=document.createElement('div');d.textContent=value==null?'':String(value);return d.innerHTML}
  function activeUid(){return String((typeof currentUser!=='undefined'&&currentUser?.id)||'')}
  function selectedDay(){const d=Number(typeof nutritionDay!=='undefined'?nutritionDay:0);return Number.isInteger(d)&&d>=0&&d<=6?d:0}
  function dayNames(){return Array.isArray(typeof DAYS!=='undefined'?DAYS:null)?DAYS:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']}
  function assertOwner(owner){if(!owner||activeUid()!==String(owner))throw new Error('La cuenta activa cambió. Se canceló la operación para proteger tus datos.')}
  function client(){if(typeof sb==='undefined'||!sb)throw new Error('Supabase no está disponible. Revisá la conexión.');return sb}
  function nutritionApi(){if(!window.AgendaNutritionData)throw new Error('Falta cargar el módulo de datos de Alimentación.');return window.AgendaNutritionData}
  function setStatus(id,message){const el=$(id);if(el)el.textContent=message}

  function injectStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent='/* Los estilos principales se encuentran en css/80-nutrition-routine-tools.css. */';document.head.appendChild(style);
  }

  function addActionButton(id,label,title,handler){
    const host=document.querySelector('#nutritionPanel .nutrition-actions');
    if(!host||$(id))return;
    const btn=document.createElement('button');btn.type='button';btn.className='small-btn nutrition-routine-action';btn.id=id;btn.textContent=label;btn.title=title;btn.addEventListener('click',handler);host.insertBefore(btn,host.querySelector('#addMealBtn')||null);
  }

  function showToast(message){
    let toast=$('nutritionRoutineToast');if(toast)toast.remove();
    toast=document.createElement('div');toast.id='nutritionRoutineToast';toast.className='nutrition-routine-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
    const text=document.createElement('span');text.textContent=message;toast.appendChild(text);document.body.appendChild(toast);
    setTimeout(()=>toast.remove(),5500);
  }

  function createModal(id,title,description,bodyHtml,primaryLabel,onPrimary){
    const existing=$(id);if(existing)existing.remove();
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousBodyOverflow=document.body.style.overflow;
    const overlay=document.createElement('div');overlay.id=id;overlay.className='nutrition-routine-overlay';
    overlay.innerHTML=`<section class="nutrition-routine-modal" role="dialog" aria-modal="true" aria-labelledby="${id}Title" aria-describedby="${id}Description" tabindex="-1"><header class="nutrition-routine-head"><div><h3 id="${id}Title">${esc(title)}</h3><p id="${id}Description">${esc(description)}</p></div><button class="nutrition-routine-close" type="button" aria-label="Cerrar ventana">×</button></header><div class="nutrition-routine-body">${bodyHtml}</div><footer class="nutrition-routine-actions"><button class="nutrition-routine-secondary" type="button" data-routine-cancel>Cancelar</button><button class="nutrition-routine-primary" type="button" data-routine-primary>${esc(primaryLabel)}</button></footer></section>`;
    document.body.style.overflow='hidden';
    document.body.appendChild(overlay);
    let closed=false;
    const close=()=>{
      if(closed)return;
      closed=true;overlay.remove();document.body.style.overflow=previousBodyOverflow;
      if(previousFocus?.isConnected)requestAnimationFrame(()=>{try{previousFocus.focus({preventScroll:true})}catch(_){previousFocus.focus()}});
    };
    const focusable=()=>[...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(el=>!el.hidden&&el.getAttribute('aria-hidden')!=='true'&&el.getAttribute('tabindex')!=='-1'&&el.getClientRects().length);
    overlay.querySelector('.nutrition-routine-close')?.addEventListener('click',close);
    overlay.querySelector('[data-routine-cancel]')?.addEventListener('click',close);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
    overlay.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
      if(event.key!=='Tab')return;
      const items=focusable();
      if(!items.length){event.preventDefault();overlay.querySelector('[role="dialog"]')?.focus();return;}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first.focus();}
    });
    overlay.querySelector('[data-routine-primary]')?.addEventListener('click',()=>onPrimary(overlay,close));
    requestAnimationFrame(()=>{if(!overlay.contains(document.activeElement)){const first=focusable()[0];(first||overlay.querySelector('[role="dialog"]'))?.focus({preventScroll:true})}});
    return overlay;
  }

  function openCopyDay(){
    if($(COPY_MODAL_ID))return;
    const names=dayNames();const owner=activeUid();const safety=window.AgendaNutritionMealSaveSafety;
    let pending=null;let pendingError=null;
    if(owner&&safety?.readOperation){try{pending=safety.readOperation(owner,'repeat-day')}catch(error){pendingError=error}}
    const source=pending?Number(pending.payload?.sourceDay):selectedDay();
    const target=pending?Number(pending.payload?.targetDay):(source+1)%7;
    const safeSource=Number.isInteger(source)&&source>=0&&source<=6?source:selectedDay();
    const safeTarget=Number.isInteger(target)&&target>=0&&target<=6&&target!==safeSource?target:(safeSource+1)%7;
    const options=names.map((name,index)=>`<option value="${index}" ${index===safeSource?'selected':''}>${esc(name)}</option>`).join('');
    const targetOptions=names.map((name,index)=>`<option value="${index}" ${index===safeTarget?'selected':''}>${esc(name)}</option>`).join('');
    const message=pendingError?String(pendingError.message||'No se pudo leer el lote pendiente.'):pending?'Se recuperó una copia pendiente. Se reutilizarán las mismas claves para completar sin duplicar las comidas ya guardadas.':'La copia necesita conexión para verificar y guardar todos los alimentos.';
    const body=`<div class="nutrition-routine-field"><label for="nutritionCopyDaySource">Copiar las comidas de</label><select id="nutritionCopyDaySource" class="input">${options}</select></div><div class="nutrition-routine-field"><label for="nutritionCopyDayTarget">Agregar una copia en</label><select id="nutritionCopyDayTarget" class="input">${targetOptions}</select></div><p class="nutrition-routine-note">Se copian las comidas y sus cantidades. Los alimentos quedan <strong>sin marcar como consumidos</strong>. Las comidas que ya existan en el destino se conservan; no se reemplaza ni se borra nada.</p><div id="nutritionCopyDayStatus" class="nutrition-routine-status" role="status" aria-live="polite">${esc(message)}</div>`;
    const overlay=createModal(COPY_MODAL_ID,'🔁 Repetir un día','Copiá tu plan a otro día sin alterar el original.',body,pending?'Reanudar copia': 'Copiar día',runCopyDay);
    if(pending||pendingError){const sourceField=$('nutritionCopyDaySource');const targetField=$('nutritionCopyDayTarget');if(sourceField)sourceField.disabled=true;if(targetField)targetField.disabled=true}
    if(pendingError){const primary=overlay?.querySelector('[data-routine-primary]');if(primary)primary.disabled=true}
  }

  function copiedMealPayload(meal,targetDay,owner){
    const payload={...meal};
    delete payload.id;delete payload.created_at;delete payload.updated_at;delete payload.save_request_id;
    payload.user_id=String(owner);payload.day=Number(targetDay);
    return payload;
  }
  function copiedItemsForMeal(items,newMealId,owner){
    return (Array.isArray(items)?items:[]).map(item=>{
      const copy={...item};delete copy.id;delete copy.created_at;delete copy.updated_at;
      copy.meal_id=String(newMealId);copy.user_id=String(owner);copy.consumed=false;copy.consumed_at=null;
      return copy;
    });
  }

  async function runCopyDay(overlay,close){
    if(copyBusy)return;
    const owner=activeUid();const sourceDay=Number($('nutritionCopyDaySource')?.value);const targetDay=Number($('nutritionCopyDayTarget')?.value);
    const status=$('nutritionCopyDayStatus');const primary=overlay.querySelector('[data-routine-primary]');
    const names=dayNames();const safety=window.AgendaNutritionMealSaveSafety;
    if(!owner){if(status)status.textContent='Iniciá sesión para repetir un día.';return}
    if(!Number.isInteger(sourceDay)||sourceDay<0||sourceDay>6||!Number.isInteger(targetDay)||targetDay<0||targetDay>6){if(status)status.textContent='Elegí días válidos.';return}
    if(sourceDay===targetDay){if(status)status.textContent='Elegí un día de destino distinto al día de origen.';return}
    if(!safety?.readOperation||!safety?.saveOperation||!safety?.clearOperation||!safety?.upsertMeal){if(status)status.textContent='Falta el módulo de operaciones seguras. Recargá la página antes de copiar un día.';return}
    copyBusy=true;if(primary){primary.disabled=true;primary.textContent='Preparando copia…'}
    let operation=null;
    const scope=`${sourceDay}:${targetDay}`;
    try{
      assertOwner(owner);
      const c=client();
      operation=safety.readOperation(owner,'repeat-day',scope);
      if(operation){
        const sourceField=$('nutritionCopyDaySource');const targetField=$('nutritionCopyDayTarget');
        if(sourceField)sourceField.disabled=true;if(targetField)targetField.disabled=true;
        if(status)status.textContent='↻ Se recuperó una copia pendiente. Se reutilizarán las mismas claves y las comidas ya guardadas no se duplicarán.';
        const entries=operation.payload?.entries;
        if(Number(operation.payload?.sourceDay)!==sourceDay||Number(operation.payload?.targetDay)!==targetDay)throw new Error('El diario de copia no coincide con los días elegidos. No se realizó ninguna escritura.');
        if(!Array.isArray(entries)||!entries.length)throw new Error('El lote pendiente no contiene comidas recuperables. No se sobrescribió.');
        const requestIds=new Set();
        for(const entry of entries){
          if(!entry||typeof entry!=='object'||!Array.isArray(entry.sourceItems)||!entry.destinationPayload||typeof entry.destinationPayload!=='object')throw new Error('Una entrada del lote pendiente está incompleta. No se realizó ninguna escritura.');
          if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(entry.requestId||'')))throw new Error('Una comida del lote pendiente no tiene una clave idempotente válida. No se realizó ninguna escritura.');
          if(Number(entry.destinationPayload.day)!==targetDay||String(entry.destinationPayload.user_id||owner)!==owner||!String(entry.destinationPayload.title||'').trim())throw new Error('Una comida del lote pendiente no coincide con la cuenta, día o título de destino. No se realizó ninguna escritura.');
          if(requestIds.has(String(entry.requestId)))throw new Error('El lote contiene claves repetidas. No se realizó ninguna escritura.');
          requestIds.add(String(entry.requestId));
        }
      }else{
        const sourceRes=await c.from('nutrition_meals').select('*').eq('user_id',owner).eq('day',sourceDay).order('meal_order',{ascending:true}).order('meal_time',{ascending:true});
        if(sourceRes.error)throw sourceRes.error;assertOwner(owner);
        const meals=Array.isArray(sourceRes.data)?sourceRes.data:[];
        if(!meals.length)throw new Error(`No hay comidas guardadas para ${names[sourceDay]}. No se modificó el destino.`);
        if(status)status.textContent=`Preparando ${meals.length} comida(s) y cargando sus alimentos…`;
        const api=nutritionApi();
        const prepared=await Promise.all(meals.map(async meal=>({meal,items:await api.loadMealItems(String(meal.id),owner)})));
        assertOwner(owner);
        const targetRes=await c.from('nutrition_meals').select('id').eq('user_id',owner).eq('day',targetDay);
        if(targetRes.error)throw targetRes.error;assertOwner(owner);
        const targetCount=Array.isArray(targetRes.data)?targetRes.data.length:0;
        if(targetCount){
          const confirmed=window.confirm(`${names[targetDay]} ya tiene ${targetCount} comida(s). Se agregarán ${meals.length} copias, sin reemplazar lo que ya existe. ¿Continuar?`);
          if(!confirmed){if(status)status.textContent='Copia cancelada. No se modificó ningún dato.';return}
          assertOwner(owner);
        }
        const entries=prepared.map(({meal,items})=>({
          sourceMealId:String(meal.id),requestId:safety.newRequestId(),destinationPayload:copiedMealPayload(meal,targetDay,owner),
          sourceItems:items.map(item=>({...item})),destinationMealId:null,mainSaved:false,itemsSaved:false
        }));
        operation={version:1,operationId:safety.newRequestId(),operationType:'repeat-day',userId:owner,scope,createdAt:new Date().toISOString(),payload:{sourceDay,targetDay,entries}};
        safety.saveOperation(operation);
        const sourceField=$('nutritionCopyDaySource');const targetField=$('nutritionCopyDayTarget');
        if(sourceField)sourceField.disabled=true;if(targetField)targetField.disabled=true;
      }
      const entries=operation.payload.entries;
      for(let index=0;index<entries.length;index++){
        assertOwner(owner);
        if(status)status.textContent=`Guardando comida ${index+1} de ${entries.length}… Si se interrumpe la conexión, podés reintentar esta misma copia.`;
        const entry=entries[index];
        if(!entry?.requestId||!entry?.destinationPayload||!Array.isArray(entry.sourceItems))throw new Error(`La comida ${index+1} del lote pendiente está incompleta. No se creó otra copia.`);
        const destination=entry.destinationPayload;
        const saved=await safety.upsertMeal(c,destination,owner,Number(operation.payload.targetDay),entry.requestId,Number(destination.meal_order));
        assertOwner(owner);
        if(!saved?.id)throw new Error(`Supabase no devolvió el identificador de la comida ${index+1}. El lote quedó pendiente.`);
        entry.destinationMealId=String(saved.id);entry.mainSaved=true;safety.saveOperation(operation);
        const copied=copiedItemsForMeal(entry.sourceItems,entry.destinationMealId,owner);
        const result=await nutritionApi().persistMealItems(entry.destinationMealId,copied,owner);
        if(result?.ok===false)throw new Error(`No se pudo confirmar el detalle de la comida ${index+1}.`);
        assertOwner(owner);
        entry.itemsSaved=true;safety.saveOperation(operation);
      }
      const completedCount=entries.length;
      if(!safety.clearOperation(owner,'repeat-day',operation.operationId))throw new Error('La copia terminó, pero no se pudo limpiar el diario local. Reintentá la misma operación para confirmar sin duplicar comidas.');
      close();
      showToast(`✓ Se copiaron ${completedCount} comidas de ${names[sourceDay]} a ${names[targetDay]}. Ningún alimento quedó marcado como consumido.`);
      try{
        if(typeof selectNutritionDay==='function')await selectNutritionDay(targetDay);
        else if(typeof loadNutritionMeals==='function')await loadNutritionMeals(targetDay);
      }catch(refreshError){console.warn('Las comidas se copiaron, pero no se pudo actualizar la vista del día de destino:',refreshError);showToast('Las comidas se copiaron correctamente. Cambiá al día de destino para actualizar la vista.')}
    }catch(error){
      console.error('Error al repetir el día de Alimentación:',error);
      if(status)status.textContent=`No se completó la copia: ${error?.message||'error desconocido'}. ${operation?'El lote queda guardado localmente; «Reintentar copia» reutiliza las mismas claves y no elimina filas a ciegas.':'No se inició ninguna escritura de comidas.'}`;
      if(primary){primary.disabled=false;primary.textContent=operation?'Reintentar copia pendiente':'Reintentar copia'}
    }finally{
      copyBusy=false;
      const stillOpen=$(COPY_MODAL_ID);const stillPrimary=stillOpen?.querySelector('[data-routine-primary]');
      if(stillPrimary&&stillPrimary.disabled){stillPrimary.disabled=false;if(stillPrimary.textContent==='Preparando copia…')stillPrimary.textContent='Copiar día'}
    }
  }

  function dateKeyArgentina(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
  }
  function shiftDateKey(key,delta){const [y,m,d]=String(key).split('-').map(Number);return new Date(Date.UTC(y,m-1,d+delta,12)).toISOString().slice(0,10)}
  function round1(v){return Math.round((Number(v)||0)*10)/10}
  function fmtCalories(v){return `${Math.round(Number(v)||0).toLocaleString('es-AR')} kcal`}
  function fmtGrams(v){return `${round1(v).toLocaleString('es-AR',{maximumFractionDigits:1})} g`}
  function dateLabel(key){try{return new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(key+'T12:00:00Z')).replace('.','')}catch(_){return key}}

  function aggregateHistory(rows,todayKey,periodDays){
    const startKey=shiftDateKey(todayKey,1-periodDays);const byDay=new Map();
    for(const row of (Array.isArray(rows)?rows:[])){
      const key=String(row?.consumed_date||'');if(key<startKey||key>todayKey||!/^\d{4}-\d{2}-\d{2}$/.test(key))continue;
      const current=byDay.get(key)||{date:key,records:0,calories:0,protein_g:0,carbs_g:0,fat_g:0};
      current.records+=1;current.calories+=Number(row.calories)||0;current.protein_g+=Number(row.protein_g)||0;current.carbs_g+=Number(row.carbs_g)||0;current.fat_g+=Number(row.fat_g)||0;byDay.set(key,current);
    }
    const days=[];
    for(let offset=periodDays-1;offset>=0;offset--){const key=shiftDateKey(todayKey,-offset);const found=byDay.get(key);days.push(found?{...found,recorded:true}:{date:key,records:0,calories:0,protein_g:0,carbs_g:0,fat_g:0,recorded:false})}
    const recorded=days.filter(day=>day.recorded);const sum=key=>recorded.reduce((acc,day)=>acc+day[key],0);
    const average=key=>recorded.length?sum(key)/recorded.length:null;
    return {startDate:startKey,endDate:todayKey,periodDays,days,registeredDays:recorded.length,unregisteredDays:periodDays-recorded.length,averages:{calories:average('calories'),protein_g:average('protein_g'),carbs_g:average('carbs_g'),fat_g:average('fat_g')},totals:{calories:sum('calories'),protein_g:sum('protein_g'),carbs_g:sum('carbs_g'),fat_g:sum('fat_g')}};
  }

  function makeStatsModal(){
    const body=`<div class="nutrition-routine-stats-controls"><label for="nutritionStatsPeriod">Período</label><select id="nutritionStatsPeriod" class="input"><option value="7">Últimos 7 días</option><option value="30" selected>Últimos 30 días</option></select><button type="button" class="nutrition-routine-secondary" id="nutritionStatsRefresh">Actualizar</button></div><div id="nutritionStatsStatus" class="nutrition-routine-status" role="status" aria-live="polite">Cargando historial registrado…</div><div id="nutritionStatsContent"></div><p class="nutrition-routine-note">Los promedios se calculan solo sobre los días que tienen al menos un registro en el historial. «Sin registros» no equivale a consumo cero; un día con entradas cuyos nutrientes suman cero se muestra como «Registrado · 0 kcal».</p>`;
    return createModal(STATS_MODAL_ID,'📊 Estadísticas nutricionales','Resumen del historial realmente marcado como consumido, no de las comidas planificadas.',body,'Cerrar',(_,close)=>close());
  }

  function statsCard(label,value,sub){const card=document.createElement('div');card.className='nutrition-routine-stat-card';const h=document.createElement('span');h.textContent=label;const strong=document.createElement('strong');strong.textContent=value;const small=document.createElement('small');small.textContent=sub;card.append(h,strong,small);return card}
  function renderStats(data,period){
    const host=$('nutritionStatsContent');if(!host)return;host.innerHTML='';
    const summary=document.createElement('div');summary.className='nutrition-routine-stat-grid';
    const suffix=`promedio en ${data.registeredDays} día(s) con registro`;
    summary.append(
      statsCard('Calorías diarias',data.averages.calories===null?'—':fmtCalories(data.averages.calories),suffix),
      statsCard('Proteínas diarias',data.averages.protein_g===null?'—':fmtGrams(data.averages.protein_g),suffix),
      statsCard('Carbohidratos diarios',data.averages.carbs_g===null?'—':fmtGrams(data.averages.carbs_g),suffix),
      statsCard('Grasas diarias',data.averages.fat_g===null?'—':fmtGrams(data.averages.fat_g),suffix)
    );host.appendChild(summary);
    const count=document.createElement('p');count.className='nutrition-routine-stats-count';count.textContent=`Período de ${period} días: ${data.registeredDays} día(s) con registros y ${data.unregisteredDays} día(s) sin registros.`;host.appendChild(count);
    const title=document.createElement('h4');title.className='nutrition-routine-stats-heading';title.textContent=period===7?'Detalle diario':'Últimos 7 días';host.appendChild(title);
    const tableWrap=document.createElement('div');tableWrap.className='nutrition-routine-table-wrap';
    const table=document.createElement('table');table.className='nutrition-routine-table';
    const thead=document.createElement('thead');const trHead=document.createElement('tr');['Día','Estado','Calorías','Proteínas'].forEach(label=>{const th=document.createElement('th');th.textContent=label;trHead.appendChild(th)});thead.appendChild(trHead);table.appendChild(thead);
    const tbody=document.createElement('tbody');const visible=period===7?data.days:data.days.slice(-7);
    visible.forEach(day=>{const tr=document.createElement('tr');const date=document.createElement('td');date.textContent=dateLabel(day.date);const status=document.createElement('td');status.textContent=day.recorded?(day.calories===0&&day.protein_g===0&&day.carbs_g===0&&day.fat_g===0?'Registrado · 0 nutrientes':'Registrado'):'Sin registros';status.className=day.recorded?'is-recorded':'is-unrecorded';const kcal=document.createElement('td');kcal.textContent=day.recorded?fmtCalories(day.calories):'—';const protein=document.createElement('td');protein.textContent=day.recorded?fmtGrams(day.protein_g):'—';tr.append(date,status,kcal,protein);tbody.appendChild(tr)});
    table.appendChild(tbody);tableWrap.appendChild(table);host.appendChild(tableWrap);
  }

  async function loadStats(){
    const request=++statsRequestSeq;const owner=activeUid();const status=$('nutritionStatsStatus');const host=$('nutritionStatsContent');const period=Number($('nutritionStatsPeriod')?.value)||30;
    if(!owner){if(status)status.textContent='Iniciá sesión para consultar tus estadísticas.';if(host)host.innerHTML='';return}
    statsBusy=true;if(status)status.textContent='Consultando el historial…';if(host)host.innerHTML='';
    try{
      const today=dateKeyArgentina();const start=shiftDateKey(today,-29);const pageSize=500;const rows=[];const c=client();
      for(let offset=0;offset<100000;offset+=pageSize){
        assertOwner(owner);
        const res=await c.from('nutrition_consumption_history').select('consumed_date,calories,protein_g,carbs_g,fat_g').eq('user_id',owner).gte('consumed_date',start).lte('consumed_date',today).order('consumed_date',{ascending:true}).range(offset,offset+pageSize-1);
        if(res.error)throw res.error;assertOwner(owner);if(request!==statsRequestSeq)return;
        const batch=Array.isArray(res.data)?res.data:[];rows.push(...batch);if(batch.length<pageSize)break;
        if(offset+pageSize>=100000)throw new Error('El historial supera el límite seguro de lectura para este informe. Exportá el historial o reducí el período.');
      }
      if(request!==statsRequestSeq)return;
      const grouped=aggregateHistory(rows,today,period);renderStats(grouped,period);
      if(status)status.textContent=rows.length?`Historial actualizado hasta ${today}. Se encontraron ${rows.length} registro(s).`:'No hay entradas de consumo en el período. Los días aparecen como «Sin registros», no como cero.';
    }catch(error){if(request!==statsRequestSeq)return;console.error('No se pudieron cargar las estadísticas de Alimentación:',error);if(status)status.textContent=`No se pudieron cargar las estadísticas: ${error?.message||'error desconocido'}. No se muestran ceros como sustituto del historial.`;if(host)host.innerHTML=''}
    finally{if(request===statsRequestSeq)statsBusy=false}
  }

  function openStats(){
    if($(STATS_MODAL_ID))return;
    makeStatsModal();$('nutritionStatsPeriod')?.addEventListener('change',loadStats);$('nutritionStatsRefresh')?.addEventListener('click',loadStats);
    loadStats();
  }

  function removeUndoToast(){if(undoTimeout)clearTimeout(undoTimeout);undoTimeout=null;if(undoToast)undoToast.remove();undoToast=null}
  function offerUndo(snapshot){
    undoSnapshot=snapshot;removeUndoToast();
    const toast=document.createElement('div');toast.id='nutritionUndoToast';toast.className='nutrition-routine-toast nutrition-routine-undo';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
    const message=document.createElement('span');message.textContent=`Se eliminó «${snapshot.meal.title||'Comida'}». Podés deshacerlo durante 30 segundos.`;
    const button=document.createElement('button');button.type='button';button.textContent='Deshacer';button.addEventListener('click',restoreLastDeletion);
    toast.append(message,button);document.body.appendChild(toast);undoToast=toast;
    undoTimeout=setTimeout(()=>{if(undoToast===toast){toast.remove();undoToast=null;undoSnapshot=null;undoTimeout=null}},30000);
  }

  function comparableValue(value){
    if(value===null||value===undefined)return '';
    if(typeof value==='object')return JSON.stringify(value);
    return String(value);
  }
  function rowMatchesSnapshot(row,snapshot,fields){return fields.every(field=>comparableValue(row?.[field])===comparableValue(snapshot?.[field]))}
  const MEAL_RESTORE_FIELDS=['id','user_id','day','meal_type','meal_order','title','foods','calories','protein_g','carbs_g','fat_g','meal_time','description','save_request_id'];
  const ITEM_RESTORE_FIELDS=['id','user_id','meal_id','catalog_id','user_food_id','source','external_id','data_source_label','data_source_url','nutrition_quality_status','nutrition_missing_fields','nutrition_verified_at','name','brand','quantity','unit','quantity_in_grams','preparation_state','density_g_per_ml','grams_per_unit','grams_per_portion','serving_size','calories_per_100g','protein_per_100g','carbs_per_100g','fat_per_100g','fiber_per_100g','ingredients','categories','labels','image_url','consumed','consumed_at'];

  async function restoreLastDeletion(){
    if(undoBusy||!undoSnapshot)return;undoBusy=true;const snapshot=undoSnapshot;const button=undoToast?.querySelector('button');if(button){button.disabled=true;button.textContent='Restaurando…'}
    try{
      assertOwner(snapshot.owner);const c=client();
      const mealId=String(snapshot.meal?.id||'');if(!mealId)throw new Error('La copia de recuperación no contiene un ID de comida válido.');
      const found=await c.from('nutrition_meals').select('*').eq('id',mealId).eq('user_id',snapshot.owner).maybeSingle();
      if(found.error)throw found.error;assertOwner(snapshot.owner);
      let restoredMeal=found.data||null;
      if(restoredMeal&&!rowMatchesSnapshot(restoredMeal,{...snapshot.meal,user_id:snapshot.owner},MEAL_RESTORE_FIELDS)){
        throw new Error('Ya existe una comida con ese ID, pero sus datos no coinciden con la instantánea que se quería restaurar. No la sobrescribí; revisá el registro para evitar perder cambios más recientes.');
      }
      if(!restoredMeal){
        const mealPayload={...snapshot.meal,user_id:snapshot.owner};delete mealPayload.created_at;delete mealPayload.updated_at;
        const inserted=await c.from('nutrition_meals').upsert(mealPayload,{onConflict:'id'}).select('*').single();
        if(inserted.error)throw inserted.error;assertOwner(snapshot.owner);
        if(!inserted.data?.id)throw new Error('Supabase no confirmó la comida restaurada. El intento sigue disponible para reintentar con el mismo ID.');
        restoredMeal=inserted.data;
      }
      const originalItems=Array.isArray(snapshot.items)?snapshot.items:[];
      const ids=originalItems.map(item=>String(item?.id||''));
      if(originalItems.some((item,index)=>!ids[index])||new Set(ids).size!==ids.length)throw new Error('La instantánea de alimentos contiene identificadores faltantes o repetidos. No se restauró parcialmente.');
      if(originalItems.length){
        const existingResult=await c.from('nutrition_meal_items').select('*').eq('user_id',snapshot.owner).in('id',ids);
        if(existingResult.error)throw existingResult.error;assertOwner(snapshot.owner);
        const existingRows=Array.isArray(existingResult.data)?existingResult.data:[];
        const existingById=new Map(existingRows.map(row=>[String(row.id),row]));
        for(const item of originalItems){
          const existing=existingById.get(String(item.id));
          if(existing){
            if(String(existing.user_id)!==String(snapshot.owner)||String(existing.meal_id)!==mealId)throw new Error(`El alimento ${item.name||item.id} ya está asociado a otro registro. No se lo movió ni sobrescribió.`);
            if(!rowMatchesSnapshot(existing,{...item,user_id:snapshot.owner,meal_id:mealId},ITEM_RESTORE_FIELDS))throw new Error(`El alimento «${item.name||item.id}» ya existe con datos diferentes. No se sobrescribió una posible edición más reciente.`);
          }
        }
        const missing=originalItems.filter(item=>!existingById.has(String(item.id))).map(item=>{
          const row={...item,user_id:snapshot.owner,meal_id:mealId};delete row.created_at;delete row.updated_at;return row;
        });
        if(missing.length){
          const restoredItems=await c.from('nutrition_meal_items').insert(missing);
          if(restoredItems.error)throw restoredItems.error;
          assertOwner(snapshot.owner);
        }
      }
      const verify=await c.from('nutrition_meal_items').select('id').eq('meal_id',mealId).eq('user_id',snapshot.owner);
      if(verify.error)throw verify.error;assertOwner(snapshot.owner);
      const verifiedIds=new Set((Array.isArray(verify.data)?verify.data:[]).map(row=>String(row.id)));
      const missingAfterVerify=originalItems.filter(item=>!verifiedIds.has(String(item.id)));
      if(missingAfterVerify.length)throw new Error(`La comida existe, pero faltan ${missingAfterVerify.length} alimento(s) por restaurar. El reintento conserva los mismos identificadores.`);
      document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-saved',{detail:{mealId,meal:restoredMeal,day:Number(restoredMeal.day),userId:snapshot.owner,restored:true}}));
      undoSnapshot=null;removeUndoToast();
      if(typeof selectNutritionDay==='function')await selectNutritionDay(Number(restoredMeal.day));
      showToast('✓ Comida y alimentos restaurados. Si se perdió una respuesta, podés reintentar sin duplicar sus identificadores.');
    }catch(error){
      console.error('No se pudo deshacer la eliminación de Alimentación:',error);
      if(undoToast){const message=undoToast.querySelector('span');if(message)message.textContent=`No se pudo confirmar la restauración: ${error?.message||'error desconocido'}. La opción sigue disponible mientras no venza; reintentar no elimina filas para compensar.`;const btn=undoToast.querySelector('button');if(btn){btn.disabled=false;btn.textContent='Reintentar restauración'}}
    }finally{undoBusy=false}
  }

  function installDeleteUndo(){
    let original=null;
    try{original=typeof window.deleteMeal==='function'?window.deleteMeal:(typeof deleteMeal==='function'?deleteMeal:null)}catch(_){original=window.deleteMeal||null}
    if(typeof original!=='function'||original.__nutritionRoutineUndoWrapped)return;
    const wrapped=async function(id){
      const owner=activeUid();
      const meal=(Array.isArray(typeof nutritionMeals!=='undefined'?nutritionMeals:null)?nutritionMeals:[]).find(row=>String(row.id)===String(id)&&String(row.user_id||'')===owner);
      if(!owner||!meal)return original.apply(this,arguments);
      let snapshot;
      try{
        const items=await nutritionApi().loadMealItems(String(id),owner);
        assertOwner(owner);
        snapshot={owner,meal:{...meal},items:(Array.isArray(items)?items:[]).map(item=>({...item})),capturedAt:Date.now()};
      }catch(error){
        console.error('No se pudo preparar la recuperación antes de eliminar la comida:',error);
        window.alert('No se eliminó la comida porque no pude preparar una copia de recuperación de sus alimentos. Revisá la conexión y volvé a intentar.');
        return;
      }
      let deleted=false;
      const onDeleted=event=>{if(String(event.detail?.mealId||'')===String(id)&&String(event.detail?.userId||'')===owner)deleted=true};
      document.addEventListener('agenda:nutrition-meal-deleted',onDeleted);
      try{await original.apply(this,arguments)}finally{document.removeEventListener('agenda:nutrition-meal-deleted',onDeleted)}
      if(deleted&&activeUid()===owner)offerUndo(snapshot);
    };
    wrapped.__nutritionRoutineUndoWrapped=true;wrapped.__nutritionRoutineUndoOriginal=original;
    // Reasignar también el binding global cubre páginas donde la función esté
    // disponible como declaración global aunque no se consulte mediante window.
    try{if(typeof deleteMeal==='function')deleteMeal=wrapped}catch(_){}
    window.deleteMeal=wrapped;
  }

  function init(){
    injectStyles();
    addActionButton('nutritionCopyDayBtn','🔁 Copiar día','Repetir las comidas de un día en otro sin marcarlas como consumidas',openCopyDay);
    addActionButton('nutritionStatsBtn','📊 Estadísticas','Consultar promedios de consumo según el historial registrado',openStats);
    installDeleteUndo();
    let reinstallScheduled=false;
    const observer=new MutationObserver(()=>{
      if(reinstallScheduled)return;
      reinstallScheduled=true;
      requestAnimationFrame(()=>{
        reinstallScheduled=false;
        if(!window.deleteMeal?.__nutritionRoutineUndoWrapped)installDeleteUndo();
      });
    });
    const panel=$('nutritionPanel');if(panel)observer.observe(panel,{childList:true,subtree:true});
  }

  window.AgendaNutritionRoutineTools={openCopyDay,openStats,undo:restoreLastDeletion,aggregateHistory,copiedMealPayload,copiedItemsForMeal};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
