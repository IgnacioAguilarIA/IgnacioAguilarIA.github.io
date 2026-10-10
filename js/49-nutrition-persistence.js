(function(){
  'use strict';

  /*
   * Persistencia de alimentación:
   * - food_catalog: catálogo genérico compartido (solo lectura para usuarios).
   * - user_foods: copia personalizada de alimentos usados/guardados por cada usuario.
   * - nutrition_meal_items: instantánea de los alimentos seleccionados dentro de una comida.
   *
   * El módulo es tolerante a tablas todavía no creadas: la app sigue funcionando con
   * nutrition_meals + Open Food Facts hasta ejecutar sql/01-nutrition-food-catalog.sql.
   */
  const $=id=>document.getElementById(id);
  const text=v=>String(v??'').trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};

  function normalizeSearch(v){
    return text(v)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9ñü]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function escapeLike(v){return text(v).replace(/[\\%_]/g,' ').replace(/\s+/g,' ').trim()}

  function currentUserId(){return typeof currentUser!=='undefined'&&currentUser?.id?String(currentUser.id):''}

  async function client(){
    if(typeof ensureSupabase!=='function')throw new Error('Supabase todavía no está disponible.');
    return ensureSupabase();
  }

  function toFood(row,kind){
    if(!row)return null;
    const userFood=kind==='user';
    return {
      id:String(row.external_id||row.id||row.catalog_id||row.food_id||''),
      code:String(row.external_id||row.code||''),
      name:text(row.name)||'Alimento',
      brand:text(row.brand),
      quantity:text(row.quantity_label||row.quantity),
      servingSize:text(row.serving_size),
      servingQuantity:num(row.serving_quantity)||null,
      quantityBase:100,
      unit:text(row.unit)||'g',
      calories:num(row.calories_per_100g),
      protein:num(row.protein_per_100g),
      carbs:num(row.carbs_per_100g),
      fat:num(row.fat_per_100g),
      fiber:num(row.fiber_per_100g),
      ingredients:text(row.ingredients),
      categories:text(row.category||row.categories),
      labels:text(row.labels),
      imageUrl:text(row.image_url),
      source:userFood?'Mis alimentos':(kind==='catalog'?'Catálogo propio':'Catálogo'),
      sourceType:userFood?'user_food':(kind==='catalog'?'food_catalog':''),
      catalogId:row.catalog_id??(kind==='catalog'?row.id:null),
      userFoodId:userFood?row.id:null,
      externalId:text(row.external_id),
      fingerprint:text(row.fingerprint),
      isGeneric:row.is_generic!==false
    };
  }

  function relevance(food,q){
    const needle=normalizeSearch(q);
    const name=normalizeSearch(food?.name);
    const hay=normalizeSearch([food?.name,food?.brand,food?.categories,food?.labels].filter(Boolean).join(' '));
    if(!needle||!hay)return 0;
    if(name===needle)return 1000;
    if(name.startsWith(needle+' '))return 930;
    if(name.includes(' '+needle+' '))return 880;
    if(name.includes(needle))return 820;
    const words=needle.split(' ').filter(Boolean);
    const hits=words.filter(w=>hay.includes(w)).length;
    return hits?500+(hits/words.length)*120:0;
  }

  function dedupe(items){
    const seen=new Set();
    return items.filter(item=>{
      if(!item)return false;
      const key=(item.sourceType==='user_food'?'user:':'all:')+normalizeSearch(item.name)+'|'+normalizeSearch(item.brand)+'|'+text(item.externalId||item.catalogId||item.id);
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }

  async function searchLocal(query){
    const q=normalizeSearch(query);
    if(!q||!currentUserId())return {user:[],catalog:[],all:[]};
    const c=await client();
    const pattern=`%${q}%`;
    const [userRes,catalogRes]=await Promise.all([
      c.from('user_foods').select('id,user_id,catalog_id,source,external_id,fingerprint,name,brand,quantity_label,serving_size,serving_quantity,unit,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,ingredients,categories,labels,image_url,is_generic').eq('user_id',currentUserId()).ilike('search_text',pattern).order('updated_at',{ascending:false}).limit(12),
      c.from('food_catalog').select('id,name,brand,category,aliases,serving_size,serving_quantity,unit,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,source,locale,is_generic').eq('active',true).ilike('search_text',pattern).limit(12)
    ]);
    const errors=[userRes.error,catalogRes.error].filter(Boolean);
    if(errors.length)throw errors[0];
    const user=userRes.data||[];
    const catalog=catalogRes.data||[];
    const userFoods=user.map(x=>toFood(x,'user')).sort((a,b)=>relevance(b,q)-relevance(a,q));
    const catalogFoods=catalog.map(x=>toFood(x,'catalog')).sort((a,b)=>relevance(b,q)-relevance(a,q));
    return {user:userFoods,catalog:catalogFoods,all:dedupe([...userFoods,...catalogFoods]).sort((a,b)=>relevance(b,q)-relevance(a,q))};
  }

  function snapshot(food,quantity){
    const qty=Math.max(0,num(quantity)||100);
    return {
      catalog_id:food?.catalogId||null,
      user_food_id:food?.userFoodId||null,
      source:text(food?.sourceType||food?.source||'external'),
      external_id:text(food?.externalId||food?.code||food?.id),
      name:text(food?.name)||'Alimento',
      brand:text(food?.brand),
      quantity:qty,
      unit:text(food?.unit)||'g',
      serving_size:text(food?.servingSize),
      calories_per_100g:num(food?.calories),
      protein_per_100g:num(food?.protein),
      carbs_per_100g:num(food?.carbs),
      fat_per_100g:num(food?.fat),
      fiber_per_100g:num(food?.fiber),
      ingredients:text(food?.ingredients),
      categories:text(food?.categories),
      labels:text(food?.labels),
      image_url:text(food?.imageUrl),
      consumed:false,
      consumed_at:null
    };
  }

  function fingerprintFor(food){
    const source=text(food?.sourceType||food?.source||'external').toLowerCase();
    const external=text(food?.externalId||food?.code||food?.id);
    if(external)return `${source}:${external}`;
    return `${source}:name:${normalizeSearch(food?.name)}:brand:${normalizeSearch(food?.brand)}`;
  }

  async function saveUserFood(food){
    const uid=currentUserId();
    if(!uid||!food)return {ok:false,skipped:true};
    const c=await client();
    const row={
      user_id:uid,
      catalog_id:food.catalogId||null,
      source:text(food.sourceType||food.source||'external'),
      external_id:text(food.externalId||food.code||food.id)||null,
      fingerprint:fingerprintFor(food),
      name:text(food.name)||'Alimento',
      brand:text(food.brand),
      quantity_label:text(food.quantity),
      serving_size:text(food.servingSize),
      serving_quantity:num(food.servingQuantity)||null,
      unit:text(food.unit)||'g',
      calories_per_100g:num(food.calories),
      protein_per_100g:num(food.protein),
      carbs_per_100g:num(food.carbs),
      fat_per_100g:num(food.fat),
      fiber_per_100g:num(food.fiber),
      ingredients:text(food.ingredients),
      categories:text(food.categories),
      labels:text(food.labels),
      image_url:text(food.imageUrl),
      is_generic:food.isGeneric!==false
    };
    const {data,error}=await c.from('user_foods').upsert(row,{onConflict:'user_id,fingerprint'}).select('*').single();
    if(error)throw error;
    return {ok:true,food:toFood(data,'user')};
  }

  function itemBaseKey(item){
    return [text(item?.source||item?.sourceType),text(item?.external_id||item?.externalId||item?.code),normalizeSearch(item?.name),normalizeSearch(item?.brand),text(item?.unit||'g')].join('|');
  }
  function itemExactKey(item){return itemBaseKey(item)+'|'+String(num(item?.quantity));}

  async function persistMealItems(mealId,items){
    const uid=currentUserId();
    if(!uid||!mealId||!Array.isArray(items))return {ok:true,skipped:true};
    const c=await client();
    const {data:oldRows,error:readError}=await c.from('nutrition_meal_items').select('*').eq('meal_id',String(mealId)).eq('user_id',uid).order('created_at',{ascending:true});
    if(readError)throw readError;
    const old=Array.isArray(oldRows)?oldRows:[];
    if(!items.length){
      const removedIds=old.map(item=>String(item.id)).filter(Boolean);
      const {error}=await c.from('nutrition_meal_items').delete().eq('meal_id',String(mealId)).eq('user_id',uid);
      if(error)throw error;
      document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-items-saved',{detail:{mealId:String(mealId),count:0,cleared:true,removedIds}}));
      return {ok:true,count:0,cleared:true,removed:removedIds.length};
    }
    const rows=items.map(item=>({
      meal_id:String(mealId),user_id:uid,catalog_id:item.catalog_id??item.catalogId??null,
      user_food_id:item.user_food_id??item.userFoodId??null,source:text(item.source||item.sourceType||'external'),
      external_id:text(item.external_id||item.externalId)||null,name:text(item.name)||'Alimento',brand:text(item.brand),
      quantity:Math.max(0,num(item.quantity)),unit:text(item.unit)||'g',serving_size:text(item.serving_size||item.servingSize),
      calories_per_100g:num(item.calories_per_100g??item.calories),protein_per_100g:num(item.protein_per_100g??item.protein),
      carbs_per_100g:num(item.carbs_per_100g??item.carbs),fat_per_100g:num(item.fat_per_100g??item.fat),
      fiber_per_100g:num(item.fiber_per_100g??item.fiber),ingredients:text(item.ingredients),categories:text(item.categories),
      labels:text(item.labels),image_url:text(item.image_url||item.imageUrl),consumed:Boolean(item.consumed),
      consumed_at:item.consumed&&item.consumed_at?item.consumed_at:null
    }));
    const unused=new Set(old.map((_,i)=>i));
    const updates=[],inserts=[];
    for(const row of rows){
      let match=-1;
      for(const i of unused){if(itemExactKey(old[i])===itemExactKey(row)){match=i;break}}
      if(match<0){for(const i of unused){if(itemBaseKey(old[i])===itemBaseKey(row)){match=i;break}}}
      if(match>=0){unused.delete(match);updates.push({id:old[match].id,row,previous:old[match]});}
      else inserts.push(row);
    }
    // Insertamos nuevas filas antes de tocar/eliminar las antiguas. Si falla una
    // fase posterior, intentamos compensar los cambios para evitar duplicados.
    let insertedIds=[];const appliedUpdates=[];
    const rollback=async()=>{
      for(const entry of [...appliedUpdates].reverse()){
        const restore={...entry.previous};delete restore.id;
        try{await c.from('nutrition_meal_items').update(restore).eq('id',String(entry.id)).eq('user_id',uid)}catch(_){}
      }
      if(insertedIds.length){try{await c.from('nutrition_meal_items').delete().in('id',insertedIds).eq('user_id',uid)}catch(_){}}
    };
    if(inserts.length){
      const {data,error}=await c.from('nutrition_meal_items').insert(inserts).select('id');
      if(error)throw error;
      insertedIds=(Array.isArray(data)?data:[]).map(x=>String(x.id)).filter(Boolean);
    }
    for(const entry of updates){
      const {error}=await c.from('nutrition_meal_items').update(entry.row).eq('id',String(entry.id)).eq('user_id',uid);
      if(error){await rollback();throw error;}
      appliedUpdates.push(entry);
    }
    const staleIds=[...unused].map(i=>old[i]?.id).filter(Boolean).map(String);
    if(staleIds.length){
      const {error}=await c.from('nutrition_meal_items').delete().in('id',staleIds).eq('meal_id',String(mealId)).eq('user_id',uid);
      if(error){await rollback();throw error;}
    }
    document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-items-saved',{detail:{mealId:String(mealId),count:rows.length,removedIds:staleIds}}));
    return {ok:true,count:rows.length,updated:updates.length,inserted:inserts.length,removed:staleIds.length};
  }

  async function deleteMealItems(mealId){
    const uid=currentUserId();
    if(!uid||!mealId)return;
    const c=await client();
    const {error}=await c.from('nutrition_meal_items').delete().eq('meal_id',String(mealId)).eq('user_id',uid);
    if(error)console.warn('No se pudieron eliminar los alimentos estructurados de la comida:',error);
    else document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-items-saved',{detail:{mealId:String(mealId),count:0,cleared:true,deleted:true}}));
  }

  async function loadMealItems(mealId){
    const uid=currentUserId();
    if(!uid||!mealId)return [];
    const c=await client();
    const {data,error}=await c.from('nutrition_meal_items').select('*').eq('meal_id',String(mealId)).eq('user_id',uid).order('created_at',{ascending:true});
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }

  function dateKeyInCordoba(value=new Date()){
    const d=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(d.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function historySnapshot(item,meal,consumedAt){
    const qty=Math.max(0,num(item?.quantity));
    const factor=text(item?.unit)==='plan'?1:qty/100;
    return {
      user_id:currentUserId(),
      consumed_date:dateKeyInCordoba(consumedAt),
      meal_id:String(item?.meal_id||''),
      meal_item_id:String(item?.id||''),
      meal_title:text(meal?.title)||'Comida',
      meal_type:text(meal?.meal_type),
      meal_time:text(meal?.meal_time)||null,
      food_name:text(item?.name)||'Alimento',
      brand:text(item?.brand),
      quantity:qty,
      unit:text(item?.unit)||'g',
      calories:Math.round(num(item?.calories_per_100g)*factor*10)/10,
      protein_g:Math.round(num(item?.protein_per_100g)*factor*10)/10,
      carbs_g:Math.round(num(item?.carbs_per_100g)*factor*10)/10,
      fat_g:Math.round(num(item?.fat_per_100g)*factor*10)/10,
      item_snapshot:{...item,consumed:true,consumed_at:consumedAt}
    };
  }

  async function recordConsumptionHistory(item,consumedAt=item?.consumed_at){
    const uid=currentUserId();
    if(!uid||!item?.id||!consumedAt)return {ok:false,skipped:true};
    const c=await client();
    let meal=null;
    if(item.meal_id){
      const {data,error}=await c.from('nutrition_meals').select('title,meal_type,meal_time').eq('id',String(item.meal_id)).eq('user_id',uid).maybeSingle();
      if(error)throw error;
      meal=data||null;
    }
    const row=historySnapshot(item,meal,consumedAt);
    if(!row.consumed_date||!row.meal_item_id)return {ok:false,skipped:true};
    const {error}=await c.from('nutrition_consumption_history').upsert(row,{onConflict:'user_id,meal_item_id,consumed_date'});
    if(error)throw error;
    return {ok:true,date:row.consumed_date};
  }

  async function loadConsumptionHistory(days=30){
    const uid=currentUserId();
    if(!uid)throw new Error('Iniciá sesión para consultar el historial nutricional.');
    const c=await client();
    const today=dateKeyInCordoba(new Date());
    const [y,m,d]=today.split('-').map(Number);
    const rangeDays=Math.max(1,Math.min(365,Number(days)||30));
    const start=new Date(Date.UTC(y,m-1,d-(rangeDays-1)));
    const since=`${start.getUTCFullYear()}-${String(start.getUTCMonth()+1).padStart(2,'0')}-${String(start.getUTCDate()).padStart(2,'0')}`;
    const {data,error}=await c.from('nutrition_consumption_history').select('id,consumed_date,meal_title,meal_type,meal_time,food_name,brand,quantity,unit,calories,protein_g,carbs_g,fat_g,created_at').eq('user_id',uid).gte('consumed_date',since).lte('consumed_date',today).order('consumed_date',{ascending:false}).order('created_at',{ascending:false}).limit(1500);
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }

  async function setMealItemConsumed(itemId,consumed,requestedConsumedAt=null,changedAt=new Date().toISOString()){
    const uid=currentUserId();
    if(!uid||!itemId)return {ok:false,skipped:true};
    const c=await client();
    const next=Boolean(consumed);
    const consumedAt=next?(text(requestedConsumedAt)||text(changedAt)||new Date().toISOString()):null;
    const {data,error}=await c.from('nutrition_meal_items').update({consumed:next,consumed_at:consumedAt}).eq('id',String(itemId)).eq('user_id',uid).select('*').single();
    if(error)throw error;
    let historyOk=true,historyError=null;
    try{
      if(next)await recordConsumptionHistory(data||{...{},id:String(itemId),consumed_at:consumedAt});
      else{
        const changedDate=dateKeyInCordoba(changedAt||new Date());
        const {error:deleteError}=await c.from('nutrition_consumption_history').delete().eq('user_id',uid).eq('meal_item_id',String(itemId)).eq('consumed_date',changedDate);
        if(deleteError)throw deleteError;
      }
    }catch(err){
      historyOk=false;historyError=err;
      try{document.dispatchEvent(new CustomEvent('agenda:nutrition-history-warning',{detail:{message:err?.message||'No se pudo actualizar el historial. Ejecutá sql/07-nutrition-advanced.sql.'}}))}catch(_){}
    }
    return {ok:true,item:data||null,historyOk,historyError:historyError?.message||null};
  }

  async function loadRecipes(){
    const uid=currentUserId();if(!uid)throw new Error('Iniciá sesión para consultar tus recetas.');
    const c=await client();
    const {data,error}=await c.from('nutrition_recipes').select('*').eq('user_id',uid).order('updated_at',{ascending:false}).limit(200);
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }

  function calculateRecipe(ingredients){
    const list=(Array.isArray(ingredients)?ingredients:[]).filter(x=>x&&Number(x.quantity)>0);
    const weight=list.reduce((sum,x)=>sum+Math.max(0,num(x.quantity)),0);
    const total=list.reduce((acc,x)=>{
      const factor=Math.max(0,num(x.quantity))/100;
      acc.calories+=num(x.calories_per_100g)*factor;
      acc.protein+=num(x.protein_per_100g)*factor;
      acc.carbs+=num(x.carbs_per_100g)*factor;
      acc.fat+=num(x.fat_per_100g)*factor;
      acc.fiber+=num(x.fiber_per_100g)*factor;
      return acc;
    },{calories:0,protein:0,carbs:0,fat:0,fiber:0});
    const per100=weight>0?100/weight:0;
    return {total_weight_g:Math.round(weight*10)/10,total_calories:Math.round(total.calories*10)/10,total_protein_g:Math.round(total.protein*10)/10,total_carbs_g:Math.round(total.carbs*10)/10,total_fat_g:Math.round(total.fat*10)/10,calories_per_100g:Math.round(total.calories*per100*10)/10,protein_per_100g:Math.round(total.protein*per100*10)/10,carbs_per_100g:Math.round(total.carbs*per100*10)/10,fat_per_100g:Math.round(total.fat*per100*10)/10,fiber_per_100g:Math.round(total.fiber*per100*10)/10};
  }

  async function saveRecipe(recipe){
    const uid=currentUserId();if(!uid)throw new Error('Iniciá sesión para guardar recetas.');
    const name=text(recipe?.name);const ingredients=(Array.isArray(recipe?.ingredients)?recipe.ingredients:[]).filter(x=>x&&num(x.quantity)>0).map(x=>({...x,consumed:false,consumed_at:null}));
    if(!name)throw new Error('Escribí un nombre para la receta.');
    if(!ingredients.length)throw new Error('Agregá al menos un alimento con cantidad para guardar la receta.');
    const totals=calculateRecipe(ingredients);if(!(totals.total_weight_g>0))throw new Error('La receta debe tener un peso total mayor que cero.');
    const c=await client();
    const row={user_id:uid,name,notes:text(recipe?.notes),servings:Math.max(0.1,num(recipe?.servings)||1),ingredients,total_weight_g:totals.total_weight_g,calories_per_100g:totals.calories_per_100g,protein_per_100g:totals.protein_per_100g,carbs_per_100g:totals.carbs_per_100g,fat_per_100g:totals.fat_per_100g,fiber_per_100g:totals.fiber_per_100g};
    const id=text(recipe?.id);
    if(id){const {data,error}=await c.from('nutrition_recipes').update({...row,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',uid).select('*').single();if(error)throw error;return {ok:true,recipe:data,totals}}
    const {data,error}=await c.from('nutrition_recipes').insert(row).select('*').single();if(error)throw error;return {ok:true,recipe:data,totals};
  }

  async function deleteRecipe(recipeId){
    const uid=currentUserId();if(!uid||!recipeId)throw new Error('No se pudo identificar la receta.');
    const c=await client();const {error}=await c.from('nutrition_recipes').delete().eq('id',String(recipeId)).eq('user_id',uid);
    if(error)throw error;return {ok:true};
  }

  function mergeLocalFirst(localItems,externalItems,query){
    const local=Array.isArray(localItems)?localItems:[];
    const external=Array.isArray(externalItems)?externalItems:[];
    const localOrdered=[...local].sort((a,b)=>relevance(b,query)-relevance(a,query));

    // Evitamos mostrar dos veces el mismo alimento cuando Open Food Facts
    // devuelve exactamente el mismo nombre/marca que ya tenemos en el catálogo.
    const localExactKeys=new Set(localOrdered.map(item=>{
      const name=normalizeSearch(item?.name);
      const brand=normalizeSearch(item?.brand);
      return `${name}|${brand}`;
    }));

    const externalOrdered=[...external]
      .filter(Boolean)
      .sort((a,b)=>relevance(b,query)-relevance(a,query))
      .filter(item=>{
        const key=`${normalizeSearch(item?.name)}|${normalizeSearch(item?.brand)}`;
        return !localExactKeys.has(key);
      });

    // El catálogo propio siempre aparece primero. Después se agregan los
    // resultados de Open Food Facts, aunque exista una coincidencia local.
    return dedupe([...localOrdered,...externalOrdered]);
  }

  async function searchWithLocalFirst(query,externalSearch){
    let local={user:[],catalog:[],all:[]};
    try{
      local=await searchLocal(query);
    }catch(err){
      console.warn('Catálogo propio no disponible; continúo con API externa.',err);
    }

    try{
      const external=typeof externalSearch==='function'?await externalSearch(query):[];
      const externalNorm=Array.isArray(external)?external:[];
      const merged=mergeLocalFirst(local.all,externalNorm,query);
      return {
        results:merged.slice(0,20),
        source:local.all.length&&externalNorm.length?'local+online':(local.all.length?'local':'online'),
        localCount:local.all.length,
        externalCount:externalNorm.length
      };
    }catch(err){
      console.warn('Open Food Facts no disponible; mostrando catálogo propio.',err);
      return {
        results:dedupe(local.all).slice(0,20),
        source:local.all.length?'local':'online-error',
        localCount:local.all.length,
        externalCount:0
      };
    }
  }

  function setSavedButtonState(saved,message){
    const btn=$('nutritionFoodSave');
    if(btn){btn.disabled=!!saved;btn.textContent=saved?'✓ Guardado en mis alimentos':'☆ Guardar en mis alimentos';}
    if(message){const st=$('nutritionFoodCatalogStatus');if(st)st.textContent=message;}
  }

  function installHooks(){
    /* Los guardados de comidas se conectan desde 03-inline-script-03.js para
     * garantizar que la instantánea se escriba solo después de que Supabase
     * haya confirmado nutrition_meals. */
  }

  window.AgendaNutritionData={
    searchLocal,
    searchWithLocalFirst,
    saveUserFood,
    snapshot,
    persistMealItems,
    deleteMealItems,
    loadMealItems,
    setMealItemConsumed,
    recordConsumptionHistory,
    loadConsumptionHistory,
    loadRecipes,
    saveRecipe,
    deleteRecipe,
    calculateRecipe,
    setSavedButtonState,
    installHooks
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHooks,{once:true});else installHooks();
})();
