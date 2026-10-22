const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/113-nutrition-week-templates-e32.css'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'sql/29-nutrition-weekly-plan-templates.sql'), 'utf8');
const postcheck = fs.readFileSync(path.join(root, 'sql/30-nutrition-weekly-plan-templates-postcheck.sql'), 'utf8');
const window = { currentUser: { id: 'user-e32' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('DOM inesperado en pruebas puras'); } };
vm.runInNewContext(source, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: () => 'e32-fixed-uuid' } });
const api = window.AgendaNutritionWeeklyPlan;
assert.ok(api, 'Debe exponer la API del plan semanal');
const week = '2026-10-19';
const rows = [
  { id: 'meal-source-a', user_id: 'user-e32', week_start: week, day_offset: 0, meal_type: 'desayuno', title: 'Avena', planned_time: '08:00', notes: 'Canela aparte', source_meal_id: null, plan_key: 'manual:a', sort_order: 0, updated_at: 'v1', ingredients_snapshot: [{ name: 'Avena', quantity: 50, quantity_known: true, unit: 'g', quality: { source: 'catalog', confidence: 'high' }, nutrition_verified_at: '2026-10-01' }], nutrition_snapshot: { calories: 190, protein_g: 7, fiber_g: null, nutrition_missing_metrics: ['fiber'] } },
  { id: 'meal-source-b', user_id: 'user-e32', week_start: week, day_offset: 2, meal_type: 'cena', title: 'Sopa', planned_time: '20:00', notes: '', source_meal_id: null, plan_key: 'manual:b', sort_order: 1, updated_at: 'v2', ingredients_snapshot: [{ name: 'Zapallo', quantity: null, quantity_known: false, unit: 'g', provenance: { source: 'custom', reason: 'unknown quantity' } }], nutrition_snapshot: { calories: null, nutrition_missing_metrics: ['calories', 'protein', 'carbs', 'fat', 'fiber'] } }
];
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
const template = api.createWeeklyPlanTemplate(rows, week, 'user-e32', 'Semana de cursada', 'template-e32-001', '2026-10-21T10:00:00.000Z', (() => { let i = 0; return () => `template-item-e32-${++i}`; })());

test('Guarda una instantánea semanal con IDs nuevos y sin vincular filas de la semana origen', () => {
  assert.equal(template.name, 'Semana de cursada');
  assert.equal(template.source_week, week);
  assert.equal(template.items.length, 2);
  assert.ok(template.items.every(item => item.item_id && !('id' in item) && !('user_id' in item)));
  assert.ok(template.items.every(item => !('week_start' in item)));
});

test('Conserva nutrientes desconocidos, procedencia y calidad de los ingredientes', () => {
  assert.equal(template.items[0].ingredients_snapshot[0].quality.confidence, 'high');
  assert.equal(template.items[0].ingredients_snapshot[0].nutrition_verified_at, '2026-10-01');
  assert.equal(template.items[1].ingredients_snapshot[0].quantity, null);
  assert.equal(template.items[1].ingredients_snapshot[0].quantity_known, false);
  assert.equal(template.items[1].ingredients_snapshot[0].provenance.reason, 'unknown quantity');
  assert.deepEqual(JSON.parse(JSON.stringify(template.items[1].nutrition_snapshot.nutrition_missing_metrics)), ['calories', 'protein', 'carbs', 'fat', 'fiber']);
});

test('Rechaza semanas vacías, usuarios o fechas mezclados y nombres vacíos', () => {
  assert.throws(() => api.createWeeklyPlanTemplate([], week, 'user-e32', 'Vacía'), /no tiene comidas/);
  assert.throws(() => api.createWeeklyPlanTemplate([{ ...rows[0], user_id: 'otro-usuario' }], week, 'user-e32', 'Otra cuenta'), /cuenta y semana activa/);
  assert.throws(() => api.createWeeklyPlanTemplate(rows, '2026-10-20', 'user-e32', 'Semana inválida'), /comenzar un lunes/);
  assert.throws(() => api.createWeeklyPlanTemplate(rows, week, 'user-e32', '   '), /nombre/);
  assert.throws(() => api.createWeeklyPlanTemplate([{ ...rows[0], week_start: '2026-10-26' }], week, 'user-e32', 'Mal mezclada'), /cuenta y semana activa/);
});

test('Valida IDs y fechas al cargar plantillas guardadas', () => {
  assert.throws(() => api.normalizeWeeklyTemplates([{ ...template, id: 'bad id' }]), /identificador inválido/);
  assert.throws(() => api.normalizeWeeklyTemplates([{ ...template, source_week: '2026-10-20' }]), /semana de origen inválida/);
  assert.throws(() => api.normalizeWeeklyTemplates([{ ...template, items: [{ ...template.items[0], day_offset: 9 }] }]), /datos de comida inválidos/);
  assert.throws(() => api.normalizeWeeklyTemplates(Array.from({ length: 13 }, (_, i) => ({ ...template, id: `template-id-${i}`, name: `Plantilla ${i}` }))), /más de 12/);
});

