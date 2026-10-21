const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✓', name); }
  catch (error) { console.error('✗', name); throw error; }
}

const adapterWindow = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/48-openfoodfacts-adapter.js'), 'utf8'), {
  window: adapterWindow, URL, AbortController, setTimeout, clearTimeout,
  fetch: async () => { throw new Error('Network must not be used by pure unit tests'); },
  console
});
const off = adapterWindow.AgendaFoodCatalogOFF;
assert.ok(off);

test('La búsqueda inteligente prioriza la coincidencia exacta sobre la aproximada', () => {
  const ranked = off.rankResults([
    { id: 'miss', name: 'Arroz integral', brand: 'Marca A' },
    { id: 'exact', name: 'Arroz', brand: 'Marca B' }
  ], 'arroz');
  assert.equal(ranked[0].id, 'exact');
});

test('El buscador tolera un error pequeño de escritura sin perder el resultado', () => {
  const ranked = off.rankResults([
    { id: 'rice', name: 'Arroz blanco', brand: 'Genérico' },
    { id: 'other', name: 'Aceite vegetal', brand: 'Marca' }
  ], 'aroz');
  assert.equal(ranked[0].id, 'rice');
  assert.ok(ranked[0].name.toLowerCase().includes('arroz'));
});

test('La deduplicación conserva la copia con datos nutricionales más completos', () => {
  const ranked = off.rankResults([
    { id: '779123', name: 'Leche entera', brand: 'Lácteos', nutritionMissing: ['proteínas', 'grasas'] },
    { id: '779123', name: 'Leche entera', brand: 'Lácteos', nutritionMissing: [] }
  ], 'leche');
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].nutritionMissing.length, 0);
});

test('La normalización detecta nutrientes desconocidos sin confundirlos con cero', () => {
  const food = off.normalize({
    code: '12345678', product_name_es: 'Producto de prueba',
    nutriments: { 'energy-kcal_100g': 0, proteins_100g: 2, carbohydrates_100g: 3 }
  });
  assert.deepEqual(Array.from(food.nutritionMissing), ['grasas']);
  assert.equal(food.calories, 0);
});

test('No considera conocido un dato energético por porción sin unidad por 100 g', () => {
  const food = off.normalize({ code: '12345678', product_name: 'Producto', nutriments: { 'energy-kcal': 150 } });
  assert.ok(food.nutritionMissing.includes('energía'));
  assert.equal(food.calories, 0);
});

const fakeDocument = { readyState: 'loading', addEventListener() {}, getElementById() { return null; } };
const barcodeWindow = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/64-nutrition-barcode-scanner.js'), 'utf8'), {
  window: barcodeWindow, document: fakeDocument, navigator: {}, String, Number, Array, Math, console
});
const barcode = barcodeWindow.AgendaNutritionBarcode;
assert.ok(barcode);

test('Normaliza un EAN copiado con espacios y guiones', () => {
  assert.equal(barcode.normalizeCode('400-638 133 3931'), '4006381333931');
});

test('Admite las longitudes estándar EAN-8, UPC-A, EAN-13 y GTIN-14', () => {
  for (const code of ['96385074', '036000291452', '4006381333931', '10012345000017']) {
    assert.equal(barcode.normalizeCode(code), code);
  }
});

test('Valida dígitos de control habituales', () => {
  assert.equal(barcode.checksumValid('4006381333931'), true);
  assert.equal(barcode.checksumValid('96385074'), true);
  assert.equal(barcode.checksumValid('036000291452'), true);
  assert.equal(barcode.checksumValid('4006381333932'), false);
});

test('Rechaza entradas con longitud inválida o letras incrustadas', () => {
  assert.equal(barcode.normalizeCode('1234'), '');
  assert.equal(barcode.normalizeCode('ABCDEFHI'), '');
  assert.equal(barcode.normalizeCode('ABC4006381333931'), '');
  assert.equal(barcode.checksumValid('1234'), false);
});

test('La lista de nutrientes incompletos es conservadora', () => {
  assert.deepEqual(Array.from(barcode.missingNutrition({ nutritionMissing: ['energía', 'grasas'] })), ['energía', 'grasas']);
  assert.deepEqual(Array.from(barcode.missingNutrition({})), []);
});


test('El catálogo conserva la lista de nutrientes desconocidos del producto externo', () => {
  const catalogSource = fs.readFileSync(path.join(root, 'js/47-nutrition-food-catalog.js'), 'utf8');
  assert.match(catalogSource, /nutritionMissing:Array\.isArray\(item\.nutritionMissing\)/);
});

test('No permite guardar ni agregar al registro productos externos con nutrientes principales desconocidos', () => {
  const catalogSource = fs.readFileSync(path.join(root, 'js/47-nutrition-food-catalog.js'), 'utf8');
  assert.match(catalogSource, /No se guardó[^\n]*faltan datos de/);
  assert.match(catalogSource, /No se agregó[^\n]*faltan datos de/);
  assert.match(catalogSource, /apply\.disabled=!totals\?\.valid\|\|qty<=0\|\|missingNutrition\.length>0/);
});

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
test('El HTML carga el lector después del catálogo y su adaptador', () => {
  assert.ok(html.indexOf('js/48-openfoodfacts-adapter.js') < html.indexOf('js/64-nutrition-barcode-scanner.js'));
  assert.match(html, /css\/87-nutrition-barcode-scanner\.css/);
  assert.match(html, /js\/64-nutrition-barcode-scanner\.js/);
});

test('El lector mantiene un ingreso manual aunque el navegador no soporte cámara', () => {
  const src = fs.readFileSync(path.join(root, 'js/64-nutrition-barcode-scanner.js'), 'utf8');
  assert.match(src, /Ingresá un código EAN\/UPC/);
  assert.match(src, /getUserMedia/);
  assert.match(src, /no ofrece lector de códigos compatible/);
  assert.match(src, /stopCamera/);
});

console.log(`D6: ${passed} pruebas aprobadas.`);
