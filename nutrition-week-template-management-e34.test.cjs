const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/115-nutrition-week-template-management-e34.css'), 'utf8');
const window = { currentUser: { id: 'user-e34' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('Unexpected DOM access in pure test'); } };
vm.runInNewContext(source, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: () => 'e34-fixed-uuid' } });
const api = window.AgendaNutritionWeeklyPlan;
const week = '2026-10-19';
const rows = [
  {id:'e34-meal-a',user_id:'user-e34',week_start:week,day_offset:0,meal_type:'desayuno',title:'Avena',planned_time:'08:00',notes:'Canela',sort_order:0,ingredients_snapshot:[{name:'Avena',quantity:50,quantity_known:true,unit:'g',quality:{source:'catalog',confidence:'high'},nutrition_verified_at:'2026-10-01'}],nutrition_snapshot:{calories:190,protein_g:7,fiber_g:null,nutrition_missing_metrics:['fiber']}},
  {id:'e34-meal-b',user_id:'user-e34',week_start:week,day_offset:2,meal_type:'cena',title:'Sopa',planned_time:'20:00',notes:'',sort_order:0,ingredients_snapshot:[{name:'Zapallo',quantity:null,quantity_known:false,unit:'g',provenance:{source:'custom',reason:'unknown'}}],nutrition_snapshot:{calories:null,nutrition_missing_metrics:['calories','protein','carbs','fat','fiber']}}
];
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
const original = api.createWeeklyPlanTemplate(rows, week, 'user-e34', 'Semana base', 'template-e34-original', '2026-10-21T10:00:00.000Z', (() => { let n=0; return () => `item-e34-original-${++n}`; })());

 test('Renaming updates only the name and preserves ID, creation date and snapshots', () => {
   const renamed = api.renameWeeklyPlanTemplate([original], original.id, 'Semana de cursada')[0];
   assert.equal(renamed.name, 'Semana de cursada');
   assert.equal(renamed.id, original.id);
   assert.equal(renamed.created_at, original.created_at);
   assert.deepEqual(JSON.parse(JSON.stringify(renamed.items)), JSON.parse(JSON.stringify(original.items)));
 });

test('Renaming rejects blank, overlong and accent/case-insensitive duplicate names', () => {
  const other = api.createWeeklyPlanTemplate(rows, week, 'user-e34', 'Semana ágil', 'template-e34-other', '2026-10-21T10:00:00.000Z', (() => { let n=0; return () => `item-e34-other-${++n}`; })());
  assert.throws(() => api.renameWeeklyPlanTemplate([original, other], original.id, '   '), /nombre/);
  assert.throws(() => api.renameWeeklyPlanTemplate([original, other], original.id, 'x'.repeat(81)), /nombre/);
  assert.throws(() => api.renameWeeklyPlanTemplate([original, other], original.id, 'SEMANA AGIL'), /Ya existe otra plantilla/);
});

test('Duplicate receives a new template ID and completely independent item IDs while preserving content', () => {
  let i=0; const duplicated = api.duplicateWeeklyPlanTemplate([original], original.id, 'template-e34-copy-001', '2026-10-22T12:00:00.000Z', () => `item-e34-copy-${++i}`);
  assert.equal(duplicated.length, 2);
  const copy = duplicated[0];
  assert.equal(copy.name, 'Semana base (copia)');
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.items[0].item_id, original.items[0].item_id);
  assert.ok(copy.items.every(item => !original.items.some(source => source.item_id === item.item_id)));
  assert.deepEqual(JSON.parse(JSON.stringify(copy.items.map(item => ({...item, item_id: null})))), JSON.parse(JSON.stringify(original.items.map(item => ({...item, item_id: null})))));
  assert.equal(copy.items[0].ingredients_snapshot[0].quality.confidence, 'high');
  assert.equal(copy.items[1].ingredients_snapshot[0].quantity_known, false);
  assert.deepEqual(JSON.parse(JSON.stringify(copy.items[1].nutrition_snapshot.nutrition_missing_metrics)), ['calories','protein','carbs','fat','fiber']);
});

test('Duplicate names are generated uniquely and normalized without accent/case collisions', () => {
  const copy1 = api.uniqueWeeklyTemplateCopyName('Semana Ágil', [original, {...original, id:'template-e34-c1', name:'Semana agil (copia)'}]);
  assert.equal(copy1, 'Semana Ágil (copia 2)');
  const copy2 = api.uniqueWeeklyTemplateCopyName('Rutina', [original]);
  assert.equal(copy2, 'Rutina (copia)');
});

test('Duplicate refuses missing templates, duplicate IDs, repeated names and maximum capacity', () => {
  assert.throws(() => api.duplicateWeeklyPlanTemplate([original], 'not-present', 'template-e34-copy-001', '2026-10-22T12:00:00.000Z', ()=>'item-e34-copy-0001'), /ya no existe/);
  assert.throws(() => api.duplicateWeeklyPlanTemplate([original], original.id, original.id, '2026-10-22T12:00:00.000Z', ()=>'item-e34-copy-0001'), /identificador independiente/);
  assert.throws(() => api.duplicateWeeklyPlanTemplate([original], original.id, 'template-e34-copy-001', '2026-10-22T12:00:00.000Z', ()=>'item-e34-copy-0001', 'Semana base'), /Ya existe una plantilla/);
  const many = Array.from({length:12}, (_,i)=>({...original,id:`template-e34-slot-${i}`,name:`Plantilla ${i}`}));
  assert.throws(() => api.duplicateWeeklyPlanTemplate(many, many[0].id, 'template-e34-copy-001', '2026-10-22T12:00:00.000Z', (()=>{let i=0;return ()=>`item-e34-max-${++i}`})()), /máximo de 12/);
});

test('Template summary groups days and surfaces missing quantities and incomplete nutrition', () => {
  const summary = api.weeklyTemplateSummary(original);
  assert.equal(summary.meals, 2);
  assert.equal(summary.daysUsed, 2);
  assert.equal(summary.ingredients, 2);
  assert.equal(summary.unknownQuantities, 1);
  assert.equal(summary.incompleteNutrition, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(summary.days)), [{day:0,name:'Lunes',count:1},{day:2,name:'Miércoles',count:1}]);
});

test('E34 HTML loads the new scoped stylesheet and busts the editor cache', () => {
  assert.match(html, /115-nutrition-week-template-management-e34\.css\?v=e34/);
  assert.match(html, /63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /#fff\b|white\s*!important/i);
});
console.log(`E34 pure tests: ${passed}/7 passed`);
