'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const importer = fs.readFileSync(path.join(ROOT, 'js/03-inline-script-03.js'), 'utf8');

test('valida formato y versión del respaldo cuando Alimentación está seleccionada', () => {
  assert.match(importer, /if\(selected\.meals\)\{\s*const hasFormat=has\('backup_format'\),hasVersion=has\('backup_version'\)/);
  assert.match(importer, /parsed\.backup_format!=='agenda-fich-full-backup'/);
  assert.match(importer, /version<1\|\|version>3/);
  assert.match(importer, /requiredNutritionArrays=\['nutrition_meals','nutrition_meal_items','user_foods','nutrition_recipes','nutrition_consumption_history','nutrition_preferences'\]/);
  assert.match(importer, /falta la configuración local de Alimentación/);
});

test('la confirmación muestra un resumen nutricional y bloquea el reemplazo de copias incompletas', () => {
  assert.match(importer, /Contenido de Alimentación:/);
  for (const label of ['Comidas:', 'Alimentos detallados:', 'Alimentos personales:', 'Recetas:', 'Registros históricos:', 'Preferencias:']) {
    assert.ok(importer.includes(label), `la vista previa debe incluir ${label}`);
  }
  assert.match(importer, /const replace=confirm\(selected\.meals\?nutritionRestorePrompt:legacyImportPrompt\)/);
  const confirmAt = importer.indexOf('const replace=confirm(selected.meals?nutritionRestorePrompt:legacyImportPrompt)');
  const incompleteGuardAt = importer.indexOf('if(replace&&selected.meals&&missingNutritionArrays.length)');
  const importStart = importer.indexOf('async function importMyData(');
  const firstWriteAt = importer.indexOf('for(const table of tables)', importStart);
  assert.ok(confirmAt >= 0 && incompleteGuardAt > confirmAt, 'la verificación se aplica después de elegir reemplazo/agregar');
  assert.ok(firstWriteAt < 0 || incompleteGuardAt < firstWriteAt, 'la guardia debe ocurrir antes de cualquier limpieza');
});

test('carga el historial importado antes de limpiar las filas históricas originales', () => {
  const historyInsertAt = importer.indexOf('const rows=historyIn.map(item=>');
  const cleanupAt = importer.indexOf('if(replace&&selected.meals){', importer.indexOf('let importedPrefs=0;'));
  assert.ok(historyInsertAt >= 0 && cleanupAt > historyInsertAt, 'no debe borrarse el historial anterior antes de insertar el nuevo');
  const cleanupEnd = importer.indexOf('if(localNutritionIn){', cleanupAt);
  const cleanup = importer.slice(cleanupAt, cleanupEnd);
  assert.match(cleanup, /oldNutritionHistoryIds\.slice\(i,i\+100\)/);
  assert.match(cleanup, /\.delete\(\)\.eq\('user_id',importNutritionUserId\)\.in\('id',chunk\)/);
  assert.doesNotMatch(cleanup, /from\('nutrition_consumption_history'\)\.delete\(\)\.eq\('user_id',importNutritionUserId\);/);
});

test('la exportación siempre serializa la cola pendiente como objeto', () => {
  const exporter = fs.readFileSync(path.join(ROOT, 'js/04-inline-script-04.js'), 'utf8');
  assert.match(exporter, /const pendingStored=readLocalJSON\(`agendaNutritionPendingConsumption:\$\{exportUserId\}`,\{\}\)/);
  assert.match(exporter, /const pendingConsumption=pendingStored&&typeof pendingStored==='object'&&!Array\.isArray\(pendingStored\)\?pendingStored:\{\}/);
  assert.match(exporter, /backup_format:'agenda-fich-full-backup',backup_version:3/);
});

test('la importación restaura consumos pendientes con los IDs nuevos de detalle y comida', () => {
  assert.match(importer, /pendingInput=localNutritionIn\.pending_consumption/);
  assert.match(importer, /nutritionItemIdMap\.get\(String\(sourceItemId\)\)/);
  assert.match(importer, /mealIdMap\.get\(sourceMealId\)/);
  assert.match(importer, /remappedPending\[targetItemId\]=\{consumed,consumed_at:consumedAt,queued_at:queuedAt,meal_id:targetMealId\}/);
  assert.match(importer, /localStorage\.setItem\(queueKey,JSON\.stringify\(\{\.\.\.currentQueue,\.\.\.remappedPending\}\)\)/);
});

test('la paginación de IDs que protege el reemplazo usa un orden estable', () => {
  assert.match(importer, /\.select\('id'\)\.eq\('user_id',importNutritionUserId\)\.order\('id',\{ascending:true\}\)\.range\(from,from\+pageSize-1\)/);
});

test('la edición conserva la sintaxis JavaScript', () => {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, 'js/03-inline-script-03.js')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
