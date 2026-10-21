const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const planSource = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const pantrySource = fs.readFileSync(path.join(root, 'js/66-nutrition-pantry.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(root, 'js/57-nutrition-account-sync.js'), 'utf8');
const plannerSource = fs.readFileSync(path.join(root, 'js/62-nutrition-week-planner-shopping.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const documentStub = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  createElement() { throw new Error('DOM no esperado en pruebas de utilidades puras'); }
};
function load(source, extras = {}) {
  const window = {};
  vm.runInNewContext(source, {
    window, document: documentStub, Intl, Date, Map, Set, String, Number, Math,
    Array, Object, RegExp, Error, JSON, Promise, console, ...extras
  });
  return window;
}
const planApi = load(planSource).AgendaNutritionWeeklyPlan;
const pantryApi = load(pantrySource).AgendaNutritionPantry;
assert.ok(planApi, 'El planificador debe exponer las utilidades de exportación');
assert.ok(pantryApi, 'La despensa debe exponer las utilidades de CSV');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

const planRows = [
  {
    week_start: '2026-10-19', day_offset: 0, meal_type: 'almuerzo',
    title: '=Comida interpretada como fórmula', planned_time: '12:30', notes: 'Nota; con separador',
    ingredients_snapshot: [
      { name: 'Arroz', brand: '', quantity: 150, quantity_known: true, unit: 'g', preparation_state: 'cooked', categories: 'Almacén' },
      { name: 'Condimento sin unidad', quantity: null, quantity_known: false, unit: 'sin unidad', preparation_state: 'unspecified' }
    ],
    nutrition_snapshot: { calories: 340, protein_g: 8, carbs_g: 66, fat_g: 4, source_recipe: { name: 'Receta base', planned_servings: 2, yield_servings: 4 } }
  }
];

test('La exportación del plan fechado crea una fila resumen y filas estructuradas por ingrediente', () => {
  const rows = Array.from(planApi.weekCsvRows(planRows, '2026-10-19'), row => Array.from(row));
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.length === 22), 'Todas las filas deben respetar las 22 columnas del encabezado');
  assert.equal(rows[0][13], 'Nota; con separador');
  assert.equal(rows[0][0], 'Comida');
  assert.equal(rows[0][2], 'Lunes');
  assert.equal(rows[0][4], '=Comida interpretada como fórmula');
  assert.equal(rows[0][14], 340);
  assert.equal(rows[1][0], 'Ingrediente');
  assert.equal(rows[1][6], 'Arroz');
  assert.equal(rows[1][8], 150);
  assert.equal(rows[2][6], 'Condimento sin unidad');
  assert.equal(rows[2][9], 'No');
  assert.equal(rows[2][8], '');
});

test('La exportación CSV conserva acentos y separadores y neutraliza fórmulas', () => {
  assert.equal(planApi.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(planApi.csvCell('  @SUM(A1)'), '"\'  @SUM(A1)"');
  const csv = planApi.weekCsvText(planRows, '2026-10-19');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(';'));
  assert.ok(csv.includes('Arroz'));
  assert.ok(csv.includes("'=Comida interpretada como fórmula"));
  assert.ok(csv.includes('Cantidad definida'));
});

test('La exportación de planificación verifica la cuenta activa y se bloquea mientras se carga', () => {
  assert.match(planSource, /function exportWeekCsv\(\)/);
  assert.match(planSource, /assertOwner\(who\)/);
  assert.match(planSource, /shell\.export\.disabled=!!disabled\|\|rows\.length===0/);
  assert.match(planSource, /rows=\[\];setWeekControlsDisabled\(shell,true\)/, 'No debe exportar los datos de la semana anterior si falla la carga actual');
  assert.match(planSource, /exp\.textContent='Exportar plan CSV'/);
  assert.match(planSource, /agenda-fich-plan-semanal-\$\{activeWeek\}\.csv/);
});

test('La despensa ofrece exportación del inventario, faltantes, uso planificado y movimientos', () => {
  assert.match(pantrySource, /function exportCurrentCsv\(\)/);
  for (const tab of ['inventory', 'shortages', 'planned', 'movements']) assert.ok(pantrySource.includes(`activeTab==='${tab}'`), `Falta exportación para ${tab}`);
  assert.match(pantrySource, /assertOwner\(who\)/);
  assert.match(pantrySource, /ownerAtOpen!==who/);
  assert.match(pantrySource, /Exportar vista CSV/);
  assert.match(pantrySource, /lastMovements=rows/);
  assert.match(pantrySource, /lastShortages=shortages/);
  assert.match(pantrySource, /lastPlannedRows=plan/);
});

test('La exportación del plan dentro de la despensa mantiene las 22 columnas alineadas', () => {
  const rows = Array.from(pantryApi.plannedCsvRows(planRows, '2026-10-19'), row => Array.from(row));
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.length === 22), 'Todas las filas deben coincidir con las 22 columnas declaradas');
  assert.equal(rows[0][13], 'Nota; con separador');
  assert.equal(rows[0][14], 340);
  assert.equal(rows[1][6], 'Arroz');
  assert.equal(rows[2][9], 'No');
  assert.equal(rows[2][8], '');
});

test('El CSV de despensa incluye BOM, separa columnas y neutraliza fórmulas', () => {
  assert.equal(pantryApi.csvCell('@SUM(A1)'), '"\'@SUM(A1)"');
  const csv = pantryApi.csvText(['Alimento', 'Cantidad'], [['=producto', 12], ['Arroz; integral', '150 g']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=producto"'));
  assert.ok(csv.includes('"Arroz; integral"'));
  assert.ok(csv.includes('\r\n'));
});

test('El estado sin conexión aclara qué datos no se ponen automáticamente en cola', () => {
  assert.match(syncSource, /planificación semanal, compras y despensa necesitan conexión para confirmar el guardado/);
  assert.match(syncSource, /No todos los cambios se ponen automáticamente en cola/);
});

test('Las herramientas de exportación siguen cargadas en Alimentación sin añadir scripts globales', () => {
  assert.match(html, /id="nutritionPanel"/);
  assert.match(html, /js\/63-nutrition-week-plan-editor\.js/);
  assert.match(html, /js\/66-nutrition-pantry\.js/);
  assert.doesNotMatch(html, /nutrition-stage-e5-final-polish\.js/);
});

test('Las descargas CSV esperan antes de revocar la URL temporal', () => {
  assert.match(planSource, /setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),1500\)/);
  assert.match(pantrySource, /setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),1500\)/);
  assert.match(plannerSource, /setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),1500\)/);
});

console.log(`E5: ${passed} pruebas aprobadas.`);
