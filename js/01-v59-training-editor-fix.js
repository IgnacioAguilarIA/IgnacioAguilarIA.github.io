(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  function isSetInput(t){return !!t&&t.matches&&t.matches('#v28WorkoutOverlay #v47SetList .v48-set-input');}
  function saveVisible(){
    try{
      const overlay=q('v28WorkoutOverlay');
      if(!overlay?.classList.contains('show'))return;
      const host=q('v47SetList');
      const sessionKey=Object.keys(localStorage).find(k=>k.startsWith('agendaTrainingV31:'));
      // Native session script is authoritative; trigger its visible capture through a safe input event.
      if(host){
        const rows=[...host.querySelectorAll('.v48-set-row')];
        const state=window.__agendaTrainingActualsState;
        if(state?.capture)state.capture();
      }
      // Dispatch a non-bubbling custom signal consumed by this patch if needed.
      document.dispatchEvent(new CustomEvent('agenda-training-fields-saved'));
    }catch(_){ }
  }

  // Capture input before legacy document-level listeners can re-render other training panels.
  document.addEventListener('input',function(e){
    if(!isSetInput(e.target))return;
    try{
      const ev=e.target;
      const row=ev.closest('.v48-set-row');
      const rows=[...document.querySelectorAll('#v47SetList .v48-set-row')];
      const i=rows.indexOf(row);
      const data=window.__agendaTrainingActualsState;
      if(data?.setValue){data.setValue(i,ev);}
    }catch(_){ }
    e.stopImmediatePropagation();
  },true);

  document.addEventListener('change',function(e){
    if(!isSetInput(e.target))return;
    try{
      const ev=e.target;
      const row=ev.closest('.v48-set-row');
      const rows=[...document.querySelectorAll('#v47SetList .v48-set-row')];
      const i=rows.indexOf(row);
      const data=window.__agendaTrainingActualsState;
      if(data?.setValue){data.setValue(i,ev);}
      if(data?.save)data.save();
    }catch(_){ }
    e.stopImmediatePropagation();
  },true);

  document.addEventListener('blur',function(e){
    if(!isSetInput(e.target))return;
    try{
      const ev=e.target;
      const row=ev.closest('.v48-set-row');
      const rows=[...document.querySelectorAll('#v47SetList .v48-set-row')];
      const i=rows.indexOf(row);
      const data=window.__agendaTrainingActualsState;
      if(data?.setValue){data.setValue(i,ev);}
      if(data?.save)data.save();
    }catch(_){ }
  },true);

  // Avoid global click/touch helpers from older versions stealing focus from the editor.
  document.addEventListener('pointerdown',function(e){
    if(!isSetInput(e.target))return;
    e.stopImmediatePropagation();
  },true);

  document.addEventListener('click',function(e){
    if(!isSetInput(e.target))return;
    e.stopImmediatePropagation();
  },true);

  // Stable API used by the editor and by the input guard above.
  function installStateBridge(){
    const bridge={
      capture:function(){
        const host=q('v47SetList'); if(!host)return;
        const rows=[...host.querySelectorAll('.v48-set-row')];
        rows.forEach((row,i)=>{
          const inputs=[...row.querySelectorAll('input')];
          this._values=this._values||{};
          this._values[i]=this._values[i]||{};
          if(inputs[0])this._values[i].reps=inputs[0].value;
          if(inputs[1])this._values[i].weight=inputs[1].value;
          if(inputs[2])this._values[i].rir=inputs[2].value;
        });
      },
      setValue:function(i,ev){
        const row=ev?.closest?.('.v48-set-row'); if(!row)return;
        const inputs=[...row.querySelectorAll('input')];
        const fieldIndex=inputs.indexOf(ev);
        const setIndex=Number(i)||0;
        this._values=this._values||{}; this._values[setIndex]=this._values[setIndex]||{};
        if(fieldIndex===0)this._values[setIndex].reps=String(ev.value??'');
        if(fieldIndex===1)this._values[setIndex].weight=String(ev.value??'');
        if(fieldIndex===2)this._values[setIndex].rir=String(ev.value??'');
        try{
          const key=[...Object.keys(localStorage)].find(k=>k.startsWith('agendaTrainingV31:'));
          if(!key)return;
          const session=JSON.parse(localStorage.getItem(key)||'null');
          if(!session)return;
          const si=Math.max(0,Number(session.currentIndex)||0);
          session.actuals=Array.isArray(session.actuals)?session.actuals:[];
          while(session.actuals.length<=si)session.actuals.push({reps:[],weight:[],rir:[],done:[]});
          const a=session.actuals[si]||(session.actuals[si]={reps:[],weight:[],rir:[],done:[]});
          a.reps=Array.isArray(a.reps)?a.reps:[];
          a.weight=Array.isArray(a.weight)?a.weight:[];
          a.rir=Array.isArray(a.rir)?a.rir:[];
          if(fieldIndex===0)a.reps[setIndex]=String(ev.value??'');
          if(fieldIndex===1)a.weight[setIndex]=String(ev.value??'');
          if(fieldIndex===2)a.rir[setIndex]=String(ev.value??'');
          session.fieldBackup=this._values;
          session.lastSavedAt=Date.now();
          localStorage.setItem(key,JSON.stringify(session));
        }catch(_){ }
      },
      save:function(){try{this.capture();}catch(_){} }
    };
    window.__agendaTrainingActualsState=bridge;
  }
  installStateBridge();

  // Keep the editor above any dynamically-added progress/dashboard layers.
  const observer=new MutationObserver(()=>{
    const host=q('v47SetList');
    if(host){host.style.pointerEvents='auto';host.style.position='relative';host.style.zIndex='20';}
    document.querySelectorAll('#v47SetList .v48-set-input').forEach(i=>{i.style.pointerEvents='auto';i.style.position='relative';i.style.zIndex='21'});
  });
  const overlay=q('v28WorkoutOverlay');
  if(overlay)observer.observe(overlay,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
})();
