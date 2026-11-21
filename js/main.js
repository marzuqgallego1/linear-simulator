import { Stage } from './core/stage.js';
import { h } from './core/ui.js';
import vectores from './modules/vectores.js';
import punto from './modules/punto.js';
import cruz from './modules/cruz.js';
import funciones from './modules/funciones.js';
import transformacion from './modules/transformacion.js';
import determinante from './modules/determinante.js';
import inversa from './modules/inversa.js';
import rectas from './modules/rectas.js';
import planos from './modules/planos.js';
import intersecciones from './modules/intersecciones.js';
import sistemas from './modules/sistemas.js';
import base from './modules/base.js';
import autovalores from './modules/autovalores.js';
import diagonalizacion from './modules/diagonalizacion.js';
import proyecciones from './modules/proyecciones.js';
import gramschmidt from './modules/gramschmidt.js';
import minimos from './modules/minimos.js';
import opvectores from './modules/opvectores.js';
import sumamat from './modules/sumamat.js';
import producto from './modules/producto.js';
import transpuesta from './modules/transpuesta.js';
import nucleo from './modules/nucleo.js';
import lu from './modules/lu.js';
import qr from './modules/qr.js';
import svd from './modules/svd.js';
import cuadraticas from './modules/cuadraticas.js';

// Orden del curso. Para añadir un tema: crear el módulo y agregarlo aquí.
const SECTIONS = [
  ['Vectores', [opvectores, vectores, punto, cruz]],
  ['Geometría y sistemas', [rectas, planos, intersecciones, sistemas]],
  ['Matrices', [transformacion, sumamat, producto, transpuesta, determinante, inversa, nucleo, lu, base, autovalores, diagonalizacion, funciones]],
  ['Ortogonalidad', [proyecciones, gramschmidt, qr, minimos, svd, cuadraticas]],
];
const MODULES = SECTIONS.flatMap(([, mods]) => mods);

const stage = new Stage(document.getElementById('stage'));
window.stage = stage; // útil para depurar desde la consola
const panel = document.getElementById('panel');
const nav = document.getElementById('nav');
const hint = document.getElementById('hint');
const dimBtns = [...document.querySelectorAll('[data-dim]')];
const dimPref = {};
let active = null;
let current = null;

let k = 0;
for (const [name, mods] of SECTIONS) {
  nav.append(h('div', { class: 'group' }, name));
  for (const m of mods)
    nav.append(h('a', { href: `#${m.id}`, 'data-id': m.id }, h('span', { class: 'num' }, ++k), h('span', {}, m.title)));
}

function mount(mod, dim) {
  current?.destroy?.();
  stage.clear();
  stage.setDim(dim);
  panel.replaceChildren();
  panel.scrollTop = 0;
  active = mod;
  dimPref[mod.id] = dim;
  current = mod.mount({ stage, panel, dim });

  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === mod.id));
  dimBtns.forEach((b) => {
    const d = Number(b.dataset.dim);
    b.classList.toggle('active', d === dim);
    b.disabled = !mod.dims.includes(d);
    b.title = b.disabled ? 'Este tema solo existe en ' + mod.dims.map((x) => `${x}D`).join(' / ') : '';
  });
  hint.textContent = dim === 2
    ? 'Arrastra las esferas · Arrastra el fondo para mover · Rueda: zoom'
    : 'Arrastra las esferas · Arrastra el fondo para girar · Clic derecho: mover · Rueda: zoom';
  document.title = `${mod.title} · Álgebra lineal visual`;
}

function route() {
  const mod = MODULES.find((m) => m.id === location.hash.slice(1)) ?? MODULES[0];
  mount(mod, dimPref[mod.id] ?? mod.dims[0]);
}

window.addEventListener('hashchange', route);
dimBtns.forEach((b) => b.addEventListener('click', () => mount(active, Number(b.dataset.dim))));
document.getElementById('snap').addEventListener('change', (e) => { stage.snap = parseFloat(e.target.value); });
document.getElementById('recenter').addEventListener('click', () => stage.resetView());
route();
