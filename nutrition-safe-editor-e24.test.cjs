'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('E24 loads exactly once after E23 and stays an incremental Alimentación layer', () => {
  const html = read('index.html');
  const e23Css = html.indexOf('./css/104-nutrition-calculation-integrity-e23.css?v=e23');
  const e24Css = html.indexOf('./css/105-nutrition-safe-editor-e24.css?v=e24');
  const e23Js = html.indexOf('./js/74-nutrition-data-integrity-e23.js?v=e23');
  const e24Js = html.indexOf('./js/75-nutrition-safe-editor-e24.js?v=e24');
  assert.ok(e23Css >= 0 && e24Css > e23Css, 'E24 CSS must load after E23');
  assert.ok(e23Js >= 0 && e24Js > e23Js, 'E24 JS must load after E23');
  assert.equal((html.match(/105-nutrition-safe-editor-e24\.css\?v=e24/g) || []).length, 1);
  assert.equal((html.match(/75-nutrition-safe-editor-e24\.js\?v=e24/g) || []).length, 1);
  assert.ok(html.includes('id="nutritionOverlay"'));
  assert.ok(html.includes('id="nutritionMealBuilderList"'));
});

test('E24 protects close, cancel, backdrop, Escape and navigation when changes are unsaved', () => {
  const js = read('js/75-nutrition-safe-editor-e24.js');
  assert.match(js, /¿Descartar los cambios\?/);
  assert.match(js, /#nutritionCloseBtn, #cancelMealBtn/);
  assert.match(js, /target === overlay/);
  assert.match(js, /event\.key !== 'Escape'/);
  assert.match(js, /beforeunload/);
  assert.match(js, /stopImmediatePropagation/);
  assert.match(js, /agenda:nutrition-meal-saved/);
});

test('E24 validates quantities and blocks saving invalid values instead of silently clamping them', () => {
  const js = read('js/75-nutrition-safe-editor-e24.js');
  assert.match(js, /value > 0 && value <= 1000000/);
  assert.match(js, /setCustomValidity/);
  assert.match(js, /aria-invalid/);
  assert.match(js, /Ingresá una cantidad mayor que cero/);
  assert.match(js, /target\.closest\('#saveMealBtn'\)/);
  assert.match(js, /invalid\.focus/);
});

test('E24 supports undo for ingredient removals and confirms clearing the entire draft', () => {
  const js = read('js/75-nutrition-safe-editor-e24.js');
  assert.match(js, /nutrition-meal-builder-remove/);
  assert.match(js, /expiresAt: Date\.now\(\) \+ 8000/);
  assert.match(js, /Deshacer/);
  assert.match(js, /¿Quitar todos los alimentos\?/);
  assert.match(js, /Conservar alimentos/);
  assert.match(js, /setPendingMealFoods\(current\)/);
});

test('E24 is presentation and interaction only: no database mutations, SQL changes or shared workout edits', () => {
  const js = read('js/75-nutrition-safe-editor-e24.js');
  const css = read('css/105-nutrition-safe-editor-e24.css');
  assert.doesNotMatch(js, /\.from\(['"]|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(css, /#workoutPanel|#agendaPanel|#calendarPanel|\.v28-workout|\.workout-panel/i);
  assert.doesNotMatch(css, /(^|\n)\s*(?:html|body|button|\.modal)\s*\{/m);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 480px\)/);
});
