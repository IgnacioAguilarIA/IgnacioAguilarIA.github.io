'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('E14 loads after the current nutrition interface and E13', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('./css/95-nutrition-guided-layout-e13.css') < html.indexOf('./css/96-nutrition-feedback-states-e14.css'));
  assert.ok(html.indexOf('./js/68-nutrition-guided-layout-e13.js') < html.indexOf('./js/69-nutrition-feedback-states-e14.js'));
  assert.equal((html.match(/96-nutrition-feedback-states-e14\.css/g) || []).length, 1);
  assert.equal((html.match(/69-nutrition-feedback-states-e14\.js/g) || []).length, 1);
});

test('E14 classifies loading, success, empty, warning and failures without treating failures as empty data', () => {
  const js = read('js/69-nutrition-feedback-states-e14.js');
  assert.match(js, /function classifyState\(value\)/);
  for (const state of ['error', 'warning', 'loading', 'empty', 'success', 'neutral']) assert.match(js, new RegExp(`return '${state}'`));
  assert.ok(js.indexOf('no se pudo|no se pudieron') < js.indexOf('^no hay\\b'));
});

test('main meal loader publishes explicit error state, cache fallback and success state', () => {
  const js = read('js/03-inline-script-03.js');
  assert.match(js, /agenda:nutrition-meals-loaded/);
  assert.match(js, /state:error\?'error':'success'/);
  assert.match(js, /errorMessage:error\?String\(error\.message\|\|error\):''/);
  assert.match(js, /usedCache,/);
  assert.match(js, /cachedCount,/);
  assert.match(js, /catch\(err\)\{error=err;\}/);
  assert.match(js, /state:'signed-out'/);
});

test('E14 error notice explains when cached data is stale and avoids a false empty state', () => {
  const js = read('js/69-nutrition-feedback-states-e14.js');
  assert.match(js, /No pudimos actualizar tus comidas/);
  assert.match(js, /No podemos confirmar si este día está vacío/);
  assert.match(js, /hasCachedMeals/);
  assert.match(js, /La cuenta cambió/);
  assert.match(js, /selectNutritionDay\(day\)/);
  const guide = read('js/68-nutrition-guided-layout-e13.js');
  assert.match(guide, /nutritionMealLoadFeedback.*dataset\.state === 'error'/);
});

test('E14 only offers safe retries for operations with an existing refresh path', () => {
  const js = read('js/69-nutrition-feedback-states-e14.js');
  for (const id of ['nutritionRecipeListStatus', 'nutritionUserFoodsStatus', 'nutritionHistoryStatus', 'nutritionStatsStatus', 'nutritionQualityStatus', 'nutritionCopyDayStatus']) assert.ok(js.includes(id));
  assert.match(js, /nutritionHistoryRange/);
  assert.match(js, /nutritionStatsRefresh/);
  assert.match(js, /nutritionQualityReload/);
  assert.match(js, /nutritionCopyDayStatus: \(\) =>/);
});

test('E14 keeps its status observer scoped to nutrition panels and nutrition dialogs', () => {
  const js = read('js/69-nutrition-feedback-states-e14.js');
  assert.match(js, /#nutritionPanel, #nutritionAdvancedModal, #nutritionQualityOverlay/);
  assert.match(js, /nutrition-meal-copy-overlay/);
  assert.match(js, /nutrition-routine-overlay/);
});

test('E14 CSS supports touch-sized retry controls and accessible reduced-motion/forced-colors modes', () => {
  const css = read('css/96-nutrition-feedback-states-e14.css');
  assert.match(css, /\.nutrition-e14-retry[\s\S]*?min-height: 40px/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.nutrition-e14-retry \{ min-height: 44px/);
  assert.match(css, /@media \(min-width: 701px\) and \(max-width: 900px\)[\s\S]*?\.nutrition-e14-retry[\s\S]*?min-height: 44px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /#nutritionPanel #mealList \.meal-empty\[data-e14-state="loading"\]/);
});

test('E14 CSS states and feedback are scoped to nutrition components, not global workout/calendar panels', () => {
  const css = read('css/96-nutrition-feedback-states-e14.css');
  assert.match(css, /#nutritionPanel \.nutrition-e14-meal-feedback/);
  assert.doesNotMatch(css, /(^|\n)\s*(\.workout-panel|#workoutPanel|#calendarPanel|\.schedule)\s*\{/i);
});
