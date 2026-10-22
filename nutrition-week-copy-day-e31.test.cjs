const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/112-nutrition-week-plan-copy-day-e31.css'), 'utf8');
const window = { currentUser: { id: 'user-e31' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('DOM inesperado en pruebas puras'); } };
vm.runInNewContext(src, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: () => 'e31-test-operation' } });
const api = window.AgendaNutritionWeeklyPlan;
assert.ok(api, 'Debe exponer la API de planificación semanal');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
const week = '2026-10-19';
const sourceRows = [
  { id: 'meal-a', user_id: 'user-e31', week_start: week, day_offset: 0, meal_type: 'desayuno', title: 'Avena', planned_time: '08:00', notes: 'Con canela', source_meal_id: null, plan_key: 'manual:meal-a', sort_order: 0, updated_at: 'v1', ingredients_snapshot: [{ name: 'Avena', quantity: 50, unit: 'g', quantity_known: true, quality: { source: 'catalog', confidence: 'high' } }], nutrition_snapshot: { calories: 190, protein_g: 7, fiber_g: null, nutrition_missing_metrics: ['fiber'] } },
  { id: 'meal-b', user_id: 'user-e31', week_start: week, day_offset: 0, meal_type: 'almuerzo', title: 'Ensalada', planned_time: '12:30', notes: '', source_meal_id: 'routine-b', plan_key: 'template:b', sort_order: 1, updated_at: 'v2', ingredients_snapshot: [{ name: 'Tomate', quantity: null, quantity_known: false, unit: 'g', quality: { reason: 'unknown' } }], nutrition_snapshot: { calories: null, nutrition_missing_metrics: ['calories', 'protein', 'carbs', 'fat', 'fiber'] } }
];
const destination = [{ id: 'meal-c', user_id: 'user-e31', week_start: week, day_offset: 2, meal_type: 'cena', title: 'Sopa existente', planned_time: '20:00', notes: '', plan_key: 'manual:meal-c', sort_order: 4, updated_at: 'v3', ingredients_snapshot: [], nutrition_snapshot: {} }];

test('Copiar día completo genera una copia nueva por cada comida y nunca incluye filas del destino', () => {
  const payloads = api.copyDayPlanPayloads(sourceRows, 0, 2, week, 'user-e31', 'daycopy-operation-1', destination, '2026-10-21T10:00:00.000Z');
  assert.equal(payloads.length, 2);
  assert.ok(payloads.every(x => x.day_offset === 2 && x.user_id === 'user-e31' && x.week_start === week));
  assert.equal(payloads[0].sort_order, 5);
  assert.equal(payloads[1].sort_order, 6);
  assert.ok(payloads.every(x => x.source_meal_id === null && x.plan_key.startsWith('manual:day-copy:daycopy-operation-1:')));
  assert.deepEqual(payloads.map(x => x.title), ['Avena (copia)', 'Ensalada (copia)']);
  assert.equal(destination[0].title, 'Sopa existente');
});

test('La copia de día preserva instantáneas, nutrientes desconocidos y procedencia sin compartir referencias', () => {
  const payloads = api.copyDayPlanPayloads(sourceRows, 0, 2, week, 'user-e31', 'daycopy-operation-2', destination);
  assert.equal(payloads[0].ingredients_snapshot[0].quality.confidence, 'high');
  assert.deepEqual(JSON.parse(JSON.stringify(payloads[0].nutrition_snapshot.nutrition_missing_metrics)), ['fiber']);
  assert.equal(payloads[1].ingredients_snapshot[0].quantity, null);
  assert.equal(payloads[1].ingredients_snapshot[0].quantity_known, false);
  assert.deepEqual(JSON.parse(JSON.stringify(payloads[1].nutrition_snapshot.nutrition_missing_metrics)), ['calories','protein','carbs','fat','fiber']);
  payloads[0].ingredients_snapshot[0].quality.source = 'changed';
  payloads[0].nutrition_snapshot.calories = 999;
  assert.equal(sourceRows[0].ingredients_snapshot[0].quality.source, 'catalog');
  assert.equal(sourceRows[0].nutrition_snapshot.calories, 190);
});

test('La ordenación es determinista: primero la hora y después sort_order e id', () => {
  const ordered = api.orderedDayRows([...sourceRows].reverse(), 0);
  assert.deepEqual(Array.from(ordered, row => row.id), ['meal-a', 'meal-b']);
});

