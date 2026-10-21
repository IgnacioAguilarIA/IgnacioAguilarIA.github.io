const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const persistence=fs.readFileSync(path.join(root,'js/49-nutrition-persistence.js'),'utf8');
const advanced=fs.readFileSync(path.join(root,'js/58-nutrition-advanced.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'sql/25-nutrition-recipes-advanced.sql'),'utf8');
const postcheck=fs.readFileSync(path.join(root,'sql/26-nutrition-recipes-advanced-postcheck.sql'),'utf8');
const css=fs.readFileSync(path.join(root,'css/76-nutrition-advanced.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let passed=0;
function test(name,fn){fn();passed++;console.log(`✓ ${name}`)}

test('La migración agrega instrucciones, tiempos y vínculo de variante sin eliminar datos previos',()=>{
  assert.match(migration,/begin;/i);assert.match(migration,/commit;/i);
  assert.match(migration,/add column if not exists instructions jsonb not null default '\[\]'::jsonb/i);
  assert.match(migration,/add column if not exists prep_time_minutes integer not null default 0/i);
  assert.match(migration,/add column if not exists cook_time_minutes integer not null default 0/i);
  assert.match(migration,/add column if not exists parent_recipe_id uuid/i);
  assert.doesNotMatch(migration,/\bdelete\s+from\s+public\.nutrition_recipes/i);
});
test('La base limita minutos, tipo de lista, cantidad de pasos y longitud de cada paso en servidor',()=>{
  assert.match(migration,/jsonb_typeof\(instructions\) = 'array'/i);
  assert.match(migration,/prep_time_minutes between 0 and 1440/i);
  assert.match(migration,/cook_time_minutes between 0 and 1440/i);
  assert.match(migration,/jsonb_array_length\(new\.instructions\) > 40/i);
  assert.match(migration,/jsonb_typeof\(v_step\) <> 'string'/i);
  assert.match(migration,/length\(v_text\) > 1000/i);
});
test('Una variante no puede apuntar a sí misma ni a una receta de otra cuenta',()=>{
  assert.match(migration,/new\.parent_recipe_id = new\.id/i);
  assert.match(migration,/v_parent_user <> new\.user_id/i);
  assert.match(migration,/before insert or update of parent_recipe_id, user_id/i);
});
test('El historial guarda una instantánea de ingredientes, pasos, tiempos y nutrición',()=>{
  assert.match(migration,/create table if not exists public\.nutrition_recipe_preparation_history/i);
  for(const field of ['ingredients','instructions','prep_time_minutes','cook_time_minutes','calories_per_100g','protein_per_100g','carbs_per_100g','fat_per_100g','fiber_per_100g'])assert.match(migration,new RegExp(`'${field}'`));
  assert.match(migration,/recipe_snapshot jsonb not null check \(jsonb_typeof\(recipe_snapshot\) = 'object'\)/i);
  assert.match(migration,/on delete set null/i);
});
test('La tabla de historial tiene RLS y el cliente autenticado recibe solo SELECT directo',()=>{
  assert.match(migration,/alter table public\.nutrition_recipe_preparation_history enable row level security/i);
  assert.match(migration,/using \(auth\.uid\(\) = user_id\)/i);
  assert.match(migration,/grant select on table public\.nutrition_recipe_preparation_history to authenticated/i);
  assert.match(migration,/revoke all privileges on table public\.nutrition_recipe_preparation_history from public, anon, authenticated/i);
  assert.doesNotMatch(migration,/grant\s+(?:insert|update|delete|all privileges)\s+on table public\.nutrition_recipe_preparation_history to authenticated/i);
});
test('El registro de preparación es RPC SECURITY DEFINER con comprobación explícita de usuario y receta propia',()=>{
  assert.match(migration,/function public\.nutrition_record_recipe_preparation/i);
  assert.match(migration,/security definer/i);
  assert.match(migration,/v_uid uuid := auth\.uid\(\)/i);
  assert.match(migration,/where id=p_recipe_id and user_id=v_uid/i);
  assert.match(migration,/grant execute on function public\.nutrition_record_recipe_preparation\(uuid,text,date,numeric,numeric,text\) to authenticated/i);
});
test('La clave idempotente evita duplicar preparaciones al reintentar una respuesta incierta',()=>{
  assert.match(migration,/unique \(user_id, operation_key\)/i);
  assert.match(migration,/on conflict \(user_id,operation_key\) do nothing returning \*/i);
  assert.match(migration,/duplicate',not v_inserted/i);
});
test('El postcheck no modifica la base de datos',()=>{
  assert.doesNotMatch(postcheck,/\b(insert|update|delete|alter|drop|create|grant|revoke|truncate)\s+/i);
  assert.match(postcheck,/information_schema\.routine_privileges/i);
  assert.match(postcheck,/relrowsecurity/i);
});
test('El módulo de persistencia valida los pasos y tiempos antes de guardar la receta',()=>{
  assert.match(persistence,/instructionsRaw\.map\(step=>text\(step\)\)/);
  assert.match(persistence,/instructions\.length>40/);
  assert.match(persistence,/step\.length>1000/);
  assert.match(persistence,/value<0\|\|value>1440/);
  assert.match(persistence,/instructions,prep_time_minutes:prepTime,cook_time_minutes:cookTime,parent_recipe_id:parentRecipeId/);
});
test('El registro de preparación envía una solicitud autenticada al RPC y valida fecha, peso y porciones',()=>{
  assert.match(persistence,/async function recordRecipePreparation\(options=\{\}\)/);
  assert.match(persistence,/canonicalPreparedDate!==preparedOn/);
  assert.match(persistence,/p_finished_weight_g:finishedWeight,p_servings_made:servings/);
  assert.match(persistence,/c\.rpc\('nutrition_record_recipe_preparation'/);
  assert.match(persistence,/async function loadRecipePreparationHistory\(options=\{\}\)/);
  assert.match(persistence,/\.eq\('user_id',uid\)/);
});
test('La interfaz incluye pasos, tiempos, variante separada y registro de tandas',()=>{
  for(const value of ['nutritionRecipeInstructions','nutritionRecipePrepTime','nutritionRecipeCookTime','data-recipe-variant','data-recipe-log','nutritionRecipePreparationForm'])assert.ok(advanced.includes(value),`falta ${value}`);
  assert.match(advanced,/id:null,parent_recipe_id:recipe\.id/);
  assert.match(advanced,/Los cambios no modifican la receta original/);
});
test('El modo de cocina avanza, retrocede y solicita Wake Lock cuando el navegador lo admite',()=>{
  assert.match(advanced,/function openRecipeCookingMode\(recipe\)/);
  assert.match(advanced,/nutritionRecipeCookPrev/);
  assert.match(advanced,/nutritionRecipeCookNext/);
  assert.match(advanced,/navigator\.wakeLock\.request\('screen'\)/);
  assert.match(advanced,/if\(activeWakeLock\).*lock\.release/s);
  assert.match(advanced,/visibilitychange/);
});
test('El historial presenta los valores de la instantánea y conserva preparaciones tras editar o borrar la receta',()=>{
  assert.match(advanced,/recipe_snapshot/);
  assert.match(advanced,/loadRecipePreparationHistory/);
  assert.match(advanced,/openRecipePreparationHistory/);
  assert.ok(/on delete set null/i.test(migration));
});
test('El modo de cocina y sus controles tienen estilos adaptables, foco visible y movimiento reducido',()=>{
  assert.match(css,/\.nutrition-recipe-cook-step/);
  assert.match(css,/\.nutrition-recipe-cook-mode button:focus-visible/);
  assert.match(css,/@media\(max-width:580px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/css\/76-nutrition-advanced\.css/);
  assert.match(html,/js\/58-nutrition-advanced\.js/);
});
test('La acción para guardar una receta se enlaza una sola vez',()=>{
  const matches=advanced.match(/nutritionMealBuilderSaveRecipe'\)\?\.addEventListener\('click',saveRecipeModal\)/g)||[];
  assert.equal(matches.length,1);
});

// Smoke test de la API: valida que el código siga inicializando en un contexto aislado.
const window={};const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
vm.runInNewContext(persistence,{window,document,console,Date,Math,Number,String,Array,Object,Map,Set,RegExp,Error,JSON,Intl,Promise,globalThis:{crypto:null}});
assert.ok(window.AgendaNutritionData);
passed++;console.log('✓ El módulo de persistencia se inicializa en un contexto aislado');

(async()=>{
  const captured={inserted:null,rpc:[],queries:[]};
  const mockClient={
    from(table){
      const query={table,filters:[],insert(row){captured.inserted={...row};return this},update(row){captured.updated={...row};return this},select(){return this},eq(column,value){this.filters.push([column,value]);return this},order(){return this},limit(){return this},single:async()=>({data:{id:'recipe-advanced-1',...captured.inserted},error:null}),then(resolve,reject){captured.queries.push({table,filters:[...this.filters]});return Promise.resolve({data:[{id:'prep-1',user_id:'user-1',recipe_id:'recipe-advanced-1',recipe_name:'Avena',recipe_snapshot:{name:'Avena'},prepared_on:'2026-10-18',servings_made:2}],error:null}).then(resolve,reject)}};
      return query;
    },
    async rpc(name,args){captured.rpc.push({name,args});return {data:{ok:true,duplicate:false,id:'prep-1'},error:null}}
  };
  const runtimeWindow={};
  const runtimeDocument={readyState:'loading',addEventListener(){},getElementById(){return null}};
  const runtime={window:runtimeWindow,document:runtimeDocument,console,Date,Math,Number,String,Array,Object,Map,Set,RegExp,Error,JSON,Intl,Promise,currentUser:{id:'user-1'},ensureSupabase:async()=>mockClient,globalThis:{crypto:null}};
  vm.runInNewContext(persistence,runtime);
  const api=runtimeWindow.AgendaNutritionData;
  const ingredient={name:'Avena',quantity:100,unit:'g',calories_per_100g:380,protein_per_100g:13,carbs_per_100g:68,fat_per_100g:7,fiber_per_100g:10};
  const saved=await api.saveRecipe({name:'Avena',servings:2,ingredients:[ingredient],instructions:['Mezclar','Cocinar'],prepTimeMinutes:5,cookTimeMinutes:8,parentRecipeId:null});
  assert.equal(saved.recipe.id,'recipe-advanced-1');
  assert.deepEqual(Array.from(captured.inserted.instructions),['Mezclar','Cocinar']);
  assert.equal(captured.inserted.prep_time_minutes,5);assert.equal(captured.inserted.cook_time_minutes,8);assert.equal(captured.inserted.parent_recipe_id,null);
  passed++;console.log('✓ Prueba dinámica: guardar receta conserva pasos, tiempos y vínculo de variante');
  await assert.rejects(()=>api.saveRecipe({name:'Demasiados pasos',servings:1,ingredients:[ingredient],instructions:Array.from({length:41},(_,i)=>`Paso ${i+1}`)}),/máximo 40 pasos/);
  passed++;console.log('✓ Prueba dinámica: una receta con más de 40 pasos es rechazada antes de escribir');
  await assert.rejects(()=>api.recordRecipePreparation({recipeId:'recipe-advanced-1',operationKey:'op-invalid',preparedOn:'2026-02-30',servingsMade:2}),/fecha de preparación válida/);
  assert.equal(captured.rpc.length,0);
  passed++;console.log('✓ Prueba dinámica: se rechaza una fecha inexistente sin llamar a Supabase');
  const result=await api.recordRecipePreparation({recipeId:'recipe-advanced-1',operationKey:'op-1',preparedOn:'2026-10-18',finishedWeightG:350,servingsMade:2,notes:'Tanda de prueba'});
  assert.equal(result.ok,true);assert.equal(captured.rpc[0].name,'nutrition_record_recipe_preparation');assert.equal(captured.rpc[0].args.p_operation_key,'op-1');assert.equal(captured.rpc[0].args.p_finished_weight_g,350);
  passed++;console.log('✓ Prueba dinámica: registrar preparación envía al RPC los datos validados y la clave idempotente');
  const rows=await api.loadRecipePreparationHistory({recipeId:'recipe-advanced-1',limit:20});
  assert.equal(rows.length,1);assert.ok(captured.queries.some(query=>query.table==='nutrition_recipe_preparation_history'&&query.filters.some(pair=>pair[0]==='user_id'&&pair[1]==='user-1')&&query.filters.some(pair=>pair[0]==='recipe_id'&&pair[1]==='recipe-advanced-1')));
  passed++;console.log('✓ Prueba dinámica: el historial filtra por usuario y receta');
  console.log(`Etapa E4A: ${passed} pruebas aprobadas.`);
})().catch(error=>{console.error(error);process.exitCode=1});
