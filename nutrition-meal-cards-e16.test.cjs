'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('E16 loads strictly after E15 and introduces only its scoped runtime and stylesheet', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('./css/97-nutrition-task-hub-e15.css') < html.indexOf('./css/98-nutrition-meal-cards-e16.css'));
  assert.ok(html.indexOf('./js/70-nutrition-task-hub-e15.js') < html.indexOf('./js/71-nutrition-meal-cards-e16.js'));
  assert.equal((html.match(/98-nutrition-meal-cards-e16\.css/g) || []).length, 1);
  assert.equal((html.match(/71-nutrition-meal-cards-e16\.js/g) || []).length, 1);
  for (const id of ['nutritionPanel','mealList','addMealBtn']) assert.ok(html.includes(`id="${id}"`));
  assert.match(fs.readFileSync(path.join(root, 'js/68-nutrition-guided-layout-e13.js'), 'utf8'), /details\.id = 'nutritionMoreTools'/);
});

test('E16 derives visible summary pills from existing nutritional metadata without persistence calls', () => {
  const js = fs.readFileSync(path.join(root, 'js/71-nutrition-meal-cards-e16.js'), 'utf8');
  assert.match(js, /readMeta\(meta, \/\^\(\?:prot/);
  assert.match(js, /readMeta\(meta, \/\^\(\?:hora/);
  assert.match(js, /e16-meal-protein/);
  assert.match(js, /e16-meal-time/);
  assert.doesNotMatch(js, /fetch\(|\.from\(['"]|\.insert\(|\.update\(/, 'presentation-only module must not access the database');
});

test('E16 keeps the E15 detail disclosure, compact labels and accessible action names', () => {
  const js = fs.readFileSync(path.join(root, 'js/71-nutrition-meal-cards-e16.js'), 'utf8');
  assert.match(js, /Ver detalles/);
  assert.match(js, /Ingredientes, notas y nutrientes/);
  assert.match(js, /aria-label/);
  assert.match(js, /aria-controls/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /Ocultar detalles/);
  assert.match(js, /dataset\.e16CardReady/);
  assert.match(js, /new MutationObserver/);
});

test('E16 CSS is scoped to Alimentación and supports keyboard, reduced motion, forced colors and touch', () => {
  const css = fs.readFileSync(path.join(root, 'css/98-nutrition-meal-cards-e16.css'), 'utf8');
  assert.match(css, /#nutritionPanel #mealList \.meal-card/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /pointer:\s*coarse/);
  assert.match(css, /min-height:\s*44px/);
  assert.ok(!/(^|})\s*(?:body|html|\.meal-card|button)\s*\{/m.test(css), 'must not style other app sections globally');
});
