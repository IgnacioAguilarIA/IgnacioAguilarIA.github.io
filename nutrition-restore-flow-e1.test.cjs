'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/03-inline-script-03.js'), 'utf8');
const start = source.indexOf('async function importMyData(');
const endMarker = '\n}\n\n// El shell visual se dibuja SIEMPRE antes de consultar Supabase o events.json.';
const end = source.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, 'debe localizarse la función de importación');
const functionSource = source.slice(start, end + 2);

function makeHarness({ replace = true, tables = {} } = {}) {
  const state = {
    tables: structuredClone(tables),
    calls: [],
    alerts: [],
    confirmCalls: [],
    flushCalls: 0,
    nextId: 1
  };
  const keyColumns = {
    user_foods: ['user_id', 'fingerprint'],
    nutrition_consumption_history: ['user_id', 'meal_item_id', 'consumed_date']
  };
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  class Query {
    constructor(table) { this.table = table; this.action = 'select'; this.filters = []; this.payload = null; this.offset = 0; this.end = Infinity; this.limitValue = null; this.conflict = ''; }
    select(columns='*') { this.columns = columns; return this; }
    eq(column, value) { this.filters.push(row => String(row[column] ?? '') === String(value ?? '')); return this; }
    in(column, values) { const set = new Set((values || []).map(String)); this.filters.push(row => set.has(String(row[column] ?? ''))); return this; }
    order(column, options={}) { this.orderColumn = column; this.ascending = options.ascending !== false; return this; }
    range(from, to) { this.offset = from; this.end = to; return this; }
    limit(n) { this.limitValue = n; return this; }
    insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
    upsert(payload, options={}) { this.action = 'upsert'; this.payload = payload; this.conflict = String(options.onConflict || ''); return this; }
    update(payload) { this.action = 'update'; this.payload = payload; return this; }
    delete() { this.action = 'delete'; return this; }
    single() { return this.execute().then(result => ({ data: Array.isArray(result.data) ? result.data[0] : result.data, error: result.error })); }
    maybeSingle() { return this.single(); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    async execute() {
      state.calls.push({table:this.table,action:this.action});
      const rows = state.tables[this.table] || (state.tables[this.table] = []);
      const matches = row => this.filters.every(fn => fn(row));
      if (this.action === 'select') {
        let found = rows.filter(matches).map(clone);
        if (this.orderColumn) found.sort((a,b) => String(a[this.orderColumn] ?? '').localeCompare(String(b[this.orderColumn] ?? '') ) * (this.ascending ? 1 : -1));
        if (this.limitValue != null) found = found.slice(0, this.limitValue);
        found = found.slice(this.offset, this.end + 1);
        return {data:found,error:null};
      }
      if (this.action === 'insert' || this.action === 'upsert') {
        const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(clone);
        const saved = [];
        for (const row of incoming) {
          const conflictKeys = this.action === 'upsert'
            ? (this.conflict ? this.conflict.split(',').map(s=>s.trim()) : (keyColumns[this.table] || []))
            : [];
          const existing = conflictKeys.length ? rows.find(current => conflictKeys.every(key => String(current[key] ?? '') === String(row[key] ?? ''))) : null;
          if (existing) { Object.assign(existing, row); saved.push(clone(existing)); }
          else { if (row.id == null) row.id = `new-${this.table}-${state.nextId++}`; rows.push(row); saved.push(clone(row)); }
        }
        return {data:saved,error:null};
      }
      if (this.action === 'update') {
        const found = rows.filter(matches);
        for (const row of found) Object.assign(row, clone(this.payload));
        return {data:found.map(clone),error:null};
      }
      if (this.action === 'delete') {
        const removed = rows.filter(matches);
        state.tables[this.table] = rows.filter(row => !matches(row));
        return {data:removed.map(clone),error:null};
      }
      return {data:[],error:null};
    }
  }

  const store = new Map();
  const localStorage = {
    getItem:key => store.has(key) ? store.get(key) : null,
    setItem:(key,value) => store.set(String(key),String(value)),
    removeItem:key => store.delete(String(key)),
    key:index => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; }
  };
  let uuid = 0;
  const context = {
    console,
    sb:{from:table=>new Query(table)},
    currentUser:{id:'test-user',email:'test@example.invalid'},
    confirm:message=>{state.confirmCalls.push(String(message));return replace;},
    alert:message=>state.alerts.push(String(message)),
    setImportProgress(){},
    localStorage,
    navigator:{onLine:true},
    window:{crypto:{randomUUID:()=>`new-id-${++uuid}`},AgendaNutritionConsumption:{flushPending:()=>{state.flushCalls++;return Promise.resolve();}}},
    document:{dispatchEvent(){return true}},
    CustomEvent:function(type,init={}){this.type=type;this.detail=init.detail||{};},
    Promise, Map, Set, Date, Math, Number, String, Object, Array, Boolean, JSON, RegExp, Error,
    setTimeout:()=>0,
    loadTasks:async()=>{}, loadPersonalDates:async()=>{}, loadWorkoutExercises:async()=>{}, loadWorkoutLogs:async()=>{}, loadNutritionMeals:async()=>{},
    createDays(){}, renderSchedule(){}, updateStats(){}, renderDashboard(){}, renderWorkoutDays(){}, renderWorkoutList(){}, renderWorkoutHistory(){}, renderNutritionDays(){}, renderMealTabs(){}, renderNutritionList(){}, renderNutritionGoals(){}, renderConflicts(){}, updateNotice(){}, updateReminderUI(){}, closeSettings(){}, loadNutritionGoals(){},
    nutritionGoals:{calories:2000,protein:100,carbs:200,fat:60}
  };
  vm.createContext(context);
  vm.runInContext(`${functionSource}\nglobalThis.__importMyData=importMyData;`, context);
  const file = payload => ({name:'backup.json',text:async()=>JSON.stringify(payload)});
  return {state,context,localStorage,run:(payload,selected={tasks:false,dates:false,exercises:false,logs:false,meals:true})=>context.__importMyData(file(payload),selected)};
}

