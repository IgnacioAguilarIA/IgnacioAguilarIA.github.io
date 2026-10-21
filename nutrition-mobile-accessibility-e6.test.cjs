const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cssPath = path.join(root, 'css/90-nutrition-mobile-e6.css');
const css = fs.readFileSync(cssPath, 'utf8');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

test('E6 carga la hoja responsive después de los estilos de Alimentación', () => {
  const report = html.indexOf('css/88-nutrition-quality-report.css');
  const mobile = html.indexOf('css/90-nutrition-mobile-e6.css');
  assert.ok(report >= 0 && mobile > report, 'E6 debe aplicarse después de los estilos previos de Alimentación');
});

test('La nueva hoja se limita a Alimentación y sus diálogos nutricionales', () => {
  assert.match(css, /#nutritionPanel/);
  assert.match(css, /#nutritionOverlay/);
  assert.match(css, /#goalOverlay/);
  assert.doesNotMatch(css, /(^|\n)\s*(?:body|html|\.workout-panel|\.calendar|\.schedule)\s*\{/i,
    'No debe agregar reglas globales que cambien Entrenamiento, Calendario o Agenda');
});

test('Los rótulos nutricionales pueden envolver texto en pantallas estrechas', () => {
  assert.match(css, /\.nutrition-summary-metric\s*>\s*span\s*\{[^}]*white-space:\s*normal/s);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
});

test('La grilla de días no depende de desplazamiento horizontal en móvil', () => {
  assert.match(css, /#nutritionPanel #nutritionDays\.workout-days\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /#nutritionPanel #nutritionDays \.workout-day-btn\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test('Las pestañas de comida pueden ajustarse sin desbordar texto', () => {
  assert.match(css, /#nutritionPanel #mealTabs\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /#nutritionPanel #mealTabs \.meal-tab\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

test('Los controles interactivos importantes alcanzan al menos 44 px en móvil', () => {
  assert.match(css, /#nutritionPanel #mealList \.meal-action\s*\{[^}]*min-width:\s*44px/s);
  assert.match(css, /#nutritionPanel \.nutrition-actions > button[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.nutrition-pantry-modal button\s*\{\s*min-height:\s*44px/s);
});

test('Los campos de formulario usan 16 px para evitar zoom automático en Safari iOS', () => {
  assert.match(css, /#nutritionPanel :is\(input, select, textarea\)[\s\S]*?font-size:\s*16px/s);
  assert.match(css, /#nutritionOverlay \.modal input[\s\S]*?font-size:\s*16px/s);
});

test('Los formularios principales usan áreas seguras y altura del viewport dinámico', () => {
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /max-height:\s*calc\(100dvh/s);
  assert.match(css, /overscroll-behavior:\s*contain/);
});

test('La cabecera del editor permanece disponible al recorrer formularios largos', () => {
  assert.match(css, /#nutritionOverlay \.modal-head,\s*\n\s*#goalOverlay \.modal-head\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /#nutritionOverlay \.meal-form-actions\s*\{[^}]*position:\s*sticky/s);
});

test('Los diálogos secundarios contemplan pantalla apaisada', () => {
  assert.match(css, /@media\s*\(max-width:\s*900px\)\s*and\s*\(orientation:\s*landscape\)/);
  assert.match(css, /max-height:\s*88dvh/);
});

test('E6 conserva movimiento reducido y modo de colores forzados', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /:focus-visible/);
});

test('El HTML conserva la estructura principal de Alimentación y no añade scripts nuevos', () => {
  assert.match(html, /id="nutritionPanel"/);
  assert.match(html, /id="nutritionOverlay"/);
  assert.match(html, /id="goalOverlay"/);
  assert.doesNotMatch(html, /nutrition-mobile-a11y-e6\.js/);
});

test('Los diálogos de comida y objetivos tienen nombre accesible y modalidad declarada', () => {
  assert.match(html, /<div class="modal" role="dialog" aria-modal="true" aria-labelledby="nutritionModalTitle"/);
  assert.match(html, /<h3 id="nutritionModalTitle">/);
  assert.match(html, /<div class="modal" role="dialog" aria-modal="true" aria-labelledby="nutritionGoalsModalTitle"/);
  assert.match(html, /<h3 id="nutritionGoalsModalTitle">/);
  assert.match(html, /id="nutritionCloseBtn" type="button" aria-label="Cerrar editor de comida"/);
  assert.match(html, /id="goalCloseBtn" type="button" aria-label="Cerrar objetivos de alimentación"/);
});

test('Los campos de objetivos quedan asociados a sus etiquetas', () => {
  for (const id of ['goalCalories', 'goalProtein', 'goalCarbs', 'goalFat']) {
    assert.match(html, new RegExp(`<label for="${id}">`));
    assert.match(html, new RegExp(`<input[^>]*id="${id}"`));
  }
});

test('La acción de guardar permanece legible sobre un fondo opaco en el formulario móvil', () => {
  assert.match(css, /#nutritionOverlay \.meal-form-actions[\s\S]*?background:\s*var\(--card,\s*#111827\)\s*!important/);
  assert.match(css, /#nutritionOverlay \.meal-form-actions > button[\s\S]*?width:\s*100%\s*!important/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
});

test('Las áreas de toque siguen siendo amplias en dispositivos táctiles tipo tableta', () => {
  assert.match(css, /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)/);
  assert.match(css, /#nutritionPanel #nutritionDays \.workout-day-btn[\s\S]*?min-height:\s*44px/);
  assert.match(css, /#nutritionOverlay \.modal button[\s\S]*?min-height:\s*44px/);
});


test('El botón Guardar objetivos queda dentro de una barra accesible en móvil', () => {
  assert.match(html, /class="nutrition-goal-form-actions"[^>]*>\s*<button class="save" id="saveGoalsBtn"/s);
  assert.match(css, /#goalOverlay \.nutrition-goal-form-actions\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /#goalOverlay \.nutrition-goal-form-actions #saveGoalsBtn\s*\{[^}]*min-height:\s*44px/s);
});

test('El botón flotante global no tapa las tarjetas de Alimentación en móvil', () => {
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*?#app:has\(\.v32-nutrition-pane\.v32-section-active\) #quickAddFab\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(html, /id="addMealBtn"/);
});

test('Los formularios siguen ofreciendo guardar y cerrar en móviles apaisados', () => {
  assert.match(css, /@media\s*\(max-width:\s*900px\)\s*and\s*\(orientation:\s*landscape\)\s*\{[\s\S]*?#nutritionOverlay \.modal-head\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /@media\s*\(max-width:\s*900px\)\s*and\s*\(orientation:\s*landscape\)\s*\{[\s\S]*?#nutritionOverlay \.meal-form-actions\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /#nutritionOverlay \.meal-form-actions #saveMealBtn\s*\{[^}]*width:\s*100%\s*!important/s);
});

test('La hoja móvil no cambia el layout global ni define reglas fuera de Alimentación', () => {
  assert.doesNotMatch(css, /(^|\n)\s*(?:body|html|#app|\.mobile-nav|#v25Goals)\s*\{/i);
  assert.match(css, /#nutritionPanel/);
  assert.match(css, /#nutritionOverlay/);
});

console.log(`E6: ${passed} pruebas aprobadas.`);
