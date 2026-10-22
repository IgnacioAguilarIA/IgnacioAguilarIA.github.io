#!/usr/bin/env python3
"""E25 browser audit for recipe nutrient transparency, undo and unsaved-edit protection."""
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=r'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<button id="nutritionMealBuilderSaveRecipe" type="button">Guardar como receta</button>
<button id="nutritionOpenRecipesBtn" type="button">Mis recetas</button>
<button id="nutritionCreateCustomFoodBtn" type="button">Crear alimento</button>
<button id="nutritionManageCustomFoodsBtn" type="button">Mis alimentos</button>
<button id="nutritionHistoryBtn" type="button">Historial</button>
</body></html>'''

def main():
    report_path=ROOT/'tests/artifacts/e25/recipe-editor-browser-audit.json'
    report_path.parent.mkdir(parents=True,exist_ok=True)
    checks=[]; failures=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        page.set_content(HTML,wait_until='domcontentloaded')
        page.add_script_tag(content=r'''
          const food={name:'Avena con proteína sin informar',brand:'',quantity:100,unit:'g',quantity_in_grams:100,calories_per_100g:380,protein_per_100g:0,carbs_per_100g:68,fat_per_100g:7,fiber_per_100g:10,nutrition_quality_status:'incomplete',nutrition_missing_fields:['proteínas'],consumed:false,consumed_at:null};
          window.AgendaFoodCatalog={pending:[food],getPendingMealFoods(){return this.pending},setPendingMealFoods(items){this.pending=items}};
          window.AgendaNutritionData={
            missingMacroMetrics(item){return (item.nutrition_missing_fields||[]).some(x=>/prote/i.test(x))?['protein']:[]},
            recipeIngredientMissingMetrics(item){return new Set(this.missingMacroMetrics(item))},
            calculateRecipe(items,finishedWeightG){const unknown=[...new Set(items.flatMap(x=>this.missingMacroMetrics(x)))];const weight=items.reduce((n,x)=>n+Number(x.quantity_in_grams||x.quantity||0),0);return {ingredient_weight_g:weight,total_weight_g:finishedWeightG||weight,finished_weight_g:finishedWeightG||null,total_calories:380,total_protein_g:0,total_carbs_g:68,total_fat_g:7,total_fiber_g:10,calories_per_100g:380,protein_per_100g:0,carbs_per_100g:68,fat_per_100g:7,fiber_per_100g:10,unknownMetrics:unknown}},
            saveRecipe:async recipe=>({ok:true,recipe:{...recipe,id:'test-recipe'}}),loadRecipes:async()=>[],
          };
          window.__confirmChoice=false;window.confirm=()=>window.__confirmChoice;
        ''')
        page.add_script_tag(path=str(ROOT/'js/58-nutrition-advanced.js'))
        page.add_style_tag(path=str(ROOT/'css/76-nutrition-advanced.css'))
        page.add_style_tag(path=str(ROOT/'css/106-nutrition-recipe-quality-e25.css'))
        page.locator('#nutritionMealBuilderSaveRecipe').click()
        page.wait_for_selector('#nutritionRecipeSaveForm')
        quality=page.locator('#nutritionRecipeIngredientEditor').inner_text()
        preview=page.locator('#nutritionRecipePreview').inner_text()
        passed='proteínas: No informado' in quality and 'Datos incompletos: proteínas' in preview
        checks.append({'name':'recipe ingredient and totals disclose missing protein','passed':passed,'result':{'ingredient':quality,'preview':preview}})
        if not passed: failures.append('recipe modal treated explicitly missing protein as known zero')

        page.locator('[data-recipe-ingredient-remove="0"]').click()
        undo_visible=page.locator('#nutritionRecipeUndoBtn').is_visible()
        empty=page.locator('#nutritionRecipeIngredientEditor').inner_text()
        page.locator('#nutritionRecipeUndoBtn').click()
        restored=page.locator('#nutritionRecipeIngredientEditor').inner_text()
        passed=undo_visible and 'No hay ingredientes' in empty and 'Avena con proteína sin informar' in restored
        checks.append({'name':'removed recipe ingredient can be restored within undo window','passed':passed,'result':{'undoVisible':undo_visible,'restored':restored}})
        if not passed: failures.append('recipe ingredient undo failed')

        page.locator('#nutritionRecipeName').fill('Receta con cambios no guardados')
        unload=page.evaluate("""() => {const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}""")
        page.keyboard.press('Escape')
        escape_kept=page.locator('#nutritionRecipeSaveForm').is_visible()
        passed=unload and escape_kept
        checks.append({'name':'Escape and beforeunload protect a dirty recipe draft','passed':passed,'result':{'beforeUnloadPrevented':unload,'editorStillOpenAfterEscape':escape_kept}})
        if not passed: failures.append('recipe editor did not protect a dirty draft from Escape or beforeunload')

        page.locator('#nutritionAdvancedClose').click()
        kept=page.locator('#nutritionRecipeSaveForm').is_visible()
        passed=kept
        checks.append({'name':'closing dirty recipe editor is canceled without losing the draft','passed':passed,'result':{'editorStillOpen':kept}})
        if not passed: failures.append('recipe editor closed even though discard was declined')

        page.evaluate('window.__confirmChoice=true')
        page.locator('#nutritionAdvancedClose').click()
        closed=page.locator('#nutritionRecipeSaveForm').count()==0
        checks.append({'name':'explicit discard confirmation closes the recipe editor','passed':closed,'result':{'editorClosed':closed}})
        if not closed: failures.append('confirmed discard did not close recipe editor')
        browser.close()
    report={'stage':'E25','checks':checks,'passed':sum(bool(c['passed']) for c in checks),'total':len(checks),'failures':failures}
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if failures: raise SystemExit(1)
if __name__=='__main__': main()