function emptyV3(local={pending_consumption:{},goals:{calories:2000,protein:100,carbs:200,fat:60},meal_order:['pre','post','lunch','snack','dinner','sleep'],quick_access:{version:1,favorites:[],recent:[]},legacy_consumed:{}}) {
  return {backup_format:'agenda-fich-full-backup',backup_version:3,exported_at:'2026-10-18T12:00:00.000Z',account:'source@example.invalid',nutrition_meals:[],nutrition_meal_items:[],user_foods:[],nutrition_recipes:[],nutrition_consumption_history:[],nutrition_preferences:[],nutrition_local:local};
}

test('rechaza un formato ajeno antes de hacer consultas o escrituras', async () => {
  const h = makeHarness();
  await assert.rejects(h.run({backup_format:'otro-formato',backup_version:3,nutrition_local:{pending_consumption:{}}}), /no pertenece al formato/i);
  assert.equal(h.state.calls.length,0);
  assert.equal(h.state.confirmCalls.length,0);
});

test('bloquea el reemplazo de un respaldo antiguo incompleto antes de tocar Supabase', async () => {
  const h = makeHarness({replace:true});
  await assert.rejects(h.run({nutrition_meals:[],nutrition_local:{pending_consumption:{}}}), /copia está incompleta/i);
  assert.equal(h.state.calls.length,0);
});

