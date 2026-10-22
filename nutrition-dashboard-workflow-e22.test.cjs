'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('E22 dashboard polish loads once after E21 without adding runtime dependencies', () => {
  const html = read('index.html');
  const e21 = html.indexOf('./css/102-nutrition-autocomplete-accessibility-e20.css?v=e21');
  const e22 = html.indexOf('./css/103-nutrition-workflow-polish-e22.css?v=e22');
  assert.ok(e21 >= 0 && e22 > e21, 'E22 should be loaded after the validated E21 layer');
  assert.equal((html.match(/103-nutrition-workflow-polish-e22\.css\?v=e22/g) || []).length, 1);
  assert.equal((html.match(/103-nutrition-workflow-polish-e22\.js/g) || []).length, 0);
});

test('E22 makes routine sync metadata compact but keeps errors and warnings prominent', () => {
  const css = read('css/103-nutrition-workflow-polish-e22.css');
  assert.match(css, /#nutritionPanel \.nutrition-sync-status\s*\{[\s\S]*?width:\s*fit-content/);
  assert.match(css, /\.nutrition-sync-status\.is-warning,[\s\S]*?\.nutrition-sync-status\.is-error\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /#nutritionPanel #nutritionSummaryMeals/);
});

test('E22 has responsive day selection and mobile summary rules', () => {
  const css = read('css/103-nutrition-workflow-polish-e22.css');
  assert.match(css, /@media \(min-width: 901px\)[\s\S]*?grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 380px\)/);
});

test('E22 improves first-use guidance, meal cards and editor step hierarchy without changing core IDs', () => {
  const css = read('css/103-nutrition-workflow-polish-e22.css');
  const html = read('index.html');
  for (const id of ['nutritionPanel','nutritionSyncStatus','nutritionSummaryMeals','nutritionDays','mealTabs','mealList','nutritionOverlay','nutritionMealBuilder']) {
    assert.ok(html.includes(`id="${id}"`), `required UI entry point missing: ${id}`);
  }
  assert.match(css, /#nutritionPanel \.e13-first-use/);
  assert.match(css, /#nutritionPanel #mealList \.e15-meal-card-preview/);
  assert.match(css, /#nutritionOverlay \.nutrition-entry-section-basics/);
  assert.match(css, /#nutritionOverlay \.nutrition-entry-section-catalog/);
});

test('E22 stays scoped and includes reduced-motion and forced-color fallbacks', () => {
  const css = read('css/103-nutrition-workflow-polish-e22.css');
  assert.doesNotMatch(css, /#workoutPanel|#agendaPanel|#calendarPanel|\.v28-workout|\.workout-panel/i);
  assert.doesNotMatch(css, /(^|\n)\s*(?:html|body|button|\.modal)\s*\{/m, 'unexpected broad selector');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});
