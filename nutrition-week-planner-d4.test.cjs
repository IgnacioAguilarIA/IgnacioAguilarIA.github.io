const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/62-nutrition-week-planner-shopping.js'), 'utf8');
const fakeDocument = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  createElement() { throw new Error('DOM no esperado en pruebas de funciones puras'); }
};
const window = {};
vm.runInNewContext(source, { window, document: fakeDocument, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, console });
const api = window.AgendaNutritionPlanner;
assert.ok(api, 'Debe exponer utilidades públicas de planificación');

function test(name, fn) {
  try { fn(); console.log('✓', name); }
  catch (error) { console.error('✗', name); throw error; }
}

 test('Agrupa alimentos iguales y suma cantidad con precisión de tres decimales', () => {
  const out = api.aggregateItems([
    { meal_id: 'm1', name: 'Tomate', quantity: 120.25, unit: 'g', categories: 'Verdulería' },
    { meal_id: 'm2', name: 'tomáte', quantity: 79.75, unit: 'g', categories: 'Verdulería' }
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].quantity, 200);
  assert.deepEqual(Array.from(out[0].source_meals), ['m1', 'm2']);
  assert.equal(out[0].category, 'Verdulería');
});

test('Normaliza alias de unidades inequívocos antes de sumar cantidades', () => {
  const out = api.aggregateItems([
    { name: 'Tomate', quantity: 100, unit: 'g' },
    { name: 'tomate', quantity: 50, unit: 'gramos' }
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].quantity, 150);
  assert.equal(out[0].unit, 'g');
});

test('No mezcla unidades diferentes ni estados de preparación diferentes', () => {
  const out = api.aggregateItems([
    { name: 'Arroz', quantity: 100, unit: 'g', preparation_state: 'raw' },
    { name: 'Arroz', quantity: 100, unit: 'g', preparation_state: 'cooked' },
    { name: 'Arroz', quantity: 100, unit: 'ml', preparation_state: 'raw' }
  ]);
  assert.equal(out.length, 3);
});

test('No combina cantidad desconocida con una cantidad conocida del mismo ingrediente', () => {
  const out = api.aggregateItems([
    { name: 'Tomate', quantity: null, unit: 'g' },
    { name: 'tomate', quantity: 250, unit: 'g' }
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find(x => x.quantity_known === false).quantity, 0);
  assert.equal(out.find(x => x.quantity_known === true).quantity, 250);
});

test('Distingue un cero real de una cantidad desconocida', () => {
  const out = api.aggregateItems([
    { name: 'Especia', quantity: 0, unit: 'g' },
    { name: 'Especia', quantity: null, unit: 'g' }
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find(x => x.quantity_known === true).quantity, 0);
  assert.equal(out.find(x => x.quantity_known === false).quantity, 0);
});

test('No incluye una fila auxiliar de unidad plan como ingrediente comprable', () => {
  const out = api.aggregateItems([
    { name: 'Resumen heredado', quantity: 1, unit: 'plan' },
    { name: 'Pan', quantity: 2, unit: 'unit' }
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Pan');
});

test('Conserva un ingrediente de cantidad cero como cantidad no inventada', () => {
  const out = api.aggregateItems([{ name: 'Especia', quantity: 0, unit: 'g' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].quantity, 0);
});

test('La clave generada normaliza tildes y separa marca/unidad/preparación', () => {
  const a = api.generatedKey({ name: 'Tomáte', brand: 'Marca A', unit: 'g', preparation_state: 'raw' });
  const b = api.generatedKey({ name: 'tomate', brand: 'Marca A', unit: 'g', preparation_state: 'raw' });
  const c = api.generatedKey({ name: 'tomate', brand: 'Marca B', unit: 'g', preparation_state: 'raw' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('Normaliza semana a lunes y resuelve cambio de semana sin zona horaria local', () => {
  assert.equal(api.mondayIso('2026-10-13'), '2026-10-12');
  assert.equal(api.mondayIso('2026-10-18'), '2026-10-12');
  assert.equal(api.isoAdd('2026-10-12', 7), '2026-10-19');
});

test('Escapa celdas CSV y neutraliza posibles fórmulas de hoja de cálculo', () => {
  assert.equal(api.csvCell('Tomate; rojo'), '"Tomate; rojo"');
  assert.equal(api.csvCell('=IMPORTDATA(1)'), '"\'=IMPORTDATA(1)"');
  assert.equal(api.csvCell('Marca "A"'), '"Marca ""A"""');
});

test('La migración utiliza RLS, un ámbito por cuenta y privilegios CRUD mínimos', () => {
  const sql = fs.readFileSync(path.join(root, 'sql/17-nutrition-shopping-list.sql'), 'utf8').toLowerCase();
  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\)\s*=\s*user_id/);
  assert.match(sql, /revoke all privileges.*public, anon, authenticated/s);
  assert.match(sql, /grant select, insert, update, delete.*to authenticated/s);
  assert.match(sql, /unique\s*\(user_id, week_start, item_key\)/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(nutrition_meals|nutrition_meal_items|nutrition_recipes|nutrition_consumption_history)/);
});

test('El postcheck no intenta consultar el pseudo-rol PUBLIC como si fuera un rol nombrado', () => {
  const sql = fs.readFileSync(path.join(root, 'sql/18-nutrition-shopping-list-postcheck.sql'), 'utf8');
  assert.match(sql, /aclexplode/);
  assert.doesNotMatch(sql, /has_table_privilege\s*\(\s*'public'/i);
});

console.log('D4: 10 pruebas aprobadas.');
