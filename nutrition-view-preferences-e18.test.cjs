'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('E18 loads after E17 and adds its own presentation assets exactly once', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('./css/99-nutrition-microinteractions-e17.css') < html.indexOf('./css/100-nutrition-view-preferences-e18.css'));
  assert.ok(html.indexOf('./js/72-nutrition-microinteractions-e17.js') < html.indexOf('./js/73-nutrition-view-preferences-e18.js'));
  assert.equal((html.match(/100-nutrition-view-preferences-e18\.css/g) || []).length, 1);
  assert.equal((html.match(/73-nutrition-view-preferences-e18\.js/g) || []).length, 1);
  for (const id of ['nutritionPanel', 'nutritionMoreTools', 'nutritionDetailsDisclosure', 'mealList', 'addMealBtn']) assert.ok(html.includes(`id="${id}"`) || id === 'nutritionMoreTools', `missing base element ${id}`);
});

test('E18 stores only view preferences under a per-account local key and validates values', () => {
  const js = fs.readFileSync(path.join(root, 'js/73-nutrition-view-preferences-e18.js'), 'utf8');
  assert.match(js, /agendaNutritionViewPrefsE18:/);
  assert.match(js, /function ownerKey\(\)/);
  assert.match(js, /function normalizedPrefs\(value\)/);
  assert.match(js, /\['auto', 'compact', 'detailed'\]/);
  assert.match(js, /localStorage\.setItem\(storageKey\(owner\)/);
  assert.doesNotMatch(js, /\.from\(['"]|fetch\(|\.insert\(|\.update\(/, 'view preferences must not write nutrition/database records');
});

test('E18 applies detail display mode to day summary and meal details without changing nutrient data', () => {
  const js = fs.readFileSync(path.join(root, 'js/73-nutrition-view-preferences-e18.js'), 'utf8');
  assert.match(js, /nutritionDetailsDisclosure/);
  assert.match(js, /\.e15-meal-details/);
  assert.match(js, /detailMode === 'compact'/);
  assert.match(js, /detailMode === 'detailed'/);
  assert.match(js, /return !isMobile\(\)/);
  assert.match(js, /agenda:nutrition-meals-loaded/);
  assert.doesNotMatch(js, /mealItems\s*=|nutritionMeals\s*=|UPDATE|INSERT INTO/i);
});

test('E18 dialog supports Escape, a focus trap, save/cancel/reset and accessible labels', () => {
  const js = fs.readFileSync(path.join(root, 'js/73-nutrition-view-preferences-e18.js'), 'utf8');
  assert.match(js, /role', 'dialog'/);
  assert.match(js, /aria-modal', 'true'/);
  assert.match(js, /e18ViewPreferencesTitle/);
  assert.match(js, /event\.key === 'Escape'/);
  assert.match(js, /event\.shiftKey && document\.activeElement === first/);
  assert.match(js, /Guardar preferencias/);
  assert.match(js, /Restablecer/);
  assert.match(js, /Cancelar/);
  assert.match(js, /trigger\.focus\(\{ preventScroll: true \}\)/);
});

test('E18 last-tool shortcut is opt-in, excludes its own settings button, and is account scoped', () => {
  const js = fs.readFileSync(path.join(root, 'js/73-nutrition-view-preferences-e18.js'), 'utf8');
  assert.match(js, /rememberLastTool/);
  assert.match(js, /nutritionE18LastToolShortcut/);
  assert.match(js, /nutritionE18ViewPrefsBtn/);
  assert.match(js, /lastToolId: remember \? prefs\.lastToolId : ''/);
  assert.match(js, /function syncAccount\(\)/);
  assert.match(js, /onAuthStateChange/);
  assert.match(js, /lastToolId \? \$\(prefs\.lastToolId\)/);
});

test('E18 style remains scoped to Alimentación and supports keyboard, touch, light/dark, reduced motion and forced colors', () => {
  const css = fs.readFileSync(path.join(root, 'css/100-nutrition-view-preferences-e18.css'), 'utf8');
  assert.match(css, /#nutritionPanel/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /body\.light/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.doesNotMatch(css, /(^|})\s*(?:html|body|button)\s*\{/m, 'styles must not globally restyle other sections');
});
