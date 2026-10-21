'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css/92-nutrition-professional-finish-e10.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('E10 se carga después de los ajustes E6 y E7', () => {
  const e6 = html.indexOf('./css/90-nutrition-mobile-e6.css');
  const e7 = html.indexOf('./css/91-nutrition-quick-registration-e7.css');
  const e10 = html.indexOf('./css/92-nutrition-professional-finish-e10.css');
  assert.ok(e6 >= 0 && e7 > e6 && e10 > e7, 'el orden de carga debe preservar la cascada de estilos');
  assert.equal((html.match(/92-nutrition-professional-finish-e10\.css/g) || []).length, 1);
});

test('el sistema visual incluye tema oscuro y tema claro', () => {
  assert.match(css, /#nutritionPanel\s*\{[\s\S]*?--nf-surface:/);
  assert.match(css, /body\.light\s+#nutritionPanel\s*\{[\s\S]*?--nf-surface:\s*#f8fafc/);
  assert.match(css, /body\.light\s+#nutritionPanel\s+\.nutrition-summary-planned\s+\.nutrition-summary-metric/);
  assert.match(css, /body\.light\s+#nutritionPanel\s+\.nutrition-summary-consumed\s+\.nutrition-summary-metric/);
});

test('los estados de sincronización diferencian guardado, pendiente, advertencia y error', () => {
  for (const state of ['is-saved', 'is-pending', 'is-warning', 'is-error']) {
    assert.ok(css.includes(`.nutrition-sync-status.${state}`), `falta estilo del estado ${state}`);
  }
  assert.match(css, /body\.light\s+#nutritionPanel\s+\.nutrition-sync-status\.is-saved/);
  assert.match(css, /body\.light\s+#nutritionPanel\s+\.nutrition-sync-status\.is-error/);
});

test('controles y tarjetas tienen foco visible y estados activos explícitos', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /#nutritionDays\s+\.workout-day-btn\.active/);
  assert.match(css, /#mealTabs\s+\.meal-tab\.active/);
  assert.match(css, /nutrition-summary-metric\s+strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
});

test('la capa visual respeta movimiento reducido y alto contraste', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /ButtonText/);
  assert.match(css, /Highlight/);
});

test('la hoja no redefine estilos globales de secciones ajenas', () => {
  assert.doesNotMatch(css, /(^|\n)\s*(button|input|select|textarea|\.modal|\.section-view|\.workout-panel|\.calendar|\.schedule)\s*\{/i);
  assert.match(css, /#nutritionPanel/);
  assert.match(css, /#nutritionOverlay/);
  assert.match(css, /#goalOverlay/);
});

console.log('E10 professional finish checks completed.');
