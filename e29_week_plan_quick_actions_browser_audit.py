#!/usr/bin/env python3
"""E29 browser audit for quick copy/move and nutritional summary in the weekly meal plan."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
RESULT=ROOT/'tests'/'artifacts'/'e29'/'week-plan-quick-actions-browser-audit.json'
JS=(ROOT/'js'/'63-nutrition-week-plan-editor.js').read_text()
CSS=[(ROOT/'css'/'86-nutrition-week-plan-editor.css').read_text(),(ROOT/'css'/'110-nutrition-week-plan-quick-actions-e29.css').read_text()]
checks=[]
def check(name,passed,details=''):
    checks.append({'name':name,'passed':bool(passed),'details':details})
    if not passed: raise AssertionError(f'{name}: {details}')
fixture=r"""
window.currentUser={id:'user-e29'};
window.__planRows=[{
 id:'meal-1',user_id:'user-e29',week_start:'2026-10-19',day_offset:0,meal_type:'almuerzo',title:'Arroz con verduras',planned_time:'12:30',notes:'Sin sal agregada',source_meal_id:'routine-1',plan_key:'template:routine-1:0:almuerzo:12:30',sort_order:0,
 ingredients_snapshot:[{name:'Arroz',quantity:100,unit:'g',quantity_known:true,preparation_state:'cooked',quality:{source:'catalog'}}],nutrition_snapshot:{calories:280,protein_g:21,carbs_g:42,fat_g:8,fiber_g:0,nutrition_missing_metrics:['fiber']},updated_at:'2026-10-20T10:00:00.000Z'
}];
window.__planWrites=0;
window.AgendaNutritionPlanner={loadPlan:async()=>({meals:[],byMeal:new Map()})};
window.AgendaNutritionData={loadRecipes:async()=>[]};
window.ensureSupabase=async()=>({from(table){if(table!=='nutrition_weekly_plan_items')throw new Error('tabla inesperada '+table);let mode='select',filters=[],payload=null,columns='*',options={};const copy=x=>JSON.parse(JSON.stringify(x));const matches=row=>filters.every(([kind,key,value])=>kind==='eq'?String(row[key]??'')===String(value??''):kind==='is'?row[key]===value:false);const q={
 select(cols='*'){columns=cols;return q},
 eq(key,value){filters.push(['eq',key,value]);return q},
 is(key,value){filters.push(['is',key,value]);return q},
 order(){return q},
 range:async(start,end)=>({data:window.__planRows.filter(matches).slice(start,end+1).map(copy),error:null}),
 update(value){mode='update';payload=copy(value);return q},
 upsert(value,opts){mode='upsert';payload=copy(value);options=opts||{};return q},
 single:async()=>{
  if(mode==='select'){const row=window.__planRows.find(matches);return row?{data:copy(row),error:null}:{data:null,error:{message:'No row found',code:'PGRST116'}}}
  if(mode==='update'){const row=window.__planRows.find(matches);if(!row)return {data:null,error:{message:'No row matched',code:'PGRST116'}};Object.assign(row,payload);window.__planWrites++;return {data:{id:row.id},error:null}}
  if(mode==='upsert'){let row=window.__planRows.find(x=>x.user_id===payload.user_id&&x.week_start===payload.week_start&&x.plan_key===payload.plan_key);if(row){Object.assign(row,payload)}else{row={...payload,id:'meal-'+(window.__planRows.length+1)};window.__planRows.push(row)}window.__planWrites++;return {data:{id:row.id},error:null}}
  return {data:null,error:{message:'operación desconocida'}}
 }
};return q}});
"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="nutritionPanel"><div class="nutrition-actions"></div></main></body></html>')
    for css in CSS: page.add_style_tag(content=css)
    page.add_script_tag(content=fixture);page.add_script_tag(content=JS)
    page.get_by_role('button',name='🗓️ Planificar semana').click()
    dialog=page.get_by_role('dialog',name='Planificar semana');dialog.wait_for()
    page.wait_for_function("document.querySelector('[data-meal-id=\\\"meal-1\\\"]') !== null")
    meal=dialog.locator('[data-meal-id="meal-1"]')
    summary=meal.locator('.nutrition-plan-nutrition-summary').inner_text()
    check('Shows the stored nutrition summary for the planned meal', '280 kcal' in summary and '21 g prot.' in summary and '42 g carb.' in summary and '8 g grasas' in summary,summary)
    check('Does not display a metric explicitly marked unknown as zero','0 g fibra' not in summary,summary)
    meal.get_by_role('button',name='Mover / organizar').click()
    select=meal.get_by_label('Día de destino para Arroz con verduras')
    check('Organize panel opens with an accessible day selector',select.is_visible() and select.input_value()=='0')
    select.select_option('3')
    meal.get_by_role('button',name='Mover Arroz con verduras al día seleccionado').click()
    page.wait_for_function("window.__planRows[0].day_offset===3")
    moved=page.evaluate('window.__planRows[0]')
    check('Move writes the new day and detaches the old routine key',moved['day_offset']==3 and moved['source_meal_id'] is None and moved['plan_key'].startswith('manual:'))
    check('Move preserves ingredient and nutrient snapshots',moved['ingredients_snapshot'][0]['name']=='Arroz' and moved['ingredients_snapshot'][0]['quality']['source']=='catalog' and moved['nutrition_snapshot']['calories']==280 and moved['nutrition_snapshot']['nutrition_missing_metrics']==['fiber'])
    # Refresh locator after render and duplicate to Tuesday.
    meal=dialog.locator('[data-meal-id="meal-1"]')
    meal.get_by_role('button',name='Mover / organizar').click()
    select=meal.get_by_label('Día de destino para Arroz con verduras');select.select_option('1')
    meal.get_by_role('button',name='Duplicar Arroz con verduras en el día seleccionado').click()
    
    page.wait_for_function("window.__planRows.length===2")
    copied=page.evaluate("window.__planRows.find(x=>x.title==='Arroz con verduras (copia)')")
    check('Duplicate creates a separate planned meal on the selected day',copied is not None and copied['day_offset']==1 and copied['id']!='meal-1')
    check('Duplicate preserves recipe/nutrition and ingredient provenance',copied['ingredients_snapshot'][0]['quality']['source']=='catalog' and copied['nutrition_snapshot']['calories']==280 and copied['nutrition_snapshot']['nutrition_missing_metrics']==['fiber'])
    check('Duplicate is independent of the source routine and has its own key',copied['source_meal_id'] is None and copied['plan_key'].startswith('manual:'))
    copy_card=dialog.locator(f'[data-meal-id="{copied["id"]}"]')
    check('Duplicate appears in the correct day card and can be edited',copy_card.is_visible() and copy_card.get_by_role('button',name='Editar').is_visible())
    # Test stale move protection: a newer remote timestamp must block the write.
    original=dialog.locator('[data-meal-id="meal-1"]')
    original.get_by_role('button',name='Mover / organizar').click()
    original.get_by_label('Día de destino para Arroz con verduras').select_option('2')
    page.evaluate("window.__planRows.find(x=>x.id==='meal-1').updated_at='remote-newer-version'")
    before=page.evaluate('window.__planWrites')
    original.get_by_role('button',name='Mover Arroz con verduras al día seleccionado').click()
    page.get_by_text('No se pudo mover la comida',exact=False).wait_for()
    check('Concurrent change blocks moving a stale plan row',page.evaluate('window.__planWrites')==before and page.evaluate("window.__planRows.find(x=>x.id==='meal-1').day_offset===3"))
    # The prominent Duplicate action opens a prefilled form; saving it must preserve snapshots.
    original=dialog.locator('[data-meal-id="meal-1"]')
    original.get_by_role('button',name='Duplicar Arroz con verduras',exact=True).click()
    form=dialog.locator('form.nutrition-plan-edit-form')
    check('Duplicate opens a prefilled copy form without replacing the original',form.is_visible() and form.locator('input[name="title"]').input_value()=='Arroz con verduras (copia)')
    check('Optional routine and recipe selectors do not block manual/copy saves',form.locator('select[name="source_meal_id"]').evaluate('(e)=>!e.required') and form.locator('select[name="source_recipe_id"]').evaluate('(e)=>!e.required'))
    form.locator('select[name="day_offset"]').select_option('5')
    form.get_by_role('button',name='Guardar copia').click()
    page.wait_for_function("window.__planRows.length===3")
    form_copy=page.evaluate("window.__planRows.find(x=>x.title==='Arroz con verduras (copia)' && x.day_offset===5)")
    check('Saving the duplicate form preserves ingredients and nutrition metadata',form_copy is not None and form_copy['ingredients_snapshot'][0]['quality']['source']=='catalog' and form_copy['nutrition_snapshot']['calories']==280 and form_copy['nutrition_snapshot']['nutrition_missing_metrics']==['fiber'])
    check('Duplicate form copy has no source-template link and has independent plan key',form_copy['source_meal_id'] is None and form_copy['plan_key'].startswith('manual:'))
    # Editing an existing row also uses optimistic concurrency and requires explicit retry.
    original=dialog.locator('[data-meal-id="meal-1"]')
    original.get_by_role('button',name='Editar').click()
    edit_form=dialog.locator('form.nutrition-plan-edit-form')
    edit_form.locator('input[name="title"]').fill('Arroz actualizado por mí')
    page.evaluate("window.__planRows.find(x=>x.id==='meal-1').updated_at='remote-newest-version'")
    before=page.evaluate('window.__planWrites')
    edit_form.get_by_role('button',name='Guardar cambios').click()
    page.get_by_text('Esta comida cambió en el servidor',exact=False).wait_for()
    check('Concurrent edit is rejected without overwriting the newer server row',page.evaluate('window.__planWrites')==before and page.evaluate("window.__planRows.find(x=>x.id==='meal-1').title==='Arroz con verduras'"))
    check('The unsaved form draft remains available after conflict detection',dialog.locator('form.nutrition-plan-edit-form input[name="title"]').input_value()=='Arroz actualizado por mí')
    edit_form.get_by_role('button',name='Guardar cambios').click()
    page.wait_for_function("window.__planRows.find(x=>x.id==='meal-1').title==='Arroz actualizado por mí'")
    check('A deliberate retry after reviewing the conflict saves against the refreshed version',page.evaluate("window.__planRows.find(x=>x.id==='meal-1').title==='Arroz actualizado por mí'"))
    # Re-open copy tools for the manual duplicate and test stale duplicate rejection.
    copied_card=dialog.locator(f'[data-meal-id="{copied["id"]}"]')
    copied_card.get_by_role('button',name='Mover / organizar').click()
    copied_card.get_by_label('Día de destino para Arroz con verduras (copia)').select_option('2')
    page.evaluate(f"window.__planRows.find(x=>x.id==='{copied['id']}').updated_at='changed-on-another-device'")
    before=page.evaluate('window.__planWrites')
    copied_card.get_by_role('button',name='Duplicar Arroz con verduras (copia) en el día seleccionado').click()
    page.get_by_text('No se pudo duplicar la comida',exact=False).wait_for()
    check('Concurrent change blocks duplicating a stale plan row',page.evaluate('window.__planWrites')==before and page.evaluate('window.__planRows.length===3'))
    check('Mobile weekly planner has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),str(page.evaluate('({document:document.documentElement.scrollWidth,width:window.innerWidth})')))
    RESULT.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(RESULT.parent/'e29-week-plan-quick-actions-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1365,'height':900})
    check('Desktop weekly planner has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    page.screenshot(path=str(RESULT.parent/'e29-week-plan-quick-actions-desktop.png'),full_page=True)
    browser.close()
RESULT.parent.mkdir(parents=True,exist_ok=True)
RESULT.write_text(json.dumps({'stage':'E29','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False))
