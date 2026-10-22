const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/63-nutrition-week-plan-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/114-nutrition-week-template-merge-e33.css'), 'utf8');
const window = { currentUser: { id: 'user-e33' } };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('Unexpected DOM access in pure test'); } };
vm.runInNewContext(source, { window, document, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, JSON, Promise, crypto: { randomUUID: () => 'e33-fixed-uuid' } });
const api = window.AgendaNutritionWeeklyPlan;
const week = '2026-10-19';
const targetWeek = '2026-10-26';
const sourceRows = [
  {id:'src-breakfast',user_id:'user-e33',week_start:week,day_offset:0,meal_type:'desayuno',title:'Avena',planned_time:'08:00',notes:'',sort_order:0,ingredients_snapshot:[{name:'Avena',quantity:50,quantity_known:true,unit:'g',provenance:{source:'catalog'}}],nutrition_snapshot:{calories:190,nutrition_missing_metrics:['fiber']}},
  {id:'src-dinner',user_id:'user-e33',week_start:week,day_offset:2,meal_type:'cena',title:'Sopa',planned_time:'20:00',notes:'',sort_order:0,ingredients_snapshot:[{name:'Zapallo',quantity:null,quantity_known:false,unit:'g'}],nutrition_snapshot:{calories:null,nutrition_missing_metrics:['calories','protein','carbs','fat','fiber']}}
];
const template = api.createWeeklyPlanTemplate(sourceRows, week, 'user-e33', 'Semana base', 'template-e33-001', '2026-10-21T10:00:00.000Z', (() => { let n=0; return () => `template-item-e33-${++n}`; })());
const targetRows = [{id:'dst-lunch',user_id:'user-e33',week_start:targetWeek,day_offset:0,meal_type:'almuerzo',title:'Almuerzo propio',planned_time:'13:00',notes:'No tocar',plan_key:'manual:dst-lunch',sort_order:4,ingredients_snapshot:[],nutrition_snapshot:{},updated_at:'v1'}];
let passed=0;
function test(name,fn){fn();passed++;console.log(`✓ ${name}`)}

test('E33 keeps the original safe default: skip any day that already has meals',()=>{
  const preview=api.previewWeeklyTemplate(template,targetRows,targetWeek,'user-e33');
  assert.equal(preview.includeOccupiedDays,false);
  assert.equal(preview.days[0].status,'skip');
  assert.equal(preview.counts.daysSkipped,1);
  assert.equal(preview.days[0].addCount,0);
});

test('Merge mode adds missing template meals to occupied days without replacing existing rows',()=>{
  const before=JSON.stringify(targetRows);
  const preview=api.previewWeeklyTemplate(template,targetRows,targetWeek,'user-e33',{includeOccupiedDays:true});
  assert.equal(preview.includeOccupiedDays,true);
  assert.equal(preview.days[0].status,'merge');
  assert.equal(preview.days[0].unrelatedCount,1);
  assert.equal(preview.days[0].addCount,1);
  assert.equal(preview.counts.daysMerged,1);
  assert.equal(preview.counts.daysSkipped,0);
  assert.equal(JSON.stringify(targetRows),before);
});

test('Merge payloads append after existing sort order and only contain missing items',()=>{
  const preview=api.previewWeeklyTemplate(template,targetRows,targetWeek,'user-e33',{includeOccupiedDays:true});
  const payloads=api.weeklyTemplatePayloads(template,preview,targetRows,targetWeek,'user-e33','2026-10-21T11:00:00.000Z');
  assert.equal(payloads.length,2);
  const monday=payloads.find(row=>row.day_offset===0);
  assert.ok(monday);
  assert.equal(monday.sort_order,5);
  assert.equal(monday.title,'Avena');
  assert.equal(monday.plan_key,api.weeklyTemplatePlanKey(template.id,template.items[0].item_id));
  assert.equal(payloads.find(row=>row.day_offset===2).title,'Sopa');
  assert.equal(payloads.every(row=>row.source_meal_id===null),true);
});

test('Merge retry recognizes an already-added template meal and avoids duplicates',()=>{
  const preview=api.previewWeeklyTemplate(template,targetRows,targetWeek,'user-e33',{includeOccupiedDays:true});
  const all=api.weeklyTemplatePayloads(template,preview,targetRows,targetWeek,'user-e33');
  const partiallySaved=[...targetRows,{...all[0],id:'saved-template-meal',updated_at:'v2'}];
  const retry=api.previewWeeklyTemplate(template,partiallySaved,targetWeek,'user-e33',{includeOccupiedDays:true});
  const retryPayloads=api.weeklyTemplatePayloads(template,retry,partiallySaved,targetWeek,'user-e33');
  assert.equal(retry.days[0].status,'already');
  assert.equal(retryPayloads.length,1);
  assert.equal(retryPayloads[0].title,'Sopa');
});

test('Preview mode is carried into payload validation; a stale default preview is not silently converted to merge',()=>{
  const preview=api.previewWeeklyTemplate(template,targetRows,targetWeek,'user-e33');
  assert.equal(preview.includeOccupiedDays,false);
  const normal=api.weeklyTemplatePayloads(template,preview,targetRows,targetWeek,'user-e33');
  assert.equal(normal.length,1);
  assert.equal(normal[0].title,'Sopa');
});

test('E33 HTML references the new stylesheet and cache-busted editor, and CSS supports mobile/accessibility',()=>{
  assert.match(html,/114-nutrition-week-template-merge-e33\.css\?v=e33/);
  assert.match(html,/63-nutrition-week-plan-editor\.js\?v=e43/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/forced-colors/);
  assert.match(css,/focus-visible/);
  assert.doesNotMatch(css,/#fff\b|white\s*!important/i);
});
console.log(`E33 pure tests: ${passed}/6 passed`);
