import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, matVec, matMul, col, dot, det, fmt, pf, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, chips, TexBox, Note, rich, setRich, animate } from '../core/ui.js';
import { BASIS, basisColors } from '../core/presets.js';

const c = Math.SQRT1_2;
const PRE = {
  2: [
    ['Cizalla', [[1, 1], [0, 1]]],
    ['Simétrica', [[2, 1], [1, 2]]],
    ['Rotación 45°', [[c, -c], [c, c]]],
    ['Reflexión', [[0, 1], [1, 0]]],
    ['General', [[1, 2], [-1, 1]]],
  ],
  3: [
    ['Cizalla', [[1, 1, 0], [0, 1, 0], [0, 0, 1]]],
    ['Simétrica', [[2, 1, 0], [1, 2, 1], [0, 1, 2]]],
    ['Rotación 90° (z)', [[0, -1, 0], [1, 0, 0], [0, 0, 1]]],
    ['Reflexión', [[1, 0, 0], [0, 1, 0], [0, 0, -1]]],
    ['General', [[1, 2, 0], [0, 1, 1], [1, 0, 1]]],
  ],
};

const state = {
  2: { mode: 'ver', A: PRE[2][0][1], t: 0, x: [1, 1], y: [2, -1] },
  3: { mode: 'ver', A: PRE[3][0][1], t: 0, x: [1, 1, 0], y: [0, 1, 1] },
};

const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const same = (A, B, e = 1e-9) => A.every((r, i) => r.every((x, j) => Math.abs(x - B[i][j]) < e));

