'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('E13 groups nutritional detail and objectives without changing existing dynamic IDs', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const id of [
    'nutritionDetailsDisclosure','nutritionSummaryPlannedTitle','nutritionSummaryConsumedTitle',
    'nutritionSummaryCaloriesPlanned','nutritionSummaryCalories','nutritionGoalsDisclosure',
    'nutritionGoals','nutritionGoalSummary','mealTabs','mealList','addMealBtn','nutritionGoalBtn','nutritionHistoryBtn'
  ]) assert.ok(html.includes(`id="${id}"`), `existing ID missing: ${id}`);
  assert.match(html, /<details class="e13-progressive-disclosure e13-nutrition-details"[^>]*data-e13-collapsible/);
  assert.match(html, /<details class="e13-progressive-disclosure e13-goals-details"[^>]*data-e13-collapsible/);
  assert.match(html, /id="e13FirstUse"[^>]*hidden/);
});

test('E13 loads only after prior nutrition modules and E12 visual layer', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('./css/94-nutrition-browse-filters-e12.css') < html.indexOf('./css/95-nutrition-guided-layout-e13.css'));
  assert.ok(html.indexOf('./js/67-nutrition-meal-save-safety-e8.js') < html.indexOf('./js/68-nutrition-guided-layout-e13.js'));
  assert.equal((html.match(/95-nutrition-guided-layout-e13\.css/g) || []).length, 1);
  assert.equal((html.match(/68-nutrition-guided-layout-e13\.js/g) || []).length, 1);
});

test('E13 CSS stays scoped to Alimentación and honors desktop/mobile breakpoints and accessibility', () => {
  const css = fs.readFileSync(path.join(root, 'css/95-nutrition-guided-layout-e13.css'), 'utf8');
  assert.match(css, /@media \(min-width: 701px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /#nutritionPanel \.e13-first-use\[hidden\]/);
  assert.doesNotMatch(css, /(^|\n)\s*(body|\.workout-panel|\.calendar|\.schedule|\.section-view)\s*\{/i);
});

test('E13 progressive script dynamically groups action buttons so modules may still append tools', () => {
  const js = fs.readFileSync(path.join(root, 'js/68-nutrition-guided-layout-e13.js'), 'utf8');
  assert.match(js, /MutationObserver/);
  assert.match(js, /nutrition-actions/);
  assert.match(js, /addMealBtn/);
  assert.match(js, /e13-tools-content/);
  assert.match(js, /agenda:nutrition-meals-loaded/);
  assert.match(js, /aria-pressed/);
});
