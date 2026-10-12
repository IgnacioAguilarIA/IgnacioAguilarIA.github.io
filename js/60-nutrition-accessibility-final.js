/* Agenda FICH — Etapa C1: ajustes de accesibilidad solo para Alimentación. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const states=new WeakMap();
  const isOpen=overlay=>!!overlay?.classList.contains('show');

  function visibleFocusables(root){
    return [...root.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(el=>!el.hidden&&el.getAttribute('aria-hidden')!=='true'&&el.getAttribute('tabindex')!=='-1'&&el.getClientRects().length);
  }

  function improveLabels(root){
    if(!root)return;
    root.querySelectorAll('.field').forEach(field=>{
      const labels=[...field.querySelectorAll('label')].filter(label=>!label.htmlFor);
      const controls=[...field.querySelectorAll('input,select,textarea')].filter(control=>!control.disabled);
      if(labels.length===1&&controls.length===1){
        const control=controls[0];
        if(!control.id)control.id=`nutritionAccessibleField${++improveLabels.sequence}`;
        labels[0].htmlFor=control.id;
      }
    });
  }
  improveLabels.sequence=0;

  function enhanceDayControls(){
    const days=$('nutritionDays');
    if(days){
      days.setAttribute('role','group');
      days.setAttribute('aria-label','Seleccionar día de alimentación');
      days.querySelectorAll('button').forEach(button=>{
        const selected=button.classList.contains('active');
        button.setAttribute('aria-pressed',String(selected));
        if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',`Mostrar comidas del ${button.textContent.trim()}`);
      });
    }
    const tabs=$('mealTabs');
    if(tabs){
      tabs.setAttribute('role','group');
      tabs.setAttribute('aria-label','Filtrar comidas por horario');
      tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
    }
  }

  function enhanceDialog(overlayId,titleId,descriptionId,closeFn){
    const overlay=$(overlayId);if(!overlay||overlay.dataset.nutritionA11yReady==='1')return;
    overlay.dataset.nutritionA11yReady='1';
    const dialog=overlay.querySelector('.modal');if(!dialog)return;
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('tabindex','-1');
    const title=dialog.querySelector('h3');
    if(title){if(!title.id)title.id=titleId;dialog.setAttribute('aria-labelledby',title.id)}
    const description=dialog.querySelector(`#${descriptionId}`)||dialog.querySelector('.modal-head span');
    if(description){if(!description.id)description.id=descriptionId;dialog.setAttribute('aria-describedby',description.id)}
    overlay.setAttribute('aria-hidden',isOpen(overlay)?'false':'true');
    const initial={open:isOpen(overlay),trigger:null,overflow:''};states.set(overlay,initial);
    overlay.addEventListener('keydown',event=>{
      if(!isOpen(overlay))return;
      if(event.key==='Escape'){event.preventDefault();closeFn();return;}
      if(event.key!=='Tab')return;
      const focusable=visibleFocusables(dialog);
      if(!focusable.length){event.preventDefault();dialog.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
    });
    const observer=new MutationObserver(()=>{
      const state=states.get(overlay);const now=isOpen(overlay);
      if(now&&!state.open){
        state.open=true;state.trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
        state.overflow=document.body.style.overflow;document.body.style.overflow='hidden';overlay.setAttribute('aria-hidden','false');
        requestAnimationFrame(()=>{if(isOpen(overlay)&&!dialog.contains(document.activeElement)){const first=visibleFocusables(dialog)[0];(first||dialog).focus({preventScroll:true})}});
      }else if(!now&&state.open){
        state.open=false;overlay.setAttribute('aria-hidden','true');document.body.style.overflow=state.overflow;
        if(state.trigger?.isConnected)requestAnimationFrame(()=>{try{state.trigger.focus({preventScroll:true})}catch(_){state.trigger.focus()}});
        state.trigger=null;
      }
    });
    observer.observe(overlay,{attributes:true,attributeFilter:['class']});
    improveLabels(dialog);
  }

  function init(){
    improveLabels($('nutritionPanel'));improveLabels($('nutritionOverlay'));improveLabels($('goalOverlay'));
    enhanceDayControls();
    const dayHost=$('nutritionDays'),mealHost=$('mealTabs');
    const observeRerender=(host)=>{if(!host)return;const observer=new MutationObserver(enhanceDayControls);observer.observe(host,{childList:true,subtree:true})};
    observeRerender(dayHost);observeRerender(mealHost);
    enhanceDialog('nutritionOverlay','nutritionModalTitle','nutritionModalInfo',()=>{if(typeof closeNutritionModal==='function')closeNutritionModal()});
    enhanceDialog('goalOverlay','nutritionGoalModalTitle','nutritionGoalModalInfo',()=>{if(typeof closeGoalsModal==='function')closeGoalsModal()});
  }
  window.AgendaNutritionAccessibility={enhanceDayControls,improveLabels,visibleFocusables};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
