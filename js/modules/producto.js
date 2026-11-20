import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, matVec, matMul, col, det, fmt, pf, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, chips, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS, basisColors } from '../core/presets.js';

const c = Math.SQRT1_2;
const PAIRS = {
  2: [
    ['Rotar y cizallar', [[0, -1], [1, 0]], [[1, 1], [0, 1]]],
    ['Escalar y rotar', [[0, -1], [1, 0]], [[2, 0], [0, 1]]],
    ['Dos rotaciones', [[c, -c], [c, c]], [[0, -1], [1, 0]]],
    ['Dos reflexiones', [[-1, 0], [0, 1]], [[0, 1], [1, 0]]],
    ['A · A (cuadrado)', [[1, 1], [0, 1]], [[1, 1], [0, 1]]],
  ],
  3: [
    ['Rotar y cizallar', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[1, 0, 1], [0, 1, 0], [0, 0, 1]]],
    ['Escalar y rotar', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[2, 0, 0], [0, 1, 0], [0, 0, 1]]],
    ['Dos rotaciones (eje z)', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]]],
    ['Rotaciones en ejes distintos', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, -1], [0, 1, 0]]],
  ],
};

const state = {
  2: { A: PAIRS[2][0][1], B: PAIRS[2][0][2], order: 'AB', x: [1, 1], s: 2 },
  3: { A: PAIRS[3][0][1], B: PAIRS[3][0][2], order: 'AB', x: [1, 1, 1], s: 2 },
};

