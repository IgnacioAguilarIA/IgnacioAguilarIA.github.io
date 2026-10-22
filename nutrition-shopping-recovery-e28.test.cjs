const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/62-nutrition-week-planner-shopping.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/109-nutrition-shopping-recovery-e28.css'), 'utf8');
const fakeDocument = {readyState:'loading',addEventListener(){},getElementById(){return null},createElement(){throw new Error('DOM inesperado en pruebas puras')}};
const window = {};
vm.runInNewContext(source,{window,document:fakeDocument,Intl,Date,Map,Set,String,Number,Math,Array,Object,RegExp,Error,console,JSON});
const api=window.AgendaNutritionPlanner;
assert.ok(api);
const archived={id:'a1',item_key:'generated:arroz',name:'Arroz',user_id:'u1',week_start:'2026-10-19',source:'generated',active:false,checked:false};
const activeGenerated={...archived,active:true};
const manual={id:'m1',item_key:'manual:tomate',name:'Tomate',user_id:'u1',week_start:'2026-10-19',source:'manual',active:true,checked:false};
const boughtManual={...manual,checked:true};
const inactiveManual={...manual,active:false};
const missingId={...manual,id:''};
const tests=[
 ['recognizes an archived generated row with identity and scope',()=>assert.equal(api.isArchivedGeneratedShoppingRow(archived),true)],
 ['does not classify active generated rows as archived',()=>assert.equal(api.isArchivedGeneratedShoppingRow(activeGenerated),false)],
 ['does not offer recovery for manual/incomplete rows',()=>{assert.equal(api.isArchivedGeneratedShoppingRow(inactiveManual),false);assert.equal(api.isArchivedGeneratedShoppingRow({...archived,user_id:''}),false)}],
 ['allows editing an active, unpurchased manual product',()=>assert.equal(api.canEditManualShoppingItem(manual),true)],
 ['prevents editing generated products',()=>assert.equal(api.canEditManualShoppingItem({...manual,source:'generated'}),false)],
 ['prevents editing purchased or archived products',()=>{assert.equal(api.canEditManualShoppingItem(boughtManual),false);assert.equal(api.canEditManualShoppingItem(inactiveManual),false)}],
 ['requires a record id and account/week scope for editing',()=>{assert.equal(api.canEditManualShoppingItem(missingId),false);assert.equal(api.canEditManualShoppingItem({...manual,week_start:''}),false)}],
 ['index loads E28 module cache version and recovery stylesheet',()=>{assert.match(html,/js\/62-nutrition-week-planner-shopping\.js\?v=e41/);assert.match(html,/css\/109-nutrition-shopping-recovery-e28\.css\?v=e28/) }],
 ['editor and archived list expose accessible labels',()=>{assert.match(source,/Productos archivados de esta semana/);assert.match(source,/Editar producto manual/);assert.match(source,/Restaurar \$\{clean\(row\.name\)/)}],
 ['uses optimistic updated_at filters for both mutation workflows',()=>{assert.match(source,/current\.updated_at\)\:q\.is\('updated_at',null\)/);assert.match(source,/El producto cambió durante el guardado/)}],
 ['archive and edit interactions are locked during review/sync',()=>{assert.match(source,/shell\.list,shell\.archivePanel\]\)setReviewTreeLocked\(root,locked\)/);assert.match(source,/if\(shoppingBusy\|\|shoppingProposal\|\|!shoppingModal\|\|!canEditManualShoppingItem\(row\)\)/)}],
 ['CSS supports keyboard focus, mobile layout and forced colors',()=>{assert.match(css,/focus-visible/);assert.match(css,/max-width:700px/);assert.match(css,/forced-colors/);assert.match(css,/prefers-reduced-motion/)}],
];
for(const [name,fn] of tests){fn();console.log('✓ '+name)}
console.log(`E28 shopping recovery: ${tests.length} tests passed.`);
