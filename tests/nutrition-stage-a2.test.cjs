'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(ROOT, 'sql/10-nutrition-supabase-findings-fix.sql'), 'utf8');
const audit = fs.readFileSync(path.join(ROOT, 'sql/11-nutrition-integrity-audit-readonly.sql'), 'utf8');

test('la migración prevalidada no modifica filas de usuario', () => {
  assert.match(migration, /begin;/i);
  assert.match(migration, /\$preflight\$/i);
  assert.match(migration, /No se aplicó la Etapa A2/i);
  assert.doesNotMatch(migration, /^\s*(insert into|update public\.|delete from|truncate)\b/im);
  assert.doesNotMatch(migration, /force row level security/i);
});

test('reduce grants de anon/PUBLIC y conserva permisos explícitos de la app y service_role', () => {
  assert.match(migration, /revoke all privileges on table public\.food_catalog from public, anon, authenticated/i);
  assert.match(migration, /grant select on table public\.food_catalog to authenticated/i);
  assert.match(migration, /revoke all privileges on table public\.nutrition_meals from public, anon/i);
  assert.match(migration, /to authenticated/i);
  assert.match(migration, /to service_role/i);
});

test('solo elimina guards redundantes si son idénticos a su policy canónica', () => {
  assert.match(migration, /not exists\s*\(\s*select 1 from pg_policies c/i);
  assert.match(migration, /c\.qual is not distinct from d\.qual/i);
  assert.match(migration, /c\.with_check is not distinct from d\.with_check/i);
  assert.match(migration, /drop policy if exists "nutrition_meal_items_account_scope_guard"/i);
});

test('la nueva policy valida que user_food_id pertenezca a la cuenta autenticada', () => {
  assert.match(migration, /nutrition_meal_items_user_food_owner_insert_guard/i);
  assert.match(migration, /nutrition_meal_items_user_food_owner_update_guard/i);
  assert.match(migration, /f\.id = nutrition_meal_items\.user_food_id/i);
  assert.match(migration, /f\.user_id = auth\.uid\(\)/i);
});

test('el informe de integridad es de solo lectura y devuelve solo contadores de anomalías', () => {
  assert.match(audit, /nutrition_meal_items\.missing_parent/i);
  assert.match(audit, /parent_owned_by_other_account/i);
  assert.match(audit, /user_food_owned_by_other_account/i);
  assert.match(audit, /duplicate_key_count/i);
  assert.doesNotMatch(audit, /^\s*(insert into|update public\.|delete from|truncate|alter table|create policy|drop policy)\b/im);
});


test('el preflight evita la ambigüedad PL/pgSQL entre variable y columna cmd', () => {
  assert.match(migration, /v_cmd text/i);
  assert.match(migration, /foreach v_cmd in array/i);
  assert.match(migration, /p\.cmd in \(v_cmd, 'ALL'\)/i);
  assert.doesNotMatch(migration, /^\s*cmd text\s*;/im);
});

test('el preflight trata food_catalog como catálogo de solo lectura', () => {
  assert.match(migration, /if t <> 'food_catalog' then[\s\S]*?foreach v_cmd in array array\['SELECT','INSERT','UPDATE','DELETE'\]/i);
  assert.match(migration, /p\.tablename='food_catalog'[\s\S]*?p\.cmd in \('SELECT','ALL'\)/i);
});
