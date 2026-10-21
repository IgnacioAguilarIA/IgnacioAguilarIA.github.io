const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const document = {readyState:'loading', addEventListener(){}};
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8'), {window,document,URL,Blob,Date,String,Array,Object,Number,Math,RegExp,Intl,console,confirm:()=>true,setTimeout,clearTimeout});
const api = window.AgendaNutritionQualityReports;
assert.ok(api);
let passed=0;
function test(name,fn){fn();passed++;console.log('✓',name)}
const row=(date,meal_type,values={})=>({consumed_date:date,meal_type,calories:Object.hasOwn(values,'calories')?values.calories:100,protein_g:Object.hasOwn(values,'protein_g')?values.protein_g:5,carbs_g:Object.hasOwn(values,'carbs_g')?values.carbs_g:10,fat_g:Object.hasOwn(values,'fat_g')?values.fat_g:2});

test('Calcula el período anterior de igual duración, contiguo y sin solapamiento',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(api.previousPeriodRange('2026-10-01','2026-10-07'))),{from:'2026-09-24',to:'2026-09-30',days:7});
  assert.deepEqual(JSON.parse(JSON.stringify(api.previousPeriodRange('2026-03-01','2026-03-31'))),{from:'2026-01-29',to:'2026-02-28',days:31});
  assert.throws(()=>api.previousPeriodRange('fecha','2026-10-01'));
});

test('La comparación calcula diferencias solo cuando ambos períodos tienen totales completos',()=>{
  const current=api.dailySummary([row('2026-10-02','lunch',{calories:250})],'2026-10-01','2026-10-02');
  const prior=api.dailySummary([row('2026-09-30','lunch',{calories:200})],'2026-09-29','2026-09-30');
  const comparison=api.comparePeriods(current,prior);
  assert.equal(comparison.metrics.calories.comparable,true);
  assert.equal(comparison.metrics.calories.delta,50);
  assert.equal(comparison.metrics.calories.percent,25);
});

test('La falta de un nutriente en un día impide mostrar una suma completa, pero preserva el subtotal conocido y su denominador',()=>{
  const days=api.dailySummary([row('2026-10-01','lunch',{calories:100}),row('2026-10-02','lunch',{calories:null})],'2026-10-01','2026-10-02');
  const period=api.periodMetrics(days);
  assert.equal(days[1].calories,null);
  assert.equal(period.metrics.calories.total,null);
  assert.equal(period.metrics.calories.knownTotal,100);
  assert.equal(period.metrics.calories.knownDays,1);
  assert.equal(period.metrics.calories.missingDays,1);
  assert.equal(period.metrics.calories.averageKnown,100);
  const prior=api.periodMetrics(api.dailySummary([row('2026-09-30','lunch',{calories:80})],'2026-09-30','2026-09-30'));
  assert.equal(api.comparePeriods(days,[{date:'2026-09-30',records:1,calories:80,protein_g:5,carbs_g:10,fat_g:2,missingRecords:0}]).metrics.calories.comparable,false);
});

test('Un período sin registros no se confunde con un total registrado de cero',()=>{
  const zero=api.periodMetrics(api.dailySummary([row('2026-10-02','lunch',{calories:0,protein_g:0,carbs_g:0,fat_g:0})],'2026-10-02','2026-10-02'));
  const empty=api.periodMetrics(api.dailySummary([],'2026-10-02','2026-10-02'));
  assert.equal(zero.metrics.calories.total,0);
  assert.equal(empty.metrics.calories.total,null);
  assert.equal(empty.daysWithRecords,0);
  assert.equal(empty.daysWithoutRecords,1);
});

test('El filtro de categoría reconoce claves antiguas y nombres en español',()=>{
  const history=[row('2026-10-01','lunch'),row('2026-10-01','almuerzo'),row('2026-10-01','merienda'),row('2026-10-01','cena'),row('2026-10-01','tipo_desconocido')];
  assert.equal(api.filterHistoryByMealType(history,'lunch').length,2);
  assert.equal(api.filterHistoryByMealType(history,'snack').length,1);
  assert.equal(api.filterHistoryByMealType(history,'dinner').length,1);
  assert.equal(api.filterHistoryByMealType(history,'other').length,1);
  assert.equal(api.filterHistoryByMealType(history,'all').length,5);
});

