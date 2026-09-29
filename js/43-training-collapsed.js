/* V98 — entrenamiento compacto.
   No modifica la lógica de entrenamiento ni la Vista de Entrenamiento.
   Solo controla la visibilidad de los paneles avanzados del módulo principal. */
(function(){
  'use strict';

  function setup(){
    const panel=document.getElementById('workoutPanel');
    const list=document.getElementById('workoutList');
    if(!panel||!list||document.getElementById('trainingDetailsToggleWrap'))return;

    const wrap=document.createElement('div');
    wrap.id='trainingDetailsToggleWrap';

    const button=document.createElement('button');
    button.type='button';
    button.className='training-details-toggle';
    button.id='trainingDetailsToggle';
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls','workoutPanel');

    const help=document.createElement('small');
    help.className='training-details-help';
    help.textContent='Historial, estadísticas, progreso, récords y comparaciones.';

    wrap.append(button,help);
    list.insertAdjacentElement('afterend',wrap);

    const renderState=()=>{
      const open=document.body.classList.contains('v98-training-details-open');
      button.setAttribute('aria-expanded',open?'true':'false');
      button.textContent=open?'▲ Ocultar estadísticas y progreso':'📊 Ver estadísticas y progreso';
      wrap.appendChild(help);
    };

    button.addEventListener('click',()=>{
      const open=!document.body.classList.contains('v98-training-details-open');
      document.body.classList.toggle('v98-training-details-open',open);
      panel.classList.toggle('training-details-open',open);
      renderState();
    });

    renderState();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
