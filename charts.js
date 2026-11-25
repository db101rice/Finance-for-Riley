// Tiny dependency-free SVG charts with touch-friendly tooltips.

const NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 230;
const M = { top: 22, right: 14, bottom: 30, left: 50 };

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** "Nice" axis ticks from 0 to at least `max`. */
function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(v);
  return ticks;
}

function legend(container, series) {
  if (series.length < 2) return;
  const lg = document.createElement('div');
  lg.className = 'legend';
  for (const s of series) {
    const item = document.createElement('span');
    item.innerHTML = `<i style="background:${s.color}"></i>`;
    item.append(s.name);
    lg.appendChild(item);
  }
  container.appendChild(lg);
}

const tip = () => document.getElementById('tooltip');

function showTip(html, clientX, clientY) {
  const t = tip();
  t.innerHTML = html;
  t.hidden = false;
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  const x = Math.min(Math.max(8, clientX - w / 2), window.innerWidth - w - 8);
  let y = clientY - h - 16;
  if (y < 8) y = clientY + 20;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}

export function hideTip() {
  tip().hidden = true;
}

// On touch screens the tooltip stays after the finger lifts; tapping anywhere
// else (or navigating) clears it.
let resetActive = null;
export function clearActive() {
  if (resetActive) resetActive();
  resetActive = null;
  hideTip();
}
document.addEventListener('pointerdown', (ev) => {
  if (!(ev.target instanceof Element && ev.target.classList.contains('hit'))) clearActive();
});

function bindHover(hit, move, reset) {
  const start = (ev) => {
    if (resetActive && resetActive !== reset) resetActive();
    resetActive = reset;
    move(ev);
  };
  hit.addEventListener('pointerdown', start);
  hit.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse') resetActive = reset;
    move(ev);
  });
  hit.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'mouse') clearActive();
  });
}

function axes(svg, { width, yMax, yFormat, xTicks }) {
  const plotH = HEIGHT - M.top - M.bottom;
  const ticks = niceTicks(yMax);
  const top = ticks[ticks.length - 1];
  const y = (v) => M.top + plotH - (v / top) * plotH;
  const g = el('g', { class: 'axis' }, svg);
  for (const t of ticks) {
    el('line', { x1: M.left, x2: width - M.right, y1: y(t), y2: y(t), class: t === 0 ? 'baseline' : 'grid' }, g);
    const label = el('text', { x: M.left - 6, y: y(t) + 4, 'text-anchor': 'end' }, g);
    label.textContent = yFormat(t);
  }
  for (const { x, label } of xTicks) {
    const t = el('text', { x, y: HEIGHT - 8, 'text-anchor': 'middle' }, g);
    t.textContent = label;
  }
  return y;
}

/**
 * Multi-series line chart.
 * opts: { xs: number[], series: [{ name, color, values }], yFormat, xFormat,
 *         tipTitle(x), directLabels }
 */
