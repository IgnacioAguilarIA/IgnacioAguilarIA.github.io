const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const accessibilitySource=fs.readFileSync(path.join(root,'js/60-nutrition-accessibility-final.js'),'utf8');
const routineSource=fs.readFileSync(path.join(root,'js/59-nutrition-routine-tools.js'),'utf8');
const advancedSource=fs.readFileSync(path.join(root,'js/58-nutrition-advanced.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/81-nutrition-accessibility-final.css'),'utf8');
const tests=[];
function test(name,fn){fn();tests.push(name)}
function makeButton(active,text){const attrs={};return {textContent:text,hidden:false,classList:{contains:name=>name==='active'&&active},hasAttribute:name=>Object.hasOwn(attrs,name),setAttribute:(name,value)=>{attrs[name]=String(value)},getAttribute:name=>attrs[name]??null,attrs}}
function makeHost(buttons){const attrs={};return {buttons,attrs,setAttribute:(name,value)=>{attrs[name]=String(value)},querySelectorAll:()=>buttons}}
const dayButtons=[makeButton(true,'Lunes'),makeButton(false,'Martes')];
const mealButtons=[makeButton(false,'Almuerzo'),makeButton(true,'Cena')];
const hosts={nutritionDays:makeHost(dayButtons),mealTabs:makeHost(mealButtons)};
const fakeDocument={readyState:'loading',addEventListener(){},getElementById:id=>hosts[id]||null};
const fakeWindow={};
vm.runInNewContext(accessibilitySource,{window:fakeWindow,document:fakeDocument,console,WeakMap,Map,Set,String,Number,Object,Array,Boolean,requestAnimationFrame:fn=>fn(),MutationObserver:function(){},HTMLElement:function(){}} ,{filename:'60-nutrition-accessibility-final.js'});
const api=fakeWindow.AgendaNutritionAccessibility;

