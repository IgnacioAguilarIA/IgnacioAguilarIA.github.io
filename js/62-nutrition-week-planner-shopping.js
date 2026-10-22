(function(){
  'use strict';
  const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const DAY_KEYS=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  const MEALS=['desayuno','media_manana','almuerzo','merienda','cena','colacion'];
  const MEAL_LABELS={desayuno:'Desayuno',media_manana:'Media mañana',almuerzo:'Almuerzo',merienda:'Merienda',cena:'Cena',colacion:'Colación'};
  const $=id=>document.getElementById(id);
  let plannerModal=null,shoppingModal=null,plannerBusy=false,shoppingBusy=false,manualSaving=false;
  let plannerRequest=0,shoppingRequest=0,selectedWeek='',shoppingProposal=null;
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
      const declaredUnit=clean(item?.unit);
      const unit=canonicalUnit(declaredUnit||'sin unidad');
      // Una cantidad expresada como "plan" no es una unidad medible y nunca debe
      // sumarse como si fueran gramos, mililitros o unidades.
      if(unit.toLowerCase()==='plan')continue;
      const brand=clean(item?.brand);const prep=clean(item?.preparation_state)||'unspecified';
      const qty=safeNumber(item?.quantity);const known=item?.quantity_known!==false&&qty!==null&&qty>=0&&!!declaredUnit;
      const key=generatedKey({name,brand,preparation_state:prep,unit,quantity:qty,quantity_known:known});
      const amount=known?qty:0;
      if(!map.has(key))map.set(key,{item_key:key,name,brand,quantity:0,quantity_known:known,unit,preparation_state:prep,category:categoryLabel(item.categories||item.category),source:'generated',source_meals:[],checked:false,active:true});
      const row=map.get(key);row.quantity=Math.round((row.quantity+amount)*1000)/1000;row.source_meals.push(String(item.meal_id||''));
      if(row.category==='Otros'&&categoryLabel(item.categories||item.category)!=='Otros')row.category=categoryLabel(item.categories||item.category);
    }
    return [...map.values()].map(row=>({...row,source_meals:unique(row.source_meals)})).sort((a,b)=>a.category.localeCompare(b.category,'es')||a.name.localeCompare(b.name,'es'));
  }
  function sameKnownQuantity(left,right){
    const a=safeNumber(left?.quantity),b=safeNumber(right?.quantity);
    const knownA=left?.quantity_known!==false&&a!==null&&a>=0;
    const knownB=right?.quantity_known!==false&&b!==null&&b>=0;
    if(knownA!==knownB)return false;
    if(!knownA)return true;
    return Math.abs(Math.round(a*1000)/1000-Math.round(b*1000)/1000)<0.0005;
  }
  function findPurchasedQuantityConflicts(existing,desired){
    const desiredByKey=new Map((Array.isArray(desired)?desired:[]).map(row=>[String(row.item_key),row]));
    return (Array.isArray(existing)?existing:[]).filter(row=>row&&row.source==='generated'&&row.active!==false&&row.checked===true&&desiredByKey.has(String(row.item_key))&&!sameKnownQuantity(row,desiredByKey.get(String(row.item_key))));
  }

  // E27: compara el plan propuesto con la lista persistida antes de escribir.
  // Solo usa campos funcionales; el orden de llegada del servidor no afecta la firma.
  function normalizedSourceMeals(row){return unique(Array.isArray(row?.source_meals)?row.source_meals:[]).sort()}
  function desiredShoppingSignature(rows){
    return JSON.stringify((Array.isArray(rows)?rows:[]).map(row=>({
      item_key:String(row.item_key||''),name:clean(row.name),brand:clean(row.brand),
      quantity_known:row.quantity_known!==false&&safeNumber(row.quantity)!==null&&safeNumber(row.quantity)>=0,
      quantity:(row.quantity_known===false||safeNumber(row.quantity)===null)?null:Math.round(safeNumber(row.quantity)*1000)/1000,
      unit:canonicalUnit(row.unit),preparation_state:clean(row.preparation_state)||'unspecified',
      category:clean(row.category)||'Otros',source_meals:normalizedSourceMeals(row)
    })).sort((a,b)=>a.item_key.localeCompare(b.item_key,'es')));
  }
  function existingShoppingSignature(rows){
    return JSON.stringify((Array.isArray(rows)?rows:[]).map(row=>({
      id:String(row.id||''),item_key:String(row.item_key||''),name:clean(row.name),brand:clean(row.brand),
      quantity_known:row.quantity_known!==false&&safeNumber(row.quantity)!==null&&safeNumber(row.quantity)>=0,
      quantity:(row.quantity_known===false||safeNumber(row.quantity)===null)?null:Math.round(safeNumber(row.quantity)*1000)/1000,
      unit:canonicalUnit(row.unit),preparation_state:clean(row.preparation_state)||'unspecified',category:clean(row.category)||'Otros',
      source:clean(row.source),source_meals:normalizedSourceMeals(row),checked:row.checked===true,active:row.active!==false,
      updated_at:clean(row.updated_at)
    })).sort((a,b)=>a.item_key.localeCompare(b.item_key,'es')||a.id.localeCompare(b.id,'es')));
  }
  function sameShoppingItemState(previous,item){
    if(!previous||previous.active===false)return false;
    const qA=safeNumber(previous.quantity),qB=safeNumber(item.quantity);
    const knownA=previous.quantity_known!==false&&qA!==null&&qA>=0;
    const knownB=item.quantity_known!==false&&qB!==null&&qB>=0;
    const sameQuantity=knownA===knownB&&(!knownA||Math.abs(Math.round(qA*1000)/1000-Math.round(qB*1000)/1000)<0.0005);
    return sameQuantity&&clean(previous.name)===clean(item.name)&&clean(previous.brand)===clean(item.brand)&&canonicalUnit(previous.unit)===canonicalUnit(item.unit)&&
      (clean(previous.preparation_state)||'unspecified')===(clean(item.preparation_state)||'unspecified')&&(clean(previous.category)||'Otros')===(clean(item.category)||'Otros')&&
      JSON.stringify(normalizedSourceMeals(previous))===JSON.stringify(normalizedSourceMeals(item));
  }
  function buildShoppingPreview(existing,desired){
    const old=Array.isArray(existing)?existing:[],next=Array.isArray(desired)?desired:[];
    const byKey=new Map(old.map(row=>[String(row.item_key),row]));
    const added=[],reactivated=[],updated=[],unchanged=[];
    for(const item of next){const previous=byKey.get(String(item.item_key));if(!previous)added.push(item);else if(previous.active===false)reactivated.push({previous,item});else if(!sameShoppingItemState(previous,item))updated.push({previous,item});else unchanged.push(item)}
    const wanted=new Set(next.map(row=>String(row.item_key)));
    const archive=old.filter(row=>row&&row.source==='generated'&&row.active!==false&&row.checked!==true&&!wanted.has(String(row.item_key)));
    const keepPurchased=old.filter(row=>row&&row.source==='generated'&&row.active!==false&&row.checked===true&&!wanted.has(String(row.item_key)));
    const purchasedConflicts=findPurchasedQuantityConflicts(old,next);
    const unknown=next.filter(row=>!isKnownShoppingQuantity(row));
    const manualPreserved=old.filter(row=>row&&row.source==='manual'&&row.active!==false).length;
    return {added,reactivated,updated,unchanged,archive,keepPurchased,purchasedConflicts,unknown,manualPreserved,
      hasChanges:added.length+reactivated.length+updated.length+archive.length>0};
  }

  // E26: utilidades puras para que el progreso y los filtros usen la lista completa,
  // sin depender del orden del DOM ni del estado de los controles visibles.
  function isKnownShoppingQuantity(row){
    const quantity=safeNumber(row?.quantity);
    return row?.quantity_known!==false&&quantity!==null&&quantity>=0;
  }
  function isArchivedGeneratedShoppingRow(row){
    return !!row&&row.active===false&&clean(row.source)==='generated'&&!!clean(row.item_key)&&!!clean(row.user_id)&&!!clean(row.week_start);
  }
  function canEditManualShoppingItem(row){
    return !!row&&row.active!==false&&clean(row.source)==='manual'&&row.checked!==true&&!!clean(row.id)&&!!clean(row.user_id)&&!!clean(row.week_start);
  }
  function summarizeShoppingRows(rows){
    const list=Array.isArray(rows)?rows.filter(row=>row&&row.active!==false):[];
    const purchased=list.filter(row=>row.checked===true).length;
    const pending=list.length-purchased;
    const unknownQuantity=list.filter(row=>row.checked!==true&&!isKnownShoppingQuantity(row)).length;
    return {total:list.length,purchased,pending,unknownQuantity,percent:list.length?Math.round(purchased/list.length*100):0};
  }
  function filterShoppingRows(rows,options={}){
    const list=Array.isArray(rows)?rows.filter(row=>row&&row.active!==false):[];
    const query=normalize(options.query||'');
    const status=['pending','purchased'].includes(options.status)?options.status:'all';
    const category=clean(options.category||'all');
    return list.filter(row=>{
      if(status==='pending'&&row.checked===true)return false;
      if(status==='purchased'&&row.checked!==true)return false;
      if(category!=='all'&&(clean(row.category)||'Otros')!==category)return false;
      if(!query)return true;
      const haystack=normalize([row.name,row.brand,row.category,row.preparation_state,quantityLabel(row),row.unit].filter(Boolean).join(' '));
      return haystack.includes(query);
    });
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
    const exportBtn=document.createElement('button');exportBtn.type='button';exportBtn.className='small-btn';exportBtn.textContent='Exportar CSV';exportBtn.title='Exporta los productos visibles después de aplicar los filtros.';exportBtn.addEventListener('click',exportShoppingCsv);
    const archiveToggle=document.createElement('button');archiveToggle.type='button';archiveToggle.className='small-btn nutrition-shopping-archive-toggle-e28';archiveToggle.textContent='Ver archivados (0)';archiveToggle.setAttribute('aria-expanded','false');archiveToggle.setAttribute('aria-controls','nutritionShoppingArchivePanel');archiveToggle.disabled=true;archiveToggle.addEventListener('click',()=>{if(shoppingProposal||shoppingBusy)return;const show=archivePanel.hidden;archivePanel.hidden=!show;archiveToggle.setAttribute('aria-expanded',String(show));if(show)archivePanel.querySelector('button:not([disabled])')?.focus()});
    tools.append(dateLabel,previous,next,generate,add,exportBtn,archiveToggle);
    const status=document.createElement('p');status.className='nutrition-week-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const review=document.createElement('section');review.className='nutrition-shopping-review-e27';review.hidden=true;review.setAttribute('role','region');review.setAttribute('aria-label','Revisión de cambios de la lista de compras');review.setAttribute('aria-live','polite');
    const reviewTitle=document.createElement('h3');reviewTitle.tabIndex=-1;reviewTitle.textContent='Revisar cambios antes de sincronizar';
    const reviewSummary=document.createElement('p');reviewSummary.className='nutrition-shopping-review-summary-e27';
    const reviewDetails=document.createElement('div');reviewDetails.className='nutrition-shopping-review-details-e27';
    const purchasedChoiceLabel=document.createElement('label');purchasedChoiceLabel.className='nutrition-shopping-review-choice-e27';purchasedChoiceLabel.hidden=true;
    const purchasedChoice=document.createElement('input');purchasedChoice.type='checkbox';purchasedChoice.checked=false;
    const purchasedChoiceText=document.createElement('span');purchasedChoiceText.textContent='Actualizar también las cantidades de productos que ya están marcados como comprados.';purchasedChoiceLabel.append(purchasedChoice,purchasedChoiceText);
    const reviewActions=document.createElement('div');reviewActions.className='nutrition-shopping-review-actions-e27';
    const applyReview=document.createElement('button');applyReview.type='button';applyReview.className='small-btn primary';applyReview.textContent='Aplicar cambios';applyReview.addEventListener('click',confirmShoppingProposal);
    const cancelReview=document.createElement('button');cancelReview.type='button';cancelReview.className='small-btn';cancelReview.textContent='Cancelar revisión';cancelReview.addEventListener('click',()=>{clearShoppingPreview();setStatus(shoppingModal?.status,'No se aplicó ningún cambio a la lista.','info')});
    reviewActions.append(applyReview,cancelReview);review.append(reviewTitle,reviewSummary,reviewDetails,purchasedChoiceLabel,reviewActions);
    const summary=document.createElement('section');summary.className='nutrition-shopping-summary';summary.hidden=true;summary.setAttribute('aria-label','Resumen de progreso de compras');
    const metrics=document.createElement('div');metrics.className='nutrition-shopping-metrics';
    const createMetric=(label,kind)=>{const card=document.createElement('div');card.className='nutrition-shopping-metric';const caption=document.createElement('span');caption.textContent=label;const value=document.createElement('strong');value.dataset.metric=kind;value.textContent='0';card.append(caption,value);metrics.appendChild(card);return value};
    const totalMetric=createMetric('Productos','total');const pendingMetric=createMetric('Pendientes','pending');const purchasedMetric=createMetric('Comprados','purchased');
    const progressLabel=document.createElement('div');progressLabel.className='nutrition-shopping-progress-label';const progressTitle=document.createElement('span');progressTitle.textContent='Progreso de compra';const progressText=document.createElement('strong');progressText.textContent='0%';progressLabel.append(progressTitle,progressText);
    const progress=document.createElement('div');progress.className='nutrition-shopping-progress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Progreso de productos comprados');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');progress.setAttribute('aria-valuenow','0');const progressFill=document.createElement('span');progressFill.className='nutrition-shopping-progress-fill';progress.appendChild(progressFill);
    const unknownNote=document.createElement('p');unknownNote.className='nutrition-shopping-unknown-note';unknownNote.hidden=true;unknownNote.setAttribute('role','note');
    const progressWrap=document.createElement('div');progressWrap.className='nutrition-shopping-progress-wrap';progressWrap.append(progressLabel,progress,unknownNote);summary.append(metrics,progressWrap);
    const filters=document.createElement('div');filters.className='nutrition-shopping-filters';filters.hidden=true;
    const searchLabel=document.createElement('label');searchLabel.className='nutrition-shopping-search-label';searchLabel.textContent='Buscar en la lista';const search=document.createElement('input');search.type='search';search.maxLength=160;search.className='input';search.placeholder='Producto, marca o categoría…';search.autocomplete='off';search.setAttribute('aria-label','Buscar productos por nombre, marca o categoría');searchLabel.appendChild(search);
    const statusLabel=document.createElement('label');statusLabel.className='nutrition-shopping-filter-label';statusLabel.textContent='Mostrar';const statusFilter=document.createElement('select');statusFilter.className='input';statusFilter.setAttribute('aria-label','Filtrar productos por estado');for(const [value,label] of [['all','Todos'],['pending','Pendientes'],['purchased','Comprados']]){const option=document.createElement('option');option.value=value;option.textContent=label;statusFilter.appendChild(option)}statusLabel.appendChild(statusFilter);
    const categoryLabelControl=document.createElement('label');categoryLabelControl.className='nutrition-shopping-filter-label';categoryLabelControl.textContent='Categoría';const categoryFilter=document.createElement('select');categoryFilter.className='input';categoryFilter.setAttribute('aria-label','Filtrar productos por categoría');const allCategories=document.createElement('option');allCategories.value='all';allCategories.textContent='Todas';categoryFilter.appendChild(allCategories);categoryLabelControl.appendChild(categoryFilter);
    filters.append(searchLabel,statusLabel,categoryLabelControl);
    const form=document.createElement('form');form.className='nutrition-shopping-add-form';form.hidden=true;form.innerHTML='<label>Producto<input name="name" maxlength="160" required autocomplete="off" placeholder="Ej.: tomate"/></label><label>Cantidad<input name="quantity" type="number" min="0" max="1000000" step="0.001" value="1" required/></label><label>Unidad<select name="unit"><option value="unit">unidad</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="portion">porción</option><option value="pack">paquete</option></select></label><label>Categoría<select name="category"><option>Verdulería</option><option>Carnicería</option><option>Lácteos</option><option>Almacén</option><option>Panadería</option><option>Congelados</option><option>Otros</option></select></label><div class="nutrition-shopping-form-actions"><button type="submit" class="small-btn primary">Guardar producto</button><button type="button" class="small-btn" data-cancel-manual>Cancelar</button></div>';
    form.addEventListener('submit',addManualItem);form.querySelector('[data-cancel-manual]').addEventListener('click',()=>{form.reset();form.hidden=true});
    const list=document.createElement('div');list.className='nutrition-shopping-list';
    const archivePanel=document.createElement('section');archivePanel.id='nutritionShoppingArchivePanel';archivePanel.className='nutrition-shopping-archive-e28';archivePanel.hidden=true;archivePanel.setAttribute('aria-label','Productos archivados de esta semana');
    const archiveHeading=document.createElement('h3');archiveHeading.textContent='Productos archivados';const archiveIntro=document.createElement('p');archiveIntro.className='nutrition-shopping-archive-help-e28';archiveIntro.textContent='Estos productos se quitaron del plan, pero siguen guardados. Podés restaurar uno como pendiente de compra.';const archiveStatus=document.createElement('p');archiveStatus.className='nutrition-shopping-archive-status-e28';archiveStatus.setAttribute('role','status');archiveStatus.setAttribute('aria-live','polite');const archiveList=document.createElement('ul');archiveList.className='nutrition-shopping-archive-list-e28';archivePanel.append(archiveHeading,archiveIntro,archiveStatus,archiveList);
    shell.body.append(tools,status,review,summary,filters,form,list,archivePanel);shell.date=date;shell.previous=previous;shell.next=next;shell.generate=generate;shell.add=add;shell.exportBtn=exportBtn;shell.archiveToggle=archiveToggle;shell.archivePanel=archivePanel;shell.archiveStatus=archiveStatus;shell.archiveList=archiveList;shell.status=status;shell.tools=tools;shell.review=review;shell.reviewSummary=reviewSummary;shell.reviewDetails=reviewDetails;shell.reviewPurchasedChoiceLabel=purchasedChoiceLabel;shell.reviewPurchasedChoice=purchasedChoice;shell.reviewTitle=reviewTitle;shell.reviewApply=applyReview;shell.reviewCancel=cancelReview;shell.summary=summary;shell.totalMetric=totalMetric;shell.pendingMetric=pendingMetric;shell.purchasedMetric=purchasedMetric;shell.progressText=progressText;shell.progress=progress;shell.progressFill=progressFill;shell.unknownNote=unknownNote;shell.filters=filters;shell.search=search;shell.statusFilter=statusFilter;shell.categoryFilter=categoryFilter;shell.form=form;shell.list=list;shell.allRows=[];shell.archivedRows=[];
    search.addEventListener('input',()=>renderShoppingRows(shell.allRows,{updateOptions:false}));statusFilter.addEventListener('change',()=>renderShoppingRows(shell.allRows,{updateOptions:false}));categoryFilter.addEventListener('change',()=>renderShoppingRows(shell.allRows,{updateOptions:false}));
    return shell;
  }
  function normalizeWeek(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return currentMonday();return mondayIso(value)}
  function changeWeek(delta){if(!shoppingModal||shoppingProposal||shoppingBusy)return;selectedWeek=isoAdd(selectedWeek,delta);selectedWeek=normalizeWeek(selectedWeek);shoppingModal.date.value=selectedWeek;loadShoppingRows()}
  function openShopping(options={}){
    const requested=options&&typeof options==='object'?clean(options.week):'';
    let targetWeek=currentMonday();
    if(requested){if(!/^\d{4}-\d{2}-\d{2}$/.test(requested)||isoAdd(requested,0)!==requested||mondayIso(requested)!==requested)throw new Error('La semana solicitada para compras debe ser una fecha válida de lunes.');targetWeek=requested}
    if(shoppingModal){
      if(requested&&selectedWeek!==targetWeek){if(shoppingProposal||shoppingBusy){setStatus(shoppingModal.status,'Hay una revisión de compras activa. Cancelala antes de cambiar a otra semana; no se modificó ninguna compra.','error');return false}selectedWeek=targetWeek;shoppingModal.date.value=selectedWeek;loadShoppingRows()}
      return true;
    }
    shoppingTrigger=document.activeElement;shoppingModal=newShoppingModal(shoppingTrigger);selectedWeek=targetWeek;shoppingModal.date.value=selectedWeek;shoppingModal.date.addEventListener('change',()=>{if(shoppingProposal||shoppingBusy){shoppingModal.date.value=selectedWeek;return}selectedWeek=normalizeWeek(shoppingModal.date.value);shoppingModal.date.value=selectedWeek;loadShoppingRows()});openShell(shoppingModal);loadShoppingRows();return true;
  }
  function closeShopping(){shoppingRequest++;shoppingProposal=null;if(shoppingModal){unlockShoppingReview(shoppingModal);closeShell(shoppingModal);shoppingModal=null}}
  async function readShoppingRows(owner,week,includeInactive=false){const c=await client();assertOwner(owner);const rows=[];const page=250;for(let offset=0;offset<10000;offset+=page){let q=c.from('nutrition_shopping_items').select('*').eq('user_id',owner).eq('week_start',week);if(!includeInactive)q=q.eq('active',true);const res=await q.order('id',{ascending:true}).range(offset,offset+page-1);if(res.error)throw res.error;assertOwner(owner);const batch=Array.isArray(res.data)?res.data:[];rows.push(...batch);if(batch.length<page){return rows.sort((a,b)=>Number(!!a.checked)-Number(!!b.checked)||String(a.category||'').localeCompare(String(b.category||''),'es')||String(a.name||'').localeCompare(String(b.name||''),'es'))}}throw new Error('La lista supera el límite seguro de 10.000 registros. Exportá una copia y revisá la lista antes de continuar.')}
  async function loadShoppingRows(){
    if(!shoppingModal)return;const owner=currentUid();const request=++shoppingRequest;const shell=shoppingModal;const week=selectedWeek;
    shell.date.value=week;shell.list.setAttribute('aria-busy','true');shell.list.replaceChildren();shell.summary.hidden=true;shell.filters.hidden=true;shell.archivedRows=[];renderArchivedShoppingRows(shell);setStatus(shell.status,'Cargando la lista sincronizada…');
    try{if(!owner)throw new Error('Iniciá sesión para usar una lista compartida entre dispositivos.');const rows=await readShoppingRows(owner,week,true);assertOwner(owner);if(request!==shoppingRequest)return;shell.archivedRows=rows.filter(isArchivedGeneratedShoppingRow);renderArchivedShoppingRows(shell);const activeRows=rows.filter(x=>x&&x.active!==false);renderShoppingRows(activeRows);setStatus(shell.status,`Semana ${weekRange(week)} · ${activeRows.filter(x=>!x.checked).length} pendientes · ${activeRows.filter(x=>x.checked).length} comprados.${shell.archivedRows.length?` · ${shell.archivedRows.length} archivados recuperables`:''}`,'success')}
    catch(error){if(request!==shoppingRequest)return;console.error('No se pudo cargar la lista de compras:',error);const msg=/nutrition_shopping_items|relation .* does not exist|could not find the table/i.test(error?.message||'')?'La lista compartida todavía no está instalada en Supabase. Ejecutá sql/17-nutrition-shopping-list.sql y volvé a abrirla.':`No se pudo cargar la lista: ${error?.message||'error desconocido'}. No se supone que la lista esté guardada si el servidor no la confirmó.`;setStatus(shell.status,msg,'error')}
    finally{if(request===shoppingRequest&&shoppingModal===shell){shell.list.removeAttribute('aria-busy')}}
  }
  function updateShoppingSummary(shell,rows){
    const summary=summarizeShoppingRows(rows);
    shell.totalMetric.textContent=String(summary.total);shell.pendingMetric.textContent=String(summary.pending);shell.purchasedMetric.textContent=String(summary.purchased);
    shell.progressText.textContent=`${summary.percent}%`;shell.progress.setAttribute('aria-valuenow',String(summary.percent));shell.progress.setAttribute('aria-valuetext',`${summary.purchased} de ${summary.total} productos comprados`);shell.progressFill.style.width=`${summary.percent}%`;
    shell.unknownNote.hidden=summary.unknownQuantity===0;
    shell.unknownNote.textContent=summary.unknownQuantity===1?'Hay 1 producto pendiente sin cantidad verificable. Revisá su cantidad antes de comprar.':`Hay ${summary.unknownQuantity} productos pendientes sin cantidad verificable. Revisá sus cantidades antes de comprar.`;
  }
  function updateShoppingCategoryOptions(shell,rows){
    const previous=shell.categoryFilter.value||'all';const categories=[...new Set(rows.map(row=>clean(row.category)||'Otros'))].sort((a,b)=>a.localeCompare(b,'es'));
    shell.categoryFilter.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent='Todas';shell.categoryFilter.appendChild(all);
    for(const category of categories){const option=document.createElement('option');option.value=category;option.textContent=category;shell.categoryFilter.appendChild(option)}
    shell.categoryFilter.value=categories.includes(previous)?previous:'all';
  }
  function renderShoppingRows(rows,options={}){
    if(!shoppingModal)return;const host=shoppingModal.list;const shell=shoppingModal;
    shell.allRows=Array.isArray(rows)?rows.filter(row=>row&&row.active!==false):[];
    if(options.updateOptions!==false)updateShoppingCategoryOptions(shell,shell.allRows);
    updateShoppingSummary(shell,shell.allRows);shell.summary.hidden=false;shell.filters.hidden=false;host.replaceChildren();
    if(!shell.allRows.length){const empty=document.createElement('div');empty.className='nutrition-shopping-empty';empty.textContent=shell.archivedRows?.length?`No hay productos activos esta semana. Hay ${shell.archivedRows.length} producto${shell.archivedRows.length===1?' archivado':'s archivados'} que podés revisar y restaurar.`:'Todavía no hay productos para esta semana. Generá la lista desde el plan o agregá productos manualmente.';host.appendChild(empty);return}
    const visible=filterShoppingRows(shell.allRows,{query:shell.search.value,status:shell.statusFilter.value,category:shell.categoryFilter.value});
    if(!visible.length){const empty=document.createElement('div');empty.className='nutrition-shopping-empty';empty.textContent='No hay productos que coincidan con estos filtros. Probá otra búsqueda o seleccioná «Todos».';host.appendChild(empty);return}
    const categories=new Map();for(const row of visible){const category=clean(row.category)||'Otros';if(!categories.has(category))categories.set(category,[]);categories.get(category).push(row)}
    for(const [category,items] of categories){const section=document.createElement('section');section.className='nutrition-shopping-category';const h=document.createElement('h3');h.textContent=category;const count=document.createElement('span');count.textContent=`${items.length} ${items.length===1?'producto':'productos'}`;h.appendChild(count);section.appendChild(h);const ul=document.createElement('ul');
      for(const row of items){const li=document.createElement('li');li.className='nutrition-shopping-row'+(row.checked?' is-checked':'');li.dataset.name=clean(row.name);li.dataset.brand=clean(row.brand);li.dataset.quantity=row.quantity_known===false?'Cantidad no definida':(safeNumber(row.quantity)??'');li.dataset.quantityKnown=row.quantity_known===false?'false':'true';li.dataset.unit=unitLabel(row.unit);li.dataset.preparation=({raw:'crudo',cooked:'cocido',prepared:'preparado'}[row.preparation_state]||'');li.dataset.category=clean(row.category)||'Otros';const label=document.createElement('label');label.className='nutrition-shopping-check';const check=document.createElement('input');check.type='checkbox';check.checked=!!row.checked;check.setAttribute('aria-label',`${row.checked?'Desmarcar':'Marcar como comprado'}: ${row.name}`);check.addEventListener('change',()=>updateChecked(row,check.checked,check));const text=document.createElement('span');text.className='nutrition-shopping-name';text.textContent=clean(row.name);const meta=document.createElement('small');meta.textContent=[clean(row.brand),quantityLabel(row),clean(row.preparation_state)!=='unspecified'?({raw:'crudo',cooked:'cocido',prepared:'preparado'}[row.preparation_state]||row.preparation_state):''].filter(Boolean).join(' · ');label.append(check,text);li.append(label,meta);
        if(canEditManualShoppingItem(row)){const edit=document.createElement('button');edit.type='button';edit.className='nutrition-shopping-edit-e28';edit.textContent='Editar';edit.setAttribute('aria-label',`Editar producto manual ${row.name}`);edit.addEventListener('click',()=>beginManualShoppingEdit(row,li));li.appendChild(edit)}
        const del=document.createElement('button');del.type='button';del.className='nutrition-shopping-delete';del.textContent='×';del.setAttribute('aria-label',`Eliminar ${row.name} de la lista`);del.addEventListener('click',()=>deleteShoppingItem(row));li.appendChild(del);ul.appendChild(li)}section.appendChild(ul);host.appendChild(section)}
  }
  function renderArchivedShoppingRows(shell){
    if(!shell)return;const rows=Array.isArray(shell.archivedRows)?shell.archivedRows:[];shell.archiveToggle.textContent=`Ver archivados (${rows.length})`;shell.archiveToggle.disabled=rows.length===0||shoppingBusy||!!shoppingProposal;shell.archiveToggle.hidden=rows.length===0;
    if(!rows.length){shell.archivePanel.hidden=true;shell.archiveToggle.setAttribute('aria-expanded','false');shell.archiveList.replaceChildren();shell.archiveStatus.textContent='';return}
    const fragment=document.createDocumentFragment();
    for(const row of rows){const li=document.createElement('li');li.className='nutrition-shopping-archive-row-e28';const main=document.createElement('div');main.className='nutrition-shopping-archive-main-e28';const name=document.createElement('strong');name.textContent=clean(row.name)||'Producto sin nombre';const details=document.createElement('small');details.textContent=[clean(row.category)||'Otros',quantityLabel(row),clean(row.brand),({raw:'crudo',cooked:'cocido',prepared:'preparado'}[row.preparation_state]||'')].filter(Boolean).join(' · ');main.append(name,details);const restore=document.createElement('button');restore.type='button';restore.className='small-btn nutrition-shopping-restore-e28';restore.textContent='Restaurar';restore.setAttribute('aria-label',`Restaurar ${clean(row.name)||'producto archivado'}`);restore.disabled=shoppingBusy||!!shoppingProposal;restore.addEventListener('click',()=>restoreArchivedShoppingItem(row));li.append(main,restore);fragment.appendChild(li)}
    shell.archiveList.replaceChildren(fragment);
  }
  function setArchiveStatus(message,type='info'){if(!shoppingModal)return;shoppingModal.archiveStatus.textContent=message;shoppingModal.archiveStatus.dataset.state=type;shoppingModal.archiveStatus.hidden=!message}
  async function restoreArchivedShoppingItem(row){
    if(shoppingBusy||shoppingProposal||!shoppingModal||!isArchivedGeneratedShoppingRow(row))return;const owner=currentUid(),week=String(row.week_start||'');if(!owner||row.user_id!==owner||week!==selectedWeek){setArchiveStatus('La cuenta o la semana cambiaron. Recargá la lista antes de restaurar.','error');return}
    const shell=shoppingModal;shoppingBusy=true;renderArchivedShoppingRows(shell);setArchiveStatus(`Restaurando «${clean(row.name)}» como pendiente de compra…`,'info');
    try{assertOwner(owner);const c=await client();const latest=await c.from('nutrition_shopping_items').select('*').eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).single();if(latest.error)throw latest.error;assertOwner(owner);const current=latest.data;if(!isArchivedGeneratedShoppingRow(current))throw new Error('El producto ya no está archivado o cambió desde otra sesión. Se actualizará la lista.');
      let q=c.from('nutrition_shopping_items').update({active:true,checked:false,updated_at:new Date().toISOString()}).eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).eq('active',false);q=current.updated_at!==undefined&&current.updated_at!==null?q.eq('updated_at',current.updated_at):q.is('updated_at',null);const result=await q.select('id,active').single();if(result.error)throw new Error('No se pudo restaurar el producto porque cambió al mismo tiempo. Recargá e intentá de nuevo.');assertOwner(owner);await loadShoppingRows();setStatus(shell.status,`«${clean(row.name)}» volvió a la lista como pendiente de compra.`,'success');if(shoppingModal===shell&&shell.archivedRows?.length===0){shell.archivePanel.hidden=true}}
    catch(error){if(shoppingModal===shell){try{await loadShoppingRows()}catch(_){}setArchiveStatus(`No se pudo restaurar el producto: ${error?.message||'error desconocido'}. La lista no se considera actualizada.`, 'error')}}
    finally{shoppingBusy=false;if(shoppingModal===shell){renderArchivedShoppingRows(shell);if(shoppingProposal===null){shell.archiveToggle.disabled=shell.archivedRows.length===0}}}
  }
  function beginManualShoppingEdit(row,li){if(!shoppingModal||shoppingBusy||shoppingProposal||!canEditManualShoppingItem(row)||!li?.isConnected)return;const shell=shoppingModal;const form=document.createElement('form');form.className='nutrition-shopping-inline-edit-e28';form.setAttribute('aria-label',`Editar producto manual ${clean(row.name)}`);
    const nameLabel=document.createElement('label');nameLabel.textContent='Producto';const name=document.createElement('input');name.name='name';name.type='text';name.maxLength=160;name.required=true;name.value=clean(row.name);name.autocomplete='off';nameLabel.appendChild(name);
    const qtyLabel=document.createElement('label');qtyLabel.textContent='Cantidad';const qty=document.createElement('input');qty.name='quantity';qty.type='number';qty.min='0';qty.max='1000000';qty.step='0.001';qty.required=true;qty.value=isKnownShoppingQuantity(row)?String(row.quantity):'';qtyLabel.appendChild(qty);
    const unitLabelControl=document.createElement('label');unitLabelControl.textContent='Unidad';const unit=document.createElement('select');unit.name='unit';for(const [value,label] of [['unit','unidad'],['g','g'],['kg','kg'],['ml','ml'],['l','L'],['portion','porción'],['pack','paquete']]){const option=document.createElement('option');option.value=value;option.textContent=label;unit.appendChild(option)}unit.value=canonicalUnit(row.unit);if(![...unit.options].some(o=>o.value===unit.value)){const option=document.createElement('option');option.value=unit.value;option.textContent=unitLabel(unit.value);unit.appendChild(option)}unitLabelControl.appendChild(unit);
    const categoryLabelControl=document.createElement('label');categoryLabelControl.textContent='Categoría';const category=document.createElement('select');category.name='category';for(const value of ['Verdulería','Carnicería','Lácteos','Almacén','Panadería','Congelados','Otros']){const option=document.createElement('option');option.value=value;option.textContent=value;category.appendChild(option)}const cat=clean(row.category)||'Otros';if(![...category.options].some(o=>o.value===cat)){const option=document.createElement('option');option.value=cat;option.textContent=cat;category.appendChild(option)}category.value=cat;categoryLabelControl.appendChild(category);
    const actions=document.createElement('div');actions.className='nutrition-shopping-inline-edit-actions-e28';const save=document.createElement('button');save.type='submit';save.className='small-btn primary';save.textContent='Guardar';const cancel=document.createElement('button');cancel.type='button';cancel.className='small-btn';cancel.textContent='Cancelar';cancel.addEventListener('click',()=>renderShoppingRows(shell.allRows,{updateOptions:false}));actions.append(save,cancel);form.append(nameLabel,qtyLabel,unitLabelControl,categoryLabelControl,actions);
    form.addEventListener('submit',event=>saveManualShoppingEdit(event,row,form,save));li.replaceChildren(form);name.focus();
  }
  async function saveManualShoppingEdit(event,row,form,save){event.preventDefault();if(shoppingBusy||shoppingProposal||!shoppingModal||!canEditManualShoppingItem(row))return;const shell=shoppingModal;const owner=currentUid(),week=String(row.week_start||selectedWeek);const name=clean(form.elements.name.value);const quantity=safeNumber(form.elements.quantity.value);const unit=canonicalUnit(form.elements.unit.value);const category=clean(form.elements.category.value)||'Otros';if(!name){form.elements.name.focus();return}if(quantity===null||quantity<0||quantity>1000000){form.elements.quantity.focus();setStatus(shell.status,'Ingresá una cantidad válida entre 0 y 1.000.000.','error');return}if(!owner||owner!==row.user_id||week!==selectedWeek){setStatus(shell.status,'La cuenta o la semana cambiaron. No se guardó la edición.','error');return}
    shoppingBusy=true;save.disabled=true;save.textContent='Guardando…';setStatus(shell.status,'Comprobando que el producto no haya cambiado desde otra sesión…','info');
    try{assertOwner(owner);const c=await client();const latest=await c.from('nutrition_shopping_items').select('*').eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).single();if(latest.error)throw latest.error;assertOwner(owner);const current=latest.data;if(!canEditManualShoppingItem(current)||String(current.updated_at??'')!==String(row.updated_at??''))throw new Error('El producto cambió desde otra sesión o dejó de ser editable. Se recargó la lista sin sobrescribirlo.');
      let q=c.from('nutrition_shopping_items').update({name,quantity,quantity_known:true,unit,category,updated_at:new Date().toISOString()}).eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).eq('active',true).eq('checked',false).eq('source','manual');q=current.updated_at!==undefined&&current.updated_at!==null?q.eq('updated_at',current.updated_at):q.is('updated_at',null);const result=await q.select('id').single();if(result.error)throw new Error('El producto cambió durante el guardado. La edición no se confirmó; recargá la lista.');assertOwner(owner);await loadShoppingRows();setStatus(shell.status,`Se actualizó «${name}».`,'success')}
    catch(error){if(shoppingModal===shell){try{await loadShoppingRows()}catch(_){}setStatus(shell.status,`No se pudo guardar la edición: ${error?.message||'error desconocido'}. Se recargó la lista para conservar el estado del servidor.`, 'error')}}
    finally{shoppingBusy=false;if(shoppingModal===shell)renderArchivedShoppingRows(shell)}
  }
  async function updateChecked(row,checked,control){if(shoppingProposal||shoppingBusy){if(control)control.checked=!checked;return}const owner=currentUid();const week=String(row.week_start||selectedWeek);if(!owner||String(row.user_id)!==owner){if(control)control.checked=!checked;return}if(control)control.disabled=true;try{const c=await client();assertOwner(owner);const res=await c.from('nutrition_shopping_items').update({checked:!!checked,updated_at:new Date().toISOString()}).eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).select('id,checked').single();if(res.error)throw res.error;assertOwner(owner);await loadShoppingRows();if(checked&&window.AgendaNutritionPantry&&confirm(`Marcaste «${row.name}» como comprado. ¿Querés agregar ${quantityLabel(row)} a la despensa?\n\nSe guardará como un lote separado y no se duplicará si se reintenta la misma operación.`)){try{const result=await window.AgendaNutritionPantry.registerPurchase(row,owner);assertOwner(owner);setStatus(shoppingModal?.status,result?.duplicate?`«${row.name}» ya estaba registrado en la despensa; no se duplicó el stock.`:`«${row.name}» quedó marcado como comprado y se agregó a la despensa.`,result?.duplicate?'info':'success')}catch(pantryError){if(shoppingModal)setStatus(shoppingModal.status,`El producto sí quedó marcado como comprado, pero no se pudo agregar a la despensa: ${pantryError?.message||'error desconocido'}. Podés cargarlo manualmente sin volver a marcar la compra.`, 'error')}}}catch(error){if(control)control.checked=!checked;setStatus(shoppingModal?.status,`No se pudo guardar el estado de compra: ${error?.message||'error desconocido'}.`, 'error')}finally{if(control)control.disabled=false}}
  async function deleteShoppingItem(row){if(shoppingProposal||shoppingBusy||!shoppingModal||!confirm(`¿Eliminar «${row.name}» de esta lista de compras?`))return;const owner=currentUid();const week=String(row.week_start||selectedWeek);try{assertOwner(owner);const c=await client();const {error}=await c.from('nutrition_shopping_items').delete().eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week);if(error)throw error;assertOwner(owner);await loadShoppingRows()}catch(error){setStatus(shoppingModal?.status,`No se pudo eliminar el producto: ${error?.message||'error desconocido'}.`,'error')}}
  function toggleManualForm(){if(!shoppingModal||shoppingProposal||shoppingBusy)return;shoppingModal.form.hidden=!shoppingModal.form.hidden;if(!shoppingModal.form.hidden)shoppingModal.form.querySelector('[name="name"]')?.focus()}
  async function addManualItem(event){event.preventDefault();if(!shoppingModal||manualSaving||shoppingBusy||shoppingProposal)return;const form=shoppingModal.form;const owner=currentUid();const name=clean(form.elements.name.value);const quantity=safeNumber(form.elements.quantity.value);if(!name){form.elements.name.focus();return}if(quantity===null||quantity<0){form.elements.quantity.focus();setStatus(shoppingModal.status,'Ingresá una cantidad válida.','error');return}
    const week=selectedWeek;const row={user_id:owner,week_start:week,item_key:`manual:${randomId()}`,name,brand:'',quantity,quantity_known:true,unit:clean(form.elements.unit.value)||'unit',preparation_state:'unspecified',category:clean(form.elements.category.value)||'Otros',checked:false,source:'manual',source_meals:[],active:true,updated_at:new Date().toISOString()};
    manualSaving=true;const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Guardando…'}
    try{assertOwner(owner);const c=await client();const {error}=await c.from('nutrition_shopping_items').insert(row);if(error)throw error;assertOwner(owner);form.reset();form.hidden=true;await loadShoppingRows()}catch(error){if(shoppingModal)setStatus(shoppingModal.status,`No se pudo guardar el producto: ${error?.message||'error desconocido'}. No se muestra como guardado.`, 'error')}finally{manualSaving=false;if(submit){submit.disabled=false;submit.textContent='Guardar producto'}}
  }
  function randomId(){try{return crypto.randomUUID()}catch(_){return `${Date.now()}-${Math.random().toString(16).slice(2)}`}}
  function setReviewTreeLocked(root,locked){
    if(!root)return;root.inert=!!locked;
    const controls=root.querySelectorAll('button,input,select,textarea');
    for(const control of controls){
      if(locked){if(control.dataset.e27WasDisabled===undefined)control.dataset.e27WasDisabled=control.disabled?'true':'false';control.disabled=true}
      else if(control.dataset.e27WasDisabled!==undefined){control.disabled=control.dataset.e27WasDisabled==='true';delete control.dataset.e27WasDisabled}
    }
  }
  function lockShoppingReview(shell,locked){
    for(const root of [shell.tools,shell.summary,shell.filters,shell.form,shell.list,shell.archivePanel])setReviewTreeLocked(root,locked);
    shell.review.dataset.locked=locked?'true':'false';
  }
  function unlockShoppingReview(shell){
    if(!shell)return;lockShoppingReview(shell,false);shell.review.hidden=true;shell.reviewDetails.replaceChildren();shell.reviewSummary.textContent='';shell.reviewPurchasedChoiceLabel.hidden=true;shell.reviewPurchasedChoice.checked=false;
    if(shell.reviewApply){shell.reviewApply.disabled=false;shell.reviewApply.textContent='Aplicar cambios'}if(shell.reviewCancel)shell.reviewCancel.disabled=false;
  }
  function clearShoppingPreview(){if(shoppingModal)unlockShoppingReview(shoppingModal);shoppingProposal=null}
  function makeReviewSection(title,items,mapper){
    if(!items.length)return null;const section=document.createElement('section');section.className='nutrition-shopping-review-group-e27';const heading=document.createElement('h4');heading.textContent=title;const list=document.createElement('ul');
    for(const item of items.slice(0,6)){const li=document.createElement('li');li.textContent=mapper(item);list.appendChild(li)}
    if(items.length>6){const more=document.createElement('li');more.className='nutrition-shopping-review-more-e27';more.textContent=`Y ${items.length-6} producto${items.length-6===1?' más':'s más'}…`;list.appendChild(more)}
    section.append(heading,list);return section;
  }
  function presentShoppingPreview(proposal){
    if(!shoppingModal)return;const shell=shoppingModal;shoppingProposal=proposal;const diff=proposal.diff;const blocks=[];
    const labelQty=item=>`${clean(item.name)} — ${quantityLabel(item)}`;
    const updatedText=entry=>`${clean(entry.item.name)}: ${quantityLabel(entry.previous)} → ${quantityLabel(entry.item)}`;
    const restoredText=entry=>`${clean(entry.item.name)} — ${quantityLabel(entry.item)} (reactivado)`;
    const archivedText=row=>`${clean(row.name)} — ${quantityLabel(row)} (se archivará; no se elimina del historial)`;
    const boughtText=row=>`${clean(row.name)} — ya comprado; se conservará aunque haya salido del plan`;
    const sections=[
      makeReviewSection('Se agregarán',diff.added,labelQty),
      makeReviewSection('Se reactivarán',diff.reactivated,restoredText),
      makeReviewSection('Se actualizarán',diff.updated,updatedText),
      makeReviewSection('Se archivarán pendientes que ya no están en el plan',diff.archive,archivedText),
      makeReviewSection('Comprados que se conservarán aunque ya no estén en el plan',diff.keepPurchased,boughtText)
    ].filter(Boolean);
    if(!sections.length){const p=document.createElement('p');p.className='nutrition-shopping-review-nochanges-e27';p.textContent='La lista actual ya coincide con el plan semanal. No hace falta guardar cambios.';blocks.push(p)}else blocks.push(...sections);
    if(diff.unknown.length){const warning=document.createElement('p');warning.className='nutrition-shopping-review-warning-e27';warning.textContent=`Atención: ${diff.unknown.length} producto${diff.unknown.length===1?' tiene':'s tienen'} cantidad o unidad no verificable. Se conservará la advertencia; no se inventará una cantidad.`;blocks.push(warning)}
    if(diff.purchasedConflicts.length){const warning=document.createElement('p');warning.className='nutrition-shopping-review-warning-e27';warning.textContent=`${diff.purchasedConflicts.length} producto${diff.purchasedConflicts.length===1?' ya comprado cambia':'s ya comprados cambian'} de cantidad según el plan nuevo. Por defecto se conservan las cantidades que registraste como compradas.`;blocks.push(warning)}
    if(diff.manualPreserved){const note=document.createElement('p');note.className='nutrition-shopping-review-note-e27';note.textContent=`Se conservarán ${diff.manualPreserved} producto${diff.manualPreserved===1?' manual':'s manuales'} que agregaste por tu cuenta.`;blocks.push(note)}
    shell.reviewDetails.replaceChildren(...blocks);
    shell.reviewSummary.textContent=`${diff.added.length} nuevos · ${diff.reactivated.length} reactivados · ${diff.updated.length} actualizaciones · ${diff.archive.length} pendientes a archivar · ${diff.purchasedConflicts.length} cantidades compradas para revisar.`;
    shell.reviewPurchasedChoiceLabel.hidden=diff.purchasedConflicts.length===0;shell.reviewPurchasedChoice.checked=false;
    shell.reviewApply.disabled=false;shell.reviewApply.textContent=diff.hasChanges?'Aplicar cambios':'Cerrar revisión';shell.reviewCancel.disabled=false;
    shell.review.hidden=false;lockShoppingReview(shell,true);setStatus(shell.status,'Revisá la propuesta. Todavía no se guardó ningún cambio en tu lista.','info');shell.reviewTitle.focus({preventScroll:true});
  }
  async function prepareShoppingProposal(owner,week){
    assertOwner(owner);
    const weeklyApi=window.AgendaNutritionWeeklyPlan;
    if(!weeklyApi||typeof weeklyApi.getShoppingSource!=='function')throw new Error('No está cargado el planificador semanal fechado. Recargá la aplicación y volvé a intentar.');
    const plan=await weeklyApi.getShoppingSource(owner,week);assertOwner(owner);
    if(!plan.meals.length)throw new Error('No hay comidas planificadas para esta semana. Abrí «Planificar semana» y agregá comidas o importá tu rutina habitual. No se modificó la lista.');
    if(!plan.items.length)throw new Error('El plan de esta semana no tiene ingredientes detallados. La lista no se modificó. Podés añadir productos manualmente.');
    const originalGrouped=aggregateItems(plan.items);if(!originalGrouped.length)throw new Error('No se encontraron ingredientes con nombre y unidad utilizables. No se modificó la lista.');
    let grouped=originalGrouped,pantryCovered=0,pantryUnavailable=false;
    if(window.AgendaNutritionPantry&&typeof window.AgendaNutritionPantry.applyShortages==='function'){
      try{const result=await window.AgendaNutritionPantry.applyShortages(owner,originalGrouped);assertOwner(owner);grouped=Array.isArray(result.items)?result.items:originalGrouped;pantryCovered=Number(result.fullyCovered)||0}
      catch(error){if(/nutrition_pantry_items|relation .* does not exist|could not find the table|schema cache/i.test(error?.message||'')){pantryUnavailable=true;grouped=originalGrouped}else throw new Error(`No se pudo comprobar la despensa con seguridad; no se modificó la lista. ${error?.message||'Error desconocido'}`)}
    }
    const existing=await readShoppingRows(owner,week,true);assertOwner(owner);const diff=buildShoppingPreview(existing,grouped);
    return {owner,week,originalGrouped,grouped,existing,pantryCovered,pantryUnavailable,diff,desiredSignature:desiredShoppingSignature(grouped),existingSignature:existingShoppingSignature(existing)};
  }
  async function generateShoppingList(){
    if(shoppingBusy||shoppingProposal||!shoppingModal)return;const owner=currentUid();if(!owner){setStatus(shoppingModal.status,'Iniciá sesión para generar una lista por cuenta.','error');return}
    const shell=shoppingModal,week=selectedWeek;shoppingBusy=true;shell.generate.disabled=true;shell.add.disabled=true;shell.date.disabled=true;shell.previous.disabled=true;shell.next.disabled=true;shell.exportBtn.disabled=true;setStatus(shell.status,'Preparando una vista previa del plan y de los cambios…');
    try{const proposal=await prepareShoppingProposal(owner,week);assertOwner(owner);if(shoppingModal!==shell||selectedWeek!==week)return;shell.generate.disabled=false;shell.add.disabled=false;shell.date.disabled=false;shell.previous.disabled=false;shell.next.disabled=false;shell.exportBtn.disabled=false;presentShoppingPreview(proposal)}
    catch(error){console.error('No se pudo preparar la revisión de compras:',error);if(shoppingModal===shell)setStatus(shell.status,`No se pudo preparar la vista previa: ${error?.message||'error desconocido'}. No se modificó la lista.`, 'error')}
    finally{shoppingBusy=false;if(shoppingModal===shell&&!shoppingProposal){shell.generate.disabled=false;shell.add.disabled=false;shell.date.disabled=false;shell.previous.disabled=false;shell.next.disabled=false;shell.exportBtn.disabled=false}}
  }
  async function confirmShoppingProposal(){
    if(shoppingBusy||!shoppingProposal||!shoppingModal)return;const proposal=shoppingProposal,shell=shoppingModal;const owner=proposal.owner,week=proposal.week;
    if(currentUid()!==owner||selectedWeek!==week){clearShoppingPreview();setStatus(shell.status,'La cuenta o la semana cambió. No se aplicó la propuesta; generá una revisión nueva.','error');return}
    if(!proposal.diff.hasChanges){clearShoppingPreview();setStatus(shell.status,'La lista ya coincide con el plan semanal. No se modificó ningún dato.','success');return}
    shoppingBusy=true;shell.reviewApply.disabled=true;shell.reviewCancel.disabled=true;shell.reviewApply.textContent='Verificando…';setStatus(shell.status,'Verificando que el plan y la lista no hayan cambiado desde la revisión…','info');
    try{
      const fresh=await prepareShoppingProposal(owner,week);assertOwner(owner);
      if(fresh.desiredSignature!==proposal.desiredSignature||fresh.existingSignature!==proposal.existingSignature){clearShoppingPreview();await loadShoppingRows();setStatus(shell.status,'El plan o la lista cambió mientras revisabas. No se aplicó esta propuesta. Revisá los datos actualizados y generá una vista previa nueva.','error');return}
      const existing=proposal.existing,grouped=proposal.grouped,byKey=new Map(existing.map(row=>[String(row.item_key),row]));
      const updatePurchased=!!shell.reviewPurchasedChoice.checked;const newRows=[],updates=[];let preservedBought=0;
      for(const item of grouped){
        const previous=byKey.get(String(item.item_key));const payload={...item,user_id:owner,week_start:week,active:true,updated_at:new Date().toISOString()};delete payload.checked;
        if(previous){
          if(previous.source==='generated'&&previous.checked===true&&!sameKnownQuantity(previous,item)&&!updatePurchased){preservedBought++;continue}
          if(previous.active===true&&sameShoppingItemState(previous,item))continue;
          updates.push({id:previous.id,payload});
        }else newRows.push({...payload,checked:false});
      }
      const c=await client();assertOwner(owner);
      if(newRows.length){const {error}=await c.from('nutrition_shopping_items').upsert(newRows,{onConflict:'user_id,week_start,item_key'});if(error)throw error;assertOwner(owner)}
      let updatedCount=0;
      for(const item of updates){assertOwner(owner);const {error}=await c.from('nutrition_shopping_items').update(item.payload).eq('id',String(item.id)).eq('user_id',owner).eq('week_start',week).select('id').single();if(error)throw error;assertOwner(owner);updatedCount++}
      const desiredKeys=new Set(grouped.map(row=>String(row.item_key)));let archived=0;
      for(const row of existing){if(row.source==='generated'&&row.checked!==true&&row.active!==false&&!desiredKeys.has(String(row.item_key))){assertOwner(owner);const {error}=await c.from('nutrition_shopping_items').update({active:false,updated_at:new Date().toISOString()}).eq('id',String(row.id)).eq('user_id',owner).eq('week_start',week).eq('checked',false).eq('active',true);if(error)throw error;assertOwner(owner);archived++}}
      clearShoppingPreview();await loadShoppingRows();
      if(shoppingModal===shell){const updatedBought=updatePurchased?proposal.diff.purchasedConflicts.length-preservedBought:0;setStatus(shell.status,`Lista actualizada tras revisión: ${newRows.length} productos nuevos, ${updatedCount} actualizados${archived?`, ${archived} pendientes archivados`:''}${preservedBought?`, ${preservedBought} cantidad${preservedBought===1?' comprada conservada':'es compradas conservadas'}`:''}${updatedBought?`, ${updatedBought} cantidad${updatedBought===1?' comprada actualizada':'es compradas actualizadas'}`:''}${proposal.pantryCovered?`. La despensa cubría ${proposal.pantryCovered} producto${proposal.pantryCovered===1?'':'s'} completo${proposal.pantryCovered===1?'':'s'}`:''}${proposal.pantryUnavailable?'. Aviso: la despensa no está instalada; se generó la lista completa sin descontar existencias (ejecutá sql/23-nutrition-pantry.sql).':'. Los productos manuales se conservaron.'}` ,proposal.pantryUnavailable?'info':'success')}
    }catch(error){console.error('No se pudieron aplicar los cambios de la lista:',error);if(shoppingModal===shell){clearShoppingPreview();try{await loadShoppingRows()}catch(_){}setStatus(shell.status,`No se pudo completar la sincronización: ${error?.message||'error desconocido'}. Algunos cambios previos podrían haberse confirmado; la lista se recargó para mostrar el estado del servidor.`, 'error')}}
    finally{shoppingBusy=false;if(shoppingModal===shell&&!shoppingProposal){shell.generate.disabled=false;shell.add.disabled=false;shell.date.disabled=false;shell.previous.disabled=false;shell.next.disabled=false;shell.exportBtn.disabled=false}}
  }
  function exportShoppingCsv(){if(!shoppingModal||shoppingProposal||shoppingBusy)return;const rows=[...shoppingModal.list.querySelectorAll('.nutrition-shopping-row')];if(!rows.length){setStatus(shoppingModal.status,'No hay productos en la lista para exportar.','info');return}const lines=[['Categoría','Producto','Marca','Cantidad','Unidad','Preparación','Comprado']];for(const li of rows){const d=li.dataset;const check=li.querySelector('input[type="checkbox"]');lines.push([d.category||'Otros',d.name||'',d.brand||'',d.quantity||'',d.unit||'',d.preparation||'',check?.checked?'Sí':'No'])}const csv='\uFEFF'+lines.map(r=>r.map(csvCell).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`agenda-fich-compras-${selectedWeek}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus(shoppingModal.status,`CSV preparado para descargar con ${rows.length} producto${rows.length===1?'':'s'} visibles según los filtros actuales.`,'success')}

  function init(){
    const actions=$('nutritionPanel')?.querySelector('.nutrition-actions');if(actions){
      addToolButton(actions,'nutritionWeeklyPlannerBtn','🗓️ Ver semana','Vista de las siete jornadas del plan semanal',openPlanner);
      addToolButton(actions,'nutritionShoppingListBtn','🛒 Lista de compras','Crear y sincronizar lista de compras desde el plan semanal',openShopping);
    }
    if(window.sb?.auth?.onAuthStateChange&&!window.__agendaNutritionPlannerAuthBound){
      window.__agendaNutritionPlannerAuthBound=true;
      window.sb.auth.onAuthStateChange(()=>setTimeout(()=>{
        if(plannerModal){plannerRequest++;plannerBusy=false;plannerModal.grid.replaceChildren();setStatus(plannerModal.status,'La sesión cambió; verificando la cuenta activa…');loadPlanner(plannerModal.body)}
        if(shoppingModal){clearShoppingPreview();shoppingRequest++;selectedWeek=currentMonday();shoppingModal.date.value=selectedWeek;shoppingModal.list.replaceChildren();setStatus(shoppingModal.status,'La sesión cambió; verificando la lista de la cuenta activa…');loadShoppingRows()}
      },0));
    }
  }
  function rowsToShoppingIngredients(planRows,owner,week){
    const result=[];
    for(const row of Array.isArray(planRows)?planRows:[]){
      if(!row||String(row.user_id)!==String(owner)||String(row.week_start)!==String(week))throw new Error('La estimación de compras contiene una comida de otra cuenta o semana.');
      const mealId=clean(row.id)||clean(row.plan_key);
      if(!mealId)throw new Error('Una comida del plan no tiene un identificador estable para estimar compras.');
      for(const ingredient of Array.isArray(row.ingredients_snapshot)?row.ingredients_snapshot:[]){
        if(!ingredient||!clean(ingredient.name))continue;
        result.push({...ingredient,meal_id:mealId,user_id:String(owner),categories:ingredient.categories||ingredient.category||'Otros'});
      }
    }
    return result;
  }
  function comparePlanShoppingRequirements(beforeRows,afterRows){
    const before=aggregateItems(rowsToShoppingIngredients(beforeRows,beforeRows?.[0]?.user_id,beforeRows?.[0]?.week_start));
    const after=aggregateItems(rowsToShoppingIngredients(afterRows,afterRows?.[0]?.user_id,afterRows?.[0]?.week_start));
    const beforeByKey=new Map(before.map(row=>[String(row.item_key),row]));
    const afterByKey=new Map(after.map(row=>[String(row.item_key),row]));
    const added=after.filter(row=>!beforeByKey.has(String(row.item_key)));
    const removed=before.filter(row=>!afterByKey.has(String(row.item_key)));
    const changed=[];
    for(const next of after){const previous=beforeByKey.get(String(next.item_key));if(previous&&!sameKnownQuantity(previous,next))changed.push({previous,item:next});}
    return {before,after,added,removed,changed,unknown:after.filter(row=>!isKnownShoppingQuantity(row))};
  }
  async function previewPlanShoppingImpact(owner,week,currentPlanRows,proposedPlanRows){
    assertOwner(owner);
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(week))||mondayIso(week)!==week)throw new Error('La semana del impacto de compras debe comenzar un lunes.');
    const current=Array.isArray(currentPlanRows)?currentPlanRows:[],proposed=Array.isArray(proposedPlanRows)?proposedPlanRows:[];
    for(const row of [...current,...proposed])if(!row||String(row.user_id)!==String(owner)||String(row.week_start)!==String(week))throw new Error('No se puede estimar una mezcla de cuentas o semanas diferentes.');
    const keys=new Set(current.map(row=>String(row.plan_key||'' )).filter(Boolean));
    const proposedKeys=new Set();
    for(const row of proposed){const key=String(row.plan_key||'');if(!key||proposedKeys.has(key)||keys.has(key))throw new Error('La propuesta contiene una comida repetida; actualizá la vista previa antes de estimar compras.');proposedKeys.add(key)}
    if(!proposed.length)return {available:true,noPlanChanges:true,message:'Esta operación no agregará comidas al plan; no se prevén cambios de compras por esta plantilla.',counts:{added:0,updated:0,reactivated:0,archive:0,purchasedConflicts:0,unknown:0},planDelta:{added:0,removed:0,changed:0,unknown:0},existingSignature:null,desiredSignature:null,pantryUnavailable:false,pantryCovered:0};
    assertOwner(owner);
    const beforeIngredients=rowsToShoppingIngredients(current,owner,week);
    const futureIngredients=rowsToShoppingIngredients([...current,...proposed],owner,week);
    const requirementDelta=comparePlanShoppingRequirements(current,[...current,...proposed]);
    if(!futureIngredients.length)return {available:false,message:'El plan resultante no contiene ingredientes detallados suficientes para estimar la lista de compras. La planificación se puede aplicar, pero no se modificará la lista automáticamente.',noPlanChanges:false};
    const originalGrouped=aggregateItems(futureIngredients);
    if(!originalGrouped.length)return {available:false,message:'No hay ingredientes con nombre y unidad utilizables para estimar compras. La planificación no modifica la lista de compras.',noPlanChanges:false};
    let grouped=originalGrouped,pantryCovered=0,pantryUnavailable=false;
    if(window.AgendaNutritionPantry&&typeof window.AgendaNutritionPantry.applyShortages==='function'){
      try{const result=await window.AgendaNutritionPantry.applyShortages(owner,originalGrouped);assertOwner(owner);grouped=Array.isArray(result.items)?result.items:originalGrouped;pantryCovered=Number(result.fullyCovered)||0}
      catch(error){if(/nutrition_pantry_items|relation .* does not exist|could not find the table|schema cache/i.test(error?.message||'')){pantryUnavailable=true;grouped=originalGrouped}else throw new Error(`No se pudo comprobar la despensa; no se modificó ninguna lista. ${error?.message||'Error desconocido'}`)}
    }
    const existing=await readShoppingRows(owner,week,true);assertOwner(owner);
    const diff=buildShoppingPreview(existing,grouped);
    return {
      available:true,noPlanChanges:false,week,
      existingSignature:existingShoppingSignature(existing),desiredSignature:desiredShoppingSignature(grouped),
      currentPlanProductCount:requirementDelta.before.length,desiredPlanProductCount:requirementDelta.after.length,
      planDelta:{added:requirementDelta.added,removed:requirementDelta.removed,changed:requirementDelta.changed,unknown:requirementDelta.unknown.length},
      counts:{added:diff.added.length,updated:diff.updated.length,reactivated:diff.reactivated.length,archive:diff.archive.length,purchasedConflicts:diff.purchasedConflicts.length,unknown:diff.unknown.length,unchanged:diff.unchanged.length,manualPreserved:diff.manualPreserved},
      diff:{added:diff.added,updated:diff.updated,reactivated:diff.reactivated,archive:diff.archive,purchasedConflicts:diff.purchasedConflicts,unknown:diff.unknown,unchanged:diff.unchanged,manualPreserved:diff.manualPreserved},
      pantryUnavailable,pantryCovered
    };
  }
  async function getShoppingListSignature(owner,week){assertOwner(owner);if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(week))||mondayIso(week)!==week)throw new Error('La semana de compras debe comenzar un lunes.');const rows=await readShoppingRows(owner,week,true);assertOwner(owner);return existingShoppingSignature(rows)}
  window.AgendaNutritionPlanner={aggregateItems,sameKnownQuantity,findPurchasedQuantityConflicts,buildShoppingPreview,sameShoppingItemState,desiredShoppingSignature,existingShoppingSignature,summarizeShoppingRows,filterShoppingRows,isKnownShoppingQuantity,isArchivedGeneratedShoppingRow,canEditManualShoppingItem,mondayIso,isoAdd,csvCell,generatedKey,canonicalUnit,weekRange,loadPlan:async()=>{const uid=currentUid();if(!uid)throw new Error('Iniciá sesión.');return fetchPlan(uid)},previewPlanShoppingImpact,getShoppingListSignature,openPlanner,openShopping};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
