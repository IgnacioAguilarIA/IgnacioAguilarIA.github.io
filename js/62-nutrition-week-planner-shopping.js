(function(){
  'use strict';
  const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const DAY_KEYS=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  const MEALS=['desayuno','media_manana','almuerzo','merienda','cena','colacion'];
  const MEAL_LABELS={desayuno:'Desayuno',media_manana:'Media mañana',almuerzo:'Almuerzo',merienda:'Merienda',cena:'Cena',colacion:'Colación'};
  const $=id=>document.getElementById(id);
  let plannerModal=null,shoppingModal=null,plannerBusy=false,shoppingBusy=false,manualSaving=false;
  let plannerRequest=0,shoppingRequest=0,selectedWeek='';
  let plannerTrigger=null,shoppingTrigger=null;

  function currentUid(){try{return typeof currentUser!=='undefined'&&currentUser?.id?String(currentUser.id):String(window.currentUser?.id||'')}catch(_){return String(window.currentUser?.id||'')}}
  function assertOwner(owner){if(!owner||currentUid()!==owner)throw new Error('La cuenta activa cambió. No se continuó la operación para evitar mezclar datos entre cuentas. Volvé a abrir la herramienta con la cuenta correcta.')}
  async function client(){if(typeof ensureSupabase!=='function')throw new Error('Supabase todavía no está disponible. Recargá la aplicación cuando tengas conexión.');return await ensureSupabase()}
  function clean(v){return String(v??'').trim()}
  function normalize(v){return clean(v).toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
  function safeNumber(v){if(v===null||v===undefined||clean(v)==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
  function datePartsArgentina(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${o.year}-${o.month}-${o.day}`;
  }
  function isoAdd(iso,days){const [y,m,d]=iso.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d+days));return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`}
  function mondayIso(iso){const [y,m,d]=iso.split('-').map(Number);const weekday=new Date(Date.UTC(y,m-1,d)).getUTCDay();return isoAdd(iso,-((weekday+6)%7))}
  function currentMonday(){return mondayIso(datePartsArgentina())}
  function formatDate(iso){const [y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat('es-AR',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)))}
  function weekRange(iso){return `${formatDate(iso)} – ${formatDate(isoAdd(iso,6))}`}
  function escText(v){return String(v??'')}
  function canonicalUnit(value){const u=normalize(value);const aliases={gramo:'g',gramos:'g',gram:'g',grams:'g',g:'g',mililitro:'ml',mililitros:'ml',milliliter:'ml',milliliters:'ml',ml:'ml',unidad:'unit',unidades:'unit',pieza:'unit',piezas:'unit',unit:'unit',units:'unit',porcion:'portion',porciones:'portion',racion:'portion',raciones:'portion',portion:'portion',portions:'portion',kilogramo:'kg',kilogramos:'kg',kg:'kg',litro:'l',litros:'l',l:'l',plan:'plan'};return aliases[u]||u||'g'}
  function unitLabel(unit){const u=canonicalUnit(unit);return ({g:'g',ml:'ml',unit:'unidad',portion:'porción',plan:'',kg:'kg',l:'L'})[u]??u}
  function quantityLabel(row){const n=safeNumber(row.quantity);if(row.quantity_known===false||n===null||n<0)return 'Cantidad no definida';const val=new Intl.NumberFormat('es-AR',{maximumFractionDigits:3}).format(n);const unit=unitLabel(row.unit);return unit?`${val} ${unit}`:val}
  function csvCell(value){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  function unique(values){return [...new Set((values||[]).map(String).filter(Boolean))]}
  function generatedKey(item){const n=safeNumber(item.quantity);const known=item.quantity_known!==false&&n!==null&&n>=0;return `generated:${[normalize(item.name),normalize(item.brand),normalize(item.preparation_state),canonicalUnit(item.unit),known?'quantity-known':'quantity-unknown'].join('|')}`}
  function categoryLabel(raw){const first=clean(raw).split(/[;,|]/)[0].trim();return first||'Otros'}
  function aggregateItems(items){
    const map=new Map();
    for(const item of Array.isArray(items)?items:[]){
      const name=clean(item?.name);if(!name)continue;
      const unit=canonicalUnit(item?.unit||'g');
      if(unit.toLowerCase()==='plan')continue;
      const brand=clean(item?.brand);const prep=clean(item?.preparation_state)||'unspecified';
      const qty=safeNumber(item?.quantity);const known=item?.quantity_known!==false&&qty!==null&&qty>=0;
      const key=generatedKey({name,brand,preparation_state:prep,unit,quantity:qty,quantity_known:known});
      const amount=known?qty:0;
      if(!map.has(key))map.set(key,{item_key:key,name,brand,quantity:0,quantity_known:known,unit,preparation_state:prep,category:categoryLabel(item.categories),source:'generated',source_meals:[],checked:false,active:true});
      const row=map.get(key);row.quantity=Math.round((row.quantity+amount)*1000)/1000;row.source_meals.push(String(item.meal_id||''));
      if(row.category==='Otros'&&categoryLabel(item.categories)!=='Otros')row.category=categoryLabel(item.categories);
    }
    return [...map.values()].map(row=>({...row,source_meals:unique(row.source_meals)})).sort((a,b)=>a.category.localeCompare(b.category,'es')||a.name.localeCompare(b.name,'es'));
  }

  function makeModal(id,title,subtitle,closeFn,trigger){
    const overlay=document.createElement('div');overlay.id=id;overlay.className='nutrition-week-modal-overlay';overlay.setAttribute('role','presentation');
    const dialog=document.createElement('section');dialog.className='nutrition-week-modal';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby',`${id}Title`);dialog.setAttribute('tabindex','-1');
    const head=document.createElement('header');head.className='nutrition-week-modal-head';const text=document.createElement('div');text.className='nutrition-week-modal-heading';
    const h=document.createElement('h2');h.id=`${id}Title`;h.textContent=title;text.appendChild(h);
    if(subtitle){const p=document.createElement('p');p.textContent=subtitle;text.appendChild(p)}
    const close=document.createElement('button');close.type='button';close.className='nutrition-week-close';close.textContent='Cerrar';close.setAttribute('aria-label',`Cerrar ${title.toLocaleLowerCase('es')}`);close.addEventListener('click',closeFn);head.append(text,close);
    const body=document.createElement('div');body.className='nutrition-week-modal-body';dialog.append(head,body);overlay.appendChild(dialog);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeFn()});
    dialog.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();closeFn();return}
      if(e.key!=='Tab')return;
      const nodes=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(n=>n.offsetParent!==null);
      if(!nodes.length){e.preventDefault();dialog.focus();return}
      const first=nodes[0],last=nodes[nodes.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    });
    return {overlay,dialog,body,close,trigger};
  }
  function openShell(modal){if(!modal)return;document.body.appendChild(modal.overlay);modal.dialog.focus();modal.close.focus()}
  function closeShell(modal){if(!modal)return;const trigger=modal.trigger;modal.overlay.remove();if(trigger&&trigger.isConnected)trigger.focus()}
  function setStatus(host,message,type='info'){if(!host)return;host.textContent=message;host.dataset.state=type;host.hidden=!message}
  function addToolButton(parent,id,label,title,fn){let button=$(id);if(button)return button;button=document.createElement('button');button.id=id;button.type='button';button.className='small-btn nutrition-week-tool-btn';button.textContent=label;button.title=title;button.addEventListener('click',fn);parent.appendChild(button);return button}

  async function fetchAllMeals(owner){
    const c=await client();assertOwner(owner);const rows=[];const page=200;
    for(let offset=0;offset<100000;offset+=page){
      const res=await c.from('nutrition_meals').select('id,user_id,day,meal_type,title,foods,meal_time,meal_order,calories,protein_g,carbs_g,fat_g').eq('user_id',owner).order('day',{ascending:true}).order('meal_order',{ascending:true}).range(offset,offset+page-1);
      if(res.error)throw res.error;assertOwner(owner);const batch=Array.isArray(res.data)?res.data:[];rows.push(...batch);if(batch.length<page)return rows;
    }
    throw new Error('El plan contiene demasiadas comidas para cargarlo con seguridad. Revisá los datos antes de continuar.');
  }
  async function fetchItems(owner,mealIds){
    const c=await client();assertOwner(owner);const rows=[];const page=200;
    for(let start=0;start<mealIds.length;start+=80){const ids=mealIds.slice(start,start+80);
      for(let offset=0;offset<100000;offset+=page){
        let q=c.from('nutrition_meal_items').select('id,meal_id,user_id,name,brand,quantity,unit,preparation_state,categories,quantity_in_grams,consumed,consumed_at,created_at').eq('user_id',owner).in('meal_id',ids).order('created_at',{ascending:true}).range(offset,offset+page-1);
        const res=await q;if(res.error)throw res.error;assertOwner(owner);const batch=Array.isArray(res.data)?res.data:[];rows.push(...batch);if(batch.length<page)break;
      }
    }
    return rows;
  }
  async function fetchPlan(owner){const allMeals=await fetchAllMeals(owner);const meals=allMeals.filter(m=>Number.isInteger(Number(m.day))&&Number(m.day)>=0&&Number(m.day)<=6);const ids=meals.map(m=>String(m.id));const items=ids.length?await fetchItems(owner,ids):[];const byMeal=new Map();for(const item of items){const k=String(item.meal_id);if(!byMeal.has(k))byMeal.set(k,[]);byMeal.get(k).push(item)}return {meals,items,byMeal,invalidMealCount:allMeals.length-meals.length}}

  function newPlannerModal(trigger){
    const shell=makeModal('nutritionWeeklyPlannerModal','Plan semanal habitual','Vista general de la plantilla de lunes a domingo. Los cambios se hacen desde el día correspondiente.',closePlanner,trigger);
    const tools=document.createElement('div');tools.className='nutrition-week-actions';
    const refresh=document.createElement('button');refresh.type='button';refresh.className='small-btn';refresh.textContent='Actualizar semana';refresh.addEventListener('click',()=>loadPlanner(shell.body,true));tools.appendChild(refresh);
    const status=document.createElement('p');status.className='nutrition-week-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const grid=document.createElement('div');grid.className='nutrition-week-grid';shell.body.append(tools,status,grid);shell.refresh=refresh;shell.status=status;shell.grid=grid;return shell;
  }
  async function loadPlanner(body,force=false){
    if(plannerBusy)return;const shell=plannerModal;if(!shell)return;const owner=currentUid();const request=++plannerRequest;
    if(!owner){setStatus(shell.status,'Iniciá sesión para consultar tu plan semanal.','error');shell.grid.replaceChildren();return}
    plannerBusy=true;shell.refresh.disabled=true;setStatus(shell.status,'Cargando los siete días desde tu cuenta…');shell.grid.replaceChildren();
    try{
      const plan=await fetchPlan(owner);assertOwner(owner);if(request!==plannerRequest)return;
      const fragment=document.createDocumentFragment();
      for(let day=0;day<7;day++){
        const meals=plan.meals.filter(m=>Number(m.day)===day);const card=document.createElement('article');card.className='nutrition-week-day-card';
        const head=document.createElement('div');head.className='nutrition-week-day-head';const title=document.createElement('h3');title.textContent=DAYS[day];const count=document.createElement('span');count.className='nutrition-week-pill';count.textContent=`${meals.length} ${meals.length===1?'comida':'comidas'}`;head.append(title,count);card.appendChild(head);
        if(!meals.length){const empty=document.createElement('p');empty.className='nutrition-week-empty';empty.textContent='Sin comidas planificadas.';card.appendChild(empty)}
        else{
          const list=document.createElement('ul');list.className='nutrition-week-meals';
          for(const meal of meals){const li=document.createElement('li');const name=document.createElement('strong');name.textContent=clean(meal.title)||'Comida sin nombre';const meta=document.createElement('span');const type=MEAL_LABELS[meal.meal_type]||clean(meal.meal_type)||'Comida';const itemCount=(plan.byMeal.get(String(meal.id))||[]).length;meta.textContent=[type,meal.meal_time?`· ${meal.meal_time}`:'',`· ${itemCount} ${itemCount===1?'ingrediente':'ingredientes'}`].filter(Boolean).join(' ');li.append(name,meta);list.appendChild(li)}card.appendChild(list);
          const macroNames=[['calories','kcal'],['protein_g','g'],['carbs_g','g'],['fat_g','g']];
          const totals=macroNames.map(([key,unit])=>{const values=meals.map(m=>safeNumber(m[key]));if(values.some(v=>v===null))return null;return `${key==='calories'?'Cal':key==='protein_g'?'Prot.':key==='carbs_g'?'Carb.':'Grasas'} ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(values.reduce((a,b)=>a+b,0))} ${unit}`});
          const macro=document.createElement('p');macro.className='nutrition-week-macros';macro.textContent=totals.every(Boolean)?totals.join(' · '):'Macros incompletos en una o más comidas';card.appendChild(macro);
        }
        const go=document.createElement('button');go.type='button';go.className='nutrition-week-open-day';go.textContent='Abrir día';go.addEventListener('click',async()=>{closePlanner();if(typeof selectNutritionDay==='function')await selectNutritionDay(day)});card.appendChild(go);fragment.appendChild(card);
      }
      shell.grid.appendChild(fragment);setStatus(shell.status,`Plan cargado. ${plan.meals.length} comidas y ${plan.items.length} ingredientes detallados. Solo se muestran datos de la cuenta activa.`,'success');
    }catch(error){if(request!==plannerRequest)return;console.error('No se pudo cargar el plan semanal:',error);setStatus(shell.status,`No se pudo cargar el plan: ${error?.message||'error desconocido'}. No se reemplazaron datos locales.`,'error')}
    finally{if(request===plannerRequest){plannerBusy=false;shell.refresh.disabled=false}}
  }
  function openPlanner(){if(plannerModal)return;plannerTrigger=document.activeElement;plannerModal=newPlannerModal(plannerTrigger);openShell(plannerModal);loadPlanner(plannerModal.body)}
  function closePlanner(){if(plannerBusy)plannerRequest++;if(plannerModal){closeShell(plannerModal);plannerModal=null}plannerBusy=false}

  function newShoppingModal(trigger){
    const shell=makeModal('nutritionShoppingModal','Lista de compras','Lista sincronizada por cuenta y semana. Se genera desde el plan fechado de esa semana; cada semana conserva su propia lista y sus marcas de compra.',closeShopping,trigger);
    const tools=document.createElement('div');tools.className='nutrition-shopping-tools';
    const dateLabel=document.createElement('label');dateLabel.className='nutrition-shopping-week-label';dateLabel.textContent='Semana que vas a comprar';const date=document.createElement('input');date.type='date';date.className='input';date.id='nutritionShoppingWeekStart';dateLabel.appendChild(date);
    const previous=document.createElement('button');previous.type='button';previous.className='small-btn';previous.textContent='← Semana anterior';previous.addEventListener('click',()=>changeWeek(-7));
    const next=document.createElement('button');next.type='button';next.className='small-btn';next.textContent='Semana siguiente →';next.addEventListener('click',()=>changeWeek(7));
    const generate=document.createElement('button');generate.type='button';generate.className='small-btn primary';generate.textContent='Generar desde el plan';generate.addEventListener('click',generateShoppingList);
    const add=document.createElement('button');add.type='button';add.className='small-btn';add.textContent='＋ Añadir producto';add.addEventListener('click',toggleManualForm);
    const exportBtn=document.createElement('button');exportBtn.type='button';exportBtn.className='small-btn';exportBtn.textContent='Exportar CSV';exportBtn.addEventListener('click',exportShoppingCsv);
    tools.append(dateLabel,previous,next,generate,add,exportBtn);
    const status=document.createElement('p');status.className='nutrition-week-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const form=document.createElement('form');form.className='nutrition-shopping-add-form';form.hidden=true;form.innerHTML='<label>Producto<input name="name" maxlength="160" required autocomplete="off" placeholder="Ej.: tomate"/></label><label>Cantidad<input name="quantity" type="number" min="0" max="1000000" step="0.001" value="1" required/></label><label>Unidad<select name="unit"><option value="unit">unidad</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="portion">porción</option><option value="pack">paquete</option></select></label><label>Categoría<select name="category"><option>Verdulería</option><option>Carnicería</option><option>Lácteos</option><option>Almacén</option><option>Panadería</option><option>Congelados</option><option>Otros</option></select></label><div class="nutrition-shopping-form-actions"><button type="submit" class="small-btn primary">Guardar producto</button><button type="button" class="small-btn" data-cancel-manual>Cancelar</button></div>';
    form.addEventListener('submit',addManualItem);form.querySelector('[data-cancel-manual]').addEventListener('click',()=>{form.reset();form.hidden=true});
    const list=document.createElement('div');list.className='nutrition-shopping-list';
    shell.body.append(tools,status,form,list);shell.date=date;shell.previous=previous;shell.next=next;shell.generate=generate;shell.add=add;shell.exportBtn=exportBtn;shell.status=status;shell.form=form;shell.list=list;return shell;
  }
  function normalizeWeek(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return currentMonday();return mondayIso(value)}
  function changeWeek(delta){if(!shoppingModal)return;selectedWeek=isoAdd(selectedWeek,delta);selectedWeek=normalizeWeek(selectedWeek);shoppingModal.date.value=selectedWeek;loadShoppingRows()}
  function openShopping(){if(shoppingModal)return;shoppingTrigger=document.activeElement;shoppingModal=newShoppingModal(shoppingTrigger);selectedWeek=currentMonday();shoppingModal.date.value=selectedWeek;shoppingModal.date.addEventListener('change',()=>{selectedWeek=normalizeWeek(shoppingModal.date.value);shoppingModal.date.value=selectedWeek;loadShoppingRows()});openShell(shoppingModal);loadShoppingRows()}
  function closeShopping(){shoppingRequest++;if(shoppingModal){closeShell(shoppingModal);shoppingModal=null}}
  async function readShoppingRows(owner,week,includeInactive=false){const c=await client();assertOwner(owner);const rows=[];const page=250;for(let offset=0;offset<10000;offset+=page){let q=c.from('nutrition_shopping_items').select('*').eq('user_id',owner).eq('week_start',week);if(!includeInactive)q=q.eq('active',true);const res=await q.order('id',{ascending:true}).range(offset,offset+page-1);if(res.error)throw res.error;assertOwner(owner);const batch=Array.isArray(res.data)?res.data:[];rows.push(...batch);if(batch.length<page){return rows.sort((a,b)=>Number(!!a.checked)-Number(!!b.checked)||String(a.category||'').localeCompare(String(b.category||''),'es')||String(a.name||'').localeCompare(String(b.name||''),'es'))}}throw new Error('La lista supera el límite seguro de 10.000 registros. Exportá una copia y revisá la lista antes de continuar.')}
  async function loadShoppingRows(){
    if(!shoppingModal)return;const owner=currentUid();const request=++shoppingRequest;const shell=shoppingModal;const week=selectedWeek;
    shell.date.value=week;shell.list.setAttribute('aria-busy','true');shell.list.replaceChildren();setStatus(shell.status,'Cargando la lista sincronizada…');
    try{if(!owner)throw new Error('Iniciá sesión para usar una lista compartida entre dispositivos.');const rows=await readShoppingRows(owner,week);assertOwner(owner);if(request!==shoppingRequest)return;renderShoppingRows(rows);setStatus(shell.status,`Semana ${weekRange(week)} · ${rows.filter(x=>!x.checked).length} pendientes · ${rows.filter(x=>x.checked).length} comprados.`,'success')}
    catch(error){if(request!==shoppingRequest)return;console.error('No se pudo cargar la lista de compras:',error);const msg=/nutrition_shopping_items|relation .* does not exist|could not find the table/i.test(error?.message||'')?'La lista compartida todavía no está instalada en Supabase. Ejecutá sql/17-nutrition-shopping-list.sql y volvé a abrirla.':`No se pudo cargar la lista: ${error?.message||'error desconocido'}. No se supone que la lista esté guardada si el servidor no la confirmó.`;setStatus(shell.status,msg,'error')}
    finally{if(request===shoppingRequest&&shoppingModal===shell){shell.list.removeAttribute('aria-busy')}}
  }
  function renderShoppingRows(rows){if(!shoppingModal)return;const host=shoppingModal.list;host.replaceChildren();if(!rows.length){const empty=document.createElement('div');empty.className='nutrition-shopping-empty';empty.textContent='Todavía no hay productos para esta semana. Generá la lista desde el plan o agregá productos manualmente.';host.appendChild(empty);return}
    const categories=new Map();for(const row of rows){const category=clean(row.category)||'Otros';if(!categories.has(category))categories.set(category,[]);categories.get(category).push(row)}
    for(const [category,items] of categories){const section=document.createElement('section');section.className='nutrition-shopping-category';const h=document.createElement('h3');h.textContent=category;const count=document.createElement('span');count.textContent=String(items.length);h.appendChild(count);section.appendChild(h);const ul=document.createElement('ul');
      for(const row of items){const li=document.createElement('li');li.className='nutrition-shopping-row'+(row.checked?' is-checked':'');li.dataset.name=clean(row.name);li.dataset.brand=clean(row.brand);li.dataset.quantity=row.quantity_known===false?'Cantidad no definida':(safeNumber(row.quantity)??'');li.dataset.quantityKnown=row.quantity_known===false?'false':'true';li.dataset.unit=unitLabel(row.unit);li.dataset.preparation=({raw:'crudo',cooked:'cocido',prepared:'preparado'}[row.preparation_state]||'');li.dataset.category=clean(row.category)||'Otros';const label=document.createElement('label');label.className='nutrition-shopping-check';const check=document.createElement('input');check.type='checkbox';check.checked=!!row.checked;check.setAttribute('aria-label',`${row.checked?'Desmarcar':'Marcar como comprado'}: ${row.name}`);check.addEventListener('change',()=>updateChecked(row,check.checked,check));const text=document.createElement('span');text.className='nutrition-shopping-name';text.textContent=clean(row.name);const meta=document.createElement('small');meta.textContent=[clean(row.brand),quantityLabel(row),clean(row.preparation_state)!=='unspecified'?({raw:'crudo',cooked:'cocido',prepared:'preparado'}[row.preparation_state]||row.preparation_state):''].filter(Boolean).join(' · ');label.append(check,text);li.append(label,meta);
        const del=document.createElement('button');del.type='button';del.className='nutrition-shopping-delete';del.textContent='×';del.setAttribute('aria-label',`Eliminar ${row.name} de la lista`);del.addEventListener('click',()=>deleteShoppingItem(row));li.appendChild(del);ul.appendChild(li)}section.appendChild(ul);host.appendChild(section)}
  }
  async function updateChecked(row,checked,control){const owner=currentUid();const week=String(row.week_start||selectedWeek);if(!owner||String(row.user_id)!==owner){if(control)control.checked=!checked;return}if(control)control.disabled=true;try{const c=await client();assertOwner(owner);const res=await c.from('nutrition_shopping_items').update({checked:!!checked,updated_at:new Date().toISOString()}).eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).select('id,checked').single();if(res.error)throw res.error;assertOwner(owner);await loadShoppingRows()}catch(error){if(control)control.checked=!checked;setStatus(shoppingModal?.status,`No se pudo guardar el estado de compra: ${error?.message||'error desconocido'}.`, 'error')}finally{if(control)control.disabled=false}}
  async function deleteShoppingItem(row){if(!shoppingModal||!confirm(`¿Eliminar «${row.name}» de esta lista de compras?`))return;const owner=currentUid();const week=String(row.week_start||selectedWeek);try{assertOwner(owner);const c=await client();const {error}=await c.from('nutrition_shopping_items').delete().eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week);if(error)throw error;assertOwner(owner);await loadShoppingRows()}catch(error){setStatus(shoppingModal?.status,`No se pudo eliminar el producto: ${error?.message||'error desconocido'}.`,'error')}}
  function toggleManualForm(){if(!shoppingModal)return;shoppingModal.form.hidden=!shoppingModal.form.hidden;if(!shoppingModal.form.hidden)shoppingModal.form.querySelector('[name="name"]')?.focus()}
  async function addManualItem(event){event.preventDefault();if(!shoppingModal||manualSaving||shoppingBusy)return;const form=shoppingModal.form;const owner=currentUid();const name=clean(form.elements.name.value);const quantity=safeNumber(form.elements.quantity.value);if(!name){form.elements.name.focus();return}if(quantity===null||quantity<0){form.elements.quantity.focus();setStatus(shoppingModal.status,'Ingresá una cantidad válida.','error');return}
    const week=selectedWeek;const row={user_id:owner,week_start:week,item_key:`manual:${randomId()}`,name,brand:'',quantity,quantity_known:true,unit:clean(form.elements.unit.value)||'unit',preparation_state:'unspecified',category:clean(form.elements.category.value)||'Otros',checked:false,source:'manual',source_meals:[],active:true,updated_at:new Date().toISOString()};
    manualSaving=true;const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Guardando…'}
    try{assertOwner(owner);const c=await client();const {error}=await c.from('nutrition_shopping_items').insert(row);if(error)throw error;assertOwner(owner);form.reset();form.hidden=true;await loadShoppingRows()}catch(error){if(shoppingModal)setStatus(shoppingModal.status,`No se pudo guardar el producto: ${error?.message||'error desconocido'}. No se muestra como guardado.`, 'error')}finally{manualSaving=false;if(submit){submit.disabled=false;submit.textContent='Guardar producto'}}
  }
  function randomId(){try{return crypto.randomUUID()}catch(_){return `${Date.now()}-${Math.random().toString(16).slice(2)}`}}
  async function generateShoppingList(){if(shoppingBusy||!shoppingModal)return;const owner=currentUid();if(!owner){setStatus(shoppingModal.status,'Iniciá sesión para generar una lista por cuenta.','error');return}const shell=shoppingModal,week=selectedWeek;shoppingBusy=true;shell.generate.disabled=true;shell.add.disabled=true;shell.date.disabled=true;shell.previous.disabled=true;shell.next.disabled=true;shell.exportBtn.disabled=true;setStatus(shell.status,'Leyendo el plan semanal y sus ingredientes…');
    try{
      const weeklyApi=window.AgendaNutritionWeeklyPlan;
      if(!weeklyApi||typeof weeklyApi.getShoppingSource!=='function')throw new Error('No está cargado el planificador semanal fechado. Recargá la aplicación y volvé a intentar.');
      const plan=await weeklyApi.getShoppingSource(owner,week);assertOwner(owner);
      if(!plan.meals.length)throw new Error('No hay comidas planificadas para esta semana. Abrí «Planificar semana» y agregá comidas o importá tu rutina habitual. No se modificó la lista.');
      if(!plan.items.length)throw new Error('El plan de esta semana no tiene ingredientes detallados. La lista no se modificó. Podés añadir productos manualmente.');
      const grouped=aggregateItems(plan.items);if(!grouped.length)throw new Error('No se encontraron ingredientes con nombre y unidad utilizables. No se modificó la lista.');
      const existing=await readShoppingRows(owner,week,true);assertOwner(owner);const byKey=new Map(existing.map(r=>[String(r.item_key),r]));
      const newRows=[],updates=[];
      for(const item of grouped){const prev=byKey.get(item.item_key);const payload={...item,user_id:owner,week_start:week,active:true,updated_at:new Date().toISOString()};delete payload.checked;
        if(prev){updates.push({id:prev.id,payload});}else newRows.push({...payload,checked:false});
      }
      const c=await client();assertOwner(owner);
      if(newRows.length){const {error}=await c.from('nutrition_shopping_items').upsert(newRows,{onConflict:'user_id,week_start,item_key'});if(error)throw error;assertOwner(owner)}
      let updatedCount=0;
      for(const item of updates){assertOwner(owner);const {error}=await c.from('nutrition_shopping_items').update(item.payload).eq('id',String(item.id)).eq('user_id',owner).eq('week_start',week).select('id').single();if(error)throw error;assertOwner(owner);updatedCount++}
      // Si un ingrediente generado ya no forma parte del plan y no está marcado como comprado,
      // lo archivamos en vez de eliminarlo. Los artículos manuales y los ya comprados se conservan.
      const desiredKeys=new Set(grouped.map(x=>x.item_key));let archived=0;
      for(const row of existing){if(row.source==='generated'&&!row.checked&&row.active&&!desiredKeys.has(String(row.item_key))){assertOwner(owner);const {error}=await c.from('nutrition_shopping_items').update({active:false,updated_at:new Date().toISOString()}).eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).eq('checked',false);if(error)throw error;assertOwner(owner);archived++}}
      await loadShoppingRows();if(shoppingModal===shell)setStatus(shell.status,`Lista actualizada: ${grouped.length} ingredientes agrupados, ${newRows.length} nuevos, ${updatedCount} actualizados${archived?`, ${archived} desactualizados archivados`:''}. Los artículos manuales y los marcados como comprados se conservaron.`, 'success');
    }catch(error){console.error('No se pudo generar la lista de compras:',error);if(shoppingModal===shell)setStatus(shell.status,`No se completó la generación: ${error?.message||'error desconocido'}. Los cambios confirmados por el servidor se conservan; podés reintentar sin duplicar los ingredientes por su clave única.`, 'error')}
    finally{shoppingBusy=false;if(shoppingModal===shell){shell.generate.disabled=false;shell.add.disabled=false;shell.date.disabled=false;shell.previous.disabled=false;shell.next.disabled=false;shell.exportBtn.disabled=false}}
  }
  function exportShoppingCsv(){if(!shoppingModal)return;const rows=[...shoppingModal.list.querySelectorAll('.nutrition-shopping-row')];if(!rows.length){setStatus(shoppingModal.status,'No hay productos en la lista para exportar.','info');return}const lines=[['Categoría','Producto','Marca','Cantidad','Unidad','Preparación','Comprado']];for(const li of rows){const d=li.dataset;const check=li.querySelector('input[type="checkbox"]');lines.push([d.category||'Otros',d.name||'',d.brand||'',d.quantity||'',d.unit||'',d.preparation||'',check?.checked?'Sí':'No'])}const csv='\uFEFF'+lines.map(r=>r.map(csvCell).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`agenda-fich-compras-${selectedWeek}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);setStatus(shoppingModal.status,'CSV preparado para descargar.','success')}

  function init(){
    const actions=$('nutritionPanel')?.querySelector('.nutrition-actions');if(actions){
      addToolButton(actions,'nutritionWeeklyPlannerBtn','🗓️ Ver semana','Vista de las siete jornadas del plan semanal',openPlanner);
      addToolButton(actions,'nutritionShoppingListBtn','🛒 Lista de compras','Crear y sincronizar lista de compras desde el plan semanal',openShopping);
    }
    if(window.sb?.auth?.onAuthStateChange&&!window.__agendaNutritionPlannerAuthBound){
      window.__agendaNutritionPlannerAuthBound=true;
      window.sb.auth.onAuthStateChange(()=>setTimeout(()=>{
        if(plannerModal){plannerRequest++;plannerBusy=false;plannerModal.grid.replaceChildren();setStatus(plannerModal.status,'La sesión cambió; verificando la cuenta activa…');loadPlanner(plannerModal.body)}
        if(shoppingModal){shoppingRequest++;selectedWeek=currentMonday();shoppingModal.date.value=selectedWeek;shoppingModal.list.replaceChildren();setStatus(shoppingModal.status,'La sesión cambió; verificando la lista de la cuenta activa…');loadShoppingRows()}
      },0));
    }
  }
  window.AgendaNutritionPlanner={aggregateItems,mondayIso,isoAdd,csvCell,generatedKey,canonicalUnit,weekRange,loadPlan:async()=>{const uid=currentUid();if(!uid)throw new Error('Iniciá sesión.');return fetchPlan(uid)},openPlanner,openShopping};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
