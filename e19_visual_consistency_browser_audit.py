#!/usr/bin/env python3
"""E19 visual consistency browser audit; tests only nutrition-scoped controls and dialog surfaces."""
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
            if p.exists():
                return f'<style data-e19-source="{p.name}">\n{p.read_text(encoding="utf-8")}\n</style>'
        return ''
    html = re.sub(r'<link\b[^>]*href="([^"]+)"[^>]*>', inline, html, flags=re.I)
    html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I|re.S)
    return html


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--viewport', choices=['all', '320', '390', '768', '1366'], default='all')
    parser.add_argument('--theme', choices=['all', 'light', 'dark'], default='all')
    args = parser.parse_args()
    art = ROOT / 'tests/artifacts/e19'
    art.mkdir(parents=True, exist_ok=True)
    out = art / ('visual-consistency-browser-audit.json' if args.viewport == 'all' and args.theme == 'all' else f'visual-consistency-browser-audit-{args.viewport}-{args.theme}.json')
    screenshots = art / 'screenshots'; screenshots.mkdir(parents=True, exist_ok=True)
    sizes = [(320,740,'320x740-mobile'), (390,844,'390x844-mobile'), (768,1024,'768x1024-tablet'), (1366,768,'1366x768-desktop')]
    if args.viewport != 'all': sizes = [s for s in sizes if str(s[0]) == args.viewport]
    themes = ['light','dark'] if args.theme == 'all' else [args.theme]
    failures, results = [], []
    source_html = make_html()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        for width, height, label in sizes:
            for theme in themes:
                context = browser.new_context(viewport={'width':width,'height':height}, is_mobile=width < 500, has_touch=width < 900, color_scheme=theme)
                page = context.new_page(); page.set_default_timeout(2500)
                page.set_content(source_html, wait_until='domcontentloaded')
                page.evaluate('''(theme) => {
                  document.getElementById('app')?.classList.remove('hidden');
                  document.body.classList.toggle('light', theme === 'light');
                  const panel = document.getElementById('nutritionPanel');
                  panel?.classList.add('open','v32-section-active');
                  const list = document.getElementById('mealList');
                  if (list) {
                    list.innerHTML = '';
                    const card = document.createElement('article'); card.className = 'meal-card';
                    const head = document.createElement('div'); head.className = 'meal-card-head';
                    const main = document.createElement('div');
                    const title = document.createElement('div'); title.className='meal-name'; title.textContent='Almuerzo de ejemplo'; main.append(title);
                    const glance = document.createElement('div'); glance.className='e16-meal-glance';
                    for (const text of ['540 kcal','32 g proteína','13:30']) { const chip=document.createElement('span'); chip.className='e16-meal-protein'; chip.textContent=text; glance.append(chip); }
                    main.append(glance);
                    const details=document.createElement('details'); details.className='e15-meal-details';
                    const summary=document.createElement('summary'); summary.innerHTML='<span>Ver detalles</span>'; details.append(summary);
                    const body=document.createElement('div'); body.className='e15-meal-details-body';
                    const foods=document.createElement('p'); foods.className='meal-foods'; foods.textContent='Arroz 150 g · Pollo 120 g · Verduras 100 g'; body.append(foods);
                    const note=document.createElement('p'); note.className='meal-description'; note.textContent='Preparación casera'; body.append(note); details.append(body); main.append(details);
                    const actions=document.createElement('div'); actions.className='meal-actions';
                    for (const [title, cls] of [['✎','meal-action'],['🗑','meal-action delete']]) { const b=document.createElement('button'); b.type='button'; b.className=cls; b.title=title; b.setAttribute('aria-label', title+' comida'); b.textContent=title; actions.append(b); }
                    head.append(main,actions); card.append(head); list.append(card);
                  }
                  // Hidden specimens let the audit compare independent nutrition dialogs without invoking database logic.
                  const specimens = [
                    ['nutritionAdvancedModal','nutrition-advanced-overlay','nutrition-advanced-modal','nutrition-advanced-head'],
                    ['nutritionRoutineSpecimen','nutrition-routine-overlay','nutrition-routine-modal','nutrition-routine-head'],
                    ['nutritionWeekSpecimen','nutrition-week-modal-overlay','nutrition-week-modal','nutrition-week-modal-head'],
                    ['nutritionPlanSpecimen','nutrition-plan-editor-overlay','nutrition-plan-editor-dialog','nutrition-plan-editor-head'],
                    ['nutritionQualitySpecimen','nutrition-quality-overlay','nutrition-quality-dialog',''],
                    ['nutritionPantrySpecimen','nutrition-week-modal-overlay','nutrition-pantry-modal','nutrition-week-modal-head']
                  ];
                  for (const [id, overlayClass, dialogClass, headClass] of specimens) {
                    const overlay=document.createElement('div'); overlay.id=id; overlay.className=overlayClass; overlay.style.display='none';
                    const dialog=document.createElement('section'); dialog.className=dialogClass; dialog.setAttribute('role','dialog');
                    const head=document.createElement('header'); head.className=headClass; const h=document.createElement('h2'); h.textContent='Herramienta de ejemplo'; head.append(h);
                    const input=document.createElement('input'); input.placeholder='Buscar…'; input.setAttribute('aria-label','Buscar ejemplo');
                    const button=document.createElement('button'); button.type='button'; button.textContent='Guardar';
                    const tableWrap=document.createElement('div'); tableWrap.className='nutrition-quality-table-wrap'; const table=document.createElement('table'); table.innerHTML='<thead><tr><th>Fecha</th><th>Detalle</th></tr></thead><tbody><tr><td>Hoy</td><td>Ejemplo</td></tr></tbody>'; tableWrap.append(table);
                    dialog.append(head,input,button,tableWrap); overlay.append(dialog); document.body.append(overlay);
                  }
                  const preview=document.createElement('div'); preview.id='e19DialogPreview'; preview.className='nutrition-advanced-overlay'; preview.style.position='fixed'; preview.style.inset='0'; preview.style.zIndex='99999'; preview.style.display='none'; preview.style.alignItems='center'; preview.style.justifyContent='center'; preview.style.padding='12px';
                  const modal=document.createElement('section'); modal.className='nutrition-advanced-modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-label','Vista previa de consistencia');
                  const head=document.createElement('header'); head.className='nutrition-advanced-head'; const copy=document.createElement('div'); const h=document.createElement('h3'); h.textContent='Vista previa'; const p=document.createElement('p'); p.textContent='Controles, encabezados y superficies consistentes'; copy.append(h,p); head.append(copy);
                  const body=document.createElement('div'); body.className='nutrition-advanced-body'; const label=document.createElement('label'); label.textContent='Buscar alimento'; const input=document.createElement('input'); input.setAttribute('aria-label','Buscar alimento'); input.placeholder='Ej.: arroz, huevo…'; label.append(input); const button=document.createElement('button'); button.type='button'; button.className='nutrition-advanced-primary'; button.textContent='Guardar cambios'; const tableWrap=document.createElement('div'); tableWrap.className='nutrition-quality-table-wrap'; const table=document.createElement('table'); table.innerHTML='<thead><tr><th>Fecha</th><th>Alimento</th><th>Cantidad</th></tr></thead><tbody><tr><td>Hoy</td><td>Arroz</td><td>100 g</td></tr></tbody>'; tableWrap.append(table); body.append(label,button,tableWrap); modal.append(head,body); preview.append(modal); document.body.append(preview);
                }''', theme)
                # Re-evaluate stylesheet after fixture creation: all elements use the real CSS bundle.
                state = page.evaluate('''() => {
                  const get = sel => document.querySelector(sel);
                  const style = el => { const s=getComputedStyle(el); return {bg:s.backgroundColor,color:s.color,borderRadius:s.borderRadius,borderColor:s.borderColor,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,minHeight:s.minHeight}; };
                  const dialogs = [
                    '#nutritionOverlay .modal','#goalOverlay .modal','.nutrition-advanced-modal','.nutrition-routine-modal','.nutrition-week-modal','.nutrition-plan-editor-dialog','.nutrition-quality-dialog','.nutrition-pantry-modal','.e18-view-preferences-dialog'
                  ].map(sel => { const el=get(sel); return {selector:sel,exists:!!el,...(el?style(el):{})}; });
                  const input=get('#e19DialogPreview input'); const modal=get('#e19DialogPreview .nutrition-advanced-modal'); const th=get('#e19DialogPreview th'); const wrap=get('#e19DialogPreview .nutrition-quality-table-wrap');
                  return {viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth},dialogs, input:input?style(input):null, tableHeader:th?style(th):null, tableWrap:wrap?{overflowX:getComputedStyle(wrap).overflowX,borderRadius:getComputedStyle(wrap).borderRadius}:null, modal:modal?style(modal):null};
                }''')
                for d in state['dialogs']:
                    if d['exists'] and float(re.match(r'([0-9.]+)', d['borderRadius']).group(1)) < 18:
                        failures.append(f'{label}/{theme}: {d["selector"]} radius too small ({d["borderRadius"]})')
                if state['input'] and float(re.match(r'([0-9.]+)',state['input']['borderRadius']).group(1)) < 10:
                    failures.append(f'{label}/{theme}: shared input radius inconsistent ({state["input"]["borderRadius"]})')
                if state['tableWrap'] and state['tableWrap']['overflowX'] != 'auto':
                    failures.append(f'{label}/{theme}: nutrition table wrapper is not horizontally scrollable')
                if state['viewport']['scrollWidth'] > width:
                    failures.append(f'{label}/{theme}: document horizontal overflow ({state["viewport"]["scrollWidth"]}>{width})')
                if width in (390,1366):
                    page.locator('#nutritionPanel').screenshot(path=str(screenshots/f'{label}-{theme}-panel.png'))
                # Open preview dialog and confirm focus ring is visible on a focused input.
                page.locator('#e19DialogPreview').evaluate("el=>el.style.display='flex'")
                page.locator('#e19DialogPreview input').focus()
                focus = page.locator('#e19DialogPreview input').evaluate('(el)=>({width:getComputedStyle(el).outlineWidth,style:getComputedStyle(el).outlineStyle,radius:getComputedStyle(el).borderRadius})')
                if focus['style']=='none' or float(re.match(r'([0-9.]+)',focus['width']).group(1)) < 2:
                    failures.append(f'{label}/{theme}: visible keyboard focus ring missing ({focus})')
                if width in (390,1366):
                    page.locator('#e19DialogPreview .nutrition-advanced-modal').screenshot(path=str(screenshots/f'{label}-{theme}-dialog.png'))
                results.append({'viewport':label,'theme':theme,**state,'focusedControl':focus})
                context.close()
        browser.close()
    report={'passed':not failures,'checks':len(results),'failures':failures,'results':results}
    out.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'passed':not failures,'checks':len(results),'failures':failures,'report':str(out)},ensure_ascii=False))
    if failures: raise SystemExit(1)

if __name__ == '__main__': main()
