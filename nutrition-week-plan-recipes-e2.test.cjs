const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/63-nutrition-week-plan-editor.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const shoppingSrc=fs.readFileSync(path.join(root,'js/62-nutrition-week-planner-shopping.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/86-nutrition-week-plan-editor.css'),'utf8');
const weeklySql=fs.readFileSync(path.join(root,'sql/19-nutrition-weekly-plan.sql'),'utf8');
const fakeDocument={readyState:'loading',addEventListener(){},getElementById(){return null},createElement(){throw new Error('DOM inesperado en tests puros')}};
const tests=[];
function test(name,fn){tests.push([name,fn])}
function loadInert(source,extra={}){
  const window={};
  const context={window,document:fakeDocument,Intl,Date,Map,Set,String,Number,Math,Array,Object,RegExp,Error,JSON,Promise,crypto:{randomUUID:()=> 'test-id'},...extra};
  vm.runInNewContext(source,context);
  return {window,context};
}
function makePlanClient(rows,onRange){
  const calls=[];
  const client={from(table){
    calls.push({table,filters:[],columns:''});
    const call=calls[calls.length-1];
    const query={
      select(columns){call.columns=columns;return this},
      eq(column,value){call.filters.push([column,value]);return this},
      order(){return this},
      range:async(start,end)=>{
        if(onRange)await onRange(call);
        const filtered=rows.filter(row=>call.filters.every(([key,value])=>String(row[key])===String(value)));
        return {data:filtered.slice(start,end+1),error:null};
      }
    };
    return query;
  }};
  return {client,calls};
}
async function makePlanApi(rows,options={}){
  const user={id:options.uid||'owner-1'};
  const window={currentUser:user};
  const {client,calls}=makePlanClient(rows,options.onRange);
  const context={window,document:fakeDocument,currentUser:user,ensureSupabase:async()=>client,Intl,Date,Map,Set,String,Number,Math,Array,Object,RegExp,Error,JSON,Promise,crypto:{randomUUID:()=> 'test-id'}};
  vm.runInNewContext(src,context);
  return {api:window.AgendaNutritionWeeklyPlan,context,user,calls};
}

const recipe={
  id:'recipe-1',name:'Arroz con verduras',servings:4,total_weight_g:400,
  calories_per_100g:150,protein_per_100g:10,carbs_per_100g:25,fat_per_100g:3,fiber_per_100g:2,
  updated_at:'2026-10-17T12:00:00Z',
  ingredients:[
    {name:'Arroz cocido',brand:'',quantity:200,unit:'g',preparation_state:'cooked',categories:'Almacén'},
    {name:'Zanahoria',brand:'Huerta',quantity:300,unit:'g',preparation_state:'raw',categories:'Verdulería'},
    {name:'Caldo',brand:'',quantity:100,unit:'ml',preparation_state:'prepared',categories:'Almacén'}
  ]
};

const loaded=loadInert(src);
const api=loaded.window.AgendaNutritionWeeklyPlan;
assert.ok(api,'El editor semanal debe exponer su API comprobable');

test('Escala ingredientes y nutrientes al planificar menos porciones que el rendimiento guardado',()=>{
  const snapshot=api.snapshotForRecipe(recipe,2);
  assert.deepEqual(Array.from(snapshot.ingredients,x=>x.quantity),[100,150,50]);
  assert.deepEqual(Array.from(snapshot.ingredients,x=>x.unit),['g','g','ml']);
  assert.equal(snapshot.nutrition.calories,300);
  assert.equal(snapshot.nutrition.protein_g,20);
  assert.equal(snapshot.nutrition.carbs_g,50);
  assert.equal(snapshot.nutrition.fat_g,6);
  assert.equal(snapshot.nutrition.fiber_g,4);
});

test('Conserva marca, preparación, categoría y metadatos en una instantánea independiente',()=>{
  const snapshot=api.snapshotForRecipe(recipe,1.5);
  assert.equal(snapshot.ingredients[1].brand,'Huerta');
  assert.equal(snapshot.ingredients[1].preparation_state,'raw');
  assert.equal(snapshot.ingredients[1].categories,'Verdulería');
  assert.equal(snapshot.nutrition.source_recipe.id,'recipe-1');
  assert.equal(snapshot.nutrition.source_recipe.name,'Arroz con verduras');
  assert.equal(snapshot.nutrition.source_recipe.yield_servings,4);
  assert.equal(snapshot.nutrition.source_recipe.planned_servings,1.5);
  assert.equal(snapshot.nutrition.source_recipe.snapshot_version,1);
  assert.equal(recipe.ingredients[0].quantity,200,'No debe mutar la receta original');
});

