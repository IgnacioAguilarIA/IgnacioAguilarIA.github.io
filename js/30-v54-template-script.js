(function(){
  const q=id=>document.getElementById(id);
  const key=()=>`agendaV54:${currentUser?.id||'guest'}:templates`;
  const defaults=[
    {id:'study',title:'Estudiar',description:'Bloque de estudio concentrado',priority:'high'},
    {id:'errand',title:'Trámite / compra',description:'Tarea personal rápida',priority:'normal'},
    {id:'workout',title:'Entrenamiento',description:'Sesión de entrenamiento',priority:'normal'}
  ];
  function escSafe(v){return typeof esc==='function'?esc(String(v||'')):String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function read(){try{const x=JSON.parse(localStorage.getItem(key())||'null');return Array.isArray(x)&&x.length?x:defaults.map(x=>({...x}))}catch{return defaults.map(x=>({...x}))}}
  function write(a){try{localStorage.setItem(key(),JSON.stringify(a))}catch(e){console.warn('V54 storage',e)}}
  function priorityText(p){return p==='urgent'?'🔴 Urgente':p==='high'?'🟠 Alta':p==='low'?'⚪ Baja':'🔵 Normal'}
  function render(){const host=q('v54TemplateList');if(!host)return;const arr=read();host.innerHTML='';arr.slice(0,9).forEach(t=>{const b=document.createElement('button');b.type='button';b.className='v54-template';b.innerHTML=`<strong>⚡ ${escSafe(t.title)}</strong><span>${escSafe(t.description||'Sin descripción')} · ${priorityText(t.priority)}</span>`;b.onclick=()=>use(t);host.appendChild(b)});if(!arr.length)host.innerHTML='<div class="v54-empty">Todavía no tenés plantillas.</div>'}
  function use(t){try{const now=typeof getArgentinaNow==='function'?getArgentinaNow():new Date();selectedDay=typeof getTodayIndex==='function'?getTodayIndex():selectedDay;selectedHour=Math.max(7,Math.min(22,now.getHours()));if(typeof openTaskModal!=='function'){alert('No pude abrir el editor de tareas.');return}openTaskModal(selectedHour,0);setTimeout(()=>{if(q('taskTitleInput'))q('taskTitleInput').value=t.title||'';if(q('taskDescInput'))q('taskDescInput').value=t.description||'';if(q('taskPriorityInput'))q('taskPriorityInput').value=t.priority||'normal'},80)}catch(e){console.warn('V54 template',e)}}
  function add(){const title=prompt('Nombre de la plantilla:');if(!title?.trim())return;const description=prompt('Descripción opcional:')||'';const raw=prompt('Prioridad: urgent / high / normal / low','normal')||'normal';const priority=['urgent','high','normal','low'].includes(raw)?raw:'normal';const arr=read();arr.push({id:`tpl-${Date.now()}`,title:title.trim(),description:description.trim(),priority});write(arr);render()}
  function reset(){if(!confirm('¿Restaurar las plantillas de ejemplo?'))return;write(defaults.map(x=>({...x})));render()}
  function bind(){q('v54NewTemplate')?.addEventListener('click',add);q('v54ResetTemplates')?.addEventListener('click',reset);render()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
