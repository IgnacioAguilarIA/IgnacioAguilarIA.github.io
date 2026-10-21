'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const helper = read('js/67-nutrition-meal-save-safety-e8.js');
const persistence = read('js/49-nutrition-persistence.js');
const inline = read('js/03-inline-script-03.js');
const copy = read('js/53-nutrition-meal-copy.js');
const routine = read('js/59-nutrition-routine-tools.js');
const html = read('index.html');
const ID1 = '123e4567-e89b-42d3-a456-426614174000';
const ID2 = '123e4567-e89b-42d3-a456-426614174001';
function helperHarness() {
  const values = new Map();
  const storage = { getItem(k) { return values.has(k) ? values.get(k) : null; }, setItem(k, v) { values.set(k, String(v)); }, removeItem(k) { values.delete(k); } };
  let idIndex = 0;
  const ids = [ID1, ID2, '223e4567-e89b-42d3-a456-426614174002'];
  const window = { crypto: { randomUUID() { const id = ids[idIndex % ids.length]; idIndex++; return id; } } };
  vm.runInNewContext(helper, { window, localStorage: storage, Uint8Array, Math, JSON, String, Number, Array, Object, RegExp, Error, encodeURIComponent, Date, Set });
  return { api: window.AgendaNutritionMealSaveSafety, storage, values };
}
function operation(overrides={}) {
  return { version: 1, operationId: ID1, operationType: 'repeat-day', userId: 'u1', scope: '0:1', createdAt: '2026-10-20T12:00:00.000Z', payload: { sourceDay: 0, targetDay: 1, entries: [{ requestId: ID2, destinationPayload: { title: 'Almuerzo', day: 1 }, sourceItems: [] }] }, ...overrides };
}

