// Vectores base y matrices de ejemplo compartidos por los módulos de matrices.
import { C } from './stage.js';
import { h, R } from './ui.js';

const c = Math.SQRT1_2;

export const BASIS = [
  { color: C.i, tex: R`\hat{\imath}` },
  { color: C.j, tex: R`\hat{\jmath}` },
  { color: C.k, tex: R`\hat{k}` },
];
export const basisColors = (n) => BASIS.slice(0, n).map((b) => b.color);

export const PRESETS = {
  2: [
    ['Identidad', [[1, 0], [0, 1]]],
    ['Rotación 90°', [[0, -1], [1, 0]]],
    ['Rotación 45°', [[c, -c], [c, c]]],
    ['Escalado', [[2, 0], [0, 0.5]]],
    ['Cizalla', [[1, 1], [0, 1]]],
    ['Reflexión', [[-1, 0], [0, 1]]],
    ['Singular', [[1, 2], [0.5, 1]]],
  ],
  3: [
    ['Identidad', [[1, 0, 0], [0, 1, 0], [0, 0, 1]]],
    ['Rotación 90° (eje z)', [[0, -1, 0], [1, 0, 0], [0, 0, 1]]],
    ['Escalado', [[2, 0, 0], [0, 1, 0], [0, 0, 0.5]]],
    ['Cizalla', [[1, 0, 1], [0, 1, 0], [0, 0, 1]]],
    ['Reflexión (plano xy)', [[1, 0, 0], [0, 1, 0], [0, 0, -1]]],
    ['Singular', [[1, 0, 1], [0, 1, 1], [0, 0, 0]]],
  ],
};

export const presetButtons = (dim, onPick) =>
  h('div', { class: 'presets' },
    PRESETS[dim].map(([name, M]) =>
      h('button', { class: 'chip', onclick: () => onPick(M.map((r) => [...r])) }, name)));
