const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/118-nutrition-week-template-target-day-e37.css'), 'utf8');
const window = { currentUser: { id: 'user-e37' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('DOM inesperado en prueba pura'); } };
vm.runInNewContext(source, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: (() => { let n = 0; return () => `e37-fixed-${++n}`; })() } });
const api = window.AgendaNutritionWeeklyPlan;
assert.ok(api);
const sourceWeek = '2026-10-19', targetWeek = '2026-10-26', who = 'user-e37';
const sourceRows = [
  { id: 'source-breakfast', user_id: who, week_start: sourceWeek, day_offset: 0, meal_type: 'desayuno', title: 'Avena', planned_time: '08:00', notes: 'Canela', sort_order: 0, ingredients_snapshot: [{ name: 'Avena', quantity: 50, quantity_known: true, unit: 'g', quality: { confidence: 'high' } }], nutrition_snapshot: { calories: 190, protein_g: 7, fiber_g: null, nutrition_missing_metrics: ['fiber'] } },
  { id: 'source-dinner', user_id: who, week_start: sourceWeek, day_offset: 2, meal_type: 'cena', title: 'Sopa', planned_time: '20:00', notes: '', sort_order: 0, ingredients_snapshot: [{ name: 'Zapallo', quantity: null, quantity_known: false, unit: 'g', provenance: { source: 'custom' } }], nutrition_snapshot: { calories: null, nutrition_missing_metrics: ['calories', 'protein', 'carbs', 'fat', 'fiber'] } }
];
const template = api.createWeeklyPlanTemplate(sourceRows, sourceWeek, who, 'Semana flexible', 'template-e37-001', '2026-10-21T10:00:00.000Z', (() => { let n = 0; return () => `template-item-e37-${++n}`; })());
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

test('La vista previa permite reubicar comidas seleccionadas a otros días', () => {
  const selection = template.items.map(item => item.item_id);
  const overrides = { [template.items[0].item_id]: 4, [template.items[1].item_id]: 1 };
  const preview = api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: selection, targetDayByItemId: overrides });
  assert.equal(preview.counts.mealsToAdd, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.target_day_overrides)), overrides);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.day_moves)), [
    { item_id: template.items[0].item_id, title: 'Avena', from_day: 0, to_day: 4 },
    { item_id: template.items[1].item_id, title: 'Sopa', from_day: 2, to_day: 1 }
  ]);
  assert.equal(preview.days.find(day => day.day === 4).items[0].title, 'Avena');
  assert.equal(preview.days.find(day => day.day === 1).items[0].title, 'Sopa');
});

test('Los payloads guardan el día de destino personalizado y conservan los snapshots', () => {
  const selection = template.items.map(item => item.item_id);
  const preview = api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: selection, targetDayByItemId: { [template.items[0].item_id]: 4, [template.items[1].item_id]: 1 } });
  const payloads = api.weeklyTemplatePayloads(template, preview, [], targetWeek, who, '2026-10-21T11:00:00.000Z');
  assert.equal(payloads.length, 2);
  const oatmeal = payloads.find(row => row.title === 'Avena');
  const soup = payloads.find(row => row.title === 'Sopa');
  assert.equal(oatmeal.day_offset, 4);
  assert.equal(soup.day_offset, 1);
  assert.equal(oatmeal.ingredients_snapshot[0].quality.confidence, 'high');
  assert.equal(soup.ingredients_snapshot[0].quantity_known, false);
  assert.equal(soup.ingredients_snapshot[0].provenance.source, 'custom');
  assert.equal(oatmeal.source_meal_id, null);
  assert.notEqual(oatmeal.plan_key, soup.plan_key);
});

test('Si se reubica una comida a un día ocupado, se combina sin borrar la comida existente', () => {
  const existing = { id: 'existing-friday', user_id: who, week_start: targetWeek, day_offset: 4, meal_type: 'almuerzo', title: 'Almuerzo propio', plan_key: 'manual:existing-friday', sort_order: 5, ingredients_snapshot: [], nutrition_snapshot: {} };
  const preview = api.previewWeeklyTemplate(template, [existing], targetWeek, who, { selectedItemIds: [template.items[0].item_id], targetDayByItemId: { [template.items[0].item_id]: 4 } });
  assert.equal(preview.days.find(day => day.day === 4).status, 'merge');
  const before = JSON.stringify(existing);
  const payloads = api.weeklyTemplatePayloads(template, preview, [existing], targetWeek, who);
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].day_offset, 4);
  assert.ok(payloads[0].sort_order > existing.sort_order);
  assert.equal(JSON.stringify(existing), before);
});

test('Rechaza días fuera del rango y overrides para comidas no seleccionadas', () => {
  assert.throws(() => api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: [template.items[0].item_id], targetDayByItemId: { [template.items[0].item_id]: 7 } }), /día de destino válido/);
  assert.throws(() => api.previewWeeklyTemplate(template, [], targetWeek, who, { selectedItemIds: [template.items[0].item_id], targetDayByItemId: { [template.items[1].item_id]: 4 } }), /no está seleccionada/);
  assert.throws(() => api.previewWeeklyTemplate(template, [], targetWeek, who, { targetDayByItemId: { [template.items[0].item_id]: 4 } }), /requiere seleccionar/);
});

test('Una comida ya copiada a otro día no se mueve silenciosamente al cambiar su destino', () => {
  const item = template.items[0];
  const previouslyApplied = { id: 'previous-copy', user_id: who, week_start: targetWeek, day_offset: 0, meal_type: item.meal_type, title: item.title, plan_key: api.weeklyTemplatePlanKey(template.id, item.item_id), sort_order: 0, ingredients_snapshot: item.ingredients_snapshot, nutrition_snapshot: item.nutrition_snapshot };
  assert.throws(() => api.previewWeeklyTemplate(template, [previouslyApplied], targetWeek, who, { selectedItemIds: [item.item_id], targetDayByItemId: { [item.item_id]: 4 } }), /ya existe en otro día/);
});

test('El HTML carga la versión E37 y el CSS mantiene controles accesibles y adaptables', () => {
  assert.match(html, /css\/118-nutrition-week-template-target-day-e37\.css\?v=e37/);
  assert.match(html, /js\/63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media\(max-width:620px\)/);
});
console.log(`E37 custom target day tests: ${passed}/6 passed`);
