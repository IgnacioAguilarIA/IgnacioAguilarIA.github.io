const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/117-nutrition-week-template-selection-e36.css'), 'utf8');
const e37css = fs.readFileSync(path.join(root, 'css/118-nutrition-week-template-target-day-e37.css'), 'utf8');
const window = { currentUser: { id: 'user-e36' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('DOM inesperado en prueba pura'); } };
vm.runInNewContext(source, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: () => 'e36-fixed-uuid' } });
const api = window.AgendaNutritionWeeklyPlan;
assert.ok(api);
const sourceWeek = '2026-10-19', targetWeek = '2026-10-26', who = 'user-e36';
const sourceRows = [
  { id: 'source-breakfast', user_id: who, week_start: sourceWeek, day_offset: 0, meal_type: 'desayuno', title: 'Avena', planned_time: '08:00', notes: 'Canela', plan_key: 'manual:breakfast', sort_order: 0, updated_at: 'v1', ingredients_snapshot: [{ name: 'Avena', quantity: 50, quantity_known: true, unit: 'g', quality: { confidence: 'high' } }], nutrition_snapshot: { calories: 190, protein_g: 7, fiber_g: null, nutrition_missing_metrics: ['fiber'] } },
  { id: 'source-dinner', user_id: who, week_start: sourceWeek, day_offset: 2, meal_type: 'cena', title: 'Sopa', planned_time: '20:00', notes: '', plan_key: 'manual:dinner', sort_order: 0, updated_at: 'v2', ingredients_snapshot: [{ name: 'Zapallo', quantity: null, quantity_known: false, unit: 'g', provenance: { source: 'custom' } }], nutrition_snapshot: { calories: null, nutrition_missing_metrics: ['calories', 'protein', 'carbs', 'fat', 'fiber'] } }
];
const template = api.createWeeklyPlanTemplate(sourceRows, sourceWeek, who, 'Semana base', 'template-e36-001', '2026-10-21T10:00:00.000Z', (() => { let n = 0; return () => `template-item-e36-${++n}`; })());
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

test('La vista previa selectiva solo incluye los IDs elegidos y permite combinar en días ocupados', () => {
  const target = [{ id: 'existing-monday', user_id: who, week_start: targetWeek, day_offset: 0, meal_type: 'desayuno', title: 'Comida que ya existía', plan_key: 'manual:existing', sort_order: 0, ingredients_snapshot: [], nutrition_snapshot: {} }];
  const selected = [template.items[0].item_id];
  const preview = api.previewWeeklyTemplate(template, target, targetWeek, who, { selectedItemIds: selected });
  assert.deepEqual(JSON.parse(JSON.stringify(preview.selected_item_ids)), selected);
  assert.equal(preview.selected_meal_count, 1);
  assert.equal(preview.template_meal_count, 2);
  assert.equal(preview.includeOccupiedDays, true);
  assert.equal(preview.counts.mealsToAdd, 1);
  assert.equal(preview.counts.daysMerged, 1);
  assert.equal(preview.counts.daysSkipped, 0);
  assert.equal(preview.days.find(day => day.day === 0).status, 'merge');
  assert.equal(preview.days.find(day => day.day === 2).status, 'empty');
  assert.equal(target[0].title, 'Comida que ya existía');
});

test('Los payloads solo contienen las comidas seleccionadas y conservan metadatos', () => {
  const target = [{ id: 'existing-monday', user_id: who, week_start: targetWeek, day_offset: 0, meal_type: 'desayuno', title: 'Comida existente', plan_key: 'manual:existing', sort_order: 0, ingredients_snapshot: [], nutrition_snapshot: {} }];
  const preview = api.previewWeeklyTemplate(template, target, targetWeek, who, { selectedItemIds: [template.items[1].item_id] });
  const payloads = api.weeklyTemplatePayloads(template, preview, target, targetWeek, who, '2026-10-21T11:00:00.000Z');
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].title, 'Sopa');
  assert.equal(payloads[0].day_offset, 2);
  assert.equal(payloads[0].ingredients_snapshot[0].quantity_known, false);
  assert.equal(payloads[0].ingredients_snapshot[0].provenance.source, 'custom');
  assert.equal(payloads[0].source_meal_id, null);
  assert.ok(payloads[0].plan_key.includes(template.items[1].item_id));
});

test('No duplica una comida seleccionada que ya existe, aunque otras comidas de la plantilla falten', () => {
  const selectedItem = template.items[0];
  const existing = { id: 'already-copied', user_id: who, week_start: targetWeek, day_offset: selectedItem.day_offset, title: selectedItem.title, plan_key: api.weeklyTemplatePlanKey(template.id, selectedItem.item_id), sort_order: 0, ingredients_snapshot: selectedItem.ingredients_snapshot, nutrition_snapshot: selectedItem.nutrition_snapshot };
  const preview = api.previewWeeklyTemplate(template, [existing], targetWeek, who, { selectedItemIds: [selectedItem.item_id] });
  assert.equal(preview.counts.mealsAlreadyPresent, 1);
  assert.equal(preview.counts.mealsToAdd, 0);
  assert.equal(api.weeklyTemplatePayloads(template, preview, [existing], targetWeek, who).length, 0);
});

test('Rechaza una selección vacía, IDs desconocidos y claves de selección repetidas', () => {
  assert.throws(() => api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: [] }), /al menos una comida/);
  assert.throws(() => api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: ['unknown-item-e36'] }), /ya no pertenece/);
  assert.throws(() => api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: [template.items[0].item_id, template.items[0].item_id] }), /repetidas/);
});

test('El guardado detecta cambios remotos del destino tras la vista previa selectiva', () => {
  const base = [{ id: 'existing', user_id: who, week_start: targetWeek, day_offset: 0, title: 'Existente', plan_key: 'manual:existing', sort_order: 0, ingredients_snapshot: [], nutrition_snapshot: {} }];
  const preview = api.previewWeeklyTemplate(template, base, targetWeek, who, { selectedItemIds: [template.items[1].item_id] });
  const remotelyChanged = [...base, { id: 'remote', user_id: who, week_start: targetWeek, day_offset: 4, title: 'Cambio remoto', plan_key: 'manual:remote', sort_order: 0, ingredients_snapshot: [], nutrition_snapshot: {} }];
  assert.throws(() => api.weeklyTemplatePayloads(template, preview, remotelyChanged, targetWeek, who), /cambió desde la vista previa/);
});

test('El HTML carga el nuevo CSS y actualiza la versión de caché del editor', () => {
  assert.match(html, /css\/117-nutrition-week-template-selection-e36\.css\?v=e36/);
  assert.match(html, /css\/118-nutrition-week-template-target-day-e37\.css\?v=e37/);
  assert.match(html, /js\/63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.match(e37css, /prefers-reduced-motion/);
  assert.match(e37css, /forced-colors/);
  assert.match(e37css, /focus-visible/);
  assert.doesNotMatch(e37css, /#fff\b|white\s*!important/i);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /#fff\b|white\s*!important/i);
});

console.log(`E36 selective template apply tests: ${passed}/6 passed`);
