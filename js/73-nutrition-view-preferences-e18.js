/* Agenda FICH — E18: preferencias locales de presentación de Alimentación.
   Solo modifica cómo se muestran los detalles y ofrece un acceso opcional a la última herramienta usada.
   No guarda datos nutricionales ni realiza llamadas a Supabase. */
(function () {
  'use strict';
  if (document.documentElement.dataset.nutritionE18Bound === '1') return;
  document.documentElement.dataset.nutritionE18Bound = '1';

  const $ = id => document.getElementById(id);
  const MOBILE_QUERY = '(max-width: 700px)';
  const STORAGE_PREFIX = 'agendaNutritionViewPrefsE18:';
  const DEFAULTS = Object.freeze({ detailMode: 'auto', rememberLastTool: false, lastToolId: '', lastToolLabel: '' });
  let prefs = { ...DEFAULTS };
  let activeOwner = 'guest';
  let overlay = null;
  let trigger = null;
  let contentObserver = null;
  let applying = false;

  function currentUserId() {
    try { return typeof currentUser !== 'undefined' && currentUser?.id ? String(currentUser.id) : ''; }
    catch (_) { return ''; }
  }
  function ownerKey() { return currentUserId() || 'guest'; }
  function storageKey(owner = activeOwner) { return `${STORAGE_PREFIX}${owner || 'guest'}`; }
  function isMobile() {
    return window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : window.innerWidth <= 700;
  }
  function validMode(value) { return ['auto', 'compact', 'detailed'].includes(value) ? value : DEFAULTS.detailMode; }
  function normalizedPrefs(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      detailMode: validMode(source.detailMode),
      rememberLastTool: source.rememberLastTool === true,
      lastToolId: typeof source.lastToolId === 'string' && source.lastToolId.length <= 180 ? source.lastToolId : '',
      lastToolLabel: typeof source.lastToolLabel === 'string' ? source.lastToolLabel.slice(0, 140) : ''
    };
  }
  function readPrefs(owner) {
    try {
      const raw = localStorage.getItem(storageKey(owner));
      return normalizedPrefs(raw ? JSON.parse(raw) : DEFAULTS);
    } catch (_) { return { ...DEFAULTS }; }
  }
  function writePrefs(owner, value) {
    try {
      localStorage.setItem(storageKey(owner), JSON.stringify(normalizedPrefs(value)));
      return true;
    } catch (_) { return false; }
  }
  function detailOpenForMode() {
    if (prefs.detailMode === 'compact') return false;
    if (prefs.detailMode === 'detailed') return true;
    return !isMobile();
  }
  function applyCardPreference(card) {
    if (applying || !(card instanceof Element)) return;
    const open = detailOpenForMode();
    card.querySelectorAll('.e15-meal-details').forEach(details => { details.open = open; });
  }
  function applyDisclosurePreferences() {
    if (applying) return;
    applying = true;
    const open = detailOpenForMode();
    const daily = $('nutritionDetailsDisclosure');
    if (daily) daily.open = open;
    document.querySelectorAll('#nutritionPanel #mealList .meal-card').forEach(card => {
      card.querySelectorAll('.e15-meal-details').forEach(details => { details.open = open; });
    });
    applying = false;
  }
  function applyAfterRender() { window.requestAnimationFrame(() => applyDisclosurePreferences()); }
  function applyNewCards(records) {
    const cards = new Set();
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches('.meal-card')) cards.add(node);
      node.querySelectorAll?.('.meal-card').forEach(card => cards.add(card));
      const parent = node.closest?.('.meal-card');
      if (parent) cards.add(parent);
    }));
    if (!cards.size) return;
    window.requestAnimationFrame(() => cards.forEach(applyCardPreference));
  }

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function makeRadioOption(name, value, title, description, selected) {
    const label = createNode('label', 'e18-view-choice');
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = name; radio.value = value; radio.checked = selected;
    const copy = createNode('span', 'e18-view-choice-copy');
    copy.append(createNode('strong', '', title), createNode('small', '', description));
    label.append(radio, copy);
    return label;
  }
  function closeDialog() {
    if (!overlay) return;
    overlay.remove(); overlay = null;
    document.body.classList.remove('e18-view-dialog-open');
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  }
  function openDialog() {
    if (overlay) return;
    const panel = $('nutritionPanel');
    if (!panel) return;
    trigger = $('nutritionE18ViewPrefsBtn');
    overlay = createNode('div', 'e18-view-preferences-overlay');
    const dialog = createNode('section', 'e18-view-preferences-dialog');
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'e18ViewPreferencesTitle');
    dialog.setAttribute('aria-describedby', 'e18ViewPreferencesIntro'); dialog.tabIndex = -1;

    const header = createNode('header', 'e18-view-preferences-head');
    const heading = createNode('div', '');
    heading.append(createNode('span', 'e18-view-eyebrow', 'TU EXPERIENCIA'), createNode('h2', '', 'Personalizar vista'), createNode('p', '', 'Elegí cuánto detalle querés ver al abrir Alimentación. Podés cambiarlo cuando quieras.'));
    heading.lastChild.id = 'e18ViewPreferencesIntro';
    heading.querySelector('h2').id = 'e18ViewPreferencesTitle';
    const close = createNode('button', 'e18-view-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Cerrar preferencias');
    close.addEventListener('click', closeDialog);
    header.append(heading, close);

    const body = createNode('div', 'e18-view-preferences-body');
    const modeFieldset = createNode('fieldset', 'e18-view-fieldset');
    modeFieldset.append(createNode('legend', '', 'Detalle de comidas y nutrientes'));
    modeFieldset.append(
      makeRadioOption('e18DetailMode', 'auto', 'Adaptable', 'En celular muestra un resumen; en pantallas grandes abre más detalles.', prefs.detailMode === 'auto'),
      makeRadioOption('e18DetailMode', 'compact', 'Compacta', 'Mantiene ingredientes y nutrientes plegados hasta que los abras.', prefs.detailMode === 'compact'),
      makeRadioOption('e18DetailMode', 'detailed', 'Completa', 'Abre los detalles nutricionales automáticamente; las listas pueden ser más largas.', prefs.detailMode === 'detailed')
    );
    const lastToolLabel = createNode('label', 'e18-view-remember');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'e18RememberLastTool'; checkbox.checked = prefs.rememberLastTool;
    const checkboxCopy = createNode('span', 'e18-view-remember-copy');
    checkboxCopy.append(createNode('strong', '', 'Recordar la última herramienta usada'), createNode('small', '', 'Muestra un atajo dentro de «Más herramientas» para volver a abrirla.'));
    lastToolLabel.append(checkbox, checkboxCopy);
    const privacy = createNode('p', 'e18-view-note', 'Estas preferencias se guardan en este navegador y se separan por cuenta. No cambian tus comidas, objetivos ni datos nutricionales, y no se sincronizan con otros dispositivos.');
    body.append(modeFieldset, lastToolLabel, privacy);

    const status = createNode('p', 'e18-view-preferences-status', 'Los cambios se aplican al guardar.');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const footer = createNode('footer', 'e18-view-preferences-footer');
    const reset = createNode('button', 'e18-view-button secondary', 'Restablecer'); reset.type = 'button';
    const cancel = createNode('button', 'e18-view-button secondary', 'Cancelar'); cancel.type = 'button'; cancel.addEventListener('click', closeDialog);
    const save = createNode('button', 'e18-view-button primary', 'Guardar preferencias'); save.type = 'button';
    reset.addEventListener('click', () => {
      dialog.querySelector('input[name="e18DetailMode"][value="auto"]').checked = true;
      dialog.querySelector('input[name="e18RememberLastTool"]').checked = false;
      status.textContent = 'Se restablecerán los valores predeterminados al guardar.';
    });
    save.addEventListener('click', () => {
      const owner = ownerKey();
      const mode = dialog.querySelector('input[name="e18DetailMode"]:checked')?.value || 'auto';
      const remember = !!dialog.querySelector('input[name="e18RememberLastTool"]')?.checked;
      const next = normalizedPrefs({
        ...prefs,
        detailMode: mode,
        rememberLastTool: remember,
        lastToolId: remember ? prefs.lastToolId : '',
        lastToolLabel: remember ? prefs.lastToolLabel : ''
      });
      if (!writePrefs(owner, next)) {
        status.textContent = 'No se pudieron guardar las preferencias en este navegador. Revisá el espacio disponible o la configuración de privacidad.';
        return;
      }
      activeOwner = owner; prefs = next;
      applyDisclosurePreferences(); syncLastToolShortcut();
      status.textContent = 'Preferencias guardadas en este dispositivo.';
      save.textContent = 'Guardado ✓';
      window.setTimeout(closeDialog, 700);
    });

    dialog.append(header, body, status, footer);
    footer.append(reset, cancel, save);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeDialog(); });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key !== 'Tab') return;
      const focusables = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(node => node.offsetParent !== null);
      if (!focusables.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.body.appendChild(overlay); document.body.classList.add('e18-view-dialog-open');
    window.requestAnimationFrame(() => (dialog.querySelector('input[name="e18DetailMode"]:checked') || close).focus({ preventScroll: true }));
  }

  function ensureSettingsButton() {
    const actions = $('nutritionPanel')?.querySelector('.nutrition-actions');
    if (!actions || $('nutritionE18ViewPrefsBtn')) return;
    const button = createNode('button', 'small-btn nutrition-week-tool-btn e18-view-preferences-trigger', '⚙ Personalizar vista');
    button.id = 'nutritionE18ViewPrefsBtn'; button.type = 'button';
    button.title = 'Elegir cómo se muestran los detalles y recordar herramientas';
    button.setAttribute('aria-label', 'Personalizar vista de Alimentación');
    button.addEventListener('click', openDialog);
    actions.appendChild(button);
  }

  function ensureLastToolSlot() {
    const hub = $('nutritionMoreTools');
    const content = hub?.querySelector('.e13-tools-content');
    if (!hub || !content) return null;
    let slot = hub.querySelector(':scope > .e18-last-tool-spotlight');
    if (!slot) {
      slot = createNode('div', 'e18-last-tool-spotlight'); slot.hidden = true;
      const label = createNode('span', 'e18-last-tool-label', 'Continuar');
      const button = createNode('button', 'e18-last-tool-button', '');
      button.id = 'nutritionE18LastToolShortcut'; button.type = 'button';
      button.addEventListener('click', () => {
        const original = prefs.lastToolId ? $(prefs.lastToolId) : null;
        if (original && original.isConnected && original !== button) {
          hub.open = true; original.click();
        } else {
          slot.hidden = true;
        }
      });
      slot.append(label, button);
      content.insertAdjacentElement('afterend', slot);
    }
    return slot;
  }
  function syncLastToolShortcut() {
    const slot = ensureLastToolSlot();
    if (!slot) return;
    const shortcut = $('nutritionE18LastToolShortcut');
    const original = prefs.lastToolId ? $(prefs.lastToolId) : null;
    const validOriginal = original && original !== shortcut && original.closest('#nutritionMoreTools .e15-tool-group-actions');
    if (!prefs.rememberLastTool || !prefs.lastToolId || !validOriginal) { slot.hidden = true; return; }
    const currentLabel = String(original.getAttribute('aria-label') || original.title || original.textContent || prefs.lastToolLabel).replace(/\s+/g, ' ').trim().slice(0, 120);
    shortcut.textContent = `↗ ${currentLabel || 'Abrir herramienta'}`;
    shortcut.setAttribute('aria-label', `Volver a abrir la última herramienta: ${currentLabel || prefs.lastToolLabel}`);
    slot.hidden = false;
  }
  function saveLastTool(button) {
    syncAccount();
    if (!prefs.rememberLastTool || !button?.id || button.id === 'nutritionE18ViewPrefsBtn' || button.id === 'nutritionE18LastToolShortcut') return;
    const next = normalizedPrefs({ ...prefs, lastToolId: button.id, lastToolLabel: String(button.getAttribute('aria-label') || button.title || button.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) });
    if (writePrefs(activeOwner, next)) prefs = next;
    syncLastToolShortcut();
  }
  function handleToolClick(event) {
    const button = event.target?.closest?.('#nutritionMoreTools .e15-tool-group-actions > button');
    if (button) saveLastTool(button);
  }

  function syncAccount() {
    const owner = ownerKey();
    if (owner === activeOwner) return;
    activeOwner = owner; prefs = readPrefs(owner);
    applyDisclosurePreferences(); syncLastToolShortcut();
  }

  function init() {
    const panel = $('nutritionPanel');
    if (!panel || document.documentElement.dataset.nutritionE18Ready === '1') return;
    document.documentElement.dataset.nutritionE18Ready = '1';
    activeOwner = ownerKey(); prefs = readPrefs(activeOwner);
    ensureSettingsButton();
    applyDisclosurePreferences();
    const list = $('mealList');
    if (list) {
      const observer = new MutationObserver(records => applyNewCards(records));
      observer.observe(list, { childList: true, subtree: true });
    }
    document.addEventListener('agenda:nutrition-meals-loaded', applyAfterRender);
    document.addEventListener('agenda:nutrition-day-changed', applyAfterRender);
    document.addEventListener('click', handleToolClick, true);
    const hub = $('nutritionMoreTools');
    if (hub) {
      contentObserver = new MutationObserver(records => {
        // Ignore our own shortcut text/visibility mutations to prevent an observer feedback loop.
        const meaningful = records.some(record => !(record.target instanceof Element) || !record.target.closest('.e18-last-tool-spotlight'));
        if (meaningful) syncLastToolShortcut();
      });
      contentObserver.observe(hub, { childList: true, subtree: true });
    }
    if (window.sb?.auth?.onAuthStateChange && !window.__agendaNutritionE18AuthBound) {
      window.__agendaNutritionE18AuthBound = true;
      window.sb.auth.onAuthStateChange(() => window.setTimeout(syncAccount, 20));
    }
    document.addEventListener('agenda:nutrition-preferences-restored', () => window.setTimeout(syncAccount, 0));
    window.addEventListener('storage', event => {
      if (event.key === storageKey(activeOwner)) { prefs = readPrefs(activeOwner); applyDisclosurePreferences(); syncLastToolShortcut(); }
    });
    // El botón se añade de forma dinámica al hub; se sincroniza tras los observadores E13/E15.
    window.setTimeout(syncLastToolShortcut, 50);
  }

  window.AgendaNutritionViewPreferences = {
    getPreferences: () => ({ ...prefs }),
    open: openDialog,
    apply: applyDisclosurePreferences
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
