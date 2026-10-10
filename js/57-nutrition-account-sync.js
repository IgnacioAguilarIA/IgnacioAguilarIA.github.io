/* Agenda FICH — Etapa 3: sincronización de preferencias nutricionales y estado de guardado.
   Solo administra datos de Alimentación; no toca Entrenamiento ni tareas. */
(function(){
  'use strict';
  const GOALS='agendaNutritionGoals:';
  const QUICK='agenda-nutrition-quick-access-v1:';
  const ORDER='agendaNutritionMealOrder:';
  const DIRTY='agendaNutritionPrefsDirty:';
  let activeUid='';let timer=null;let busy=false;let dirty=false;let lastMessage='';
  const $=id=>document.getElementById(id);
  const uid=()=>{try{return typeof currentUser!=='undefined'&&currentUser?.id?String(currentUser.id):''}catch(_){return ''}};
  const safeJSON=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(_){return fallback}};
  const defaultGoals=()=>({calories:2500,protein:160,carbs:300,fat:70});
  function setStatus(state,message){
    lastMessage=String(message||'');const box=$('nutritionSyncStatus');const text=$('nutritionSyncStatusText');
    if(box){box.classList.remove('is-saved','is-pending','is-warning','is-error');box.classList.add(`is-${state==='saved'?'saved':state==='pending'?'pending':state==='error'?'error':'warning'}`);box.title=lastMessage;}
    if(text)text.textContent=lastMessage;
    const settings=$('settingsRefreshStatus');if(settings&&state!=='saved')settings.textContent=lastMessage;
    try{document.dispatchEvent(new CustomEvent('agenda:nutrition-sync-status',{detail:{state,message:lastMessage}}))}catch(_){}
  }
  function readGoals(user){
    const local=safeJSON(GOALS+user,defaultGoals());const g=(local&&typeof local==='object')?local:defaultGoals();
    return {calories:Math.max(0,Number(g.calories)||0),protein:Math.max(0,Number(g.protein)||0),carbs:Math.max(0,Number(g.carbs)||0),fat:Math.max(0,Number(g.fat)||0)};
  }
  function readQuick(user){const v=safeJSON(QUICK+user,{version:1,favorites:[],recent:[]});return {version:1,favorites:Array.isArray(v?.favorites)?v.favorites.slice(0,100):[],recent:Array.isArray(v?.recent)?v.recent.slice(0,10):[]};}
  function readOrder(user){const defaults=['pre','post','lunch','snack','dinner','sleep'];const v=safeJSON(ORDER+user,defaults);return Array.isArray(v)?v:defaults;}
  function localPayload(user){return {nutrition_goals:readGoals(user),favorite_foods:readQuick(user).favorites,recent_foods:readQuick(user).recent};}
  function isDirty(user){try{return localStorage.getItem(DIRTY+user)==='1'}catch(_){return false}}
  function markDirty(){const user=uid();if(!user)return;dirty=true;try{localStorage.setItem(DIRTY+user,'1')}catch(_){}setStatus(navigator.onLine?'pending':'pending',navigator.onLine?'Hay preferencias nutricionales pendientes de sincronizar.':'Sin conexión: tus preferencias quedan guardadas en este dispositivo.');scheduleSave();}
  function clearDirty(user){dirty=false;try{localStorage.removeItem(DIRTY+user)}catch(_){}}
  function writeQuick(user,quick){try{localStorage.setItem(QUICK+user,JSON.stringify({version:1,favorites:Array.isArray(quick?.favorites)?quick.favorites.slice(0,100):[],recent:Array.isArray(quick?.recent)?quick.recent.slice(0,10):[]}))}catch(_){}}
  function writeGoals(user,goals){const out={calories:Math.max(0,Number(goals?.calories)||0),protein:Math.max(0,Number(goals?.protein)||0),carbs:Math.max(0,Number(goals?.carbs)||0),fat:Math.max(0,Number(goals?.fat)||0)};try{localStorage.setItem(GOALS+user,JSON.stringify(out))}catch(_){}try{nutritionGoals={...out}}catch(_){} }
  function renderGoals(){try{if(typeof renderNutritionGoals==='function')renderNutritionGoals();if(typeof renderDashboard==='function')renderDashboard()}catch(_){} }
  async function fetchPreferences(user){return await sb.from('nutrition_preferences').select('user_id,meal_order,nutrition_goals,favorite_foods,recent_foods').eq('user_id',user).maybeSingle()}
  function setSavedIfClean(message){
    const user=uid();const pending=Object.keys(safeJSON(`agendaNutritionPendingConsumption:${user}`,{})).length;
    if(user&&isDirty(user))setStatus('pending','Hay preferencias nutricionales pendientes de sincronizar.');
    else if(pending)setStatus('pending',`Hay ${pending} cambio(s) de consumo esperando confirmación de Supabase.`);
    else setStatus('saved',message);
  }
  async function saveLocalToCloud(user){
    if(!user)return;
    if(busy){return}
    if(!navigator.onLine){setStatus('pending','Sin conexión: las preferencias se sincronizarán cuando vuelva Internet.');return}
    busy=true;setStatus('pending','Sincronizando preferencias nutricionales…');
    let reschedule=false;
    try{
      const payload=localPayload(user);const snapshot=JSON.stringify(payload);const {data:existing,error:readError}=await fetchPreferences(user);
      if(readError)throw readError;
      if(existing){const {error}=await sb.from('nutrition_preferences').update({...payload,updated_at:new Date().toISOString()}).eq('user_id',user);if(error)throw error;}
      else {const {error}=await sb.from('nutrition_preferences').insert({user_id:user,meal_order:readOrder(user),...payload});if(error)throw error;}
      if(JSON.stringify(localPayload(user))===snapshot){clearDirty(user);setSavedIfClean('Preferencias nutricionales sincronizadas con tu cuenta.');}
      else{dirty=true;try{localStorage.setItem(DIRTY+user,'1')}catch(_){}reschedule=true;setStatus('pending','Hay cambios nuevos de preferencias esperando sincronización.');}
    }catch(err){
      console.warn('No se pudieron sincronizar preferencias nutricionales; se conserva la copia local:',err);
      setStatus('warning','Preferencias guardadas en este dispositivo; no se pudo confirmar la sincronización. Revisá la migración 06 y la conexión.');
    }finally{busy=false;if(reschedule)scheduleSave()}
  }
  function scheduleSave(){clearTimeout(timer);timer=setTimeout(()=>saveLocalToCloud(uid()),700)}
  async function loadFromCloud(){
    const user=uid();if(!user)return;
    activeUid=user;
    if(!navigator.onLine){setStatus('pending','Sin conexión: se usarán los datos nutricionales guardados en este dispositivo.');return}
    // Si hay cambios locales sin confirmación remota, primero se reintentan esos
    // datos: una recarga de Supabase nunca debe descartarlos por accidente.
    if(isDirty(user)){dirty=true;await saveLocalToCloud(user);return}
    try{
      const {data,error}=await fetchPreferences(user);if(error)throw error;
      if(!data){
        // Primera sincronización: crea la fila con los valores locales sin sobrescribir el orden.
        markDirty();return;
      }
      if(data.nutrition_goals&&typeof data.nutrition_goals==='object')writeGoals(user,data.nutrition_goals);
      const quick=readQuick(user);let needsPush=false;
      const favoriteFoods=Array.isArray(data.favorite_foods)?data.favorite_foods:quick.favorites;
      const recentFoods=Array.isArray(data.recent_foods)?data.recent_foods:quick.recent;
      if(!Array.isArray(data.favorite_foods)||!Array.isArray(data.recent_foods))needsPush=true;
      writeQuick(user,{version:1,favorites:favoriteFoods,recent:recentFoods});
      renderGoals();window.AgendaNutritionShortcuts?.refresh?.();
      if(needsPush||!data.nutrition_goals){dirty=true;try{localStorage.setItem(DIRTY+user,'1')}catch(_){}scheduleSave();}
      else if(isDirty(user)){dirty=true;scheduleSave();}
      else setSavedIfClean('Preferencias nutricionales sincronizadas.');
    }catch(err){
      console.warn('No se pudieron cargar preferencias de Alimentación desde Supabase:',err);
      setStatus('warning','No se pudo confirmar la sincronización nutricional. Los datos locales se conservaron; revisá que hayas aplicado sql/06-nutrition-account-sync.sql.');
    }
  }
  function init(){
    const user=uid();if(!user){setStatus('warning','Iniciá sesión para sincronizar y respaldar tus datos de Alimentación.');return}
    if(activeUid!==user)activeUid=user;
    if(isDirty(user)){dirty=true;saveLocalToCloud(user)}else loadFromCloud();
  }
  document.addEventListener('agenda:nutrition-quick-access-changed',event=>{if(event.detail?.saved===false){setStatus('error','No se pudieron guardar los favoritos en este dispositivo.');return}markDirty()});
  document.addEventListener('agenda:nutrition-goals-saved',markDirty);
  document.addEventListener('agenda:nutrition-preferences-restored',()=>{markDirty();setTimeout(()=>loadFromCloud(),900)});
  document.addEventListener('agenda:nutrition-meal-saved',()=>setSavedIfClean('Comida guardada en tu cuenta.'));
  document.addEventListener('agenda:nutrition-meal-items-saved',()=>setSavedIfClean('Comida y detalle de alimentos guardados en tu cuenta.'));
  document.addEventListener('agenda:nutrition-consumption-sync-status',event=>{const d=event.detail||{};setStatus(d.status||'pending',d.message||'Estado de consumo actualizado.')});
  document.addEventListener('agenda:nutrition-consumption-queue-flushed',()=>{if(!Object.keys(safeJSON(`agendaNutritionPendingConsumption:${uid()}`,{})).length)setStatus('saved','Cambios de consumo sincronizados con tu cuenta.')});
  window.addEventListener('online',()=>{if(isDirty(uid()))saveLocalToCloud(uid());else loadFromCloud();window.AgendaNutritionConsumption?.flushPending?.()});
  window.addEventListener('offline',()=>setStatus('pending','Sin conexión. Los cambios nuevos de consumo y preferencias se conservarán localmente mientras sea posible.'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine){if(isDirty(uid()))saveLocalToCloud(uid());else loadFromCloud();window.AgendaNutritionConsumption?.flushPending?.()}});
  if(window.sb?.auth?.onAuthStateChange&&!window.__agendaNutritionAccountSyncAuthBound){window.__agendaNutritionAccountSyncAuthBound=true;window.sb.auth.onAuthStateChange(()=>setTimeout(init,0))}
  window.AgendaNutritionSync={setStatus,refresh:loadFromCloud,syncNow:()=>saveLocalToCloud(uid()),markDirty};
  let attempts=0;function waitForUser(){attempts++;if(uid()||attempts>80){init();return}setTimeout(waitForUser,250)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForUser,{once:true});else waitForUser();
})();