test('No mezcla unidades diferentes ni normaliza crudo y cocido como si fueran iguales',()=>{
  const snapshot=api.snapshotForRecipe(recipe,4);
  assert.notEqual(snapshot.ingredients[0].unit,snapshot.ingredients[2].unit);
  assert.notEqual(snapshot.ingredients[0].preparation_state,snapshot.ingredients[1].preparation_state);
  const legacy=api.safeSnapshotItems([{name:'Ingrediente antiguo',quantity:250,unit:''}]);
  assert.equal(legacy[0].unit,'sin unidad');
  assert.equal(legacy[0].quantity,null);
  assert.equal(legacy[0].quantity_known,false,'No debe asumir gramos si falta la unidad de origen');
});

test('Rechaza cantidades de porciones nulas, negativas, no numéricas o superiores al límite',()=>{
  for(const value of [0,-1,'abc',null,1001])assert.throws(()=>api.snapshotForRecipe(recipe,value));
});

test('Rechaza recetas sin rendimiento o sin ingredientes detallados',()=>{
  assert.throws(()=>api.snapshotForRecipe({...recipe,servings:0},1),/rendimiento válido/);
  assert.throws(()=>api.snapshotForRecipe({...recipe,ingredients:[]},1),/ingredientes detallados/);
});

test('Rechaza ingredientes sin cantidad positiva o sin unidad en lugar de inventar una cantidad',()=>{
  assert.throws(()=>api.snapshotForRecipe({...recipe,ingredients:[{name:'Arroz',quantity:null,unit:'g'}]},1),/cantidad válida/);
  assert.throws(()=>api.snapshotForRecipe({...recipe,ingredients:[{name:'Arroz',quantity:100,unit:''}]},1),/unidad definida/);
});

test('La interfaz usa las recetas autenticadas y guarda origen más instantánea para la compra',()=>{
  assert.match(src,/source_recipe_id/);
  assert.match(src,/AgendaNutritionData/);
  assert.match(src,/loadRecipes\(\)/);
  assert.match(src,/assertOwner\(who\)/);
  assert.match(src,/snapshot_version:1/);
  assert.match(src,/source_recipe:source/);
  assert.match(src,/ingredients_snapshot:snap\.ingredients/);
  assert.match(src,/Array\.isArray\(meal\.ingredients_snapshot\)/);
  assert.match(shoppingSrc,/AgendaNutritionWeeklyPlan/);
  assert.match(shoppingSrc,/getShoppingSource\(owner,week\)/);
  assert.match(shoppingSrc,/aggregateItems\(plan\.items\)/);
});

test('El origen de compras lee solo la semana y la cuenta activas y conserva la instantánea de cada comida',async()=>{
  const monday='2026-10-12';
  const snapshot=[{name:'Arroz',quantity:200,unit:'g',preparation_state:'cooked',categories:'Almacén'}];
  const rows=[
    {id:'meal-1',user_id:'owner-1',week_start:monday,day_offset:0,meal_type:'almuerzo',title:'Arroz',planned_time:'12:00',ingredients_snapshot:snapshot},
    {id:'meal-wrong-user',user_id:'owner-2',week_start:monday,ingredients_snapshot:[{name:'Ajeno',quantity:999,unit:'g'}]},
    {id:'meal-wrong-week',user_id:'owner-1',week_start:'2026-10-19',ingredients_snapshot:[{name:'Otra semana',quantity:999,unit:'g'}]}
  ];
  const {api,calls}=await makePlanApi(rows);
  const result=await api.getShoppingSource('owner-1',monday);
  assert.equal(result.meals.length,1);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].name,'Arroz');
  assert.equal(result.items[0].quantity,200);
  assert.equal(result.items[0].meal_id,'meal-1');
  assert.equal(result.items[0].user_id,'owner-1');
  assert.equal(calls[0].table,'nutrition_weekly_plan_items');
  assert.ok(calls[0].filters.some(([k,v])=>k==='user_id'&&v==='owner-1'));
  assert.ok(calls[0].filters.some(([k,v])=>k==='week_start'&&v===monday));
});

test('La fuente de compras rechaza semanas que no comienzan en lunes y un cambio de cuenta durante la lectura',async()=>{
  const {api,calls}=await makePlanApi([]);
  await assert.rejects(()=>api.getShoppingSource('owner-1','2026-10-13'),/debe comenzar un lunes/);
  assert.equal(calls.length,0,'No consulta Supabase con una fecha inválida');
  const rows=[{id:'meal-1',user_id:'owner-1',week_start:'2026-10-12',ingredients_snapshot:[]}];
  const switched=await makePlanApi(rows,{onRange:async()=>{switchedUser.id='owner-2'}}).catch(e=>{throw e});
  const switchedUser=switched.user;
  await assert.rejects(()=>switched.api.getShoppingSource('owner-1','2026-10-12'),/cuenta activa cambió/);
});

