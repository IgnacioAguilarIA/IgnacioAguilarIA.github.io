const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/120-nutrition-week-template-change-review-e39.css'), 'utf8');
const window = { currentUser: { id: 'user-e39' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('DOM inesperado en prueba pura'); } };
vm.runInNewContext(source, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: () => 'e39-fixed-uuid' } });
const api = window.AgendaNutritionWeeklyPlan;
assert.ok(api);
const who = 'user-e39';
const sourceWeek = '2026-10-19';
const targetWeek = '2026-10-26';
const rows = [
  { id: 'e39-breakfast', user_id: who, week_start: sourceWeek, day_offset: 0, meal_type: 'desayuno', title: 'Avena original', planned_time: '08:00', notes: 'Canela', plan_key: 'manual:e39:breakfast', sort_order: 0, updated_at: 'v1', ingredients_snapshot: [{ name: 'Avena', quantity: 50, quantity_known: true, unit: 'g', provenance: { source: 'catalog' } }, { name: 'Leche', quantity: null, quantity_known: false, unit: 'ml' }], nutrition_snapshot: { calories: 190, protein_g: 7, carbs_g: null, fat_g: 3, fiber_g: null, nutrition_missing_metrics: ['carbs_g', 'fiber_g'] } },
  { id: 'e39-soup', user_id: who, week_start: sourceWeek, day_offset: 2, meal_type: 'cena', title: 'Sopa fuente', planned_time: '20:00', notes: '', plan_key: 'manual:e39:soup', sort_order: 0, updated_at: 'v2', ingredients_snapshot: [{ name: 'Zapallo', quantity: 250, quantity_known: true, unit: 'g' }], nutrition_snapshot: { calories: 110, protein_g: 3, carbs_g: 20, fat_g: 1, fiber_g: 4 } }
];
const template = api.createWeeklyPlanTemplate(rows, sourceWeek, who, 'Semana E39', 'template-e39-001', '2026-10-21T10:00:00.000Z', (() => { let n=0; return () => `template-item-e39-${++n}`; })());
const testCases = [];
function test(name, fn) { fn(); testCases.push(name); console.log(`✓ ${name}`); }

test('La vista consolidada muestra una fila por cada comida seleccionada y refleja los destinos personalizados', () => {
  const target = [{ id: 'existing-friday-e39', user_id: who, week_start: targetWeek, day_offset: 4, meal_type: 'merienda', title: 'Merienda ya organizada', plan_key: 'manual:target:snack', sort_order: 0, ingredients_snapshot: [], nutrition_snapshot: {} }];
  const selected = template.items.map(item => item.item_id);
  const targetDays = { [template.items[0].item_id]: 4, [template.items[1].item_id]: 4 };
  const preview = api.previewWeeklyTemplate(template, target, targetWeek, who, { selectedItemIds: selected, targetDayByItemId: targetDays });
  const review = preview.change_review;
  assert.equal(review.items.length, 2);
  assert.equal(review.items[0].source_day, 0);
  assert.equal(review.items[0].target_day, 4);
  assert.equal(review.items[0].action, 'add');
  assert.equal(review.items[0].existing_destination_count, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(review.items[0].existing_destination_titles)), ['Merienda ya organizada']);
  assert.equal(review.items[1].source_day, 2);
  assert.equal(review.items[1].target_day, 4);
  assert.equal(review.summary.toAdd, 2);
  assert.equal(review.summary.moved, 2);
  assert.equal(review.summary.occupiedDays, 1);
  assert.equal(review.summary.preservedExistingMeals, 1);
  assert.equal(target[0].title, 'Merienda ya organizada');
});

test('La revisión consolida cantidades desconocidas y nutrientes incompletos sin convertirlos en cero', () => {
  const preview = api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: [template.items[0].item_id] });
  const row = preview.change_review.items[0];
  assert.equal(row.unknown_quantity_count, 1);
  assert.equal(row.incomplete_nutrition, true);
  assert.equal(preview.change_review.summary.unknownQuantities, 1);
  assert.equal(preview.change_review.summary.incompleteNutrition, 1);
  assert.equal(row.action, 'add');
});

test('La revisión identifica comidas ya aplicadas y evita contarlas como altas nuevas', () => {
  const item = template.items[0];
  const existing = { id: 'existing-copy-e39', user_id: who, week_start: targetWeek, day_offset: item.day_offset, title: item.title, plan_key: api.weeklyTemplatePlanKey(template.id, item.item_id), sort_order: 0, ingredients_snapshot: item.ingredients_snapshot, nutrition_snapshot: item.nutrition_snapshot };
  const preview = api.previewWeeklyTemplate(template, [existing], targetWeek, who, { selectedItemIds: [item.item_id] });
  const row = preview.change_review.items[0];
  assert.equal(row.action, 'already');
  assert.equal(preview.change_review.summary.alreadyPresent, 1);
  assert.equal(preview.change_review.summary.toAdd, 0);
  assert.equal(api.weeklyTemplatePayloads(template, preview, [existing], targetWeek, who).length, 0);
});

test('La revisión marca un día ocupado como omitido en modo seguro y detalla qué queda intacto', () => {
  const target = [{ id: 'occupied-monday-e39', user_id: who, week_start: targetWeek, day_offset: 0, title: 'Almuerzo propio', plan_key: 'manual:occupied:e39', sort_order: 0, ingredients_snapshot: [], nutrition_snapshot: {} }];
  const preview = api.previewWeeklyTemplate(template, target, targetWeek, who, { includeOccupiedDays: false });
  const row = preview.change_review.items.find(item => item.title === 'Avena original');
  assert.equal(row.action, 'skip');
  assert.equal(row.existing_destination_count, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(row.existing_destination_titles)), ['Almuerzo propio']);
  assert.equal(preview.counts.daysSkipped, 1);
  assert.equal(preview.counts.mealsToAdd, 1);
  assert.equal(preview.change_review.summary.occupiedDays, 1);
  assert.equal(preview.change_review.summary.preservedExistingMeals, 1);
  assert.equal(target[0].title, 'Almuerzo propio');
});

test('La revisión no muta ni la plantilla ni el plan usado para la vista previa', () => {
  const target = [{ id: 'existing-e39', user_id: who, week_start: targetWeek, day_offset: 4, title: 'Otra comida', plan_key: 'manual:other:e39', sort_order: 0, ingredients_snapshot: [], nutrition_snapshot: {} }];
  const templateBefore = JSON.stringify(template);
  const rowsBefore = JSON.stringify(target);
  api.previewWeeklyTemplate(template, target, targetWeek, who, { selectedItemIds: template.items.map(item => item.item_id), targetDayByItemId: { [template.items[0].item_id]: 4, [template.items[1].item_id]: 4 } });
  assert.equal(JSON.stringify(template), templateBefore);
  assert.equal(JSON.stringify(target), rowsBefore);
});

test('El HTML carga CSS E39 y actualiza la versión de caché del editor', () => {
  assert.match(html, /css\/120-nutrition-week-template-change-review-e39\.css\?v=e39/);
  assert.match(html, /js\/63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /focus-visible/);
  assert.match(css, /body\.light/);
  assert.match(css, /color:#86efac/);
  assert.match(css, /color:#fcd34d/);
  assert.match(css, /body\.light \.nutrition-week-template-change-review-badge-e39\.is-add\{color:#166534\}/);
  assert.doesNotMatch(css, /white\s*!important|#fff\s*!important/i);
});

console.log(`E39 change review tests: ${testCases.length}/6 passed`);
