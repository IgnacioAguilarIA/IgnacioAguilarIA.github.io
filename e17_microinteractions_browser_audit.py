#!/usr/bin/env python3
"""E17 Chromium audit for microinteraction feedback, focus restoration and responsive safety."""
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
            if p.exists(): return f'<style data-e17-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html = re.sub(r'<link\b[^>]*href="([^"]+)"[^>]*>', inline, html, flags=re.I)
    html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I|re.S)
    return html

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--viewport', choices=['all','320','390','768','1366'], default='all')
    parser.add_argument('--theme', choices=['all','light','dark'], default='all')
    args=parser.parse_args()
    out=ROOT/'tests/artifacts/e17/microinteractions-browser-audit.json' if args.viewport=='all' and args.theme=='all' else ROOT/f'tests/artifacts/e17/microinteractions-browser-audit-{args.viewport}-{args.theme}.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    shots=out.parent/'screenshots';shots.mkdir(parents=True,exist_ok=True)
    sizes=[(320,740,'320x740-mobile'),(390,844,'390x844-mobile'),(768,1024,'768x1024-tablet'),(1366,768,'1366x768-desktop')]
    if args.viewport!='all': sizes=[v for v in sizes if str(v[0])==args.viewport]
    themes=['light','dark'] if args.theme=='all' else [args.theme]
    results=[]; failures=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        for width,height,label in sizes:
          for theme in themes:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<900,reduced_motion='reduce' if False else 'no-preference')
            page=context.new_page();page.set_content(make_html(),wait_until='domcontentloaded')
            page.evaluate('''(theme) => {
              document.getElementById('app')?.classList.remove('hidden');
              const panel=document.getElementById('nutritionPanel');panel.classList.add('open','v32-section-active');
              document.body.classList.toggle('light', theme==='light');
              window.__editClicks=0; window.__deleteClicks=0;
              let list=document.getElementById('mealList');list.innerHTML='';
              const card=document.createElement('article');card.className='meal-card';card.dataset.mealId='e17-meal-1';
              const head=document.createElement('div');head.className='meal-card-head';const left=document.createElement('div');
              const name=document.createElement('div');name.className='meal-name';name.textContent='Avena con yogur';left.append(name);
              const foods=document.createElement('div');foods.className='meal-foods';foods.textContent='Avena 50 g, yogur 150 g';left.append(foods);
              const desc=document.createElement('div');desc.className='meal-description';desc.textContent='Preparación anticipada';left.append(desc);
              const meta=document.createElement('div');meta.className='meal-meta';['Cal: 350','Prot: 19 g','Hora: 08:00'].forEach(t=>{const c=document.createElement('span');c.className='meal-chip';c.textContent=t;meta.append(c)});left.append(meta);
              const actions=document.createElement('div');actions.className='meal-actions';
              const edit=document.createElement('button');edit.className='meal-action';edit.title='Editar';edit.textContent='✎';edit.addEventListener('click',()=>window.__editClicks++);
              const del=document.createElement('button');del.className='meal-action delete';del.title='Eliminar';del.textContent='×';del.addEventListener('click',()=>window.__deleteClicks++);
              actions.append(edit,del);head.append(left,actions);card.append(head);list.append(card);
              document.getElementById('nutritionGoalBtn')?.setAttribute('type','button');
            }''', theme)
            page.add_script_tag(content="let currentUser={id:'e17-user'}; let nutritionMeals=[]; let nutritionLoadingDay=null; function cacheRead(name){return name==='nutritionMealsAll'?[]:null;}")
            page.add_script_tag(path=str(ROOT/'js/68-nutrition-guided-layout-e13.js'))
            page.add_script_tag(path=str(ROOT/'js/70-nutrition-task-hub-e15.js'))
            page.add_script_tag(path=str(ROOT/'js/71-nutrition-meal-cards-e16.js'))
            page.add_script_tag(path=str(ROOT/'js/72-nutrition-microinteractions-e17.js'))
            page.wait_for_timeout(50)
            state=page.evaluate('''() => {
              const card=document.querySelector('#mealList .meal-card');
              const details=card?.querySelector('.e15-meal-details');
              return {cardExists:!!card, directHeader:!!card?.querySelector(':scope > .meal-card-head'),
                overflow:document.documentElement.scrollWidth>innerWidth,
                actions:[...card.querySelectorAll('.meal-action')].map(x=>({name:x.title,height:Math.round(x.getBoundingClientRect().height)})),
                hasFoodInput:!!document.getElementById('mealFoods'), detailsInitiallyOpen:!!details?.open};
            }''')
            if not state['cardExists'] or not state['directHeader']: failures.append(f'{label}/{theme}: E15/E16 card structure changed')
            if state['overflow']: failures.append(f'{label}/{theme}: horizontal overflow')
            if width<900 and any(a['height']<42 for a in state['actions']): failures.append(f'{label}/{theme}: touch target too small')
            # Opening meal details should trigger a brief reveal class, never a data mutation.
            details_locator = page.locator('#mealList .e15-meal-details')
            detail_reveal_ok = False
            if details_locator.count():
              details_locator.evaluate('(el)=>el.open=false'); page.wait_for_timeout(12)
              details_locator.evaluate('(el)=>el.open=true'); page.wait_for_timeout(25)
              reveal_class = page.locator('#mealList .e15-meal-details-body').get_attribute('class') or ''
              detail_reveal_ok = 'e17-detail-entered' in reveal_class
              if not detail_reveal_ok: failures.append(f'{label}/{theme}: detail reveal feedback missing')
            # A mismatched account's save event must not light up the meal card.
            page.evaluate("document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-saved',{detail:{mealId:'e17-meal-1',userId:'other-user'}}))")
            mismatch=page.locator('#mealList .meal-card').get_attribute('class')
            if 'e17-saved-feedback' in (mismatch or ''): failures.append(f'{label}/{theme}: wrong-account event animated a meal')
            page.evaluate("document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-saved',{detail:{mealId:'e17-meal-1',userId:'e17-user'}}))")
            saved_class=page.locator('#mealList .meal-card').get_attribute('class')
            if 'e17-saved-feedback' not in (saved_class or ''): failures.append(f'{label}/{theme}: confirmed save feedback missing')
            # Food-add field and sync status receive subtle visual feedback, without writing data.
            page.evaluate("document.dispatchEvent(new CustomEvent('agenda:nutrition-food-added',{detail:{food:{name:'Avena'}}}))")
            field_class=page.locator('#mealFoods').get_attribute('class')
            if 'e17-field-updated' not in (field_class or ''): failures.append(f'{label}/{theme}: added-food field feedback missing')
            page.evaluate("document.dispatchEvent(new CustomEvent('agenda:nutrition-sync-status',{detail:{state:'saved',message:'Guardado',userId:'e17-user'}}))")
            sync_class=page.locator('#nutritionSyncStatus').get_attribute('class')
            if 'e17-sync-confirmed' not in (sync_class or ''): failures.append(f'{label}/{theme}: sync confirmation feedback missing')
            # Existing handlers remain intact.
            page.locator('#mealList .meal-action[title="Editar"]').click()
            page.locator('#mealList .meal-action[title="Eliminar"]').click()
            handlers=page.evaluate('() => [window.__editClicks,window.__deleteClicks]')
            if handlers != [1,1]: failures.append(f'{label}/{theme}: action handlers changed: {handlers}')
            if width in (390,1366):
              page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-{theme}-microinteractions.png'))
            # Keyboard deletion should restore focus to the main action when the deleted
            # control disappears, while ordinary pointer clicks keep their current focus.
            awaitless = page.evaluate("""() => {
              const card=document.querySelector('#mealList .meal-card');
              const del=card?.querySelector('.meal-action.delete');
              if (!card || !del) return false;
              del.focus();
              del.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));
              card.remove();
              document.dispatchEvent(new CustomEvent('agenda:nutrition-meal-deleted',{detail:{mealId:'e17-meal-1',userId:'e17-user'}}));
              return true;
            }""")
            page.wait_for_timeout(35)
            focus_after_delete=page.evaluate('document.activeElement?.id || document.activeElement?.getAttribute("title") || ""')
            if awaitless and focus_after_delete!='addMealBtn': failures.append(f'{label}/{theme}: keyboard focus was not restored after deleting the focused meal')
            results.append({'viewport':label,'theme':theme,**state,'handlers':handlers,'savePulse': 'e17-saved-feedback' in (saved_class or ''),'foodFieldPulse':'e17-field-updated' in (field_class or ''),'syncPulse':'e17-sync-confirmed' in (sync_class or ''),'focusAfterKeyboardDelete':focus_after_delete,'detailReveal':detail_reveal_ok})
            context.close()
        browser.close()
    out.write_text(json.dumps({'passed':not failures,'checks':len(results),'failures':failures,'results':results},indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'passed':not failures,'checks':len(results),'failures':failures,'report':str(out)},ensure_ascii=False))
    if failures: raise SystemExit(1)
if __name__=='__main__': main()
