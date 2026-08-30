(function(){
    'use strict';
    if(window.__agendaV64StabilityInstalled)return;
    window.__agendaV64StabilityInstalled=true;
    function q(id){return document.getElementById(id)}
    function repair(){
      try{
        /* Repara el único punto que quedó expuesto a un typo en el HTML dinámico. */
        const summaries=document.querySelectorAll('.v46-summary .v46-stat');
        if(!q('v46Over')){
          for(const box of summaries){
            const span=box.querySelector('span');
            if(span&&/atrasadas/i.test(span.textContent||'')){
              const value=box.querySelector('strong');
              if(value)value.id='v46Over';
              break;
            }
          }
        }
        /* Garantiza que solo exista un grupo de botones de métrica. */
        const groups=document.querySelectorAll('#progressMetricButtons');
        if(groups.length>1){for(let i=1;i<groups.length;i++)groups[i].remove()}
        /* Corrige accidentalmente el estado visible de navegación si algún panel dinámico fue agregado tarde. */
        const section=(typeof window.v32GetSection==='function'?window.v32GetSection():localStorage.getItem('agendaV32Section'))||'home';
        document.querySelectorAll('.v32-home-pane,.v32-agenda-pane,.v32-calendar-pane,.v32-workout-pane,.v32-nutrition-pane').forEach(el=>{
          const expected=el.classList.contains('v32-home-pane')?'home':el.classList.contains('v32-agenda-pane')?'agenda':el.classList.contains('v32-calendar-pane')?'calendar':el.classList.contains('v32-workout-pane')?'workout':'nutrition';
          if(expected!==section)el.classList.add('v33-section-hidden');
        });
      }catch(err){console.warn('V64 stability',err)}
    }
    function boot(){repair();setTimeout(repair,250);setTimeout(repair,1000)}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  })();
