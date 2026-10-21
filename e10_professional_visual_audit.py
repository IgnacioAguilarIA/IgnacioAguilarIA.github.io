#!/usr/bin/env python3
"""Auditoría visual E10 del panel Alimentación en temas oscuro/claro.

Usa el fixture estático E6 y Chromium; no ejecuta las conexiones ni la autenticación
reales de la aplicación. Requiere Playwright para Python y Chromium.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from e6_mobile_viewport_audit import build_fixture

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / 'tests' / 'artifacts' / 'e10' / 'professional-visual-audit.json'
VIEWPORTS = [
    (320, 740, '320x740'),
    (360, 800, '360x800'),
    (390, 844, '390x844'),
    (430, 932, '430x932'),
    (768, 1024, '768x1024-tablet'),
    (844, 390, '844x390-landscape'),
    (1366, 768, '1366x768-desktop'),
]

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--screenshots', action='store_true')
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    screenshot_dir = args.output.parent / 'screenshots'
    if args.screenshots:
        screenshot_dir.mkdir(parents=True, exist_ok=True)
    fixture = build_fixture()
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').is_file() else None)
        for theme in ('dark', 'light'):
            for width, height, label in VIEWPORTS:
                context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                              is_mobile=width < 500, has_touch=width < 900)
                page = context.new_page()
                page.set_content(fixture, wait_until='domcontentloaded')
                page.evaluate("""({theme}) => {
                  document.querySelector('#nutritionPanel')?.classList.add('v32-section-active');
                  document.querySelectorAll('[data-v32-section]').forEach(b => b.classList.toggle('active', b.dataset.v32Section === 'nutrition'));
                  document.querySelector('#mobileNavFood')?.classList.add('active');
                  document.body.classList.toggle('light', theme === 'light');
                  const s = document.querySelector('#nutritionSyncStatusText');
                  if (s) s.textContent = 'Vista previa estática: no se ejecutó la sincronización';
                }""", {'theme': theme})
                # E10 tiene transiciones discretas de color; esperar evita medir el estado intermedio de la animación.
                page.wait_for_timeout(500)
                record = page.evaluate("""({theme, label}) => {
                  const panel = document.querySelector('#nutritionPanel');
                  const rect = el => { const r = el.getBoundingClientRect(); return {left:+r.left.toFixed(1),right:+r.right.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1)}; };
                  const planned = document.querySelector('.nutrition-summary-planned .nutrition-summary-metric');
                  const consumed = document.querySelector('.nutrition-summary-consumed .nutrition-summary-metric');
                  const sync = document.querySelector('#nutritionSyncStatus');
                  const labels = [...panel.querySelectorAll('.nutrition-summary-metric > span')];
                  return {
                    theme, viewport:label, width:innerWidth, documentWidth:document.documentElement.scrollWidth,
                    horizontalOverflow:document.documentElement.scrollWidth > innerWidth || panel.scrollWidth > panel.clientWidth,
                    panel:rect(panel), outsidePanel:[...panel.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&(r.left < -1 || r.right > innerWidth+1)}).slice(0,8).map(el=>({tag:el.tagName,id:el.id,className:String(el.className).slice(0,50),rect:rect(el)})),
                    overflowingLabels:labels.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent.trim()),
                    syncBackground:getComputedStyle(sync).backgroundColor, syncColor:getComputedStyle(sync).color,
                    plannedBackground:getComputedStyle(planned).backgroundColor, consumedBackground:getComputedStyle(consumed).backgroundColor,
                    touchTargetsBelow44:[...panel.querySelectorAll('button,input,select,textarea')].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&el.getBoundingClientRect().height<43.5}).map(el=>({id:el.id,text:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,32),height:+el.getBoundingClientRect().height.toFixed(1)}))
                  };
                }""", {'theme':theme, 'label':label})
                errors = []
                if record['horizontalOverflow']: errors.append('horizontal overflow')
                if record['overflowingLabels']: errors.append('summary text overflow')
                if theme == 'light':
                    if record['plannedBackground'] != 'rgb(248, 250, 252)': errors.append('planned metrics not light-themed')
                    if record['consumedBackground'] != 'rgb(240, 253, 244)': errors.append('consumed metrics not light-themed')
                if width < 900 and record['touchTargetsBelow44']: errors.append('small touch targets')
                record['errors'] = errors
                results.append(record)
                if args.screenshots and label in ('390x844','1366x768-desktop'):
                    page.screenshot(path=str(screenshot_dir / f'e10-{theme}-{label}.png'))
                page.close(); context.close()
        browser.close()
    audit = {'stage':'E10','mode':'static Chromium fixture','views':len(results),'passed':sum(not r['errors'] for r in results),'failed':sum(bool(r['errors']) for r in results),'results':results,
             'limitations':'No auth, real Supabase session, or physical iOS/Android device is used in this visual fixture.'}
    args.output.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"E10 visual audit: {audit['passed']}/{audit['views']} theme/view combinations passed")
    if audit['failed']:
        for r in results:
            if r['errors']: print(r['theme'],r['viewport'],r['errors'])
    print(f'Report: {args.output}')
    return 0 if audit['failed'] == 0 else 1

if __name__ == '__main__':
    raise SystemExit(main())
