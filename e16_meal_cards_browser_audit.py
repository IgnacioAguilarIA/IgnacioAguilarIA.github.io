#!/usr/bin/env python3
"""E16 browser audit: meal-card summary, details, actions and responsive behavior."""
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
            if p.exists(): return f'<style data-e16-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html = re.sub(r'<link\b[^>]*href="([^"]+)"[^>]*>', inline, html, flags=re.I)
    html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I|re.S)
    return html

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--viewport', choices=['all','320','390','768','1366'], default='all')
    parser.add_argument('--theme', choices=['all','light','dark'], default='all')
    args=parser.parse_args()
    out=ROOT/'tests/artifacts/e16/meal-cards-browser-audit.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    shots=out.parent/'screenshots';shots.mkdir(parents=True,exist_ok=True)
    viewports=[(320,740,'320x740-mobile'),(390,844,'390x844-mobile'),(768,1024,'768x1024-tablet'),(1366,768,'1366x768-desktop')]
    if args.viewport!='all': viewports=[v for v in viewports if str(v[0])==args.viewport]
    themes=['light','dark'] if args.theme=='all' else [args.theme]
    results=[];failures=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        for width,height,label in viewports:
          for theme in themes:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<900)
            page=context.new_page();page.set_content(make_html(),wait_until='domcontentloaded')
            page.evaluate('''() => {
              document.getElementById('app')?.classList.remove('hidden');
              const panel=document.getElementById('nutritionPanel');panel.classList.add('open','v32-section-active');
              document.body.classList.toggle('light', document.body.dataset.theme==='light');
              window.__editClicks=0;window.__deleteClicks=0;
              window.AgendaNutritionAdvanced={openRecipes:()=>{}};
              const list=document.getElementById('mealList');list.innerHTML='';
              const card=document.createElement('article');card.className='meal-card';card.dataset.mealId='meal-e16';
              const head=document.createElement('div');head.className='meal-card-head';
              const left=document.createElement('div');
              const name=document.createElement('div');name.className='meal-name';name.textContent='Avena con yogur';left.append(name);
              const foods=document.createElement('div');foods.className='meal-foods';foods.textContent='Avena 50 g, yogur natural 150 g, banana 80 g';left.append(foods);
              const desc=document.createElement('div');desc.className='meal-description';desc.textContent='Desayuno preparado la noche anterior';left.append(desc);
              const meta=document.createElement('div');meta.className='meal-meta';
              ['Cal: 350','Prot: 19 g','Carbs: 52 g','Grasas: 8 g','Hora: 08:00'].forEach(t=>{const chip=document.createElement('span');chip.className='meal-chip';chip.textContent=t;meta.append(chip)});left.append(meta);
              const actions=document.createElement('div');actions.className='meal-actions';
              const edit=document.createElement('button');edit.className='meal-action';edit.title='Editar';edit.textContent='✎';edit.addEventListener('click',()=>window.__editClicks++);
              const del=document.createElement('button');del.className='meal-action delete';del.title='Eliminar';del.textContent='×';del.addEventListener('click',()=>window.__deleteClicks++);
              actions.append(edit,del);head.append(left,actions);card.append(head);list.append(card);
              const details=document.getElementById('nutritionMoreTools');if(details)details.open=false;
            }''')
            # Set the selected theme after body initialization then load the real E13/E15/E16 scripts.
            page.evaluate('(theme) => document.body.classList.toggle("light", theme === "light")', theme)
            page.add_script_tag(content="let nutritionMeals=[]; let nutritionLoadingDay=null; function cacheRead(name){return name==='nutritionMealsAll'?[]:null;}")
            page.add_script_tag(path=str(ROOT/'js/68-nutrition-guided-layout-e13.js'))
            page.add_script_tag(path=str(ROOT/'js/70-nutrition-task-hub-e15.js'))
            page.add_script_tag(path=str(ROOT/'js/71-nutrition-meal-cards-e16.js'))
            page.wait_for_timeout(45)
            state=page.evaluate('''() => {
              const card=document.querySelector('#mealList .meal-card');
              const details=card?.querySelector('.e15-meal-details');
              const summary=details?.querySelector('summary');
              const glance=card?.querySelector('.e16-meal-glance');
              const meta=details?.querySelector('.meal-meta');
              return {
                hasGlance:!!glance,
                kcal:glance?.querySelector('.e15-meal-card-kcal')?.textContent||'',
                protein:glance?.querySelector('.e16-meal-protein')?.textContent||'',
                time:glance?.querySelector('.e16-meal-time')?.textContent||'',
                metaPreserved:!!meta && meta.querySelectorAll('.meal-chip').length===5,
                summaryText:summary?.querySelector('span:first-child')?.textContent.trim()||'',
                summaryAria:summary?.getAttribute('aria-label')||'',
                controls:summary?.getAttribute('aria-controls')||'',
                directHead:!!card?.querySelector(':scope > .meal-card-head'),
                actions:[...card.querySelectorAll('.meal-action')].map(b=>({label:b.getAttribute('aria-label'),height:Math.round(b.getBoundingClientRect().height)})),
                overflow:document.documentElement.scrollWidth>innerWidth,
                detailsOpen:details?.open
              };
            }''')
            if not state['hasGlance']: failures.append(f'{label}/{theme}: quick summary missing')
            if state['kcal']!='350 kcal': failures.append(f'{label}/{theme}: kcal badge missing or altered')
            if state['protein']!='Proteína 19 g': failures.append(f'{label}/{theme}: protein summary incorrect: {state["protein"]}')
            if state['time']!='◷ 08:00': failures.append(f'{label}/{theme}: time summary incorrect: {state["time"]}')
            if not state['metaPreserved']: failures.append(f'{label}/{theme}: original macro detail chips were lost')
            expected=('Ver detalles' if width<=700 else 'Ingredientes, notas y nutrientes') if not state['detailsOpen'] else 'Ocultar detalles'
            if state['summaryText']!=expected: failures.append(f'{label}/{theme}: disclosure label {state["summaryText"]!r}, expected {expected!r}')
            if not state['summaryAria'] or not state['controls']: failures.append(f'{label}/{theme}: disclosure accessibility attributes missing')
            if not state['directHead']: failures.append(f'{label}/{theme}: direct meal header changed; consumption module depends on it')
            if state['overflow']: failures.append(f'{label}/{theme}: horizontal overflow')
            if width<900 and any(a['height']<42 for a in state['actions']): failures.append(f'{label}/{theme}: action touch target too small: {state["actions"]}')
            if width in (390,1366): page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-{theme}-initial.png'))
            page.locator('#mealList .e15-meal-details > summary').click()
            expected_after_toggle = not bool(state['detailsOpen'])
            actual_after_toggle = page.locator('#mealList .e15-meal-details').evaluate('(el)=>el.open')
            if actual_after_toggle != expected_after_toggle: failures.append(f'{label}/{theme}: detail disclosure toggle produced {actual_after_toggle}, expected {expected_after_toggle}')
            expected_toggled_label = 'Ocultar detalles' if expected_after_toggle else ('Ver detalles' if width <= 700 else 'Ingredientes, notas y nutrientes')
            page.wait_for_function('(expected) => document.querySelector("#mealList .e15-meal-details > summary span:first-child")?.textContent.trim() === expected', arg=expected_toggled_label, timeout=1000)
            toggled_label = page.locator('#mealList .e15-meal-details > summary span:first-child').text_content().strip()
            if toggled_label != expected_toggled_label: failures.append(f'{label}/{theme}: toggle label {toggled_label!r}, expected {expected_toggled_label!r}')
            page.locator('#mealList .meal-action[title="Editar"]').click()
            page.locator('#mealList .meal-action[title="Eliminar"]').click()
            counts=page.evaluate('() => [window.__editClicks,window.__deleteClicks]')
            if counts != [1,1]: failures.append(f'{label}/{theme}: existing edit/delete handlers changed: {counts}')
            if width == 390 and theme == 'light': page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-{theme}-expanded.png'))
            results.append({'viewport':label,'theme':theme,**state,'editDeleteHandlers':counts})
            context.close()
        browser.close()
    out.write_text(json.dumps({'passed':not failures,'checks':len(results),'failures':failures,'results':results},indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'passed':not failures,'checks':len(results),'failures':failures,'report':str(out)},ensure_ascii=False))
    if failures: raise SystemExit(1)
if __name__=='__main__': main()
