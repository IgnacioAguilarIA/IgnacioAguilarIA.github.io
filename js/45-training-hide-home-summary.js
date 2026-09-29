/* Agenda FICH · Limpieza visual de Entrenamiento
 * No modifica la lógica de datos: solo oculta en la sección Entrenamiento
 * los elementos generales que pertenecen a Inicio.
 */
(function(){
  'use strict';

  const CLEAN_CLASS='training-top-clean';

  function apply(section){
    document.body.classList.toggle(CLEAN_CLASS, section==='workout');
  }

  function currentSection(){
    try{
      if(typeof window.v32GetSection==='function') return window.v32GetSection();
    }catch(_){ }
    try{
      return localStorage.getItem('agendaV32Section')||'home';
    }catch(_){
      return 'home';
    }
  }

  function wrapNavigation(){
    if(typeof window.v32SetSection!=='function' || window.v32SetSection.__trainingCleanWrapped) return;
    const original=window.v32SetSection;
    const wrapped=async function(name,options){
      const result=await original(name,options);
      apply(currentSection()||name);
      return result;
    };
    wrapped.__trainingCleanWrapped=true;
    wrapped.__trainingCleanOriginal=original;
    window.v32SetSection=wrapped;
  }

  function boot(){
    apply(currentSection());
    wrapNavigation();

    document.addEventListener('click',event=>{
      const btn=event.target?.closest?.('[data-v32-section]');
      if(!btn) return;
      const section=btn.dataset.v32Section||'home';
      setTimeout(()=>apply(section),0);
    },true);

    setTimeout(()=>{
      wrapNavigation();
      apply(currentSection());
    },100);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
