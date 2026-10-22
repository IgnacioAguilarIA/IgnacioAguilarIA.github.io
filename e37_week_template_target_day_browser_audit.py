#!/usr/bin/env python3
"""E37 browser audit for assigning destination weekdays to selected template meals."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'tests' / 'artifacts' / 'e37'
RESULT = ARTIFACTS / 'weekly-template-target-day-browser-audit.json'
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
window.__planWrites=0;window.__preferenceWrites=0;window.__seq=0;
window.__prefs={user_id:'user-e32',meal_order:['pre','post','lunch','snack','dinner','sleep'],weekly_plan_templates:[],updated_at:'2026-10-21T10:00:00.000Z',created_at:'2026-10-01T10:00:00.000Z'};
window.AgendaNutritionPlanner={loadPlan:async()=>({meals:[],byMeal:new Map()})};
window.AgendaNutritionData={loadRecipes:async()=>[]};
window.ensureSupabase=async()=>({from(table){let mode='select',filters=[],payload=null,options={},columns='*';const clone=x=>JSON.parse(JSON.stringify(x));const match=(row)=>filters.every(([key,val])=>String(row[key]??'')===String(val??''));const applyRows=()=>table==='nutrition_weekly_plan_items'?window.__planRows.filter(match):table==='nutrition_preferences'?(window.__prefs&&match(window.__prefs)?[window.__prefs]:[]):[];const q={select(cols='*'){columns=cols;return q},eq(key,value){filters.push([key,value]);return q},is(key,value){filters.push([key,value]);return q},order(key,opts={}){return q},range(start,end){return Promise.resolve({data:applyRows().slice(start,end+1).map(clone),error:null})},maybeSingle(){if(mode!=='select')return executeSingle();const found=applyRows();return Promise.resolve({data:found.length?clone(found[0]):null,error:null})},single(){return Promise.resolve(executeSingle())},insert(value){mode='insert';payload=clone(value);return q},update(value){mode='update';payload=clone(value);return q},upsert(value,opts={}){mode='upsert';payload=clone(value);options=opts;return q},delete(){mode='delete';return q},then(resolve,reject){return execute().then(resolve,reject)}};
async function executeSingle(){const r=await execute();if(r.error)return r;const arr=Array.isArray(r.data)?r.data:(r.data?[r.data]:[]);return {data:arr[0]||null,error:null}}
async function execute(){if(table==='nutrition_preferences'){
 if(mode==='insert'){if(window.__prefs)return {data:null,error:{code:'23505',message:'duplicate key'}};window.__prefs={user_id:payload.user_id,meal_order:['pre','post','lunch','snack','dinner','sleep'],weekly_plan_templates:clone(payload.weekly_plan_templates||[]),updated_at:'2026-10-21T10:00:01.000Z',created_at:'2026-10-21T10:00:01.000Z'};window.__preferenceWrites++;return {data:clone(window.__prefs),error:null}}
 if(mode==='update'){if(!window.__prefs||!match(window.__prefs))return {data:null,error:null};Object.assign(window.__prefs,clone(payload));window.__prefs.updated_at=new Date(Date.parse(window.__prefs.updated_at)+1000).toISOString();window.__preferenceWrites++;return {data:clone(window.__prefs),error:null}}
 return {data:applyRows().map(clone),error:null};
 }
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
    target_days.nth(0).select_option('3')
    check('Changing the destination after preview invalidates that preview and performs no write', preview.is_hidden() and page.evaluate('window.__planWrites===0'))
    target_days.nth(0).select_option('4')
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false && document.querySelector('.nutrition-week-templates-preview-summary-e32').textContent.includes('Avena original: Lunes → Viernes')")
    check('A fresh preview is required after changing the destination back to Friday', not preview.is_hidden() and 'Avena original: Lunes → Viernes' in summary.inner_text() and page.evaluate('window.__planWrites===0'))
    page.locator('body').evaluate('(element) => element.classList.add("light")')
    check('Light theme uses a readable foreground on the selection help', page.locator('.nutrition-week-template-meal-selection-help-e36').evaluate('(el) => getComputedStyle(el).color') == 'rgb(82, 97, 118)')
    page.screenshot(path=str(ARTIFACTS/'weekly-template-target-day-mobile-light.png'), full_page=True)
    page.locator('body').evaluate('(element) => element.classList.remove("light")')
    check('Previewing a subset still performs no writes', page.evaluate("window.__planWrites===0 && window.__planRows.filter(r=>r.week_start==='2026-10-26').length===1 && window.__preferenceWrites===1"))
    checkboxes.nth(1).check()
    check('Changing the meal selection invalidates the previous preview before confirmation', preview.is_hidden() and page.evaluate('window.__planWrites===0'))
    checkboxes.nth(1).uncheck()
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    summary_text=summary.inner_text()
    check('A fresh preview reflects the updated one-meal selection', 'Selección parcial: 1 de 2 comidas' in summary_text and 'se agregarán 1 comida en 1 día' in summary_text)
    panel.get_by_role('button',name='Aplicar en esta semana').click()
    page.get_by_text('Plantilla «Semana de estudio» aplicada', exact=False).wait_for()
    target_rows=page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-26')")
    check('Confirm adds only the selected meal and preserves the existing destination row', len(target_rows)==2 and any(r['title']=='Desayuno ya organizado' for r in target_rows) and any(r['title']=='Avena original' and r['day_offset']==4 and r['plan_key'].startswith('manual:week-template:') for r in target_rows) and page.evaluate('window.__planWrites===1'))
    check('Unselected template meal is not copied', not any(r['title']=='Sopa fuente' for r in target_rows))
    page.screenshot(path=str(ARTIFACTS/'weekly-template-target-day-mobile.png'), full_page=True)
    # Now select only the second meal, and ensure it can be added to a different day without altering the first copy.
    checkboxes=selection.locator('input[type=checkbox]'); checkboxes.nth(0).uncheck(); checkboxes.nth(1).check()
    selection.get_by_role('button', name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-summary-e32').textContent.includes('Selección parcial: 1 de 2 comidas')")
    panel.get_by_role('button',name='Aplicar en esta semana').click()
    page.get_by_text('Plantilla «Semana de estudio» aplicada', exact=False).wait_for()
    target_rows=page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-26')")
    check('A second partial selection adds its meal while keeping the earlier selected copy', len(target_rows)==3 and sum(r['title']=='Avena original' for r in target_rows)==1 and sum(r['title']=='Sopa fuente' for r in target_rows)==1 and page.evaluate('window.__planWrites===2'))
    # Re-preview the same selected meal: it is already present, so the confirm action is disabled.
    selection=card.locator('.nutrition-week-template-meal-selection-e36'); checkboxes=selection.locator('input[type=checkbox]')
    selection.get_by_role('button',name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    check('Re-applying a selected meal does not queue duplicates', panel.get_by_role('button',name='Aplicar en esta semana').is_disabled() and 'ya está aplicada' in summary.inner_text() and page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-26').length===3 && window.__planWrites===2"))
    # Verify stale target data invalidates a selective proposal and no write occurs.
    date.fill('2026-11-02'); date.dispatch_event('change')
    page.wait_for_function("document.querySelector('.nutrition-plan-week-label input[type=date]').value==='2026-11-02'")
    panel=dialog.locator('#nutritionWeekTemplatesPanelE32'); card=panel.locator('.nutrition-week-template-card-e34').filter(has_text='Semana de estudio')
    selection=card.locator('.nutrition-week-template-meal-selection-e36'); checkboxes=selection.locator('input[type=checkbox]')
    checkboxes.nth(0).check(); checkboxes.nth(1).uncheck()
    selection.get_by_role('button',name='Previsualizar seleccionadas').click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    before=page.evaluate('window.__planWrites')
    page.evaluate("window.__planRows.push({id:'remote-manual-e36',user_id:'user-e32',week_start:'2026-11-02',day_offset:4,meal_type:'merienda',title:'Cambio remoto',planned_time:'16:00',notes:'',plan_key:'manual:remote-e36',sort_order:0,ingredients_snapshot:[],nutrition_snapshot:{},updated_at:'2026-11-02T16:00:00Z'})")
    panel.get_by_role('button',name='Aplicar en esta semana').click()
    page.get_by_text('El plan de destino cambió desde la vista previa',exact=False).wait_for()
    check('A stale selective preview is rejected after another session changes the week', page.evaluate(f"window.__planWrites==={before} && window.__planRows.filter(r=>r.week_start==='2026-11-02').length===1"))
    # No SQL or preference changes should be needed for selective application itself.
    check('Selective application never rewrites saved templates or preferences', page.evaluate('window.__preferenceWrites===1 && window.__prefs.weekly_plan_templates.length===1'))
    check('Mobile view has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), str(page.evaluate('({doc:document.documentElement.scrollWidth,width:innerWidth})')))
    page.set_viewport_size({'width':1365,'height':900})
    check('Desktop view has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    browser.close()
RESULT.write_text(json.dumps({'stage':'E37','checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks)},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks)},indent=2,ensure_ascii=False))