test('el diario E9 guarda y recupera un lote por cuenta y tipo de operación', () => {
  const { api } = helperHarness(); const record = operation();
  assert.equal(api.saveOperation(record), true);
  assert.deepEqual(JSON.parse(JSON.stringify(api.readOperation('u1', 'repeat-day'))), record);
  assert.equal(api.readOperation('u2', 'repeat-day'), null);
  assert.equal(api.readOperation('u1', 'duplicate-meal'), null);
});
test('el diario rechaza reanudar un lote con ámbito diferente', () => {
  const { api } = helperHarness(); api.saveOperation(operation());
  assert.throws(() => api.readOperation('u1', 'repeat-day', '0:2'), /otra operación.*pendiente/i);
});
test('el diario no permite sobrescribir una operación pendiente con otra clave', () => {
  const { api } = helperHarness(); api.saveOperation(operation());
  assert.throws(() => api.saveOperation(operation({ operationId: ID2 })), /otra operación pendiente/i);
});
test('solo se elimina del diario la operación identificada por la misma clave', () => {
  const { api } = helperHarness(); api.saveOperation(operation());
  assert.equal(api.clearOperation('u1', 'repeat-day', ID2), false);
  assert.ok(api.readOperation('u1', 'repeat-day'));
  assert.equal(api.clearOperation('u1', 'repeat-day', ID1), true);
  assert.equal(api.readOperation('u1', 'repeat-day'), null);
});
test('una instantánea multi-paso ilegible no se sobrescribe', () => {
  const { api, storage } = helperHarness();
  storage.setItem(api.operationStorageKey('u1', 'repeat-day'), '{malformed');
  assert.throws(() => api.readOperation('u1', 'repeat-day'), /ilegible/i);
  assert.throws(() => api.saveOperation(operation()), /ilegible/i);
});
test('la persistencia de alimentos detallados exige cuenta activa, comida y lista válida', () => {
  assert.match(persistence, /function persistMealItems\(mealId,items,expectedUid=null\)/);
  assert.match(persistence, /No hay una cuenta activa para guardar los alimentos detallados/);
  assert.match(persistence, /La cuenta activa cambió antes de guardar los alimentos detallados/);
  assert.match(persistence, /Falta el identificador de la comida/);
  assert.match(persistence, /La lista de alimentos detallados no es válida/);
  assert.doesNotMatch(persistence.slice(persistence.indexOf('function persistMealItems(mealId'), persistence.indexOf('async function persistMealItemsUnlocked')), /skipped:true/);
});
test('el guardado inicial pasa explícitamente la cuenta capturada al módulo de detalles', () => {
  assert.match(inline, /persistMealItems\(savedMealId,structuredFoods,userId\)/);
});
test('la persistencia real rechaza una cuenta ausente o cambiada antes de consultar Supabase', async () => {
  const listeners = [];
  const fakeDocument = { readyState: 'loading', addEventListener(name, fn) { listeners.push([name, fn]); }, getElementById() { return null; }, dispatchEvent() {} };
  const window = {};
  const context = { window, document: fakeDocument, currentUser: null, console, CustomEvent: function(name, options) { this.type = name; this.detail = options?.detail; }, Map, Set, Promise, String, Number, Object, Array, Math, JSON, RegExp, Error, Intl, Date };
  vm.runInNewContext(persistence, context, { filename: '49-nutrition-persistence.js' });
  assert.throws(() => window.AgendaNutritionData.persistMealItems('meal-1', [], 'u1'), /cuenta activa cambió/i);
  context.currentUser = { id: 'u2' };
  assert.throws(() => window.AgendaNutritionData.persistMealItems('meal-1', [], 'u1'), /cuenta activa cambió/i);
  assert.throws(() => window.AgendaNutritionData.persistMealItems('', [], 'u2'), /identificador de la comida/i);
  assert.throws(() => window.AgendaNutritionData.persistMealItems('meal-1', null, 'u2'), /lista de alimentos detallados no es válida/i);
});
test('la copia individual guarda un diario antes de escribir y utiliza upsert idempotente', () => {
  assert.match(copy, /operationType:'duplicate-meal'/);
  assert.match(copy, /safety\.saveOperation\(operation\)/);
  assert.match(copy, /safety\.upsertMeal\(sb,destination,owner/);
  assert.match(copy, /persistMealItems\(newId,copied,owner\)/);
  assert.match(copy, /safety\.clearOperation\(owner,'duplicate-meal',operation\.operationId\)/);
  assert.doesNotMatch(copy, /from\('nutrition_meals'\)\.insert\(payload\)/);
  assert.doesNotMatch(copy, /delete_nutrition_meal_and_items/);
});
test('si falla refrescar la vista después de duplicar, no informa falsamente que falló el guardado confirmado', () => {
  const success = copy.indexOf("if(!safety.clearOperation(owner,'duplicate-meal',operation.operationId))");
  const close = copy.indexOf('closeModal();', success);
  const refreshTry = copy.indexOf('try{', close);
  assert.ok(success >= 0 && close > success && refreshTry > close);
  assert.match(copy.slice(refreshTry, copy.indexOf('}catch(err){', refreshTry)), /La comida se duplicó correctamente/);
});

test('repetir un día guarda el lote antes de escribir y no borra copias ante una respuesta incierta', () => {
  const block = routine.slice(routine.indexOf('async function runCopyDay(overlay,close){'), routine.indexOf('function dateKeyArgentina(date=new Date()){'));
  assert.match(block, /operationType:'repeat-day'/);
  assert.match(block, /safety\.saveOperation\(operation\)/);
  assert.match(block, /safety\.upsertMeal\(c,destination,owner/);
  assert.match(block, /persistMealItems\(entry\.destinationMealId,copied,owner\)/);
  assert.match(block, /safety\.clearOperation\(owner,'repeat-day',operation\.operationId\)/);
  assert.doesNotMatch(block, /delete_nutrition_meal_and_items/);
});
test('al reabrir repetir día se recupera el origen y destino del diario local', () => {
  assert.match(routine, /readOperation\(owner,'repeat-day'\)/);
  assert.match(routine, /pending\.payload\?\.sourceDay/);
  assert.match(routine, /pending\.payload\?\.targetDay/);
  assert.match(routine, /Reanudar copia/);
});
test('deshacer eliminación usa IDs estables y verifica registros existentes antes de insertar los faltantes', () => {
  assert.match(routine, /upsert\(mealPayload,\{onConflict:'id'\}\)/);
  assert.match(routine, /select\('\*'\)\.eq\('user_id',snapshot\.owner\)\.in\('id',ids\)/);
  assert.match(routine, /from\('nutrition_meal_items'\)\.insert\(missing\)/);
  assert.match(routine, /rowMatchesSnapshot\(existing/);
  assert.doesNotMatch(routine.slice(routine.indexOf('async function restoreLastDeletion(){'), routine.indexOf('function installDeleteUndo(){')), /delete_nutrition_meal_and_items/);
});
test('los módulos E9 siguen cargados en Alimentación sin cargar un segundo helper E8', () => {
  assert.equal((html.match(/js\/67-nutrition-meal-save-safety-e8\.js/g)||[]).length, 1);
  assert.match(html, /js\/53-nutrition-meal-copy\.js/);
  assert.match(html, /js\/59-nutrition-routine-tools\.js/);
});
test('E9 no introduce otra migración SQL ni modifica el esquema de la restauración E8', () => {
  assert.match(read('README-ETAPA-E9.md'), /no requiere una migración SQL nueva/i);
  assert.match(read('sql/27-nutrition-meal-save-idempotency.sql'), /save_request_id/i);
});
console.log('E9 integrated reliability checks completed.');