test('restaura datos, limpia IDs antiguos después del historial y remapea reintentos pendientes', async () => {
  const initial = {
    nutrition_meals:[{id:'old-meal',user_id:'test-user',title:'Comida anterior',day:1,type:'lunch'}],
    nutrition_meal_items:[{id:'old-item',user_id:'test-user',meal_id:'old-meal',name:'Avena anterior',quantity:80,unit:'g',consumed:false}],
    user_foods:[{id:'old-food',user_id:'test-user',fingerprint:'old-fp',name:'Alimento anterior',brand:'',source:'manual'}],
    nutrition_recipes:[{id:'old-recipe',user_id:'test-user',name:'Receta anterior',ingredients:[]}],
    nutrition_consumption_history:[{id:'old-history',user_id:'test-user',consumed_date:'2026-10-17',meal_id:'old-meal',meal_item_id:'old-item',food_name:'Avena anterior'}],
    nutrition_preferences:[{user_id:'test-user',meal_order:['pre','post','lunch','snack','dinner','sleep'],nutrition_goals:{calories:1800},favorite_foods:[],recent_foods:[]}]
  };
  const h=makeHarness({replace:true,tables:initial});
  const backup=emptyV3({
    pending_consumption:{'backup-item':{consumed:true,consumed_at:'2026-10-18T10:01:00.000Z',queued_at:'2026-10-18T10:01:00.000Z',meal_id:'backup-meal'}},
    goals:{calories:2200,protein:120,carbs:260,fat:70},
    meal_order:['pre','post','lunch','snack','dinner','sleep'],
    quick_access:{version:1,favorites:[],recent:[]},legacy_consumed:{}
  });
  backup.nutrition_meals=[{id:'backup-meal',user_id:'source-user',title:'Comida restaurada',day:2,type:'lunch'}];
  backup.user_foods=[{id:'backup-food',user_id:'source-user',fingerprint:'backup-fp',name:'Avena nueva',brand:'Marca',source:'manual',calories_per_100g:380}];
  backup.nutrition_meal_items=[{id:'backup-item',user_id:'source-user',meal_id:'backup-meal',user_food_id:'backup-food',name:'Avena nueva',brand:'Marca',quantity:100,unit:'g',consumed:true,consumed_at:'2026-10-18T10:01:00.000Z'}];
  backup.nutrition_recipes=[{id:'backup-recipe',user_id:'source-user',name:'Receta restaurada',notes:'',servings:2,total_weight_g:300,ingredients:[]}];
  backup.nutrition_consumption_history=[{id:'backup-history',user_id:'source-user',consumed_date:'2026-10-18',meal_id:'backup-meal',meal_item_id:'backup-item',food_name:'Avena nueva',quantity:100,unit:'g',item_snapshot:{}}];
  backup.nutrition_preferences=[{user_id:'source-user',meal_order:['pre','post','lunch','snack','dinner','sleep'],nutrition_goals:{calories:2200},favorite_foods:[],recent_foods:[]}];

  await h.run(backup);
  await Promise.resolve();

  assert.equal(h.state.tables.nutrition_meals.length,1);
  assert.equal(h.state.tables.nutrition_meals[0].title,'Comida restaurada');
  assert.equal(h.state.tables.nutrition_meal_items.length,1);
  assert.equal(h.state.tables.nutrition_meal_items[0].meal_id,h.state.tables.nutrition_meals[0].id);
  assert.equal(h.state.tables.nutrition_meal_items[0].user_food_id,h.state.tables.user_foods[0].id);
  assert.equal(h.state.tables.nutrition_consumption_history.length,1);
  assert.equal(h.state.tables.nutrition_consumption_history[0].food_name,'Avena nueva');
  assert.equal(h.state.tables.nutrition_consumption_history[0].meal_item_id,h.state.tables.nutrition_meal_items[0].id);
  assert.equal(h.state.tables.nutrition_recipes.length,1);
  assert.equal(h.state.tables.nutrition_recipes[0].name,'Receta restaurada');
  assert.ok(!h.state.tables.nutrition_meals.some(row=>row.id==='old-meal'));
  assert.ok(!h.state.tables.nutrition_meal_items.some(row=>row.id==='old-item'));
  assert.ok(!h.state.tables.nutrition_consumption_history.some(row=>row.id==='old-history'));
  assert.ok(!h.state.tables.user_foods.some(row=>row.id==='old-food'));
  assert.ok(!h.state.tables.nutrition_recipes.some(row=>row.id==='old-recipe'));

  const queue=JSON.parse(h.localStorage.getItem('agendaNutritionPendingConsumption:test-user'));
  const restoredItem=h.state.tables.nutrition_meal_items[0];
  assert.deepEqual(Object.keys(queue),[restoredItem.id]);
  assert.equal(queue[restoredItem.id].meal_id,restoredItem.meal_id);
  assert.equal(queue[restoredItem.id].consumed,true);
  assert.equal(h.state.flushCalls,1,'se solicita un reintento no bloqueante si hay conexión');
});
