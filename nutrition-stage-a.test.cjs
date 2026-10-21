'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const persistenceSource = fs.readFileSync(path.join(ROOT, 'js/49-nutrition-persistence.js'), 'utf8');

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function makeHarness({ readDelay = 0 } = {}) {
  const state = {
    rows: [],
    tableRows: { user_foods: [{ id: 'food-a', user_id: 'user-a', source: 'external', external_id: 'oats-1', fingerprint: 'external:oats-1', name: 'Avena integral', brand: 'Marca A', unit: 'g', calories_per_100g: 380 }], food_catalog: [] },
    operations: [],
    nextId: 1,
    activeReads: 0,
    maxActiveReads: 0,
    failNextInsert: false
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.action = 'select';
      this.filters = [];
      this.payload = null;
      this.orders = [];
      this.selection = '*';
      this.limitValue = null;
    }
    select(columns = '*') { this.selection = columns; return this; }
    eq(column, value) { this.filters.push(row => String(row[column] ?? '') === String(value ?? '')); return this; }
    in(column, values) { const allowed = new Set((values || []).map(String)); this.filters.push(row => allowed.has(String(row[column] ?? ''))); return this; }
    gte(column, value) { this.filters.push(row => String(row[column] ?? '') >= String(value)); return this; }
    lte(column, value) { this.filters.push(row => String(row[column] ?? '') <= String(value)); return this; }
    ilike() { return this; }
    order(column, options = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this; }
    limit(value) { this.limitValue = value; return this; }
    insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
    upsert(payload) { this.action = 'upsert'; this.payload = payload; return this; }
    update(payload) { this.action = 'update'; this.payload = payload; return this; }
    delete() { this.action = 'delete'; return this; }
    single() { return this.execute().then(result => ({ data: Array.isArray(result.data) ? result.data[0] : result.data, error: result.error })); }
    maybeSingle() { return this.single(); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }

    async execute() {
      const operation = this.action;
      state.operations.push({ table: this.table, action: operation, filters: this.filters.length });
      const isRead = operation === 'select';
      if (isRead) {
        state.activeReads += 1;
        state.maxActiveReads = Math.max(state.maxActiveReads, state.activeReads);
      }
      try {
        if (isRead && readDelay) await delay(readDelay);
        const sourceRows = this.table === 'nutrition_meal_items' ? state.rows : (state.tableRows[this.table] || []);
        let found = sourceRows.filter(row => this.filters.every(filter => filter(row)));
        if (operation === 'select') {
          for (const order of [...this.orders].reverse()) {
            found = found.slice().sort((a, b) => {
              const cmp = String(a[order.column] ?? '').localeCompare(String(b[order.column] ?? ''));
              return order.ascending ? cmp : -cmp;
            });
          }
          if (this.limitValue != null) found = found.slice(0, this.limitValue);
          return { data: found.map(row => ({ ...row })), error: null };
        }
        if (operation === 'insert' || operation === 'upsert') {
          if (state.failNextInsert) {
            state.failNextInsert = false;
            return { data: null, error: new Error('simulated insert failure') };
          }
          const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
          const created = incoming.map(row => ({
            ...row,
            id: `item-${state.nextId++}`,
            created_at: new Date(1700000000000 + state.nextId * 1000).toISOString()
          }));
          if (this.table === 'nutrition_meal_items') state.rows.push(...created);
          else { state.tableRows[this.table] = state.tableRows[this.table] || []; state.tableRows[this.table].push(...created); }
          return { data: created.map(row => ({ ...row })), error: null };
        }
        if (operation === 'update') {
          for (const row of found) Object.assign(row, this.payload);
          return { data: found.map(row => ({ ...row })), error: null };
        }
        if (operation === 'delete') {
          const removed = sourceRows.filter(row => this.filters.every(filter => filter(row)));
          const keep = sourceRows.filter(row => !this.filters.every(filter => filter(row)));
          const removedCount = sourceRows.length - keep.length;
          if (this.table === 'nutrition_meal_items') state.rows = keep;
          else state.tableRows[this.table] = keep;
          return { data: removed.map(row => ({ ...row })), error: null, count: removedCount };
        }
        return { data: [], error: null };
      } finally {
        if (isRead) state.activeReads -= 1;
      }
    }
  }

  const document = {
    readyState: 'complete',
    events: [],
    getElementById() { return null; },
    addEventListener() {},
    dispatchEvent(event) { this.events.push(event); return true; }
  };
  class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; } }

  const ctx = {
    console,
    document,
    CustomEvent,
    currentUser: { id: 'user-a' },
    ensureSupabase: async () => ({ from: table => new Query(table) }),
    window: {},
    Intl,
    Date,
    Map,
    Set,
    Promise,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    JSON,
    RegExp,
    Error
  };
  vm.createContext(ctx);
  vm.runInContext(persistenceSource, ctx, { filename: '49-nutrition-persistence.js' });
  return { ctx, state, api: ctx.window.AgendaNutritionData };
}

