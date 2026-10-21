const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/56-nutrition-quick-access.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/91-nutrition-quick-registration-e7.css'), 'utf8');
const documentStub = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  createElement() { return { set textContent(_v) {}, get innerHTML() { return ''; } }; }
};
const windowStub = { addEventListener() {} };
vm.runInNewContext(source, {
  window: windowStub, document: documentStub, console, localStorage: {},
  String, Number, Math, Array, Object, RegExp, Date, JSON, Promise, Set, Map
});
const shortcuts = windowStub.AgendaNutritionShortcuts;
assert.ok(shortcuts, 'El módulo de accesos rápidos debe exponerse');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

test('Una cantidad guardada en gramos se reutiliza con el mismo valor', () => {
  const result = shortcuts.resolveQuickAmount({ name: 'Avena', unit: 'g', lastQuantity: 65, lastUnit: 'g' });
  assert.equal(result.ok, true);
  assert.equal(result.quantity, 65);
  assert.equal(result.unit, 'g');
});

test('Se conserva una unidad ml solo si existe densidad válida', () => {
  const ok = shortcuts.resolveQuickAmount({ name: 'Leche', unit: 'g', lastQuantity: 250, lastUnit: 'ml', densityGPerMl: 1.03 });
  const bad = shortcuts.resolveQuickAmount({ name: 'Líquido', unit: 'g', lastQuantity: 250, lastUnit: 'ml' });
  assert.equal(ok.ok, true);
  assert.equal(ok.unit, 'ml');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /densidad/i);
});

test('Unidad y porción requieren equivalencia positiva a gramos', () => {
  assert.equal(shortcuts.resolveQuickAmount({ name: 'Huevo', unit: 'g', lastQuantity: 2, lastUnit: 'unit' }).ok, false);
  assert.equal(shortcuts.resolveQuickAmount({ name: 'Receta', unit: 'g', lastQuantity: 1, lastUnit: 'portion', gramsPerPortion: 0 }).ok, false);
  assert.equal(shortcuts.resolveQuickAmount({ name: 'Huevo', unit: 'g', lastQuantity: 2, lastUnit: 'unit', gramsPerUnit: 50 }).ok, true);
});

test('Los nutrientes incompletos impiden el atajo de agregar', () => {
  const result = shortcuts.resolveQuickAmount({ name: 'Producto', unit: 'g', lastQuantity: 100, lastUnit: 'g', nutritionMissing: ['proteínas'] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /proteínas/);
});

test('Un estado de calidad incompleto bloquea el atajo incluso si falta la lista detallada', () => {
  const result = shortcuts.resolveQuickAmount({ name: 'Producto', unit: 'g', defaultQuantity: 100, nutritionQualityStatus: 'incomplete', nutritionMissing: [] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /incompleta/i);
});

test('Las cantidades inválidas o desmesuradas se rechazan', () => {
  assert.equal(shortcuts.resolveQuickAmount({ name: 'A', unit: 'g', lastQuantity: 0, lastUnit: 'g' }).ok, false);
  assert.equal(shortcuts.resolveQuickAmount({ name: 'A', unit: 'g', lastQuantity: 1000001, lastUnit: 'g' }).ok, false);
});

test('Los registros antiguos con unidad de última operación ausente no se reinterpretan', () => {
  const result = shortcuts.resolveQuickAmount({ name: 'Avena', unit: 'g', lastQuantity: 240, defaultQuantity: 240 });
  assert.equal(result.ok, true);
  assert.equal(result.quantity, 100);
  assert.equal(result.unit, 'g');
});

test('El HTML declara un estado accesible para confirmar el registro rápido', () => {
  assert.match(html, /id="nutritionFoodQuickStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /css\/91-nutrition-quick-registration-e7\.css/);
  assert.match(html, /el alimento queda en el borrador hasta que guardes la comida/i);
});

test('La tarjeta ofrece elegir cantidad y agregar rápidamente con unidad explícita', () => {
  assert.match(source, /nutrition-food-quick-use/);
  assert.match(source, /nutrition-food-quick-add/);
  assert.match(source, /Agregar \$\{amount\.label\}/);
  assert.match(source, /agenda:nutrition-food-added/);
  assert.match(source, /Guardá la comida para conservar el cambio/);
});

test('Los accesos conservan procedencia y marcadores de nutrientes faltantes', () => {
  assert.match(source, /nutritionMissing:/);
  assert.match(source, /nutritionQualityStatus:/);
  assert.match(source, /nutritionVerifiedAt:/);
  assert.match(source, /sourceLabel:/);
  assert.match(source, /sourceUrl:/);
});

test('El módulo vuelve a leer el almacén de la cuenta activa al mostrar la app', () => {
  assert.match(source, /new MutationObserver/);
  assert.match(source, /if\(!app\.classList\.contains\('hidden'\)\)render\(\)/);
  assert.match(source, /const KEY_PREFIX='agenda-nutrition-quick-access-v1:'/);
});

test('Los botones del atajo cumplen mínimo táctil de 44 px y estados de foco', () => {
  assert.match(css, /\.nutrition-food-quick-actions button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.nutrition-food-quick-actions button:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.doesNotMatch(css, /(^|\n)\s*(?:body|html|#app|\.workout-panel|\.calendar|\.schedule)\s*\{/i);
});

console.log(`E7: ${passed} pruebas aprobadas.`);