export default {
  id: 'transpuesta',
  title: 'Transpuesta',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const ver = () => s.mode === 'ver';
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.45 : 0.28 });
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    const xa = new Arrow(stage, C.x, { radius: 0.04, label: R`\vec x` });
    const ya = new Arrow(stage, C.x2, { radius: 0.04, label: R`\vec y` });
    const Ax = new Arrow(stage, C.u, { radius: 0.035, opacity: 0.8, label: R`A\vec x` });
    const Aty = new Arrow(stage, C.v, { radius: 0.035, opacity: 0.8, label: R`A^{\mathsf T}\vec y` });
    stage.addHandle({ color: C.x, visible: () => !ver(), get: () => s.x, set: (p) => { s.x = p; update(); } });
    stage.addHandle({ color: C.x2, visible: () => !ver(), get: () => s.y, set: (p) => { s.y = p; update(); } });

    // --- panel ---
    const colors = basisColors(n);
    const mA = matEditor({ dim, colors, get: () => s.A, set: (M) => { stop(); s.A = M; update(); }, name: 'A' });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, M]) =>
      h('button', { class: 'chip', onclick: () => { stop(); s.A = M.map((r) => [...r]); update(); } }, name)));
    const mode = chips([['ver', 'A y Aᵀ'], ['punto', 'Producto punto']], () => s.mode, (m) => { stop(); s.mode = m; update(); });
    const st = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const go = (to) => { stop(); stop = animate(s.t, to, 1200, (t) => { s.t = t; update(); }); };
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => s.x, set: (v) => { s.x = v; update(); } });
    const ey = vecEditor({ name: R`\vec y`, color: C.x2, dim, get: () => s.y, set: (v) => { s.y = v; update(); } });
    const lead = h('p', { class: 'lead' });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox(), kind = new Note(), note = new Note();
    const anim = card('Ver la transformación', st.el,
      buttonRow(button('Aplicar A', () => go(0)), button('Aplicar Aᵀ', () => go(1), 'primary')), note.el);
    const vecs = card('Vectores', ex.el, ey.el, note.el);

    panel.append(
      ...intro('Transpuesta',
        R`La transpuesta $A^{\mathsf T}$ se obtiene <b>intercambiando filas por columnas</b>: la fila $i$ de $A$ pasa a ser la columna $i$ de $A^{\mathsf T}$. Parece un simple reacomodo, pero dice mucho de la geometría de $A$.`),
      card('Matriz', mA.el, pre),
      card('Vista', mode.el), lead, anim, vecs,
      card('Cálculo', c1.el, c2.el, c3.el, kind.el),
      details('Definición formal',
        rich(R`$(A^{\mathsf T})_{ij} = a_{ji}$. Propiedades: $(A^{\mathsf T})^{\mathsf T} = A$, $(A+B)^{\mathsf T} = A^{\mathsf T} + B^{\mathsf T}$, $(AB)^{\mathsf T} = B^{\mathsf T}A^{\mathsf T}$ (el orden se invierte) y $\det A^{\mathsf T} = \det A$.`),
        rich(R`El producto punto se escribe con la transpuesta: $\vec u\cdot\vec v = \vec u^{\mathsf T}\vec v$. De ahí sale la identidad clave $(A\vec x)\cdot\vec y = \vec x\cdot(A^{\mathsf T}\vec y)$.`),
        rich(R`<b>Simétrica</b>: $A^{\mathsf T} = A$. Sus autovalores son reales y sus autovectores perpendiculares. <b>Ortogonal</b>: $A^{\mathsf T}A = I$, es decir, $A^{-1} = A^{\mathsf T}$; son las rotaciones y reflexiones, que no cambian longitudes ni ángulos.`)),
      tryList([
        R`Con «Cizalla», alterna entre $A$ y $A^{\mathsf T}$: una empuja en horizontal y la otra en vertical. No es la inversa.`,
        R`Con «Simétrica», la rejilla no cambia al alternar: $A = A^{\mathsf T}$.`,
        R`Con «Rotación», $A^{\mathsf T}$ gira en sentido contrario: para matrices ortogonales la transpuesta <b>es</b> la inversa.`,
        R`En «Producto punto», arrastra $\vec x$ y $\vec y$: los vectores cambian, pero los dos productos punto coinciden siempre.`,
      ]),
    );

    function update() {
      const A = s.A, At = T(A);
      const Mt = ver() ? lerpMat(A, At, s.t) : A;
      grid.setMatrix(ver() ? Mt : I);
      basis.forEach((a, j) => a.setVisible(ver()).set(O, col(Mt, j)));
      const ax = matVec(A, s.x), aty = matVec(At, s.y);
      xa.setVisible(!ver()).set(O, s.x);
      ya.setVisible(!ver()).set(O, s.y);
      Ax.setVisible(!ver()).set(O, ax);
      Aty.setVisible(!ver()).set(O, aty);

      anim.style.display = ver() ? '' : 'none';
      vecs.style.display = ver() ? 'none' : '';
      (ver() ? anim : vecs).append(note.el);
      [mA, mode, st, ex, ey].forEach((c) => c.refresh());
      const L = ver()
        ? R`La rejilla muestra a dónde manda cada matriz el espacio. Las columnas de $A^{\mathsf T}$ son las <b>filas</b> de $A$: mueve $t$ para pasar de una transformación a la otra.`
        : R`La transpuesta es la matriz que «pasa al otro lado» del producto punto: medir $A\vec x$ contra $\vec y$ da lo mismo que medir $\vec x$ contra $A^{\mathsf T}\vec y$.`;
      if (lead.dataset.src !== L) { lead.dataset.src = L; setRich(lead, L); }

      c1.set(R`A = ${tm(A)}\quad\Longrightarrow\quad A^{\mathsf T} = ${tm(At)}`);
      const AtA = matMul(At, A);
      const sym = same(A, At), orth = same(AtA, I, 1e-6);
      if (ver()) {
        const tt = s.t;
        note.set('', tt < 0.01 ? R`Se ve $A$: sus columnas (flechas) son las columnas de $A$.`
          : tt > 0.99 ? R`Se ve $A^{\mathsf T}$: las flechas son ahora las <b>filas</b> de $A$.` : 'Transición entre A y Aᵀ…');
        c2.set(R`A^{\mathsf T}A = ${tm(AtA)}\qquad(\text{entrada } ij = \text{columna } i\cdot\text{columna } j \text{ de } A)`);
        c3.set(R`\det A^{\mathsf T} = ${fmt(det(At))} = \det A`);
      } else {
        const l = dot(ax, s.y), r = dot(s.x, aty);
        note.set('pos', R`$(A\vec x)\cdot\vec y = ${fmt(l)}$ y $\vec x\cdot(A^{\mathsf T}\vec y) = ${fmt(r)}$: siempre iguales.`);
        c2.set(R`(A\vec x)\cdot\vec y = ${clr(C.u, tv(ax))}\cdot${clr(C.x2, tv(s.y))} = ${fmt(l)}`);
        c3.set(R`\vec x\cdot(A^{\mathsf T}\vec y) = ${clr(C.x, tv(s.x))}\cdot${clr(C.v, tv(aty))} = ${fmt(r)}`);
      }
      if (orth) kind.set('pos', R`$A$ es <b>ortogonal</b>: $A^{\mathsf T}A = I$, así que $A^{-1} = A^{\mathsf T}$. Sus columnas tienen largo 1 y son perpendiculares entre sí.`);
      else if (sym) kind.set('pos', R`$A$ es <b>simétrica</b>: $A^{\mathsf T} = A$. Tiene autovalores reales y autovectores perpendiculares.`);
      else kind.set('', R`$A$ no es simétrica ($A^{\mathsf T}\neq A$) ni ortogonal ($A^{\mathsf T}A\neq I$): ${det(A) === 0 ? 'además no es invertible.' : R`$A^{\mathsf T}$ no deshace a $A$.`}`);
    }

    update();
    return { destroy: () => stop() };
  },
};