export default {
  id: 'producto',
  title: 'Producto de matrices',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    // AB = "primero B, luego A"
    const first = () => (st.order === 'AB' ? st.B : st.A);
    const second = () => (st.order === 'AB' ? st.A : st.B);
    const names = () => (st.order === 'AB' ? ['B', 'A'] : ['A', 'B']);
    const M = () => (st.s <= 1 ? lerpMat(I, first(), st.s) : matMul(lerpMat(I, second(), st.s - 1), first()));
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.45 : 0.28 });
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    const xg = new Arrow(stage, C.x, { opacity: 0.3, radius: 0.025, label: R`\vec x` });
    const xa = new Arrow(stage, C.x, { radius: 0.045 });
    stage.addHandle({ color: C.x, get: () => st.x, set: (p) => { st.x = p; update(); } });

    // --- panel ---
    const colors = basisColors(n);
    const set = (key) => (Mx) => { stop(); st[key] = Mx; update(); };
    const mA = matEditor({ dim, colors, get: () => st.A, set: set('A'), name: 'A' });
    const mB = matEditor({ dim, colors, get: () => st.B, set: set('B'), name: 'B' });
    const pairs = h('div', { class: 'presets' }, PAIRS[dim].map(([name, A, B]) =>
      h('button', { class: 'chip', onclick: () => { stop(); st.A = A.map((r) => [...r]); st.B = B.map((r) => [...r]); run(0, 2); } }, name)));
    const order = chips([['AB', 'AB: primero B, luego A'], ['BA', 'BA: primero A, luego B']], () => st.order, (o) => { st.order = o; run(0, 2); });
    const ss = slider({ label: 's', min: 0, max: 2, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const run = (a, b) => { stop(); st.s = a; update(); stop = animate(a, b, 1300 * (b - a), (v) => { st.s = v; update(); }); };
    const b1 = button('1 · Primera', () => run(0, 1));
    const b2 = button('2 · Segunda', () => run(1, 2));
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => st.x, set: (v) => { st.x = v; update(); } });
    const phase = new Note();
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox(), cmp = new Note(), cx = new TexBox();

    panel.append(
      ...intro('Producto de matrices',
        R`Multiplicar matrices es <b>encadenar transformaciones</b>. $AB$ significa: primero aplica $B$, y al resultado aplícale $A$ (se lee de derecha a izquierda, igual que $A(B\vec x)$). Como el orden de las acciones importa, en general $AB \neq BA$.`),
      card('Matrices', h('div', { class: 'row' }, mA.el, mB.el), pairs),
      card('Orden', order.el, ss.el, buttonRow(b1, b2, button('▶ Todo', () => run(0, 2), 'primary'), button('Reiniciar', () => { stop(); st.s = 0; update(); })), phase.el),
      card('El producto', c1.el, rich(R`Cada columna del producto es la primera matriz aplicada a la columna correspondiente de la otra; cada entrada es <b>fila por columna</b>:`), c2.el, c3.el, cmp.el),
      card('Vector de prueba', ex.el, cx.el),
      details('Definición formal',
        rich(R`$(AB)_{ij} = \sum_k a_{ik}\,b_{kj}$: la fila $i$ de $A$ por la columna $j$ de $B$. Para que exista, $A$ debe tener tantas columnas como filas tiene $B$.`),
        rich(R`Propiedades: es asociativo, $(AB)C = A(BC)$, pero <b>no</b> conmutativo. Además $\det(AB) = \det A\cdot\det B$ (los factores de ${dim === 2 ? 'área' : 'volumen'} se multiplican) y $(AB)^{-1} = B^{-1}A^{-1}$ (para deshacer, se deshace en orden inverso).`),
        rich(R`Las potencias son productos repetidos: $A^2 = AA$ es aplicar $A$ dos veces.`)),
      tryList([
        'Con «Rotar y cizallar», cambia entre AB y BA: la rejilla final es distinta.',
        R`Con «Dos rotaciones», cambia el orden: el resultado es el mismo. Las rotaciones ${dim === 2 ? 'del plano' : 'alrededor del mismo eje'} conmutan.`,
        dim === 3 ? R`Con «Rotaciones en ejes distintos», el orden sí importa: gira un libro 90° en dos ejes en orden distinto y acabará en otra posición.` : R`Con «Dos reflexiones», el resultado es una rotación: reflejar dos veces equivale a girar.`,
        R`Con «A · A», mira la cizalla aplicada dos veces: $A^2$ empuja el doble.`,
      ]),
    );

    function update() {
      const Mt = M();
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, col(Mt, j)));
      xg.set(O, st.x);
      xa.set(O, matVec(Mt, st.x));
      const [f, g] = names();
      xa.setLabel(st.s < 0.5 ? R`\vec x` : st.s <= 1.5 ? R`${f}\vec x` : R`${g}${f}\vec x`);
      [mA, mB, order, ss, ex].forEach((c) => c.refresh());
      b1.textContent = `1 · Aplicar ${f}`;
      b2.textContent = `2 · Aplicar ${g}`;

      const v = st.s;
      phase.set(v > 1.995 ? 'pos' : '', v < 0.005 ? 'Estado: espacio original.'
        : v < 0.995 ? `Aplicando $${f}$ (la que va a la derecha)…`
          : v < 1.005 ? `Después de $${f}$. Ahora se aplica $${g}$ sobre lo que ya se movió.`
            : v < 1.995 ? `Aplicando $${g}$…` : `Resultado: la rejilla final es la de la matriz $${g}${f}$.`);

      const P = st.order === 'AB' ? matMul(st.A, st.B) : matMul(st.B, st.A);
      const Q = st.order === 'AB' ? matMul(st.B, st.A) : matMul(st.A, st.B);
      const [L, Rr] = st.order === 'AB' ? [st.A, st.B] : [st.B, st.A];
      const [ln, rn] = st.order === 'AB' ? ['A', 'B'] : ['B', 'A'];
      c1.set(R`${ln}${rn} = ${tm(L)}${tm(Rr)} = ${tm(P)}`);
      c2.set(R`${ln}${rn} = \big[\,${BASIS.slice(0, n).map((b, j) => clr(b.color, `${ln}\\,\\vec ${rn.toLowerCase()}_${j + 1}`)).join('\\ \\ ')}\,\big]`);
      const row0 = L[0], col0 = col(Rr, 0);
      c3.set(R`(${ln}${rn})_{11} = \text{fila 1 de } ${ln}\cdot\text{columna 1 de } ${rn} = ${row0.map((a, k) => `${pf(a)}\\cdot${pf(col0[k])}`).join(' + ')} = ${fmt(P[0][0])}`);
      const same = P.every((r, i) => r.every((x, j) => Math.abs(x - Q[i][j]) < 1e-9));
      cmp.set(same ? 'pos' : 'neg', same
        ? R`Aquí $AB = BA$: estas dos matrices <b>conmutan</b>, el orden no importa. Es la excepción, no la regla.`
        : R`$${rn}${ln} = ${tm(Q)} \neq ${ln}${rn}$: <b>el orden importa</b>. Cambia el orden arriba y mira cómo cambia la rejilla final.`);

      const y1 = matVec(Rr, st.x), y2 = matVec(L, y1);
      cx.set(R`${ln}(${rn}\vec x) = ${ln}${clr(C.x, tv(y1))} = ${clr(C.x, tv(y2))} = (${ln}${rn})\vec x\qquad \det(${ln}${rn}) = ${fmt(det(L))}\cdot${fmt(det(Rr))} = ${fmt(det(P))}`);
    }

    update();
    return { destroy: () => stop() };
  },
};

