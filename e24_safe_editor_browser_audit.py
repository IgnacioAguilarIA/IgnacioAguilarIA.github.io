#!/usr/bin/env python3
"""E24 browser audit for unsaved meal edits, quantity validation, and undo."""
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = r'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E24 safe editor test</title></head><body class="light">
<button id="testOpen" type="button">Abrir editor de prueba</button>
<div class="overlay" id="nutritionOverlay" aria-busy="false"><div class="modal">
  <button id="nutritionCloseBtn" type="button">Cerrar</button><button id="cancelMealBtn" type="button">Cancelar</button>
  <input id="mealTitle" aria-label="Nombre de la comida"><input id="nutritionFoodSearch" aria-label="Buscar alimento"><input id="mealCalories" value="100"><input id="mealProtein" value="20"><input id="mealCarbs" value="30"><input id="mealFat" value="5"><div id="nutritionMealBuilderTotals"><div><span>Calorías</span><strong>100 kcal</strong></div><div><span>Proteínas</span><strong>20 g</strong></div><div><span>Carbohidratos</span><strong>30 g</strong></div><div><span>Grasas</span><strong>5 g</strong></div></div>
  <div id="nutritionMealBuilderList"></div>
  <button id="nutritionMealBuilderClear" type="button">Limpiar</button>
  <button id="saveMealBtn" type="button">Guardar comida</button>
