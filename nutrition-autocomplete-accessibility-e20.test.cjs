'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('E20 loads after the E19 visual layer and reuses the existing autocomplete runtime', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('./css/101-nutrition-visual-consistency-e19.css') < html.indexOf('./css/102-nutrition-autocomplete-accessibility-e20.css'));
  assert.equal((html.match(/102-nutrition-autocomplete-accessibility-e20\.css/g) || []).length, 1);
  assert.equal((html.match(/50-nutrition-food-autocomplete\.js/g) || []).length, 1);
  assert.equal((html.match(/nutrition-autocomplete-accessibility-e20\.js/g) || []).length, 0);
});

test('Both nutrition autocomplete inputs expose the combobox contract and point to the real listbox', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  for (const attr of ["setAttribute('role','combobox')", "setAttribute('aria-autocomplete','list')", "setAttribute('aria-haspopup','listbox')", "setAttribute('aria-controls',parts.list.id)"]) assert.ok(js.includes(attr), `missing ${attr}`);
  assert.match(js, /list\.setAttribute\('role','listbox'\)/);
  assert.match(js, /input\.setAttribute\('aria-expanded',String\(!!expanded\)\)/);
});

test('Suggestions expose option semantics and selection state, not only a visual class', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /option\.setAttribute\('role','option'\)/);
  assert.match(js, /option\.setAttribute\('aria-selected',String\(/);
  assert.match(js, /input\.setAttribute\('aria-activedescendant',active\.id\)/);
  assert.match(js, /option\.setAttribute\('tabindex','-1'\)/);
  assert.match(js, /role="group" aria-label=/);
});

test('Arrow navigation updates the accessible active option in the food catalog', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /function setActive\(delta\)/);
  assert.match(js, /syncAccessibleOptions\(box,\$\('nutritionFoodSearch'\),activeIndex\)/);
  assert.match(js, /event\.key==='ArrowDown'.*setActive\(1\)/);
  assert.match(js, /event\.key==='ArrowUp'.*setActive\(-1\)/);
});

test('Arrow navigation updates the accessible active option for the meal-title search', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /function setTitleActive\(delta\)/);
  assert.match(js, /syncAccessibleOptions\(box,\$\('mealTitle'\),titleActiveIndex\)/);
  assert.match(js, /event\.key==='ArrowDown'.*setTitleActive\(1\)/);
  assert.match(js, /event\.key==='ArrowUp'.*setTitleActive\(-1\)/);
});

test('Loading and empty states are polite live regions separate from selectable options', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /status\.setAttribute\('role','status'\)/);
  assert.match(js, /status\.setAttribute\('aria-live','polite'\)/);
  assert.match(js, /status\.setAttribute\('aria-atomic','true'\)/);
  assert.match(js, /function setPopupMessage\(box,message,kind='empty'\)/);
  assert.match(js, /parts\.list\.replaceChildren\(\)/);
});

test('Escape and successful selection collapse the popup and clear the active descendant', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /if\(event\.key==='Escape'&&visible\).*hideTitleAutocomplete\(\)/);
  assert.match(js, /if\(event\.key==='Escape'&&visible\).*hide\(\)/);
  assert.match(js, /function hideTitleAutocomplete\([\s\S]*?configureCombobox\(\$\('mealTitle'\),box,false\)/);
  assert.match(js, /function hide\([\s\S]*?configureCombobox\(\$\('nutritionFoodSearch'\),box,false\)/);
  assert.match(js, /if\(expanded===false\)input\.removeAttribute\('aria-activedescendant'\)/);
});

test('E20 styling is limited to nutrition autocomplete and supports high contrast/reduced motion', () => {
  const css = read('css/102-nutrition-autocomplete-accessibility-e20.css');
  assert.match(css, /\.nutrition-food-autocomplete-list/);
  assert.match(css, /\.nutrition-food-autocomplete-item\[aria-selected="true"\]/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /(^|})\s*(?:html|body|button|input|\.modal)\s*\{/m);
  assert.doesNotMatch(css, /#workoutPanel|#agendaPanel|#calendarPanel|\.v28-workout/);
});

test('E20 retains existing search providers and does not introduce new storage/network writes', () => {
  const js = read('js/50-nutrition-food-autocomplete.js');
  assert.match(js, /AgendaNutritionData/);
  assert.match(js, /AgendaFoodCatalogOFF\?\.search/);
  assert.match(js, /AgendaFoodCatalog\?\.select/);
  assert.doesNotMatch(js, /localStorage\.setItem|\.from\(['"]nutrition_meals['"]\)\.(?:insert|update|delete)/);
});
