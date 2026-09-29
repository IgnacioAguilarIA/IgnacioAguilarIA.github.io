/* V98 — Vista de entrenamiento compacta.
   Oculta la información avanzada por defecto y la mueve al final de la vista.
   No cambia la lógica de registro, temporizadores, cancelación ni guardado.
*/
(function(){
  'use strict';

  const ADVANCED_IDS=['v50PrevPerf','v51TrainingInsights','v52TrainingProgress'];

  function q(id){return document.getElementById(id)}

  function ensureBox(){
    const overlay=q('v28WorkoutOverlay');
    const shell=overlay?.querySelector('.v28-workout-shell');
    if(!shell)return null;

    let box=q('v28AdvancedDetails');
    if(box && box.parentElement===shell)return box;

    box=document.createElement('section');
    box.id='v28AdvancedDetails';
    box.className='v28-advanced-details';
    box.innerHTML=`
      <div class="v28-advanced-content" id="v28AdvancedContent" aria-hidden="true"></div>
      <button class="v28-advanced-toggle" id="v28AdvancedToggle" type="button" aria-expanded="false" aria-controls="v28AdvancedContent">
        📊 Ver información avanzada
      </button>
      <small class="v28-advanced-help" id="v28AdvancedHelp">Progreso del ejercicio, rendimiento y último registro. Aparecen solo cuando los necesitás.</small>
    `;
    shell.appendChild(box);

    const button=q('v28AdvancedToggle');
    if(button){
      button.addEventListener('click',toggle);
    }
    return box;
  }

  function movePanels(){
    const box=ensureBox();
    const content=q('v28AdvancedContent');
    if(!box||!content)return;

    ADVANCED_IDS.forEach(id=>{
      const el=q(id);
      if(el && el.parentElement!==content)content.appendChild(el);
    });
  }

  function setOpen(open){
    const overlay=q('v28WorkoutOverlay');
    const box=ensureBox();
    const content=q('v28AdvancedContent');
    const button=q('v28AdvancedToggle');
    const help=q('v28AdvancedHelp');
    if(!box||!content)return;

    box.classList.toggle('open',open);
    content.setAttribute('aria-hidden',open?'false':'true');
    if(button){
      button.setAttribute('aria-expanded',open?'true':'false');
      button.textContent=open?'▲ Ocultar información avanzada':'📊 Ver información avanzada';
    }
    if(help)help.textContent=open?'Ocultá estos datos cuando no los necesites.':'Progreso del ejercicio, rendimiento y último registro. Aparecen solo cuando los necesitás.';
    if(overlay)overlay.classList.toggle('v28-advanced-open',open);
  }

  function toggle(){
    const box=q('v28AdvancedDetails');
    setOpen(!box?.classList.contains('open'));
  }

  function resetClosed(){
    setOpen(false);
    movePanels();
  }

  function init(){
    const overlay=q('v28WorkoutOverlay');
    if(!overlay)return;

    ensureBox();
    movePanels();
    resetClosed();

    // Algunos paneles son creados dinámicamente por V50/V51/V52.
    // Observamos solo cambios de hijos del overlay para llevarlos al final.
    const observer=new MutationObserver(()=>{
      movePanels();
      if(!q('v28AdvancedDetails')?.classList.contains('open'))setOpen(false);
    });
    observer.observe(overlay,{childList:true,subtree:true});

    // Cada apertura de una nueva sesión/vista comienza compacta.
    const classObserver=new MutationObserver(()=>{
      if(overlay.classList.contains('show')){
        movePanels();
        if(!overlay.classList.contains('v28-advanced-open'))setOpen(false);
      }
    });
    classObserver.observe(overlay,{attributes:true,attributeFilter:['class']});

    // Los nombres de los ejercicios cambian dentro de la misma vista. Movemos
    // cualquier panel que haya vuelto a ser insertado por otro módulo.
    const name=q('v28CurrentName');
    if(name)new MutationObserver(()=>setTimeout(movePanels,0)).observe(name,{childList:true,characterData:true,subtree:true});

    // Tras la carga de todos los scripts, hacemos un último ordenamiento.
    setTimeout(()=>{movePanels();resetClosed()},900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
