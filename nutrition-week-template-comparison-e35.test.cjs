const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/116-nutrition-week-template-comparison-e35.css'), 'utf8');
const window = { currentUser: { id: 'user-e35' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('Unexpected DOM access in pure test'); } };
vm.runInNewContext(source, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: () => 'e35-fixed-uuid' } });
const api = window.AgendaNutritionWeeklyPlan;
const week = '2026-10-19';
const baseRows = [
 {id:'e35-breakfast-a',user_id:'user-e35',week_start:week,day_offset:0,meal_type:'desayuno',title:'Avena',planned_time:'08:00',notes:'Canela',sort_order:0,ingredients_snapshot:[{name:'Avena',quantity:50,quantity_known:true,unit:'g',quality:{source:'catalog',confidence:'high'},nutrition_verified_at:'2026-10-01'}],nutrition_snapshot:{calories:190,protein_g:7,carbs_g:30,fat_g:3,fiber_g:null,nutrition_missing_metrics:['fiber']}},
 {id:'e35-friday-a',user_id:'user-e35',week_start:week,day_offset:4,meal_type:'cena',title:'Sopa',planned_time:'20:00',notes:'Preparación casera',sort_order:0,ingredients_snapshot:[{name:'Zapallo',quantity:null,quantity_known:false,unit:'g',provenance:{source:'custom',reason:'unknown'}}],nutrition_snapshot:{calories:null,nutrition_missing_metrics:['calories','protein','carbs','fat','fiber']}}
];
const otherRows = [
 {...baseRows[0],id:'e35-breakfast-b',notes:'Sin canela',ingredients_snapshot:[{name:'Avena',quantity:75,quantity_known:true,unit:'g',quality:{source:'custom',confidence:'medium'}}],nutrition_snapshot:{calories:285,protein_g:10.5,carbs_g:45,fat_g:4.5,fiber_g:0,nutrition_missing_metrics:[]}},
 {id:'e35-tuesday-b',user_id:'user-e35',week_start:week,day_offset:1,meal_type:'almuerzo',title:'Ensalada',planned_time:'13:00',notes:'Limón al servir',sort_order:0,ingredients_snapshot:[{name:'Tomate',quantity:120,quantity_known:true,unit:'g'}],nutrition_snapshot:{calories:35,protein_g:1.2,carbs_g:7,fat_g:0.2,fiber_g:2,nutrition_missing_metrics:[]}}
];
let idSeq=0;
const templateA = api.createWeeklyPlanTemplate(baseRows, week, 'user-e35', 'Semana A', 'template-e35-a001', '2026-10-21T10:00:00.000Z', () => `item-e35-a-${++idSeq}`);
const templateB = api.createWeeklyPlanTemplate(otherRows, week, 'user-e35', 'Semana B', 'template-e35-b001', '2026-10-22T10:00:00.000Z', () => `item-e35-b-${++idSeq}`);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

test('Comparison rejects identical template IDs', () => {
 assert.throws(() => api.compareWeeklyPlanTemplates(templateA, templateA), /dos plantillas diferentes/);
});

test('Comparison identifies changed, A-only and B-only meals without mutating templates', () => {
 const beforeA = JSON.stringify(templateA), beforeB = JSON.stringify(templateB);
 const result = api.compareWeeklyPlanTemplates(templateA, templateB);
 assert.equal(result.summary.changed, 1);
 assert.equal(result.summary.onlyInA, 1);
 assert.equal(result.summary.onlyInB, 1);
 assert.equal(result.summary.same, 0);
 assert.equal(result.summary.daysAffected, 3);
 assert.equal(result.hasDifferences, true);
 assert.equal(JSON.stringify(templateA), beforeA);
 assert.equal(JSON.stringify(templateB), beforeB);
});

test('Comparison highlights quantity, notes, provenance and confirmed nutrient differences', () => {
 const result = api.compareWeeklyPlanTemplates(templateA, templateB);
 const changed = result.days.flatMap(day => day.rows).find(row => row.kind === 'changed');
 assert.ok(changed.changes.some(text => /Cantidad de «Avena»: 50 g → 75 g/.test(text)));
 assert.ok(changed.changes.some(text => /Las notas son diferentes/.test(text)));
 assert.ok(changed.changes.some(text => /procedencia o calidad/.test(text)));
 assert.ok(changed.changes.some(text => /energía: 190 kcal → 285 kcal/.test(text)));
 assert.equal(result.summary.ingredientDifferences, 2);
});

test('Comparison keeps known zero different from an unknown nutrient value', () => {
 const a = api.createWeeklyPlanTemplate([{...baseRows[0],nutrition_snapshot:{calories:null,nutrition_missing_metrics:['calories']}}],week,'user-e35','Desconocido','template-e35-a002','2026-10-21T10:00:00.000Z',()=>`item-e35-a2-${++idSeq}`);
 const b = api.createWeeklyPlanTemplate([{...baseRows[0],nutrition_snapshot:{calories:0,nutrition_missing_metrics:[]}}],week,'user-e35','Cero válido','template-e35-b002','2026-10-22T10:00:00.000Z',()=>`item-e35-b2-${++idSeq}`);
 const result = api.compareWeeklyPlanTemplates(a,b);
 assert.ok(result.days.flatMap(day=>day.rows).some(row=>row.changes.some(text=>/dato desconocido → 0 kcal/.test(text))));
});

test('Identical duplicate templates show no differences even when item IDs differ', () => {
 const duplicated = api.duplicateWeeklyPlanTemplate([templateA], templateA.id, 'template-e35-copy01', '2026-10-22T12:00:00.000Z', () => `item-e35-copy-${++idSeq}`)[0];
 const result = api.compareWeeklyPlanTemplates(templateA, duplicated);
 assert.equal(result.hasDifferences, false);
 assert.equal(result.summary.same, templateA.items.length);
 assert.equal(result.summary.changed, 0);
});

test('E35 loads the comparison stylesheet, bumps editor cache, and includes responsive accessibility styles', () => {
 assert.match(html, /116-nutrition-week-template-comparison-e35\.css\?v=e35/);
 assert.match(html, /63-nutrition-week-plan-editor\.js\?v=e43/);
 assert.match(css, /prefers-reduced-motion/);
 assert.match(css, /forced-colors/);
 assert.match(css, /focus-visible/);
 assert.match(css, /max-width:620px/);
 assert.match(css, /body\.light \.nutrition-week-template-compare-e35/);
 assert.doesNotMatch(css, /white\s*!important/i);
});
console.log(`E35 pure tests: ${passed}/6 passed`);
