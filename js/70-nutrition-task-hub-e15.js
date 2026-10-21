/* Agenda FICH — E15: herramientas agrupadas por tarea y tarjetas de comida progresivas.
   Solo modifica la presentación de Alimentación; conserva los IDs y los handlers existentes. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const MOBILE_QUERY = '(max-width: 700px)';
  const GROUPS = [
    { key: 'plan', title: 'Planificar', icon: '🗓️', hint: 'Objetivos y semana' },
    { key: 'prepare', title: 'Preparar', icon: '🍳', hint: 'Recetas y preparación' },
    { key: 'organize', title: 'Organizar', icon: '🛒', hint: 'Compras y despensa' },
    { key: 'review', title: 'Consultar', icon: '📊', hint: 'Historial e informes' },
    { key: 'other', title: 'Otras herramientas', icon: '⚙️', hint: 'Opciones adicionales' }
  ];
  let toolsObserver = null;
  let mealsObserver = null;
  let groupScheduled = false;

  function isMobile() {
    return window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : window.innerWidth <= 700;
  }

  function normalized(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function toolGroup(button) {
    const id = normalized(button.id);
    const text = normalized([button.textContent, button.title, button.getAttribute('aria-label')].join(' '));
    if (/nutrition(goal|planweekeditor|weeklyplanner|copyday)btn/.test(id) || /objetiv|planificar|plan semanal|ver semana|copiar dia|repetir dia/.test(text)) return 'plan';
    if (/nutritione15recipesbtn/.test(id) || /receta|preparacion|preparar|cocina|lote/.test(text)) return 'prepare';
    if (/nutritionpantrybtn|nutritionshoppinglistbtn/.test(id) || /despensa|compras|comprar|faltantes|inventario/.test(text)) return 'organize';
    if (/nutrition(history|qualityopen|stats)btn|nutritionqualityopen/.test(id) || /historial|estadistica|calidad|exportar|informe|registro de consumo/.test(text)) return 'review';
    return 'other';
  }

  function ensureGroup(content, key) {
    let group = content.querySelector(`:scope > .e15-tool-group[data-e15-group="${key}"]`);
    if (group) return group;
    const config = GROUPS.find(item => item.key === key) || GROUPS[GROUPS.length - 1];
    group = document.createElement('section');
    group.className = 'e15-tool-group';
    group.dataset.e15Group = config.key;
    const heading = document.createElement('div');
    heading.className = 'e15-tool-group-head';
    const icon = document.createElement('span');
    icon.className = 'e15-tool-group-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = config.icon;
    const titleWrap = document.createElement('div');
    titleWrap.className = 'e15-tool-group-title-wrap';
    const title = document.createElement('h4');
    title.textContent = config.title;
    const hint = document.createElement('small');
    hint.textContent = config.hint;
    titleWrap.append(title, hint);
    const count = document.createElement('span');
    count.className = 'e15-tool-group-count';
    count.setAttribute('aria-hidden', 'true');
    heading.append(icon, titleWrap, count);
    const actions = document.createElement('div');
    actions.className = 'e15-tool-group-actions';
    group.append(heading, actions);
    const order = GROUPS.findIndex(item => item.key === config.key);
    const next = [...content.querySelectorAll(':scope > .e15-tool-group')]
      .find(item => GROUPS.findIndex(groupInfo => groupInfo.key === item.dataset.e15Group) > order);
    if (next) content.insertBefore(group, next); else content.appendChild(group);
    return group;
  }

  function updateToolCount(details, content) {
    const total = content.querySelectorAll('button').length;
    const count = details.querySelector('.e13-tools-count');
    if (count) count.textContent = total ? String(total) : '';
    const small = details.querySelector('.e13-tools-summary-text small');
    if (small) small.textContent = total ? `${total} herramientas organizadas por tarea` : 'Herramientas adicionales';
    details.classList.toggle('e13-tools-empty', total === 0);
    content.querySelectorAll(':scope > .e15-tool-group').forEach(group => {
      const countNode = group.querySelector('.e15-tool-group-count');
      const groupCount = group.querySelectorAll('.e15-tool-group-actions > button').length;
      group.hidden = groupCount === 0;
      if (countNode) countNode.textContent = groupCount ? String(groupCount) : '';
    });
  }

  function groupLooseTools() {
    groupScheduled = false;
    const details = $('nutritionMoreTools');
    const content = details?.querySelector('.e13-tools-content');
    if (!details || !content) return;

    const directButtons = [...content.children].filter(node => node instanceof HTMLButtonElement);
    directButtons.forEach(button => {
      if (button.id === 'addMealBtn') return;
      const category = toolGroup(button);
      const group = ensureGroup(content, category);
      const actionHost = group.querySelector('.e15-tool-group-actions');
      button.type = 'button';
      if (!button.dataset.e15ToolGrouped) {
        button.dataset.e15ToolGrouped = '1';
        if (!button.getAttribute('aria-label')) {
          const readable = String(button.title || button.textContent || 'Abrir herramienta').trim();
          button.setAttribute('aria-label', readable);
        }
      }
      actionHost.appendChild(button);
    });
    updateToolCount(details, content);
  }

  function scheduleGroupLooseTools() {
    if (groupScheduled) return;
    groupScheduled = true;
    window.setTimeout(groupLooseTools, 0);
  }

  function ensureRecipesShortcut(actions) {
    if ($('nutritionE15RecipesBtn') || !window.AgendaNutritionAdvanced?.openRecipes) return;
    const button = document.createElement('button');
    button.id = 'nutritionE15RecipesBtn';
    button.type = 'button';
    button.className = 'small-btn nutrition-week-tool-btn e15-recipes-shortcut';
    button.textContent = '📖 Mis recetas';
    button.title = 'Abrir, buscar y administrar tus recetas guardadas';
    button.setAttribute('aria-label', 'Abrir mis recetas');
    button.addEventListener('click', () => {
      const api = window.AgendaNutritionAdvanced;
      if (api?.openRecipes) api.openRecipes();
    });
    actions.insertBefore(button, actions.querySelector('#addMealBtn') || null);
  }

  function initToolHub() {
    const panel = $('nutritionPanel');
    const actions = panel?.querySelector('.nutrition-actions');
    const details = $('nutritionMoreTools');
    const content = details?.querySelector('.e13-tools-content');
    if (!panel || !actions || !details || !content || details.dataset.e15Ready === '1') return;
    details.dataset.e15Ready = '1';
    details.setAttribute('aria-label', 'Herramientas de Alimentación agrupadas por tarea');
    const summaryText = details.querySelector('.e13-tools-summary-text small');
    if (summaryText) summaryText.textContent = 'Planificar, preparar, organizar y consultar';
    details.querySelector('summary')?.addEventListener('click', () => { details.dataset.e15UserToggled = '1'; });
    // Mantener un punto de entrada familiar a recetas, sin duplicar su lógica.
    ensureRecipesShortcut(actions);
    // Los módulos existentes agregan herramientas dinámicamente; se agrupan al finalizar su inserción.
    if (!toolsObserver) {
      toolsObserver = new MutationObserver(scheduleGroupLooseTools);
      toolsObserver.observe(actions, { childList: true });
    }
    groupLooseTools();
    // E13 elegía una presentación por ancho. E15 conserva ese criterio, con la cabecera visible.
    details.open = !isMobile();
    const mq = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
    if (mq?.addEventListener) mq.addEventListener('change', () => {
      if (!details.dataset.e15UserToggled) details.open = !mq.matches;
    });
  }

  function firstText(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }

  function decorateMealCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const head = card.querySelector(':scope > .meal-card-head');
    const left = head?.firstElementChild;
    if (!head || !left) return;

    const name = left.querySelector('.meal-name');
    const foods = left.querySelector('.meal-foods');
    const description = left.querySelector('.meal-description');
    const meta = left.querySelector('.meal-meta');

    if (name && !card.querySelector('.e15-meal-card-kcal') && meta) {
      const calorieChip = [...meta.querySelectorAll('.meal-chip')].find(chip => /^cal(?:orias)?\s*:/i.test(firstText(chip)));
      if (calorieChip) {
        const raw = firstText(calorieChip).replace(/^cal(?:orias)?\s*:\s*/i, '').trim();
        if (raw) {
          const badge = document.createElement('span');
          badge.className = 'e15-meal-card-kcal';
          badge.textContent = `${raw} kcal`;
          badge.setAttribute('aria-label', `Calorías planificadas: ${raw} kilocalorías`);
          name.insertAdjacentElement('afterend', badge);
        }
      }
    }

    if (!card.dataset.e15CardDetailsReady) {
      const detailsNodes = [foods, description, meta].filter(Boolean);
      if (foods) {
        const preview = document.createElement('p');
        preview.className = 'e15-meal-card-preview';
        const full = firstText(foods);
        preview.textContent = full.length > 135 ? `${full.slice(0, 132).trimEnd()}…` : full;
        preview.setAttribute('aria-label', `Resumen de alimentos: ${full}`);
        if (name && !left.querySelector('.e15-meal-card-preview')) name.insertAdjacentElement('afterend', preview);
      }
      if (detailsNodes.length) {
        const details = document.createElement('details');
        details.className = 'e15-meal-details';
        const summary = document.createElement('summary');
        summary.className = 'e15-meal-details-summary';
        const label = document.createElement('span');
        label.textContent = 'Ver ingredientes, notas y nutrientes';
        const chevron = document.createElement('span');
        chevron.className = 'e15-meal-details-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '⌄';
        summary.append(label, chevron);
        const body = document.createElement('div');
        body.className = 'e15-meal-details-body';
        details.append(summary, body);
        detailsNodes.forEach(node => body.appendChild(node));
        details.open = !isMobile();
        summary.addEventListener('click', () => { details.dataset.e15UserToggled = '1'; });
        card.appendChild(details);
      }
      card.dataset.e15CardDetailsReady = '1';
    }

    card.querySelectorAll('.meal-action').forEach(button => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.type = 'button';
      if (!button.hasAttribute('aria-label')) {
        const title = String(button.title || '').trim();
        const text = firstText(button);
        button.setAttribute('aria-label', title || text || 'Acción de comida');
      }
    });
  }

  function decorateMealCards(root) {
    (root || $('mealList'))?.querySelectorAll?.('.meal-card').forEach(decorateMealCard);
  }

  function initMealCards() {
    const list = $('mealList');
    if (!list || list.dataset.e15ObserverReady === '1') return;
    list.dataset.e15ObserverReady = '1';
    decorateMealCards(list);
    mealsObserver = new MutationObserver(mutations => {
      const cards = new Set();
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('.meal-card')) cards.add(node);
        node.querySelectorAll?.('.meal-card').forEach(card => cards.add(card));
        const parentCard = node.closest?.('.meal-card');
        if (parentCard) cards.add(parentCard);
      }));
      cards.forEach(decorateMealCard);
    });
    mealsObserver.observe(list, { childList: true, subtree: true });
  }

  function init() {
    initToolHub();
    initMealCards();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
