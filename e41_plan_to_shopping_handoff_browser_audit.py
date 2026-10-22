#!/usr/bin/env python3
"""E41 browser audit for the guided plan-to-shopping handoff with separately confirmed writes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'tests' / 'artifacts' / 'e41'
RESULT = ARTIFACTS / 'plan-to-shopping-handoff-browser-audit.json'
SHOPPING_JS = (ROOT / 'js' / '62-nutrition-week-planner-shopping.js').read_text()
JS = (ROOT / 'js' / '63-nutrition-week-plan-editor.js').read_text()
CSS_FILES = [
    ROOT / 'css' / '00-inline-style-00.css',
    ROOT / 'css' / '03-v15-final-fixes.css',
    ROOT / 'css' / '86-nutrition-week-plan-editor.css',
    ROOT / 'css' / '110-nutrition-week-plan-quick-actions-e29.css',
    ROOT / 'css' / '111-nutrition-recipe-portion-adjustment-e30.css',
    ROOT / 'css' / '112-nutrition-week-plan-copy-day-e31.css',
    ROOT / 'css' / '113-nutrition-week-templates-e32.css',
    ROOT / 'css' / '114-nutrition-week-template-merge-e33.css',
    ROOT / 'css' / '115-nutrition-week-template-management-e34.css',
    ROOT / 'css' / '116-nutrition-week-template-comparison-e35.css',
    ROOT / 'css' / '117-nutrition-week-template-selection-e36.css',
    ROOT / 'css' / '118-nutrition-week-template-target-day-e37.css',
    ROOT / 'css' / '119-nutrition-week-template-bulk-target-e38.css',
    ROOT / 'css' / '120-nutrition-week-template-change-review-e39.css',
    ROOT / 'css' / '121-nutrition-week-template-shopping-impact-e40.css',
    ROOT / 'css' / '122-nutrition-week-template-shopping-handoff-e41.css',
]
checks = []
def check(name, passed, details=''):
    checks.append({'name': name, 'passed': bool(passed), 'details': details})
    if not passed: raise AssertionError(f'{name}: {details}')
fixture = r"""
window.currentUser={id:'user-e32'};
window.__planRows=[
 {id:'src-mon',user_id:'user-e32',week_start:'2026-10-19',day_offset:0,meal_type:'desayuno',title:'Avena original',planned_time:'08:00',notes:'Canela',source_meal_id:null,plan_key:'manual:src-mon',sort_order:0,ingredients_snapshot:[{name:'Avena',quantity:50,quantity_known:true,unit:'g',quality:{source:'catalog',confidence:'high'}}],nutrition_snapshot:{calories:190,protein_g:7,fiber_g:null,nutrition_missing_metrics:['fiber']},updated_at:'2026-10-19T08:00:00.000Z'},
 {id:'src-wed',user_id:'user-e32',week_start:'2026-10-19',day_offset:2,meal_type:'cena',title:'Sopa fuente',planned_time:'20:00',notes:'',source_meal_id:null,plan_key:'manual:src-wed',sort_order:0,ingredients_snapshot:[{name:'Zapallo',quantity:null,quantity_known:false,unit:'g',provenance:{source:'custom',reason:'unknown'}}],nutrition_snapshot:{calories:null,nutrition_missing_metrics:['calories','protein','carbs','fat','fiber']},updated_at:'2026-10-19T20:00:00.000Z'},
 {id:'dst-mon',user_id:'user-e32',week_start:'2026-10-26',day_offset:0,meal_type:'desayuno',title:'Desayuno ya organizado',planned_time:'08:30',notes:'No reemplazar',source_meal_id:null,plan_key:'manual:dst-mon',sort_order:0,ingredients_snapshot:[],nutrition_snapshot:{},updated_at:'2026-10-26T08:30:00.000Z'}
];
window.__planWrites=0;window.__preferenceWrites=0;window.__shoppingWrites=0;window.__shoppingRows=[];window.__seq=0;
window.__prefs={user_id:'user-e32',meal_order:['pre','post','lunch','snack','dinner','sleep'],weekly_plan_templates:[],updated_at:'2026-10-21T10:00:00.000Z',created_at:'2026-10-01T10:00:00.000Z'};
window.AgendaNutritionPlanner={loadPlan:async()=>({meals:[],byMeal:new Map()})};
window.AgendaNutritionData={loadRecipes:async()=>[]};
window.ensureSupabase=async()=>({from(table){let mode='select',filters=[],payload=null,options={},columns='*';const clone=x=>JSON.parse(JSON.stringify(x));const match=(row)=>filters.every(([key,val])=>String(row[key]??'')===String(val??''));const applyRows=()=>table==='nutrition_weekly_plan_items'?window.__planRows.filter(match):table==='nutrition_preferences'?(window.__prefs&&match(window.__prefs)?[window.__prefs]:[]):table==='nutrition_shopping_items'?window.__shoppingRows.filter(match):[];const q={select(cols='*'){columns=cols;return q},eq(key,value){filters.push([key,value]);return q},is(key,value){filters.push([key,value]);return q},order(key,opts={}){return q},range(start,end){return Promise.resolve({data:applyRows().slice(start,end+1).map(clone),error:null})},maybeSingle(){if(mode!=='select')return executeSingle();const found=applyRows();return Promise.resolve({data:found.length?clone(found[0]):null,error:null})},single(){return Promise.resolve(executeSingle())},insert(value){mode='insert';payload=clone(value);return q},update(value){mode='update';payload=clone(value);return q},upsert(value,opts={}){mode='upsert';payload=clone(value);options=opts;return q},delete(){mode='delete';return q},then(resolve,reject){return execute().then(resolve,reject)}};
async function executeSingle(){const r=await execute();if(r.error)return r;const arr=Array.isArray(r.data)?r.data:(r.data?[r.data]:[]);return {data:arr[0]||null,error:null}}
async function execute(){if(table==='nutrition_preferences'){
 if(mode==='insert'){if(window.__prefs)return {data:null,error:{code:'23505',message:'duplicate key'}};window.__prefs={user_id:payload.user_id,meal_order:['pre','post','lunch','snack','dinner','sleep'],weekly_plan_templates:clone(payload.weekly_plan_templates||[]),updated_at:'2026-10-21T10:00:01.000Z',created_at:'2026-10-21T10:00:01.000Z'};window.__preferenceWrites++;return {data:clone(window.__prefs),error:null}}
 if(mode==='update'){if(!window.__prefs||!match(window.__prefs))return {data:null,error:null};Object.assign(window.__prefs,clone(payload));window.__prefs.updated_at=new Date(Date.parse(window.__prefs.updated_at)+1000).toISOString();window.__preferenceWrites++;return {data:clone(window.__prefs),error:null}}
 return {data:applyRows().map(clone),error:null};
 }
 if(table==='nutrition_shopping_items'){if(mode==='select')return {data:applyRows().map(clone),error:null};window.__shoppingWrites++;return {data:null,error:{message:'Unexpected shopping-list write in read-only E40 audit'}}}
 if(table!=='nutrition_weekly_plan_items')return {data:null,error:{message:'unexpected table '+table}};
 if(mode==='upsert'){const vals=Array.isArray(payload)?payload:[payload];const out=[];for(const item of vals){let existing=window.__planRows.find(r=>r.user_id===item.user_id&&r.week_start===item.week_start&&r.plan_key===item.plan_key);if(existing){if(!options.ignoreDuplicates)Object.assign(existing,clone(item));out.push({id:existing.id,plan_key:existing.plan_key});continue;}const created={...clone(item),id:'plan-new-'+(++window.__seq),created_at:new Date().toISOString()};window.__planRows.push(created);out.push({id:created.id,plan_key:created.plan_key});}window.__planWrites++;return {data:out,error:null};}
 if(mode==='update'){return {data:null,error:{message:'unexpected update'}}}
 if(mode==='delete'){return {data:null,error:{message:'unexpected delete'}}}
 return {data:applyRows().map(clone),error:null};
}
return q;
}});
"""
ARTIFACTS.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1)
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="nutritionPanel"><div class="nutrition-actions"></div></main></body></html>')
    for css in CSS_FILES: page.add_style_tag(content=css.read_text())
    page.add_script_tag(content=fixture)
    page.add_script_tag(content=SHOPPING_JS)
    page.evaluate("""window.__shoppingRows=[{id:'shop-oats',user_id:'user-e32',week_start:'2026-10-26',item_key:window.AgendaNutritionPlanner.generatedKey({name:'Avena',brand:'',preparation_state:'unspecified',unit:'g',quantity:25,quantity_known:true}),name:'Avena',brand:'',quantity:25,quantity_known:true,unit:'g',preparation_state:'unspecified',category:'Otros',source:'generated',source_meals:['previous-meal'],checked:false,active:true,updated_at:'shopping-v1'}];""")
    page.add_script_tag(content=JS)
    page.get_by_role('button', name='🗓️ Planificar semana').click()
    dialog = page.get_by_role('dialog', name='Planificar semana'); dialog.wait_for()
    page.wait_for_function("document.querySelectorAll('.nutrition-plan-meal').length===2")
    toggle = dialog.get_by_role('button', name='Plantillas semanales')
    check('Template manager is visible and has correct accessible expanded state', toggle.is_visible() and toggle.get_attribute('aria-expanded') == 'false')
    toggle.click(); panel=dialog.locator('#nutritionWeekTemplatesPanelE32'); panel.wait_for()
    check('Opening the panel does not write plan rows', page.evaluate('window.__planWrites===0') and toggle.get_attribute('aria-expanded')=='true')
    panel.get_by_label('Nombre de la plantilla semanal').fill('Semana de estudio')
    panel.get_by_role('button', name='Guardar semana actual').click()
    page.get_by_text('Plantilla «Semana de estudio» guardada', exact=False).wait_for()
    check('Saving stores a user-scoped weekly snapshot in preferences', page.evaluate("window.__prefs.weekly_plan_templates.length===1 && window.__prefs.weekly_plan_templates[0].items.length===2 && window.__preferenceWrites===1"))
    saved = page.evaluate("window.__prefs.weekly_plan_templates[0]")
    check('Template does not store source row IDs/user IDs and preserves nutrition metadata', all('id' not in item and 'user_id' not in item for item in saved['items']) and saved['items'][0]['ingredients_snapshot'][0]['quality']['confidence']=='high' and saved['items'][1]['ingredients_snapshot'][0]['quantity_known'] is False)
    date = dialog.locator('.nutrition-plan-week-label input[type=date]'); date.fill('2026-10-26'); date.dispatch_event('change')
    page.wait_for_function("document.querySelector('.nutrition-plan-week-label input[type=date]').value==='2026-10-26' && document.querySelectorAll('.nutrition-plan-meal').length===1 && document.body.innerText.includes('Desayuno ya organizado')")
    panel=dialog.locator('#nutritionWeekTemplatesPanelE32')
    card=panel.locator('.nutrition-week-template-card-e34').filter(has_text='Semana de estudio')
    select_toggle=card.get_by_role('button', name='Elegir comidas de Semana de estudio')
    select_toggle.click()
    selection=card.locator('.nutrition-week-template-meal-selection-e36')
    selection.wait_for()
    checkboxes=selection.locator('input[type=checkbox]')
    check('Opening selective apply exposes accessible checkboxes and selects the template contents by default', selection.is_visible() and checkboxes.count()==2 and all(checkboxes.nth(i).is_checked() for i in range(2)) and select_toggle.get_attribute('aria-expanded')=='true')
    target_days=selection.locator('select.nutrition-week-template-target-day-e37')
    check('Each selected meal has an accessible destination-day selector defaulted to its source day', target_days.count()==2 and target_days.nth(0).get_attribute('aria-label')=='Día de destino para Avena original' and target_days.nth(0).input_value()=='0' and target_days.nth(1).input_value()=='2')
    bulk_target=selection.get_by_label('Día común para las comidas seleccionadas')
    bulk_apply=selection.get_by_role('button',name='Asignar día a seleccionadas')
    bulk_reset=selection.get_by_role('button',name='Restaurar días originales')
    check('E38 presents accessible bulk-day controls and enables them for the selected meals', bulk_target.is_visible() and bulk_apply.is_enabled() and bulk_reset.is_disabled())
    bulk_target.select_option('5')
    bulk_apply.click()
    check('Bulk assign moves every selected meal to the chosen day and updates individual selectors without writing', target_days.nth(0).input_value()=='5' and target_days.nth(1).input_value()=='5' and '2 cambian de día' in selection.locator('.nutrition-week-template-meal-selection-summary-e36').inner_text() and page.evaluate('window.__planWrites===0'))
    check('Bulk assign disables itself when all selected meals already use the chosen day', bulk_apply.is_disabled())
    bulk_reset.click()
    check('Bulk reset restores the different original days for each selected meal', target_days.nth(0).input_value()=='0' and target_days.nth(1).input_value()=='2' and 'cambian de día' not in selection.locator('.nutrition-week-template-meal-selection-summary-e36').inner_text() and page.evaluate('window.__planWrites===0'))
    check('Bulk reset does not write until the ordinary preview is confirmed', page.evaluate("window.__planWrites===0 && window.__planRows.filter(r=>r.week_start==='2026-10-26').length===1"))
    checkboxes.nth(1).uncheck()
    bulk_target.select_option('4')
    bulk_apply.click()
    check('Bulk assign affects only checked meals and preserves the unchecked meal destination', target_days.nth(0).input_value()=='4' and target_days.nth(1).input_value()=='2' and '1 cambia de día' in selection.locator('.nutrition-week-template-meal-selection-summary-e36').inner_text())
    check('Selection panel is non-destructive before preview or confirm', page.evaluate('window.__planWrites===0 && window.__preferenceWrites===1 && window.__planRows.filter(r=>r.week_start===\'2026-10-26\').length===1'))
    selection.get_by_role('button', name='Limpiar selección').click()
    check('Clearing selection disables preview and does not write data', not checkboxes.nth(0).is_checked() and not checkboxes.nth(1).is_checked() and selection.get_by_role('button',name='Previsualizar seleccionadas').is_disabled() and page.evaluate('window.__planWrites===0'))
    checkboxes.nth(0).check()
    check('Selection summary tracks exactly one selected meal', '1 de 2 comidas seleccionadas' in selection.locator('.nutrition-week-template-meal-selection-summary-e36').inner_text() and selection.get_by_role('button',name='Previsualizar seleccionadas').is_enabled())
    target_days.nth(0).select_option('4')
    check('Choosing Friday updates the selected-meal summary without writing data', '1 cambia de día' in selection.locator('.nutrition-week-template-meal-selection-summary-e36').inner_text() and page.evaluate('window.__planWrites===0'))
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    preview=panel.locator('.nutrition-week-templates-preview-e32'); preview.wait_for()
    summary=preview.locator('.nutrition-week-templates-preview-summary-e32')
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-summary-e32').textContent.includes('Selección parcial')")
    summary_text=summary.inner_text()
    check('Selective preview reports selected subset and automatically preserves an occupied day by merging', 'Selección parcial: 1 de 2 comidas' in summary_text and 'se agregarán 1 comida en 1 día' in summary_text and 'conservando todo lo existente' in summary_text, summary_text)
    check('Preview explains that the meal is moved from Monday to Friday', 'Avena original: Lunes → Viernes' in summary_text and 'Se reubicarán 1 comida' in summary_text, summary_text)
    review = preview.locator('.nutrition-week-template-change-review-e39')
    check('E39 adds a consolidated change review inside the preview without writing data', review.is_visible() and review.get_by_text('Revisión consolidada de cambios', exact=True).is_visible() and page.evaluate('window.__planWrites===0'))
    impact = review.locator('.nutrition-week-template-shopping-impact-e40')
    check('E40 shows a read-only shopping impact estimate in the consolidated review', impact.is_visible() and 'solo lectura' in impact.inner_text() and page.evaluate('window.__shoppingWrites===0 && window.__planWrites===0'))
    impact_stats = impact.locator('.nutrition-week-template-shopping-impact-stat-e40')
    check('E40 summarizes new, updated, purchased-conflict and unknown-quantity shopping products', impact_stats.count()==6 and 'Nuevos en lista' in impact.inner_text() and 'Comprados por revisar' in impact.inner_text() and 'Cantidades sin definir' in impact.inner_text())
    impact_details = impact.locator('.nutrition-week-template-shopping-impact-details-e40')
    impact_details.locator('summary').click()
    check('E40 details list includes the item quantity delta from the current list to the plan projection', 'Avena' in impact.locator('.nutrition-week-template-shopping-impact-list-e40').inner_text() and '25 g' in impact.locator('.nutrition-week-template-shopping-impact-list-e40').inner_text() and '50 g' in impact.locator('.nutrition-week-template-shopping-impact-list-e40').inner_text(), impact.locator('.nutrition-week-template-shopping-impact-list-e40').inner_text())
    check('E40 shopping impact is a read-only estimate and does not alter checked state or rows', page.evaluate("window.__shoppingRows.length===1 && window.__shoppingRows[0].quantity===25 && window.__shoppingRows[0].checked===false && window.__shoppingWrites===0"))
    review_stats = review.locator('.nutrition-week-template-change-review-stat-e39')
    check('Consolidated review summarizes new meals, occupied days, quantities, and incomplete nutrition', review_stats.count()==6 and review.inner_text().find('Por agregar')>=0 and review.inner_text().find('Cantidades desconocidas')>=0 and review.inner_text().find('Comidas con nutrientes incompletos')>=0)
    details = review.locator('.nutrition-week-template-change-review-details-e39')
    details.locator('summary').click()
    item_rows = review.locator('.nutrition-week-template-change-review-item-e39')
    check('Detail disclosure exposes the selected meal, source-to-target route, and quality warning', item_rows.count()==1 and 'Avena original' in item_rows.nth(0).inner_text() and 'Lunes → Viernes' in item_rows.nth(0).inner_text() and 'nutrientes incompletos' in item_rows.nth(0).inner_text())
    target_days.nth(0).select_option('0')
    check('Changing the destination invalidates the consolidated review before confirmation', preview.is_hidden() and page.evaluate('window.__planWrites===0'))
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false && document.querySelector('.nutrition-week-template-change-review-e39').hidden===false")
    details = preview.locator('.nutrition-week-template-change-review-details-e39')
    details.locator('summary').click()
    occupied_row = preview.locator('.nutrition-week-template-change-review-item-e39')
    check('Occupied destination is explicitly described and existing meal is named as preserved', occupied_row.count()==1 and 'Desayuno ya organizado' in occupied_row.nth(0).inner_text() and 'se conservarán sin cambios' in occupied_row.nth(0).inner_text() and page.evaluate('window.__planWrites===0'))
    page.screenshot(path=str(ARTIFACTS/'weekly-template-change-review-mobile.png'), full_page=True)
    check('Add-status badge has readable green contrast in dark mode', occupied_row.nth(0).locator('.nutrition-week-template-change-review-badge-e39').evaluate('(el) => getComputedStyle(el).color') == 'rgb(134, 239, 172)')
    page.locator('body').evaluate('(element) => element.classList.add("light")')
    check('E39 review warning remains readable in light mode', occupied_row.nth(0).locator('.nutrition-week-template-change-review-warning-e39').first.evaluate('(el) => getComputedStyle(el).color') == 'rgb(101, 61, 9)')
    check('Add-status badge has readable green contrast in light mode', occupied_row.nth(0).locator('.nutrition-week-template-change-review-badge-e39').evaluate('(el) => getComputedStyle(el).color') == 'rgb(22, 101, 52)')
    page.screenshot(path=str(ARTIFACTS/'weekly-template-change-review-mobile-light.png'), full_page=True)
    page.locator('body').evaluate('(element) => element.classList.remove("light")')
    target_days.nth(0).select_option('4')
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-summary-e32').textContent.includes('Avena original: Lunes → Viernes')")
    refreshed_details = preview.locator('.nutrition-week-template-change-review-details-e39')
    refreshed_details.locator('summary').click()
    check('New consolidated review refreshes after the destination is restored', preview.is_visible() and 'Lunes → Viernes' in preview.locator('.nutrition-week-template-change-review-item-e39').inner_text() and page.evaluate('window.__planWrites===0'))
    bulk_target.select_option('3')
    bulk_apply.click()
    check('A bulk destination change invalidates an already-open preview before confirmation', preview.is_hidden() and target_days.nth(0).input_value()=='3' and page.evaluate('window.__planWrites===0'))
    target_days.nth(0).select_option('3')
    check('Changing the destination after preview invalidates that preview and performs no write', preview.is_hidden() and page.evaluate('window.__planWrites===0'))
    target_days.nth(0).select_option('4')
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false && document.querySelector('.nutrition-week-templates-preview-summary-e32').textContent.includes('Avena original: Lunes → Viernes')")
    check('A fresh preview is required after changing the destination back to Friday', not preview.is_hidden() and 'Avena original: Lunes → Viernes' in summary.inner_text() and page.evaluate('window.__planWrites===0'))
    page.locator('body').evaluate('(element) => element.classList.add("light")')
    check('Light theme uses a readable foreground on the selection help', page.locator('.nutrition-week-template-meal-selection-help-e36').evaluate('(el) => getComputedStyle(el).color') == 'rgb(82, 97, 118)')
    page.locator('body').evaluate('(element) => element.classList.remove("light")')
    check('Previewing a subset still performs no writes', page.evaluate("window.__planWrites===0 && window.__planRows.filter(r=>r.week_start==='2026-10-26').length===1 && window.__preferenceWrites===1"))
    checkboxes.nth(1).check()
    check('Changing the meal selection invalidates the previous preview before confirmation', preview.is_hidden() and page.evaluate('window.__planWrites===0'))
    checkboxes.nth(1).uncheck()
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    summary_text=summary.inner_text()
    check('A fresh preview reflects the updated one-meal selection', 'Selección parcial: 1 de 2 comidas' in summary_text and 'se agregarán 1 comida en 1 día' in summary_text)
    page.evaluate("window.__shoppingRows[0].checked=true;window.__shoppingRows[0].updated_at='shopping-remote-v2'")
    panel.get_by_role('button',name='Aplicar en esta semana').click()
    page.get_by_text('La lista de compras cambió desde la vista previa', exact=False).wait_for()
    check('A shopping-list change during review invalidates the estimate and blocks plan writes', preview.is_hidden() and page.evaluate('window.__planWrites===0 && window.__shoppingWrites===0'))
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false && document.querySelector('.nutrition-week-template-shopping-impact-e40').dataset.state==='available'")
    impact = preview.locator('.nutrition-week-template-shopping-impact-e40')
    check('Fresh shopping estimate warns about an already purchased product with a changed quantity', 'producto comprado cambia' in impact.inner_text() or 'productos comprados cambian' in impact.inner_text())
    panel.get_by_role('button',name='Aplicar en esta semana').click()
    page.get_by_text('Plantilla «Semana de estudio» aplicada', exact=False).wait_for()
    target_rows=page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-26')")
    check('Confirm adds only the selected meal, preserves existing meals, and never writes shopping rows', len(target_rows)==2 and any(r['title']=='Desayuno ya organizado' for r in target_rows) and any(r['title']=='Avena original' and r['day_offset']==4 and r['plan_key'].startswith('manual:week-template:') for r in target_rows) and page.evaluate('window.__planWrites===1 && window.__shoppingWrites===0'))
    handoff=dialog.locator('.nutrition-week-template-shopping-handoff-e41')
    handoff_state=page.evaluate("el => ({visible:!!el && !el.hidden,text:el?.textContent||'',button:[...(el?.querySelectorAll('button')||[])].find(b=>/Revisar compras/.test(b.textContent))?.textContent||''})", handoff.element_handle())
    check('Successful plan save reveals a clear optional shopping handoff', handoff_state['visible'] and 'La lista de compras todavía no se modificó' in handoff_state['text'])
    check('Handoff keeps plan and shopping persistence explicitly separate', 'confirmar esa operación por separado' in handoff_state['text'] and page.evaluate('window.__shoppingWrites===0 && window.__planWrites===1'))
    check('Handoff button labels the week that was just saved', '2026-10-26' in handoff_state['button'])
    handoff.get_by_role('button',name='Revisar la lista de compras de la semana recién guardada').evaluate('(el) => el.click()')
    shopping_dialog=page.get_by_role('dialog',name='Lista de compras'); shopping_dialog.wait_for()
    check('Handoff closes the plan editor to avoid overlapping modal focus traps', page.locator('#nutritionWeeklyPlanEditor').count()==0 and page.locator('#nutritionShoppingModal').count()==1)
    check('Handoff opens the official shopping list on the same target week', page.locator('#nutritionShoppingWeekStart').input_value()=='2026-10-26')
    check('Opening the shopping list does not sync or write shopping rows automatically', page.evaluate('window.__shoppingWrites===0 && window.__planWrites===1'))
    check('Shopping sync still exposes its own explicit generate and confirm flow', page.evaluate("!!document.querySelector('#nutritionShoppingModal') && [...document.querySelectorAll('#nutritionShoppingModal button')].some(b=>/Generar/i.test(b.textContent))"))
    shopping_dialog.get_by_role('button',name='Cerrar lista de compras').click()
    check('Closing shopping returns focus to the existing planner entry point', page.evaluate("document.activeElement?.id==='nutritionPlanWeekEditorBtn'"))
    check('Handoff performs no implicit shopping persistence', page.evaluate('window.__planWrites===1 && window.__shoppingWrites===0'))
    check('Mobile view has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), str(page.evaluate('({doc:document.documentElement.scrollWidth,width:innerWidth})')))
    page.set_viewport_size({'width':1365,'height':900})
    check('Desktop view has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    browser.close()
RESULT.write_text(json.dumps({'stage':'E41','checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks)},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'stage':'E41','checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks)},indent=2,ensure_ascii=False))
