const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/62-nutrition-week-planner-shopping.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/107-nutrition-shopping-workflow-e26.css'), 'utf8');
const fakeDocument = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('DOM no esperado en prueba de funciones puras'); } };
const window = {};
vm.runInNewContext(source, { window, document: fakeDocument, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, console });
const api = window.AgendaNutritionPlanner;
assert.ok(api, 'La API de planificación debe estar disponible');

const sample = [
  { id: '1', name: 'Tomáte', brand: 'Huerta Norte', category: 'Verdulería', quantity: 500, unit: 'g', quantity_known: true, checked: false, active: true },
  { id: '2', name: 'Leche', brand: 'La Vaquita', category: 'Lácteos', quantity: 2, unit: 'l', quantity_known: true, checked: true, active: true },
  { id: '3', name: 'Arroz', brand: '', category: 'Almacén', quantity: null, unit: 'g', quantity_known: false, checked: false, active: true },
  { id: '4', name: 'Producto archivado', brand: '', category: 'Otros', quantity: 1, unit: 'unit', quantity_known: true, checked: false, active: false }
];

const tests = [
  ['resume cantidades reales, avance y pendientes sin contar registros archivados', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(api.summarizeShoppingRows(sample))), { total: 3, purchased: 1, pending: 2, unknownQuantity: 1, percent: 33 });
  }],
  ['devuelve 0% cuando la lista está vacía', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(api.summarizeShoppingRows([]))), { total: 0, purchased: 0, pending: 0, unknownQuantity: 0, percent: 0 });
  }],
  ['busca sin distinguir mayúsculas ni tildes y respeta marca/categoría', () => {
    assert.equal(api.filterShoppingRows(sample, { query: 'tomate' }).length, 1);
    assert.equal(api.filterShoppingRows(sample, { query: 'VAQUITA' })[0].name, 'Leche');
    assert.equal(api.filterShoppingRows(sample, { query: 'lacteos' })[0].name, 'Leche');
  }],
  ['filtra solo pendientes y comprados sin cambiar los datos originales', () => {
    assert.deepEqual(Array.from(api.filterShoppingRows(sample, { status: 'pending' }), x => x.id), ['1', '3']);
    assert.deepEqual(Array.from(api.filterShoppingRows(sample, { status: 'purchased' }), x => x.id), ['2']);
    assert.equal(sample[0].checked, false);
  }],
  ['combina búsqueda, estado y categoría como filtros AND', () => {
    const out = api.filterShoppingRows(sample, { query: 'huerta', status: 'pending', category: 'Verdulería' });
    assert.deepEqual(Array.from(out, x => x.id), ['1']);
    assert.equal(api.filterShoppingRows(sample, { query: 'huerta', status: 'purchased' }).length, 0);
  }],
  ['no considera conocida una cantidad ausente, negativa o no numérica', () => {
    assert.equal(api.isKnownShoppingQuantity({ quantity: 0, quantity_known: true }), true);
    assert.equal(api.isKnownShoppingQuantity({ quantity: null, quantity_known: false }), false);
    assert.equal(api.isKnownShoppingQuantity({ quantity: -1 }), false);
    assert.equal(api.isKnownShoppingQuantity({ quantity: 'inválido' }), false);
  }],
  ['limpia bien filtros desconocidos sin ocultar productos activos', () => {
    assert.equal(api.filterShoppingRows(sample, { status: 'inexistente', category: 'all' }).length, 3);
    assert.equal(api.filterShoppingRows(sample, { category: 'Otra categoría' }).length, 0);
  }],
  ['index carga la versión E26 del módulo y la hoja de estilos dedicada', () => {
    assert.match(html, /js\/62-nutrition-week-planner-shopping\.js\?v=e41/);
    assert.match(html, /css\/107-nutrition-shopping-workflow-e26\.css\?v=e26/);
    assert.match(css, /nutrition-shopping-summary/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /forced-colors/);
  }]
];

for (const [name, fn] of tests) { fn(); console.log(`✓ ${name}`); }
console.log(`E26 shopping workflow: ${tests.length} pruebas aprobadas.`);
