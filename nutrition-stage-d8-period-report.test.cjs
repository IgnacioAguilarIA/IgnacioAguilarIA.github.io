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
test('El período por defecto usa el día local del navegador y cubre 30 días',()=>{
  const now = new Date(2026,9,15,23,30);
  const range=api.defaultRange(now);
  assert.equal(range.to,'2026-10-15');
  assert.equal(range.from,'2026-09-16');
  assert.equal(api.validateDateRange(range.from,range.to).days,30);
});
test('Valida fechas reales, orden y límite de período',()=>{
  assert.equal(api.validateDateRange('2026-02-29','2026-03-01').ok,false);
  assert.equal(api.validateDateRange('2026-10-02','2026-10-01').ok,false);
  assert.equal(api.validateDateRange('2025-01-01','2026-10-01').ok,false);
  assert.equal(api.validateDateRange('2026-10-01','2026-10-15').ok,true);
});
test('El resumen diferencia día sin registros de día con nutrientes registrados en cero',()=>{
  const rows=api.dailySummary([{consumed_date:'2026-10-02',calories:0,protein_g:0,carbs_g:0,fat_g:0}], '2026-10-01','2026-10-03');
  assert.equal(rows.length,3);
  assert.equal(rows[0].status,'Sin registros');
  assert.equal(rows[0].records,0);
  assert.equal(rows[0].calories,null);
  assert.equal(rows[1].status,'Con registros');
  assert.equal(rows[1].records,1);
  assert.equal(rows[1].calories,0);
  assert.equal(rows[2].status,'Sin registros');
});
test('Un nutriente sin dato permanece vacío y no se suma como cero',()=>{
  const rows=api.dailySummary([{consumed_date:'2026-10-02',calories:120,protein_g:4,carbs_g:20,fat_g:null,item_snapshot:{nutrition_missing_fields:['grasas']}}], '2026-10-02','2026-10-02');
  assert.equal(rows[0].calories,120);
  assert.equal(rows[0].protein_g,4);
  assert.equal(rows[0].fat_g,null);
  assert.equal(rows[0].missingRecords,1);
  assert.equal(api.dailyCsvRows(rows)[0][6],'');
});
test('Múltiples comidas se agregan por día sin mezclar fechas',()=>{
  const rows=api.dailySummary([
    {consumed_date:'2026-10-02',calories:120,protein_g:4,carbs_g:20,fat_g:2},
    {consumed_date:'2026-10-02',calories:80,protein_g:6,carbs_g:10,fat_g:3},
    {consumed_date:'2026-10-03',calories:50,protein_g:1,carbs_g:5,fat_g:1}
  ],'2026-10-02','2026-10-03');
  assert.equal(rows[0].records,2);assert.equal(rows[0].calories,200);assert.equal(rows[0].protein_g,10);assert.equal(rows[1].calories,50);
});
test('La descripción del período contabiliza por separado los días vacíos',()=>{
  const days=api.dailySummary([{consumed_date:'2026-10-02',calories:0,protein_g:0,carbs_g:0,fat_g:0}], '2026-10-01','2026-10-03');
  assert.deepEqual(JSON.parse(JSON.stringify(api.dailyOverview(days))),{daysWithRecords:1,daysWithoutRecords:2,consumptionRecords:1,daysWithIncompleteNutrients:0});
});
test('La exportación incluye todos los días solicitados y el estado de cada uno',()=>{
  const days=api.dailySummary([{consumed_date:'2026-10-02',calories:0,protein_g:0,carbs_g:0,fat_g:0}], '2026-10-01','2026-10-02');
  const csvRows=api.dailyCsvRows(days);
  assert.equal(csvRows.length,2);assert.equal(csvRows[0][1],'Sin registros');assert.equal(csvRows[0][3],'');assert.equal(csvRows[1][3],0);
});
test('La consulta de historial se filtra por usuario y por rango en el servidor',()=>{
  const source=fs.readFileSync(path.join(root,'js/49-nutrition-persistence.js'),'utf8');
  assert.match(source,/async function loadNutritionQualityReport\(options=\{\}\)/);
  assert.match(source,/\.eq\('user_id',uid\)/);
  assert.match(source,/query=query\.gte\('consumed_date',dateFrom\)/);
  assert.match(source,/query=query\.lte\('consumed_date',dateTo\)/);
  assert.match(source,/\.range\(offset,offset\+pageSize-1\)/);
});
test('Un período inválido bloquea las exportaciones para no descargar resultados antiguos con fechas nuevas',()=>{
  const source=fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8');
  assert.match(source,/if\(!valid\.ok\)\{report=null;clearReportView\(\);renderButtons\(\);setStatus\(valid\.error\);return\}/);
});
test('Cambiar el rango sin aplicarlo desactiva la exportación del historial anterior',()=>{
  const source=fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8');
  assert.match(source,/function rangeMatchesReport\(\)/);
  assert.match(source,/!matches\|\|!report\?\.history\?\.length/);
  assert.match(source,/!matches\|\|!\(report\?\.dailySummary\?\.length\)/);
});
test('Al actualizar o fallar un filtro no deja visible el resumen anterior como si fuera actual',()=>{
  const source=fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8');
  assert.match(source,/function clearReportView\(\)/);
  assert.match(source,/report=null;clearReportView\(\);renderButtons\(\);setStatus\(valid\.error\)/);
  assert.match(source,/busy=true;report=null;clearReportView\(\)/);
});
test('La interfaz tiene filtros de fecha y tres exportaciones separadas',()=>{
  const source=fs.readFileSync(path.join(root,'js/65-nutrition-quality-report.js'),'utf8');
  assert.match(source,/nutritionQualityFrom/);assert.match(source,/nutritionQualityTo/);
  assert.match(source,/nutritionQualityExportHistory/);assert.match(source,/nutritionQualityExportFoods/);assert.match(source,/nutritionQualityExportDaily/);
});
test('Las celdas CSV siguen neutralizando fórmulas',()=>{
  assert.equal(api.csvCell('=1+1'), '"\'=1+1"');
  assert.equal(api.csvCell('Producto; =cmd'), '"Producto; =cmd"');
  assert.equal(api.csvCell('  =1+1'), "\"'  =1+1\"");
  assert.equal(api.csvCell('\t@SUM(A1:A2)'), "\"'\t@SUM(A1:A2)\"");
});
console.log(`D8: ${passed} pruebas aprobadas.`);
