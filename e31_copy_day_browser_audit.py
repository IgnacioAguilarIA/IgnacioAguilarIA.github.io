#!/usr/bin/env python3
"""E31 browser audit for safe whole-day copy with preview and concurrency checks."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
RESULT=ROOT/'tests'/'artifacts'/'e31'/'copy-day-browser-audit.json'
JS=(ROOT/'js'/'63-nutrition-week-plan-editor.js').read_text()
CSS=[(ROOT/'css'/'86-nutrition-week-plan-editor.css').read_text(),(ROOT/'css'/'110-nutrition-week-plan-quick-actions-e29.css').read_text(),(ROOT/'css'/'111-nutrition-recipe-portion-adjustment-e30.css').read_text(),(ROOT/'css'/'112-nutrition-week-plan-copy-day-e31.css').read_text()]
checks=[]
def check(name,passed,details=''):
    checks.append({'name':name,'passed':bool(passed),'details':details})
    if not passed: raise AssertionError(f'{name}: {details}')
fixture=r"""
window.currentUser={id:'user-e31'};
window.__planRows=[
 {id:'meal-a',user_id:'user-e31',week_start:'2026-10-19',day_offset:0,meal_type:'desayuno',title:'Avena con leche',planned_time:'08:00',notes:'Canela aparte',source_meal_id:null,plan_key:'manual:a',sort_order:0,ingredients_snapshot:[{name:'Avena',quantity:50,quantity_known:true,unit:'g',quality:{source:'catalog',confidence:'high'}}],nutrition_snapshot:{calories:190,protein_g:7,fiber_g:null,nutrition_missing_metrics:['fiber']},updated_at:'v1'},
 {id:'meal-b',user_id:'user-e31',week_start:'2026-10-19',day_offset:0,meal_type:'almuerzo',title:'Ensalada',planned_time:'12:30',notes:'',source_meal_id:'routine-2',plan_key:'template:b',sort_order:1,ingredients_snapshot:[{name:'Tomate',quantity:null,quantity_known:false,unit:'g',quality:{reason:'unknown'}}],nutrition_snapshot:{calories:null,nutrition_missing_metrics:['calories','protein','carbs','fat','fiber']},updated_at:'v2'},
 {id:'meal-c',user_id:'user-e31',week_start:'2026-10-19',day_offset:2,meal_type:'cena',title:'Sopa existente',planned_time:'20:00',notes:'Ya organizada',source_meal_id:null,plan_key:'manual:c',sort_order:0,ingredients_snapshot:[{name:'Zapallo',quantity:250,quantity_known:true,unit:'g'}],nutrition_snapshot:{calories:120},updated_at:'v3'}
];
window.__planWrites=0;window.__recipeWrites=0;window.__seq=0;window.__failNextCopyResponse=false;
window.AgendaNutritionPlanner={loadPlan:async()=>({meals:[],byMeal:new Map()})};
window.AgendaNutritionData={loadRecipes:async()=>[]};
window.ensureSupabase=async()=>({from(table){if(table!=='nutrition_weekly_plan_items')throw new Error('tabla inesperada '+table);let mode='select',filters=[],payload=null,options={},columns='*';const copy=x=>JSON.parse(JSON.stringify(x));const matches=row=>filters.every(([kind,key,value])=>kind==='eq'?String(row[key]??'')===String(value??''):kind==='is'?row[key]===value:false);async function execute(){if(mode==='upsert'){const many=Array.isArray(payload)?payload:[payload],data=[];for(const p of many){let row=window.__planRows.find(x=>x.user_id===p.user_id&&x.week_start===p.week_start&&x.plan_key===p.plan_key);if(row&&options.ignoreDuplicates)continue;if(row){Object.assign(row,copy(p));data.push({id:row.id,plan_key:row.plan_key})}else{row={...copy(p),id:'meal-copy-'+(++window.__seq)};window.__planRows.push(row);data.push({id:row.id,plan_key:row.plan_key})}}window.__planWrites++;if(window.__failNextCopyResponse){window.__failNextCopyResponse=false;return {data:null,error:{message:'simulated response loss after commit'}}}return {data,error:null}}
return {data:null,error:{message:'unsupported thenable'}}}
const q={select(cols='*'){columns=cols;return q},eq(key,value){filters.push(['eq',key,value]);return q},is(key,value){filters.push(['is',key,value]);return q},order(){return q},range:async(start,end)=>({data:window.__planRows.filter(matches).slice(start,end+1).map(copy),error:null}),update(value){mode='update';payload=copy(value);return q},upsert(value,opts){mode='upsert';payload=copy(value);options=opts||{};return q},single:async()=>({data:null,error:{message:'not used'}}),then(resolve,reject){return execute().then(resolve,reject)}};return q}});
"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="nutritionPanel"><div class="nutrition-actions"></div></main></body></html>')
    for css in CSS: page.add_style_tag(content=css)
    page.add_script_tag(content=fixture);page.add_script_tag(content=JS)
    page.get_by_role('button',name='🗓️ Planificar semana').click()
    dialog=page.get_by_role('dialog',name='Planificar semana');dialog.wait_for()
    page.wait_for_function("document.querySelector('[data-meal-id=\\\"meal-a\\\"]') !== null")
    toggle=dialog.get_by_role('button',name='Copiar día completo')
    check('Whole-day copy action is available in the weekly plan',toggle.is_visible())
    toggle.click();panel=dialog.locator('.nutrition-plan-copy-day-panel');check('Copy panel is accessible and opens without writing data',panel.is_visible() and page.evaluate('window.__planWrites===0'))
    check('Toggle exposes expanded state and references the copy panel',toggle.get_attribute('aria-expanded')=='true' and toggle.get_attribute('aria-controls')=='nutritionPlanCopyDayPanel')
    panel.get_by_role('button',name='Cerrar').click()
    check('Closing the preview panel is non-destructive and restores focus',panel.is_hidden() and page.evaluate('window.__planWrites===0') and page.evaluate("document.activeElement.id==='nutritionPlanCopyDayToggleE31'"))
    toggle.click()
    panel=dialog.locator('.nutrition-plan-copy-day-panel')
    panel.get_by_label('Día de origen para copiar').select_option('0')
    panel.get_by_label('Día de destino de la copia').select_option('2')
    panel.get_by_role('button',name='Previsualizar copia').click()
    summary=panel.locator('.nutrition-plan-copy-day-preview-summary').inner_text()
    check('Preview lists source meal count, ingredient count and preserves existing destination', '2 comidas' in summary and '2 ingredientes' in summary and '1 comida' in summary and 'ninguna será reemplazada' in summary,summary)
    check('Preview lists both meals with details and shows incomplete data notices',panel.locator('.nutrition-plan-copy-day-preview-list li').count()>=3 and panel.get_by_text('Información nutricional incompleta',exact=False).count()>=1)
    check('Preview is non-destructive until explicit confirmation',page.evaluate('window.__planWrites===0 && window.__planRows.length===3'))
    page.screenshot(path=str(RESULT.parent/'copy-day-preview-mobile.png'),full_page=True) if RESULT.parent.exists() else None
    page.evaluate('window.__failNextCopyResponse=true')
    panel.get_by_role('button',name='Copiar 2 comidas').click()
    page.get_by_text('simulated response loss after commit',exact=False).wait_for()
    page.wait_for_function("window.__planRows.length===5")
    writes_after_uncertain_response=page.evaluate('window.__planWrites')
    page.evaluate('window.__writesAfterUncertain=window.__planWrites')
    check('An ambiguous network response keeps the same preview available for a safe retry',panel.is_visible() and panel.get_by_role('button',name='Copiar 2 comidas').is_enabled() and writes_after_uncertain_response==1)
    panel.get_by_role('button',name='Copiar 2 comidas').click()
    page.get_by_text('No se generaron duplicados',exact=False).wait_for()
    page.wait_for_function("document.querySelector('.nutrition-plan-copy-day-panel').hidden===true")
    check('Retry recognizes the already committed operation without writing duplicate rows',page.evaluate('window.__planRows.length===5 && window.__planWrites===window.__writesAfterUncertain'))
    copied=page.evaluate("window.__planRows.filter(x=>x.day_offset===2 && x.plan_key.startsWith('manual:day-copy:'))")
    check('Confirm copies all source meals to the chosen destination',len(copied)==2 and {x['title'] for x in copied}=={'Avena con leche (copia)','Ensalada (copia)'})
    check('Existing destination meal is retained unchanged',page.evaluate("window.__planRows.find(x=>x.id==='meal-c').title==='Sopa existente' && window.__planRows.find(x=>x.id==='meal-c').notes==='Ya organizada'"))
    check('Copies are independent and preserve snapshots/provenance/unknown fields',len(copied)==2 and all(x['source_meal_id'] is None for x in copied) and next(x for x in copied if x['title'].startswith('Avena'))['ingredients_snapshot'][0]['quality']['confidence']=='high' and next(x for x in copied if x['title'].startswith('Ensalada'))['ingredients_snapshot'][0]['quantity_known'] is False and next(x for x in copied if x['title'].startswith('Ensalada'))['nutrition_snapshot']['nutrition_missing_metrics']==['calories','protein','carbs','fat','fiber'])
    check('Copied meal sort order appends after existing destination items',all(x['sort_order']>0 for x in copied) and page.evaluate("window.__planRows.find(x=>x.id==='meal-c').sort_order===0"))
    check('Copy recovery is confirmed with a success message and closes preview panel',dialog.get_by_text('No se generaron duplicados',exact=False).is_visible() and panel.is_hidden())
    check('Mobile planner has no horizontal overflow after copying',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),str(page.evaluate('({document:document.documentElement.scrollWidth,width:window.innerWidth})')))
    # Concurrent source modification after preview must abort the entire operation.
    toggle.click();panel.get_by_label('Día de origen para copiar').select_option('0');panel.get_by_label('Día de destino de la copia').select_option('3');panel.get_by_role('button',name='Previsualizar copia').click()
    before_writes=page.evaluate('window.__planWrites');before_count=page.evaluate('window.__planRows.length')
    page.evaluate("(()=>{const r=window.__planRows.find(x=>x.id==='meal-a');r.title='Cambio desde otro dispositivo';r.updated_at='remote-newer';})()")
    panel.get_by_role('button',name='Copiar 2 comidas').click()
    page.get_by_text('El origen o el destino cambió desde la vista previa',exact=False).wait_for()
    check('Concurrent source change rejects stale preview and performs no writes',page.evaluate('window.__planWrites')==before_writes and page.evaluate('window.__planRows.length')==before_count)
    check('Reloaded plan reflects the remote edit so the user can preview again',dialog.locator('[data-meal-id="meal-a"]').get_by_text('Cambio desde otro dispositivo',exact=True).is_visible())
    check('Desktop viewport also has no horizontal overflow',page.set_viewport_size({'width':1365,'height':900}) is None and page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    RESULT.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(RESULT.parent/'copy-day-mobile.png'),full_page=True)
    browser.close()
RESULT.parent.mkdir(parents=True,exist_ok=True)
RESULT.write_text(json.dumps({'stage':'E31','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False))
