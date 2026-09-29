/* Agenda FICH · V98 · estabilidad / experiencia offline
 * Cambios aislados: no modifica Entrenamiento ni Time-blocking.
 */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);

  function ensureConnectionBar(){
    if(q('v98ConnectionStatus')) return q('v98ConnectionStatus');
    const el=document.createElement('div');
    el.id='v98ConnectionStatus';
    el.className='v98-connection-status';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.innerHTML='<span class="v98-connection-dot" aria-hidden="true"></span><span id="v98ConnectionText"></span>';
    document.body.appendChild(el);
    return el;
  }
  function showConnection(state,text,ms){
    const el=ensureConnectionBar();
    const tx=q('v98ConnectionText');
    el.classList.remove('online','offline','show');
    el.classList.add(state,'show');
    if(tx)tx.textContent=text;
    if(ms){clearTimeout(showConnection._timer);showConnection._timer=setTimeout(()=>el.classList.remove('show'),ms)}
  }
  function syncConnection(){
    if(navigator.onLine){
      const el=q('v98ConnectionStatus');
      if(el?.classList.contains('offline')) showConnection('online','Conexión recuperada · sincronizando…',2600);
      return;
    }
    showConnection('offline','Sin conexión · los cambios nuevos quedan guardados localmente.',0);
  }

  function refreshAgendaViews(){
    try{window.updateStats?.()}catch(_){ }
    try{window.renderDashboard?.()}catch(_){ }
    try{window.renderConflicts?.()}catch(_){ }
    try{window.renderTodayTimeline?.()}catch(_){ }
    try{window.render40?.()}catch(_){ }
  }

  function wrapAction(name){
    const original=window[name];
    if(typeof original!=='function'||original.__v98Refresh)return false;
    const wrapped=async function(){
      try{return await original.apply(this,arguments)}
      finally{setTimeout(refreshAgendaViews,0)}
    };
    wrapped.__v98Refresh=true;
    wrapped.__v98Original=original;
    window[name]=wrapped;
    return true;
  }

  function installActionWrappers(){
    wrapAction('deleteTask');
    wrapAction('toggleTaskComplete');
  }

  function boot(){
    ensureConnectionBar();
    syncConnection();
    window.addEventListener('offline',()=>showConnection('offline','Sin conexión · los cambios nuevos quedan guardados localmente.',0));
    window.addEventListener('online',()=>{showConnection('online','Conexión recuperada · sincronizando…',2600);setTimeout(refreshAgendaViews,900)});
    installActionWrappers();
    // V40 instala sus propios wrappers unos instantes después; volvemos a envolver
    // una vez más para que también los cambios offline actualicen los resúmenes.
    setTimeout(installActionWrappers,900);
    setTimeout(installActionWrappers,2200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
