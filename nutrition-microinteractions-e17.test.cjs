'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('E17 loads after E16 and adds exactly one scoped runtime and stylesheet', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('./css/98-nutrition-meal-cards-e16.css') < html.indexOf('./css/99-nutrition-microinteractions-e17.css'));
  assert.ok(html.indexOf('./js/71-nutrition-meal-cards-e16.js') < html.indexOf('./js/72-nutrition-microinteractions-e17.js'));
  assert.equal((html.match(/99-nutrition-microinteractions-e17\.css/g) || []).length, 1);
  assert.equal((html.match(/72-nutrition-microinteractions-e17\.js/g) || []).length, 1);
});

test('E17 gives visual feedback only for confirmed saved meals and respects account ownership', () => {
  const js = read('js/72-nutrition-microinteractions-e17.js');
  assert.match(js, /agenda:nutrition-meal-saved/);
  assert.match(js, /e17-saved-feedback/);
  assert.match(js, /belongsToCurrentAccount/);
  assert.match(js, /detail\?\.userId/);
  assert.doesNotMatch(js, /fetch\(|\.from\(['"]|\.insert\(|\.update\(/, 'microinteractions must not write data');
});

test('E17 adds tactile and state feedback without replacing existing button handlers', () => {
  const js = read('js/72-nutrition-microinteractions-e17.js');
  assert.match(js, /agenda:nutrition-food-added/);
  assert.match(js, /agenda:nutrition-meal-items-saved/);
  assert.match(js, /agenda:nutrition-sync-status/);
  assert.match(js, /agenda:nutrition-goals-saved/);
  assert.match(js, /e17-field-updated/);
  assert.match(js, /e17-sync-confirmed/);
  assert.match(js, /setupMealDetailFeedback/);
});

test('E17 restores keyboard focus after a confirmed meal deletion when possible', () => {
  const js = read('js/72-nutrition-microinteractions-e17.js');
  assert.match(js, /captureKeyboardDelete/);
  assert.match(js, /event\.detail === 0/);
  assert.match(js, /agenda:nutrition-meal-deleted/);
  assert.match(js, /focus\(\{ preventScroll: true \}\)/);
});

test('E17 CSS keeps motion and focus treatment scoped to Nutrition', () => {
  const css = read('css/99-nutrition-microinteractions-e17.css');
  assert.match(css, /#nutritionPanel #mealList \.meal-card\.e17-saved-feedback/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.ok(!/(^|})\s*(?:body|html|\.workout-panel|#workoutPanel|#calendarPanel|\.schedule)\s*\{/m.test(css), 'must not style non-nutrition app sections');
  assert.match(css, /:active:not\(:disabled\)/);
});
