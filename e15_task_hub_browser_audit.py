#!/usr/bin/env python3
"""E15 browser audit: grouped task hub and progressive meal cards using mocked data."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]

def make_html():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    def inline(match):
        href = match.group(1)
        if href.startswith('./css/'):
            p = ROOT / href[2:]
            if p.exists(): return f'<style data-e15-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html = re.sub(r'<link\b[^>]*href="([^"]+)"[^>]*>', inline, html, flags=re.I)
    html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I|re.S)
    return html

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--viewport', choices=['all','320','390','768','1366'], default='all')
    args=parser.parse_args()
    out = ROOT / 'tests/artifacts/e15/task-hub-browser-audit.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    shots = out.parent / 'screenshots'; shots.mkdir(parents=True, exist_ok=True)
    results=[]; failures=[]; dynamic_checks=[]
    viewports=[(320,740,'320x740-mobile'),(390,844,'390x844-mobile'),(768,1024,'768x1024-tablet'),(1366,768,'1366x768-desktop')]
    if args.viewport != 'all': viewports=[v for v in viewports if str(v[0])==args.viewport]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        for width,height,label in viewports:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<900)
            page=context.new_page(); page.set_content(make_html(),wait_until='domcontentloaded')
            page.evaluate('''() => {
              document.getElementById('app')?.classList.remove('hidden');
              const panel=document.getElementById('nutritionPanel');panel.classList.add('open','v32-section-active');
              document.body.classList.add('light');
              window.__recipesOpened=0;window.__plannerClicked=0;window.__addMealClicked=0;window.__editClicked=0;window.__deleteClicked=0;
              window.AgendaNutritionAdvanced={openRecipes:()=>window.__recipesOpened++};
              document.getElementById('addMealBtn').addEventListener('click',()=>window.__addMealClicked++);
              const actions=panel.querySelector('.nutrition-actions');
              const additions=[
                ['nutritionWeeklyPlannerBtn','🗓️ Ver semana','Planificación semanal'],
                ['nutritionShoppingListBtn','🛒 Lista de compras','Compras'],
                ['nutritionPantryBtn','🥫 Despensa','Administrar existencias'],
                ['nutritionStatsBtn','📊 Estadísticas','Consumo e historial'],
                ['nutritionQualityOpen','🔎 Calidad y exportar','Calidad e informes'],
                ['nutritionCopyDayBtn','🔁 Copiar día','Repetir una rutina']
              ];
              additions.forEach(([id,text,title])=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;b.title=title;b.addEventListener('click',()=>b.dataset.clicked='1');actions.insertBefore(b,document.getElementById('addMealBtn'));});
              const list=document.getElementById('mealList');
              list.innerHTML='';
              const card=document.createElement('article');card.className='meal-card';card.dataset.mealId='m1';
              const head=document.createElement('div');head.className='meal-card-head';
              const left=document.createElement('div');
              const name=document.createElement('div');name.className='meal-name';name.textContent='Avena con yogur';left.append(name);
              const foods=document.createElement('div');foods.className='meal-foods';foods.textContent='Avena 50 g, yogur natural 150 g, banana 80 g';left.append(foods);
              const desc=document.createElement('div');desc.className='meal-description';desc.textContent='Desayuno preparado la noche anterior';left.append(desc);
              const meta=document.createElement('div');meta.className='meal-meta';
              ['Cal: 350','Prot: 19 g','Carbs: 52 g','Grasas: 8 g','Hora: 08:00'].forEach(t=>{const chip=document.createElement('span');chip.className='meal-chip';chip.textContent=t;meta.append(chip)});left.append(meta);
              const actions2=document.createElement('div');actions2.className='meal-actions';
              const edit=document.createElement('button');edit.className='meal-action';edit.title='Editar';edit.textContent='✎';edit.addEventListener('click',()=>window.__editClicked++);
              const del=document.createElement('button');del.className='meal-action delete';del.title='Eliminar';del.textContent='×';del.addEventListener('click',()=>window.__deleteClicked++);
              actions2.append(edit,del);head.append(left,actions2);card.append(head);list.append(card);
              const days=document.getElementById('nutritionDays');days.innerHTML='<button class="workout-day-btn active">Lunes</button><button class="workout-day-btn">Martes</button>';
              const tabs=document.getElementById('mealTabs');tabs.innerHTML='<button class="meal-tab active">Desayuno</button><button class="meal-tab">Almuerzo</button>';
            }''')
            page.add_script_tag(content="let nutritionMeals=[]; let nutritionLoadingDay=null; function cacheRead(name){return name==='nutritionMealsAll'?[]:null;}")
            page.add_script_tag(path=str(ROOT/'js/68-nutrition-guided-layout-e13.js'))
            page.add_script_tag(path=str(ROOT/'js/70-nutrition-task-hub-e15.js'))
            page.wait_for_timeout(140)
            state=page.evaluate('''() => {
              const details=document.getElementById('nutritionMoreTools');
              const content=details.querySelector('.e13-tools-content');
              const groups=[...content.querySelectorAll(':scope > .e15-tool-group')].filter(x=>!x.hidden).map(x=>({key:x.dataset.e15Group,title:x.querySelector('h4')?.textContent,buttons:[...x.querySelectorAll('button')].map(b=>({id:b.id,text:b.textContent}))}));
              const card=document.querySelector('#mealList .meal-card');
              const mealDetails=card?.querySelector('.e15-meal-details');
              return {
                groups, totalTools:content.querySelectorAll('button').length,
                count:details.querySelector('.e13-tools-count')?.textContent,
                detailsOpen:details.open, mealDetailsOpen:mealDetails?.open,
                hasPreview:!!card?.querySelector('.e15-meal-card-preview'),
                preview:card?.querySelector('.e15-meal-card-preview')?.textContent,
                kcal:card?.querySelector('.e15-meal-card-kcal')?.textContent,
                movedFoods:!!mealDetails?.querySelector('.meal-foods'),
                movedDescription:!!mealDetails?.querySelector('.meal-description'),
                movedMeta:!!mealDetails?.querySelector('.meal-meta'),
                directHead:!!card?.querySelector(':scope > .meal-card-head'),
                actionLabels:[...card.querySelectorAll('.meal-action')].map(b=>b.getAttribute('aria-label')),
                overflow:document.documentElement.scrollWidth>innerWidth,
                addHeight:Math.round(document.getElementById('addMealBtn').getBoundingClientRect().height),
                toolSummaryHeight:Math.round(details.querySelector(':scope > summary').getBoundingClientRect().height),
                smallestToolHeight:Math.min(...[...content.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)),
                smallestMealActionHeight:Math.min(...[...card.querySelectorAll('.meal-action')].map(b=>b.getBoundingClientRect().height))
              };
            }''')
            ids=[item['id'] for g in state['groups'] for item in g['buttons']]
            if state['totalTools'] != 9: failures.append(f'{label}: expected 9 grouped tools incl recipes shortcut, got {state["totalTools"]}')
            if state['count'] != '9': failures.append(f'{label}: tool badge incorrect: {state["count"]}')
            if width < 900 and (state['addHeight'] < 44 or state['toolSummaryHeight'] < 44 or state['smallestToolHeight'] < 44 or state['smallestMealActionHeight'] < 44): failures.append(f'{label}: a touch target is below 44px (add={state["addHeight"]}, summary={state["toolSummaryHeight"]}, tool={state["smallestToolHeight"]}, meal={state["smallestMealActionHeight"]})')
            if state['overflow']: failures.append(f'{label}: horizontal overflow')
            if not state['hasPreview'] or state['kcal'] != '350 kcal': failures.append(f'{label}: compact meal preview/calorie badge missing')
            if not all([state['movedFoods'],state['movedDescription'],state['movedMeta'],state['directHead']]): failures.append(f'{label}: meal details structure changed unexpectedly')
            required={'nutritionGoalBtn','nutritionHistoryBtn','nutritionWeeklyPlannerBtn','nutritionShoppingListBtn','nutritionPantryBtn','nutritionStatsBtn','nutritionQualityOpen','nutritionCopyDayBtn','nutritionE15RecipesBtn'}
            if not required.issubset(set(ids)): failures.append(f'{label}: missing grouped tools: {sorted(required-set(ids))}')
            if width in (390,1366): page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-initial.png'))
            if label.endswith('mobile') and state['mealDetailsOpen']: failures.append(f'{label}: card details should be collapsed initially on mobile')
            if label.endswith('desktop') and not state['mealDetailsOpen']: failures.append(f'{label}: card details should be open by default on desktop')
            if label.endswith('mobile'):
                page.locator('#nutritionMoreTools > summary').click()
                if not page.locator('#nutritionMoreTools').evaluate('(el)=>el.open'): failures.append(f'{label}: tools hub failed to open')
                page.locator('#nutritionE15RecipesBtn').click()
                if page.evaluate('window.__recipesOpened') != 1: failures.append(f'{label}: recipes shortcut did not open existing recipes flow')
                page.locator('.e15-meal-details > summary').click()
                if not page.locator('.e15-meal-details').evaluate('(el)=>el.open'): failures.append(f'{label}: meal details did not expand')
                page.locator('.meal-action[title="Editar"]').click();page.locator('.meal-action[title="Eliminar"]').click()
                if page.evaluate('[window.__editClicked,window.__deleteClicked]') != [1,1]: failures.append(f'{label}: edit/delete handlers were lost during card decoration')
            if width in (390,1366): page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-expanded.png'))
            if label == '390x844-mobile':
                page.evaluate('''() => { const actions=document.querySelector('#nutritionPanel .nutrition-actions'); const b=document.createElement('button'); b.id='nutritionE15DynamicAuditBtn'; b.type='button'; b.textContent='Herramienta nueva'; b.title='Prueba de herramienta dinámica'; actions.insertBefore(b,document.getElementById('addMealBtn')); }''')
                page.wait_for_timeout(80)
                dynamic=page.evaluate('''() => ({parent:document.getElementById('nutritionE15DynamicAuditBtn')?.closest('.e15-tool-group')?.dataset.e15Group,count:document.querySelector('#nutritionMoreTools .e13-tools-count')?.textContent,total:document.querySelectorAll('#nutritionMoreTools .e13-tools-content button').length})''')
                dynamic_checks.append({'viewport':label,**dynamic,'passed':dynamic=={'parent':'other','count':'10','total':10}})
                if dynamic != {'parent':'other','count':'10','total':10}: failures.append(f'{label}: dynamically added tools were not grouped or counted correctly ({dynamic})')
            results.append({'viewport':label,**state,'groupedIds':ids})
            context.close()
        browser.close()
    output={'audit':'E15 task hub and progressive meal cards','mode':'mocked actions and meals; no Supabase calls','viewports':results,'dynamicToolChecks':dynamic_checks,'failures':failures}
    if args.viewport == 'all' or not out.exists(): out.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    else:
        previous=json.loads(out.read_text(encoding='utf-8'))
        by_label={item['viewport']:item for item in previous.get('viewports',[])}
        by_label.update({item['viewport']:item for item in results})
        previous['viewports']=[by_label[k] for k in ['320x740-mobile','390x844-mobile','768x1024-tablet','1366x768-desktop'] if k in by_label]
        previous['failures']=[x for x in previous.get('failures',[]) if not any(v[2] in x for v in viewports)] + failures
        if dynamic_checks:
            prior={item.get('viewport'):item for item in previous.get('dynamicToolChecks',[])}
            prior.update({item.get('viewport'):item for item in dynamic_checks})
            previous['dynamicToolChecks']=[prior[k] for k in sorted(prior)]
        out.write_text(json.dumps(previous,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(output,ensure_ascii=False,indent=2))
    if failures: raise SystemExit(1)
if __name__=='__main__': main()
