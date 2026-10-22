#!/usr/bin/env python3
"""E23 browser audit for truthful incomplete-nutrient presentation in editor and daily summary."""
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

HTML = r'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E23 test</title></head><body class="light">
<section id="nutritionPanel">
  <div id="nutritionDaySummary"><div class="nutrition-day-summary-head"><div><strong id="nutritionSummaryDay"></strong><span id="nutritionSummaryMeals"></span></div><div><span id="nutritionSummaryMealsBar"></span><span id="nutritionSummaryConsumedBar"></span></div></div>
    <div class="e23-nutrition-data-quality-note" id="e23NutritionDataQualityNote" role="status" aria-live="polite" hidden></div>
    <strong id="nutritionSummaryCaloriesPlanned"></strong><strong id="nutritionSummaryProteinPlanned"></strong><strong id="nutritionSummaryCarbsPlanned"></strong><strong id="nutritionSummaryFatPlanned"></strong>
    <strong id="nutritionSummaryCalories"></strong><strong id="nutritionSummaryProtein"></strong><strong id="nutritionSummaryCarbs"></strong><strong id="nutritionSummaryFat"></strong>
  </div><div id="nutritionGoals"></div><div id="nutritionGoalSummary"></div>
  <section id="v83NutritionSuite"><div><strong id="v83Cal">0</strong><strong id="v83Pro">0</strong><strong id="v83Car">0</strong><strong id="v83Fat">0</strong></div><div id="v83NutriBars"></div></section>
</section>
<div id="nutritionOverlay">
  <input id="mealFoods"><input id="mealCalories" type="number"><input id="mealProtein" type="number"><input id="mealCarbs" type="number"><input id="mealFat" type="number">
  <button id="saveMealBtn" type="button">Guardar comida</button><button id="nutritionFoodCatalogToggle" type="button"></button>
  <div id="nutritionMealBuilder"><div id="nutritionMealBuilderStatus"></div><div id="nutritionMealBuilderList"></div><div id="nutritionMealBuilderEmpty"></div><div id="nutritionMealBuilderTotals"></div></div>
  <button id="nutritionMealBuilderAdd" type="button"></button><button id="nutritionMealBuilderClear" type="button"></button>
  <button id="nutritionMealBuilderSaveRecipe" type="button"></button><button id="nutritionOpenRecipesBtn" type="button"></button>
