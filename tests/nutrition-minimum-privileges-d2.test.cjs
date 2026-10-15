const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'sql/14-nutrition-minimum-privileges.sql'), 'utf8');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('la migración es transaccional y falla antes de cambiar permisos si falta el esquema/policy', () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /\$preflight\$/);
  assert.match(sql, /to_regclass/);
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /No se cambió ningún privilegio/);
  assert.match(sql, /^COMMIT;\s*$/m);
});

test('revoca privilegios existentes, también los heredados por PUBLIC y anon', () => {
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.food_catalog\s+FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated;/);
});

test('el catálogo solo concede lectura a authenticated', () => {
  assert.match(sql, /GRANT SELECT ON TABLE public\.food_catalog TO authenticated;/);
  assert.doesNotMatch(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE\s+public\.food_catalog/i);
});

test('las tablas personales conceden solo CRUD', () => {
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*?nutrition_consumption_history\s+TO authenticated;/);
  assert.match(sql, /ARRAY\['TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'\]/);
});

test('no revoca ni modifica los privilegios directos de service_role', () => {
  assert.doesNotMatch(sql, /REVOKE[^;]*service_role/i);
  assert.doesNotMatch(sql, /GRANT[^;]*service_role/i);
});

test('verifica los privilegios efectivos y fuerza rollback si persiste un privilegio excesivo', () => {
  assert.match(sql, /has_table_privilege\('authenticated'/);
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /D2 falló verificación/);
});

test('no cambia filas ni elimina policies, funciones, tablas o índices', () => {
  assert.doesNotMatch(sql, /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE POLICY|DROP POLICY|CREATE TABLE|DROP TABLE|TRUNCATE)\b/im);
  assert.doesNotMatch(sql, /DELETE FROM|UPDATE public\.|INSERT INTO public\./i);
});

for (const t of tests) { t.fn(); console.log(`OK - ${t.name}`); }
console.log(`Privilegios mínimos D2: ${tests.length} pruebas estáticas aprobadas.`);