test('Rechaza nombres repetidos de plantilla comparados sin tildes o mayúsculas (regla auxiliar del flujo)', () => {
  const names = api.normalizeWeeklyTemplates([template]).map(t => t.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR'));
  assert.ok(names.includes('semana de cursada'));
  assert.equal('Semana Ágil'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR'), 'semana agil');
});

test('Preview agrega solo a días vacíos y omite sin alterar los que ya contienen comidas', () => {
  const targetWeek = '2026-10-26';
  const targetRows = [{ id: 'target-monday', user_id: 'user-e32', week_start: targetWeek, day_offset: 0, title: 'Desayuno que ya existía', plan_key: 'manual:target', sort_order: 0 }];
  const preview = api.previewWeeklyTemplate(template, targetRows, targetWeek, 'user-e32');
  assert.equal(preview.counts.mealsToAdd, 1);
  assert.equal(preview.counts.daysToApply, 1);
  assert.equal(preview.counts.daysSkipped, 1);
  assert.equal(preview.days[0].status, 'skip');
  assert.equal(preview.days[2].status, 'add');
  assert.equal(targetRows[0].title, 'Desayuno que ya existía');
});

test('Aplicación crea payloads con claves estables, sin source IDs y con snapshots clonadas', () => {
  const targetWeek = '2026-10-26';
  const targetRows = [{ id: 'target-monday', user_id: 'user-e32', week_start: targetWeek, day_offset: 0, title: 'Desayuno existente', plan_key: 'manual:target', sort_order: 0 }];
  const preview = api.previewWeeklyTemplate(template, targetRows, targetWeek, 'user-e32');
  const payloads = api.weeklyTemplatePayloads(template, preview, targetRows, targetWeek, 'user-e32', '2026-10-21T11:00:00.000Z');
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].day_offset, 2);
  assert.equal(payloads[0].title, 'Sopa');
  assert.equal(payloads[0].source_meal_id, null);
  assert.ok(payloads[0].plan_key.startsWith('manual:week-template:template-e32-001:'));
  assert.equal(payloads[0].ingredients_snapshot[0].quantity_known, false);
  payloads[0].ingredients_snapshot[0].provenance.reason = 'mutated';
  assert.equal(template.items[1].ingredients_snapshot[0].provenance.reason, 'unknown quantity');
});

test('La firma del destino detecta cambios manuales, pero permite recuperar una operación parcialmente guardada', () => {
  const targetWeek = '2026-10-26';
  const baseRows = [{ id: 'target-monday', user_id: 'user-e32', week_start: targetWeek, day_offset: 0, title: 'Desayuno existente', plan_key: 'manual:target', sort_order: 0 }];
  const preview = api.previewWeeklyTemplate(template, baseRows, targetWeek, 'user-e32');
  const firstPayloads = api.weeklyTemplatePayloads(template, preview, baseRows, targetWeek, 'user-e32');
  const partial = [...baseRows, { ...firstPayloads[0], id: 'server-saved-item' }];
  assert.equal(api.weekRowsSignature(partial, preview.ignoredPlanKeys), preview.target_signature);
  const retryPreview = api.previewWeeklyTemplate(template, partial, targetWeek, 'user-e32');
  const retryPayloads = api.weeklyTemplatePayloads(template, retryPreview, partial, targetWeek, 'user-e32');
  assert.equal(retryPayloads.length, 0);
  const remoteEdit = [...baseRows, { ...firstPayloads[0], id: 'server-saved-item' }, { id: 'remote', user_id: 'user-e32', week_start: targetWeek, day_offset: 4, title: 'Cambio remoto', plan_key: 'manual:remote', sort_order: 0 }];
  assert.notEqual(api.weekRowsSignature(remoteEdit, preview.ignoredPlanKeys), preview.target_signature);
});

test('Una clave de plantilla encontrada en un día distinto bloquea la aplicación', () => {
  const targetWeek = '2026-10-26';
  const wrongDayRows = [{ id: 'moved', user_id: 'user-e32', week_start: targetWeek, day_offset: 5, plan_key: api.weeklyTemplatePlanKey(template.id, template.items[0].item_id), title: 'Movida manualmente' }];
  assert.throws(() => api.previewWeeklyTemplate(template, wrongDayRows, targetWeek, 'user-e32'), /ya existe en otro día/);
});

test('La migración limita tipo, cantidad y tamaño, y respeta RLS de preferencias', () => {
  assert.match(migration, /add column if not exists weekly_plan_templates jsonb not null default '\[\]'::jsonb/i);
  assert.match(migration, /jsonb_array_length\(weekly_plan_templates\) <= 12/i);
  assert.match(migration, /octet_length\(weekly_plan_templates::text\) <= 245760/i);
  assert.match(migration, /enable row level security/i);
  assert.match(postcheck, /pg_policies/i);
  assert.match(html, /113-nutrition-week-templates-e32\.css\?v=e32/);
  assert.match(html, /114-nutrition-week-template-merge-e33\.css\?v=e33/);
  assert.match(html, /63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.doesNotMatch(css, /#fff\b|white\s*!important/i);
});

console.log(`E32 pure tests: ${passed}/10 passed`);
