'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('E15 loads its scoped visual layer after E14 and keeps the original nutrition handlers', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('./css/96-nutrition-feedback-states-e14.css') < html.indexOf('./css/97-nutrition-task-hub-e15.css'));
  assert.ok(html.indexOf('./js/69-nutrition-feedback-states-e14.js') < html.indexOf('./js/70-nutrition-task-hub-e15.js'));
  assert.equal((html.match(/97-nutrition-task-hub-e15\.css/g) || []).length, 1);
  assert.equal((html.match(/70-nutrition-task-hub-e15\.js/g) || []).length, 1);
  for (const id of ['nutritionPanel','addMealBtn','nutritionGoalBtn','nutritionHistoryBtn','mealList']) assert.ok(html.includes(`id="${id}"`), `missing existing ID: ${id}`);
  assert.match(fs.readFileSync(path.join(root, 'js/68-nutrition-guided-layout-e13.js'), 'utf8'), /details\.id = 'nutritionMoreTools'/);
});

test('E15 groups existing actions without replacing their IDs or creating fake database actions', () => {
  const js = fs.readFileSync(path.join(root, 'js/70-nutrition-task-hub-e15.js'), 'utf8');
  for (const group of ['plan','prepare','organize','review','other']) assert.ok(js.includes(`key: '${group}'`), `missing tool group: ${group}`);
  assert.match(js, /content\.querySelectorAll\('button'\)/);
  assert.match(js, /button\.addEventListener\('click', \(\) => \{/);
  assert.match(js, /api\.openRecipes\(\)/);
  assert.doesNotMatch(js, /fetch\(|\.from\(['"]|insert\(|update\(/, 'layout-only module must not access the database');
});

test('E15 meal-card presentation preserves the existing consumption host insertion point', () => {
  const js = fs.readFileSync(path.join(root, 'js/70-nutrition-task-hub-e15.js'), 'utf8');
  assert.match(js, /card\.querySelector\(':scope > \.meal-card-head'\)/);
  assert.match(js, /\.meal-foods/);
  assert.match(js, /\.meal-description/);
  assert.match(js, /\.meal-meta/);
  assert.match(js, /dataset\.e15CardDetailsReady/);
  const consumption = fs.readFileSync(path.join(root, 'js/54-nutrition-consumption.js'), 'utf8');
  assert.match(consumption, /insertAdjacentElement\('afterend',host\)/, 'consumption UI depends on the existing direct meal-card header');
});

test('E15 styles are scoped to Alimentación and retain touch, keyboard and reduced-motion support', () => {
  const css = fs.readFileSync(path.join(root, 'css/97-nutrition-task-hub-e15.css'), 'utf8');
  assert.ok(!/(^|})\s*(?:body|html|\.meal-card|button)\s*\{/m.test(css), 'selectors should not style other app sections globally');
  assert.match(css, /#nutritionPanel/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /body\.light/);
});