test('La firma del día cambia si cambia una comida, se añade o se quita una fila', () => {
  const signature = api.dayRowsSignature(sourceRows, 0);
  assert.notEqual(api.dayRowsSignature([...sourceRows, { ...sourceRows[0], id: 'meal-new', title: 'Nueva' }], 0), signature);
  assert.notEqual(api.dayRowsSignature(sourceRows.map(row => row.id === 'meal-a' ? { ...row, title: 'Título nuevo' } : row), 0), signature);
  assert.notEqual(api.dayRowsSignature([sourceRows[0]], 0), signature);
  assert.equal(api.dayRowsSignature(sourceRows, 2), api.dayRowsSignature([], 2));
});

test('Resumen de vista previa cuenta ingredientes desconocidos y datos nutricionales incompletos', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(api.dayCopyStats(sourceRows))), { meals: 2, ingredients: 2, unknownQuantities: 1, incompleteNutrition: 2 });
});

test('Rechaza copiar un día sobre sí mismo o un día sin comidas', () => {
  assert.throws(() => api.copyDayPlanPayloads(sourceRows, 0, 0, week, 'user-e31', 'daycopy-operation-3', destination), /distinto/);
  assert.throws(() => api.copyDayPlanPayloads([], 0, 2, week, 'user-e31', 'daycopy-operation-3', destination), /no tiene comidas/);
});

test('Rechaza fuentes mezcladas de cuenta, semana o día', () => {
  assert.throws(() => api.copyDayPlanPayloads([{ ...sourceRows[0], user_id: 'otro' }], 0, 2, week, 'user-e31', 'daycopy-operation-4', destination), /no pertenece/);
  assert.throws(() => api.copyDayPlanPayloads([{ ...sourceRows[0], week_start: '2026-10-26' }], 0, 2, week, 'user-e31', 'daycopy-operation-4', destination), /no pertenece/);
  assert.throws(() => api.copyDayPlanPayloads([{ ...sourceRows[0], day_offset: 1 }], 0, 2, week, 'user-e31', 'daycopy-operation-4', destination), /no pertenece/);
  assert.throws(() => api.copyDayPlanPayloads(sourceRows, 0, 2, '2026-10-20', 'user-e31', 'daycopy-operation-4', destination), /lunes/);
});

test('Rechaza claves de operación inseguras y permite reconstruir claves idempotentes para reintentos', () => {
  assert.throws(() => api.copyDayPlanPayloads(sourceRows, 0, 2, week, 'user-e31', 'bad key', destination), /clave segura/);
  const priorKey = 'manual:day-copy:daycopy-operation-5:meal-a';
  const retryTarget=[...destination, { ...destination[0], id: 'prior-copy', plan_key: priorKey }];
  const retry=api.copyDayPlanPayloads(sourceRows, 0, 2, week, 'user-e31', 'daycopy-operation-5', retryTarget);
  assert.equal(retry[0].plan_key,priorKey);
  assert.equal(retry[1].plan_key,'manual:day-copy:daycopy-operation-5:meal-b');
  assert.equal(api.dayCopyPlanKey('daycopy-operation-5','meal-a'),priorKey);
});

test('Rechaza destino de otra cuenta o semana', () => {
  assert.throws(() => api.copyDayPlanPayloads(sourceRows, 0, 2, week, 'user-e31', 'daycopy-operation-6', [{ ...destination[0], user_id: 'otro' }]), /destino no pertenece/);
  assert.throws(() => api.copyDayPlanPayloads(sourceRows, 0, 2, week, 'user-e31', 'daycopy-operation-6', [{ ...destination[0], week_start: '2026-10-26' }]), /destino no pertenece/);
});

test('HTML carga los recursos E31 con nueva versión de caché', () => {
  assert.match(html, /css\/112-nutrition-week-plan-copy-day-e31\.css\?v=e31/);
  assert.match(html, /js\/63-nutrition-week-plan-editor\.js\?v=e43/);
});

test('CSS E31 es adaptable y contempla accesibilidad', () => {
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /focus-visible/);
});

test('La interfaz requiere vista previa y presenta explícitamente que no reemplaza destino', () => {
  assert.match(src, /Copiar un día completo/);
  assert.match(src, /Previsualizar copia/);
  assert.match(src, /ninguna será reemplazada/);
  assert.match(src, /async function commitCopyDay/);
});

console.log(`E31: ${passed} pruebas aprobadas.`);
