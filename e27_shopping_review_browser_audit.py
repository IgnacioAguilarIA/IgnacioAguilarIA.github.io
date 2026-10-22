#!/usr/bin/env python3
"""E27 browser audit: preview-first purchase-list sync, staleness protection, preserve/refresh purchased quantities."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RESULT = ROOT / 'tests' / 'artifacts' / 'e27' / 'shopping-review-browser-audit.json'
JS = (ROOT / 'js' / '62-nutrition-week-planner-shopping.js').read_text()
CSS_BASE = (ROOT / 'css' / '83-nutrition-week-planner-shopping.css').read_text()
CSS_E26 = (ROOT / 'css' / '107-nutrition-shopping-workflow-e26.css').read_text()
CSS_E27 = (ROOT / 'css' / '108-nutrition-shopping-review-e27.css').read_text()
checks=[]
def check(name, passed, details=''):
    checks.append({'name':name,'passed':bool(passed),'details':details})
    if not passed: raise AssertionError(f'{name}: {details}')

fixture = r"""
window.currentUser={id:'e27-user'};
window.__shoppingWriteCount=0;
window.__shoppingRows=[
 {id:'101',user_id:'e27-user',week_start:'2026-10-19',item_key:'generated:avena||unspecified|g|quantity-known',name:'Avena',brand:'',quantity:400,quantity_known:true,unit:'g',preparation_state:'unspecified',category:'Almacén',checked:false,active:true,source:'generated',source_meals:['old-meal'],updated_at:'t-avena'},
 {id:'102',user_id:'e27-user',week_start:'2026-10-19',item_key:'generated:leche|marca|unspecified|l|quantity-known',name:'Leche',brand:'Marca',quantity:1,quantity_known:true,unit:'l',preparation_state:'unspecified',category:'Lácteos',checked:true,active:true,source:'generated',source_meals:['m1'],updated_at:'t-leche'},
 {id:'103',user_id:'e27-user',week_start:'2026-10-19',item_key:'generated:pan||unspecified|unit|quantity-known',name:'Pan',brand:'',quantity:1,quantity_known:true,unit:'unit',preparation_state:'unspecified',category:'Panadería',checked:false,active:true,source:'generated',source_meals:['old-meal'],updated_at:'t-pan'},
 {id:'104',user_id:'e27-user',week_start:'2026-10-19',item_key:'manual:eggs',name:'Huevos',brand:'',quantity:6,quantity_known:true,unit:'unit',preparation_state:'unspecified',category:'Otros',checked:false,active:true,source:'manual',source_meals:[],updated_at:'t-eggs'}
];
window.__shoppingPlanItems=[
 {name:'Avena',brand:'',quantity:500,quantity_known:true,unit:'g',preparation_state:'unspecified',categories:'Almacén',meal_id:'m1'},
 {name:'Avena',brand:'',quantity:250,quantity_known:true,unit:'g',preparation_state:'unspecified',categories:'Almacén',meal_id:'m2'},
 {name:'Leche',brand:'Marca',quantity:2,quantity_known:true,unit:'l',preparation_state:'unspecified',categories:'Lácteos',meal_id:'m1'},
 {name:'Banana',brand:'',quantity:3,quantity_known:true,unit:'unit',preparation_state:'unspecified',categories:'Verdulería',meal_id:'m3'},
 {name:'Especias',brand:'',quantity:null,quantity_known:false,unit:'g',preparation_state:'unspecified',categories:'Almacén',meal_id:'m4'}
];
window.AgendaNutritionWeeklyPlan={getShoppingSource:async(owner,week)=>({meals:[{id:'m1'},{id:'m2'},{id:'m3'},{id:'m4'}],items:window.__shoppingPlanItems.map(x=>({...x}))})};
window.ensureSupabase=async()=>({from(table){if(table!=='nutrition_shopping_items')throw new Error('tabla inesperada: '+table);let mode='select',filters=[],payload=null;const matches=row=>filters.every(([key,value])=>row[key]===value);const query={
 select(){return query},
 eq(key,value){filters.push([key,value]);return query},
 order(){return query},
 range(start,end){const data=window.__shoppingRows.filter(matches).slice(start,end+1).map(x=>({...x}));return Promise.resolve({data,error:null})},
 upsert:async(incoming)=>{window.__shoppingWriteCount++;for(const value of incoming){const found=window.__shoppingRows.find(x=>x.user_id===value.user_id&&x.week_start===value.week_start&&x.item_key===value.item_key);if(found){const checked=found.checked;Object.assign(found,value);if(!Object.prototype.hasOwnProperty.call(value,'checked'))found.checked=checked}else window.__shoppingRows.push({...value,id:String(1000+window.__shoppingRows.length+1),updated_at:value.updated_at})}return {error:null}},
 update(value){mode='update';payload=value;return query},
 delete(){mode='delete';return query},
 single:async()=>{const row=window.__shoppingRows.find(matches);if(!row)return {data:null,error:{message:'row missing'}};if(mode==='update'){window.__shoppingWriteCount++;Object.assign(row,payload)}return {data:{id:row.id},error:null}},
 then(resolve,reject){try{if(mode==='update'){window.__shoppingWriteCount++;for(const row of window.__shoppingRows.filter(matches))Object.assign(row,payload);resolve({data:null,error:null})}else if(mode==='delete'){resolve({data:null,error:null})}else resolve({data:null,error:null})}catch(e){reject(e)}}
};return query}});
"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="nutritionPanel"><div class="nutrition-actions"></div></main></body></html>')
    page.add_style_tag(content=CSS_BASE); page.add_style_tag(content=CSS_E26); page.add_style_tag(content=CSS_E27); page.add_script_tag(content=fixture); page.add_script_tag(content=JS)
    page.get_by_role('button',name='🛒 Lista de compras').click()
    page.get_by_role('dialog',name='Lista de compras').wait_for()
    page.wait_for_function("document.querySelectorAll('.nutrition-shopping-row').length===4")
    page.get_by_role('button',name='Generar desde el plan').click()
    review=page.get_by_role('region',name='Revisión de cambios de la lista de compras')
    review.wait_for(state='visible')
    check('Keyboard focus enters the review heading without jumping to the bottom', page.evaluate("document.activeElement.textContent==='Revisar cambios antes de sincronizar'"), page.evaluate('document.activeElement.textContent'))
    check('Preview shown before first write', page.evaluate('window.__shoppingWriteCount===0'), str(page.evaluate('window.__shoppingWriteCount')))
    check('Preview summarizes additions updates and archive', '2 nuevos' in review.inner_text() and '2 actualizaciones' in review.inner_text() and '1 pendientes a archivar' in review.inner_text(), review.locator('.nutrition-shopping-review-summary-e27').inner_text())
    check('Unknown quantities are explicitly warned', 'cantidad o unidad no verificable' in review.inner_text(), review.inner_text())
    check('Purchased quantity change has safe default unchecked', review.get_by_role('checkbox',name='Actualizar también las cantidades de productos que ya están marcados como comprados.').is_visible() and not review.get_by_role('checkbox',name='Actualizar también las cantidades de productos que ya están marcados como comprados.').is_checked())
    check('Existing list is locked while proposal is open', page.locator('.nutrition-shopping-list input[type="checkbox"]').first.is_disabled())
    RESULT.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(RESULT.parent/'e27-shopping-preview-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1365,'height':900})
    page.screenshot(path=str(RESULT.parent/'e27-shopping-preview-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    review.get_by_role('button',name='Cancelar revisión').click()
    check('Cancel leaves database untouched', page.evaluate('window.__shoppingWriteCount===0'))
    page.get_by_role('button',name='Generar desde el plan').click(); review.wait_for(state='visible')
    # Simulate a second device changing the list after review. Fresh-signature validation must stop all writes.
    page.evaluate("window.__shoppingRows[0].quantity=123;window.__shoppingRows[0].updated_at='changed-on-other-device'")
    review.get_by_role('button',name='Aplicar cambios').click()
    page.get_by_text('El plan o la lista cambió mientras revisabas. No se aplicó esta propuesta.').wait_for()
    check('Stale preview is rejected without writes', page.evaluate('window.__shoppingWriteCount===0'))
    # Reopen preview with current data and apply, preserving purchased quantity by default.
    page.get_by_role('button',name='Generar desde el plan').click(); review.wait_for(state='visible')
    review.get_by_role('button',name='Aplicar cambios').click()
    page.get_by_text('Lista actualizada tras revisión').wait_for()
    rows=page.evaluate('window.__shoppingRows')
    oats=next(x for x in rows if x['item_key'].startswith('generated:avena'))
    milk=next(x for x in rows if x['item_key'].startswith('generated:leche'))
    bread=next(x for x in rows if x['name']=='Pan')
    banana=next(x for x in rows if x['name']=='Banana')
    manual=next(x for x in rows if x['name']=='Huevos')
    check('Applying updates planned amount while preserving purchased amount', oats['quantity']==750 and milk['quantity']==1 and milk['checked'] is True, str([(x['name'],x['quantity'],x['checked']) for x in (oats,milk)]))
    check('Obsolete generated pending row is archived not deleted', bread['active'] is False and any(x['id']==bread['id'] for x in rows))
    check('New product is inserted and manual item retained', banana['quantity']==3 and manual['active'] is True)
    check('Unverified quantity survives without becoming zero-known', any(x['name']=='Especias' and x['quantity_known'] is False for x in rows))
    check('Mobile preview has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), str(page.evaluate('({documentWidth:document.documentElement.scrollWidth,viewport:window.innerWidth})')))
    # A deliberate decision can update quantities on already-purchased products.
    page.evaluate("window.__shoppingPlanItems.find(x=>x.name==='Leche').quantity=3")
    page.get_by_role('button',name='Generar desde el plan').click(); review.wait_for(state='visible')
    quantity_choice=review.get_by_role('checkbox',name='Actualizar también las cantidades de productos que ya están marcados como comprados.')
    check('Purchased-quantity override is available only when needed', quantity_choice.is_visible())
    quantity_choice.check(); review.get_by_role('button',name='Aplicar cambios').click()
    page.get_by_text('Lista actualizada tras revisión').wait_for()
    milk=page.evaluate("window.__shoppingRows.find(x=>x.name==='Leche')")
    check('Explicit override updates purchased quantity without unchecking it', milk['quantity']==3 and milk['checked'] is True, str(milk))
    browser.close()
RESULT.parent.mkdir(parents=True,exist_ok=True)
RESULT.write_text(json.dumps({'stage':'E27','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False))
