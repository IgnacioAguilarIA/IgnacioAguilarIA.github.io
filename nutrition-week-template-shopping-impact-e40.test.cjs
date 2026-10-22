const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const shoppingSource = fs.readFileSync(path.join(root, 'js/62-nutrition-week-planner-shopping.js'), 'utf8');
const editorSource = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/121-nutrition-week-template-shopping-impact-e40.css'), 'utf8');
const owner = 'user-e40';
const week = '2026-10-19';
let shoppingRows = [{
  id: 'shop-oats', user_id: owner, week_start: week,
  item_key: 'generated:avena||unspecified|g|quantity-known', name: 'Avena', brand: '',
  quantity: 25, quantity_known: true, unit: 'g', preparation_state: 'unspecified',
  category: 'Otros', source: 'generated', source_meals: ['previous-meal'],
  checked: true, active: true, updated_at: 'shopping-v1'
}];
const queryFor = table => {
  let filters = [];
  const matches = row => filters.every(([key, value]) => String(row[key] ?? '') === String(value ?? ''));
  const rows = () => table === 'nutrition_shopping_items' ? shoppingRows.filter(matches) : [];
  const q = {
    select() { return q; },
    eq(key, value) { filters.push([key, value]); return q; },
    order() { return q; },
    range(start, end) { return Promise.resolve({ data: rows().slice(start, end + 1).map(row => structuredClone(row)), error: null }); }
  };
  return q;
};
const window = { currentUser: { id: owner } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; } };
const context = {
  window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise,
  console, crypto: { randomUUID: () => 'e40-test-id' },
  ensureSupabase: async () => ({ from: table => queryFor(table) })
};
vm.runInNewContext(shoppingSource, context);
vm.runInNewContext(editorSource, context);
const shopping = window.AgendaNutritionPlanner;
const weekly = window.AgendaNutritionWeeklyPlan;
assert.ok(shopping?.previewPlanShoppingImpact);
assert.ok(shopping?.getShoppingListSignature);
assert.ok(weekly?.previewWeeklyTemplate);
const currentPlan = [{
  id: 'meal-current', user_id: owner, week_start: week, day_offset: 0, meal_type: 'desayuno',
  title: 'Avena actual', plan_key: 'manual:e40:current', sort_order: 0,
  ingredients_snapshot: [{ name: 'Avena', quantity: 100, quantity_known: true, unit: 'g', category: 'Otros' }], nutrition_snapshot: {}
}];
const proposed = [{
  user_id: owner, week_start: week, day_offset: 2, meal_type: 'cena', title: 'Sopa nueva',
  plan_key: 'manual:week-template:template-e40-001:item-e40-001', sort_order: 0,
  ingredients_snapshot: [
    { name: 'Avena', quantity: 50, quantity_known: true, unit: 'g', category: 'Otros' },
    { name: 'Leche', quantity: 200, quantity_known: true, unit: 'ml', category: 'Lácteos' },
    { name: 'Zapallo', quantity: null, quantity_known: false, unit: 'g', category: 'Verdulería' }
  ], nutrition_snapshot: {}
}];
(async () => {
  const impact = await shopping.previewPlanShoppingImpact(owner, week, currentPlan, proposed);
  assert.equal(impact.available, true);
  assert.equal(impact.noPlanChanges, false);
  assert.equal(impact.counts.updated, 1, 'El producto existente debe reflejar el nuevo requerimiento y vínculo de comida.');
  assert.equal(impact.counts.added, 2, 'La leche y el zapallo deben aparecer como productos nuevos.');
  assert.equal(impact.counts.purchasedConflicts, 1, 'Un producto ya comprado con cantidad diferente debe generar una advertencia.');
  assert.equal(impact.counts.unknown, 1, 'La cantidad de zapallo debe conservarse como desconocida.');
  assert.equal(impact.planDelta.added.length, 2);
  assert.equal(impact.planDelta.changed.length, 1);
  assert.equal(shoppingRows.length, 1, 'La vista previa no debe escribir ni crear productos.');
  assert.equal(shoppingRows[0].quantity, 25);
  assert.equal(shoppingRows[0].checked, true);
  const signatureBefore = await shopping.getShoppingListSignature(owner, week);
  shoppingRows[0].checked = false;
  shoppingRows[0].updated_at = 'shopping-v2';
  const signatureAfter = await shopping.getShoppingListSignature(owner, week);
  assert.notEqual(signatureAfter, signatureBefore, 'El estado de compra debe invalidar una firma anterior.');
  assert.equal(shoppingRows[0].quantity, 25, 'Leer la firma tampoco debe modificar cantidades.');
  const noOp = await shopping.previewPlanShoppingImpact(owner, week, currentPlan, []);
  assert.equal(noOp.available, true);
  assert.equal(noOp.noPlanChanges, true);
  await assert.rejects(
    () => shopping.previewPlanShoppingImpact(owner, week, [{ ...currentPlan[0], user_id: 'another-account' }], proposed),
    /cuentas o semanas diferentes/
  );
  await assert.rejects(
    () => shopping.previewPlanShoppingImpact(owner, '2026-10-20', currentPlan, proposed),
    /comenzar un lunes/
  );
  const badDuplicate = [{ ...proposed[0] }, { ...proposed[0] }];
  await assert.rejects(() => shopping.previewPlanShoppingImpact(owner, week, currentPlan, badDuplicate), /comida repetida/);
  assert.match(editorSource, /previewPlanShoppingImpact/);
  assert.match(editorSource, /getShoppingListSignature/);
  assert.match(editorSource, /La lista de compras cambió desde la vista previa/);
  assert.match(html, /css\/121-nutrition-week-template-shopping-impact-e40\.css\?v=e40/);
  assert.match(html, /js\/62-nutrition-week-planner-shopping\.js\?v=e41/);
  assert.match(html, /js\/63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /focus-visible/);
  assert.match(css, /body\.light/);
  console.log('E40 shopping-impact tests: 13/13 passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
