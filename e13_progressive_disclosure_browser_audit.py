#!/usr/bin/env python3
"""E13: progressive disclosure and newcomer guidance audit with mocked meals/tools."""
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
            if p.exists(): return f'<style data-e13-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html = re.sub(r'<link\b[^>]*href="([^"]+)"[^>]*>', inline, html, flags=re.I)
    html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I|re.S)
    html = html.replace('</body>', '</body>')
    return html

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', type=Path, default=ROOT/'tests/artifacts/e13/progressive-disclosure-browser-audit.json')
    ap.add_argument('--screenshots', action='store_true')
    args = ap.parse_args(); args.output.parent.mkdir(parents=True, exist_ok=True)
    shots = args.output.parent/'screenshots'; shots.mkdir(parents=True, exist_ok=True)
    results=[]; failures=[]
    with sync_playwright() as p:
      browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
      for width,height,label in [(320,740,'320x740-mobile'),(390,844,'390x844-mobile'),(768,1024,'768x1024-tablet'),(1366,768,'1366x768-desktop')]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<900)
        page=context.new_page(); page.set_content(make_html(),wait_until='domcontentloaded')
        page.evaluate('''() => {
          window.__e13PrimaryClicks = 0;
          document.getElementById('app').classList.remove('hidden');
          document.getElementById('addMealBtn').addEventListener('click', () => window.__e13PrimaryClicks++);
          document.getElementById('nutritionPanel').classList.add('v32-section-active','open');
          document.getElementById('nutritionDays').innerHTML='<button class="workout-day-btn active">Lunes</button><button class="workout-day-btn">Martes</button>';
          document.getElementById('mealTabs').innerHTML='<button class="meal-tab active">Desayuno</button><button class="meal-tab">Almuerzo</button><button class="meal-tab">Cena</button>';
          document.getElementById('mealList').innerHTML='<div class="meal-empty">No hay ninguna comida cargada para este día.</div>';
          ['nutritionWeeklyPlannerBtn','nutritionPantryBtn','nutritionQualityReportBtn'].forEach((id,i)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=['Ver semana','Despensa','Informes'][i];b.addEventListener('click',()=>b.dataset.clicked='1');document.querySelector('#nutritionPanel .nutrition-actions').appendChild(b)});
          document.body.classList.add('light');
        }''')
        page.add_script_tag(content="let nutritionMeals = []; let nutritionLoadingDay = null; window.__e13CachedMeals=[]; function cacheRead(name){return name==='nutritionMealsAll'?window.__e13CachedMeals:null;}")
        page.add_script_tag(path=str(ROOT/'js/68-nutrition-guided-layout-e13.js'))
        page.wait_for_timeout(80)
        mobile=width<=700
        states=page.evaluate('''(mobile) => {
          const ids=['nutritionDetailsDisclosure','nutritionGoalsDisclosure','nutritionMoreTools'];
          const details=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.open]));
          const actions=document.querySelector('#nutritionPanel .nutrition-actions');
          const guide=document.getElementById('e13FirstUse');
          const empty=document.querySelector('#mealList .meal-empty');
          const emptyDisplay=empty ? getComputedStyle(empty).display : 'missing';
          const tabs=[...document.querySelectorAll('#mealTabs .meal-tab')].map(x=>({text:x.textContent,pressed:x.getAttribute('aria-pressed')}));
          const days=[...document.querySelectorAll('#nutritionDays .workout-day-btn')].map(x=>x.getAttribute('aria-pressed'));
          return {details,guideVisible:!guide.hidden,emptyHidden:!!empty?.hidden,emptyDisplay,actionsChildren:[...actions.children].map(x=>x.id||x.className),buttonsInTools:[...document.querySelectorAll('#nutritionMoreTools .e13-tools-content > button')].map(x=>x.id),toolCount:document.querySelector('#nutritionMoreTools .e13-tools-count')?.textContent||'',tabs,days,docOverflow:document.documentElement.scrollWidth>innerWidth,addHeight:Math.round(document.getElementById('addMealBtn').getBoundingClientRect().height),toolSummaryHeight:Math.round(document.querySelector('#nutritionMoreTools > summary').getBoundingClientRect().height),desktopSummaryHidden:getComputedStyle(document.querySelector('#nutritionDetailsDisclosure > summary')).display==='none'};
        }''',mobile)
        if mobile:
          if states['details']['nutritionDetailsDisclosure'] or states['details']['nutritionGoalsDisclosure'] or states['details']['nutritionMoreTools']: failures.append(f'{label}: details should start collapsed on phone')
          if not states['guideVisible'] or not states['emptyHidden'] or states['emptyDisplay'] != 'none': failures.append(f'{label}: first-use guide should replace duplicate empty message (display={states["emptyDisplay"]})')
          if states['actionsChildren']!=['addMealBtn','nutritionMoreTools']: failures.append(f'{label}: only primary CTA and tools disclosure should be direct action children: {states["actionsChildren"]}')
          if states['addHeight']<44 or states['toolSummaryHeight']<44: failures.append(f'{label}: touch target below 44px')
          if states['docOverflow']: failures.append(f'{label}: horizontal document overflow')
        else:
          if not all(states['details'][k] for k in ['nutritionDetailsDisclosure','nutritionGoalsDisclosure','nutritionMoreTools']): failures.append(f'{label}: desktop should preserve expanded detail')
          if not states['desktopSummaryHidden']: failures.append(f'{label}: desktop summary toggle should not alter full layout')
        if states['toolCount']!='5': failures.append(f'{label}: dynamic tool count incorrect ({states["toolCount"]})')
        if states['buttonsInTools']!=['nutritionGoalBtn','nutritionHistoryBtn','nutritionWeeklyPlannerBtn','nutritionPantryBtn','nutritionQualityReportBtn']: failures.append(f'{label}: actions not grouped in stable order')
        if [x['pressed'] for x in states['tabs']]!=['true','false','false']: failures.append(f'{label}: meal tab ARIA pressed states')
        if states['days']!=['true','false']: failures.append(f'{label}: day button ARIA pressed states')
        if args.screenshots: page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-nutrition-panel.png'))
        # Mobile-only behavior: reveal tools; clear guide through simulated meal card insertion.
        if mobile:
          page.locator('#nutritionMoreTools > summary').click()
          if not page.locator('#nutritionMoreTools').evaluate('(el)=>el.open'): failures.append(f'{label}: tools disclosure does not open')
          page.locator('#e13StartFirstMeal').click()
          if page.evaluate('window.__e13PrimaryClicks')!=1: failures.append(f'{label}: first-use CTA did not launch real Add Meal action')
          page.evaluate("window.__e13CachedMeals=[{id:'previous-meal',day:3,title:'Comida previa'}]; document.querySelector('#mealList .meal-empty').textContent='No hay ninguna comida cargada para este día.';")
          page.wait_for_timeout(40)
          if page.locator('#e13FirstUse').is_visible() or not page.locator('#mealList .meal-empty').is_visible(): failures.append(f'{label}: existing user should see the normal empty state, not the first-use guide')
          page.locator('#mealList').evaluate("el=>{el.innerHTML='<article class=\\\"meal-card\\\">Comida de prueba</article>';}")
          page.wait_for_timeout(40)
          if page.locator('#e13FirstUse').is_visible(): failures.append(f'{label}: first-use guide stayed visible after meal appeared')
        results.append({'viewport':label,'mobile':mobile,**states})
        page.close();context.close()
      browser.close()
    output={'audit':'E13 progressive disclosure / beginner layout','mode':'mocked meal list and tool buttons; no Supabase requests','viewports':results,'coverage':['responsive disclosure defaults','dynamic secondary action grouping','stable order and button count','ARIA pressed state for day and meal selectors','new-user guide and normal empty state','first-use button opens existing add-meal action','no horizontal document overflow'],'failures':failures}
    args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(output,ensure_ascii=False,indent=2))
    if failures: raise SystemExit(1)
if __name__=='__main__': main()
