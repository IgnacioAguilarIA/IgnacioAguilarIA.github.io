'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function loadPersistence(){
  const window={};
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  vm.runInNewContext(read('js/49-nutrition-persistence.js'),{window,document,console,Date,Math,Number,String,Array,Object,Map,Set,RegExp,Error,JSON,Intl,Promise});
  return {window,api:window.AgendaNutritionData};
}
function makeFood(overrides={}){
  return {name:'Arroz',quantity:100,unit:'g',quantity_in_grams:100,calories_per_100g:130,protein_per_100g:2.7,carbs_per_100g:28,fat_per_100g:.3,fiber_per_100g:1.2,nutrition_quality_status:'user_verified',nutrition_missing_fields:[],...overrides};
}

test('E25 recipe calculation labels an explicitly missing macro instead of treating it as zero',()=>{
  const {api}=loadPersistence();
  const known=makeFood();
  const incomplete=makeFood({name:'Producto con proteínas sin informar',calories_per_100g:90,protein_per_100g:0,carbs_per_100g:11,fat_per_100g:3,nutrition_quality_status:'incomplete',nutrition_missing_fields:['proteínas']});
  const result=api.calculateRecipe([known,incomplete]);
  assert.ok(Array.from(result.unknownMetrics).includes('protein'));
  assert.ok(!Array.from(result.unknownMetrics).includes('calories'));
  assert.equal(result.total_protein_g,0,'zero is an internal DB-compatible placeholder when the metric is unknown');
  assert.ok(result.total_calories>0);
});

test('E25 keeps an explicitly verified zero valid and tracks fiber completeness separately',()=>{
  const {api}=loadPersistence();
  const trueZero=makeFood({name:'Agua',calories_per_100g:0,protein_per_100g:0,carbs_per_100g:0,fat_per_100g:0,fiber_per_100g:0,nutrition_quality_status:'user_verified',nutrition_missing_fields:[]});
  const result=api.calculateRecipe([trueZero]);
  assert.deepEqual(Array.from(result.unknownMetrics),[]);
  assert.equal(result.calories_per_100g,0);
  const fiberUnknown=makeFood({nutrition_quality_status:'incomplete',nutrition_missing_fields:['fibra']});
  const withUnknownFiber=api.calculateRecipe([fiberUnknown]);
  assert.ok(Array.from(withUnknownFiber.unknownMetrics).includes('fiber'));
  assert.ok(!Array.from(withUnknownFiber.unknownMetrics).includes('protein'));
});

test('E25 preserves quantity conversion errors instead of fabricating recipe macros',()=>{
  const {api}=loadPersistence();
  assert.throws(()=>api.calculateRecipe([makeFood({quantity:1,quantity_in_grams:null,unit:'unit',grams_per_unit:null})]),/conversión fiable/);
});

test('E25 weekly plan snapshots scale known nutrient totals and preserve missing-metric flags',()=>{
  const {api}=loadPersistence();
  const window={AgendaNutritionData:api};
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;},createElement(){throw new Error('unexpected DOM in pure test')}};
  vm.runInNewContext(read('js/63-nutrition-week-plan-editor.js'),{window,document,Intl,Date,Map,Set,String,Number,Math,Array,Object,RegExp,Error,crypto:{randomUUID:()=> 'test-e25-id'}});
  const recipe={id:'recipe-e25',name:'Arroz de prueba',servings:2,total_weight_g:200,finished_weight_g:null,calories_per_100g:0,protein_per_100g:0,carbs_per_100g:0,fat_per_100g:0,ingredients:[
    makeFood({quantity:100,quantity_in_grams:100}),
    makeFood({name:'Producto incompleto',quantity:100,quantity_in_grams:100,calories_per_100g:90,protein_per_100g:0,carbs_per_100g:11,fat_per_100g:3,nutrition_quality_status:'incomplete',nutrition_missing_fields:['proteínas']})
  ]};
  const snap=window.AgendaNutritionWeeklyPlan.snapshotForRecipe(recipe,4);
  assert.equal(snap.nutrition.calories,440);
  assert.equal(snap.nutrition.protein_g,null);
  assert.equal(snap.nutrition.nutrition_quality_status,'incomplete');
  assert.ok(Array.from(snap.nutrition.nutrition_missing_metrics).includes('protein'));
  assert.equal(snap.nutrition.source_recipe.snapshot_version,2);
});

test('E25 recipe editor has explicit incomplete-data labels and reversible ingredient removal',()=>{
  const advanced=read('js/58-nutrition-advanced.js');
  const html=read('index.html');
  const css=read('css/106-nutrition-recipe-quality-e25.css');
  assert.match(advanced,/Datos incompletos/);
  assert.match(advanced,/¿Descartar los cambios de la receta\?/);
  assert.match(advanced,/nutritionRecipeUndoBtn/);
  assert.match(advanced,/expiresAt:Date\.now\(\)\+8000/);
  assert.match(advanced,/nutrition-quality|nutrition-summary/i);
  assert.match(html,/css\/106-nutrition-recipe-quality-e25\.css\?v=e25/);
  assert.match(html,/49-nutrition-persistence\.js\?v=e25/);
  assert.match(html,/58-nutrition-advanced\.js\?v=e25/);
  assert.match(html,/63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.doesNotMatch(css,/#workoutPanel|#agendaPanel|#calendarPanel|\.v28-workout/i);
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  assert.match(css,/forced-colors:\s*active/);
});
