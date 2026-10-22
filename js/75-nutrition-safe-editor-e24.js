/* AgendaFICH — E24: editor seguro de comidas.
 * Protege cambios sin guardar, valida cantidades y permite deshacer eliminaciones
 * del borrador. No realiza escrituras en Supabase ni modifica Entrenamiento.
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const overlay = $('nutritionOverlay');
  if (!overlay || overlay.dataset.e24SafeEditor === '1') return;
  overlay.dataset.e24SafeEditor = '1';

  let quantityErrorSequence = 0;
  const state = {
    dirty: false,
    visible: overlay.classList.contains('show'),
    dialogOpen: false,
    dialogResolve: null,
    dialogPreviousFocus: null,
    closeFunction: null,
    undoStack: [],
    undoTimer: null,
    undoHost: null,
    confirmHost: null
  };

  function isOpen() { return overlay.classList.contains('show'); }
  function isBusy() { return overlay.getAttribute('aria-busy') === 'true'; }
  function markDirty() { if (isOpen() && !isBusy()) state.dirty = true; }
  function clearDirty() { state.dirty = false; }
  function isDraftField(target) {
    if (!(target instanceof Element)) return false;
    return target.matches('#mealType, #mealTitle, #mealFoods, #mealCalories, #mealProtein, #mealCarbs, #mealFat, #mealTime, #mealDescription')
      || !!target.closest('#nutritionMealBuilderList .nutrition-meal-builder-qty, #nutritionMealBuilderList .nutrition-meal-builder-consumed');
  }

  function makeConfirmDialog() {
    const parent = overlay.querySelector('.modal') || overlay;
    const host = document.createElement('div');
    host.className = 'e24-confirm-backdrop';
    host.hidden = true;
    host.innerHTML = `
      <section class="e24-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="e24ConfirmTitle" aria-describedby="e24ConfirmMessage" tabindex="-1">
        <div class="e24-confirm-heading"><span class="e24-confirm-icon" aria-hidden="true">!</span><div><h2 id="e24ConfirmTitle">¿Descartar cambios?</h2><p id="e24ConfirmMessage"></p></div></div>
        <div class="e24-confirm-actions"><button type="button" class="e24-confirm-cancel" id="e24ConfirmCancel">Seguir editando</button><button type="button" class="e24-confirm-accept is-danger" id="e24ConfirmAccept">Descartar cambios</button></div>
      </section>`;
    parent.appendChild(host);
    state.confirmHost = host;

    const dialog = host.querySelector('[role="alertdialog"]');
    const cancel = $('e24ConfirmCancel');
    const accept = $('e24ConfirmAccept');

    function finish(result) {
      if (!state.dialogOpen) return;
      state.dialogOpen = false;
      const resolve = state.dialogResolve;
      state.dialogResolve = null;
      host.hidden = true;
      if (state.dialogPreviousFocus && state.dialogPreviousFocus.isConnected) {
        try { state.dialogPreviousFocus.focus({ preventScroll: true }); }
        catch (_) { state.dialogPreviousFocus.focus(); }
      }
      state.dialogPreviousFocus = null;
      if (resolve) resolve(!!result);
    }

    cancel.addEventListener('click', () => finish(false));
    accept.addEventListener('click', () => finish(true));
    host.addEventListener('click', event => { if (event.target === host) finish(false); });
    host.addEventListener('keydown', event => {
      if (!state.dialogOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); finish(false); return;
      }
      if (event.key !== 'Tab') return;
      // Evita que el atrapado de foco del diálogo exterior de Alimentación
      // compita con el diálogo de confirmación anidado.
      event.stopPropagation();
      const focusable = [cancel, accept].filter(el => el && !el.disabled);
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    return { host, dialog, cancel, accept, finish };
  }

  let confirmApi = null;
  function askConfirm({ title, message, acceptLabel, cancelLabel, danger = true }) {
    if (!confirmApi) confirmApi = makeConfirmDialog();
    if (state.dialogOpen && state.dialogResolve) confirmApi.finish(false);
    const { host, dialog, cancel, accept } = confirmApi;
    $('e24ConfirmTitle').textContent = title || 'Confirmar acción';
    $('e24ConfirmMessage').textContent = message || '';
    accept.textContent = acceptLabel || 'Confirmar';
    cancel.textContent = cancelLabel || 'Cancelar';
    accept.classList.toggle('is-danger', !!danger);
    state.dialogOpen = true;
    state.dialogPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    host.hidden = false;
    return new Promise(resolve => {
      state.dialogResolve = resolve;
      requestAnimationFrame(() => { if (state.dialogOpen) cancel.focus({ preventScroll: true }); });
    });
  }

  function makeUndoToast() {
    const host = document.createElement('div');
    host.className = 'e24-undo-toast';
    host.hidden = true;
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-atomic', 'true');
    const message = document.createElement('p');
    message.className = 'e24-undo-message';
    const undo = document.createElement('button');
    undo.type = 'button'; undo.className = 'e24-undo-action'; undo.textContent = 'Deshacer';
    undo.setAttribute('aria-label', 'Deshacer la última eliminación de alimento');
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'e24-undo-dismiss'; close.textContent = '×';
    close.setAttribute('aria-label', 'Cerrar aviso de eliminación');
    host.append(message, undo, close);
    document.body.appendChild(host);
    state.undoHost = host;

    undo.addEventListener('click', () => {
      expireUndoStack();
      const action = state.undoStack.pop();
      if (!action) { renderUndoToast(); return; }
      const catalog = window.AgendaFoodCatalog;
      const current = Array.isArray(catalog?.getPendingMealFoods?.()) ? catalog.getPendingMealFoods().slice() : [];
      const insertAt = Math.max(0, Math.min(action.index, current.length));
      current.splice(insertAt, 0, action.item);
      if (typeof catalog?.setPendingMealFoods !== 'function') {
        state.undoStack.push(action);
        message.textContent = 'No se pudo restaurar el alimento. No se modificó el borrador.';
        renderUndoToast(); return;
      }
      catalog.setPendingMealFoods(current);
      markDirty();
      renderUndoToast();
      window.setTimeout(() => {
        const qty = document.querySelectorAll('#nutritionMealBuilderList .nutrition-meal-builder-qty')[insertAt];
        qty?.focus({ preventScroll: true });
      }, 0);
    });
    close.addEventListener('click', () => { state.undoStack = []; renderUndoToast(); });
    return host;
  }

  function expireUndoStack() {
    const now = Date.now();
    state.undoStack = state.undoStack.filter(item => item.expiresAt > now);
  }

  function renderUndoToast() {
    if (!state.undoHost) makeUndoToast();
    const host = state.undoHost;
    const message = host.querySelector('.e24-undo-message');
    const action = state.undoStack[state.undoStack.length - 1];
    if (!action) {
      host.hidden = true;
      if (state.undoTimer) clearTimeout(state.undoTimer);
      state.undoTimer = null;
      return;
    }
    host.hidden = false;
    message.textContent = state.undoStack.length > 1
      ? `Se quitó «${action.name}». Podés deshacer esta y ${state.undoStack.length - 1} eliminación(es) anterior(es).`
      : `Se quitó «${action.name}». Podés deshacerlo.`;
    if (state.undoTimer) clearTimeout(state.undoTimer);
    state.undoTimer = window.setTimeout(() => {
      expireUndoStack();
      renderUndoToast();
    }, Math.max(50, action.expiresAt - Date.now() + 20));
  }

  function copyItems(items) {
    return (Array.isArray(items) ? items : []).map(item => item && typeof item === 'object' ? { ...item } : item);
  }

  function getPendingItems() {
    const items = window.AgendaFoodCatalog?.getPendingMealFoods?.();
    return Array.isArray(items) ? items : [];
  }

  function validateQuantity(input, report = false) {
    if (!input) return true;
    const raw = String(input.value ?? '').trim();
    const value = raw === '' ? NaN : Number(raw);
    const valid = Number.isFinite(value) && value > 0 && value <= 1000000;
    const field = input.closest('.nutrition-meal-builder-item-qty');
    let feedback = field?.querySelector('.e24-quantity-feedback');
    if (field && !feedback) {
      feedback = document.createElement('small');
      feedback.className = 'e24-quantity-feedback';
      feedback.id = `e24QuantityError${++quantityErrorSequence}`;
      feedback.hidden = true;
      field.appendChild(feedback);
    }
    if (!valid) {
      const message = raw === '' ? 'Ingresá una cantidad mayor que cero.' : 'Usá una cantidad mayor que cero y no superior a 1.000.000.';
      input.setCustomValidity(message);
      input.setAttribute('aria-invalid', 'true');
      if (feedback) { feedback.textContent = message; feedback.hidden = false; }
      if (feedback?.id) {
        const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (!ids.includes(feedback.id)) ids.push(feedback.id);
        input.setAttribute('aria-describedby', ids.join(' '));
      }
      if (report) {
        try { input.reportValidity(); } catch (_) {}
      }
      return false;
    }
    input.setCustomValidity('');
    input.removeAttribute('aria-invalid');
    if (feedback) feedback.hidden = true;
    if (feedback?.id) {
      const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== feedback.id);
      if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
      else input.removeAttribute('aria-describedby');
    }
    return true;
  }

  function firstInvalidQuantity() {
    const inputs = Array.from(document.querySelectorAll('#nutritionOverlay .nutrition-meal-builder-qty'));
    return inputs.find(input => !validateQuantity(input, false)) || null;
  }

  function refreshQuantityIntegrity() {
    if (!isOpen()) return;
    const inputs = Array.from(document.querySelectorAll('#nutritionOverlay .nutrition-meal-builder-qty'));
    const invalid = inputs.filter(input => !validateQuantity(input, false));
    const totalsHost = $('nutritionMealBuilderTotals');
    const warningId = 'e24QuantityTotalsWarning';
    const summaryFields = ['mealCalories', 'mealProtein', 'mealCarbs', 'mealFat'].map($);
    if (invalid.length) {
      invalid.forEach(input => {
        const total = input.closest('.nutrition-meal-builder-item')?.querySelector('.nutrition-meal-builder-item-total-value');
        if (total) {
          total.textContent = 'Revisar cantidad';
          total.setAttribute('aria-label', 'Cantidad inválida; corregí el valor para calcular este alimento.');
        }
      });
      Array.from(totalsHost?.children || []).filter(node => node.querySelector?.('strong') && node.querySelector?.('span')).slice(0, 4).forEach(card => {
        const value = card.querySelector('strong');
        if (value) { value.textContent = 'Revisar cantidad'; value.classList.add('e24-invalid-summary-value'); }
        card.classList.add('e24-invalid-summary-card');
      });
      summaryFields.forEach(field => {
        if (!field) return;
        if (field.dataset.e24QuantityInvalid !== 'true') field.dataset.e24PreviousAriaLabel = field.getAttribute('aria-label') || '';
        field.value = '';
        field.dataset.e24QuantityInvalid = 'true';
        field.setAttribute('aria-label', 'Total no disponible: corregí la cantidad de un alimento.');
        field.classList.add('e24-invalid-quantity-summary-field');
      });
      if (totalsHost && !$(warningId)) {
        const note = document.createElement('div');
        note.id = warningId; note.className = 'e24-quantity-totals-warning'; note.setAttribute('role', 'status');
        note.textContent = 'No se muestran totales mientras haya cantidades vacías o inválidas. Corregí las cantidades para recalcular la comida.';
        totalsHost.appendChild(note);
      }
    } else {
      $(warningId)?.remove();
      Array.from(totalsHost?.children || []).forEach(card => {
        card.classList?.remove('e24-invalid-summary-card');
        card.querySelector?.('strong')?.classList.remove('e24-invalid-summary-value');
        const total = card.querySelector?.('.nutrition-meal-builder-item-total-value');
        if (total) total.removeAttribute('aria-label');
      });
      summaryFields.forEach(field => {
        if (!field || field.dataset.e24QuantityInvalid !== 'true') return;
        delete field.dataset.e24QuantityInvalid;
        field.classList.remove('e24-invalid-quantity-summary-field');
        if (field.getAttribute('aria-label') === 'Total no disponible: corregí la cantidad de un alimento.') {
          const previousLabel = field.dataset.e24PreviousAriaLabel || '';
          if (previousLabel) field.setAttribute('aria-label', previousLabel);
          else field.removeAttribute('aria-label');
        }
        delete field.dataset.e24PreviousAriaLabel;
      });
    }
  }

  function isCloseAttempt(event) {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    if (target.closest('#nutritionCloseBtn, #cancelMealBtn')) return true;
    return target === overlay;
  }

  async function handleCloseAttempt(event) {
    if (!isOpen() || !state.dirty || isBusy() || state.dialogOpen || !isCloseAttempt(event)) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const trigger = document.activeElement;
    const discard = await askConfirm({
      title: '¿Descartar los cambios?',
      message: 'Esta comida tiene cambios que todavía no guardaste. Si salís ahora, se perderán los cambios de este formulario; la comida que ya estaba guardada no se modifica.',
      acceptLabel: 'Descartar cambios', cancelLabel: 'Seguir editando', danger: true
    });
    if (!discard) {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      return;
    }
    clearDirty();
    if (state.undoTimer) clearTimeout(state.undoTimer);
    state.undoStack = []; renderUndoToast();
    if (typeof state.closeFunction === 'function') state.closeFunction.call(window, false);
    else overlay.classList.remove('show');
  }

  function init() {
    state.closeFunction = typeof window.closeNutritionModal === 'function' ? window.closeNutritionModal : null;
    makeUndoToast();
    confirmApi = makeConfirmDialog();

    const observer = new MutationObserver(() => {
      const now = isOpen();
      if (now && !state.visible) {
        state.dirty = false;
        state.visible = true;
        state.undoStack = [];
        renderUndoToast();
      } else if (!now && state.visible) {
        state.visible = false;
        state.dirty = false;
        state.undoStack = [];
        renderUndoToast();
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });

    // Cualquier edición de un campo del modal debe considerarse no guardada.
    document.addEventListener('input', event => {
      if (!isOpen() || !(event.target instanceof Element) || !overlay.contains(event.target)) return;
      if (event.target.matches('.nutrition-meal-builder-qty')) { validateQuantity(event.target, false); window.setTimeout(refreshQuantityIntegrity, 0); }
      if (isDraftField(event.target)) markDirty();
    }, true);

    document.addEventListener('change', event => {
      if (!isOpen() || !(event.target instanceof Element) || !overlay.contains(event.target)) return;
      const input = event.target.closest('.nutrition-meal-builder-qty');
      if (input) {
        if (!validateQuantity(input, true)) {
          event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
          markDirty(); return;
        }
        // El constructor actualiza el borrador después de este listener de captura.
        // Esperamos al final del evento para validar el estado ya renderizado.
        window.setTimeout(refreshQuantityIntegrity, 0);
      }
      if (isDraftField(event.target)) markDirty();
    }, true);

    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (state.confirmHost?.contains(event.target)) return;
      if (isCloseAttempt(event)) { handleCloseAttempt(event); return; }
      if (!isOpen() || isBusy()) return;

      const clear = event.target.closest('#nutritionMealBuilderClear');
      if (clear && getPendingItems().length) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        askConfirm({
          title: '¿Quitar todos los alimentos?',
          message: 'Se quitarán todos los ingredientes del borrador actual. La comida guardada no cambia hasta que vuelvas a guardar.',
          acceptLabel: 'Quitar todos', cancelLabel: 'Conservar alimentos', danger: true
        }).then(confirmed => {
          if (!confirmed) return;
          const catalog = window.AgendaFoodCatalog;
          if (typeof catalog?.setPendingMealFoods !== 'function') return;
          catalog.setPendingMealFoods([]);
          state.undoStack = []; renderUndoToast(); markDirty();
        });
        return;
      }

      const remove = event.target.closest('#nutritionMealBuilderList .nutrition-meal-builder-remove');
      if (remove) {
        const row = remove.closest('.nutrition-meal-builder-item');
        const index = Array.from(row?.parentElement?.children || []).indexOf(row);
        const before = copyItems(getPendingItems());
        const item = before[index];
        markDirty();
        window.setTimeout(() => {
          const after = getPendingItems();
          if (!item || after.length !== before.length - 1 || before.length === 0) return;
          state.undoStack.push({ item, index: Math.max(0, index), name: String(item.name || 'alimento'), expiresAt: Date.now() + 8000 });
          if (state.undoStack.length > 10) state.undoStack.shift();
          renderUndoToast();
        }, 0);
        return;
      }

      if (event.target.closest('#nutritionMealBuilderList .nutrition-meal-builder-duplicate, #nutritionMealBuilderList .nutrition-meal-builder-consumed')) {
        markDirty(); return;
      }
    }, true);

    document.addEventListener('agenda:nutrition-food-added', () => markDirty());
    document.addEventListener('agenda:nutrition-pending-foods-changed', () => {
      // El cambio del catálogo por sí solo no marca un borrador como editado:
      // al recuperar comidas guardadas también se emite este evento.
      if (!isOpen()) return;
      window.setTimeout(() => {
        const inputs = document.querySelectorAll('#nutritionOverlay .nutrition-meal-builder-qty');
        inputs.forEach(input => validateQuantity(input, false));
        refreshQuantityIntegrity();
      }, 0);
    });

    // Si la persona intenta guardar una cantidad vacía, cero o absurda, no
    // permitimos que el constructor la convierta silenciosamente en 0.1.
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('#saveMealBtn') || !isOpen()) return;
      const invalid = firstInvalidQuantity();
      if (!invalid) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      invalid.focus({ preventScroll: true });
      validateQuantity(invalid, true);
    }, true);

    document.addEventListener('keydown', event => {
      if (state.dialogOpen || event.key !== 'Escape' || !isOpen() || !state.dirty || isBusy()) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      handleCloseAttempt({
        target: overlay.querySelector('#nutritionCloseBtn') || overlay,
        preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}
      });
    }, true);

    window.addEventListener('beforeunload', event => {
      if (!isOpen() || (!state.dirty && !isBusy())) return;
      event.preventDefault();
      event.returnValue = '';
    });

    document.addEventListener('agenda:nutrition-meal-saved', () => {
      // El evento se emite antes de completar el guardado de los ingredientes.
      // Esperamos al final del turno y solo limpiamos si el editor se cerró.
      window.setTimeout(() => { if (!isOpen()) clearDirty(); }, 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
