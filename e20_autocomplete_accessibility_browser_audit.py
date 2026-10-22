#!/usr/bin/env python3
"""E20 browser regression: keyboard and screen-reader semantics for both nutrition autocompletes."""
from __future__ import annotations
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]


def source_html():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    def inline(match):
        href=match.group(1)
        if href.startswith('./css/'):
            p=ROOT/href[2:]
            if p.exists(): return f'<style data-e20-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html=re.sub(r'<link\b[^>]*href="([^"]+)"[^>]*>',inline,html,flags=re.I)
    html=re.sub(r'<script\b[^>]*>.*?</script\s*>','',html,flags=re.I|re.S)
    return html


def main():
    out=ROOT/'tests/artifacts/e20/autocomplete-accessibility-browser-audit.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    failures=[]; checks=[]
    product={"id":"e20-oats","name":"Avena integral","brand":"Molino de prueba","calories_per_100g":370,"protein_per_100g":13,"carbs_per_100g":60,"fat_per_100g":7,"fiber_per_100g":8,"source":"curated","data_source_label":"Catálogo interno","source_url":"https://example.test/oats","nutrition_quality_status":"source_complete","nutrition_missing_fields":[],"preparation_state":"unspecified","unit":"g","is_generic":True,"active":True}
    incomplete={"id":"e20-incomplete","name":"Producto incompleto","brand":"Marca de prueba","calories_per_100g":0,"protein_per_100g":None,"carbs_per_100g":30,"fat_per_100g":0,"fiber_per_100g":None,"source":"curated","data_source_label":"Catálogo interno","nutrition_quality_status":"legacy_unverified","nutrition_missing_fields":[],"preparation_state":"unspecified","unit":"g","is_generic":True,"active":True}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        page=browser.new_page(viewport={"width":390,"height":844})
        page.set_default_timeout(2500)
        page.set_content(source_html(),wait_until='domcontentloaded')
        page.evaluate('''() => {
          document.getElementById('app')?.classList.remove('hidden');
          document.getElementById('nutritionOverlay')?.classList.add('show');
          document.getElementById('nutritionPanel')?.classList.add('open','v32-section-active');
          document.getElementById('nutritionFoodCatalog')?.removeAttribute('hidden');
          window.currentUser={id:'e20-test-account'};
          const food=__FOOD__;
          const incomplete=__INCOMPLETE__;
          const rows=[food,incomplete];
          window.ensureSupabase=async()=>({from:(table)=>{const query={select(){return query;},eq(){return query;},order(){return query;},limit(){return Promise.resolve({data:table==='food_catalog'?rows:[],error:null});}};return query;}});
          window.AgendaNutritionData={};
          window.AgendaFoodCatalogOFF={search:async(q)=>[]};
          window.AgendaFoodCatalog={select:(value)=>{window.__e20Selected=value?.name||'';window.__e20SelectedFood=value||null;}};
        }'''.replace('__FOOD__',json.dumps(product)).replace('__INCOMPLETE__',json.dumps(incomplete)))
        page.add_script_tag(path=str(ROOT/'js/50-nutrition-food-autocomplete.js'))
        # Main food catalog: query, verify roles, highlight with arrows and select with Enter.
        search=page.locator('#nutritionFoodSearch')
        await_status=page.wait_for_timeout
        baseline=search.evaluate('''el=>({role:el.getAttribute('role'),expanded:el.getAttribute('aria-expanded'),controls:el.getAttribute('aria-controls'),hasControl:!!document.getElementById(el.getAttribute('aria-controls'))})''')
        if baseline['role']!='combobox' or baseline['expanded']!='false' or not baseline['hasControl']:
            failures.append(f'food input combobox setup: {baseline}')
        checks.append({'name':'food input combobox contract','passed':baseline['role']=='combobox' and baseline['expanded']=='false' and baseline['hasControl'],'result':baseline})
        search.fill('ave'); await_status(230)
        option=page.locator('#nutritionFoodAutocomplete [role="option"]').first
        if option.count()!=1:
            failures.append(f'food suggestions missing option role; count={page.locator("#nutritionFoodAutocomplete [role=option]").count()}')
        else:
            semantics=page.evaluate('''() => {const input=document.getElementById('nutritionFoodSearch');const list=document.getElementById(input.getAttribute('aria-controls'));const option=list.querySelector('[role="option"]');return {expanded:input.getAttribute('aria-expanded'),listRole:list.getAttribute('role'),name:option.querySelector('.nutrition-food-autocomplete-title')?.textContent,selected:option.getAttribute('aria-selected'),groupRole:option.closest('[role="group"]')?.getAttribute('role'),busy:document.querySelector('#nutritionFoodAutocomplete [role="status"]')?.textContent}}''')
            search.press('ArrowDown'); await_status(20)
            active=search.get_attribute('aria-activedescendant')
            active_state=page.evaluate('''id=>{const el=document.getElementById(id);return {exists:!!el,selected:el?.getAttribute('aria-selected'),classActive:el?.classList.contains('is-active'),role:el?.getAttribute('role')}}''',active)
            if semantics['expanded']!='true' or semantics['listRole']!='listbox' or semantics['name']!='Avena integral' or semantics['groupRole']!='group': failures.append(f'food results semantics: {semantics}')
            if not active or not active_state['exists'] or active_state['selected']!='true' or not active_state['classActive'] or active_state['role']!='option': failures.append(f'food arrow selection not announced: active={active}, state={active_state}')
            search.press('Enter'); await_status(80)
            picked=page.evaluate('''() => ({selected:window.__e20Selected,expanded:document.getElementById('nutritionFoodSearch').getAttribute('aria-expanded'),active:document.getElementById('nutritionFoodSearch').getAttribute('aria-activedescendant'),hidden:document.getElementById('nutritionFoodAutocomplete').hidden})''')
            if picked['selected']!='Avena integral' or picked['expanded']!='false' or picked['active'] or not picked['hidden']: failures.append(f'food Enter selection close state: {picked}')
            checks.append({'name':'food results, arrow navigation and Enter','passed':not any('food ' in e and ('suggestions' in e or 'semantics' in e or 'arrow selection' in e or 'Enter selection' in e) for e in failures),'result':{'semantics':semantics,'active':active_state,'picked':picked}})
        # Empty result is announced outside the selectable listbox, and Escape collapses it.
        search.fill('zzzz'); await_status(820)
        empty=page.evaluate('''() => {const input=document.getElementById('nutritionFoodSearch');const box=document.getElementById('nutritionFoodAutocomplete');return {expanded:input.getAttribute('aria-expanded'),boxHidden:box.hidden,listRole:document.getElementById(input.getAttribute('aria-controls'))?.getAttribute('role'),optionCount:box.querySelectorAll('[role="option"]').length,statusRole:box.querySelector('[role="status"]')?.getAttribute('role'),status:box.querySelector('[role="status"]')?.textContent}}''')
        if empty['expanded']!='true' or empty['boxHidden'] or empty['optionCount']!=0 or empty['statusRole']!='status' or 'No encontré coincidencias' not in empty['status']:
            failures.append(f'empty state accessibility: {empty}')
        search.press('Escape')
        escaped=search.evaluate('''el=>({expanded:el.getAttribute('aria-expanded'),active:el.getAttribute('aria-activedescendant'),hidden:document.getElementById('nutritionFoodAutocomplete').hidden})''')
        if escaped['expanded']!='false' or escaped['active'] or not escaped['hidden']: failures.append(f'food Escape close state: {escaped}')
        checks.append({'name':'empty state announcement and Escape','passed':empty['expanded']=='true' and not empty['boxHidden'] and empty['optionCount']==0 and empty['statusRole']=='status' and 'No encontré coincidencias' in empty['status'] and escaped['expanded']=='false' and not escaped['active'] and escaped['hidden'],'result':{'empty':empty,'escaped':escaped}})
        # Incomplete nutrients must be explicit, never rendered as if zero were confirmed.
        search.fill('incompleto'); await_status(230)
        incomplete_option=page.locator('#nutritionFoodAutocomplete [role=option]').first
        incomplete_view=incomplete_option.evaluate('''el=>({quality:el.querySelector('.nutrition-food-autocomplete-quality')?.textContent||'',macros:!!el.querySelector('.nutrition-food-autocomplete-macros'),text:el.textContent})''')
        if 'Datos incompletos' not in incomplete_view['quality'] or 'proteínas' not in incomplete_view['quality'] or incomplete_view['macros'] or '0 kcal' in incomplete_view['text']:
            failures.append(f'incomplete nutrition was presented as confirmed zero values: {incomplete_view}')
        incomplete_option.click(); await_status(80)
        incomplete_selected=page.evaluate('''() => ({name:window.__e20Selected,missing:window.__e20SelectedFood?.nutritionMissing||[]})''')
        if incomplete_selected['name']!='Producto incompleto' or 'proteínas' not in incomplete_selected['missing']:
            failures.append(f'incomplete nutrition metadata not preserved on selection: {incomplete_selected}')
        checks.append({'name':'incomplete nutritional values are labeled and metadata is preserved','passed':'Datos incompletos' in incomplete_view['quality'] and 'proteínas' in incomplete_view['quality'] and not incomplete_view['macros'] and '0 kcal' not in incomplete_view['text'] and incomplete_selected['name']=='Producto incompleto' and 'proteínas' in incomplete_selected['missing'],'result':{'view':incomplete_view,'selected':incomplete_selected}})

        # Name-completion field uses the same accessible behavior but only fills the title.
        title=page.locator('#mealTitle')
        page.evaluate('''() => {window.__e20Selected='';window.__e20SelectedFood=null;document.getElementById('nutritionFoodSearch').value='arroz existente';document.getElementById('nutritionFoodQuantity').value='37';}''')
        title.fill('ave'); await_status(230)
        title_count=page.locator('#nutritionMealTitleAutocomplete [role="option"]').count()
        if title_count!=1: failures.append(f'title suggestions missing option role; count={title_count}')
        title.press('ArrowDown'); await_status(20)
        active_title=title.get_attribute('aria-activedescendant')
        title_active_state=page.evaluate('''id=>{const el=document.getElementById(id);return {exists:!!el,selected:el?.getAttribute('aria-selected'),role:el?.getAttribute('role')}}''',active_title)
        title.press('Enter'); await_status(80)
        title_picked=page.evaluate('''() => ({selected:window.__e20Selected,value:document.getElementById('mealTitle').value,foodSearch:document.getElementById('nutritionFoodSearch').value,quantity:document.getElementById('nutritionFoodQuantity').value,activeElement:document.activeElement?.id,expanded:document.getElementById('mealTitle').getAttribute('aria-expanded'),active:document.getElementById('mealTitle').getAttribute('aria-activedescendant'),hidden:document.getElementById('nutritionMealTitleAutocomplete').hidden})''')
        if title_active_state['selected']!='true' or title_active_state['role']!='option' or title_picked['value']!='Avena integral' or title_picked['selected'] or title_picked['foodSearch']!='arroz existente' or title_picked['quantity']!='37' or title_picked['expanded']!='false' or title_picked['active'] or not title_picked['hidden']:
            failures.append(f'title autocomplete modified ingredients/quantity or failed selection: active={title_active_state}, picked={title_picked}')
        checks.append({'name':'meal title suggestions fill only the title and never add an ingredient','passed':title_count==1 and title_active_state['selected']=='true' and title_active_state['role']=='option' and title_picked['value']=='Avena integral' and not title_picked['selected'] and title_picked['foodSearch']=='arroz existente' and title_picked['quantity']=='37' and title_picked['expanded']=='false' and not title_picked['active'] and title_picked['hidden'],'result':{'active':title_active_state,'picked':title_picked}})
        # An online refresh arriving while navigating must preserve the active suggestion.
        title.fill('ave'); await_status(230); title.press('ArrowDown'); await_status(20)
        active_before_refresh=title.get_attribute('aria-activedescendant')
        await_status(560)
        active_after_refresh=title.get_attribute('aria-activedescendant')
        refreshed_active=page.evaluate('''id=>({exists:!!document.getElementById(id),selected:document.getElementById(id)?.getAttribute('aria-selected'),name:document.getElementById(id)?.querySelector('.nutrition-food-autocomplete-title')?.textContent})''',active_after_refresh or '')
        if not active_before_refresh or active_after_refresh!=active_before_refresh or refreshed_active['selected']!='true':
            failures.append(f'active title suggestion was lost after provider refresh: before={active_before_refresh}, after={active_after_refresh}, state={refreshed_active}')
        checks.append({'name':'keyboard selection survives asynchronous provider refresh','passed':bool(active_before_refresh) and active_after_refresh==active_before_refresh and refreshed_active['selected']=='true','result':{'before':active_before_refresh,'after':active_after_refresh,'state':refreshed_active}})

        # Escape from a highlighted title suggestion.
        title.fill('ave'); await_status(220); title.press('ArrowDown'); await_status(10); title.press('Escape')
        title_escape=title.evaluate('''el=>({expanded:el.getAttribute('aria-expanded'),active:el.getAttribute('aria-activedescendant'),hidden:document.getElementById('nutritionMealTitleAutocomplete').hidden,activeClass:!!document.querySelector('#nutritionMealTitleAutocomplete .nutrition-food-autocomplete-item.is-active')})''')
        if title_escape['expanded']!='false' or title_escape['active'] or not title_escape['hidden'] or title_escape['activeClass']:
            failures.append(f'title Escape cleanup: {title_escape}')
        checks.append({'name':'meal title Escape cleanup','passed':title_escape['expanded']=='false' and not title_escape['active'] and title_escape['hidden'] and not title_escape['activeClass'],'result':title_escape})
        await_status(80)
        browser.close()
    result={'passed':not failures,'totalChecks':len(checks),'passedChecks':sum(1 for c in checks if c['passed']),'failures':failures,'checks':checks,'scope':'nutrition autocompletes only; stubbed local/online providers; no Supabase production access'}
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':result['passed'],'totalChecks':result['totalChecks'],'passedChecks':result['passedChecks'],'failures':failures,'report':str(out)},ensure_ascii=False))
    if failures: raise SystemExit(1)

if __name__=='__main__': main()
