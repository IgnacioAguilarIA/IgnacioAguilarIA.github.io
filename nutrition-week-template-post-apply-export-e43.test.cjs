const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/124-nutrition-week-template-post-apply-export-e43.css'), 'utf8');

const window = { currentUser: { id: 'user-e43' }, navigator: {} };
const document = { readyState: 'loading', addEventListener() {} };
vm.runInNewContext(editor, {
  window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON,
  Promise, console, Blob, URL, setTimeout,
});
const api = window.AgendaNutritionWeeklyPlan;
assert.equal(typeof api.postApplyShoppingReportRowsE43, 'function');
assert.equal(typeof api.postApplyShoppingCsvE43, 'function');
assert.equal(typeof api.postApplyShoppingPlainTextE43, 'function');

const impact = {
  available: true, week: '2026-10-26',
  counts: { added: 2, updated: 1, reactivated: 1, archive: 1, purchasedConflicts: 1, unknown: 2 },
  diff: {
    added: [
      { item_key: 'a', name: '=IMPORTXML("x")', brand: '', quantity: 0, quantity_known: true, unit: 'g', category: 'Almacén', preparation_state: 'unspecified', checked: false },
      { item_key: 'b', name: 'Zapallo', brand: '', quantity: null, quantity_known: false, unit: 'g', category: 'Verdulería', preparation_state: 'unspecified', checked: false },
    ],
    updated: [{ previous: { item_key: 'oats', name: 'Avena', quantity: 25, quantity_known: true, unit: 'g', category: 'Almacén', checked: true }, item: { item_key: 'oats', name: 'Avena', quantity: 50, quantity_known: true, unit: 'g', category: 'Almacén', checked: true } }],
    reactivated: [{ previous: { item_key: 'milk', name: 'Leche', quantity: 1, quantity_known: true, unit: 'l', active: false }, item: { item_key: 'milk', name: 'Leche', quantity: 2, quantity_known: true, unit: 'l', active: true } }],
    archive: [{ item_key: 'rice', name: 'Arroz', quantity: 500, quantity_known: true, unit: 'g', category: 'Almacén', active: true }],
    purchasedConflicts: [{ item_key: 'oats', name: 'Avena', quantity: 25, quantity_known: true, unit: 'g', category: 'Almacén', checked: true }],
    unknown: [
      { item_key: 'b', name: 'Zapallo', quantity: null, quantity_known: false, unit: 'g', category: 'Verdulería' },
      { item_key: 'mystery', name: 'Especias', quantity: null, quantity_known: false, unit: '', category: 'Otros' },
    ],
  },
};
const capturedAt = '2026-10-21T23:00:00.000Z';
const rows = api.postApplyShoppingReportRowsE43(impact);
assert.equal(rows.length, 6, 'Items across categories are consolidated by item key rather than duplicated per warning');
assert.ok(rows.some(row => row.type === 'Actualizar' && row.name === 'Avena' && row.previousQuantity === '25 g' && row.projectedQuantity === '50 g' && row.notes.includes('Ya figura como comprado')));
assert.ok(rows.some(row => row.name === 'Especias' && row.type === 'Cantidad desconocida' && row.projectedQuantity === 'Cantidad sin definir'));
assert.ok(rows.some(row => row.name === 'Arroz' && row.type === 'Archivar pendiente' && row.previousQuantity === '500 g' && row.projectedQuantity === ''));
assert.ok(rows.some(row => row.name === '=IMPORTXML("x")' && row.projectedQuantity === '0 g'), 'A known numeric zero must survive export');
const csv = api.postApplyShoppingCsvE43(impact, '2026-10-26', capturedAt);
assert.ok(csv.charCodeAt(0) === 0xFEFF, 'CSV starts with a UTF-8 BOM for spreadsheet compatibility');
assert.ok(csv.includes('Informe generado') && csv.includes('Cantidad anterior') && csv.includes('Cantidad estimada'));
assert.ok(csv.includes("'=IMPORTXML("), 'CSV guards a formula-like product name against spreadsheet formula injection');
assert.ok(csv.includes('capturada antes de guardar el plan') && csv.includes('no es una lista sincronizada'));
assert.ok(csv.includes('25 g') && csv.includes('50 g') && csv.includes('Cantidad sin definir'));
const plain = api.postApplyShoppingPlainTextE43(impact, '2026-10-26', capturedAt);
assert.ok(plain.includes('AgendaFICH · Estimación de impacto en compras'));
assert.ok(plain.includes('Semana: 2026-10-26') && plain.includes('Avena') && plain.includes('Especias'));
assert.ok(plain.includes('No es la lista oficial sincronizada'));
assert.match(editor, /Copiar informe/);
assert.match(editor, /Descargar CSV/);
assert.match(editor, /La cuenta activa cambió/);
assert.match(editor, /postApplyShoppingReportRowsE43/);
assert.match(html, /css\/124-nutrition-week-template-post-apply-export-e43\.css\?v=e43/);
assert.match(html, /js\/63-nutrition-week-plan-editor\.js\?v=e43/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.match(css, /focus-visible/);
assert.match(css, /body\.light/);
console.log('E43 post-apply shopping report tests: 23/23 passed');
