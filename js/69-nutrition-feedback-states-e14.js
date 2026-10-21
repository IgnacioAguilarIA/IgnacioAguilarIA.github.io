/* Agenda FICH — E14: estados visuales y reintentos seguros para Alimentación.
   No cambia los datos ni las operaciones originales; mejora su feedback visual. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const STATUS_SELECTOR = [
    '#nutritionSyncStatus', '#nutritionMealOrderStatus', '#nutritionFoodCatalogStatus',
    '#nutritionMealBuilderStatus', '#nutritionMealCopyStatus', '#nutritionCopyDayStatus',
    '#nutritionStatsStatus', '#nutritionRecipeListStatus', '#nutritionUserFoodsStatus',
    '#nutritionHistoryStatus', '#nutritionRecipePreparationHistoryStatus', '#nutritionCustomFoodStatus',
    '#nutritionRecipeSaveStatus', '#nutritionRecipePreparationStatus', '#nutritionQualityStatus',
    '.nutrition-meal-copy-status', '.nutrition-routine-status', '.nutrition-advanced-status',
    '.nutrition-meal-builder-status', '.nutrition-food-catalog-status', '.nutrition-meal-order-status',
    '.nutrition-week-status', '.nutrition-pantry-status'
  ].join(',');

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim();
  }

  function classifyState(value) {
    const text = normalize(value);
    if (!text) return 'neutral';
    if (/no se pudo|no se pudieron|no fue posible|error\b|fallo|rechazad[oa]|no se guardo|no se elimino|no se duplico|no pudimos|interrumpid[oa]|fallo la carga/.test(text)) return 'error';
    if (/sin conexion|pendiente|incomplet[oa]|requiere revision|revis(a|a)|falta instalar|no esta disponible|no se confirmo|guardad[oa]s? en este dispositivo|datos locales|sincronizacion pendiente/.test(text)) return 'warning';
    if (/cargando|preparando|consultando|actualizando|comprobando|obteniendo|sincronizando|reintentando|calculando|guardando|esperando|procesando|leyendo/.test(text)) return 'loading';
    if (/^no hay\b|^todavia no|^no encontramos|^no se encontraron|^sin registros|^no existen|^no hay resultados|^ningun registro/.test(text)) return 'empty';
    if (/guardad[oa]s? correctamente|se guardo|sincronizad[oa]|actualizad[oa]|completad[oa]|exportad[oa]|restaurad[oa]|mostrando \d|se encontraron \d|\bcorrectamente\b|\bactualizado hasta\b/.test(text)) return 'success';
    return 'neutral';
  }

  function getStatusText(node) {
    if (!node) return '';
    if (node.id === 'nutritionSyncStatus') return ($('nutritionSyncStatusText')?.textContent || node.textContent || '').trim();
    return String(node.textContent || '').trim();
  }

  function isStatusNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.id === 'nutritionSyncStatusText') return false;
    if (node.matches?.(STATUS_SELECTOR)) return true;
    const nutritionScope = node.closest?.('#nutritionPanel, #nutritionAdvancedModal, #nutritionQualityOverlay, .nutrition-meal-copy-overlay, .nutrition-routine-overlay, [id^="nutrition"]');
    return node.getAttribute?.('role') === 'status' && !!nutritionScope;
  }

  const retryActions = {
    nutritionRecipeListStatus: () => window.AgendaNutritionAdvanced?.openRecipes?.(),
    nutritionUserFoodsStatus: () => window.AgendaNutritionAdvanced?.openUserFoods?.(),
    nutritionHistoryStatus: () => {
      const range = $('nutritionHistoryRange');
      if (range) { range.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      return window.AgendaNutritionAdvanced?.openHistory?.();
    },
    nutritionStatsStatus: () => {
      const button = $('nutritionStatsRefresh');
      if (!button || button.disabled) return false;
      button.click(); return true;
    },
    nutritionQualityStatus: () => {
      const button = $('nutritionQualityReload');
      if (!button || button.disabled) return false;
      button.click(); return true;
    },
    nutritionCopyDayStatus: () => {
      const button = document.querySelector('#nutritionCopyDayModal [data-routine-primary]');
      if (!button || button.disabled) return false;
      button.click(); return true;
    }
  };

  function buttonFor(node) {
    const parent = node?.parentElement;
    if (!parent || !node.id) return null;
    return [...parent.querySelectorAll('[data-e14-retry-for]')].find(button => button.dataset.e14RetryFor === node.id) || null;
  }

  function removeRetry(node) {
    buttonFor(node)?.remove();
  }

  async function runRetry(node, button) {
    if (!node?.isConnected || !button?.isConnected || button.disabled) return;
    const action = retryActions[node.id];
    if (typeof action !== 'function') return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Reintentando…';
    try {
      const result = await action(node);
      if (result === false) throw new Error('La acción de reintento todavía no está disponible.');
    } catch (_) {
      if (button.isConnected) {
        button.disabled = !navigator.onLine;
        button.removeAttribute('aria-busy');
        button.textContent = navigator.onLine ? 'Reintentar' : 'Sin conexión';
      }
    }
    if (button.isConnected && button.textContent === 'Reintentando…') {
      button.disabled = !navigator.onLine;
      button.removeAttribute('aria-busy');
      button.textContent = navigator.onLine ? 'Reintentar' : 'Sin conexión';
    }
  }

  function ensureRetry(node, state) {
    const action = retryActions[node.id];
    const existing = buttonFor(node);
    if (state !== 'error' || typeof action !== 'function') {
      existing?.remove();
      return;
    }
    const button = existing || document.createElement('button');
    if (!existing) {
      button.type = 'button';
      button.className = 'nutrition-e14-retry';
      button.dataset.e14RetryFor = node.id;
      button.textContent = 'Reintentar';
      button.addEventListener('click', () => runRetry(node, button));
      button.setAttribute('aria-label', 'Reintentar la carga');
      node.insertAdjacentElement('afterend', button);
    }
    button.disabled = !navigator.onLine || button.getAttribute('aria-busy') === 'true';
    if (!button.getAttribute('aria-busy')) button.textContent = navigator.onLine ? 'Reintentar' : 'Sin conexión';
  }

  function decorateStatus(node) {
    if (!isStatusNode(node)) return;
    if (!node.hasAttribute('role')) node.setAttribute('role', 'status');
    if (!node.hasAttribute('aria-live')) node.setAttribute('aria-live', 'polite');
    node.setAttribute('aria-atomic', 'true');
    const state = classifyState(getStatusText(node));
    node.dataset.e14State = state;
    node.classList.toggle('nutrition-e14-state-error', state === 'error');
    node.classList.toggle('nutrition-e14-state-loading', state === 'loading');
    node.classList.toggle('nutrition-e14-state-warning', state === 'warning');
    node.classList.toggle('nutrition-e14-state-empty', state === 'empty');
    node.classList.toggle('nutrition-e14-state-success', state === 'success');
    if (state === 'loading') node.setAttribute('aria-busy', 'true');
    else node.removeAttribute('aria-busy');
    ensureRetry(node, state);
  }

  function collect(root = document) {
    if (root?.nodeType === 1 && isStatusNode(root)) decorateStatus(root);
    root.querySelectorAll?.(STATUS_SELECTOR).forEach(decorateStatus);
  }

  let mealFeedback = null;
  function ensureMealFeedback() {
    if (mealFeedback?.isConnected) return mealFeedback;
    const panel = $('nutritionPanel');
    const list = $('mealList');
    if (!panel || !list) return null;
    mealFeedback = document.createElement('section');
    mealFeedback.id = 'nutritionMealLoadFeedback';
    mealFeedback.className = 'nutrition-e14-meal-feedback';
    mealFeedback.hidden = true;
    mealFeedback.setAttribute('role', 'alert');
    mealFeedback.setAttribute('aria-live', 'assertive');
    mealFeedback.innerHTML = '<span class="nutrition-e14-feedback-mark" aria-hidden="true">!</span><div class="nutrition-e14-feedback-copy"><strong></strong><p></p></div><button type="button" class="nutrition-e14-retry">Reintentar</button>';
    mealFeedback.querySelector('button').addEventListener('click', async () => {
      const btn = mealFeedback?.querySelector('button');
      if (!btn || btn.disabled) return;
      let owner = '';
      try { owner = typeof currentUser !== 'undefined' && currentUser?.id ? String(currentUser.id) : ''; } catch (_) {}
      if (!owner || owner !== mealFeedback.dataset.userId) {
        setMealFeedback('error', 'La cuenta cambió', 'Esta carga pertenece a otra sesión. Seleccioná el día nuevamente para consultar los datos de la cuenta activa.', null);
        return;
      }
      if (!navigator.onLine) { updateMealRetryAvailability(); return; }
      btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Reintentando…';
      try {
        if (typeof selectNutritionDay !== 'function') throw new Error('La recarga no está disponible. Volvé a abrir Alimentación.');
        const day = Number(mealFeedback.dataset.day);
        await selectNutritionDay(day);
      } catch (_) {
        if (mealFeedback?.isConnected) setMealFeedback('error', 'No se pudo reintentar', 'Volvé a intentarlo cuando la conexión esté estable. No se modificó ni eliminó ningún registro.', mealFeedback.dataset.userId);
      } finally {
        if (btn.isConnected) { btn.removeAttribute('aria-busy'); btn.disabled = !navigator.onLine; btn.textContent = navigator.onLine ? 'Reintentar' : 'Sin conexión'; }
      }
    });
    list.insertAdjacentElement('beforebegin', mealFeedback);
    return mealFeedback;
  }

  function setMealFeedback(state, title, description, ownerId, day) {
    const node = ensureMealFeedback();
    if (!node) return;
    if (!state) {
      node.hidden = true;
      node.removeAttribute('data-state');
      $('nutritionPanel')?.removeAttribute('data-e14-load-state');
      return;
    }
    node.hidden = false;
    node.dataset.state = state;
    if (ownerId) node.dataset.userId = String(ownerId); else delete node.dataset.userId;
    if (day !== undefined && day !== null) node.dataset.day = String(day);
    node.querySelector('.nutrition-e14-feedback-mark').textContent = state === 'error' ? '!' : 'i';
    node.querySelector('strong').textContent = title;
    node.querySelector('p').textContent = description;
    const btn = node.querySelector('button');
    btn.hidden = state !== 'error';
    btn.disabled = state === 'error' && !navigator.onLine;
    btn.removeAttribute('aria-busy');
    btn.textContent = navigator.onLine ? 'Reintentar' : 'Sin conexión';
    $('nutritionPanel')?.setAttribute('data-e14-load-state', state);
    if (state === 'error') {
      // Si la consulta falló, el estado vacío normal afirmaría algo que no sabemos.
      const guide = $('e13FirstUse'); if (guide) guide.hidden = true;
      const empty = $('mealList')?.querySelector('.meal-empty'); if (empty && !node.dataset.hasCachedMeals) empty.hidden = true;
    }
  }

  function handleMealLoad(event) {
    const detail = event?.detail || {};
    if (detail.state === 'signed-out') { setMealFeedback(null); return; }
    let owner = '';
    try { owner = typeof currentUser !== 'undefined' && currentUser?.id ? String(currentUser.id) : ''; } catch (_) {}
    if (detail.userId && owner && String(detail.userId) !== owner) return;
    if (detail.state === 'error') {
      const count = Number(detail.cachedCount || detail.count || 0);
      const hasCache = detail.usedCache === true && count > 0;
      const node = ensureMealFeedback();
      if (node) node.dataset.hasCachedMeals = hasCache ? '1' : '';
      setMealFeedback(
        'error',
        hasCache ? 'No pudimos actualizar tus comidas' : 'No pudimos cargar tus comidas',
        hasCache
          ? `Mostramos ${count} comida${count === 1 ? '' : 's'} guardada${count === 1 ? '' : 's'} en este dispositivo. Podrían no incluir el último cambio remoto; reintentá para confirmar la información actual.`
          : 'No podemos confirmar si este día está vacío. Revisá la conexión y volvé a intentar; no se modificó ni eliminó ningún registro.',
        detail.userId || owner,
        detail.day
      );
      if (node) node.dataset.hasCachedMeals = hasCache ? '1' : '';
      return;
    }
    if (detail.state === 'success') setMealFeedback(null);
  }

  function updateMealRetryAvailability() {
    const node = $('nutritionMealLoadFeedback');
    const button = node?.querySelector('button');
    if (!button || node.hidden) return;
    button.disabled = !navigator.onLine || button.getAttribute('aria-busy') === 'true';
    if (!button.getAttribute('aria-busy')) button.textContent = navigator.onLine ? 'Reintentar' : 'Sin conexión';
  }

  function decorateMealEmpty(node) {
    if (!node?.matches?.('#nutritionPanel #mealList .meal-empty')) return;
    const text = normalize(node.textContent);
    let state = 'empty';
    if (/cargando|consultando|actualizando/.test(text)) state = 'loading';
    else if (/no se pudo|no pudimos|error|sin conexion|fallo/.test(text)) state = 'error';
    node.dataset.e14State = state;
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    if (state === 'loading') node.setAttribute('aria-busy', 'true'); else node.removeAttribute('aria-busy');
  }

  function observe() {
    collect();
    document.querySelectorAll('#nutritionPanel #mealList .meal-empty').forEach(decorateMealEmpty);
    const observer = new MutationObserver(records => {
      const nodes = new Set();
      for (const record of records) {
        if (record.target?.nodeType === 1) {
          const match = record.target.closest?.(STATUS_SELECTOR);
          if (match) nodes.add(match);
          if (isStatusNode(record.target)) nodes.add(record.target);
          const mealEmpty = record.target.closest?.('#nutritionPanel #mealList .meal-empty');
          if (mealEmpty) decorateMealEmpty(mealEmpty);
        }
        for (const added of record.addedNodes || []) {
          if (added?.nodeType !== 1) continue;
          if (isStatusNode(added)) nodes.add(added);
          added.querySelectorAll?.(STATUS_SELECTOR).forEach(item => nodes.add(item));
          if (added.matches?.('#nutritionPanel #mealList .meal-empty')) decorateMealEmpty(added);
          added.querySelectorAll?.('#nutritionPanel #mealList .meal-empty').forEach(decorateMealEmpty);
        }
      }
      nodes.forEach(decorateStatus);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    observe();
    document.addEventListener('agenda:nutrition-meals-loaded', handleMealLoad);
    document.addEventListener('agenda:nutrition-day-changed', () => setMealFeedback(null));
    window.addEventListener('online', () => { updateMealRetryAvailability(); collect(); });
    window.addEventListener('offline', () => { updateMealRetryAvailability(); collect(); });
  }

  window.AgendaNutritionFeedbackE14 = { classifyState, decorateStatus, collect, setMealFeedback };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