</div></div>
</body></html>'''


def main() -> None:
    report_path = ROOT / 'tests/artifacts/e24/safe-editor-browser-audit.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    checks: list[dict] = []
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page.set_content(HTML, wait_until='domcontentloaded')
        page.add_script_tag(content=r'''
          const overlay=document.getElementById('nutritionOverlay');
          window.__closed=0;window.__saved=0;
          window.closeNutritionModal=function(force){if(!force&&overlay.getAttribute('aria-busy')==='true')return;overlay.classList.remove('show');window.__closed++;};
          document.getElementById('nutritionCloseBtn').addEventListener('click',()=>window.closeNutritionModal(false));
          document.getElementById('cancelMealBtn').addEventListener('click',()=>window.closeNutritionModal(false));
          overlay.addEventListener('click',event=>{if(event.target===overlay)window.closeNutritionModal(false)});
          document.getElementById('testOpen').addEventListener('click',()=>overlay.classList.add('show'));
          document.getElementById('saveMealBtn').addEventListener('click',()=>window.__saved++);
          function renderRows(){
            const host=document.getElementById('nutritionMealBuilderList');host.innerHTML='';
            window.AgendaFoodCatalog.pending.forEach((item,index)=>{
              const row=document.createElement('div');row.className='nutrition-meal-builder-item';
              row.innerHTML=`<div class="nutrition-meal-builder-item-qty"><label>Cantidad</label><div class="nutrition-meal-builder-qty-wrap"><input class="nutrition-meal-builder-qty" type="number" min="0.1" step="0.1" value="${item.quantity}"/><span>${item.unit||'g'}</span></div></div><div class="nutrition-meal-builder-item-total"><strong class="nutrition-meal-builder-item-total-value">100 kcal</strong></div><button type="button" class="nutrition-meal-builder-remove">Quitar</button>`;
              row.querySelector('.nutrition-meal-builder-qty').addEventListener('input',event=>{const value=Number(event.target.value);document.querySelector('#nutritionMealBuilderTotals > div:first-child strong').textContent=Number.isFinite(value)?`${value*2} kcal`:'—';document.getElementById('mealCalories').value=Number.isFinite(value)?String(value*2):'';row.querySelector('.nutrition-meal-builder-item-total-value').textContent=Number.isFinite(value)?`${value*2} kcal`:'—';});
              row.querySelector('.nutrition-meal-builder-remove').addEventListener('click',()=>window.AgendaFoodCatalog.setPendingMealFoods(window.AgendaFoodCatalog.pending.filter((_,i)=>i!==index)));
              host.appendChild(row);
            });
          }
          window.AgendaFoodCatalog={pending:[{name:'Avena',quantity:50,unit:'g'}],getPendingMealFoods(){return this.pending;},setPendingMealFoods(items){this.pending=items;renderRows();document.dispatchEvent(new CustomEvent('agenda:nutrition-pending-foods-changed',{detail:{count:items.length}}));}};
          renderRows();
        ''')
        page.add_style_tag(path=str(ROOT / 'css/105-nutrition-safe-editor-e24.css'))
        page.add_script_tag(path=str(ROOT / 'js/75-nutrition-safe-editor-e24.js'))
        page.locator('#testOpen').click(); page.wait_for_timeout(40)

        # Merely searching the catalog is transient UI state, not an unsaved meal edit.
        page.locator('#nutritionFoodSearch').fill('avena')
        page.locator('#nutritionCloseBtn').click(); page.wait_for_timeout(30)
        search_only = page.evaluate('''() => ({open:document.getElementById('nutritionOverlay').classList.contains('show'),dialogHidden:document.querySelector('#nutritionOverlay .e24-confirm-backdrop').hidden,closed:window.__closed})''')
        passed = not search_only['open'] and search_only['dialogHidden'] and search_only['closed']==1
        checks.append({'name':'catalog search alone does not trigger a false unsaved-changes warning','passed':passed,'result':search_only})
        if not passed: failures.append(f'catalog search was incorrectly treated as a meal edit: {search_only}')
        page.evaluate('window.__closed=0')
        page.locator('#testOpen').click(); page.wait_for_timeout(30)

        # Editing a field must warn on close; cancel keeps work and dialog state stable.
        page.locator('#mealTitle').fill('Desayuno modificado')
        unload = page.evaluate('''() => {const ev=new Event('beforeunload',{cancelable:true});window.dispatchEvent(ev);return ev.defaultPrevented;}''')
        if not unload: failures.append('beforeunload was not prevented for a dirty open meal editor')
        page.locator('#nutritionCloseBtn').click()
        dialog_visible = page.locator('#nutritionOverlay .e24-confirm-backdrop').is_visible()
        page.locator('#e24ConfirmCancel').click()
        close_cancel = page.evaluate('''() => ({open:document.getElementById('nutritionOverlay').classList.contains('show'),closed:window.__closed,dialogHidden:document.querySelector('#nutritionOverlay .e24-confirm-backdrop').hidden})''')
        passed = dialog_visible and close_cancel['open'] and close_cancel['closed']==0 and close_cancel['dialogHidden'] and unload
        checks.append({'name':'unsaved changes are protected and cancel returns to editing','passed':passed,'result':{'dialogShown':dialog_visible,**close_cancel,'beforeUnloadPrevented':unload}})
        if not passed: failures.append(f'unsaved close/cancel protection failed: {close_cancel}, dialog={dialog_visible}, beforeunload={unload}')

        # Confirming discard closes the editor exactly once.
        page.locator('#nutritionCloseBtn').click(); page.locator('#e24ConfirmAccept').click(); page.wait_for_timeout(35)
        discarded = page.evaluate('''() => ({open:document.getElementById('nutritionOverlay').classList.contains('show'),closed:window.__closed})''')
        passed = not discarded['open'] and discarded['closed']==1
        checks.append({'name':'discard confirmation closes the editor','passed':passed,'result':discarded})
        if not passed: failures.append(f'discard confirmation failed: {discarded}')

        # Escape is guarded too.
        page.locator('#testOpen').click(); page.wait_for_timeout(35); page.locator('#mealTitle').fill('Otro cambio'); page.locator('#mealTitle').press('Escape')
        esc_shown = page.locator('#nutritionOverlay .e24-confirm-backdrop').is_visible()
        page.locator('#e24ConfirmCancel').click()
        esc_kept = page.locator('#nutritionOverlay').evaluate("el=>el.classList.contains('show')")
        passed = esc_shown and esc_kept
        checks.append({'name':'Escape does not silently discard a dirty meal','passed':passed,'result':{'dialogShown':esc_shown,'editorStillOpen':esc_kept}})
        if not passed: failures.append('Escape did not guard dirty meal edits')

        # Invalid quantities are explained and must not reach the save handler.
        qty=page.locator('#nutritionMealBuilderList .nutrition-meal-builder-qty').first
        qty.fill('0'); page.wait_for_timeout(15)
        invalid = qty.evaluate("el=>({invalid:el.getAttribute('aria-invalid'),message:el.validationMessage,feedback:el.closest('.nutrition-meal-builder-item-qty').querySelector('.e24-quantity-feedback')?.textContent||''})")
        invalid_totals = page.evaluate('''() => ({card:document.querySelector('#nutritionMealBuilderTotals > div:first-child strong')?.textContent,warning:document.getElementById('e24QuantityTotalsWarning')?.textContent||'',calories:document.getElementById('mealCalories').value,rowTotal:document.querySelector('.nutrition-meal-builder-item-total-value')?.textContent})''')
        page.locator('#saveMealBtn').click()
        save_count_invalid = page.evaluate('window.__saved')
        qty.fill('25'); page.wait_for_timeout(25)
        valid_totals = page.evaluate('''() => ({card:document.querySelector('#nutritionMealBuilderTotals > div:first-child strong')?.textContent,warning:!!document.getElementById('e24QuantityTotalsWarning'),calories:document.getElementById('mealCalories').value,rowTotal:document.querySelector('.nutrition-meal-builder-item-total-value')?.textContent})''')
        page.locator('#saveMealBtn').click()
        save_count_valid = page.evaluate('window.__saved')
        passed = invalid['invalid']=='true' and bool(invalid['message']) and 'cantidad' in invalid['feedback'].lower() and invalid_totals['card']=='Revisar cantidad' and bool(invalid_totals['warning']) and invalid_totals['calories']=='' and save_count_invalid==0 and not valid_totals['warning'] and valid_totals['calories']=='50' and save_count_valid==1
        checks.append({'name':'quantity validation blocks invalid save, marks totals unavailable, then recalculates after correction','passed':passed,'result':{'invalid':invalid,'invalidTotals':invalid_totals,'validTotals':valid_totals,'saveCountAfterInvalid':save_count_invalid,'saveCountAfterValid':save_count_valid}})
        if not passed: failures.append(f'quantity validation failed: {invalid}, invalid_totals={invalid_totals}, valid_totals={valid_totals}, saves={save_count_invalid}->{save_count_valid}')

        # Removing an ingredient offers undo and restores it at its previous index.
        page.locator('#nutritionMealBuilderList .nutrition-meal-builder-remove').click(); page.wait_for_timeout(50)
        count_removed = page.evaluate('window.AgendaFoodCatalog.pending.length')
        toast = page.locator('.e24-undo-toast')
        toast_visible = toast.is_visible()
        if toast_visible: await_button=toast.get_by_role('button',name='Deshacer'); await_button.click()
        page.wait_for_timeout(25)
        restored = page.evaluate('''() => ({count:window.AgendaFoodCatalog.pending.length,name:window.AgendaFoodCatalog.pending[0]?.name||''})''')
        passed = count_removed==0 and toast_visible and restored['count']==1 and restored['name']=='Avena'
        checks.append({'name':'removal provides a working undo action','passed':passed,'result':{'countAfterRemove':count_removed,'toastVisible':toast_visible,'restored':restored}})
        if not passed: failures.append(f'undo after removal failed: removed={count_removed}, toast={toast_visible}, restored={restored}')

        # Clear-all requires explicit confirmation; cancel leaves all foods.
        page.locator('#nutritionMealBuilderClear').click(); clear_dialog = page.locator('#nutritionOverlay .e24-confirm-backdrop').is_visible()
        page.locator('#e24ConfirmCancel').click()
        after_cancel = page.evaluate('window.AgendaFoodCatalog.pending.length')
        page.locator('#nutritionMealBuilderClear').click(); page.locator('#e24ConfirmAccept').click(); page.wait_for_timeout(25)
        after_confirm = page.evaluate('window.AgendaFoodCatalog.pending.length')
        passed = clear_dialog and after_cancel==1 and after_confirm==0
        checks.append({'name':'clear-all requires confirmation and cancel preserves foods','passed':passed,'result':{'dialogShown':clear_dialog,'afterCancel':after_cancel,'afterConfirm':after_confirm}})
        if not passed: failures.append(f'clear confirmation failed: dialog={clear_dialog}, after_cancel={after_cancel}, after_confirm={after_confirm}')

        # Mobile computed styles and accessible confirmation semantics.
        page.locator('#nutritionCloseBtn').click(); page.wait_for_timeout(15)
        accessibility = page.evaluate('''() => {const dialog=document.querySelector('#nutritionOverlay [role="alertdialog"]');return {role:dialog?.getAttribute('role'),modal:dialog?.getAttribute('aria-modal'),labelledby:dialog?.getAttribute('aria-labelledby'),focusVisible:getComputedStyle(document.querySelector('.e24-confirm-cancel')).minHeight,viewport:window.innerWidth}}''')
        passed = accessibility['role']=='alertdialog' and accessibility['modal']=='true' and bool(accessibility['labelledby']) and accessibility['viewport']==390
        checks.append({'name':'confirmation dialog exposes alertdialog semantics in mobile viewport','passed':passed,'result':accessibility})
        if not passed: failures.append(f'confirmation accessibility semantics failed: {accessibility}')
        browser.close()

    result={'passed':not failures,'totalChecks':len(checks),'passedChecks':sum(1 for item in checks if item['passed']),'failures':failures,'checks':checks,'scope':'E24 editor interaction tests with local stub data; no Supabase production access'}
    report_path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':result['passed'],'totalChecks':result['totalChecks'],'passedChecks':result['passedChecks'],'failures':failures,'report':str(report_path)},ensure_ascii=False))
    if failures: raise SystemExit(1)

if __name__ == '__main__': main()
