const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/62-nutrition-week-planner-shopping.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/108-nutrition-shopping-review-e27.css'), 'utf8');
const fakeDocument = { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, createElement() { throw new Error('DOM no esperado en la prueba de funciones puras'); } };
const window = {};
vm.runInNewContext(source, { window, document: fakeDocument, Intl, Date, Map, Set, String, Number, Math, Array, Object, RegExp, Error, console, JSON });
const api = window.AgendaNutritionPlanner;
assert.ok(api, 'La API de compras debe estar disponible');

const desired = [
  {item_key:'stable',name:'Avena',brand:'',quantity:500,quantity_known:true,unit:'g',preparation_state:'unspecified',category:'Almacén',source:'generated',source_meals:['m1']},
  {item_key:'bought',name:'Leche',brand:'Marca',quantity:2,quantity_known:true,unit:'l',preparation_state:'unspecified',category:'Lácteos',source:'generated',source_meals:['m2']},
  {item_key:'reactivate',name:'Arroz',brand:'',quantity:1,quantity_known:true,unit:'kg',preparation_state:'unspecified',category:'Almacén',source:'generated',source_meals:['m3']},
  {item_key:'new-unknown',name:'Especias',brand:'',quantity:null,quantity_known:false,unit:'g',preparation_state:'unspecified',category:'Almacén',source:'generated',source_meals:['m4']}
];
const existing = [
  {id:'1',item_key:'stable',name:'Avena',brand:'',quantity:500,quantity_known:true,unit:'g',preparation_state:'unspecified',category:'Almacén',source:'generated',source_meals:['m1'],active:true,checked:false,updated_at:'t1'},
  {id:'2',item_key:'bought',name:'Leche',brand:'Marca',quantity:1,quantity_known:true,unit:'l',preparation_state:'unspecified',category:'Lácteos',source:'generated',source_meals:['m2'],active:true,checked:true,updated_at:'t2'},
  {id:'3',item_key:'reactivate',name:'Arroz',brand:'',quantity:1,quantity_known:true,unit:'kg',preparation_state:'unspecified',category:'Almacén',source:'generated',source_meals:['m3'],active:false,checked:false,updated_at:'t3'},
  {id:'4',item_key:'stale',name:'Pan',brand:'',quantity:1,quantity_known:true,unit:'unit',preparation_state:'unspecified',category:'Panadería',source:'generated',source_meals:['old'],active:true,checked:false,updated_at:'t4'},
  {id:'5',item_key:'manual:1',name:'Huevos',brand:'',quantity:6,quantity_known:true,unit:'unit',preparation_state:'unspecified',category:'Otros',source:'manual',source_meals:[],active:true,checked:false,updated_at:'t5'}
];

const preview = api.buildShoppingPreview(existing, desired);
assert.equal(preview.added.length, 1);
assert.equal(preview.reactivated.length, 1);
assert.equal(preview.updated.length, 1);
assert.equal(preview.unchanged.length, 1);
assert.equal(preview.archive.length, 1);
assert.equal(preview.purchasedConflicts.length, 1);
assert.equal(preview.unknown.length, 1);
assert.equal(preview.manualPreserved, 1);
assert.equal(preview.hasChanges, true);
assert.equal(api.sameShoppingItemState(existing[0], desired[0]), true);
assert.equal(api.sameShoppingItemState(existing[1], desired[1]), false);
assert.equal(api.desiredShoppingSignature(desired), api.desiredShoppingSignature([...desired].reverse()), 'La firma propuesta no debe depender del orden');
assert.equal(api.existingShoppingSignature(existing), api.existingShoppingSignature([...existing].reverse()), 'La firma existente no debe depender del orden');

const unchangedPreview = api.buildShoppingPreview([existing[0]], [desired[0]]);
assert.equal(unchangedPreview.hasChanges, false);
assert.equal(unchangedPreview.unchanged.length, 1);
const changedExisting = existing.map(row => ({...row}));
changedExisting[0].checked = true;
assert.notEqual(api.existingShoppingSignature(changedExisting), api.existingShoppingSignature(existing), 'La firma debe detectar cambios concurrentes en el estado de compra');
const changedDesired = desired.map(row => ({...row}));
changedDesired[0].quantity = 750;
assert.notEqual(api.desiredShoppingSignature(changedDesired), api.desiredShoppingSignature(desired), 'La firma debe detectar cambios de cantidades en el plan');

assert.match(html, /js\/62-nutrition-week-planner-shopping\.js\?v=e41/);
assert.match(html, /css\/108-nutrition-shopping-review-e27\.css\?v=e27/);
assert.match(css, /nutrition-shopping-review-e27/);
assert.match(css, /forced-colors/);
assert.match(css, /max-width:620px/);
console.log('E27 shopping review/reconciliation: 13 tests passed.');