function food(quantity) {
  return {
    source: 'external', external_id: 'food-1', name: 'Avena', brand: 'Marca',
    quantity, unit: 'g', calories_per_100g: 380, protein_per_100g: 13,
    carbs_per_100g: 67, fat_per_100g: 7, fiber_per_100g: 10
  };
}

test('serializa dos guardados de detalle para la misma comida y no duplica filas', async () => {
  const { api, state } = makeHarness({ readDelay: 15 });
  const [first, second] = await Promise.all([
    api.persistMealItems('meal-1', [food(100)]),
    api.persistMealItems('meal-1', [food(250)])
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(state.rows.length, 1);
  assert.equal(state.rows[0].quantity, 250);
  assert.equal(state.rows[0].user_id, 'user-a');
  assert.equal(state.rows[0].meal_id, 'meal-1');
  assert.equal(state.maxActiveReads, 1, 'las lecturas de la misma cola no deben solaparse');
});

test('aborta después de un cambio de cuenta y no escribe en la cuenta nueva', async () => {
  const { ctx, api, state } = makeHarness({ readDelay: 30 });
  const save = api.persistMealItems('meal-1', [food(100)]);
  await delay(5);
  ctx.currentUser = { id: 'user-b' };

  await assert.rejects(save, /cuenta activa cambió/i);
  assert.equal(state.rows.length, 0, 'no debe insertar detalles después del cambio de cuenta');
  assert.equal(state.operations.some(op => op.action === 'insert' || op.action === 'update' || op.action === 'delete'), false);
});

test('un fallo de inserción no deja una fila nueva parcialmente persistida', async () => {
  const { api, state } = makeHarness();
  state.failNextInsert = true;
  await assert.rejects(api.persistMealItems('meal-1', [food(100)]), /simulated insert failure/);
  assert.equal(state.rows.length, 0);
});


test('el buscador no devuelve alimentos de una cuenta anterior si cambia la sesión durante la búsqueda externa', async () => {
  const { ctx, api } = makeHarness({ readDelay: 2 });
  let markExternalStarted;
  let resolveExternal;
  const externalStarted = new Promise(resolve => { markExternalStarted = resolve; });
  const externalResponse = new Promise(resolve => { resolveExternal = resolve; });
  const search = api.searchWithLocalFirst('avena', async () => {
    markExternalStarted();
    return externalResponse;
  });

  await externalStarted;
  ctx.currentUser = { id: 'user-b' };
  resolveExternal([{ id: 'external-oat', name: 'Avena online', brand: 'Marca externa' }]);
  await assert.rejects(search, /cuenta activa cambió/i);
});

test('la migración preserva policies permisivas, valida el esquema y elimina comida/detalles mediante RPC', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'sql/08-nutrition-production-hardening.sql'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/03-inline-script-03.js'), 'utf8');
  assert.match(sql, /missing_permissive/);
  assert.match(sql, /missing_columns/);
  assert.match(sql, /nutrition_meals_account_scope_restrictive_guard/);
  assert.doesNotMatch(sql, /drop policy if exists "nutrition_meals_account_scope_guard" on public\.nutrition_meals/i,
    'no debe eliminarse la policy permisiva original');
  assert.match(sql, /create or replace function public\.delete_nutrition_meal_and_items/i);
  const detailDelete = sql.indexOf('delete from public.nutrition_meal_items as i');
  const mealDelete = sql.indexOf('delete from public.nutrition_meals as m', detailDelete);
  assert.ok(detailDelete >= 0 && mealDelete > detailDelete, 'los detalles se borran antes de la comida dentro de la misma función');
  assert.match(app, /rpc\('delete_nutrition_meal_and_items'/);
});

test('la exportación completa no descarga un archivo cuando falla alguna tabla nutricional', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/04-inline-script-04.js'), 'utf8');
  const abortAt = source.indexOf('if(warnings.length){\n      const message=\'No generé la copia');
  const downloadAt = source.indexOf('new Blob([JSON.stringify(payload,null,2)]', abortAt);
  assert.ok(abortAt >= 0 && downloadAt > abortAt, 'debe existir una salida preventiva antes de crear el archivo');
  assert.match(source.slice(abortAt, downloadAt), /return;/);
});

test('Mis alimentos solo carga registros de la cuenta activa y expone el id real para editar', async () => {
  const { api, state } = makeHarness();
  state.tableRows.user_foods.push({ id: 'food-b', user_id: 'user-b', source: 'custom', external_id: 'custom-other', fingerprint: 'custom:custom-other', name: 'Alimento ajeno', calories_per_100g: 900 });
  const foods = await api.loadUserFoods();
  assert.equal(foods.length, 1);
  assert.equal(foods[0].name, 'Avena integral');
  assert.equal(foods[0].userFoodId, 'food-a');
  assert.equal(foods[0].recordSource, 'external');
});

test('editar un alimento personalizado actualiza la fila propia en lugar de insertar un duplicado', async () => {
  const { api, state } = makeHarness();
  const existing = state.tableRows.user_foods[0];
  const result = await api.saveUserFood({
    userFoodId: existing.id, userFood_id: existing.id,
    sourceType: existing.source, externalId: existing.external_id, fingerprint: existing.fingerprint,
    name: 'Avena integral editada', brand: existing.brand, calories: 370, protein: 12,
    carbs: 65, fat: 6, fiber: 9, unit: 'g', servingQuantity: 80, isGeneric: false
  });
  assert.equal(result.ok, true);
  assert.equal(state.tableRows.user_foods.length, 1);
  assert.equal(state.tableRows.user_foods[0].id, 'food-a');
  assert.equal(state.tableRows.user_foods[0].name, 'Avena integral editada');
  assert.equal(state.tableRows.user_foods[0].calories_per_100g, 370);
});

test('el intento de editar o borrar un alimento de otra cuenta no modifica sus datos', async () => {
  const { api, state } = makeHarness();
  state.tableRows.user_foods.push({ id: 'food-b', user_id: 'user-b', source: 'custom', external_id: 'other', fingerprint: 'custom:other', name: 'Ajeno', calories_per_100g: 900 });
  await assert.rejects(api.saveUserFood({ userFoodId: 'food-b', name: 'Manipulado', calories: 1 }), /no se encontró ese alimento/i);
  await assert.rejects(api.deleteUserFood('food-b'), /not found|No se pudo|error/i);
  assert.equal(state.tableRows.user_foods.find(row => row.id === 'food-b').name, 'Ajeno');
});

test('el módulo avanzado habilita edición de recetas y edición de alimentos propios sin migración nueva', () => {
  const advanced = fs.readFileSync(path.join(ROOT, 'js/58-nutrition-advanced.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const persistence = fs.readFileSync(path.join(ROOT, 'js/49-nutrition-persistence.js'), 'utf8');
  assert.match(app, /nutritionManageCustomFoodsBtn/);
  assert.match(advanced, /data-recipe-edit/);
  assert.match(advanced, /data-recipe-ingredient-qty/);
  assert.match(advanced, /nutritionRecipeIngredientSearchBtn/);
  assert.match(persistence, /async function loadUserFoods/);
  assert.match(persistence, /async function deleteUserFood/);
  assert.match(persistence, /\.eq\('id',userFoodId\)\.eq\('user_id',uid\)/);
});

test('editar una receta actualiza su fila y recalcula los valores por 100 g', async () => {
  const { api, state } = makeHarness();
  state.tableRows.nutrition_recipes = [{
    id: 'recipe-a', user_id: 'user-a', name: 'Avena original', notes: '', servings: 1,
    ingredients: [], total_weight_g: 100, calories_per_100g: 100,
    protein_per_100g: 5, carbs_per_100g: 10, fat_per_100g: 2, fiber_per_100g: 1
  }];
  const result = await api.saveRecipe({
    id: 'recipe-a', name: 'Avena editada', notes: 'Con fruta', servings: 2,
    ingredients: [{ name: 'Avena', quantity: 200, unit: 'g', calories_per_100g: 380,
      protein_per_100g: 13, carbs_per_100g: 67, fat_per_100g: 7, fiber_per_100g: 10 }]
  });
  assert.equal(result.ok, true);
  assert.equal(state.tableRows.nutrition_recipes.length, 1);
  assert.equal(state.tableRows.nutrition_recipes[0].name, 'Avena editada');
  assert.equal(state.tableRows.nutrition_recipes[0].total_weight_g, 200);
  assert.equal(state.tableRows.nutrition_recipes[0].calories_per_100g, 380);
  assert.equal(state.tableRows.nutrition_recipes[0].servings, 2);
});
