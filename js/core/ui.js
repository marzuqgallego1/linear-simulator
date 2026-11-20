// Utilidades para construir el panel de controles y explicaciones.
import katex from 'katex';
import { fmt } from './math.js';

export const R = String.raw;

export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}

export function tex(src, display = false) {
  const e = document.createElement(display ? 'div' : 'span');
  katex.render(src, e, { displayMode: display, throwOnError: false });
  return e;
}

/** Texto con HTML y fórmulas entre $...$ */
export function setRich(e, str) {
  e.replaceChildren();
  for (const part of str.split(/(\$[^$]+\$)/g)) {
    if (!part) continue;
    if (part.length > 2 && part[0] === '$' && part.at(-1) === '$') e.append(tex(part.slice(1, -1)));
    else e.insertAdjacentHTML('beforeend', part);
  }
  return e;
}
export const rich = (str, tag = 'p', cls = '') => setRich(h(tag, cls ? { class: cls } : {}), str);

/** Bloque de fórmula que solo se vuelve a dibujar si cambia. */
export class TexBox {
  constructor() { this.el = h('div', { class: 'texbox' }); this.src = null; }
  set(src) {
    if (src === this.src) return;
    this.src = src;
    katex.render(src, this.el, { displayMode: true, throwOnError: false });
  }
}

/** Nota con color según el caso (pos / neg / zero). */
export class Note {
  constructor() { this.el = h('p', { class: 'note' }); this.key = null; }
  set(kind, str) {
    if (this.key === kind + str) return;
    this.key = kind + str;
    this.el.className = `note ${kind}`;
    setRich(this.el, str);
  }
}

export const card = (title, ...kids) => h('section', { class: 'card' }, title ? h('h3', {}, title) : null, ...kids);
export const details = (summary, ...kids) => h('details', { class: 'card' }, h('summary', {}, summary), ...kids);
export const tryList = (items) => card('Prueba esto', h('ul', { class: 'try' }, items.map((t) => rich(t, 'li'))));
export const intro = (title, lead) => [h('h2', {}, title), rich(lead, 'p', 'lead')];

export function numInput(get, set, step = 0.5) {
  const inp = h('input', { type: 'number', step, class: 'num' });
  const refresh = () => { if (document.activeElement !== inp) inp.value = fmt(get()); };
  inp.addEventListener('input', () => {
    const x = parseFloat(inp.value);
    if (Number.isFinite(x)) set(x);
  });
  inp.addEventListener('blur', refresh);
  refresh();
  return { el: inp, refresh };
}

export function vecEditor({ name, color, dim, get, set }) {
  const ins = Array.from({ length: dim }, (_, i) =>
    numInput(() => get()[i], (x) => { const v = [...get()]; v[i] = x; set(v); }));
  const el = h('div', { class: 'vec-editor' },
    h('span', { class: 'name', style: `color:${color}` }, tex(name)), '=',
    h('div', { class: 'bracket' }, ins.map((i) => i.el)));
  return { el, refresh: () => ins.forEach((i) => i.refresh()) };
}

/** Editor de matriz; cada columna se pinta del color de su vector base. */
export function matEditor({ dim, get, set, colors, name = 'A' }) {
  const cells = [];
  const grid = h('div', { class: 'bracket', style: `grid-template-columns: repeat(${dim}, auto)` });
  for (let r = 0; r < dim; r++)
    for (let c = 0; c < dim; c++) {
      const n = numInput(() => get()[r][c], (x) => { const A = get().map((row) => [...row]); A[r][c] = x; set(A); });
      n.el.style.color = colors[c];
      n.el.style.borderColor = colors[c] + '66';
      grid.append(n.el);
      cells.push(n);
    }
  const el = h('div', { class: 'mat-editor' }, h('span', { class: 'name' }, tex(name)), '=', grid);
  return { el, refresh: () => cells.forEach((c) => c.refresh()) };
}

export function slider({ label, min, max, step, get, set, format = (x) => fmt(x) }) {
  const input = h('input', { type: 'range', min, max, step });
  const out = h('span', { class: 'val' });
  input.addEventListener('input', () => set(parseFloat(input.value)));
  const refresh = () => { input.value = get(); out.textContent = format(get()); };
  refresh();
  return { el: h('label', { class: 'slider' }, tex(label), input, out), refresh, input };
}

export const button = (label, onclick, cls = '') => h('button', { class: cls, onclick }, label);

/** Selector de opciones en forma de "chips": options = [[clave, etiqueta], ...] */
export function chips(options, get, set) {
  const btns = options.map(([key, label]) => h('button', { class: 'chip', onclick: () => set(key) }, label));
  const refresh = () => btns.forEach((b, i) => b.classList.toggle('active', options[i][0] === get()));
  refresh();
  return { el: h('div', { class: 'presets' }, btns), refresh };
}
export const buttonRow = (...btns) => h('div', { class: 'btns' }, btns);

/** Anima un valor de `from` a `to`. Devuelve una función para cancelarla. */
export function animate(from, to, ms, step) {
  let cancelled = false;
  const t0 = performance.now();
  const tick = (now) => {
    if (cancelled) return;
    const k = Math.min(1, (now - t0) / ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    step(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { cancelled = true; };
}
