const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const routineSource=fs.readFileSync(path.join(root,'js/59-nutrition-routine-tools.js'),'utf8');
const copySource=fs.readFileSync(path.join(root,'js/53-nutrition-meal-copy.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/80-nutrition-routine-tools.css'),'utf8');
const tests=[];
function test(name,fn){fn();tests.push(name)}
function loadRoutineTools(){
  const listeners={};const fakeDocument={readyState:'loading',addEventListener:(name,fn)=>{(listeners[name]||=[]).push(fn)},getElementById:()=>null};
  const fakeWindow={};
  const context={window:fakeWindow,document:fakeDocument,console,Intl,Date,Number,String,Object,Array,Map,Set,Math,JSON,Promise,Error,CustomEvent:function(n,o){this.type=n;this.detail=o?.detail},setTimeout,clearTimeout};
  vm.runInNewContext(routineSource,context,{filename:'59-nutrition-routine-tools.js'});
  return fakeWindow.AgendaNutritionRoutineTools;
}
const api=loadRoutineTools();

test('día copiado recibe nuevo día y dueño, sin reutilizar el ID de la comida original',()=>{const p=api.copiedMealPayload({id:'old',user_id:'u1',day:0,title:'Almuerzo',created_at:'old-time',updated_at:'old-time'},2,'u1');assert.equal(p.day,2);assert.equal(p.user_id,'u1');assert.equal(p.title,'Almuerzo');assert.equal('id' in p,false);assert.equal('created_at' in p,false)});
test('alimentos copiados generan nuevas filas y quedan desmarcados',()=>{const rows=api.copiedItemsForMeal([{id:'item-1',meal_id:'old',user_id:'u1',consumed:true,consumed_at:'2026-10-10',quantity:150}], 'new','u1');assert.equal(rows.length,1);assert.equal(rows[0].meal_id,'new');assert.equal(rows[0].user_id,'u1');assert.equal(rows[0].consumed,false);assert.equal(rows[0].consumed_at,null);assert.equal('id' in rows[0],false)});
test('promedios semanales calculan solo días con registros',()=>{const data=api.aggregateHistory([{consumed_date:'2026-10-11',calories:100,protein_g:10,carbs_g:20,fat_g:2},{consumed_date:'2026-10-11',calories:50,protein_g:5,carbs_g:8,fat_g:1}], '2026-10-12',7);assert.equal(data.registeredDays,1);assert.equal(data.unregisteredDays,6);assert.equal(data.averages.calories,150);assert.equal(data.days.find(x=>x.date==='2026-10-10').recorded,false)});
test('un día con registros cuyos nutrientes suman cero se diferencia de uno sin registros',()=>{const data=api.aggregateHistory([{consumed_date:'2026-10-12',calories:0,protein_g:0,carbs_g:0,fat_g:0}], '2026-10-12',7);const today=data.days.find(x=>x.date==='2026-10-12');const yesterday=data.days.find(x=>x.date==='2026-10-11');assert.equal(today.recorded,true);assert.equal(today.records,1);assert.equal(today.calories,0);assert.equal(yesterday.recorded,false)});
test('ignora registros fuera del período y fechas inválidas',()=>{const data=api.aggregateHistory([{consumed_date:'2026-09-01',calories:900,protein_g:0,carbs_g:0,fat_g:0},{consumed_date:'bad-date',calories:5}], '2026-10-12',7);assert.equal(data.registeredDays,0);assert.equal(data.averages.calories,null)});
test('consulta el historial autenticado con paginación por fecha',()=>{assert.match(routineSource,/from\('nutrition_consumption_history'\)\.select\('consumed_date,calories,protein_g,carbs_g,fat_g'\)/);assert.match(routineSource,/\.eq\('user_id',owner\)\.gte\('consumed_date',start\)\.lte\('consumed_date',today\)/);assert.match(routineSource,/\.range\(offset,offset\+pageSize-1\)/)});
test('copiar día carga primero todos los detalles antes de crear copias',()=>{const sourceFetch=routineSource.indexOf("from('nutrition_meals').select('*')");const itemFetch=routineSource.indexOf('api.loadMealItems(String(meal.id),owner)');const insert=routineSource.indexOf("from('nutrition_meals').insert(copiedMealPayload");assert.ok(sourceFetch>=0&&itemFetch>sourceFetch&&insert>itemFetch)});
test('si falla copiar día se intenta compensar con la función transaccional de eliminación',()=>{assert.match(routineSource,/rpc\('delete_nutrition_meal_and_items',\{p_meal_id:entry\.id\}\)/)});
test('deshacer captura comidas y detalles antes de delegar la eliminación',()=>{assert.ok(routineSource.indexOf('nutritionApi().loadMealItems(String(id),owner)')<routineSource.indexOf('await original.apply(this,arguments)'));assert.match(routineSource,/agenda:nutrition-meal-deleted/)});
test('deshacer conserva IDs de comida y detalle para mantener referencias históricas',()=>{assert.match(routineSource,/const mealPayload=\{\.\.\.snapshot\.meal,user_id:snapshot\.owner\}/);assert.match(routineSource,/const row=\{\.\.\.item,meal_id:String\(snapshot\.meal\.id\),user_id:snapshot\.owner\}/);assert.match(routineSource,/insert\(restoredItems\)/)});
test('la copia individual no permite continuar si no pudo cargar alimentos',()=>{assert.match(copySource,/sourceItemsLoadFailed=true/);assert.match(copySource,/No se duplicó nada para evitar una copia incompleta/);assert.match(copySource,/if\(!sourceItemsLoaded\|\|sourceItemsLoadFailed\)/)});
test('HTML carga solo el nuevo módulo de herramientas de Alimentación',()=>{assert.match(html,/css\/80-nutrition-routine-tools\.css/);assert.match(html,/js\/59-nutrition-routine-tools\.js/);assert.doesNotMatch(html,/navigation.*59-nutrition-routine-tools/s)});
test('los controles nuevos son responsivos y tienen foco de diálogo accesible',()=>{assert.match(css,/@media\(max-width:600px\)/);assert.match(routineSource,/role="dialog" aria-modal="true"/);assert.match(routineSource,/aria-live="polite"/)});
console.log(`Etapa B3: ${tests.length} pruebas aprobadas.`);
for(const name of tests)console.log(`OK - ${name}`);
