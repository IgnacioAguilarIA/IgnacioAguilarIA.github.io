(function(){
  'use strict';
  const q=id=>document.getElementById(id);const pad=n=>String(n).padStart(2,'0');
  function week(){const now=typeof getArgentinaNow==='function'?getArgentinaNow():new Date();const idx=typeof getTodayIndex==='function'?getTodayIndex():((now.getDay()+6)%7);const mon=new Date(now);mon.setHours(12,0,0,0);mon.setDate(mon.getDate()-idx);return {mon,idx}}
  function key(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  function render(){try{const host=q('v52WeekGrid');if(!host)return;const w=week();const logs=typeof workoutLogs!=='undefined'?workoutLogs:[];host.innerHTML='';let total=0;for(let i=0;i<7;i++){const d=new Date(w.mon);d.setDate(w.mon.getDate()+i);const k=key(d);const count=logs.filter(l=>String(l.performed_at||'')===k).length;total+=count;const day=document.createElement('div');day.className='v52-day'+(i===w.idx?' today':'');day.innerHTML=`<strong>${['L','M','X','J','V','S','D'][i]}</strong><span>${pad(d.getDate())}/${pad(d.getMonth()+1)}</span><div class="v52-day-bar"><i style="width:${Math.min(100,count?100:0)}%"></i></div><span>${count} ${count===1?'sesión':'sesiones'}</span>`;host.appendChild(day)}q('v52WeekTotal').textContent=`${total} ${total===1?'sesión':'sesiones'}`}catch(e){console.warn('V52 dashboard',e)}}
  function init(){render();setInterval(render,30000);document.addEventListener('visibilitychange',()=>document.visibilityState==='visible'&&render())}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
