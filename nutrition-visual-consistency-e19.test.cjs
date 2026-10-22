'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('E19 stylesheet loads once after E18 and does not add a runtime dependency', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const e18 = html.indexOf('./css/100-nutrition-view-preferences-e18.css');
  const e19 = html.indexOf('./css/101-nutrition-visual-consistency-e19.css');
  assert.ok(e18 >= 0 && e19 > e18, 'E19 must load after E18');
  assert.equal((html.match(/101-nutrition-visual-consistency-e19\.css/g) || []).length, 1);
  assert.equal((html.match(/101-nutrition-visual-consistency-e19\.js/g) || []).length, 0);
});

test('E19 tokens are defined for panel and standalone nutrition dialogs in both themes', () => {
  const css = fs.readFileSync(path.join(root, 'css/101-nutrition-visual-consistency-e19.css'), 'utf8');
  for (const token of ['--n19-radius-control', '--n19-control-bg', '--n19-control-border', '--n19-dialog-bg', '--n19-dialog-soft', '--n19-dialog-text', '--n19-dialog-muted', '--n19-dialog-border']) assert.ok(css.includes(token), `missing ${token}`);
  assert.match(css, /body\.light #nutritionPanel/);
  assert.match(css, /body\.light #nutritionOverlay \.modal/);
  assert.match(css, /\.nutrition-plan-editor-dialog/);
  assert.match(css, /\.nutrition-pantry-modal/);
});

test('E19 unifies form fields and visible focus without styling unrelated sections', () => {
  const css = fs.readFileSync(path.join(root, 'css/101-nutrition-visual-consistency-e19.css'), 'utf8');
  assert.match(css, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select, textarea/);
  assert.match(css, /:focus-visible[\s\S]*?outline: 3px solid/);
  assert.match(css, /border-radius: var\(--n19-radius-control/);
  assert.doesNotMatch(css, /(^|})\s*(?:html|body|button|\.modal)\s*\{/m, 'global or generic modal selectors could affect other sections');
  assert.doesNotMatch(css, /#workoutPanel|#agendaPanel|#calendarPanel|\.v28-workout/);
});

test('E19 has consistent disabled states, reduced-motion and forced-colors fallbacks', () => {
  const css = fs.readFileSync(path.join(root, 'css/101-nutrition-visual-consistency-e19.css'), 'utf8');
  assert.match(css, /button:disabled[\s\S]*?cursor: not-allowed/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /overflow-x: auto/);
});

test('E19 table styles are limited to nutrition reports and routine statistics', () => {
  const css = fs.readFileSync(path.join(root, 'css/101-nutrition-visual-consistency-e19.css'), 'utf8');
  assert.match(css, /\.nutrition-quality-table-wrap/);
  assert.match(css, /\.nutrition-routine-table-wrap/);
  assert.match(css, /\.nutrition-routine-table/);
  assert.doesNotMatch(css, /(^|})\s*table\s*\{/m, 'plain table selector would affect unrelated app areas');
});

test('E19 is a presentation-only layer and retains all E18/runtime entry points', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/101-nutrition-visual-consistency-e19.css'), 'utf8');
  assert.ok(html.includes('id="nutritionPanel"'));
  assert.ok(html.includes('./js/73-nutrition-view-preferences-e18.js'));
  assert.ok(css.includes('#nutritionPanel'));
  assert.ok(css.includes('.e18-view-preferences-dialog'));
  assert.doesNotMatch(css, /localStorage|supabase|fetch\(|\.insert\(|\.update\(/i);
});
