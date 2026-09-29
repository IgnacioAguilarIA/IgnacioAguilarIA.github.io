/* V98 — Vista de entrenamiento compacta (estable).
   Importante: no usa MutationObserver ni observa el overlay completo.
   Los módulos avanzados se reubican solo en momentos de interacción.
*/
(function(){
  'use strict';

  const ADVANCED_IDS=['v50PrevPerf','v51TrainingInsights','v52TrainingProgress'];
  const q=id=>document.getElementById(id);
  let moveTimer=null;
  let initialized=false;

  function ensureBox(){
    const overlay=q('v28WorkoutOverlay');
    const shell=overlay?.querySelector('.v28-workout-shell');
    if(!shell)return null;

    let box=q('v28AdvancedDetails');
    if(!box){
      box=document.createElement('section');
      box.id='v28AdvancedDetails';
      box.className='v28-advanced-details';
      const content=document.createElement('div');
      content.className='v28-advanced-content';
      content.id='v28AdvancedContent';
      content.setAttribute('aria-hidden','true');
      const button=document.createElement('button');
      button.type='button';
      button.className='v28-advanced-toggle';
      button.id='v28AdvancedToggle';
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-controls','v28AdvancedContent');
      button.textContent='📊 Ver información avanzada';
      const help=document.createElement('small');
      help.className='v28-advanced-help';
      help.id='v28AdvancedHelp';
      help.textContent='Progreso del ejercicio, rendimiento y último registro. Aparecen solo cuando los necesitás.';
      box.append(content,button,help);
      shell.appendChild(box);
      button.addEventListener('click',toggle,{passive:true});
    }
    return box;
  }

  function movePanels(){
    moveTimer=null;
    const box=ensureBox();
    const content=q('v28AdvancedContent');
    if(!box||!content)return;

    let moved=false;
    ADVANCED_IDS.forEach(id=>{
      const el=q(id);
      if(el && el.parentElement!==content){
        content.appendChild(el);
        moved=true;
      }
    });

    // Por defecto la información avanzada permanece cerrada.
    if(!box.classList.contains('open')){
      if(content.getAttribute('aria-hidden')!=='true')content.setAttribute('aria-hidden','true');
      const button=q('v28AdvancedToggle');
      if(button && button.getAttribute('aria-expanded')!=='false')button.setAttribute('aria-expanded','false');
    }
    return moved;
  }

  function scheduleMove(delay=120){
    clearTimeout(moveTimer);
    moveTimer=setTimeout(movePanels,delay);
  }

  function setOpen(open){
    const overlay=q('v28WorkoutOverlay');
    const box=ensureBox();
    const content=q('v28AdvancedContent');
    const button=q('v28AdvancedToggle');
    const help=q('v28AdvancedHelp');
    if(!box||!content)return;

    box.classList.toggle('open',!!open);
    content.setAttribute('aria-hidden',open?'false':'true');
    if(button){
      button.setAttribute('aria-expanded',open?'true':'false');
      button.textContent=open?'▲ Ocultar información avanzada':'📊 Ver información avanzada';
    }
    if(help){
      help.textContent=open
        ?'Ocultá estos datos cuando no los necesites.'
        :'Progreso del ejercicio, rendimiento y último registro. Aparecen solo cuando los necesitás.';
    }
    if(overlay)overlay.classList.toggle('v28-advanced-open',!!open);
  }

  function toggle(){
    const box=q('v28AdvancedDetails');
    setOpen(!box?.classList.contains('open'));
    scheduleMove(80);
  }

  function closeAdvanced(){
    const box=q('v28AdvancedDetails');
    if(box?.classList.contains('open'))setOpen(false);
  }

  function init(){
    if(initialized)return;
    const overlay=q('v28WorkoutOverlay');
    if(!overlay)return;
    initialized=true;

    ensureBox();
    scheduleMove(250);

    // Reubicar después de las acciones normales de la Vista de Entrenamiento.
    // Esto evita observar el árbol completo del overlay, que podía generar
    // demasiadas mutaciones al combinarse con los módulos antiguos.
    document.addEventListener('click',e=>{
      if(!q('v28WorkoutOverlay')?.classList.contains('show'))return;
      const target=e.target;
      if(target?.closest?.('#v28NextBtn,#v28PrevBtn,#v28FinishBtn,#v28WorkoutClose,#v31MiniOpen,#v31MiniFinish,#v47SetList,#v48SetList'))scheduleMove(180);
      else scheduleMove(280);
    },true);

    document.addEventListener('keydown',e=>{
      if(!q('v28WorkoutOverlay')?.classList.contains('show'))return;
      if(['ArrowLeft','ArrowRight','Escape',' '].includes(e.key))scheduleMove(180);
      if(e.key==='Escape')closeAdvanced();
    },true);

    // Cuando se abre/cierra el overlay, un listener al click de la interfaz
    // alcanza a detectar el estado sin instalar observers permanentes.
    const close=q('v28WorkoutClose');
    close?.addEventListener('click',()=>{closeAdvanced();scheduleMove(50)},{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