test('el módulo de accesibilidad se carga después del módulo de rutinas de Alimentación',()=>{assert.ok(html.indexOf('js/59-nutrition-routine-tools.js')<html.indexOf('js/60-nutrition-accessibility-final.js'));assert.ok(html.indexOf('css/80-nutrition-routine-tools.css')<html.indexOf('css/81-nutrition-accessibility-final.css'))});
test('selector de días expone un nombre de grupo accesible',()=>{api.enhanceDayControls();assert.equal(hosts.nutritionDays.attrs.role,'group');assert.equal(hosts.nutritionDays.attrs['aria-label'],'Seleccionar día de alimentación')});
test('selector de días informa qué botón está seleccionado',()=>{assert.equal(dayButtons[0].attrs['aria-pressed'],'true');assert.equal(dayButtons[1].attrs['aria-pressed'],'false')});
test('cada día tiene una etiqueta accesible descriptiva',()=>{assert.equal(dayButtons[0].attrs['aria-label'],'Mostrar comidas del Lunes');assert.equal(dayButtons[1].attrs['aria-label'],'Mostrar comidas del Martes')});
test('categorías de comida se etiquetan como grupo y marcan su selección',()=>{assert.equal(hosts.mealTabs.attrs.role,'group');assert.equal(hosts.mealTabs.attrs['aria-label'],'Filtrar comidas por horario');assert.equal(mealButtons[0].attrs['aria-pressed'],'false');assert.equal(mealButtons[1].attrs['aria-pressed'],'true')});
test('asocia etiquetas visibles sin for a su único campo',()=>{const attrs={};const control={id:'goalCalories',disabled:false};const label={htmlFor:'',set htmlFor(value){attrs.for=value},get htmlFor(){return attrs.for||''}};const field={querySelectorAll:selector=>selector==='label'?[label]:selector==='input,select,textarea'?[control]:[]};api.improveLabels({querySelectorAll:()=>[field]});assert.equal(attrs.for,'goalCalories')});
test('diálogo principal está descrito y etiquetado con aria-describedby',()=>{assert.match(accessibilitySource,/dialog\.setAttribute\('aria-describedby',description\.id\)/);assert.match(accessibilitySource,/dialog\.setAttribute\('aria-labelledby',title\.id\)/)});
test('diálogos estáticos de comida y objetivos añaden Escape y trampa de foco',()=>{assert.match(accessibilitySource,/if\(event\.key==='Escape'\)\{event\.preventDefault\(\);closeFn\(\);return;\}/);assert.match(accessibilitySource,/if\(event\.shiftKey&&\(document\.activeElement===first/);assert.match(accessibilitySource,/else if\(!event\.shiftKey&&\(document\.activeElement===last/)});
test('al cerrar un diálogo se devuelve el foco al elemento que lo abrió',()=>{assert.match(accessibilitySource,/state\.trigger\.focus\(\{preventScroll:true\}\)/);assert.match(accessibilitySource,/state\.trigger=null/)});
test('bloquea desplazamiento de fondo solo mientras el diálogo está abierto',()=>{assert.match(accessibilitySource,/document\.body\.style\.overflow='hidden'/);assert.match(accessibilitySource,/document\.body\.style\.overflow=state\.overflow/)});
test('diálogo avanzado incluye descripción accesible y foco inicial',()=>{assert.match(advancedSource,/aria-describedby="nutritionAdvancedDescription"/);assert.match(advancedSource,/nutritionAdvancedDescription/);assert.match(advancedSource,/if\(e\.key==='Escape'\)/)});
test('diálogos de herramientas incorporan texto descriptivo y trampa de foco',()=>{assert.match(routineSource,/aria-describedby="\$\{id\}Description"/);assert.match(routineSource,/if\(event\.key!=='Tab'\)return/);assert.match(routineSource,/previousFocus\.focus\(\{preventScroll:true\}\)/)});
test('estados seleccionados se anuncian además del color',()=>{assert.match(accessibilitySource,/setAttribute\('aria-pressed',String\(selected\)\)/);assert.match(accessibilitySource,/setAttribute\('aria-pressed',String\(button\.classList\.contains\('active'\)\)\)/)});
test('todos los ámbitos interactivos nutricionales tienen foco visible',()=>{for(const selector of ['#nutritionPanel','#nutritionOverlay','#goalOverlay','.nutrition-advanced-overlay','.nutrition-routine-overlay'])assert.ok(css.includes(selector));assert.match(css,/outline: 3px solid #60a5fa/)});
test('controles táctiles de uso frecuente tienen un mínimo de 44px',()=>{assert.match(css,/min-height: 44px/);assert.match(css,/#nutritionPanel #nutritionDays > button/);assert.match(css,/#nutritionPanel #mealList \.meal-action/)});
test('tema claro define colores legibles sin depender solo de opacidad',()=>{assert.match(css,/body\.light \.nutrition-routine-note[\s\S]*?color: #334155/);assert.match(css,/body\.light \.nutrition-advanced-form small[\s\S]*?color: #475569/)});
test('respeta movimiento reducido y colores forzados',()=>{assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);assert.match(css,/@media \(forced-colors: active\)/)});
test('reinicio del manejador de deshacer agrupa mutaciones en requestAnimationFrame',()=>{assert.match(routineSource,/let reinstallScheduled=false/);assert.match(routineSource,/requestAnimationFrame\(\(\)=>\{/)});
test('el módulo de accesibilidad solo enlaza contenedores de Alimentación',()=>{assert.match(accessibilitySource,/\$\('nutritionPanel'\)/);assert.match(accessibilitySource,/\$\('nutritionOverlay'\)/);assert.match(accessibilitySource,/\$\('goalOverlay'\)/);assert.doesNotMatch(accessibilitySource,/workoutPanel|calendarPanel|mobileNav|authEmail/) });
console.log(`Etapa C1: ${tests.length} pruebas aprobadas.`);
for(const name of tests)console.log(`OK - ${name}`);
