'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/93-nutrition-premium-dashboard-e11.css'), 'utf8');

test('E11 loads after the established nutrition styles without duplicate references', () => {
  const e10 = html.indexOf('./css/92-nutrition-professional-finish-e10.css');
  const e11 = html.indexOf('./css/93-nutrition-premium-dashboard-e11.css');
  assert.ok(e10 >= 0 && e11 > e10, 'E11 must follow E10 in the cascade');
  assert.equal((html.match(/93-nutrition-premium-dashboard-e11\.css/g) || []).length, 1);
});

test('E11 defines dedicated light and dark design tokens scoped to Nutrition', () => {
  assert.match(css, /#nutritionPanel\s*\{[\s\S]*?--n11-bg:/);
  assert.match(css, /body\.light\s+#nutritionPanel\s*\{[\s\S]*?--n11-bg:/);
  assert.match(css, /#nutritionPanel\s+\.nutrition-day-summary/);
  assert.match(css, /body\.light\s+#nutritionPanel\s+\.nutrition-day-summary/);
});

test('primary action, save status and plan-versus-consumed hierarchy are explicit', () => {
  assert.match(css, /#nutritionPanel\s+\.nutrition-actions\s+#addMealBtn/);
  for (const state of ['is-saved', 'is-pending', 'is-warning', 'is-error']) {
    assert.ok(css.includes(`.nutrition-sync-status.${state}`), `Missing status ${state}`);
  }
  assert.match(css, /\.nutrition-summary-planned/);
  assert.match(css, /\.nutrition-summary-consumed/);
  assert.match(css, /#nutritionPanel\s+#nutritionGoals\s+\.goal-card/);
});

test('responsive rules keep day, meal, summary and action controls usable', () => {
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /#nutritionPanel\s+#mealList\s*\{[\s\S]*?max-height:\s*none/);
});

test('shared navigation receives scoped styles only while Nutrition is active', () => {
  assert.match(css, /body:has\(#nutritionPanel\.v32-section-active\)\s+#mobileNav/);
  assert.match(css, /body\.light:has\(#nutritionPanel\.v32-section-active\)\s+#mobileNav/);
  assert.doesNotMatch(css, /(^|\n)\s*(button|input|select|textarea|\.section-view|\.workout-panel|\.calendar|\.schedule)\s*\{/i);
});

test('accessibility preferences are preserved', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /:focus-visible/);
});

console.log('E11 premium dashboard checks completed.');
