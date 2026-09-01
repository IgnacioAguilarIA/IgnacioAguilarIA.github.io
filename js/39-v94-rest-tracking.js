(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const escText=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getSession=()=>{try{const uid=window.currentUser?.id||'guest';return JSON.parse(localStorage.getItem(`agendaTrainingV31:${uid}`)||'null')}catch(_){return null}};
  const key=s=>s?.id?`agendaTrainingV94Rest:${s.id}`:null;
  function read(s){try{const k=key(s);return k?JSON.parse(localStorage.getItem(k)||'{"events":[]}')||{events:[]}: {events:[]}}catch(_){return {events:[]}}}
  function write(s,data){try{const k=key(s);if(k)localStorage.setItem(k,JSON.stringify(data))}catch(_){}
  }
  function fmt(sec){sec=Math.max(0,Math.round(Number(sec)||0));return sec<60?`${sec}s`:`${Math.floor(sec/60)}m ${String(sec%60).padStart(2,'0')}s`}
  function ensurePanel(){
    const host=q('v47RepsPanel'); if(!host||q('v94RestPanel'))return;
    const box=document.createElement('div'); box.id='v94RestPanel'; box.className='v94-rest-panel';
    box.innerHTML='<div class="v94-rest-head"><strong>⏱️ Descanso real</strong><span id="v94RestAvg">—</span></div><div class="v94-rest-copy" id="v94RestCopy">Marcá las series normalmente y la app medirá el tiempo entre series.</div><div class="v94-rest-list" id="v94RestList"></div>';
    host.appendChild(box);
  }
  function render(){
    const s=getSession(); if(!s||!q('v47RepsPanel')){q('v94RestPanel')?.remove();return;}
    ensurePanel(); const box=q('v94RestPanel'); if(!box)return;
    const data=read(s), events=Array.isArray(data.events)?data.events:[];
    const host=q('v94RestList'); const avg=q('v94RestAvg'); const copy=q('v94RestCopy');
    if(!events.length){if(avg)avg.textContent='—';if(copy)copy.textContent='Marcá las series normalmente y la app medirá el tiempo entre series.';if(host)host.innerHTML='';return;}
    const vals=events.map(e=>Number(e.seconds)).filter(Number.isFinite).filter(v=>v>=0&&v<=7200);
    const average=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    if(avg)avg.textContent=average==null?'—':`promedio ${fmt(average)}`;
    if(copy)copy.textContent=vals.length?`Registrados ${vals.length} descansos en esta sesión.`:'Todavía no hay descansos medidos.';
    if(host)host.innerHTML=events.slice(-6).reverse().map(e=>`<span>S${Number(e.from)||'?'} → S${(Number(e.from)||0)+1}: <strong>${escText(fmt(e.seconds))}</strong></span>`).join('');
  }
  function handleSeries(){
    const s=getSession();if(!s?.id)return;
    const data=read(s); data.events=Array.isArray(data.events)?data.events:[];
    const now=Date.now(); const last=data.lastMarkedAt;
    if(last){const seconds=Math.max(0,Math.round((now-last)/1000)); if(seconds<=7200){data.events.push({from:Number(data.lastSet)||0,seconds,at:now});if(data.events.length>30)data.events=data.events.slice(-30)}}
    data.lastMarkedAt=now;
    const row=document.querySelectorAll('.v48-set-row'); data.lastSet=row.length; write(s,data); render();
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.v47-set-check'); if(!btn)return;
    setTimeout(()=>{try{if(btn.classList.contains('done'))handleSeries()}catch(_){}},0);
  },true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1200));
  setInterval(render,1500);
})();
