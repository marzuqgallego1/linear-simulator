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

/** Editor de matriz (cuadrada o de rows × cols); cada columna se pinta del color de su vector base. */
export function matEditor({ dim, rows = dim, cols = dim, get, set, colors = [], name = 'A' }) {
  const cells = [];
  const grid = h('div', { class: 'bracket', style: `grid-template-columns: repeat(${cols}, auto)` });
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const n = numInput(() => get()[r][c], (x) => { const A = get().map((row) => [...row]); A[r][c] = x; set(A); });
      if (colors[c]) {
        n.el.style.color = colors[c];
        n.el.style.borderColor = colors[c] + '66';
      }
      grid.append(n.el);
      cells.push(n);
    }
  const el = h('div', { class: 'mat-editor' }, h('span', { class: 'name' }, tex(name)), '=', grid);
  return { el, refresh: () => cells.forEach((c) => c.refresh()) };
}

/** Selector de tamaño «filas × columnas» para una matriz. */
export function sizePicker({ max, get, set }) {
  const mk = (k) => {
    const sel = h('select', { class: 'size', onchange: () => { const v = [...get()]; v[k] = +sel.value; set(v); } },
      Array.from({ length: max }, (_, i) => h('option', { value: i + 1 }, i + 1)));
    return sel;
  };
  const a = mk(0), b = mk(1);
  const refresh = () => { [a.value, b.value] = get().map(String); };
  refresh();
  return { el: h('span', { class: 'size-picker' }, a, '×', b), refresh };
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

// ---------- Pestañas y procedimientos paso a paso ----------

/** Pestañas «Explorar» / «Cómo se calcula». Devuelve la barra y un contenedor por pestaña. */
export function tabs(options, get, set) {
  const btns = options.map(([key, label]) => h('button', { class: 'tab', onclick: () => set(key) }, label));
  const panes = Object.fromEntries(options.map(([key]) => [key, h('div', { class: 'tab-pane' })]));
  const refresh = () => {
    btns.forEach((b, i) => b.classList.toggle('active', options[i][0] === get()));
    for (const [k, el] of Object.entries(panes)) el.style.display = k === get() ? '' : 'none';
  };
  refresh();
  return { el: h('div', { class: 'tabs' }, btns), panes, refresh };
}

/**
 * Procedimiento paso a paso. Cada paso: { title, text?, tex?: string | string[], why?, note?: [tipo, texto] }.
 * onChange(i, desde) se llama al cambiar de paso (para sincronizar la escena).
 */
export class Stepper {
  constructor(onChange) {
    this.i = 0;
    this.steps = [];
    this.onChange = onChange;
    this.key = null;
    this.prev = button('◀ Anterior', () => this.go(this.i - 1));
    this.next = button('Siguiente ▶', () => this.go(this.i + 1), 'primary');
    this.count = h('span', { class: 'step-count' });
    this.title = h('h4', { class: 'step-title' });
    this.body = h('div', { class: 'step-body' });
    this.list = h('ol', { class: 'step-list' });
    this.el = h('section', { class: 'card stepper' }, h('div', { class: 'step-nav' }, this.prev, this.count, this.next), this.title, this.body);
    this.listEl = card('Todos los pasos', this.list);
  }
  set(steps, index = this.i) {
    this.steps = steps;
    this.i = Math.max(0, Math.min(index, steps.length - 1));
    this.render();
  }
  go(i) {
    if (i < 0 || i >= this.steps.length || i === this.i) return;
    const from = this.i;
    this.i = i;
    this.render();
    this.onChange?.(i, from);
  }
  render() {
    const s = this.steps[this.i];
    if (!s) return;
    const key = JSON.stringify([this.i, this.steps.map((x) => x.title), s]);
    if (key === this.key) return;
    this.key = key;
    this.count.textContent = `Paso ${this.i + 1} de ${this.steps.length}`;
    this.prev.disabled = this.i === 0;
    this.next.disabled = this.i === this.steps.length - 1;
    setRich(this.title, s.title);
    const kids = [];
    if (s.text) kids.push(rich(s.text));
    for (const t of [].concat(s.tex ?? [])) { const b = new TexBox(); b.set(t); kids.push(b.el); }
    if (s.note) { const n = new Note(); n.set(...s.note); kids.push(n.el); }
    if (s.why) kids.push(setRich(h('div', { class: 'step-why' }), `<b>Por qué:</b> ${s.why}`));
    this.body.replaceChildren(...kids);
    this.list.replaceChildren(...this.steps.map((x, k) =>
      setRich(h('li', { class: k === this.i ? 'active' : '', onclick: () => this.go(k) }), x.title)));
  }
}
