"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
// Load the module without firing DOMContentLoaded; its pure search helpers are safe to exercise here.
global.window = {};
global.document = { readyState: 'loading', addEventListener() {} };
require('../js/58-nutrition-advanced.js');
const api = global.window.AgendaNutritionAdvanced;

test('E12 search is accent-insensitive, case-insensitive and trims whitespace', () => {
  assert.equal(api.normalizeSearchText('  Plátano   ÁRABE  '), 'platano   arabe');
  assert.deepEqual(api.filterHistoryRows([
    {food_name:'Plátano', meal_title:'Desayuno', meal_type:'desayuno'},
    {food_name:'Arroz', meal_title:'Almuerzo', meal_type:'almuerzo'}
  ], ' PLATANO ', 'all').map(x=>x.food_name), ['Plátano']);
});

test('E12 history filter normalizes Spanish and English meal categories', () => {
  const rows = [
    {food_name:'Avena', meal_type:'breakfast'},
    {food_name:'Yogur', meal_type:'desayuno'},
    {food_name:'Arroz', meal_type:'almuerzo'},
    {food_name:'Fruta', meal_type:'Otra'}
  ];
  assert.deepEqual(api.filterHistoryRows(rows, '', 'breakfast').map(x=>x.food_name), ['Avena','Yogur']);
  assert.deepEqual(api.filterHistoryRows(rows, '', 'lunch').map(x=>x.food_name), ['Arroz']);
  assert.deepEqual(api.filterHistoryRows(rows, '', 'other').map(x=>x.food_name), ['Fruta']);
});

test('E12 history search finds brand, meal title, date, and snapshot fields', () => {
  const rows = [
    {food_name:'Leche', brand:'Campo Verde', meal_title:'Merienda', consumed_date:'2026-10-19', meal_type:'snack', item_snapshot:{preparation_state:'cooked'}},
    {food_name:'Pan', meal_title:'Desayuno', consumed_date:'2026-10-18', meal_type:'breakfast'}
  ];
  assert.equal(api.filterHistoryRows(rows, 'campo verde').length, 1);
  assert.equal(api.filterHistoryRows(rows, '2026-10-18').length, 1);
  assert.equal(api.filterHistoryRows(rows, 'cooked').length, 1);
  assert.equal(api.filterHistoryRows(rows, 'leche pan').length, 0);
});

test('E12 recipe search includes notes, ingredients and procedure and supports structure filters', () => {
  const recipes = [
    {name:'Tortilla', notes:'rápida', ingredients:[{name:'huevo'}], instructions:['Batir huevo'], parent_recipe_id:null},
    {name:'Arroz base', ingredients:[{name:'arroz'}], instructions:[], parent_recipe_id:null},
    {name:'Tortilla vegana', ingredients:[{name:'harina de garbanzo'}], instructions:['Mezclar'], parent_recipe_id:'r1'}
  ];
  assert.deepEqual(api.filterRecipes(recipes,'garbánzo').map(x=>x.name), ['Tortilla vegana']);
  assert.deepEqual(api.filterRecipes(recipes,'rápida').map(x=>x.name), ['Tortilla']);
  assert.deepEqual(api.filterRecipes(recipes,'','with_steps').map(x=>x.name), ['Tortilla','Tortilla vegana']);
  assert.deepEqual(api.filterRecipes(recipes,'','variants').map(x=>x.name), ['Tortilla vegana']);
  assert.deepEqual(api.filterRecipes(recipes,'','originals').map(x=>x.name), ['Tortilla','Arroz base']);
});

test('E12 personal food search filters by name, brand, ingredients and preparation', () => {
  const foods = [
    {name:'Pan integral', brand:'Molino', preparationState:'prepared'},
    {name:'Arroz', brand:'Campo', preparationState:'cooked'},
    {name:'Huevo', preparationState:'raw'}
  ];
  assert.deepEqual(api.filterUserFoods(foods,'molino').map(x=>x.name), ['Pan integral']);
  assert.deepEqual(api.filterUserFoods(foods,'arroz','cooked').map(x=>x.name), ['Arroz']);
  assert.deepEqual(api.filterUserFoods(foods,'','raw').map(x=>x.name), ['Huevo']);
  assert.equal(api.filterUserFoods(foods,'ninguno').length, 0);
});

test('E12 controls are added once and styled after E11 without touching global section styles', () => {
  const fs=require('node:fs'),path=require('node:path');
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'css/94-nutrition-browse-filters-e12.css'),'utf8');
  const e11=html.indexOf('./css/93-nutrition-premium-dashboard-e11.css');
  const e12=html.indexOf('./css/94-nutrition-browse-filters-e12.css');
  assert.ok(e11>=0&&e12>e11);
  assert.equal((html.match(/94-nutrition-browse-filters-e12\.css/g)||[]).length,1);
  for(const id of ['nutritionRecipeSearch','nutritionRecipeFilter','nutritionUserFoodsSearch','nutritionUserFoodsPreparation','nutritionHistorySearch','nutritionHistoryCategory']) assert.ok(html.includes(id)===false, `Dynamic modal control ${id} must not be hardcoded in index`);
  assert.match(css,/\.nutrition-advanced-modal \.nutrition-browse-toolbar/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/@media\(forced-colors:active\)/);
  assert.doesNotMatch(css,/(^|\n)\s*(button|input|select|textarea|\.section-view|\.workout-panel|\.calendar|\.schedule)\s*\{/i);
});


test('E12 filter helpers handle a large cached list without mutating source records', () => {
  const rows = Array.from({length:2500},(_,i)=>({id:String(i),name:i===2499?'Arroz integral especial':`Alimento ${i}`,brand:i%2?'Campo':'Huerta',preparationState:i%3?'cooked':'raw'}));
  const filtered = api.filterUserFoods(rows,'arroz integral','all');
  assert.equal(filtered.length,1);
  assert.equal(filtered[0].id,'2499');
  assert.equal(rows.length,2500);
  assert.equal(api.filterUserFoods(rows,'sin coincidencias').length,0);
});
