#!/usr/bin/env python3
"""E28 browser audit: restore archived shopping products and safely edit manual ones."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RESULT = ROOT / 'tests' / 'artifacts' / 'e28' / 'shopping-recovery-browser-audit.json'
JS = (ROOT / 'js' / '62-nutrition-week-planner-shopping.js').read_text()
CSS = [(ROOT/'css'/'83-nutrition-week-planner-shopping.css').read_text(),
       (ROOT/'css'/'107-nutrition-shopping-workflow-e26.css').read_text(),
       (ROOT/'css'/'108-nutrition-shopping-review-e27.css').read_text(),
       (ROOT/'css'/'109-nutrition-shopping-recovery-e28.css').read_text()]
checks=[]
def check(name, passed, details=''):
    checks.append({'name':name,'passed':bool(passed),'details':details})
    if not passed: raise AssertionError(f'{name}: {details}')

fixture = r"""
window.currentUser={id:'e28-user'};
window.__shoppingWriteCount=0;
window.__shoppingRows=[
 {id:'201',user_id:'e28-user',week_start:'2026-10-19',item_key:'generated:avena||unspecified|g|quantity-known',name:'Avena',brand:'',quantity:400,quantity_known:true,unit:'g',preparation_state:'unspecified',category:'Almacén',checked:false,active:true,source:'generated',source_meals:['m1'],updated_at:'t-avena'},
 {id:'202',user_id:'e28-user',week_start:'2026-10-19',item_key:'manual:tomate',name:'Tomate',brand:'',quantity:4,quantity_known:true,unit:'unit',preparation_state:'unspecified',category:'Verdulería',checked:false,active:true,source:'manual',source_meals:[],updated_at:'t-tomate'},
 {id:'203',user_id:'e28-user',week_start:'2026-10-19',item_key:'manual:leche',name:'Leche manual',brand:'',quantity:1,quantity_known:true,unit:'l',preparation_state:'unspecified',category:'Lácteos',checked:true,active:true,source:'manual',source_meals:[],updated_at:'t-leche'},
 {id:'204',user_id:'e28-user',week_start:'2026-10-19',item_key:'generated:pan||unspecified|unit|quantity-known',name:'Pan',brand:'',quantity:1,quantity_known:true,unit:'unit',preparation_state:'unspecified',category:'Panadería',checked:false,active:false,source:'generated',source_meals:['old'],updated_at:'t-pan'}
];
window.AgendaNutritionWeeklyPlan={getShoppingSource:async()=>({meals:[{id:'m1'}],items:[{meal_id:'m1',name:'Avena',quantity:400,unit:'g'}]})};
window.ensureSupabase=async()=>({from(table){if(table!=='nutrition_shopping_items')throw new Error('tabla inesperada: '+table);let mode='select',filters=[],payload=null,selection='*';const matches=row=>filters.every(([kind,key,value])=>kind==='eq'?row[key]===value:row[key]===value);const query={
 select(columns='*'){selection=columns;return query},
 eq(key,value){filters.push(['eq',key,value]);return query},
 is(key,value){filters.push(['is',key,value]);return query},
 order(){return query},
 range(start,end){const data=window.__shoppingRows.filter(matches).slice(start,end+1).map(x=>({...x}));return Promise.resolve({data,error:null})},
 update(value){mode='update';payload=value;return query},
 upsert:async(incoming)=>{window.__shoppingWriteCount++;for(const value of incoming){const found=window.__shoppingRows.find(x=>x.user_id===value.user_id&&x.week_start===value.week_start&&x.item_key===value.item_key);if(found){const checked=found.checked;Object.assign(found,value);if(!Object.prototype.hasOwnProperty.call(value,'checked'))found.checked=checked}else window.__shoppingRows.push({...value,id:String(300+window.__shoppingRows.length+1)})}return {error:null}},
 delete(){mode='delete';return query},
 single:async()=>{const row=window.__shoppingRows.find(matches);if(!row)return {data:null,error:{message:'No row matched filters'}};if(mode==='update'){window.__shoppingWriteCount++;Object.assign(row,payload);if(selection==='id,active')return {data:{id:row.id,active:row.active},error:null};return {data:{id:row.id},error:null}}if(selection==='id,checked')return {data:{id:row.id,checked:row.checked},error:null};return {data:{...row},error:null}},
 then(resolve,reject){try{if(mode==='update'){let changed=0;for(const row of window.__shoppingRows.filter(matches)){Object.assign(row,payload);changed++}if(changed)window.__shoppingWriteCount++;resolve({data:null,error:null})}else if(mode==='delete'){window.__shoppingRows=window.__shoppingRows.filter(row=>!matches(row));window.__shoppingWriteCount++;resolve({data:null,error:null})}else resolve({data:null,error:null})}catch(e){reject(e)}}
};return query}});
"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="nutritionPanel"><div class="nutrition-actions"></div></main></body></html>')
    for css in CSS: page.add_style_tag(content=css)
    page.add_script_tag(content=fixture);page.add_script_tag(content=JS)
    page.get_by_role('button',name='🛒 Lista de compras').click()
    dialog=page.get_by_role('dialog',name='Lista de compras');dialog.wait_for()
    page.wait_for_function("document.querySelectorAll('.nutrition-shopping-row').length===3")
    check('Archived recovery control is shown with correct count',page.get_by_role('button',name='Ver archivados (1)').is_visible())
    check('Purchased manual item is not offered for editing',page.get_by_role('button',name='Editar producto manual Leche manual').count()==0)
    check('Unpurchased manual product has edit action',page.get_by_role('button',name='Editar producto manual Tomate').is_visible())
    page.get_by_role('button',name='Ver archivados (1)').click()
    archive=page.locator('#nutritionShoppingArchivePanel')
    check('Archived panel expands and announces item detail',archive.is_visible() and 'Pan' in archive.inner_text(),archive.inner_text())
    RESULT.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(RESULT.parent/'e28-shopping-archive-panel-mobile.png'),full_page=True)
    page.get_by_role('button',name='Restaurar Pan').click()
    page.wait_for_function("window.__shoppingRows.find(x=>x.id==='204').active===true")
    check('Restoring an archived product writes only after the action',page.evaluate("window.__shoppingRows.find(x=>x.id==='204').active===true && window.__shoppingRows.find(x=>x.id==='204').checked===false"))
    page.wait_for_function("document.querySelectorAll('.nutrition-shopping-row').length===4")
    check('Restored product returns to active list and archive count falls to zero',page.get_by_role('button',name='Ver archivados (0)').count()==0 and page.get_by_text('Pan',exact=True).count()>=1)
    # Edit a manual row and ensure fields are updated without changing ownership/source/item key.
    page.get_by_role('button',name='Editar producto manual Tomate').click()
    form=page.get_by_role('form',name='Editar producto manual Tomate')
    form.wait_for()
    form.get_by_role('button',name='Guardar').scroll_into_view_if_needed()
    check('Inline edit actions can be brought into view on a short mobile screen',form.get_by_role('button',name='Guardar').is_visible() and page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    page.screenshot(path=str(RESULT.parent/'e28-shopping-inline-edit-mobile.png'),full_page=True)
    form.locator('input[name="name"]').fill('Tomate perita')
    form.locator('input[name="quantity"]').fill('8')
    form.locator('select[name="unit"]').select_option('unit')
    form.locator('select[name="category"]').select_option('Verdulería')
    form.get_by_role('button',name='Guardar').click()
    page.wait_for_function("window.__shoppingRows.find(x=>x.id==='202').name==='Tomate perita'")
    edited=page.evaluate("window.__shoppingRows.find(x=>x.id==='202')")
    check('Manual edit updates allowed fields and preserves stable identifiers',edited['quantity']==8 and edited['source']=='manual' and edited['item_key']=='manual:tomate' and edited['user_id']=='e28-user',str(edited))
    check('Manual edit gives a clear success status','Se actualizó «Tomate perita»' in page.locator('.nutrition-week-status').inner_text())
    # Cancellation of inline editing must never write to database.
    before=page.evaluate('window.__shoppingWriteCount')
    page.get_by_role('button',name='Editar producto manual Tomate perita').click()
    page.get_by_role('form',name='Editar producto manual Tomate perita').locator('input[name="name"]').fill('Cambio cancelado')
    page.get_by_role('button',name='Cancelar',exact=True).click()
    check('Canceling inline edit is a no-write operation',page.evaluate('window.__shoppingWriteCount')==before and page.evaluate("window.__shoppingRows.find(x=>x.id==='202').name==='Tomate perita'"))
    # Concurrent version change between initial render and edit-save must be rejected.
    page.get_by_role('button',name='Editar producto manual Tomate perita').click()
    page.get_by_role('form',name='Editar producto manual Tomate perita').locator('input[name="name"]').fill('Edición obsoleta')
    page.evaluate("window.__shoppingRows.find(x=>x.id==='202').updated_at='changed-on-other-device'")
    before=page.evaluate('window.__shoppingWriteCount')
    page.get_by_role('button',name='Guardar').click()
    page.get_by_text('No se pudo guardar la edición',exact=False).wait_for()
    check('Stale manual edit is rejected without overwriting newer data',page.evaluate('window.__shoppingWriteCount')==before and page.evaluate("window.__shoppingRows.find(x=>x.id==='202').name==='Tomate perita'"))
    check('Mobile layout has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),str(page.evaluate('({doc:document.documentElement.scrollWidth,width:window.innerWidth})')))
    RESULT.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(RESULT.parent/'e28-shopping-recovery-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1365,'height':900});page.screenshot(path=str(RESULT.parent/'e28-shopping-recovery-desktop.png'),full_page=True)
    browser.close()
RESULT.parent.mkdir(parents=True,exist_ok=True)
RESULT.write_text(json.dumps({'stage':'E28','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False))
