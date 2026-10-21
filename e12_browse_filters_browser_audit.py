#!/usr/bin/env python3
"""E12 live-dialog browser smoke audit with mocked data (never contacts Supabase)."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def make_html():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    def inline(match):
        href=match.group(1)
        if href.startswith('./css/'):
            p=ROOT/href[2:]
            if p.exists(): return f'<style data-e12-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html=re.sub(r'<link\b[^>]*href="([^\"]+)"[^>]*>',inline,html,flags=re.I)
    # Keep the real application CSS/markup but remove normal app scripts; the tested module is loaded separately.
    html=re.sub(r'<script\b[^>]*>.*?</script\s*>','',html,flags=re.I|re.S)
    html=html.replace('</body>', '<script>window.AgendaNutritionData={loadRecipes:async()=>window.__e12Recipes,loadUserFoods:async()=>window.__e12Foods,loadConsumptionHistory:async()=>window.__e12History,deleteRecipe:async()=>({ok:true}),deleteUserFood:async()=>({ok:true})};window.AgendaFoodCatalog={getPendingMealFoods:()=>[],setPendingMealFoods:()=>{}};window.__e12Recipes=[{id:"r1",name:"Tortilla de huevo",notes:"rápida para merienda",servings:2,total_weight_g:300,calories_per_100g:140,protein_per_100g:9,carbs_per_100g:4,fat_per_100g:8,ingredients:[{name:"Huevo"}],instructions:["Batir el huevo","Cocinar"]},{id:"r2",name:"Arroz base",notes:"guarnición",servings:3,total_weight_g:400,calories_per_100g:130,protein_per_100g:2,carbs_per_100g:27,fat_per_100g:1,ingredients:[{name:"Arroz integral"}],instructions:[]},{id:"r3",name:"Tortilla vegana",notes:"variante vegetal",parent_recipe_id:"r1",servings:2,total_weight_g:240,calories_per_100g:120,protein_per_100g:6,carbs_per_100g:18,fat_per_100g:3,ingredients:[{name:"Harina de garbanzo"}],instructions:["Mezclar harina de garbanzo"]}];window.__e12Foods=[{userFoodId:"f1",name:"Pan integral",brand:"Molino Norte",preparationState:"prepared",calories:240,protein:10,carbs:40,fat:4},{userFoodId:"f2",name:"Arroz",brand:"Campo",preparationState:"cooked",calories:130,protein:2,carbs:28,fat:1},{userFoodId:"f3",name:"Huevo",brand:"Granja",preparationState:"raw",calories:140,protein:13,carbs:1,fat:10}];window.__e12History=[{id:"h1",food_name:"Leche",brand:"Campo Verde",meal_title:"Merienda",meal_type:"snack",meal_time:"16:00",consumed_date:"2026-10-19",quantity:200,unit:"ml",calories:120,protein_g:7,carbs_g:10,fat_g:5,item_snapshot:{preparation_state:"unspecified"}},{id:"h2",food_name:"Pan",brand:"Integral",meal_title:"Desayuno",meal_type:"desayuno",meal_time:"08:00",consumed_date:"2026-10-18",quantity:60,unit:"g",calories:150,protein_g:5,carbs_g:30,fat_g:2,item_snapshot:{}},{id:"h3",food_name:"Arroz",brand:"",meal_title:"Almuerzo",meal_type:"lunch",meal_time:"13:00",consumed_date:"2026-10-18",quantity:150,unit:"g",calories:195,protein_g:4,carbs_g:40,fat_g:1,item_snapshot:{}}];</script></body>')
    return html

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,default=ROOT/'tests/artifacts/e12/browse-filters-browser-audit.json');ap.add_argument('--screenshots',action='store_true');args=ap.parse_args();args.output.parent.mkdir(parents=True,exist_ok=True)
    shots=args.output.parent/'screenshots';shots.mkdir(parents=True,exist_ok=True)
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        for width,height,label in [(390,844,'390x844-mobile'),(1366,768,'1366x768-desktop')]:
            ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<900)
            page=ctx.new_page();page.set_content(make_html(),wait_until='domcontentloaded');
            awaitable=page.add_script_tag(path=str(ROOT/'js/58-nutrition-advanced.js'))
            page.evaluate("document.body.classList.add('light')")
            # Recipes
            page.evaluate('window.AgendaNutritionAdvanced.openRecipes()')
            page.wait_for_selector('#nutritionRecipeList article[data-recipe-card]')
            initial=page.locator('#nutritionRecipeList article[data-recipe-card]').count()
            page.locator('#nutritionRecipeSearch').fill('garbánzo')
            recipe_search_count=page.locator('#nutritionRecipeList article[data-recipe-card]').count()
            recipe_search_text=page.locator('#nutritionRecipeList').inner_text()
            page.locator('#nutritionRecipeClearFilters').click()
            page.locator('#nutritionRecipeFilter').select_option('variants')
            recipe_variant_count=page.locator('#nutritionRecipeList article[data-recipe-card]').count()
            page.locator('#nutritionRecipeFilter').select_option('all')
            page.locator('#nutritionRecipeSearch').fill('no-hay-receta-con-este-texto')
            recipe_empty_count=page.locator('#nutritionRecipeList article[data-recipe-card]').count()
            recipe_empty_state='No encontramos' in page.locator('#nutritionRecipeList').inner_text()
            page.locator('#nutritionRecipeClearFilters').click()
            recipe_clear_count=page.locator('#nutritionRecipeList article[data-recipe-card]').count()
            recipe_overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
            if args.screenshots: page.screenshot(path=str(shots/f'{label}-recipes.png'))
            page.locator('#nutritionAdvancedClose').click()
            # User foods
            page.evaluate('window.AgendaNutritionAdvanced.openUserFoods()')
            page.wait_for_selector('#nutritionUserFoodsList article.nutrition-user-food-card')
            food_initial=page.locator('#nutritionUserFoodsList article.nutrition-user-food-card').count()
            page.locator('#nutritionUserFoodsSearch').fill('molino')
            food_search=page.locator('#nutritionUserFoodsList article.nutrition-user-food-card').count()
            page.locator('#nutritionUserFoodsSearch').fill('')
            page.locator('#nutritionUserFoodsPreparation').select_option('raw')
            food_prep=page.locator('#nutritionUserFoodsList article.nutrition-user-food-card').count()
            page.locator('#nutritionUserFoodsPreparation').select_option('all')
            page.locator('#nutritionUserFoodsSearch').fill('ningun-alimento-coincide')
            food_empty_count=page.locator('#nutritionUserFoodsList article.nutrition-user-food-card').count()
            food_empty_state='No encontramos' in page.locator('#nutritionUserFoodsList').inner_text()
            page.locator('#nutritionUserFoodsClear').click()
            food_clear_count=page.locator('#nutritionUserFoodsList article.nutrition-user-food-card').count()
            if args.screenshots: page.screenshot(path=str(shots/f'{label}-foods.png'))
            page.locator('#nutritionAdvancedClose').click()
            # History
            page.evaluate('window.AgendaNutritionAdvanced.openHistory()')
            page.wait_for_selector('#nutritionHistoryResults .nutrition-history-day')
            history_initial=page.locator('.nutrition-history-item').count()
            page.locator('#nutritionHistorySearch').fill('campo verde')
            history_search=page.locator('.nutrition-history-item').count()
            page.locator('#nutritionHistoryClearFilters').click()
            page.locator('#nutritionHistoryCategory').select_option('breakfast')
            history_category=page.locator('.nutrition-history-item').count()
            page.locator('#nutritionHistoryCategory').select_option('all')
            page.locator('#nutritionHistorySearch').fill('no-existe-en-el-historial')
            history_empty_count=page.locator('.nutrition-history-item').count()
            history_empty_state='No encontramos' in page.locator('#nutritionHistoryResults').inner_text()
            page.locator('#nutritionHistoryClearFilters').click()
            history_clear_count=page.locator('.nutrition-history-item').count()
            history_overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
            if args.screenshots: page.screenshot(path=str(shots/f'{label}-history.png'))
            results.append({'viewport':label,'recipeInitial':initial,'recipeAccentSearch':recipe_search_count,'recipeAccentSearchHasExpected': 'Tortilla vegana' in recipe_search_text,'recipeVariantFilter':recipe_variant_count,'recipeEmptyCount':recipe_empty_count,'recipeEmptyState':recipe_empty_state,'recipeClearCount':recipe_clear_count,'foodInitial':food_initial,'foodBrandSearch':food_search,'foodRawFilter':food_prep,'foodEmptyCount':food_empty_count,'foodEmptyState':food_empty_state,'foodClearCount':food_clear_count,'historyInitial':history_initial,'historyBrandSearch':history_search,'historyBreakfastFilter':history_category,'historyEmptyCount':history_empty_count,'historyEmptyState':history_empty_state,'historyClearCount':history_clear_count,'horizontalOverflow':recipe_overflow or history_overflow})
            page.close();ctx.close()
        browser.close()
    failures=[]
    for r in results:
        if r['recipeInitial']!=3: failures.append(f"{r['viewport']}: recipe initial {r['recipeInitial']}")
        if r['recipeAccentSearch']!=1 or not r['recipeAccentSearchHasExpected']: failures.append(f"{r['viewport']}: recipe ingredient accent search")
        if r['recipeVariantFilter']!=1: failures.append(f"{r['viewport']}: recipe variant filter")
        if r['recipeEmptyCount']!=0 or not r['recipeEmptyState'] or r['recipeClearCount']!=3: failures.append(f"{r['viewport']}: recipe empty/clear states")
        if r['foodInitial']!=3 or r['foodBrandSearch']!=1 or r['foodRawFilter']!=1: failures.append(f"{r['viewport']}: personal food filters")
        if r['foodEmptyCount']!=0 or not r['foodEmptyState'] or r['foodClearCount']!=3: failures.append(f"{r['viewport']}: food empty/clear states")
        if r['historyInitial']!=3 or r['historyBrandSearch']!=1 or r['historyBreakfastFilter']!=1: failures.append(f"{r['viewport']}: history filters")
        if r['historyEmptyCount']!=0 or not r['historyEmptyState'] or r['historyClearCount']!=3: failures.append(f"{r['viewport']}: history empty/clear states")
        if r['horizontalOverflow']: failures.append(f"{r['viewport']}: horizontal overflow")
    report={'stage':'E12','mode':'Chromium browser with mocked nutrition records; no Supabase requests','views':len(results),'checks':len(results)*14,'passed':len(results)*14-len(failures),'failed':len(failures),'results':results,'failures':failures,'limitations':'The browser fixture verifies modal interactions with test data, not account authentication, persisted Supabase records or a physical phone.'}
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f"E12 browser audit: {report['passed']}/{report['checks']} checks passed")
    if failures: print('\n'.join(failures))
    print(f'Report: {args.output}')
    return 1 if failures else 0
if __name__=='__main__': raise SystemExit(main())