export function lineChart(container, opts) {
  container.innerHTML = '';
  legend(container, opts.series);
  const width = Math.max(280, container.clientWidth);
  const svg = el('svg', { width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, class: 'chart', role: 'img' });
  svg.setAttribute('aria-label', opts.ariaLabel || 'Chart');
  container.appendChild(svg);

  const { xs, series } = opts;
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const plotW = width - M.left - M.right;
  const x = (v) => M.left + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const yMax = Math.max(...series.flatMap((s) => s.values.filter((v) => v != null)));

  // Round tick spacing (e.g. every 10 years), at most ~6 ticks.
  const unit = opts.xUnit || 1;
  const span = (xMax - xMin) / unit;
  const step = unit * ([1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 5) || 100);
  const xTicks = [];
  for (let v = xMin; v <= xMax + 1e-9; v += step) xTicks.push({ x: x(v), label: opts.xFormat(v) });
  const y = axes(svg, { width, yMax, yFormat: opts.yFormat, xTicks });

  for (const s of series) {
    const pts = s.values.map((v, i) => (v == null ? null : `${x(xs[i]).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
    el('polyline', { points: pts.join(' '), fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.faded ? 0.45 : 1 }, svg);
  }

  if (opts.directLabels) {
    // Label each line's end value, nudged apart so labels never overlap.
    const ends = series.map((s) => {
      let i = s.values.length - 1;
      while (i > 0 && s.values[i] == null) i--;
      return { s, py: y(s.values[i]), v: s.values[i] };
    }).sort((a, b) => a.py - b.py);
    let last = -Infinity;
    for (const e of ends) {
      const ly = Math.max(e.py - 8, last + 16, M.top - 6);
      last = ly;
      const t = el('text', { x: width - M.right, y: ly, 'text-anchor': 'end', class: 'direct-label' }, svg);
      t.textContent = opts.yFormat(e.v);
    }
  }

  // Hover / touch layer: crosshair + dots + tooltip.
  const cross = el('line', { y1: M.top, y2: HEIGHT - M.bottom, class: 'crosshair', visibility: 'hidden' }, svg);
  const dots = series.map((s) => el('circle', { r: 5, fill: s.color, class: 'dot', visibility: 'hidden' }, svg));
  const hit = el('rect', { x: M.left, y: 0, width: plotW, height: HEIGHT, fill: 'transparent', class: 'hit' }, svg);

  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const frac = Math.min(1, Math.max(0, (px - M.left) / plotW));
    const i = Math.round(frac * (xs.length - 1));
    const cx = x(xs[i]);
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');
    let rows = '';
    series.forEach((s, k) => {
      const v = s.values[i];
      if (v == null) {
        dots[k].setAttribute('visibility', 'hidden');
        return;
      }
      dots[k].setAttribute('cx', cx);
      dots[k].setAttribute('cy', y(v));
      dots[k].setAttribute('visibility', 'visible');
      rows += `<div class="row"><i style="background:${s.color}"></i><span>${s.name}</span><b>${opts.tipFormat ? opts.tipFormat(v) : opts.yFormat(v)}</b></div>`;
    });
    showTip(`<div class="tip-title">${opts.tipTitle(xs[i])}</div>${rows}`, rect.left + cx, rect.top + M.top);
  };
  bindHover(hit, move, () => {
    cross.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
  });
}

/** Path for a rect whose top corners are rounded. */
function topRounded(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Stacked bar chart (bottom segment first).
 * opts: { categories: label[], series: [{ name, color, values }], yFormat, tipTitle(i), tipFormat }
 */
export function stackedBars(container, opts) {
  container.innerHTML = '';
  legend(container, opts.series);
  const width = Math.max(280, container.clientWidth);
  const svg = el('svg', { width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, class: 'chart', role: 'img' });
  svg.setAttribute('aria-label', opts.ariaLabel || 'Chart');
  container.appendChild(svg);

  const n = opts.categories.length;
  const plotW = width - M.left - M.right;
  const slot = plotW / n;
  const gap = Math.min(8, Math.max(2, slot * 0.25));
  const barW = Math.max(1, slot - gap);
  const totals = opts.categories.map((_, i) => opts.series.reduce((a, s) => a + s.values[i], 0));
  const every = Math.ceil(n / 6);
  const xTicks = opts.categories
    .map((label, i) => ({ x: M.left + slot * i + slot / 2, label, i }))
    .filter(({ i }) => i % every === 0 || i === n - 1)
    .filter(({ i }, k, arr) => i !== n - 1 || k === 0 || i - arr[k - 1].i >= every * 0.6);
  const y = axes(svg, { width, yMax: Math.max(...totals), yFormat: opts.yFormat, xTicks });
  const base = y(0);

  const bars = [];
  for (let i = 0; i < n; i++) {
    const bx = M.left + slot * i + gap / 2;
    let acc = 0;
    const group = el('g', { class: 'bar' }, svg);
    opts.series.forEach((s, k) => {
      const v = s.values[i];
      if (v <= 0) return;
      const y0 = y(acc);
      const y1 = y(acc + v);
      acc += v;
      const isTop = opts.series.slice(k + 1).every((t) => t.values[i] <= 0);
      // 2px surface gap between stacked segments.
      const segBottom = k === 0 ? y0 : y0 - 1;
      const segTop = isTop ? y1 : y1 + 1;
      const h = Math.max(0, segBottom - segTop);
      if (isTop) el('path', { d: topRounded(bx, segTop, barW, h, Math.min(4, barW / 2)), fill: s.color }, group);
      else el('rect', { x: bx, y: segTop, width: barW, height: h, fill: s.color }, group);
    });
    bars.push(group);
  }
  el('line', { x1: M.left, x2: width - M.right, y1: base, y2: base, class: 'baseline' }, svg);

  const hit = el('rect', { x: M.left, y: 0, width: plotW, height: HEIGHT, fill: 'transparent', class: 'hit' }, svg);
  let active = -1;
  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor((ev.clientX - rect.left - M.left) / slot)));
    if (i !== active) {
      bars.forEach((b, k) => b.setAttribute('opacity', k === i ? 1 : 0.4));
      active = i;
    }
    let rows = '';
    for (const s of [...opts.series].reverse()) {
      rows += `<div class="row"><i style="background:${s.color}"></i><span>${s.name}</span><b>${opts.tipFormat(s.values[i])}</b></div>`;
    }
    showTip(`<div class="tip-title">${opts.tipTitle(i)}</div>${rows}`, rect.left + M.left + slot * i + slot / 2, rect.top + y(totals[i]));
  };
  bindHover(hit, move, () => {
    bars.forEach((b) => b.setAttribute('opacity', 1));
    active = -1;
  });
}
