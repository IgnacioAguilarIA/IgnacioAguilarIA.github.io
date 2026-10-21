/* Agenda FICH — E16: tarjetas de comidas refinadas.
   Mejora el resumen visible sin cambiar el modelo nutricional ni los manejadores existentes. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const MOBILE_QUERY = '(max-width: 700px)';
  const MOBILE_LABEL = 'Ver detalles';
  const DESKTOP_LABEL = 'Ingredientes, notas y nutrientes';
  let observer = null;
  let resizeQuery = null;

  function isMobile() {
    return window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : window.innerWidth <= 700;
  }

  function textOf(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function readMeta(meta, pattern) {
    const chip = [...(meta?.querySelectorAll('.meal-chip') || [])].find(node => pattern.test(textOf(node)));
    if (!chip) return '';
    return textOf(chip).replace(pattern, '').trim();
  }

  function createPill(className, text, ariaLabel) {
    const pill = document.createElement('span');
    pill.className = className;
    pill.textContent = text;
    if (ariaLabel) pill.setAttribute('aria-label', ariaLabel);
    return pill;
  }

  function ensureGlance(card, name, meta) {
    let glance = card.querySelector(':scope > .e16-meal-glance');
    if (!glance) {
      glance = document.createElement('div');
      glance.className = 'e16-meal-glance';
      glance.setAttribute('aria-label', 'Resumen rápido de la comida');
      name.insertAdjacentElement('afterend', glance);
    }

    // Reutiliza la insignia creada por E15, sin recalcular ni inventar calorías.
    const kcal = card.querySelector('.e15-meal-card-kcal');
    if (kcal && kcal.parentElement !== glance) glance.appendChild(kcal);

    const protein = readMeta(meta, /^(?:prot(?:e[ií]nas?)?)\s*:\s*/i);
    let proteinPill = glance.querySelector('.e16-meal-protein');
    if (protein) {
      if (!proteinPill) {
        proteinPill = createPill('e16-meal-protein', `Proteína ${protein}`, `Proteína planificada: ${protein}`);
        glance.appendChild(proteinPill);
      } else {
        proteinPill.textContent = `Proteína ${protein}`;
        proteinPill.setAttribute('aria-label', `Proteína planificada: ${protein}`);
      }
    } else if (proteinPill) proteinPill.remove();

    const time = readMeta(meta, /^(?:hora|horario)\s*:\s*/i);
    let timePill = glance.querySelector('.e16-meal-time');
    if (time) {
      if (!timePill) {
        timePill = createPill('e16-meal-time', `◷ ${time}`, `Horario de la comida: ${time}`);
        timePill.setAttribute('aria-label', `Horario de la comida: ${time}`);
        glance.appendChild(timePill);
      } else {
        timePill.textContent = `◷ ${time}`;
        timePill.setAttribute('aria-label', `Horario de la comida: ${time}`);
      }
    } else if (timePill) timePill.remove();

    if (!glance.children.length) glance.remove();
  }

  function updateDetailsLabel(details) {
    const summary = details?.querySelector(':scope > summary.e15-meal-details-summary');
    const label = summary?.querySelector('span:first-child');
    if (!summary || !label) return;
    const isOpen = !!details.open;
    const actionLabel = isOpen ? 'Ocultar detalles' : (isMobile() ? MOBILE_LABEL : DESKTOP_LABEL);
    summary.setAttribute('aria-label', isOpen ? 'Ocultar ingredientes, notas y nutrientes de la comida' : 'Mostrar ingredientes, notas y nutrientes de la comida');
    summary.setAttribute('aria-expanded', String(isOpen));
    summary.setAttribute('aria-controls', details.dataset.e16DetailsId || '');
    label.textContent = actionLabel;
  }

  function decorateCard(card) {
    if (!(card instanceof HTMLElement) || card.dataset.e16CardReady === '1') return;
    const head = card.querySelector(':scope > .meal-card-head');
    const left = head?.firstElementChild;
    const name = left?.querySelector('.meal-name');
    if (!head || !left || !name) return;

    const meta = card.querySelector('.e15-meal-details-body .meal-meta, .meal-card-head .meal-meta');
    ensureGlance(card, name, meta);

    card.querySelectorAll('.meal-action').forEach(button => {
      if (!(button instanceof HTMLButtonElement)) return;
      const title = String(button.title || '').trim();
      if (title && !button.getAttribute('aria-label')) button.setAttribute('aria-label', title);
      button.type = 'button';
      button.dataset.e16Action = title.toLowerCase() || 'acción';
    });

    const details = card.querySelector(':scope > .e15-meal-details');
    if (details) {
      if (!details.id) details.id = `e16-meal-details-${String(card.dataset.mealId || Math.random().toString(36).slice(2))}`;
      const detailsBody = details.querySelector('.e15-meal-details-body');
      if (detailsBody && !detailsBody.id) detailsBody.id = `${details.id}-body`;
      details.dataset.e16DetailsId = detailsBody?.id || details.id;
      updateDetailsLabel(details);
      if (!details.dataset.e16Bound) {
        details.dataset.e16Bound = '1';
        details.addEventListener('toggle', () => {
          card.classList.toggle('e16-details-open', details.open);
          updateDetailsLabel(details);
        });
        card.classList.toggle('e16-details-open', details.open);
      }
    }
    card.dataset.e16CardReady = '1';
  }

  function decorate(root) {
    (root || $('mealList'))?.querySelectorAll?.('.meal-card').forEach(decorateCard);
  }

  function refreshLabels() {
    document.querySelectorAll('#nutritionPanel #mealList .e15-meal-details').forEach(updateDetailsLabel);
  }

  function init() {
    const list = $('mealList');
    if (!list) return;
    decorate(list);
    if (!observer) {
      observer = new MutationObserver(records => {
        const cards = new Set();
        records.forEach(record => [...record.addedNodes].forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches('.meal-card')) cards.add(node);
          node.querySelectorAll?.('.meal-card').forEach(card => cards.add(card));
          const parent = node.closest?.('.meal-card');
          if (parent) cards.add(parent);
        }));
        cards.forEach(decorateCard);
      });
      observer.observe(list, { childList: true, subtree: true });
    }
    if (window.matchMedia) {
      resizeQuery = window.matchMedia(MOBILE_QUERY);
      if (resizeQuery.addEventListener) resizeQuery.addEventListener('change', refreshLabels);
      else if (resizeQuery.addListener) resizeQuery.addListener(refreshLabels);
    }
    window.addEventListener('resize', refreshLabels, { passive: true });
    document.addEventListener('agenda:nutrition-meals-loaded', () => decorate(list));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
