const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/54-nutrition-consumption.js'),'utf8');
const auditSql=fs.readFileSync(path.join(root,'sql/13-nutrition-sync-audit-readonly.sql'),'utf8');
const tests=[];
function test(name,fn){tests.push({name,fn})}
function harness(saveFn){
  const store=new Map();const events=[];const timers=[];
  const document={readyState:'loading',addEventListener(){},dispatchEvent(event){events.push(event);return true}};
  const window={AgendaNutritionData:{setMealItemConsumed:saveFn},addEventListener(){}};
  const localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  const context={window,document,localStorage,navigator:{onLine:true},currentUser:{id:'u1'},console:{warn(){},error(){},log(){}},CustomEvent:function(type,opts){this.type=type;this.detail=opts?.detail},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},Promise,Map,Set,Date,Math,Number,String,Object,Array,Boolean,JSON,RegExp,Error};
  vm.runInNewContext(source,context,{filename:'js/54-nutrition-consumption.js'});
  return {context,window,document,store,events,timers,api:window.AgendaNutritionConsumption};
}
const key='agendaNutritionPendingConsumption:u1';
const entry=(consumed,queued_at,consumed_at=consumed?queued_at:null)=>({consumed,consumed_at,queued_at,meal_id:'meal-1'});
function putQueue(h,value){h.store.set(key,JSON.stringify({'item-1':value}));}
function getQueue(h){return JSON.parse(h.store.get(key)||'{}')}

 test('no borra una entrada más reciente que se escribió mientras el request estaba en vuelo',async()=>{
  let signal;const started=new Promise(resolve=>signal=resolve);let release;
  const waiting=new Promise(resolve=>release=resolve);let calls=0;
  const h=harness(async()=>{calls++;signal();return waiting});
  putQueue(h,entry(true,'2026-10-12T10:00:00.000Z'));
  const flushing=h.api.flushPending();await started;
  const latest=entry(false,'2026-10-12T10:00:01.000Z');putQueue(h,latest);
  release({ok:true,historyOk:true});await flushing;
  assert.deepEqual(getQueue(h)['item-1'],latest);assert.equal(calls,1);assert.ok(h.timers.some(t=>t.ms===250));
 });

test('elimina de la cola solo la entrada exacta confirmada por Supabase',async()=>{
  const h=harness(async()=>({ok:true,historyOk:true}));putQueue(h,entry(true,'2026-10-12T10:00:00.000Z'));
  await h.api.flushPending();assert.equal(Object.keys(getQueue(h)).length,0);
  assert.ok(h.events.some(e=>e.type==='agenda:nutrition-consumption-queue-flushed'));
});

test('si cambia la cuenta durante una solicitud conserva la cola de la cuenta original',async()=>{
  let signal;const started=new Promise(resolve=>signal=resolve);let release;const waiting=new Promise(resolve=>release=resolve);
  const h=harness(async()=>{signal();return waiting});const original=entry(true,'2026-10-12T10:00:00.000Z');putQueue(h,original);
  const flushing=h.api.flushPending();await started;h.context.currentUser={id:'u2'};release({ok:true,historyOk:true});await flushing;
  assert.deepEqual(getQueue(h)['item-1'],original);assert.equal(h.store.has('agendaNutritionPendingConsumption:u2'),false);
});

test('si Supabase confirma el consumo pero no el historial mantiene el reintento',async()=>{
  const h=harness(async()=>({ok:true,historyOk:false,historyError:'history temporarily unavailable'}));const original=entry(true,'2026-10-12T10:00:00.000Z');putQueue(h,original);
  await h.api.flushPending();assert.deepEqual(getQueue(h)['item-1'],original);
  assert.ok(h.events.some(e=>e.type==='agenda:nutrition-consumption-sync-status'&&e.detail?.status==='pending'));
});

test('dos flush simultáneos del mismo usuario no envían la misma entrada dos veces',async()=>{
  let signal;const started=new Promise(resolve=>signal=resolve);let release;const waiting=new Promise(resolve=>release=resolve);let calls=0;
  const h=harness(async()=>{calls++;signal();return waiting});putQueue(h,entry(true,'2026-10-12T10:00:00.000Z'));
  const first=h.api.flushPending();await started;const second=h.api.flushPending();release({ok:true,historyOk:true});await Promise.all([first,second]);
  assert.equal(calls,1);assert.equal(Object.keys(getQueue(h)).length,0);
});

test('si se agrega otra entrada durante el flush se programa una pasada adicional',async()=>{
  let signal;const started=new Promise(resolve=>signal=resolve);let release;const waiting=new Promise(resolve=>release=resolve);
  const h=harness(async()=>{signal();return waiting});putQueue(h,entry(true,'2026-10-12T10:00:00.000Z'));
  const flushing=h.api.flushPending();await started;
  const queue=getQueue(h);queue['item-2']={consumed:true,consumed_at:'2026-10-12T10:00:02.000Z',queued_at:'2026-10-12T10:00:02.000Z',meal_id:'meal-2'};
  h.store.set(key,JSON.stringify(queue));release({ok:true,historyOk:true});await flushing;
  assert.ok(h.timers.some(t=>t.ms===250));assert.deepEqual(getQueue(h)['item-2'],queue['item-2']);
});

test('las operaciones directas y el flush comparten el bloqueo por alimento',()=>{
  assert.match(source,/function withItemSyncLock\(userId,itemId,operation\)/);
  assert.match(source,/return withItemSyncLock\(owner,item\.id,async\(\)=>\{/);
  assert.match(source,/await withItemSyncLock\(owner,id,async\(\)=>\{/);
});

test('el módulo no escribe una instantánea obsoleta de toda la cola tras un await',()=>{
  const flush=source.slice(source.indexOf('async function flushPending'),source.indexOf('function findMeal'));
  assert.doesNotMatch(flush,/writePending\(queue,owner\)/);
  assert.match(flush,/const remaining=readPending\(owner\)/);
  assert.match(flush,/sameQueueEntry\(after\[id\]\|\|null,entry\)/);
});

test('la auditoría de producción es de solo lectura y cubre RLS, grants y restricciones',()=>{
  assert.match(auditSql,/FROM pg_policies/);
  assert.match(auditSql,/aclexplode/);
  assert.match(auditSql,/pg_constraint/);
  assert.match(auditSql,/pg_proc/);
  assert.doesNotMatch(auditSql,/^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|REVOKE|CREATE)\b/im);
});

(async()=>{
  for(const item of tests){await item.fn();console.log(`OK - ${item.name}`)}
  console.log(`Sincronización D1: ${tests.length} pruebas aprobadas.`);
})().catch(err=>{console.error(err);process.exitCode=1});
