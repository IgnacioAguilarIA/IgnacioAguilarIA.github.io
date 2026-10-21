#!/usr/bin/env python3
"""E18 Chromium audit: per-account view preferences, detail modes, tool shortcut and responsive modal."""
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
            if p.exists(): return f'<style data-e18-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html = re.sub(r'<link\b[^>]*href="([^"]+)"[^>]*>', inline, html, flags=re.I)
    html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I|re.S)
    return html


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--viewport', choices=['all','320','390','768','1366'], default='all')
    parser.add_argument('--theme', choices=['all','light','dark'], default='all')
    args=parser.parse_args()
    out=ROOT/'tests/artifacts/e18/view-preferences-browser-audit.json' if args.viewport=='all' and args.theme=='all' else ROOT/f'tests/artifacts/e18/view-preferences-browser-audit-{args.viewport}-{args.theme}.json'
    out.parent.mkdir(parents=True, exist_ok=True); shots=out.parent/'screenshots'; shots.mkdir(parents=True, exist_ok=True)
    sizes=[(320,740,'320x740-mobile'),(390,844,'390x844-mobile'),(768,1024,'768x1024-tablet'),(1366,768,'1366x768-desktop')]
    if args.viewport!='all': sizes=[item for item in sizes if str(item[0])==args.viewport]
    themes=['light','dark'] if args.theme=='all' else [args.theme]
    results=[]; failures=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        for width,height,label in sizes:
          for theme in themes:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<900,color_scheme='light' if theme=='light' else 'dark')
            page=context.new_page(); page.set_default_timeout(3500)
            # page.set_content uses an opaque origin in some Chromium builds; provide a simple per-page storage shim.
            page.set_content(make_html(),wait_until='domcontentloaded')
            page.evaluate("""() => { const bucket = {}; Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: k => Object.prototype.hasOwnProperty.call(bucket,k) ? bucket[k] : null, setItem: (k,v) => { bucket[k] = String(v); }, removeItem: k => { delete bucket[k]; }, clear: () => { Object.keys(bucket).forEach(k => delete bucket[k]); } } }); }""")
            page.evaluate('''(theme) => {
              document.getElementById('app')?.classList.remove('hidden');
              document.body.classList.toggle('light',theme==='light');
              document.getElementById('nutritionPanel')?.classList.add('open','v32-section-active');
              window.sb={auth:{onAuthStateChange(cb){window.__e18AuthCallback=cb;}}};
              window.__toolInvoked=0;
              const history=document.getElementById('nutritionHistoryBtn'); history?.addEventListener('click',()=>window.__toolInvoked++);
              const list=document.getElementById('mealList'); list.innerHTML='';
              const card=document.createElement('article');card.className='meal-card';card.dataset.mealId='e18-meal-1';
              const head=document.createElement('div');head.className='meal-card-head';const left=document.createElement('div');
              const name=document.createElement('div');name.className='meal-name';name.textContent='Avena con yogur';left.append(name);
              const foods=document.createElement('div');foods.className='meal-foods';foods.textContent='Avena 50 g, yogur natural 150 g';left.append(foods);
              const desc=document.createElement('div');desc.className='meal-description';desc.textContent='Preparación anticipada';left.append(desc);
              const meta=document.createElement('div');meta.className='meal-meta';['Cal: 350','Prot: 19 g','Hora: 08:00'].forEach(t=>{const chip=document.createElement('span');chip.className='meal-chip';chip.textContent=t;meta.append(chip)});left.append(meta);
              const actions=document.createElement('div');actions.className='meal-actions';
              const edit=document.createElement('button');edit.className='meal-action';edit.title='Editar';edit.textContent='Editar';edit.addEventListener('click',()=>window.__editCount=(window.__editCount||0)+1);
              const del=document.createElement('button');del.className='meal-action delete';del.title='Eliminar';del.textContent='Eliminar';del.addEventListener('click',()=>window.__deleteCount=(window.__deleteCount||0)+1);
              actions.append(edit,del);head.append(left,actions);card.append(head);list.append(card);
              const prefsButton=document.getElementById('nutritionE18ViewPrefsBtn');
              document.getElementById('nutritionGoalBtn')?.setAttribute('type','button');
            }''', theme)
            page.add_script_tag(content="let currentUser={id:'e18-user-a'}; let nutritionMeals=[]; let nutritionLoadingDay=null; function cacheRead(name){return name==='nutritionMealsAll'?[]:null;}")
            for script in ['68-nutrition-guided-layout-e13.js','70-nutrition-task-hub-e15.js','71-nutrition-meal-cards-e16.js','72-nutrition-microinteractions-e17.js','73-nutrition-view-preferences-e18.js']:
              page.add_script_tag(path=str(ROOT/'js'/script))
            page.wait_for_timeout(120)
            # Initial automatic mode varies with viewport.
            details=page.locator('#mealList .e15-meal-details')
            expected_open=width>700
            state_auto=details.evaluate('(el)=>el.open')
            if state_auto != expected_open: failures.append(f'{label}/{theme}: auto details expected {expected_open}, got {state_auto}')
            # The settings entry exists and is grouped by E15.
            prefs_btn=page.locator('#nutritionE18ViewPrefsBtn')
            if prefs_btn.count()!=1: failures.append(f'{label}/{theme}: preferences shortcut missing')
            hub=page.locator('#nutritionMoreTools'); hub.evaluate('(el)=>el.open=true')
            prefs_btn.click(); page.wait_for_timeout(20)
            dialog=page.locator('.e18-view-preferences-dialog')
            if dialog.count()!=1: failures.append(f'{label}/{theme}: preferences dialog did not open')
            if width in (390,1366) and dialog.count(): dialog.screenshot(path=str(shots/f'{label}-{theme}-preferences-dialog.png'))
            close_height_initial=page.locator('.e18-view-close').evaluate('(el)=>Math.round(el.getBoundingClientRect().height)') if dialog.count() else 0
            # Make detail mode explicit and opt into remembered last tool.
            page.locator('input[name="e18DetailMode"][value="detailed"]').check()
            page.locator('input[name="e18RememberLastTool"]').check()
            page.locator('.e18-view-button.primary').click(); page.wait_for_timeout(40)
            detail_after_save=details.evaluate('(el)=>el.open')
            day_summary_open=page.locator('#nutritionDetailsDisclosure').evaluate('(el)=>el.open')
            if not detail_after_save or not day_summary_open: failures.append(f'{label}/{theme}: detailed mode did not open meal and day-summary details')
            # A manual card toggle should remain respected when another card is inserted.
            details.evaluate('(el)=>el.open=false')
            page.evaluate("""() => { const list=document.getElementById('mealList'); const card=document.createElement('article');card.className='meal-card';card.dataset.mealId='e18-meal-2'; const head=document.createElement('div');head.className='meal-card-head';const left=document.createElement('div');const name=document.createElement('div');name.className='meal-name';name.textContent='Ensalada de prueba';left.append(name);const foods=document.createElement('div');foods.className='meal-foods';foods.textContent='Tomate 100 g, lechuga 50 g';left.append(foods);const meta=document.createElement('div');meta.className='meal-meta';['Cal: 45','Prot: 2 g'].forEach(t=>{const x=document.createElement('span');x.className='meal-chip';x.textContent=t;meta.append(x)});left.append(meta);head.append(left);card.append(head);list.append(card); }""")
            page.wait_for_timeout(60)
            old_card_remained_closed=not page.locator('#mealList .e15-meal-details').first.evaluate('(el)=>el.open')
            new_card_open=page.locator('#mealList .meal-card').nth(1).locator('.e15-meal-details').evaluate('(el)=>el.open')
            if not old_card_remained_closed or not new_card_open: failures.append(f'{label}/{theme}: adding a card reset another card state or ignored the saved preference')
            key_value=page.evaluate("localStorage.getItem('agendaNutritionViewPrefsE18:e18-user-a')")
            try: saved=json.loads(key_value or '{}')
            except Exception: saved={}
            if saved.get('detailMode')!='detailed' or saved.get('rememberLastTool') is not True: failures.append(f'{label}/{theme}: preferences were not persisted per user: {saved}')
            # Click an existing tool and verify the shortcut to that same handler appears.
            hub.evaluate('(el)=>el.open=true')
            history=page.locator('#nutritionHistoryBtn')
            history.click(); page.wait_for_timeout(20)
            shortcut=page.locator('#nutritionE18LastToolShortcut')
            if shortcut.count()!=1 or shortcut.evaluate('(el)=>el.closest(".e18-last-tool-spotlight").hidden'): failures.append(f'{label}/{theme}: last-tool shortcut not shown after an opted-in tool click')
            if width in (390,1366): page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-{theme}-last-tool-shortcut.png'))
            shortcut.click(); page.wait_for_timeout(10)
            tools=page.evaluate('window.__toolInvoked')
            if tools<2: failures.append(f'{label}/{theme}: last-tool shortcut did not invoke original button handler ({tools})')
            # Account switch should load that account's defaults, not leak the previous account's options.
            page.evaluate("currentUser={id:'e18-user-b'}; window.__e18AuthCallback?.('SIGNED_IN',{user:{id:'e18-user-b'}})")
            page.wait_for_timeout(60)
            after_switch=page.locator('#mealList .e15-meal-details').first.evaluate('(el)=>el.open')
            shortcut_hidden=page.locator('.e18-last-tool-spotlight').evaluate('(el)=>el.hidden')
            if after_switch != expected_open: failures.append(f'{label}/{theme}: display preference leaked across account switch')
            if not shortcut_hidden: failures.append(f'{label}/{theme}: last-tool shortcut leaked across account switch')
            overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
            if overflow: failures.append(f'{label}/{theme}: horizontal overflow')
            if width<900:
              target=page.locator('#nutritionE18ViewPrefsBtn').evaluate('(el)=>Math.round(el.getBoundingClientRect().height)')
              if min(target,close_height_initial)<44: failures.append(f'{label}/{theme}: touch target below 44px ({target},{close_height_initial})')
            if width in (390,1366):
              page.locator('#nutritionPanel').screenshot(path=str(shots/f'{label}-{theme}-preferences.png'))
            results.append({'viewport':label,'theme':theme,'autoDetailsOpen':state_auto,'detailsAfterDetailedMode':detail_after_save,'daySummaryOpenAfterDetailedMode':day_summary_open,'newCardUsesPreference':new_card_open,'manualTogglePreserved':old_card_remained_closed,'prefsSavedForAccount':saved.get('detailMode')=='detailed','lastToolShortcutWorks':tools>=2,'accountIsolation':after_switch==expected_open and shortcut_hidden,'overflow':overflow})
            context.close()
        browser.close()
    out.write_text(json.dumps({'passed':not failures,'checks':len(results),'failures':failures,'results':results},indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'passed':not failures,'checks':len(results),'failures':failures,'report':str(out)},ensure_ascii=False))
    if failures: raise SystemExit(1)
if __name__=='__main__': main()
