/* Agenda FICH — E23: alinea el resumen nutricional secundario con los estados de calidad.
   Módulo aislado: solo observa y actualiza #v83NutritionSuite dentro de Alimentación. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const METRICS = [
    { key: 'calories', id: 'v83Cal', label: '🔥 Calorías consumidas', unit: 'kcal' },
    { key: 'protein', id: 'v83Pro', label: '🥩 Proteína consumida', unit: 'g' },
    { key: 'carbs', id: 'v83Car', label: '🍚 Carbohidratos consumidos', unit: 'g' },
    { key: 'fat', id: 'v83Fat', label: '🥑 Grasas consumidas', unit: 'g' }
  ];
  let observer = null;

  function currentDay() {
    try { return Number(typeof nutritionDay !== 'undefined' ? nutritionDay : 0) || 0; }
    catch (_) { return 0; }
  }

  function round(value, key) {
    const amount = Number(value) || 0;
    return key === 'calories' ? String(Math.round(amount)) : String(Math.round(amount * 10) / 10);
  }

  function escape(value) {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }

  function totals() {
    return window.AgendaNutritionLiveSummary?.getConsumedTotals?.(currentDay()) || null;
  }

  function goals() {
    try {
      if (typeof nutritionGoals !== 'undefined' && nutritionGoals) return nutritionGoals;
    } catch (_) {}
    return { calories: 2500, protein: 160, carbs: 300, fat: 70 };
  }

  function apply() {
    const host = $('v83NutritionSuite');
    const summary = totals();
    if (!host || !summary) return;

    const targets = goals();
    const incomplete = summary.incomplete || {};
    const signature = JSON.stringify({
      day: currentDay(),
      values: METRICS.map(metric => [metric.key, summary[metric.key], !!incomplete[metric.key], Number(targets[metric.key]) || 0])
    });
    if (host.dataset.e23NutritionSignature === signature) return;
    host.dataset.e23NutritionSignature = signature;

    METRICS.forEach(metric => {
      const value = $(metric.id);
      if (!value) return;
      const unknown = !!incomplete[metric.key];
      value.textContent = unknown ? '—' : round(summary[metric.key], metric.key);
      value.setAttribute('aria-label', unknown
        ? `${metric.label.replace(/^[^ ]+\s*/, '')}: datos incompletos`
        : `${metric.label.replace(/^[^ ]+\s*/, '')}: ${round(summary[metric.key], metric.key)} ${metric.unit}`);
      value.title = unknown ? 'No se puede calcular porque falta información de al menos un alimento.' : '';
    });

    const bars = $('v83NutriBars');
    if (!bars) return;
    const markup = METRICS.map(metric => {
      const target = Math.max(0, Number(targets[metric.key]) || 0);
      const unknown = !!incomplete[metric.key];
      if (unknown) {
        return `<div class="v83-nutrition-unknown" role="note"><div><span>${escape(metric.label)}</span><strong>Datos incompletos</strong></div><small>Completá la información del alimento para consultar el progreso hacia ${round(target, metric.key)} ${metric.unit}.</small></div>`;
      }
      const amount = Number(summary[metric.key]) || 0;
      const pct = target > 0 ? Math.min(100, amount / target * 100) : 0;
      return `<div class="v83-nutrition-metric"><div style="display:flex;justify-content:space-between;gap:8px;font-size:9px"><span>${escape(metric.label)}</span><strong>${round(amount, metric.key)} / ${round(target, metric.key)} ${metric.unit}</strong></div><div class="v83-meter"><span style="width:${pct}%"></span></div></div>`;
    }).join('');
    if (bars.innerHTML !== markup) bars.innerHTML = markup;
  }

  function boot() {
    document.addEventListener('agenda:nutrition-consumed-summary-updated', apply);
    if (document.body && typeof MutationObserver === 'function') {
      observer = new MutationObserver(() => apply());
      observer.observe(document.body, { childList: true, subtree: true });
    }
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
