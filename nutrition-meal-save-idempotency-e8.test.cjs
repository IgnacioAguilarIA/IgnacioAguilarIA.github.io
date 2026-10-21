'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const helperSource = fs.readFileSync(path.join(ROOT, 'js/67-nutrition-meal-save-safety-e8.js'), 'utf8');
const inline = fs.readFileSync(path.join(ROOT, 'js/03-inline-script-03.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(ROOT, 'sql/27-nutrition-meal-save-idempotency.sql'), 'utf8');
const postcheck = fs.readFileSync(path.join(ROOT, 'sql/28-nutrition-meal-save-idempotency-postcheck.sql'), 'utf8');
function harness(initial={}) {
  const values = new Map(Object.entries(initial));
  const storage = {getItem(k){return values.has(k)?values.get(k):null},setItem(k,v){values.set(k,String(v))},removeItem(k){values.delete(k)}};
  const window = {crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'}};
  vm.runInNewContext(helperSource,{window,localStorage:storage,Uint8Array,Math,JSON,String,Number,Array,Object,RegExp,Error,encodeURIComponent});
  return {api:window.AgendaNutritionMealSaveSafety,storage,values};
}
const validRecord=(overrides={})=>({version:1,requestId:'123e4567-e89b-42d3-a456-426614174000',userId:'u1',day:2,payload:{title:'Almuerzo',meal_type:'lunch',foods:'Arroz',calories:300},structuredFoods:[{name:'Arroz',quantity:100,unit:'g'}],savedAt:'2026-10-20T10:00:00.000Z',...overrides});

test('genera una clave UUID estable para identificar el intento de guardado',()=>{
  const {api}=harness();
  assert.match(api.newRequestId(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
test('guarda y recupera el borrador por cuenta y día',()=>{
  const {api}=harness();const record=validRecord();api.savePending(record);
  assert.deepEqual(JSON.parse(JSON.stringify(api.readPending('u1',2))),record);
  assert.equal(api.readPending('u1',1),null);
  assert.equal(api.readPending('u2',2),null);
});
test('no permite sobrescribir un intento pendiente con otra clave',()=>{
  const {api}=harness();api.savePending(validRecord());
  assert.throws(()=>api.savePending(validRecord({requestId:'123e4567-e89b-42d3-a456-426614174001'})),/otro intento de guardado/i);
});
test('rechaza borrar un intento con una clave diferente',()=>{
  const {api}=harness();api.savePending(validRecord());
  assert.equal(api.clearPending('u1',2,'123e4567-e89b-42d3-a456-426614174001'),false);
  assert.ok(api.readPending('u1',2));
});
test('borra solo el intento confirmado con la misma clave',()=>{
  const {api}=harness();api.savePending(validRecord());
  assert.equal(api.clearPending('u1',2,'123e4567-e89b-42d3-a456-426614174000'),true);
  assert.equal(api.readPending('u1',2),null);
});
test('rechaza un borrador que pertenezca a otra cuenta o día',()=>{
  const {api,storage}=harness();api.savePending(validRecord());
  const key=api.storageKey('u1',2);
  const raw=JSON.parse(storage.getItem(key));raw.userId='u2';storage.setItem(key,JSON.stringify(raw));
  assert.throws(()=>api.readPending('u1',2),/no coincide con la cuenta o el día/i);
});
test('no interpreta un JSON ilegible ni lo sobrescribe silenciosamente',()=>{
  const {api,storage}=harness();storage.setItem(api.storageKey('u1',2),'{broken');
  assert.throws(()=>api.readPending('u1',2),/no se puede interpretar/i);
  assert.throws(()=>api.savePending(validRecord()),/borrador local ilegible/i);
});
test('el guardado nuevo usa el helper idempotente y no vuelve a INSERT desde la interfaz',()=>{
  assert.match(helperSource,/\.upsert\(row,\{onConflict:'user_id,save_request_id'\}\)\.select\('\*'\)\.single\(\)/);
  assert.doesNotMatch(inline,/from\('nutrition_meals'\)\.insert\(payload\)/);
  assert.match(inline,/saveSafety\.savePending/);
  assert.match(inline,/saveSafety\.upsertMeal/);
  assert.match(inline,/La cuenta activa cambió desde que abriste este formulario/);
});
test('el borrador se conserva antes de llamar a Supabase y se elimina solo al cerrar el flujo exitoso',()=>{
  const marker=inline.indexOf('saveSafety.savePending');
  const upsert=inline.indexOf('saveSafety.upsertMeal');
  const clear=inline.indexOf('clearPending(userId,draftDay,nutritionMealSaveRequestId)');
  const successClose=inline.indexOf('closeNutritionModal(true);',clear);
  assert.ok(marker>=0&&upsert>marker&&clear>upsert&&successClose>clear);
  const failureBranch=inline.slice(inline.indexOf('if(structuredSaveError)'),clear);
  assert.match(failureBranch,/return;/);
});
test('un resultado de red incierto se reintenta con la misma clave y conserva una sola fila',async()=>{
  const {api}=harness();
  const draft=validRecord();
  api.savePending(draft);
  const rows=new Map();let nextId=1;let loseFirstResponse=true;
  const client = {
    from(table) {
      assert.equal(table, 'nutrition_meals');
      return {
        upsert(row, options) {
          assert.equal(options.onConflict, 'user_id,save_request_id');
          return {
            select() {
              return {
                single: async () => {
                  const key = `${row.user_id}:${row.save_request_id}`;
                  const existing = rows.get(key);
                  const saved = { ...(existing || {}), ...row, id: existing?.id || `meal-${nextId++}` };
                  rows.set(key, saved);
                  if (loseFirstResponse) {
                    loseFirstResponse = false;
                    throw new Error('conexión interrumpida después de escribir');
                  }
                  return { data: saved, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
  await assert.rejects(api.upsertMeal(client,draft.payload,draft.userId,draft.day,draft.requestId,2),/borrador quedó conservado/i);
  assert.equal(rows.size,1,'el primer intento simulado escribió una fila aunque el cliente no recibió respuesta');
  const retry=await api.upsertMeal(client,draft.payload,draft.userId,draft.day,draft.requestId,2);
  assert.equal(rows.size,1,'el reintento debe usar la misma clave y no insertar otra fila');
  assert.equal(retry.id,'meal-1');
  assert.equal(retry.save_request_id,draft.requestId);
});

test('no se puede cerrar el diálogo mientras el guardado está en curso',()=>{
  assert.match(inline,/function closeNutritionModal\(force=false\)\{if\(nutritionMealSaveBusy&&!force\)return/);
  assert.match(inline,/closeButton\.disabled=true/);
  assert.match(inline,/cancelButton\.disabled=true/);
  assert.match(inline,/aria-busy/);
});
test('si el módulo de detalle no está cargado, no declara completa una comida parcialmente guardada',()=>{
  assert.match(inline,/if\(!window\.AgendaNutritionData\?\.persistMealItems\)\{\s*structuredSaveError=new Error/);
  assert.match(inline,/La comida principal quedó guardada, pero no se pudieron guardar sus alimentos detallados/);
  assert.match(inline,/No cierres esta ventana; revisá la conexión y volvé a guardar/);
});

test('el HTML incluye el helper E8 una única vez',()=>{
  assert.equal((html.match(/js\/67-nutrition-meal-save-safety-e8\.js/g)||[]).length,1);
});
test('la migración es aditiva, exige RLS y crea el índice único',()=>{
  assert.match(migration,/add column if not exists save_request_id uuid/i);
  assert.match(migration,/create unique index if not exists nutrition_meals_user_save_request_id_uidx/i);
  assert.match(migration,/relrowsecurity/i);
  assert.doesNotMatch(migration,/delete from public\.nutrition_meals/i);
  assert.doesNotMatch(migration,/drop table/i);
});
test('el postcheck es de solo lectura y revisa la unicidad y los permisos',()=>{
  assert.match(postcheck,/unique_idempotency_index_valid/i);
  assert.match(postcheck,/duplicate_nonnull_keys/i);
  assert.match(postcheck,/has_table_privilege\('authenticated'/i);
  assert.doesNotMatch(postcheck,/\b(insert into|update public\.|delete from|alter table|create index)\b/i);
});
