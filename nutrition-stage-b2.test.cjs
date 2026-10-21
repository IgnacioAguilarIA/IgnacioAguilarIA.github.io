const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadNutritionData(){
  const events={};
  const fakeDocument={readyState:'complete',getElementById:()=>null,addEventListener(){},dispatchEvent(){}};
  const fakeWindow={};
  const context={window:fakeWindow,document:fakeDocument,console,Map,Set,Intl,Date,Number,String,Object,Array,Math,JSON,Promise,CustomEvent:function(name,opts){this.type=name;this.detail=opts?.detail},setTimeout,clearTimeout};
  const source=fs.readFileSync(path.join(__dirname,'../js/49-nutrition-persistence.js'),'utf8');
  vm.runInNewContext(source,context,{filename:'49-nutrition-persistence.js'});
  return fakeWindow.AgendaNutritionData;
}
const api=loadNutritionData();
const checks=[];
function test(name,fn){fn();checks.push(name)}

test('100 g equivale a 100 g',()=>assert.equal(api.quantityToGrams({},100,'g'),100));
test('100 ml usa densidad explícita y no asume 1 g/ml',()=>assert.equal(api.quantityToGrams({density_g_per_ml:1.03},100,'ml'),103));
test('una unidad usa gramos por unidad explícitos',()=>assert.equal(api.quantityToGrams({grams_per_unit:48},2,'unit'),96));
test('una porción usa su propio peso por porción explícito',()=>assert.equal(api.quantityToGrams({gramsPerPortion:135},2,'portion'),270));
test('un peso de unidad no se reutiliza como peso de porción',()=>assert.equal(api.quantityToGrams({gramsPerUnit:135},2,'portion'),null));
test('un peso de porción no se reutiliza como peso de unidad',()=>assert.equal(api.quantityToGrams({gramsPerPortion:135},2,'unit'),null));
test('sin densidad no convierte ml',()=>assert.equal(api.quantityToGrams({},100,'ml'),null));
test('sin peso por unidad no convierte unidad',()=>assert.equal(api.quantityToGrams({},1,'unit'),null));
test('snapshot conserva gramos, densidad y estado',()=>{const x=api.snapshot({name:'Leche',calories:60,densityGPerMl:1.03,gramsPerUnit:null,preparationState:'unspecified'},100,'ml','prepared');assert.equal(x.quantity_in_grams,103);assert.equal(x.preparation_state,'prepared');assert.equal(x.unit,'ml')});
test('nombre explicito arroz cocido detecta estado cocido',()=>assert.equal(api.normalizePreparationState('unspecified','Arroz cocido'),'cooked'));
test('receta convierte ingredientes antes de calcular macros',()=>{const r=api.calculateRecipe([{name:'A',quantity:100,unit:'g',calories_per_100g:100,protein_per_100g:10,carbs_per_100g:10,fat_per_100g:2},{name:'B',quantity:100,unit:'ml',density_g_per_ml:1.2,quantity_in_grams:120,calories_per_100g:200,protein_per_100g:5,carbs_per_100g:20,fat_per_100g:10}]);assert.equal(r.ingredient_weight_g,220);assert.equal(r.total_calories,340);assert.equal(r.calories_per_100g,154.5)});
test('peso final preparado cambia denominador, no energía total',()=>{const r=api.calculateRecipe([{name:'A',quantity:100,unit:'g',calories_per_100g:200}],80);assert.equal(r.ingredient_weight_g,100);assert.equal(r.total_weight_g,80);assert.equal(r.total_calories,200);assert.equal(r.calories_per_100g,250)});
test('receta no inventa conversión ml desconocida',()=>assert.throws(()=>api.calculateRecipe([{name:'Leche',quantity:100,unit:'ml',calories_per_100g:60}]),/conversión fiable/));
test('migración es aditiva e incluye equivalencias separadas y snapshots',()=>{const sql=fs.readFileSync(path.join(__dirname,'../sql/12-nutrition-units-preparation.sql'),'utf8');assert.match(sql,/add column if not exists quantity_in_grams/i);assert.match(sql,/add column if not exists grams_per_portion/i);assert.match(sql,/density_g_per_ml > 0 then greatest\(0,quantity\) \* density_g_per_ml/i);assert.match(sql,/grams_per_portion > 0 then greatest/i);assert.match(sql,/else null end/i);assert.doesNotMatch(sql,/delete from public\.nutrition_meal_items/i)});
test('HTML expone unidades y estado sin modificar navegación',()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(html,/id="nutritionFoodQuantityUnit"/);assert.match(html,/id="nutritionFoodPreparationState"/);assert.match(html,/79-nutrition-units-preparation\.css/);const unitPos=html.indexOf('id=\"nutritionFoodQuantityUnit\"');assert.ok(unitPos>=0);assert.doesNotMatch(html.slice(unitPos,unitPos+500),/navigation|workout/i)});
test('instantánea de gramos prevalece sobre una densidad futura modificada',()=>assert.equal(api.weightInGrams({unit:'ml',quantity:100,quantity_in_grams:95,density_g_per_ml:1.2},100),95));
test('la validación del consumo carga primero la fila de la cuenta propietaria',()=>{const src=fs.readFileSync(path.join(__dirname,'../js/49-nutrition-persistence.js'),'utf8');assert.match(src,/data:before,error:readError/);assert.match(src,/eq\('id',String\(itemId\)\)\.eq\('user_id',uid\)\.maybeSingle\(\)/);const fn=src.slice(src.indexOf('async function setMealItemConsumed'),src.indexOf('async function loadRecipes'));assert.doesNotMatch(fn,/text\(item\?\.unit\)/)});

test('la etiqueta de porción respeta la unidad de la fuente',()=>{const src=fs.readFileSync(path.join(__dirname,'../js/47-nutrition-food-catalog.js'),'utf8');assert.match(src,/\[food\.unit\]\|\|'g'/);assert.match(src,/esc\(food\.servingQuantity\).*servingUnit/);assert.doesNotMatch(src,/normalizeUnit\(food\.unit\)/)});
test('la migración no propaga conversiones actuales a registros históricos',()=>{const sql=fs.readFileSync(path.join(__dirname,'../sql/12-nutrition-units-preparation.sql'),'utf8');assert.match(sql,/no se copian conversiones actuales del catálogo/i);assert.doesNotMatch(sql,/update public\.nutrition_meal_items\s+i[\s\S]*?from public\.user_foods/i)});
test('Open Food Facts no usa energía sin unidad por 100 g como kcal/100 g',()=>{const src=fs.readFileSync(path.join(__dirname,'../js/48-openfoodfacts-adapter.js'),'utf8');const body=src.slice(src.indexOf('function energyKcal'),src.indexOf('function normalizeProduct'));assert.match(body,/energy-kcal_100g/);assert.doesNotMatch(body,/n\['energy-kcal'\]/);assert.match(body,/hasNumericValue/)});

console.log(`Etapa B2: ${checks.length} pruebas aprobadas.`);
for(const item of checks)console.log(`OK - ${item}`);
