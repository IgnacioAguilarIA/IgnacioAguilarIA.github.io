/* Agenda FICH — E13: progressive disclosure y primeros pasos.
   Mantiene los IDs de los componentes existentes para no alterar su lógica. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const MOBILE_QUERY = '(max-width: 700px)';

  function setupDisclosureDefaults() {
    const mobile = window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : window.innerWidth <= 700;
    document.querySelectorAll('#nutritionPanel [data-e13-collapsible]').forEach(details => {
      // En escritorio se conserva la vista completa; en móvil priorizamos lo esencial.
      details.open = !mobile;
    });
  }

  function setupActionGrouping(panel) {
    const actions = panel.querySelector('.nutrition-actions');
    const primary = $('addMealBtn');
    if (!actions || !primary || actions.dataset.e13Grouped === '1') return;
    actions.dataset.e13Grouped = '1';

    const details = document.createElement('details');
    details.className = 'e13-tools-disclosure';
    details.id = 'nutritionMoreTools';
    details.setAttribute('aria-label', 'Herramientas adicionales de Alimentación');

    const summary = document.createElement('summary');
    summary.innerHTML = '<span class="e13-tools-icon" aria-hidden="true">＋</span><span class="e13-tools-summary-text"><strong>Más herramientas</strong><small>Objetivos, historial y herramientas avanzadas</small></span><span class="e13-tools-count" aria-hidden="true"></span><span class="e13-tools-chevron" aria-hidden="true">⌄</span>';

    const content = document.createElement('div');
    content.className = 'e13-tools-content';
    details.append(summary, content);
    actions.appendChild(details);

    const updateCount = () => {
      const count = content.querySelectorAll(':scope > button').length;
      const countNode = details.querySelector('.e13-tools-count');
      if (countNode) countNode.textContent = count ? String(count) : '';
      details.classList.toggle('e13-tools-empty', count === 0);
    };

    const collectButtons = () => {
      // Los módulos de planificación, despensa e informes pueden registrar botones
      // al iniciar o después de cambiar la sesión. Todos quedan dentro del mismo grupo.
      [...actions.children].forEach(node => {
        if (node === details || node === primary) return;
        if (node instanceof HTMLButtonElement) content.appendChild(node);
      });
      updateCount();
    };

    collectButtons();
    const observer = new MutationObserver(() => collectButtons());
    observer.observe(actions, { childList: true });
    details.open = !(window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : window.innerWidth <= 700);
  }

  function setupMealTypeHint(panel) {
    const hint = $('e13MealTabsHint');
    const tabs = $('mealTabs');
    if (!hint || !tabs) return;
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Elegir tipo de comida');
    const update = () => {
      tabs.querySelectorAll('button.meal-tab').forEach(button => {
        button.type = 'button';
        button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      });
    };
    const observer = new MutationObserver(update);
    observer.observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    update();
  }

  function setupDayButtons() {
    const days = $('nutritionDays');
    if (!days) return;
    days.setAttribute('role', 'group');
    days.setAttribute('aria-label', 'Elegir día de la semana');
    const update = () => days.querySelectorAll('button.workout-day-btn').forEach(button => {
      button.type = 'button';
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });
    new MutationObserver(update).observe(days, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    update();
  }

  function setupFirstUseGuide() {
    const guide = $('e13FirstUse');
    const list = $('mealList');
    const start = $('e13StartFirstMeal');
    if (!guide || !list) return;

    function update() {
      const cards = list.querySelectorAll('.meal-card').length;
      const emptyNode = list.querySelector('.meal-empty');
      const loadFailed = $('nutritionMealLoadFeedback')?.dataset.state === 'error';
      if (loadFailed) {
        guide.hidden = true;
        if (emptyNode) emptyNode.hidden = true;
        return;
      }
      const loading = !!(emptyNode && /cargando/i.test(emptyNode.textContent || ''));
      let noMealsForDay = false;
      let anyKnownMeals = false;
      try {
        noMealsForDay = typeof nutritionMeals !== 'undefined' && Array.isArray(nutritionMeals) && nutritionMeals.length === 0;
        const cachedMeals = typeof cacheRead === 'function' ? cacheRead('nutritionMealsAll') : null;
        if (Array.isArray(cachedMeals)) anyKnownMeals = cachedMeals.length > 0;
      } catch (_) { noMealsForDay = false; anyKnownMeals = false; }
      const show = !cards && !!emptyNode && !loading && noMealsForDay && !anyKnownMeals;
      guide.hidden = !show;
      if (emptyNode) emptyNode.hidden = show;
    }

    start?.addEventListener('click', () => $('addMealBtn')?.click());
    new MutationObserver(update).observe(list, { childList: true, subtree: true, characterData: true });
    document.addEventListener('agenda:nutrition-meals-loaded', update);
    document.addEventListener('agenda:nutrition-day-changed', update);
    document.addEventListener('agenda:nutrition-meal-saved', update);
    update();
  }

  function init() {
    const panel = $('nutritionPanel');
    if (!panel || panel.dataset.e13Ready === '1') return;
    panel.dataset.e13Ready = '1';
    setupDisclosureDefaults();
    setupActionGrouping(panel);
    setupMealTypeHint(panel);
    setupDayButtons();
    setupFirstUseGuide();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
