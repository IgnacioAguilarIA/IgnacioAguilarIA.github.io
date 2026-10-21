/* Agenda FICH — E17: microinteracciones discretas de Alimentación.
   Proporciona feedback visual sobre operaciones ya confirmadas; no modifica datos ni invoca persistencia. */
(function () {
  'use strict';

  if (document.documentElement.dataset.nutritionE17Bound === '1') return;
  document.documentElement.dataset.nutritionE17Bound = '1';

  const $ = id => document.getElementById(id);
  const timers = new WeakMap();
  let lastKeyboardDelete = null;

  function currentUserId() {
    try { return typeof currentUser !== 'undefined' && currentUser?.id ? String(currentUser.id) : ''; }
    catch (_) { return ''; }
  }

  function pulse(node, className, duration = 1600) {
    if (!(node instanceof HTMLElement) || !node.isConnected) return;
    const previous = timers.get(node);
    if (previous) window.clearTimeout(previous);
    node.classList.remove(className);
    // Force style recalculation only for this small, explicitly-triggered feedback.
    void node.offsetWidth;
    node.classList.add(className);
    const timer = window.setTimeout(() => {
      node.classList.remove(className);
      timers.delete(node);
    }, duration);
    timers.set(node, timer);
  }

  function findMealCard(mealId) {
    if (mealId == null || mealId === '') return null;
    return [...(document.querySelectorAll('#nutritionPanel #mealList .meal-card') || [])]
      .find(card => String(card.dataset.mealId || '') === String(mealId)) || null;
  }

  function belongsToCurrentAccount(detail) {
    const owner = String(detail?.userId || '');
    const active = currentUserId();
    // An owner-specific event must not update UI when there is no active session to verify.
    if (!owner) return true;
    if (!active) return false;
    return owner === active;
  }

  function onMealSaved(event) {
    const detail = event?.detail || {};
    if (!belongsToCurrentAccount(detail)) return;
    const card = findMealCard(detail.mealId || detail.meal?.id);
    if (card) pulse(card, 'e17-saved-feedback', 1750);
  }

  function onMealItemsSaved(event) {
    const detail = event?.detail || {};
    if (!belongsToCurrentAccount(detail) || detail.deleted || detail.cleared || Number(detail.count) <= 0) return;
    const card = findMealCard(detail.mealId);
    const body = card?.querySelector('.e15-meal-details-body') || card?.querySelector('.meal-card-head');
    if (body) pulse(body, 'e17-detail-saved-feedback', 1400);
  }

  function onFoodAdded(event) {
    if (!event?.detail?.food) return;
    const account = currentUserId();
    if (!account) return;
    const foodsInput = $('mealFoods');
    // Highlight the field that was just updated; the existing module owns its value and validation.
    if (foodsInput && !foodsInput.disabled) pulse(foodsInput, 'e17-field-updated', 1050);
  }

  function onSyncStatus(event) {
    const detail = event?.detail || {};
    if (detail.state !== 'saved' || !belongsToCurrentAccount(detail)) return;
    const status = $('nutritionSyncStatus');
    if (status) pulse(status, 'e17-sync-confirmed', 1350);
  }

  function onGoalsSaved() {
    const button = $('nutritionGoalBtn');
    if (button) pulse(button, 'e17-action-confirmed', 1200);
  }

  function setupFoodStatusFeedback() {
    const status = $('nutritionFoodQuickStatus');
    if (!status || status.dataset.e17Observer) return;
    status.dataset.e17Observer = '1';
    const observer = new MutationObserver(() => {
      const text = String(status.textContent || '').trim();
      if (/\b(agregado|agregada|añadido|añadida|guardado|guardada|favoritos|favorito)\b/i.test(text) &&
          !/no se pudo|no se agregó|no se pudo confirmar|error/i.test(text)) {
        pulse(status, 'e17-feedback-pulse', 1150);
      }
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }

  function setupMealDetailFeedback() {
    const list = $('mealList');
    if (!list || list.dataset.e17DetailsBound) return;
    list.dataset.e17DetailsBound = '1';
    list.addEventListener('toggle', event => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.matches('.e15-meal-details') || !details.open) return;
      const body = details.querySelector('.e15-meal-details-body');
      if (body) pulse(body, 'e17-detail-entered', 320);
    }, true);
  }

  function captureKeyboardDelete(event) {
    const button = event.target?.closest?.('#nutritionPanel #mealList .meal-action.delete');
    if (!button) return;
    const card = button.closest('.meal-card');
    const cards = [...(document.querySelectorAll('#nutritionPanel #mealList .meal-card') || [])];
    lastKeyboardDelete = event.detail === 0 && card ? {
      id: String(card.dataset.mealId || ''),
      index: cards.indexOf(card),
      keyboard: true
    } : null;
  }

  function restoreFocusAfterDelete(event) {
    const detail = event?.detail || {};
    const removedId = String(detail.mealId || '');
    const deleted = lastKeyboardDelete;
    lastKeyboardDelete = null;
    if (!deleted?.keyboard || !removedId || deleted.id !== removedId) return;
    if (!belongsToCurrentAccount(detail)) return;
    // Only restore focus if removal actually detached the previously focused control.
    // This avoids stealing focus after a cancelled confirm or unrelated deletion.
    if (document.activeElement !== document.body && document.activeElement !== document.documentElement) return;
    window.requestAnimationFrame(() => {
      const list = $('mealList');
      const cards = [...(list?.querySelectorAll('.meal-card') || [])];
      const targetCard = cards[Math.min(Math.max(deleted.index, 0), cards.length - 1)];
      const target = targetCard?.querySelector('.meal-action, .e15-meal-details-summary') || $('addMealBtn');
      if (!(target instanceof HTMLElement)) return;
      target.focus({ preventScroll: true });
      if (targetCard) pulse(targetCard, 'e17-focus-arrival', 950);
    });
  }

  function init() {
    if (!$('nutritionPanel') || document.documentElement.dataset.nutritionE17Ready === '1') return;
    document.documentElement.dataset.nutritionE17Ready = '1';
    setupFoodStatusFeedback();
    setupMealDetailFeedback();
    document.addEventListener('agenda:nutrition-meal-saved', onMealSaved);
    document.addEventListener('agenda:nutrition-meal-items-saved', onMealItemsSaved);
    document.addEventListener('agenda:nutrition-food-added', onFoodAdded);
    document.addEventListener('agenda:nutrition-sync-status', onSyncStatus);
    document.addEventListener('agenda:nutrition-goals-saved', onGoalsSaved);
    document.addEventListener('click', captureKeyboardDelete, true);
    document.addEventListener('agenda:nutrition-meal-deleted', restoreFocusAfterDelete);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
