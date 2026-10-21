#!/usr/bin/env python3
"""Auditoría visual CSS de Alimentación E6 con un fixture estático.

Requiere: pip install playwright && playwright install chromium
No ejecuta la app, no inicia sesión ni llama a Supabase: quita los scripts para que
la medición de responsive/accessibilidad visual sea determinista.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / 'tests' / 'artifacts' / 'e6' / 'viewport-audit.json'
PREVIEW_CSS = r'''
#authScreen { display:none!important }
#app { display:block!important }
[data-v33-pane]:not([data-v33-pane="nutrition"]) { display:none!important }
.v32-home-pane,.v32-agenda-pane,.v32-calendar-pane,.v32-workout-pane,
.v33-home-pane,.v33-agenda-pane,.v33-calendar-pane,.v33-workout-pane { display:none!important }
#nutritionPanel,.v32-nutrition-pane,.v33-nutrition-pane { display:block!important }
.v32-section-nav,.section-switcher { display:none!important }
#v25Goals,#refreshStatus { display:none!important }
#nutritionPanel [hidden] { display:none!important }
'''
VIEWPORTS = [
    (320, 740, '320x740', True),
    (360, 800, '360x800', True),
    (390, 844, '390x844', True),
    (430, 932, '430x932', True),
    (768, 1024, '768x1024-tablet-touch', True),
    (844, 390, '844x390-landscape-touch', True),
    (1366, 768, '1366x768-desktop', False),
]

def build_fixture() -> str:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    def inline_styles(match: re.Match[str]) -> str:
        href = match.group(1)
        if href.startswith('./css/'):
            css_path = ROOT / href[2:]
            if css_path.is_file():
                return f'<style data-source="{css_path.name}">\n{css_path.read_text(encoding="utf-8")}\n</style>'
        return ''
    html = re.sub(r'<link\b[^>]*href="([^\"]+)"[^>]*>', inline_styles, html, flags=re.I)
    html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I | re.S)
    html = html.replace('</head>', f'<style id="e6-preview-only">{PREVIEW_CSS}</style></head>')
    return html

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', type=Path, default=DEFAULT_OUT, help='Ruta de salida del JSON')
    ap.add_argument('--screenshots', action='store_true', help='Guardar capturas de muestra junto al JSON')
    args = ap.parse_args()
    html = build_fixture()
    records = []
    screenshot_dir = args.output.parent / 'screenshots'
    if args.screenshots:
        screenshot_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        chromium = Path('/usr/bin/chromium')
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path=str(chromium) if chromium.is_file() else None)
        for width, height, name, touch in VIEWPORTS:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                          is_mobile=touch, has_touch=touch)
            page = context.new_page()
            page.set_content(html, wait_until='domcontentloaded')
            page.evaluate("document.querySelector('#nutritionPanel')?.classList.add('v32-section-active'); document.querySelectorAll('[data-v32-section]').forEach(b => {const active=b.dataset.v32Section==='nutrition'; b.classList.toggle('active', active); if(active)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current')}); const st=document.querySelector('#nutritionSyncStatusText'); if(st)st.textContent='Vista previa estática: no se ejecutó la sincronización';")
            base = page.evaluate('''() => {
              const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:+r.left.toFixed(1),right:+r.right.toFixed(1),top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1)}};
              const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
              const panel=document.querySelector('#nutritionPanel');
              const labels=[...document.querySelectorAll('#nutritionPanel .nutrition-summary-metric > span')];
              const controls=[...panel.querySelectorAll('button,input,select,textarea')].filter(visible).map(e=>({id:e.id,cls:String(e.className).slice(0,60),height:+e.getBoundingClientRect().height.toFixed(1),text:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,40)}));
              const outside=[...panel.querySelectorAll('*')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:String(e.className).slice(0,60),rect:rect(e)}));
              const nav=document.querySelector('#mobileNav'),navRect=rect(nav);return {viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},panel:rect(panel),panelOverflow:panel.scrollWidth>panel.clientWidth,labelOverflow:labels.filter(e=>e.scrollWidth>e.clientWidth).map(e=>e.textContent.trim()),outside,dayGrid:getComputedStyle(document.querySelector('#nutritionDays')).gridTemplateColumns,tabsGrid:getComputedStyle(document.querySelector('#mealTabs')).gridTemplateColumns,summaryHidden:getComputedStyle(document.querySelector('#v25Goals')).display==='none',mobileNav:{rect:navRect,display:getComputedStyle(nav).display,activeNutrition:!!document.querySelector('#mobileNavFood.active')},quickAddFabDisplay:getComputedStyle(document.querySelector('#quickAddFab')).display,smallTargets:controls.filter(c=>c.height<43.5),visibleTargets:controls.length};
            }''')
            if args.screenshots:
                page.screenshot(path=str(screenshot_dir / f'app-{name}.png'), full_page=False)
            page.evaluate('''() => { const ov=document.querySelector('#nutritionOverlay'); ov.style.display='flex'; ov.style.position='fixed'; ov.style.inset='0'; ov.style.zIndex='99999'; }''')
            modal = page.evaluate('''() => {
              const m=document.querySelector('#nutritionOverlay .modal'), b=m.querySelector('#saveMealBtn');
              const r=m.getBoundingClientRect(), s=b.getBoundingClientRect();
              return {modal:{left:+r.left.toFixed(1),right:+r.right.toFixed(1),top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1),maxHeight:getComputedStyle(m).maxHeight,overflowY:getComputedStyle(m).overflowY,scrollHeight:m.scrollHeight,clientHeight:m.clientHeight},save:{left:+s.left.toFixed(1),right:+s.right.toFixed(1),top:+s.top.toFixed(1),bottom:+s.bottom.toFixed(1),height:+s.height.toFixed(1)},dialogRole:m.getAttribute('role'),ariaModal:m.getAttribute('aria-modal'),labelledby:m.getAttribute('aria-labelledby'),labelExists:!!document.getElementById(m.getAttribute('aria-labelledby'))};
            }''')
            if args.screenshots:
                page.screenshot(path=str(screenshot_dir / f'modal-{name}.png'), full_page=False)
            page.evaluate("document.querySelector('#nutritionOverlay').style.display='none'; const g=document.querySelector('#goalOverlay'); g.style.display='flex'; g.style.position='fixed'; g.style.inset='0'; g.style.zIndex='100000';")
            goal_modal = page.evaluate('''() => {const m=document.querySelector('#goalOverlay .modal'),b=document.querySelector('#saveGoalsBtn'),r=m.getBoundingClientRect(),s=b.getBoundingClientRect();return {modal:{left:+r.left.toFixed(1),right:+r.right.toFixed(1),top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1),height:+r.height.toFixed(1),scrollHeight:m.scrollHeight,clientHeight:m.clientHeight,overflowY:getComputedStyle(m).overflowY},save:{top:+s.top.toFixed(1),bottom:+s.bottom.toFixed(1),height:+s.height.toFixed(1),visible:s.bottom>0&&s.top<innerHeight},dialogRole:m.getAttribute('role'),ariaModal:m.getAttribute('aria-modal'),labelExists:!!document.getElementById(m.getAttribute('aria-labelledby'))}}''')
            if args.screenshots and name == '320x740':
                page.screenshot(path=str(screenshot_dir / 'modal-goals-320x740.png'), full_page=False)
            base['modal'] = modal
            base['goalModal'] = goal_modal
            base['size'] = name
            records.append(base)
            page.close(); context.close()
        # Approximate the reduced visual viewport while a mobile keyboard is present.
        context = browser.new_context(viewport={'width':320,'height':400},device_scale_factor=1,is_mobile=True,has_touch=True)
        page=context.new_page(); page.set_content(html,wait_until='domcontentloaded')
        page.evaluate("document.querySelector('#nutritionPanel')?.classList.add('v32-section-active'); document.querySelectorAll('[data-v32-section]').forEach(b => {const active=b.dataset.v32Section==='nutrition'; b.classList.toggle('active', active); if(active)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current')}); const st=document.querySelector('#nutritionSyncStatusText'); if(st)st.textContent='Vista previa estática: no se ejecutó la sincronización';")
        page.evaluate('''() => { const ov=document.querySelector('#nutritionOverlay'); ov.style.display='flex'; ov.style.position='fixed'; ov.style.inset='0'; ov.style.zIndex='99999'; }''')
        reduced=page.evaluate('''() => {const m=document.querySelector('#nutritionOverlay .modal'),b=m.querySelector('#saveMealBtn'),r=m.getBoundingClientRect(),s=b.getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},modal:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,maxHeight:getComputedStyle(m).maxHeight,scrollHeight:m.scrollHeight,clientHeight:m.clientHeight,overflowY:getComputedStyle(m).overflowY},save:{top:s.top,bottom:s.bottom,height:s.height,visible:s.bottom>0&&s.top<innerHeight}}}''')
        if args.screenshots:
            page.screenshot(path=str(screenshot_dir / 'modal-320x400-reduced-viewport.png'),full_page=False)
        page.evaluate("document.querySelector('#nutritionOverlay').style.display='none'; const g=document.querySelector('#goalOverlay'); g.style.display='flex'; g.style.position='fixed'; g.style.inset='0'; g.style.zIndex='100000';")
        reduced_goal=page.evaluate('''() => {const m=document.querySelector('#goalOverlay .modal'),b=document.querySelector('#saveGoalsBtn'),r=m.getBoundingClientRect(),s=b.getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},modal:{top:r.top,bottom:r.bottom,height:r.height,scrollHeight:m.scrollHeight,clientHeight:m.clientHeight,overflowY:getComputedStyle(m).overflowY},save:{top:s.top,bottom:s.bottom,height:s.height,visible:s.bottom>0&&s.top<innerHeight}}}''')
        if args.screenshots:
            page.screenshot(path=str(screenshot_dir / 'modal-goals-320x400-reduced-viewport.png'),full_page=False)
        context.close(); browser.close()
    report={'scope':'CSS/markup visual fixture only; scripts are stripped and Supabase is not contacted.','viewports':records,'reducedViewport320x400':reduced,'reducedViewportGoals320x400':reduced_goal}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    failures=[]
    for r in records:
        if r['document']['width'] != r['viewport']['width']: failures.append(f"{r['size']}: horizontal document overflow")
        if r['panelOverflow'] or r['labelOverflow'] or r['outside']: failures.append(f"{r['size']}: panel/text element overflow")
        if r['size'] != '1366x768-desktop' and r['smallTargets']: failures.append(f"{r['size']}: undersized touch targets")
        if r['size'] != '1366x768-desktop' and not r['mobileNav']['activeNutrition']: failures.append(f"{r['size']}: nutrition navigation is not selected in the static fixture")
        if r['size'] in ('320x740','360x800','390x844','430x932') and r['quickAddFabDisplay'] != 'none': failures.append(f"{r['size']}: global quick-add FAB could cover the nutrition panel")
        m=r['modal']['modal']; s=r['modal']['save']; v=r['viewport']
        if m['left'] < -1 or m['right'] > v['width']+1: failures.append(f"{r['size']}: dialog exceeds horizontal viewport")
        if r['size'] != '1366x768-desktop' and not (s['bottom'] > 0 and s['top'] < v['height']): failures.append(f"{r['size']}: save action not visible on touch viewport")
        if r['modal']['ariaModal'] != 'true' or not r['modal']['labelExists']: failures.append(f"{r['size']}: dialog missing accessible name/modal semantics")
        if r['size'] != '1366x768-desktop' and not r['goalModal']['save']['visible']: failures.append(f"{r['size']}: save-goals action not visible on touch viewport")
    if not reduced['save']['visible'] or reduced['modal']['overflowY'] != 'auto': failures.append('320x400 reduced viewport: meal modal/save action not accessible')
    if not reduced_goal['save']['visible'] or reduced_goal['modal']['overflowY'] != 'auto': failures.append('320x400 reduced viewport: goals modal/save action not accessible')
    print(f"E6 viewport audit: {len(records)} viewports + meal/goals dialogs at 320x400 reduced-height")
    print('Horizontal overflow, nutrition labels, bounds, touch controls and dialog visibility:', 'PASS' if not failures else 'FAIL')
    if failures:
        print('\n'.join(failures)); return 1
    print(f'Report: {args.output}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