test('Auditoría marca valores negativos, origen ausente y posible discrepancia energética sin corregir el alimento',()=>{
  const food={id:'f1',name:'Producto de prueba',calories_per_100g:900,protein_per_100g:10,carbs_per_100g:10,fat_per_100g:10,fiber_per_100g:1,nutrition_quality_status:'manual_unverified'};
  const before=JSON.stringify(food);const result=api.auditFood(food,new Date('2026-10-19T12:00:00Z'));
  assert.ok(result.issues.some(i=>i.code==='source_missing'));
  assert.ok(api.auditFood({...food,calories_per_100g:-10},new Date('2026-10-19T12:00:00Z')).issues.some(i=>i.code==='negative_calories'));
  assert.ok(result.issues.some(i=>i.code==='energy_macro_mismatch'));
  assert.equal(JSON.stringify(food),before);
});

test('Auditoría diferencia campos no declarados, estados contradictorios y datos incompletos',()=>{
  const food={id:'f2',name:'Avena',source:'Carga manual',data_source_label:'Carga manual',nutrition_quality_status:'source_complete',nutrition_missing_fields:['grasas'],calories_per_100g:380,protein_per_100g:13,carbs_per_100g:68,fat_per_100g:null,fiber_per_100g:10};
  const issues=api.auditFood(food,new Date('2026-10-19T12:00:00Z')).issues;
  assert.ok(issues.some(i=>i.code==='nutrients_declared_missing'));
  assert.ok(issues.some(i=>i.code==='source_status_conflict'));
  assert.ok(!issues.some(i=>i.code==='nutrients_missing_unmarked'));
});

test('Un alimento completo y coherente no genera alertas con las reglas orientativas',()=>{
  const food={id:'f3',name:'Alimento verificado',brand:'Marca',source:'manual',data_source_label:'Etiqueta del envase',data_source_url:'https://example.com/label',nutrition_quality_status:'user_verified',nutrition_missing_fields:[],nutrition_verified_at:'2026-10-01T00:00:00Z',calories_per_100g:192,protein_per_100g:10,carbs_per_100g:20,fat_per_100g:8,fiber_per_100g:5};
  assert.equal(api.auditFood(food,new Date('2026-10-19T12:00:00Z')).issues.length,0);
});

test('Un alimento con macros superiores a 100 g/100 g recibe una advertencia, no se elimina',()=>{
  const food={name:'Dato sospechoso',source:'manual',calories_per_100g:400,protein_per_100g:125,carbs_per_100g:0,fat_per_100g:0,fiber_per_100g:0};
  const audit=api.qualityAudit([food],new Date('2026-10-19T12:00:00Z'));
  assert.equal(audit.flaggedFoods,1);
  assert.ok(audit.items[0].issues.some(i=>i.code==='high_protein_g'));
  assert.equal(food.protein_per_100g,125);
});

test('La exportación de auditoría contiene una fila por hallazgo y un resumen cuando no hay alertas',()=>{
  const data=[{id:'a',name:'Con error',calories_per_100g:-1,protein_per_100g:1,carbs_per_100g:1,fat_per_100g:1,fiber_per_100g:0},{id:'b',name:'Sin error',source:'Etiqueta',data_source_label:'Etiqueta',nutrition_quality_status:'user_verified',nutrition_verified_at:'2026-10-01T00:00:00Z',calories_per_100g:192,protein_per_100g:10,carbs_per_100g:20,fat_per_100g:8,fiber_per_100g:5}];
  const rows=api.auditCsvRows(data,new Date('2026-10-19T12:00:00Z'));
  assert.ok(rows.length>2);
  assert.ok(rows.some(r=>r[1]==='Sin error'&&r[5]==='sin_alertas'));
  assert.ok(rows.some(r=>r[1]==='Con error'&&r[5]==='error'));
});

test('El informe puede cargar el período comparativo sin volver a descargar el catálogo de alimentos',()=>{
  const source=fs.readFileSync(path.join(root,'js/49-nutrition-persistence.js'),'utf8');
  assert.match(source,/options\?\.includeFoods===false\?\[\]:await fetchAll\('user_foods'/);
  const reportSource=fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8');
  assert.match(reportSource,/loadNutritionQualityReport\(\{from:priorRange\.from,to:priorRange\.to,includeFoods:false\}\)/);
});

test('La interfaz limita filtros y exportaciones al informe cargado, y añade auditoría CSV',()=>{
  const source=fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8');
  assert.match(source,/nutritionQualityMealType/);
  assert.match(source,/nutritionQualityComparison/);
  assert.match(source,/nutritionQualityAuditRows/);
  assert.match(source,/nutritionQualityExportAudit/);
  assert.match(source,/rangeMatchesReport\(\)/);
});

console.log(`E4B: ${passed} pruebas aprobadas.`);