test('La generación agrupa solo ingredientes compatibles y no suma unidades ni preparaciones distintas',()=>{
  const shop=loadInert(shoppingSrc).window.AgendaNutritionPlanner;
  const rows=shop.aggregateItems([
    {name:'Zanahoria',brand:'',quantity:100,unit:'g',preparation_state:'raw',categories:'Verdulería',meal_id:'m1'},
    {name:'zanahoria',brand:'',quantity:50,unit:'gramos',preparation_state:'raw',categories:'Verdulería',meal_id:'m2'},
    {name:'Zanahoria',brand:'',quantity:20,unit:'ml',preparation_state:'raw',categories:'Verdulería',meal_id:'m3'},
    {name:'Zanahoria',brand:'',quantity:100,unit:'g',preparation_state:'cooked',categories:'Verdulería',meal_id:'m4'},
    {name:'Salsa',brand:'',quantity:2,unit:'plan',preparation_state:'prepared',categories:'Almacén',meal_id:'m5'},
    {name:'Especia',brand:'',quantity:null,quantity_known:false,unit:'g',preparation_state:'unspecified',categories:'Almacén',meal_id:'m6'},
    {name:'Ingrediente heredado',brand:'',quantity:250,unit:'',preparation_state:'unspecified',categories:'Otros',meal_id:'m7'}
  ]);
  const carrots=Array.from(rows).filter(x=>x.name.toLocaleLowerCase('es')==='zanahoria');
  assert.equal(carrots.length,3);
  const rawGrams=carrots.find(x=>x.unit==='g'&&x.preparation_state==='raw');
  assert.equal(rawGrams.quantity,150);
  assert.deepEqual(Array.from(rawGrams.source_meals),['m1','m2']);
  assert.ok(carrots.some(x=>x.unit==='ml'&&x.quantity===20));
  assert.ok(carrots.some(x=>x.unit==='g'&&x.preparation_state==='cooked'&&x.quantity===100));
  assert.ok(!Array.from(rows).some(x=>x.name==='Salsa'));
  assert.ok(Array.from(rows).some(x=>x.name==='Especia'&&x.quantity_known===false));
  assert.ok(Array.from(rows).some(x=>x.name==='Ingrediente heredado'&&x.unit==='sin unidad'&&x.quantity_known===false));
});

test('Detecta cambios de cantidades en productos ya comprados sin marcar como conflicto los productos manuales',()=>{
  const shop=loadInert(shoppingSrc).window.AgendaNutritionPlanner;
  const desired=shop.aggregateItems([{name:'Arroz',quantity:500,unit:'g',preparation_state:'raw',meal_id:'m1'}]);
  const bought={...desired[0],id:'bought-1',source:'generated',checked:true,active:true,quantity:300};
  const same={...desired[0],id:'bought-2',source:'generated',checked:true,active:true,quantity:500};
  const manual={...desired[0],id:'manual-1',source:'manual',checked:true,quantity:100};
  assert.equal(shop.findPurchasedQuantityConflicts([bought,same,manual],desired).length,1);
  assert.equal(shop.findPurchasedQuantityConflicts([same,manual],desired).length,0);
  assert.equal(shop.sameKnownQuantity({quantity:100,quantity_known:false},{quantity:100,quantity_known:true}),false);
  assert.match(shoppingSrc,/const purchasedConflicts=findPurchasedQuantityConflicts\(existing,grouped\)/);
  assert.match(shoppingSrc,/Aceptar: actualizar esas cantidades según el plan nuevo/);
  assert.match(shoppingSrc,/preservePurchased&&prev\.source==='generated'&&prev\.checked&&!sameKnownQuantity\(prev,item\)/);
});

test('El editor usa estilos locales, la tabla mantiene snapshots con RLS y el HTML carga módulos en orden',()=>{
  assert.match(css,/nutrition-plan-field-help/);
  assert.match(css,/nutrition-plan-source-meta/);
  assert.match(weeklySql,/ingredients_snapshot jsonb not null default '\[\]'::jsonb/);
  assert.match(weeklySql,/auth\.uid\(\) = user_id/);
  assert.ok(html.indexOf('js/49-nutrition-persistence.js')<html.indexOf('js/63-nutrition-week-plan-editor.js'));
  assert.ok(html.indexOf('js/62-nutrition-week-planner-shopping.js')<html.indexOf('js/63-nutrition-week-plan-editor.js'));
  assert.ok(html.indexOf('css/86-nutrition-week-plan-editor.css')>=0);
});

(async()=>{
  let passed=0;
  for(const [name,fn] of tests){await fn();passed++;console.log(`✓ ${name}`)}
  console.log(`E2: ${passed} pruebas aprobadas.`);
})().catch(error=>{console.error(error);process.exitCode=1});
