#!/usr/bin/env python3
"""Browser smoke test for the E7 quick-registration UI using a mocked catalog.

It executes the real quick-access module and E7 CSS, but mocks the catalog's
selection/apply layer so no Supabase request or real user data is used.
Requires: playwright for Python and Chromium.
"""
from pathlib import Path
import json
import asyncio
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / 'artifacts' / 'e7'

def fixture_html():
    styles = []
    for name in ['74-nutrition-quick-access.css', '78-nutrition-food-entry.css', '90-nutrition-mobile-e6.css', '91-nutrition-quick-registration-e7.css']:
        path = ROOT / 'css' / name
        if path.is_file():
            styles.append(f'<style data-file="{name}">{path.read_text(encoding="utf-8")}</style>')
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + ''.join(styles) + '''
<style>
body{margin:0;padding:10px;background:#0b1220;color:#e5edf7;font:16px system-ui,sans-serif}
#app{display:block}.v32-nutrition-pane{display:block!important}
#nutritionOverlay{display:block;position:relative;width:100%;padding:0}
#nutritionOverlay .modal{width:100%;max-width:820px;margin:0 auto;max-height:none;padding:12px;overflow:visible}
#nutritionFoodCatalog{display:block}#nutritionFoodCatalog[hidden]{display:none!important}.nutrition-food-quick-list{max-height:none!important;overflow:visible!important}
#nutritionFoodQuantity,#nutritionFoodQuantityUnit,#nutritionFoodPreparationState{min-height:44px;width:100%;margin:4px 0}
#nutritionFoodApply{min-height:44px;width:100%}
</style></head><body class="dark">
<div id="app"><div id="userEmail">test@example.invalid</div><section id="nutritionPanel"><div class="v32-nutrition-pane v32-section-active"></div></section></div>
<div id="nutritionOverlay"><div class="modal" role="dialog" aria-modal="true" aria-label="Registro de alimentos">
<section class="nutrition-food-quick-access" id="nutritionFoodQuickAccess">
 <div class="nutrition-food-quick-access-head"><div><strong>Accesos rápidos</strong><small>Volvé a usar alimentos que ya cargaste</small></div>
  <div class="nutrition-food-quick-tabs" role="tablist" aria-label="Alimentos guardados">
   <button type="button" class="nutrition-food-quick-tab is-active" id="nutritionFoodRecentTab" role="tab" aria-selected="true" aria-controls="nutritionFoodQuickList">Recientes</button>
   <button type="button" class="nutrition-food-quick-tab" id="nutritionFoodFavoritesTab" role="tab" aria-selected="false" aria-controls="nutritionFoodQuickList">★ Favoritos</button>
  </div>
 </div>
 <div class="nutrition-food-quick-list" id="nutritionFoodQuickList" role="tabpanel" aria-live="polite"></div>
 <div class="nutrition-food-quick-status" id="nutritionFoodQuickStatus" role="status" aria-live="polite"></div>
 <p class="nutrition-food-quick-note">“Agregar rápido” utiliza una cantidad compatible; guardá la comida para conservar el cambio.</p>
</section>
<div id="nutritionFoodCatalog" hidden><button type="button" id="nutritionFoodCatalogToggle">Abrir catálogo</button>
 <div id="nutritionFoodCatalogStatus" role="status" aria-live="polite"></div>
 <div id="nutritionFoodSelected"></div><input id="nutritionFoodQuantity" value="100" type="number" />
 <select id="nutritionFoodQuantityUnit"><option value="g">g</option></select>
 <select id="nutritionFoodPreparationState"><option value="unspecified">Sin especificar</option><option value="raw">Crudo</option><option value="cooked">Cocido</option><option value="prepared">Preparado</option></select>
 <button type="button" id="nutritionFoodApply">Agregar</button></div>
</div>
<script>
window.currentUser={id:'test-account'};
(() => {
 let selected=null;
 const unit=document.getElementById('nutritionFoodQuantityUnit');
 const qty=document.getElementById('nutritionFoodQuantity');
 const prep=document.getElementById('nutritionFoodPreparationState');
 const apply=document.getElementById('nutritionFoodApply');
 document.getElementById('nutritionFoodCatalogToggle').addEventListener('click',()=>{document.getElementById('nutritionFoodCatalog').hidden=false});
 window.AgendaFoodCatalog={
  select(food){
   selected={...food};
   const options=[['g','g']];
   if(Number(food.densityGPerMl)>0)options.push(['ml','ml']);
   if(Number(food.gramsPerUnit)>0)options.push(['unit','unidad']);
   if(Number(food.gramsPerPortion)>0)options.push(['portion','porción']);
   unit.innerHTML=options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
   unit.value=options.some(([v])=>v===food.unit)?food.unit:'g';
   qty.value=food.defaultQuantity||100;prep.value=food.lastPreparationState||food.preparationState||'unspecified';
   apply.disabled=Array.isArray(food.nutritionMissing)&&food.nutritionMissing.length>0;
   document.getElementById('nutritionFoodCatalogStatus').textContent=apply.disabled?'Faltan nutrientes':'Seleccionado';
   document.dispatchEvent(new CustomEvent('agenda:nutrition-selected-food-changed',{detail:{food:selected}}));
  },
  getSelectedFood(){return selected;}
 };
 apply.addEventListener('click',()=>{
  if(!selected||apply.disabled)return;
  const event={food:selected,quantity:Number(qty.value),unit:unit.value,preparationState:prep.value};
  window.lastAdded=event;
  document.dispatchEvent(new CustomEvent('agenda:nutrition-food-added',{detail:event}));
 });
})();
</script>
</body></html>'''

