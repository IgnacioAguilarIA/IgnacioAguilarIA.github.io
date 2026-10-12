/* Agenda FICH — Etapa C2: auditoría final de estados, mensajes y reintento de Alimentación.
   Alcance intencionalmente limitado a los componentes nutricionales. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const SYNC_ID='nutritionSyncStatus';
  const RETRY_ID='nutritionSyncRetryButton';
  const TARGETS=[
    '#nutritionSyncStatus','#nutritionMealOrderStatus',
    '#nutritionFoodCatalogStatus','#nutritionMealBuilderStatus','#nutritionMealCopyStatus',
    '#nutritionCopyDayStatus','#nutritionStatsStatus','#nutritionGoalSummary',
    '.nutrition-meal-copy-status','.nutrition-routine-status','.nutrition-advanced-status',
    '.nutrition-meal-builder-status','.nutrition-food-catalog-status','.nutrition-meal-order-status'
  ].join(',');
  const stateClass=['is-saved','is-pending','is-warning','is-error'];
  let observer=null;
  let syncState='unknown';
  let observedUid='';
  let retryBusy=false;

  function activeUser(){try{return typeof currentUser!=='undefined'&&currentUser?.id?String(currentUser.id):''}catch(_){return ''}}
  function classifyStatusText(value){
    const text=String(value||'').trim().toLocaleLowerCase('es');
    if(!text)return 'neutral';
    if(/no se pudo|no se pudieron|no se pudo confirmar|no fue posible|error|fall[oó]|rechazad[oa]|cancelad[oa]|no se guard[oó]|no se elimin[oó]|no se duplic[oó]|revis[aá] la conexi[oó]n|incompleta/.test(text))return 'error';
    if(/sin conexi[oó]n|pendiente|esperando|buscando|cargando|sincronizando|reintentando|por sincronizar/.test(text))return 'pending';
    if(/[✓✔]/.test(text)||/guardad[oa]s? en tu cuenta|sincronizad[oa]s? con tu cuenta|completad[oa]s?|restaurad[oa]s?|duplicad[oa]s? en|se guard[oó] correctamente/.test(text))return 'success';
    return 'neutral';
  }
  function statusText(node){
    if(!node)return '';
    if(node.id===SYNC_ID)return ($('nutritionSyncStatusText')?.textContent||node.textContent||'').trim();
    return String(node.textContent||'').trim();
  }
  function isStatusNode(node){
    if(!node||node.nodeType!==1||node.id==='nutritionSyncStatusText')return false;
    const id=String(node.id||'');
    const cls=typeof node.className==='string'?node.className:'';
    return /status/i.test(id)||/(^|\s)[\w-]*status(?:\s|$)/i.test(cls)||node.getAttribute?.('role')==='status';
  }
  function decorateStatus(node){
    if(!isStatusNode(node))return;
    // No pisar un role=alert deliberado; status nutricionales se anuncian de forma cortés.
    if(!node.hasAttribute('role'))node.setAttribute('role','status');
    if(!node.hasAttribute('aria-live'))node.setAttribute('aria-live','polite');
    node.setAttribute('aria-atomic','true');
    const state=classifyStatusText(statusText(node));
    node.dataset.nutritionState=state;
    node.classList.toggle('nutrition-status-error',state==='error');
    node.classList.toggle('nutrition-status-pending',state==='pending');
    node.classList.toggle('nutrition-status-success',state==='success');
  }
  function collectStatuses(root=document){
    if(root?.nodeType===1&&isStatusNode(root))decorateStatus(root);
    root.querySelectorAll?.(TARGETS).forEach(decorateStatus);
  }
  function updateRetryVisibility(){
    const button=$(RETRY_ID);if(!button)return;
    const shouldShow=!!activeUser()&&navigator.onLine&&['warning','error'].includes(syncState)&&!retryBusy;
    button.hidden=!shouldShow;
    button.disabled=retryBusy||!navigator.onLine;
    if(!retryBusy)button.textContent='Reintentar sincronización';
  }
  function resetForAccount(nextUid){
    observedUid=String(nextUid||'');
    syncState='unknown';
    const status=$(SYNC_ID);const textNode=$('nutritionSyncStatusText');
    if(status){
      stateClass.forEach(name=>status.classList.remove(name));
      status.dataset.syncState='unknown';
      status.dataset.nutritionState='pending';
    }
    if(textNode){
      textNode.textContent=observedUid?'Comprobando la sincronización de la cuenta activa…':'Iniciá sesión para comprobar la sincronización nutricional.';
      decorateStatus(textNode);
    }
    if(status)decorateStatus(status);
    updateRetryVisibility();
  }
  function detectAccountChange(){
    const actual=activeUser();
    if(actual!==observedUid)resetForAccount(actual);
  }
  function ensureRetryButton(){
    const status=$(SYNC_ID);if(!status||$(RETRY_ID))return;
    const button=document.createElement('button');
    button.type='button';button.id=RETRY_ID;button.className='nutrition-sync-retry';
    button.textContent='Reintentar sincronización';button.hidden=true;
    button.setAttribute('aria-describedby','nutritionSyncStatusText');
    button.addEventListener('click',retrySync);
    status.insertAdjacentElement('afterend',button);
    updateRetryVisibility();
  }
  async function retrySync(){
    detectAccountChange();
    if(retryBusy)return;
    const owner=activeUser();const button=$(RETRY_ID);const sync=window.AgendaNutritionSync;const consumption=window.AgendaNutritionConsumption;
    if(!owner||!button)return;
    if(!navigator.onLine){updateRetryVisibility();return}
    const jobs=[];
    if(typeof sync?.syncNow==='function')jobs.push(Promise.resolve().then(()=>sync.syncNow()));
    if(typeof consumption?.flushPending==='function')jobs.push(Promise.resolve().then(()=>consumption.flushPending()));
    if(!jobs.length){sync?.setStatus?.('error','No está disponible el mecanismo de sincronización. Recargá la aplicación e intentá nuevamente.',owner);return}
    retryBusy=true;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Reintentando…';
    try{
      const results=await Promise.allSettled(jobs);
      if(activeUser()!==owner)return;
      if(results.some(result=>result.status==='rejected')){
        sync?.setStatus?.('warning','El reintento no pudo confirmar todos los cambios. Tus datos locales se conservan; revisá el estado y volvé a intentarlo.',owner);
      }
      // No se marca como guardado aquí: solo los módulos propietarios pueden confirmar el guardado.
    }catch(_){
      if(activeUser()===owner)sync?.setStatus?.('warning','No se pudo completar el reintento. Tus datos locales se conservan; volvé a intentarlo.',owner);
    }finally{
      retryBusy=false;
      const current=$(RETRY_ID);
      if(current){current.removeAttribute('aria-busy');current.disabled=false;current.textContent='Reintentar sincronización'}
      updateRetryVisibility();
    }
  }
  function handleSyncEvent(event){
    detectAccountChange();
    const detail=event?.detail||{};const owner=detail.userId?String(detail.userId):'';
    if(owner&&activeUser()!==owner)return;
    const next=String(detail.state||'unknown');
    syncState=['saved','pending','warning','error'].includes(next)?next:'unknown';
    if(owner)observedUid=owner;
    const status=$(SYNC_ID);
    if(status){
      stateClass.forEach(name=>status.classList.remove(name));
      if(syncState==='saved')status.classList.add('is-saved');
      else if(syncState==='pending')status.classList.add('is-pending');
      else if(syncState==='warning')status.classList.add('is-warning');
      else if(syncState==='error')status.classList.add('is-error');
      status.dataset.syncState=syncState;
      decorateStatus(status);decorateStatus($('nutritionSyncStatusText'));
    }
    updateRetryVisibility();
  }
  function init(){
    observedUid=activeUser();
    collectStatuses();ensureRetryButton();
    const status=$(SYNC_ID);
    if(status){
      if(status.classList.contains('is-error'))syncState='error';
      else if(status.classList.contains('is-warning'))syncState='warning';
      else if(status.classList.contains('is-pending'))syncState='pending';
      else if(status.classList.contains('is-saved'))syncState='saved';
      updateRetryVisibility();
    }
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(records=>{
        const nodes=new Set();
        for(const record of records){
          if(record.target?.nodeType===1){const target=record.target.closest?.(TARGETS);if(target)nodes.add(target);if(isStatusNode(record.target))nodes.add(record.target)}
          for(const node of record.addedNodes||[]){if(node?.nodeType===1){if(isStatusNode(node))nodes.add(node);node.querySelectorAll?.(TARGETS).forEach(item=>nodes.add(item))}}
        }
        nodes.forEach(decorateStatus);
      });
      observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    }
  }
  document.addEventListener('agenda:nutrition-sync-status',handleSyncEvent);
  window.addEventListener('online',()=>{detectAccountChange();updateRetryVisibility()});
  window.addEventListener('offline',()=>{detectAccountChange();updateRetryVisibility()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){detectAccountChange();updateRetryVisibility()}});
  if(window.sb?.auth?.onAuthStateChange&&!window.__agendaNutritionFinalAuditAuthBound){
    window.__agendaNutritionFinalAuditAuthBound=true;
    window.sb.auth.onAuthStateChange((_event,session)=>{
      const next=String(session?.user?.id||'');
      if(next!==observedUid)resetForAccount(next);
    });
  }
  window.AgendaNutritionFinalAudit={classifyStatusText,decorateStatus,updateRetryVisibility,retrySync};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
