/* Agenda FICH — E8: guardado idempotente y recuperación del borrador de Alimentación.
 * El contenido se limita a un borrador por cuenta y día. No sincroniza datos ni
 * cambia estado de otras secciones; solo conserva el intento pendiente en este navegador.
 */
(function(){
  'use strict';
  const PREFIX='agendaNutritionMealPendingSave:v1:';
  const REQUEST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const DAY_MIN=0,DAY_MAX=6,MAX_RECORD_CHARS=1_500_000;
  function key(userId,day){return PREFIX+encodeURIComponent(String(userId))+':'+String(Number(day))}
  function newRequestId(){
    const cryptoApi=window.crypto;
    if(cryptoApi&&typeof cryptoApi.randomUUID==='function')return cryptoApi.randomUUID();
    const bytes=new Uint8Array(16);
    if(cryptoApi&&typeof cryptoApi.getRandomValues==='function')cryptoApi.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function validate(record,userId,day){
    if(!record||typeof record!=='object'||Array.isArray(record)||record.version!==1)throw new Error('El borrador pendiente de Alimentación no tiene una versión compatible. No se sobrescribió. Exportá una copia de seguridad o revisá el almacenamiento local antes de continuar.');
    if(String(record.userId)!==String(userId)||Number(record.day)!==Number(day))throw new Error('El borrador pendiente no coincide con la cuenta o el día activo. No se abrió un borrador nuevo para evitar mezclar datos.');
    if(!REQUEST_ID.test(String(record.requestId||''))||!record.payload||typeof record.payload!=='object'||Array.isArray(record.payload)||!Array.isArray(record.structuredFoods)||!String(record.payload.title||'').trim())throw new Error('El borrador pendiente está incompleto o dañado. No se sobrescribió; revisá la copia local antes de continuar.');
    return record;
  }
  function readPending(userId,day){
    if(!userId||!Number.isInteger(Number(day))||Number(day)<DAY_MIN||Number(day)>DAY_MAX)return null;
    let raw;
    try{raw=localStorage.getItem(key(userId,day))}catch(error){throw new Error('No se pudo leer el borrador local. Revisá el almacenamiento del navegador y volvé a intentar.')}
    if(!raw)return null;
    if(raw.length>MAX_RECORD_CHARS)throw new Error('El borrador local supera el tamaño permitido; no se abrió una comida nueva para evitar perder la recuperación.');
    let record;try{record=JSON.parse(raw)}catch(_){throw new Error('El borrador pendiente no se puede interpretar. No se sobrescribió para proteger los datos.')}
    return validate(record,userId,day);
  }
  function savePending(record){
    validate(record,record?.userId,record?.day);
    const storageKey=key(record.userId,record.day);
    let priorRaw;
    try{priorRaw=localStorage.getItem(storageKey)}catch(_){throw new Error('No se pudo acceder al almacenamiento local. No se inició el guardado para mantener la protección contra duplicados.')}
    if(priorRaw){
      let prior;try{prior=JSON.parse(priorRaw)}catch(_){throw new Error('Ya existe un borrador local ilegible. No se sobrescribió ni se envió otra comida.')}
      validate(prior,record.userId,record.day);
      if(prior.requestId!==record.requestId)throw new Error('Existe otro intento de guardado sin confirmar para esta cuenta y este día. Recuperá ese borrador antes de crear otra comida, así evitás duplicados.');
    }
    let serialized;try{serialized=JSON.stringify(record)}catch(_){throw new Error('No se pudo preparar una copia recuperable del borrador. No se envió la comida; revisá los alimentos seleccionados y volvé a intentar.')}
    if(serialized.length>MAX_RECORD_CHARS)throw new Error('El borrador de comida es demasiado grande para recuperarlo de forma segura. Reducí la descripción o la cantidad de detalles antes de guardar.');
    try{localStorage.setItem(storageKey,serialized)}catch(_){throw new Error('No se pudo conservar el borrador en este navegador. No se envió la comida para evitar un reintento que pudiera duplicarla. Liberá espacio del almacenamiento y volvé a intentar.')}
    return true;
  }
  function clearPending(userId,day,requestId){
    if(!userId||!REQUEST_ID.test(String(requestId||'')))return false;
    const storageKey=key(userId,day);
    try{
      const raw=localStorage.getItem(storageKey);if(!raw)return true;
      let record;try{record=JSON.parse(raw)}catch(_){return false}
      if(String(record?.requestId)!==String(requestId))return false;
      localStorage.removeItem(storageKey);return localStorage.getItem(storageKey)===null;
    }catch(_){return false}
  }
  async function upsertMeal(client,payload,userId,day,requestId,mealOrder){
    if(!client||typeof client.from!=='function')throw new Error('No está disponible la conexión con Supabase. El borrador local sigue conservado.');
    if(!userId||!REQUEST_ID.test(String(requestId||'')))throw new Error('La cuenta o la clave segura del guardado no es válida.');
    if(!Number.isInteger(Number(day))||Number(day)<DAY_MIN||Number(day)>DAY_MAX)throw new Error('El día de la comida no es válido.');
    if(!Number.isInteger(Number(mealOrder))||Number(mealOrder)<0)throw new Error('El tipo de comida no es válido.');
    if(!payload||typeof payload!=='object'||!String(payload.title||'').trim())throw new Error('El nombre de la comida es obligatorio.');
    const row={...payload,user_id:String(userId),day:Number(day),meal_order:Number(mealOrder),save_request_id:String(requestId)};
    let result;
    try{result=await client.from('nutrition_meals').upsert(row,{onConflict:'user_id,save_request_id'}).select('*').single()}
    catch(error){throw new Error(`No se pudo confirmar el guardado: ${error?.message||'conexión interrumpida'}. El borrador quedó conservado; reintentá usando la misma clave para evitar duplicados.`)}
    if(result?.error){
      const message=String(result.error.message||result.error);
      if(/save_request_id|no unique|on conflict|could not find the .*column/i.test(message))throw new Error('Falta instalar la protección contra comidas duplicadas en Supabase. Ejecutá sql/27-nutrition-meal-save-idempotency.sql y verificá con sql/28-nutrition-meal-save-idempotency-postcheck.sql. No se reintentó con INSERT porque eso podría duplicar la comida.');
      throw new Error(`No se pudo confirmar el guardado: ${message}. El borrador quedó conservado para reintentar de forma segura.`);
    }
    if(!result?.data?.id)throw new Error('Supabase no devolvió el identificador de la comida. El borrador quedó conservado para reintentar sin duplicar.');
    return result.data;
  }
  window.AgendaNutritionMealSaveSafety=Object.freeze({newRequestId,readPending,savePending,clearPending,upsertMeal,storageKey:key});
})();
