'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('E21 autocomplete reads nutrition quality and provenance fields for both food sources', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  for (const field of ['source_url', 'data_source_url', 'data_source_label', 'nutrition_quality_status', 'nutrition_missing_fields', 'nutrition_verified_at']) {
    assert.ok(js.includes(field), `missing selected provenance field: ${field}`);
  }
  assert.match(js, /nutritionQualityStatus:text\(row\.nutrition_quality_status\)/);
  assert.match(js, /nutritionMissing:missingNutritionFields\(row\)/);
  assert.match(js, /sourceLabel:text\(row\.data_source_label\|\|row\.source\)/);
});

test('A genuinely absent required nutrient is distinguished from a real numeric zero', () => {
  const autocomplete = read('js/50-nutrition-food-autocomplete.js');
  const persistence = read('js/49-nutrition-persistence.js');
  assert.match(autocomplete, /function hasNumericValue\(value\)[\s\S]*?value!==null&&value!==undefined&&String\(value\)\.trim\(\)!==''&&Number\.isFinite\(Number\(value\)\)/);
  assert.match(autocomplete, /if\(!hasNumericValue\(row\?\.\[metric\.field\]\)&&!declarationCovers\(metric\)\)missing\.push\(metric\.label\)/);
  assert.match(persistence, /function inferredNutritionMissing\(row\)/);
  assert.match(persistence, /if\(!hasNumericValue\(row\?\.\[metric\.field\]\)&&!declaredForMetric\)declared\.push\(metric\.label\)/);
  assert.match(autocomplete, /calories:hasNumericValue\(row\.calories_per_100g\)\?Number\(row\.calories_per_100g\):0/);
});


test('The local-search adapter preserves explicit zero and derives a missing-field warning from NULL', async () => {
  const row = {id:'e21-row',name:'Alimento de prueba',brand:'',calories_per_100g:0,protein_per_100g:null,carbs_per_100g:10,fat_per_100g:0,fiber_per_100g:null,source:'curated',data_source_label:'Catálogo interno',nutrition_quality_status:'legacy_unverified',nutrition_missing_fields:[],unit:'g',preparation_state:'unspecified',is_generic:true};
  const client = {
    from(table) {
      const query = {
        select(){ return query; }, eq(){ return query; }, ilike(){ return query; }, order(){ return query; }, limit(){ return query; },
        then(resolve,reject){ return Promise.resolve({data:table==='food_catalog'?[row]:[],error:null}).then(resolve,reject); }
      };
      return query;
    }
  };
  const window = {};
  const sandbox = {
    window, document:{readyState:'complete',addEventListener(){},createElement(){return {set textContent(v){this._text=String(v)},get innerHTML(){return this._text||''}}}},
    currentUser:{id:'e21-account'}, ensureSupabase:async()=>client,
    String, Object, Array, Number, Math, RegExp, Date, Map, Set, Intl, JSON, Promise, console,
    URL, Blob, setTimeout, clearTimeout
  };
  vm.runInNewContext(read('js/49-nutrition-persistence.js'), sandbox);
  const results = await window.AgendaNutritionData.searchLocal('alimento');
  assert.equal(results.catalog.length, 1);
  assert.equal(results.catalog[0].calories, 0, 'a true numerical zero must be retained');
  assert.equal(results.catalog[0].fat, 0, 'another explicit zero must be retained');
  assert.ok(Array.from(results.catalog[0].nutritionMissing).includes('proteínas'));
  assert.equal(results.catalog[0].nutritionQualityStatus, 'legacy_unverified', 'legacy status remains factual; incompleteness is carried by the missing-field list');
});

test('Incomplete results show a warning instead of presenting missing values as zero macros', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /const incomplete=missing\.length>0\|\|String\(food\.nutritionQualityStatus\|\|''\)\.toLowerCase\(\)==='incomplete'/);
  assert.match(js, /nutrition-food-autocomplete-quality/);
  assert.match(js, /Datos incompletos/);
  assert.match(js, /: `<span class="nutrition-food-autocomplete-macros">/);
});

test('Choosing a meal-title suggestion cannot select or add a catalog ingredient', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  const start = js.indexOf('function selectTitleSuggestion(index)');
  const end = js.indexOf('async function performTitleSearch', start);
  assert.ok(start >= 0 && end > start);
  const body = js.slice(start, end);
  assert.match(body, /title\.value=food\.name/);
  assert.match(body, /hideTitleAutocomplete\(\)/);
  assert.doesNotMatch(body, /AgendaFoodCatalog\?\.select/);
  assert.doesNotMatch(body, /nutritionFoodSearch/);
  assert.doesNotMatch(body, /nutritionFoodQuantity/);
});

test('Asynchronous local/online refresh preserves an active suggestion by variant identity', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /function foodVariantKey\(food\)/);
  assert.match(js, /const previousActiveKey=activeSuggestionKey\(lastSuggestionItems,activeIndex\)/);
  assert.match(js, /activeIndex=previousActiveKey\?merged\.findIndex\(item=>foodVariantKey\(item\)===previousActiveKey\):-1/);
  assert.match(js, /const previousActiveKey=activeSuggestionKey\(titleSuggestionItems,titleActiveIndex\)/);
  assert.match(js, /titleActiveIndex=previousActiveKey\?merged\.findIndex\(item=>foodVariantKey\(item\)===previousActiveKey\):-1/);
});

test('Deduplication keys distinguish preparation states and measurement variants', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  const start = js.indexOf('function foodVariantKey(food)');
  const end = js.indexOf('function activeSuggestionKey', start);
  const body = js.slice(start, end);
  for (const field of ['preparationState', 'unit', 'quantity', 'servingSize', 'densityGPerMl', 'gramsPerUnit', 'gramsPerPortion']) {
    assert.ok(body.includes(field), `variant key does not include ${field}`);
  }
  assert.match(js, /const key=foodVariantKey\(item\)/);
  assert.match(js, /local\.map\(foodVariantKey\)/);
});

test('E21 visual cues are scoped to the autocomplete and preserve accessibility fallbacks', () => {
  const css = read('css/102-nutrition-autocomplete-accessibility-e20.css');
  const html = read('index.html');
  assert.match(css, /\.nutrition-food-autocomplete-quality/);
  assert.match(css, /\.nutrition-food-autocomplete-variant/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /50-nutrition-food-autocomplete\.js\?v=e21/);
  assert.match(html, /102-nutrition-autocomplete-accessibility-e20\.css\?v=e21/);
  assert.doesNotMatch(css, /#workoutPanel|#agendaPanel|#calendarPanel|\.v28-workout/);
});
