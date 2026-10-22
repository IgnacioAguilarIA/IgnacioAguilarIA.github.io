const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/119-nutrition-week-template-bulk-target-e38.css'), 'utf8');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

test('E38 loads a fresh editor cache key and a dedicated stylesheet after the per-item destination layer', () => {
  assert.match(html, /css\/118-nutrition-week-template-target-day-e37\.css\?v=e37/);
  assert.match(html, /css\/119-nutrition-week-template-bulk-target-e38\.css\?v=e38/);
  assert.match(html, /js\/63-nutrition-week-plan-editor\.js\?v=e43/);
});

test('Bulk destination selector provides every weekday with an accessible Spanish label', () => {
  assert.match(editor, /nutrition-week-template-bulk-target-select-e38/);
  assert.match(editor, /Día común para las comidas seleccionadas/);
  assert.match(editor, /for\(let day=0;day<7;day\+\+\)/);
  assert.match(editor, /bulkTools\.setAttribute\('role','group'\)/);
});

test('Bulk assign updates only checked items and synchronizes each individual day selector', () => {
  const start = editor.indexOf("bulkApply.addEventListener('click'");
  const end = editor.indexOf("bulkReset.addEventListener('click'", start);
  assert.ok(start >= 0 && end > start);
  const handler = editor.slice(start, end);
  assert.match(handler, /if\(!selectedSet\.has\(item\.item_id\)\)continue/);
  assert.match(handler, /targetDays\.set\(item\.item_id,destination\)/);
  assert.match(handler, /targetSelect\.value=String\(destination\)/);
  assert.match(handler, /invalidateSelectionPreview/);
});

test('Bulk reset restores each selected meal to its own original source day, not a shared default', () => {
  const start = editor.indexOf("bulkReset.addEventListener('click'");
  const end = editor.indexOf("selectAll.addEventListener('click'", start);
  assert.ok(start >= 0 && end > start);
  const handler = editor.slice(start, end);
  assert.match(handler, /const original=Number\(item\.day_offset\)/);
  assert.match(handler, /targetDays\.set\(item\.item_id,original\)/);
  assert.match(handler, /targetSelect\.value=String\(original\)/);
  assert.match(handler, /invalidateSelectionPreview/);
});

test('No-selection and no-op bulk actions are disabled or return without writing', () => {
  assert.match(editor, /bulkTargetSelect\.disabled=busy\|\|selectedCount===0/);
  assert.match(editor, /bulkApply\.disabled=busy\|\|!canBulkAssign/);
  assert.match(editor, /bulkReset\.disabled=busy\|\|!canBulkReset/);
  assert.match(editor, /if\(!changed\).*No se modificó el plan/);
  assert.match(editor, /La comida seleccionada ya está asignada/);
  assert.match(editor, /La comida seleccionada ya conserva su día original/);
});

test('Bulk operations preserve the existing preview safety contract', () => {
  assert.match(editor, /Asignaste \$\{DAY_NAMES\[destination\]\}.*Generá una nueva vista previa/);
  assert.match(editor, /Se restauraron los días originales.*Generá una nueva vista previa/);
  assert.match(editor, /const selectedTargetOverrides=\(\)=>Object\.fromEntries\(\[\.\.\.selectedSet\]/);
  assert.match(editor, /previewSavedWeeklyTemplate\(template\.id,\[\.\.\.selectedSet\],selectedTargetOverrides\(\)\)/);
});

test('E38 styling remains responsive and supports visible focus, reduced motion, and forced colors', () => {
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /body\.light/);
});

console.log(`E38 bulk target tests: ${passed}/7 passed`);
