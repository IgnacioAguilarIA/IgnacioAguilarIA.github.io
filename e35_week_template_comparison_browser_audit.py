#!/usr/bin/env python3
"""E34 browser audit for professional weekly-template management: details, rename and duplicate."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'tests' / 'artifacts' / 'e35'
RESULT = ARTIFACTS / 'weekly-template-comparison-browser-audit.json'
JS = (ROOT / 'js' / '63-nutrition-week-plan-editor.js').read_text()
CSS_FILES = [
    ROOT / 'css' / '86-nutrition-week-plan-editor.css',
    ROOT / 'css' / '110-nutrition-week-plan-quick-actions-e29.css',
    ROOT / 'css' / '111-nutrition-recipe-portion-adjustment-e30.css',
    ROOT / 'css' / '112-nutrition-week-plan-copy-day-e31.css',
    ROOT / 'css' / '113-nutrition-week-templates-e32.css',
    ROOT / 'css' / '114-nutrition-week-template-merge-e33.css',
    ROOT / 'css' / '115-nutrition-week-template-management-e34.css',
    ROOT / 'css' / '116-nutrition-week-template-comparison-e35.css',
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
    original_id = saved['id']; original_item_ids = [item['item_id'] for item in saved['items']]; original_created_at = saved['created_at']
    first_card = panel.locator('.nutrition-week-template-card-e34').first
    first_card.get_by_role('button', name='Ver detalles de Semana de estudio').click()
    detail = first_card.locator('.nutrition-week-template-detail-e34')
    check('Details expand accessibly and report days, ingredients, unknown quantities and incomplete nutrition', detail.is_visible() and 'Cantidades por revisar' in detail.inner_text() and 'Comidas con nutrición incompleta' in detail.inner_text() and 'Lunes: 1 comida' in detail.inner_text(), json.dumps({'visible':detail.is_visible(),'expanded':first_card.get_by_role('button',name='Ver detalles de Semana de estudio').get_attribute('aria-expanded'),'detail':detail.inner_text(),'html':detail.evaluate('(e)=>e.outerHTML')}))
    first_card.get_by_role('button', name='Renombrar plantilla Semana de estudio', exact=True).click()
    check('Rename editor announces expanded state and only one editor is open', first_card.get_by_role('button', name='Renombrar plantilla Semana de estudio', exact=True).get_attribute('aria-expanded')=='true' and first_card.locator('.nutrition-week-template-rename-e34').is_visible() and page.locator('.nutrition-week-template-rename-e34:visible').count()==1)
    rename_input = first_card.get_by_label('Nuevo nombre de plantilla Semana de estudio')
    rename_input.fill('Semana de cursada')
    first_card.get_by_role('button', name='Guardar nombre').click()
    page.get_by_text('Plantilla renombrada a «Semana de cursada»', exact=False).wait_for()
    renamed = page.evaluate('(id) => window.__prefs.weekly_plan_templates.find(t=>t.id===id)', original_id)
    check('Rename changes only the unique name and preserves IDs, creation date and content', renamed['name']=='Semana de cursada' and renamed['id']==original_id and renamed['created_at']==original_created_at and [item['item_id'] for item in renamed['items']]==original_item_ids and page.evaluate('window.__preferenceWrites===2'))
    panel.get_by_role('button', name='Duplicar plantilla Semana de cursada', exact=True).click()
    page.get_by_text('Plantilla duplicada como «Semana de cursada (copia)»', exact=False).wait_for()
    check('Duplicate stores an independent template and new item IDs while preserving source metadata', page.evaluate("window.__prefs.weekly_plan_templates.length===2 && window.__prefs.weekly_plan_templates.find(t=>t.name==='Semana de cursada (copia)') && window.__prefs.weekly_plan_templates.find(t=>t.name==='Semana de cursada (copia)').id!==window.__prefs.weekly_plan_templates.find(t=>t.name==='Semana de cursada').id && window.__prefs.weekly_plan_templates.find(t=>t.name==='Semana de cursada (copia)').items.every(i=>!window.__prefs.weekly_plan_templates.find(t=>t.name==='Semana de cursada').items.some(s=>s.item_id===i.item_id)) && window.__prefs.weekly_plan_templates.find(t=>t.name==='Semana de cursada (copia)').items[0].ingredients_snapshot[0].quality.confidence==='high' && window.__preferenceWrites===3"))
    panel.get_by_role('button', name='Duplicar plantilla Semana de cursada', exact=True).click()
    page.get_by_text('Plantilla duplicada como «Semana de cursada (copia 2)»', exact=False).wait_for()
    check('Repeated duplication automatically generates a unique normalized name', page.evaluate("window.__prefs.weekly_plan_templates.length===3 && window.__prefs.weekly_plan_templates.some(t=>t.name==='Semana de cursada (copia 2)') && new Set(window.__prefs.weekly_plan_templates.map(t=>t.name.toLocaleLowerCase('es-AR'))).size===3 && window.__preferenceWrites===4"))
    # A template change from another session must block rename until the manager refreshes.
    page.evaluate("window.__prefs.updated_at='2026-10-21T10:10:00.000Z'")
    panel.get_by_role('button', name='Renombrar plantilla Semana de cursada', exact=True).click()
    stale_input=panel.get_by_label('Nuevo nombre de plantilla Semana de cursada', exact=True)
    stale_input.fill('Nombre sobrescrito')
    before_stale_write=page.evaluate('window.__preferenceWrites')
    stale_input.press('Enter')
    page.get_by_text('Las plantillas cambiaron desde otra sesión', exact=False).wait_for()
    check('Stale template management cannot overwrite remote changes', page.evaluate(f"window.__preferenceWrites==={before_stale_write} && window.__prefs.weekly_plan_templates.find(t=>t.id===window.__prefs.weekly_plan_templates.find(t=>t.name==='Semana de cursada').id).name==='Semana de cursada'"))
    dialog.get_by_role('button',name='Actualizar',exact=True).click()
    page.get_by_text('2 comidas planificadas', exact=False).wait_for()
    date = dialog.locator('.nutrition-plan-week-label input[type=date]'); date.fill('2026-10-26'); date.dispatch_event('change')
    page.wait_for_function("document.querySelector('.nutrition-plan-week-label input[type=date]').value==='2026-10-26' && document.querySelectorAll('.nutrition-plan-meal').length===1 && document.body.innerText.includes('Desayuno ya organizado')")
    panel=dialog.locator('#nutritionWeekTemplatesPanelE32')
    panel.get_by_role('button', name='Previsualizar plantilla Semana de cursada en la semana', exact=False).click()
    summary=panel.locator('.nutrition-week-templates-preview-summary-e32')
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    summary_text=summary.inner_text()
    check('Preview adds only to empty days and skips existing target days', 'se agregarán 1 comida en 1 día' in summary_text and 'se omite 1 día' in summary_text and 'No se reemplazará' in summary_text, summary_text)
    check('Preview is non-destructive before confirmation', page.evaluate("window.__planWrites===0 && window.__planRows.filter(r=>r.week_start==='2026-10-26').length===1"))
    panel.get_by_role('button', name='Aplicar en esta semana').click()
    page.get_by_text('Plantilla «Semana de cursada» aplicada', exact=False).wait_for()
    applied=page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-26')")
    check('Confirm applies the empty-day portion of the template only', len(applied)==2 and any(r['title']=='Desayuno ya organizado' for r in applied) and any(r['title']=='Sopa fuente' and r['day_offset']==2 for r in applied) and page.evaluate('window.__planWrites===1'))
    check('The original week is unchanged', page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-19').length===2 && window.__planRows.find(r=>r.id==='src-mon').title==='Avena original'"))
    page.screenshot(path=str(ARTIFACTS/'weekly-template-management-mobile.png'), full_page=True)
    # Re-preview the same template; stable keys should mark the copied meal as already present and never duplicate it.
    panel.get_by_role('button', name='Previsualizar plantilla Semana de cursada en la semana', exact=False).click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    check('Re-applying the same template does not queue duplicate meals', panel.get_by_role('button',name='Aplicar en esta semana').is_disabled() and ('ya está aplicada' in summary.inner_text() or 'ya están aplicadas' in summary.inner_text()) and page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-26').length===2 && window.__planWrites===1"))
    # E33: optionally merge missing template meals into occupied days, preserving all existing rows.
    merge_toggle = panel.get_by_label('Combinar también en días ocupados')
    check('Merge mode is opt-in and unchecked by default', not merge_toggle.is_checked())
    merge_toggle.check()
    check('Changing merge mode invalidates the old preview before writes', panel.locator('.nutrition-week-templates-preview-e32').is_hidden() and page.evaluate('window.__planWrites===1'))
    panel.get_by_role('button', name='Previsualizar plantilla Semana de cursada en la semana', exact=False).click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    merge_summary = panel.locator('.nutrition-week-templates-preview-summary-e32').inner_text()
    merge_day = panel.locator('.nutrition-week-templates-preview-list-e32 li.is-merge').inner_text()
    check('Merge preview explicitly announces that occupied days will be combined, not replaced', 'Modo combinar activado' in merge_summary and 'sin reemplazar' in merge_summary.lower() and 'agregar 1 comida' in merge_day and 'conservar 1 comida existente' in merge_day, merge_summary+' | '+merge_day)
    check('Merge preview remains non-destructive until confirmation', page.evaluate("window.__planWrites===1 && window.__planRows.filter(r=>r.week_start==='2026-10-26').length===2"))
    panel.get_by_role('button', name='Aplicar en esta semana').click()
    page.get_by_text('Plantilla «Semana de cursada» aplicada', exact=False).wait_for()
    merged_rows = page.evaluate("window.__planRows.filter(r=>r.week_start==='2026-10-26')")
    check('Confirming merge adds the missing meal beside the existing one', len(merged_rows)==3 and any(r['title']=='Desayuno ya organizado' and r['day_offset']==0 for r in merged_rows) and any(r['title']=='Avena original' and r['day_offset']==0 for r in merged_rows) and any(r['title']=='Sopa fuente' and r['day_offset']==2 for r in merged_rows) and page.evaluate('window.__planWrites===2'), json.dumps({'rows':merged_rows,'writes':page.evaluate('window.__planWrites'),'status':page.locator('.nutrition-plan-editor-status').inner_text()}))
    check('A merged plan keeps all source and destination meal snapshots independent', page.evaluate("window.__planRows.find(r=>r.id==='src-mon').title==='Avena original' && window.__planRows.find(r=>r.id==='dst-mon').title==='Desayuno ya organizado'"))
    # A remote/manual destination edit after preview invalidates the proposal and blocks writes.
    date.fill('2026-11-02'); date.dispatch_event('change')
    page.wait_for_function("document.querySelector('.nutrition-plan-week-label input[type=date]').value==='2026-11-02'")
    panel=dialog.locator('#nutritionWeekTemplatesPanelE32')
    panel.get_by_role('button', name='Previsualizar plantilla Semana de cursada en la semana', exact=False).click()
    page.wait_for_function("document.querySelector('.nutrition-week-templates-preview-e32').hidden===false")
    before=page.evaluate('window.__planWrites')
    page.evaluate("window.__planRows.push({id:'remote-manual',user_id:'user-e32',week_start:'2026-11-02',day_offset:4,meal_type:'merienda',title:'Cambio remoto',planned_time:'16:00',notes:'',plan_key:'manual:remote',sort_order:0,ingredients_snapshot:[],nutrition_snapshot:{},updated_at:'2026-11-02T16:00:00Z'})")
    panel.get_by_role('button', name='Aplicar en esta semana').click()
    page.get_by_text('El plan de destino cambió desde la vista previa', exact=False).wait_for()
    check('A concurrent destination change is rejected without writing any template rows', page.evaluate(f"window.__planWrites==={before} && window.__planRows.filter(r=>r.week_start==='2026-11-02').length===1"))
    # Deleting the template must not delete already planned copies.
    page.once('dialog', lambda d: d.accept())
    panel.get_by_role('button', name='Eliminar plantilla Semana de cursada', exact=True).click()
    page.get_by_text('Plantilla «Semana de cursada» eliminada', exact=False).wait_for()
    check('Deleting a template leaves already-applied weekly meals intact', page.evaluate("window.__prefs.weekly_plan_templates.length===2 && !window.__prefs.weekly_plan_templates.some(t=>t.name==='Semana de cursada') && window.__planRows.filter(r=>r.week_start==='2026-10-26').length===3"))
    # E35 comparison is read-only and compares independent duplicate templates side by side.
    compare_a = panel.get_by_role('button', name='Comparar plantilla Semana de cursada (copia)', exact=True)
    compare_b = panel.get_by_role('button', name='Comparar plantilla Semana de cursada (copia 2)', exact=True)
    before_comparison_writes = page.evaluate('({plan:window.__planWrites,prefs:window.__preferenceWrites})')
    compare_a.click()
    compare_panel = panel.locator('#nutritionWeekTemplateCompareE35')
    page.wait_for_function("document.querySelector('#nutritionWeekTemplateCompareE35').hidden===false")
    check('Selecting one template announces that a second selection is needed', 'Elegí una segunda plantilla' in compare_panel.inner_text() and panel.get_by_role('button', name='Quitar plantilla Semana de cursada (copia)', exact=True).get_attribute('aria-pressed')=='true')
    compare_b.click()
    page.wait_for_function("document.querySelector('#nutritionWeekTemplateCompareE35').innerText.includes('No se detectaron diferencias')")
    comparison_text = compare_panel.inner_text()
    check('Two identical templates compare as equal even though their item IDs differ', '2 iguales' in comparison_text and '0 modificadas' in comparison_text and 'No se detectaron diferencias' in comparison_text, comparison_text)
    check('Comparison is read-only and does not write plan or preference data', page.evaluate(f"window.__planWrites==={before_comparison_writes['plan']} && window.__preferenceWrites==={before_comparison_writes['prefs']}"))
    check('Clear comparison hides the panel and releases both selections', (compare_panel.get_by_role('button',name='Limpiar comparación',exact=True).click() is None) and compare_panel.is_hidden() and page.locator('.nutrition-week-template-compare-toggle-e35[aria-pressed="true"]').count()==0)
    # Refresh the active week, save a deliberately different template and verify the detailed diff UI.
    dialog.get_by_role('button', name='Actualizar', exact=True).click()
    page.get_by_text('1 comidas planificadas', exact=False).wait_for()
    panel.get_by_label('Nombre de la plantilla semanal').fill('Semana distinta')
    panel.get_by_role('button',name='Guardar semana actual',exact=True).click()
    page.get_by_text('Plantilla «Semana distinta» guardada', exact=False).wait_for()
    before_diff_writes = page.evaluate('({plan:window.__planWrites,prefs:window.__preferenceWrites})')
    panel.get_by_role('button', name='Comparar plantilla Semana de cursada (copia)', exact=True).click()
    panel.get_by_role('button', name='Comparar plantilla Semana distinta', exact=True).click()
    page.wait_for_function("document.querySelector('#nutritionWeekTemplateCompareE35').innerText.includes('Solo en A') && document.querySelector('#nutritionWeekTemplateCompareE35').innerText.includes('Solo en B')")
    diff_text = compare_panel.inner_text()
    check('Different templates show additions and removals by day', '2 solo en A' in diff_text and '1 solo en B' in diff_text and panel.locator('.nutrition-week-template-compare-row-e35.is-removed').count()==2 and panel.locator('.nutrition-week-template-compare-row-e35.is-added').count()==1, diff_text)
    check('Comparison diff remains read-only after rendering changed ingredients and meals', page.evaluate(f"window.__planWrites==={before_diff_writes['plan']} && window.__preferenceWrites==={before_diff_writes['prefs']}"))
    page.screenshot(path=str(ARTIFACTS/'weekly-template-comparison-mobile.png'), full_page=True)
    check('Comparison UI has no mobile horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    page.evaluate("document.body.classList.add('light')")
    light_style = page.evaluate("({color:getComputedStyle(document.querySelector('#nutritionWeekTemplateCompareE35')).color,background:getComputedStyle(document.querySelector('#nutritionWeekTemplateCompareE35')).backgroundColor})")
    check('Light theme switches comparison foreground and surface to readable colors', light_style['color']=='rgb(23, 35, 56)' and light_style['background']=='rgb(255, 255, 255)', str(light_style))
    page.screenshot(path=str(ARTIFACTS/'weekly-template-comparison-mobile-light.png'), full_page=True)
    page.evaluate("document.body.classList.remove('light')")
    check('Mobile view has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), str(page.evaluate('({doc:document.documentElement.scrollWidth,width:innerWidth})')))
    page.set_viewport_size({'width':1365,'height':900})
    check('Desktop view has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    browser.close()
RESULT.write_text(json.dumps({'stage':'E35','checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks)},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks)},indent=2,ensure_ascii=False))
