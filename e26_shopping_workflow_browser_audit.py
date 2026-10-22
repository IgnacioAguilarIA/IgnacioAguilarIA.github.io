#!/usr/bin/env python3
"""Headless browser audit using a fake Supabase provider and production E26 assets."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RESULT = ROOT / "tests" / "artifacts" / "e26" / "shopping-workflow-browser-audit.json"
JS = (ROOT / "js" / "62-nutrition-week-planner-shopping.js").read_text()
CSS_BASE = (ROOT / "css" / "83-nutrition-week-planner-shopping.css").read_text()
CSS_E26 = (ROOT / "css" / "107-nutrition-shopping-workflow-e26.css").read_text()

checks=[]
def check(name, condition, details=""):
    checks.append({"name":name,"passed":bool(condition),"details":details})
    if not condition:
        raise AssertionError(f"{name}: {details}")

fixture_script = r"""
window.currentUser={id:'e26-test-user'};
const fixtureRows=[
 {id:'1',user_id:'e26-test-user',week_start:'2026-10-19',item_key:'a',name:'Tomáte fresco',brand:'Huerta Norte',quantity:500,quantity_known:true,unit:'g',preparation_state:'raw',category:'Verdulería',checked:false,active:true,source:'generated'},
 {id:'2',user_id:'e26-test-user',week_start:'2026-10-19',item_key:'b',name:'Leche',brand:'La Vaquita',quantity:2,quantity_known:true,unit:'l',preparation_state:'unspecified',category:'Lácteos',checked:true,active:true,source:'manual'},
 {id:'3',user_id:'e26-test-user',week_start:'2026-10-19',item_key:'c',name:'Arroz',brand:'',quantity:null,quantity_known:false,unit:'g',preparation_state:'unspecified',category:'Almacén',checked:false,active:true,source:'generated'},
 {id:'4',user_id:'e26-test-user',week_start:'2026-10-19',item_key:'d',name:'Archivado',brand:'',quantity:1,quantity_known:true,unit:'unit',preparation_state:'unspecified',category:'Otros',checked:false,active:false,source:'generated'}
];
window.ensureSupabase=async()=>({from(table){if(table!=='nutrition_shopping_items')throw new Error('tabla no esperada');return {select(){return this},eq(){return this},order(){return this},range:async()=>({data:fixtureRows,error:null})}}});
"""

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":390,"height":844})
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="nutritionPanel"><div class="nutrition-actions"></div></main></body></html>')
    page.add_style_tag(content=CSS_BASE)
    page.add_style_tag(content=CSS_E26)
    page.add_script_tag(content=fixture_script)
    page.add_script_tag(content=JS)
    page.get_by_role("button", name="🛒 Lista de compras").click()
    page.get_by_role("dialog", name="Lista de compras").wait_for()
    page.get_by_text("Progreso de compra").wait_for()
    page.wait_for_function("document.querySelectorAll('.nutrition-shopping-row').length === 3")
    metric = lambda key: page.locator(f'.nutrition-shopping-metric [data-metric="{key}"]').inner_text()
    check("Summary counts include all active rows", (metric('total'),metric('pending'),metric('purchased'))==('3','2','1'), str((metric('total'),metric('pending'),metric('purchased'))))
    check("Progress percent accurate", page.locator('.nutrition-shopping-progress-label strong').inner_text()=='33%', page.locator('.nutrition-shopping-progress').get_attribute('aria-valuetext'))
    check("Unknown quantity warning visible", page.locator('.nutrition-shopping-unknown-note').is_visible() and '1 producto pendiente' in page.locator('.nutrition-shopping-unknown-note').inner_text())
    search=page.get_by_role('searchbox', name='Buscar productos por nombre, marca o categoría')
    search.fill('TOMATE')
    check("Search works case/diacritics-insensitively", page.locator('.nutrition-shopping-row').count()==1 and page.locator('.nutrition-shopping-name').inner_text()=='Tomáte fresco')
    search.fill('')
    state=page.get_by_role('combobox', name='Filtrar productos por estado')
    state.select_option('purchased')
    check("Purchased filter shows only purchased products", page.locator('.nutrition-shopping-row').count()==1 and page.locator('.nutrition-shopping-name').inner_text()=='Leche')
    state.select_option('pending')
    check("Pending filter excludes purchased rows", page.locator('.nutrition-shopping-row').count()==2)
    category=page.get_by_role('combobox', name='Filtrar productos por categoría')
    category.select_option(label='Verdulería')
    check("Category and state filters compose", page.locator('.nutrition-shopping-row').count()==1 and page.locator('.nutrition-shopping-name').inner_text()=='Tomáte fresco')
    search.fill('sin coincidencias')
    check("Empty filter state gives next step", page.get_by_text('No hay productos que coincidan con estos filtros.').is_visible())
    check("Mobile view has no horizontal overflow", page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f"scrollWidth={page.evaluate('document.documentElement.scrollWidth')}, width={page.evaluate('window.innerWidth')}")
    search.fill(''); state.select_option('all'); category.select_option('all')
    RESULT.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(RESULT.parent / 'mobile-shopping-summary.png'), full_page=True)
    page.set_viewport_size({'width':1365,'height':900})
    page.screenshot(path=str(RESULT.parent / 'desktop-shopping-summary.png'), full_page=True)
    browser.close()

RESULT.parent.mkdir(parents=True, exist_ok=True)
RESULT.write_text(json.dumps({"stage":"E26","checks":checks,"passed":sum(x['passed'] for x in checks),"failed":sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False)+"\n")
print(json.dumps({"checks":checks,"passed":sum(x['passed'] for x in checks),"failed":sum(not x['passed'] for x in checks)},indent=2,ensure_ascii=False))
