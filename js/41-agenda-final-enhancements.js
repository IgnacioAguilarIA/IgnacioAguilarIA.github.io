/* Mejoras seguras de Agenda. No toca entrenamiento ni persiste datos nuevos. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,'0');
  const nowFn=()=>typeof getArgentinaNow==='function'?getArgentinaNow():new Date();
  const todayIdx=()=>typeof getTodayIndex==='function'?getTodayIndex():((nowFn().getDay()+6)%7);
  const mins=t=>((Number(t?.hour)||0)*60)+(Number(t?.minute)||0);
  const taskDay=()=>Number(typeof selectedDay!=='undefined'?selectedDay:todayIdx());
  function ensureBar(){
    if(!$('schedule')||$('agendaLiveBar')) return;
    const bar=document.createElement('div');
    bar.id='agendaLiveBar';bar.className='agenda-livebar';
    bar.innerHTML='<div class="agenda-liveitem"><strong id="agendaLiveSelected">—</strong><span>Día seleccionado</span></div><div class="agenda-liveitem next"><strong id="agendaLiveNext">—</strong><span>Próxima tarea</span></div><div class="agenda-liveitem done"><strong id="agendaLiveDone">0/0</strong><span>Completadas</span></div>';
    const parent=$('schedule').parentElement;
    parent.insertBefore(bar,$('schedule'));
  }
  function updateBar(){
    ensureBar();
    const ts=typeof tasks!=='undefined'&&Array.isArray(tasks)?tasks:[];
    const d=taskDay();
    const list=ts.filter(t=>Number(t.day)===d).sort((a,b)=>mins(a)-mins(b));
    const now=nowFn(), today=todayIdx(), nowMin=now.getHours()*60+now.getMinutes();
    const done=list.filter(t=>t.completed).length;
    const pending=list.filter(t=>!t.completed);
    let next=null;
    if(d===today) next=pending.find(t=>mins(t)>=nowMin)||pending[0];
    else next=pending[0];
    const dayName=(typeof DAYS!=='undefined'&&DAYS[d])||'Día seleccionado';
    $('agendaLiveSelected').textContent=dayName;
    $('agendaLiveDone').textContent=`${done}/${list.length}`;
    $('agendaLiveNext').textContent=next?`${pad(Number(next.hour)||0)}:${pad(Number(next.minute)||0)} · ${next.title||'Tarea'}`:'Sin pendientes';
  }
  function decorate(){
    const host=$('schedule');if(!host)return;
    const ts=typeof tasks!=='undefined'&&Array.isArray(tasks)?tasks:[];
    const d=taskDay(), now=nowFn(), today=todayIdx(), nowMin=now.getHours()*60+now.getMinutes();
    host.querySelectorAll('.hour').forEach(row=>row.classList.remove('agenda-current-hour'));
    if(d===today){const current=Math.floor(nowMin/60);const rows=host.querySelectorAll('.hour');if(typeof HOURS!=='undefined'){const idx=HOURS.indexOf(current);if(idx>=0&&rows[idx])rows[idx].classList.add('agenda-current-hour')}}
    host.querySelectorAll('.task').forEach(card=>{
      card.classList.remove('agenda-overdue','agenda-upcoming');
      card.querySelectorAll('.agenda-state').forEach(x=>x.remove());
      const timeEl=card.querySelector('.task-time'), titleEl=card.querySelector('h4');
      if(!timeEl||!titleEl)return;
      const parts=timeEl.textContent.trim().split(':').map(Number);const h=parts[0]||0,m=parts[1]||0;
      const title=titleEl.textContent.trim();
      const task=ts.find(t=>Number(t.day)===d&&Number(t.hour)===h&&Number(t.minute)===m&&String(t.title||'').trim()===title);
      if(!task)return;
      const badge=document.createElement('div');badge.className='agenda-state';
      if(task.completed){badge.classList.add('done');badge.textContent='✓ Completada';}
      else if(d===today && mins(task)<nowMin){card.classList.add('agenda-overdue');badge.classList.add('overdue');badge.textContent='⚠ Atrasada';}
      else {card.classList.add('agenda-upcoming');badge.classList.add('upcoming');badge.textContent=(d===today&&mins(task)>=nowMin)?'● Próxima':'○ Pendiente';}
      card.appendChild(badge);
    });
    updateBar();
  }
  function hook(){
    if(typeof window.renderSchedule==='function'&&!window.__agendaEnhancedRender){
      const original=window.renderSchedule;
      window.renderSchedule=function(){const out=original.apply(this,arguments);setTimeout(decorate,0);return out;};
      window.__agendaEnhancedRender=true;
    }
    if(typeof window.renderDashboard==='function'&&!window.__agendaEnhancedDash){
      const originalDash=window.renderDashboard;
      window.renderDashboard=function(){const out=originalDash.apply(this,arguments);setTimeout(updateBar,0);return out;};
      window.__agendaEnhancedDash=true;
    }
    if(document.readyState!=='loading'){ensureBar();setTimeout(decorate,0);}else document.addEventListener('DOMContentLoaded',()=>{ensureBar();setTimeout(decorate,0)},{once:true});
    setInterval(()=>{decorate();},30000);
  }
  hook();
})();