async def run():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'fixture': 'real quick-access JS + E7 CSS; mocked food catalog/apply handler; no Supabase', 'viewports': []}
    async with async_playwright() as p:
        chromium = Path('/usr/bin/chromium')
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path=str(chromium) if chromium.is_file() else None)
        for width, height in [(320, 740), (390, 844), (768, 1024)]:
            page = await browser.new_page(viewport={'width': width, 'height': height}, is_mobile=width < 700, has_touch=width < 700)
            await page.set_content(fixture_html(), wait_until='domcontentloaded')
            await page.evaluate('''() => {
              const backing={};
              Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>Object.prototype.hasOwnProperty.call(backing,key)?backing[key]:null,setItem:(key,value)=>{backing[key]=String(value)},removeItem:key=>{delete backing[key]}}});
              const sample={id:'oats-test',name:'Avena arrollada',brand:'',source:'Prueba local',sourceLabel:'Prueba local',sourceType:'manual',unit:'g',defaultQuantity:100,lastQuantity:65,lastUnit:'g',lastPreparationState:'unspecified',lastUsedAt:new Date().toISOString(),useCount:1,calories:370,protein:13,carbs:62,fat:7,fiber:10,nutritionMissing:[],nutritionQualityStatus:'user_verified'};
              localStorage.setItem('agenda-nutrition-quick-access-v1:test-account',JSON.stringify({version:1,favorites:[sample],recent:[sample]}));
            }''')
            await page.add_script_tag(path=str(ROOT / 'js' / '56-nutrition-quick-access.js'))
            await page.wait_for_selector('.nutrition-food-quick-add')
            # Assert layout and the target size at each screen width.
            layout = await page.evaluate('''() => {
              const host=document.getElementById('nutritionFoodQuickList');
              const buttons=[...host.querySelectorAll('button')].map(b=>({text:b.textContent.trim(),height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width}));
              return {width:innerWidth,docWidth:document.documentElement.scrollWidth,hostWidth:host.getBoundingClientRect().width,cardCount:host.querySelectorAll('.nutrition-food-quick-card').length,buttons,quickButton:buttons.find(b=>b.text.startsWith('＋ Agregar'))};
            }''')
            assert layout['docWidth'] == width, f'horizontal overflow at {width}px: {layout}'
            assert layout['cardCount'] == 1, f'expected one quick card at {width}px'
            assert layout['quickButton'] and layout['quickButton']['height'] >= 43.5, f'quick-add target too small at {width}px: {layout}'
            if width <= 390:
                await page.screenshot(path=str(OUT / f'quick-access-{width}px.png'), full_page=True)
            if width == 320:
                await page.get_by_role('button', name='Agregar Avena arrollada, 65 g, a la comida actual').click()
                await page.wait_for_function("document.getElementById('nutritionFoodQuickStatus').textContent.includes('agregado al borrador')")
                state = await page.evaluate('''() => ({added:window.lastAdded,store:JSON.parse(localStorage.getItem('agenda-nutrition-quick-access-v1:test-account')),status:document.getElementById('nutritionFoodQuickStatus').textContent})''')
                assert state['added']['quantity'] == 65 and state['added']['unit'] == 'g', state
                recent=state['store']['recent'][0]
                assert recent['lastQuantity'] == 65 and recent['lastUnit'] == 'g', state
                assert 'Guardá la comida' in state['status'], state
                report['quickAddBehavior']={'quantity':state['added']['quantity'],'unit':state['added']['unit'],'recentUpdated':True,'status':state['status']}
                # An incomplete favourite must ask for review and never fire the add event.
                await page.evaluate('''() => {
                  const store=JSON.parse(localStorage.getItem('agenda-nutrition-quick-access-v1:test-account'));
                  store.favorites=[{name:'Producto incompleto',unit:'g',defaultQuantity:100,lastQuantity:100,lastUnit:'g',nutritionMissing:['proteínas'],calories:20}];
                  localStorage.setItem('agenda-nutrition-quick-access-v1:test-account',JSON.stringify(store));
                  document.getElementById('nutritionFoodFavoritesTab').click();
                  window.addedCount=0;document.addEventListener('agenda:nutrition-food-added',()=>window.addedCount++);
                }''')
                await page.locator('.nutrition-food-quick-add').click()
                await page.wait_for_function("document.getElementById('nutritionFoodQuickStatus').textContent.includes('No se agregó automáticamente')")
                assert await page.evaluate('window.addedCount') == 0, 'incomplete nutrition should not be quick-added'
                report['incompleteFoodBlocked'] = True
                # Change the active account and verify that the quick-access list follows it.
                await page.evaluate('''() => {
                  const other={name:'Alimento de otra cuenta',unit:'g',defaultQuantity:100,calories:90,protein:1,carbs:20,fat:0,nutritionMissing:[]};
                  localStorage.setItem('agenda-nutrition-quick-access-v1:other-account',JSON.stringify({version:1,favorites:[other],recent:[other]}));
                  window.currentUser={id:'other-account'};
                  document.getElementById('userEmail').textContent='other@example.invalid';
                  document.getElementById('nutritionFoodRecentTab').click();
                }''')
                await page.wait_for_function("document.getElementById('nutritionFoodQuickList').textContent.includes('Alimento de otra cuenta')")
                account_names=await page.locator('#nutritionFoodQuickList').inner_text()
                assert 'Alimento de otra cuenta' in account_names and 'Avena arrollada' not in account_names, account_names
                report['accountIsolation'] = True
            report['viewports'].append({k:v for k,v in layout.items() if k!='buttons'} | {'smallestQuickButtonHeight':min(b['height'] for b in layout['buttons'])})
            await page.close()
        await browser.close()
    (OUT / 'quick-registration-browser-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('E7 browser audit: PASS (320, 390, 768 px; quick-add behavior; incomplete data blocked)')
    print(f'Report: {OUT / "quick-registration-browser-audit.json"}')

if __name__ == '__main__':
    asyncio.run(run())