</div>
</body></html>'''


def main() -> None:
    report_path = ROOT / 'tests/artifacts/e23/calculation-integrity-browser-audit.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    checks: list[dict] = []
    row = {
        'id': 'e23-incomplete-item', 'meal_id': 'e23-meal', 'user_id': 'e23-test-account',
        'name': 'Alimento con proteínas no informadas', 'brand': 'Marca de prueba',
        'quantity': 50, 'unit': 'g', 'quantity_in_grams': 50,
        'calories_per_100g': 380, 'protein_per_100g': 0, 'carbs_per_100g': 60, 'fat_per_100g': 0,
        'nutrition_quality_status': 'incomplete', 'nutrition_missing_fields': ['proteínas'],
        'data_source_label': 'Fuente de prueba', 'consumed': True, 'consumed_at': '2026-10-21T12:00:00Z'
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page.set_content(HTML, wait_until='domcontentloaded')
        page.add_script_tag(content='''
          var DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
          var MEAL_TYPES=[{key:'pre'},{key:'post'},{key:'lunch'},{key:'snack'},{key:'dinner'},{key:'sleep'}];
          var nutritionDay=0;
          var nutritionGoals={calories:2500,protein:160,carbs:300,fat:70};
          var nutritionMeals=[{id:'e23-meal',day:0,meal_type:'lunch',title:'Comida de prueba',calories:190,protein_g:null,carbs_g:30,fat_g:0}];
          var currentUser={id:'e23-test-account'};
          window.AgendaFoodCatalog={
            pending:[],
            getPendingMealFoods(){return this.pending;},
            setPendingMealFoods(items){this.pending=items;document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:items.length}}));},
            clearPendingMealFoods(){this.pending=[];}
          };
        ''')
        page.add_script_tag(path=str(ROOT / 'js/49-nutrition-persistence.js'))
        page.evaluate('''row => {
          window.__e23Row=row;
          window.AgendaNutritionData.loadMealItems=async()=>[row];
          window.AgendaFoodCatalog.pending=[row];
        }''', row)
        page.add_style_tag(path=str(ROOT / 'css/104-nutrition-calculation-integrity-e23.css'))
        page.add_script_tag(path=str(ROOT / 'js/52-nutrition-meal-builder.js'))
        page.wait_for_timeout(80)
        builder = page.evaluate('''() => ({
          totals:[...document.querySelectorAll('#nutritionMealBuilderTotals > div')].map(card=>({label:card.querySelector('span')?.textContent||'',value:card.querySelector('strong')?.textContent||'',incomplete:card.classList.contains('has-incomplete-value')})),
          proteinInput:document.getElementById('mealProtein').value,
          proteinInputStatus:document.getElementById('mealProtein').dataset.nutritionValueStatus,
          caloriesInput:document.getElementById('mealCalories').value,
          fatInput:document.getElementById('mealFat').value,
          itemMacros:document.querySelector('.nutrition-meal-builder-item-macros')?.textContent||'',
          itemWarning:document.querySelector('.nutrition-meal-builder-item-quality')?.textContent||'',
          status:document.getElementById('nutritionMealBuilderStatus').textContent
        })''')
        protein_card = next((x for x in builder['totals'] if 'Proteínas' in x['label']), {})
        if protein_card.get('value') != 'Dato incompleto' or not protein_card.get('incomplete'):
            failures.append(f'Builder presented missing protein as a number: {builder}')
        checks.append({'name':'Meal editor marks only the incomplete nutrient instead of zero','passed':protein_card.get('value') == 'Dato incompleto' and bool(protein_card.get('incomplete')),'result':builder})
        if builder['proteinInput'] != '' or builder['proteinInputStatus'] != 'incomplete':
            failures.append(f'Meal summary input did not retain the incomplete state: {builder}')
        if builder['caloriesInput'] != '190' or builder['fatInput'] != '0':
            failures.append(f'Known calorie or explicit zero value was altered: {builder}')
        checks.append({'name':'Unknown value clears the numeric summary input while known values and zero stay numeric','passed':builder['proteinInput'] == '' and builder['proteinInputStatus'] == 'incomplete' and builder['caloriesInput'] == '190' and builder['fatInput'] == '0','result':{'protein':builder['proteinInput'],'proteinStatus':builder['proteinInputStatus'],'calories':builder['caloriesInput'],'fatZero':builder['fatInput']}})
        if 'dato faltante' not in builder['itemMacros'].lower() or 'No se interpretan como cero' not in builder['itemWarning']:
            failures.append(f'Food row did not explain the missing value: {builder}')
        checks.append({'name':'Food row explains the missing nutrient and preserves provenance context','passed':'dato faltante' in builder['itemMacros'].lower() and 'No se interpretan como cero' in builder['itemWarning'],'result':{'macros':builder['itemMacros'],'warning':builder['itemWarning']}})
        page.add_script_tag(path=str(ROOT / 'js/55-nutrition-live-summary.js'))
        page.wait_for_function("!document.getElementById('e23NutritionDataQualityNote').hidden", timeout=2000)
        summary = page.evaluate('''() => ({
          plannedProtein:document.getElementById('nutritionSummaryProteinPlanned').textContent,
          consumedProtein:document.getElementById('nutritionSummaryProtein').textContent,
          plannedCalories:document.getElementById('nutritionSummaryCaloriesPlanned').textContent,
          consumedCalories:document.getElementById('nutritionSummaryCalories').textContent,
          note:document.getElementById('e23NutritionDataQualityNote').textContent,
          goalCards:[...document.querySelectorAll('#nutritionGoals .goal-card')].map(card=>({text:card.textContent,unknown:card.classList.contains('has-incomplete-data'),barHidden:card.querySelector('.goal-bar')?.hidden}))
        })''')
        protein_goal = next((x for x in summary['goalCards'] if 'Proteínas' in x['text']), {})
        if summary['plannedProtein'] != 'Datos incompletos' or summary['consumedProtein'] != 'Datos incompletos':
            failures.append(f'Daily planned/consumed totals misrepresented missing protein: {summary}')
        checks.append({'name':'Daily planned and consumed summaries label the incomplete macro','passed':summary['plannedProtein'] == 'Datos incompletos' and summary['consumedProtein'] == 'Datos incompletos','result':summary})
        if not protein_goal.get('unknown') or not protein_goal.get('barHidden') or 'Datos incompletos' not in protein_goal.get('text',''):
            failures.append(f'Protein goal appears to have numeric zero progress rather than unknown data: {summary}')
        checks.append({'name':'Goal progress is withheld where consumed nutrient data are incomplete','passed':bool(protein_goal.get('unknown')) and bool(protein_goal.get('barHidden')) and 'Datos incompletos' in protein_goal.get('text',''),'result':protein_goal})
        # Validate the secondary nutrition dashboard without touching shared workout code.
        page.add_script_tag(path=str(ROOT / 'js/74-nutrition-data-integrity-e23.js'))
        page.wait_for_function("document.querySelector('#v83NutritionSuite .v83-nutrition-unknown') !== null", timeout=2000)
        secondary = page.evaluate('''() => ({
          protein:document.getElementById('v83Pro').textContent,
          calorie:document.getElementById('v83Cal').textContent,
          proteinRow:[...document.querySelectorAll('#v83NutriBars .v83-nutrition-unknown')].map(x=>x.textContent),
          hasProteinMeter:[...document.querySelectorAll('#v83NutriBars .v83-nutrition-metric')].some(x=>x.textContent.includes('Proteína') && x.querySelector('.v83-meter'))
        })''')
        secondary_pass = secondary['protein'] == '—' and secondary['calorie'] == '190' and any('Proteína' in row and 'Datos incompletos' in row for row in secondary['proteinRow']) and not secondary['hasProteinMeter']
        if not secondary_pass:
            failures.append(f'Secondary nutrition dashboard did not withhold incomplete nutrient progress: {secondary}')
        checks.append({'name':'Secondary nutrition dashboard marks unknown totals without creating false progress','passed':secondary_pass,'result':secondary})
        if page.evaluate('document.documentElement.scrollWidth > innerWidth'):
            failures.append('E23 browser fixture has horizontal overflow at 390px')
        checks.append({'name':'Mobile layout has no horizontal overflow','passed':not page.evaluate('document.documentElement.scrollWidth > innerWidth'),'result':{'scrollWidth':page.evaluate('document.documentElement.scrollWidth'),'innerWidth':page.evaluate('innerWidth')}})
        browser.close()
    report = {'passed': not failures, 'totalChecks': len(checks), 'passedChecks': sum(1 for item in checks if item['passed']), 'failures': failures, 'checks': checks}
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'passed': report['passed'], 'totalChecks': report['totalChecks'], 'passedChecks': report['passedChecks'], 'failures': failures, 'report': str(report_path)}, ensure_ascii=False))
    if failures:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
