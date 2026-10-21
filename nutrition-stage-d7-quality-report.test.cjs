const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const document = {readyState:'loading', addEventListener(){}, createElement(){return {set textContent(value){this._text=String(value)},get innerHTML(){return this._text}}}};
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8'),{window,document,URL,Blob,Date,String,Array,Object,Number,Math,RegExp,console,confirm:()=>true,setTimeout,clearTimeout});
const api = window.AgendaNutritionQualityReports;
assert.ok(api);
let passed=0;
function test(name,fn){fn();passed++;console.log('✓',name)}
test('CSV neutraliza celdas que podrían ejecutar fórmulas en hojas de cálculo',()=>{
  assert.equal(api.csvCell('=1+1'), '"\'=1+1"');
  assert.equal(api.csvCell('+cmd'), '"\'+cmd"');
  assert.equal(api.csvCell('Pan "integral"'), '"Pan ""integral"""');
});
test('Estado desconocido se informa como registro previo no verificado',()=>{
  assert.match(api.qualityLabel('legacy_unverified'),/no verificado/i);
  assert.match(api.qualityLabel('user_verified'),/revisado por vos/i);
  assert.match(api.qualityLabel('inventado'),/no verificado/i);
});
test('El informe cuenta cada estado sin reinterpretar el valor nutricional cero',()=>{
  const counts=api.statusCounts([{nutrition_quality_status:'legacy_unverified'},{nutrition_quality_status:'user_verified'},{nutrition_quality_status:'source_complete'},{nutrition_quality_status:'incomplete'}]);
  assert.equal(counts.legacy_unverified,1);assert.equal(counts.user_verified,1);assert.equal(counts.source_complete,1);assert.equal(counts.incomplete,1);
});
test('La exportación de historial lleva procedencia y datos faltantes desde la instantánea',()=>{
  const rows=api.historyRows([{consumed_date:'2026-10-14',food_name:'Avena',item_snapshot:{data_source_label:'Open Food Facts',data_source_url:'https://world.openfoodfacts.org/product/123',nutrition_quality_status:'source_complete',nutrition_missing_fields:['grasas'],preparation_state:'raw'}}]);
  assert.equal(rows[0][12],'Open Food Facts');assert.equal(rows[0][13],'https://world.openfoodfacts.org/product/123');assert.equal(rows[0][14],'source_complete');assert.equal(rows[0][15],'grasas');assert.equal(rows[0][16],'raw');
});
test('La exportación de alimentos contiene procedencia, estado de calidad y nutrientes',()=>{
  const rows=api.foodRows([{name:'Arroz',data_source_label:'Carga manual',nutrition_quality_status:'manual_unverified',calories_per_100g:130,protein_per_100g:2.7}]);
  assert.equal(rows[0][0],'Arroz');assert.equal(rows[0][4],'Carga manual');assert.equal(rows[0][6],'manual_unverified');assert.equal(rows[0][8],130);
});
const persistence=fs.readFileSync(path.join(root,'js/49-nutrition-persistence.js'),'utf8');
test('Los informes paginan datos y filtran cada consulta por el usuario activo',()=>{
  assert.match(persistence,/async function loadNutritionQualityReport\(options=\{\}\)/);
  assert.match(persistence,/\.eq\('user_id',uid\)/);
  assert.match(persistence,/\.range\(offset,offset\+pageSize-1\)/);
});
test('La verificación de etiqueta exige ausencia de campos marcados como faltantes',()=>{
  assert.match(persistence,/async function markUserFoodVerified\(userFoodId\)/);
  assert.match(persistence,/if\(missing\.length\)throw new Error/);
  assert.match(persistence,/nutrition_quality_status:'user_verified',nutrition_verified_at:verifiedAt/);
});
test('La instantánea del alimento guarda procedencia, URL, calidad, faltantes y fecha de verificación',()=>{
  assert.match(persistence,/data_source_label:text\(food\?\.sourceLabel/);
  assert.match(persistence,/nutrition_missing_fields:Array\.isArray\(food\?\.nutritionMissing\)/);
  assert.match(persistence,/nutrition_quality_status:text\(item\.nutrition_quality_status\|\|item\.nutritionQualityStatus\)/);
  assert.match(persistence,/data_source_url:/);
});
test('La lectura de catálogos carga las nuevas columnas de trazabilidad',()=>{
  assert.match(persistence,/data_source_label,data_source_url,nutrition_quality_status,nutrition_missing_fields,nutrition_verified_at/);
});
test('La verificación no actualiza alimentos de otra cuenta',()=>{
  const start=persistence.indexOf('async function markUserFoodVerified');
  const end=persistence.indexOf('function installHooks',start);
  const body=persistence.slice(start,end);
  assert.match(body,/\.eq\('user_id',uid\)/);
  assert.match(body,/assertSameUser\(uid\)/);
});
const adapter=fs.readFileSync(path.join(root,'js/48-openfoodfacts-adapter.js'),'utf8');
test('Open Food Facts conserva fuente, URL y estado de completitud sin marcarlo como verificado por usuario',()=>{
  assert.match(adapter,/sourceType:'open_food_facts'/);assert.match(adapter,/sourceUrl:code\?/);assert.match(adapter,/nutritionQualityStatus:missingNutrition\(product\)\.length\?'incomplete':'source_complete'/);
});
const sql=fs.readFileSync(path.join(root,'sql/21-nutrition-quality-provenance.sql'),'utf8');
test('La migración D7 es aditiva y registra procedencia sin borrar datos',()=>{
  assert.match(sql,/add column if not exists data_source_label/);assert.match(sql,/add column if not exists nutrition_missing_fields/);assert.match(sql,/nutrition_quality_status/);assert.doesNotMatch(sql,/\bdelete\s+from\b/i);assert.doesNotMatch(sql,/\bdrop\s+table\b/i);
});
test('La migración valida URLs y estados de calidad conocidos',()=>{
  assert.match(sql,/nutrition_quality_status in \('source_complete','user_verified','manual_unverified','incomplete','legacy_unverified'\)/);assert.match(sql,/\^https\?:\/\//i);
});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('El HTML enlaza el informe después del catálogo y del escáner existente',()=>{
  assert.ok(html.indexOf('js/64-nutrition-barcode-scanner.js')<html.indexOf('js/65-nutrition-quality-report.js'));
  assert.match(html,/css\/88-nutrition-quality-report\.css/);assert.match(html,/js\/65-nutrition-quality-report\.js/);
});
console.log(`D7: ${passed} pruebas aprobadas.`);
