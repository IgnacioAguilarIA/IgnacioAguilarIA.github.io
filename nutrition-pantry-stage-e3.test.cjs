const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/66-nutrition-pantry.js'), 'utf8');
const shoppingSrc = fs.readFileSync(path.join(root, 'js/62-nutrition-week-planner-shopping.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/89-nutrition-pantry.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'sql/23-nutrition-pantry.sql'), 'utf8');
const postcheck = fs.readFileSync(path.join(root, 'sql/24-nutrition-pantry-postcheck.sql'), 'utf8');
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; } };
const window = {};
vm.runInNewContext(src, { window, document, Intl, Date, Math, Number, String, Array, Object, Map, Set, RegExp, Error, JSON, confirm() { return true; }, console });
const pantry = window.AgendaNutritionPantry;
assert.ok(pantry, 'El módulo debe exponer su API de pruebas y cálculos');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
const base = (name, quantity, unit, extra = {}) => ({ name, brand: '', quantity, unit, preparation_state: 'unspecified', is_archived: false, ...extra });

test('Convierte kg a g sin mezclar magnitudes y calcula el faltante parcial', () => {
  const result = pantry.calculateShortages([base('Arroz', 1, 'kg')], [base('arroz', 500, 'g')], '2026-10-18');
  assert.equal(result.length, 1); assert.equal(result[0].quantity, 0.5); assert.equal(result[0].unit, 'kg');
  assert.equal(result[0].required_quantity, 1); assert.equal(result[0].pantry_quantity, 0.5);
});

test('El inventario que cubre todo el requerimiento elimina el producto de compras', () => {
  const result = pantry.calculateShortages([base('Leche', 400, 'ml')], [base('Leche', 0.5, 'l')], '2026-10-18');
  assert.equal(result.length, 0);
});

test('No deduce stock vencido ni artículos archivados', () => {
  const result = pantry.calculateShortages([base('Yogur', 2, 'unit')], [
    base('Yogur', 2, 'unit', { expires_on: '2026-10-17' }),
    base('Yogur', 1, 'unit', { is_archived: true })
  ], '2026-10-18');
  assert.equal(result.length, 1); assert.equal(result[0].quantity, 2);
});

test('Mantiene separados crudo, cocido, marca y dimensiones de unidad', () => {
  const needs = [base('Arroz', 100, 'g', { preparation_state: 'raw' }), base('Arroz', 100, 'g', { preparation_state: 'cooked' }), base('Arroz', 1, 'portion'), base('Arroz', 1, 'g', { brand: 'Marca B' })];
  const stock = [base('Arroz', 100, 'g', { preparation_state: 'cooked' }), base('Arroz', 1, 'portion'), base('Arroz', 1, 'g', { brand: 'Marca A' })];
  const result = pantry.calculateShortages(needs, stock, '2026-10-18');
  assert.equal(result.length, 2); assert.equal(result[0].preparation_state, 'raw'); assert.ok(result.some(x => x.brand === 'Marca B'));
});

test('No inventa faltantes numéricos cuando la cantidad o la unidad son desconocidas', () => {
  const result = pantry.calculateShortages([{ name: 'Especia', quantity: 1, unit: '', quantity_known: false }], [base('Especia', 50, 'g')], '2026-10-18');
  assert.equal(result.length, 1); assert.equal(result[0].quantity_known, false); assert.equal(result[0].quantity, 1);
});

test('Normaliza nombres y unidades habituales del español sin forzar unidades incompatibles', () => {
  assert.equal(pantry.normalize('  Café molído '), 'cafe molido');
  assert.equal(pantry.canonicalUnit('kilogramos'), 'kg');
  assert.equal(pantry.dimension('ml'), pantry.dimension('L'));
  assert.notEqual(pantry.dimension('g'), pantry.dimension('ml'));
  assert.notEqual(pantry.dimension('unidad'), pantry.dimension('porción'));
});

test('La lista de compras consulta stock antes de guardar y ofrece registrar compras en la despensa', () => {
  assert.match(shoppingSrc, /AgendaNutritionPantry\.applyShortages\(owner,originalGrouped\)/);
  assert.ok(shoppingSrc.indexOf('applyShortages(owner,originalGrouped)') < shoppingSrc.indexOf('const existing=await readShoppingRows(owner,week,true)'));
  assert.match(shoppingSrc, /AgendaNutritionPantry\.registerPurchase\(row,owner\)/);
  assert.match(src, /shopping-purchase:/);
  assert.match(src, /required_quantity,pantry_quantity,shortage_quantity/);
});

test('El descuento confirmado usa RPC transaccional y la comida planificada queda protegida contra doble uso', () => {
  assert.match(src, /nutrition_pantry_consume_planned_meal/);
  assert.match(src, /Confirmás que preparaste o consumiste/);
  assert.match(sql, /constraint nutrition_pantry_consumption_runs_user_plan_unique unique \(user_id, plan_item_id\)/i);
  assert.match(sql, /on conflict \(user_id,plan_item_id\) do nothing returning id into v_run_id/i);
  assert.match(sql, /for update/i);
});

test('La migración limita acceso a filas propias y cambios de existencias mediante funciones protegidas', () => {
  assert.match(sql, /alter table public\.nutrition_pantry_items enable row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all privileges on table public\.nutrition_pantry_items from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.nutrition_pantry_items to authenticated/i);
  assert.match(sql, /grant execute on function public\.nutrition_pantry_consume_planned_meal\(uuid\) to authenticated/i);
  assert.match(sql, /La unidad de un lote existente no se puede cambiar/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(nutrition_meals|nutrition_meal_items|nutrition_consumption_history)/i);
});

test('El postcheck es estrictamente de solo lectura', () => {
  assert.doesNotMatch(postcheck, /\b(insert|update|delete|alter|drop|create|grant|revoke)\s+/i);
});

test('El HTML carga la despensa dentro de Alimentación y antes de uso interactivo, con CSS aislado y móvil', () => {
  assert.match(html, /id="nutritionPanel"/);
  assert.match(html, /css\/89-nutrition-pantry\.css/);
  assert.match(html, /js\/66-nutrition-pantry\.js/);
  assert.ok(html.indexOf('js/63-nutrition-week-plan-editor.js') < html.indexOf('js/66-nutrition-pantry.js'));
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /\.nutrition-pantry-modal button:focus-visible/);
  assert.doesNotMatch(src, /from\(['"]nutrition_meals['"]\)\.(insert|update|delete)/);
});

console.log(`Etapa E3: ${passed} pruebas aprobadas.`);
