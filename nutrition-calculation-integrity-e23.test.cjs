'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function loadPersistence() {
  const window = {};
  const document = { readyState: 'complete', addEventListener() {}, getElementById() { return null; } };
  vm.runInNewContext(read('js/49-nutrition-persistence.js'), { window, document, console });
  return { window, api: window.AgendaNutritionData };
}

function loadBuilder(api) {
  const window = { AgendaNutritionData: api };
  const document = { readyState: 'complete', addEventListener() {}, getElementById() { return null; } };
  vm.runInNewContext(read('js/52-nutrition-meal-builder.js'), { window, document, console });
  return window.AgendaNutritionMealBuilderMath;
}

function loadLiveSummary(api) {
  const window = { AgendaNutritionData: api };
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; }
  };
  vm.runInNewContext(read('js/55-nutrition-live-summary.js'), { window, document, console, localStorage: { getItem() { return null; }, removeItem() {} } });
  return window.AgendaNutritionLiveSummaryMath;
}

test('E23 shares one missing-nutrient interpretation across the nutrition modules', () => {
  const { api } = loadPersistence();
  const incomplete = {
    calories_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 12,
    fat_per_100g: 0,
    nutrition_quality_status: 'incomplete',
    nutrition_missing_fields: ['proteínas']
  };
  assert.deepEqual(Array.from(api.missingMacroMetrics(incomplete)), ['protein']);
  const trueZero = {
    calories_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
    nutrition_quality_status: 'user_verified',
    nutrition_missing_fields: []
  };
  assert.deepEqual(Array.from(api.missingMacroMetrics(trueZero)), [], 'a documented numeric zero remains valid');
  const unknownLegacy = {
    calories_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
    nutritionQualityStatus: 'incomplete',
    nutritionMissing: []
  };
  assert.deepEqual(Array.from(api.missingMacroMetrics(unknownLegacy)), ['calories', 'protein', 'carbs', 'fat']);
});

test('E23 builder does not show a missing nutrient as zero and marks only affected totals unknown', () => {
  const { api } = loadPersistence();
  const math = loadBuilder(api);
  const totals = math.macroTotal([
    { name: 'Alimento con dato conocido', quantity: 100, quantity_in_grams: 100, unit: 'g', calories_per_100g: 120, protein_per_100g: 5, carbs_per_100g: 9, fat_per_100g: 2, nutrition_quality_status: 'user_verified', nutrition_missing_fields: [] },
    { name: 'Alimento sin proteínas informadas', quantity: 50, quantity_in_grams: 50, unit: 'g', calories_per_100g: 200, protein_per_100g: 0, carbs_per_100g: 20, fat_per_100g: 8, nutrition_quality_status: 'incomplete', nutrition_missing_fields: ['proteínas'] }
  ]);
  assert.equal(totals.calories, 220);
  assert.equal(totals.carbs, 19);
  assert.equal(totals.fat, 6);
  assert.ok(Array.from(totals.unknownMetrics).includes('protein'));
  assert.ok(!Array.from(totals.unknownMetrics).includes('calories'));
});

test('E23 builder marks all totals unknown when a food quantity cannot be converted', () => {
  const { api } = loadPersistence();
  const math = loadBuilder(api);
  const totals = math.macroTotal([{ name: 'Porción sin equivalencia', quantity: 1, unit: 'unit', calories_per_100g: 100, protein_per_100g: 5, carbs_per_100g: 10, fat_per_100g: 2, nutrition_missing_fields: [] }]);
  assert.deepEqual(Array.from(totals.unknownMetrics).sort(), ['calories', 'carbs', 'fat', 'protein']);
  assert.deepEqual(Array.from(totals.unconvertible), ['Porción sin equivalencia']);
});

test('E23 daily summary keeps planned and consumed incompleteness separate', () => {
  const { api } = loadPersistence();
  const math = loadLiveSummary(api);
  const row = { name: 'Alimento incompleto', quantity: 100, unit: 'g', consumed: false, calories_per_100g: 90, protein_per_100g: 0, carbs_per_100g: 11, fat_per_100g: 3, nutrition_quality_status: 'incomplete', nutrition_missing_fields: ['proteínas'] };
  const plannedOnly = math.itemTotals([row]);
  assert.equal(plannedOnly.plannedIncomplete.protein, true);
  assert.equal(plannedOnly.consumedIncomplete.protein, false, 'unconsumed foods should not make the consumed total unknown');
  row.consumed = true;
  const consumed = math.itemTotals([row]);
  assert.equal(consumed.consumedIncomplete.protein, true);
  assert.equal(math.formatMetric(0, 'protein', 'g', { protein: true }), 'Datos incompletos');
  assert.equal(math.formatMetric(0, 'protein', 'g', { protein: false }), '0 g', 'a true zero remains visible');
});

test('E23 daily goals and summaries expose incomplete-data state without claiming zero progress', () => {
  const summary = read('js/55-nutrition-live-summary.js');
  assert.match(summary, /Datos incompletos/);
  assert.match(summary, /has-incomplete-data/);
  assert.match(summary, /Completá los datos del alimento para ver el progreso/);
  assert.match(summary, /plannedIncomplete/);
  assert.match(summary, /consumedIncomplete/);
  const html = read('index.html');
  assert.match(html, /id="e23NutritionDataQualityNote" role="status" aria-live="polite" hidden/);
});

test('E23 save payload preserves a confirmed numerical zero and keeps empty fields null', () => {
  const core = read('js/03-inline-script-03.js');
  assert.match(core, /const numericOrNull=value=>\{const raw=String\(value\?\?''\)\.trim\(\);if\(raw===''\)return null;const number=Number\(raw\);return Number\.isFinite\(number\)&&number>=0\?number:null\}/);
  assert.match(core, /calories:numericOrNull\(\$\('mealCalories'\)\.value\),protein_g:numericOrNull\(\$\('mealProtein'\)\.value\),carbs_g:numericOrNull\(\$\('mealCarbs'\)\.value\),fat_g:numericOrNull\(\$\('mealFat'\)\.value\)/);
});

test('E23 presentation is scoped to Alimentación and preserves accessibility modes', () => {
  const css = read('css/104-nutrition-calculation-integrity-e23.css');
  assert.doesNotMatch(css, /#workoutPanel|#agendaPanel|#calendarPanel|\.v28-workout/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  const html = read('index.html');
  assert.match(html, /104-nutrition-calculation-integrity-e23\.css\?v=e23/);
  for (const src of ['49-nutrition-persistence.js?v=e25', '52-nutrition-meal-builder.js?v=e23', '54-nutrition-consumption.js?v=e23', '55-nutrition-live-summary.js?v=e23']) {
    assert.ok(html.includes(src), `missing E23 cache version: ${src}`);
  }
});
