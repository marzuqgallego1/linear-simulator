import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, matVec, add, scale, det, fmt, pf, tv, tm, clr } from '../core/math.js';
import { R, h, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, chips, TexBox, Note, rich, setRich, animate } from '../core/ui.js';
import { basisColors } from '../core/presets.js';

const state = {
  2: { mode: 'suma', A: [[1, 0], [0, 1]], B: [[0, 1], [0, 0]], k: 2, x: [1, 2], t: 1 },
  3: { mode: 'suma', A: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], B: [[0, 0, 1], [0, 0, 0], [0, 0, 0]], k: 2, x: [1, 1, 1], t: 1 },
};

export default {
  id: 'sumamat',
  title: 'Suma y producto por escalar',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const suma = () => s.mode === 'suma';
    const Rm = () => (suma() ? s.A.map((r, i) => r.map((x, j) => x + s.B[i][j])) : s.A.map((r) => r.map((x) => s.k * x)));
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.4 : 0.25 });
    const xg = new Arrow(stage, C.x, { opacity: 0.35, radius: 0.025, label: R`\vec x` });
    const Ax = new Arrow(stage, C.u, { opacity: 0.6, radius: 0.03, label: R`A\vec x` });
    const Bx = new Arrow(stage, C.v, { opacity: 0.6, radius: 0.03, label: R`B\vec x` });
    const Rx = new Arrow(stage, C.w, { radius: 0.05 });
    stage.addHandle({ color: C.x, get: () => s.x, set: (p) => { s.x = p; update(); } });

    // --- panel ---
    const colors = basisColors(n);
    const set = (key) => (M) => { stop(); s[key] = M; s.t = 1; update(); };
    const mA = matEditor({ dim, colors, get: () => s.A, set: set('A'), name: 'A' });
    const mB = matEditor({ dim, colors, get: () => s.B, set: set('B'), name: 'B' });
    const sk = slider({ label: 'k', min: -3, max: 3, step: 0.1, get: () => s.k, set: (k) => { stop(); s.k = k; s.t = 1; update(); } });
    const mode = chips([['suma', 'A + B'], ['escalar', 'k · A']], () => s.mode, (m) => { stop(); s.mode = m; s.t = 1; update(); });
    const st = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const play = () => { stop(); stop = animate(0, 1, 1400, (t) => { s.t = t; update(); }); };
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => s.x, set: (v) => { s.x = v; update(); } });
    const lead = h('p', { class: 'lead' });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox(), note = new Note();

    panel.append(
      h('h2', {}, 'Suma y producto por escalar'),
      card('Operación', mode.el), lead,
      card('Matrices', h('div', { class: 'row' }, mA.el, mB.el), sk.el),
      card('Aplicar el resultado', st.el, buttonRow(button('▶ Animar', play, 'primary'))),
      card('Vector de prueba', ex.el, c1.el, c2.el, c3.el, note.el),
      details('Definición formal',
        rich(R`$(A + B)_{ij} = a_{ij} + b_{ij}$ y $(kA)_{ij} = k\,a_{ij}$: se opera <b>entrada por entrada</b>. Solo se pueden sumar matrices del mismo tamaño.`),
        rich(R`Como transformaciones: $(A+B)\vec x = A\vec x + B\vec x$ y $(kA)\vec x = k\,(A\vec x)$.`),
        rich(R`La <b>traza</b> (suma de la diagonal) es lineal: $\text{tr}(A+B) = \text{tr}A + \text{tr}B$ y $\text{tr}(kA) = k\,\text{tr}A$. El determinante no: en general $\det(A+B) \neq \det A + \det B$, y $\det(kA) = k^{${n}}\det A$.`)),
      tryList([
        R`En «A + B», arrastra $\vec x$: la flecha amarilla siempre es $A\vec x$ más $B\vec x$ puestas punta con cola.`,
        R`Con $A = I$ y $B$ con un solo 1 fuera de la diagonal, $A + B$ es una <b>cizalla</b>: la identidad más un «empujón».`,
        R`En «k · A», pon $k = -1$: es la transformación de $A$ seguida de un giro de 180°.`,
        R`En «k · A», compara $\det$: al duplicar $k$ el ${dim === 2 ? 'área' : 'volumen'} se multiplica por $2^{${n}}$, no por 2.`,
      ]),
    );

    function update() {
      const Rr = Rm(), Mt = lerpMat(I, Rr, s.t);
      grid.setMatrix(Mt);
      const ax = matVec(s.A, s.x), rx = matVec(Rr, s.x);
      xg.set(O, s.x);
      Ax.setVisible(true).set(O, ax);
      Bx.setVisible(suma()).set(ax, add(ax, matVec(s.B, s.x)));
      Rx.set(O, matVec(Mt, s.x)).setLabel(suma() ? R`(A+B)\vec x` : R`(kA)\vec x`);

      mB.el.style.display = suma() ? '' : 'none';
      sk.el.style.display = suma() ? 'none' : '';
      [mA, mB, sk, mode, st, ex].forEach((c) => c.refresh());
      const L = suma()
        ? R`Dos matrices del mismo tamaño se suman <b>entrada por entrada</b>. Como transformaciones, $A + B$ manda cada vector a la suma de a donde lo mandan $A$ y $B$: $(A+B)\vec x = A\vec x + B\vec x$.`
        : R`Multiplicar una matriz por un número $k$ multiplica cada entrada. Como transformación, $kA$ hace lo mismo que $A$ y luego estira (o invierte) el resultado por $k$.`;
      if (lead.dataset.src !== L) { lead.dataset.src = L; setRich(lead, L); }

      const entry = (f) => R`\begin{bmatrix}${s.A.map((r, i) => r.map((a, j) => f(a, i, j)).join('&')).join('\\\\')}\end{bmatrix}`;
      if (suma()) {
        c1.set(R`A + B = ${tm(s.A)} + ${tm(s.B)} = ${entry((a, i, j) => `${pf(a)}+${pf(s.B[i][j])}`)} = ${tm(Rr)}`);
        c2.set(R`(A+B)\vec x = ${clr(C.u, tv(ax))} + ${clr(C.v, tv(matVec(s.B, s.x)))} = ${clr(C.w, tv(rx))}`);
        const trA = s.A.reduce((t, r, i) => t + r[i], 0), trB = s.B.reduce((t, r, i) => t + r[i], 0);
        c3.set(R`\text{tr}(A+B) = ${fmt(trA + trB)} = ${fmt(trA)} + ${fmt(trB)},\qquad \det(A+B) = ${fmt(det(Rr))}\ \text{vs}\ \det A + \det B = ${fmt(det(s.A) + det(s.B))}`);
        note.set('', R`Naranja: $A\vec x$. Morado: $B\vec x$, colocado a continuación. Amarillo: el resultado, que es la suma de los dos.`);
      } else {
        c1.set(R`kA = ${fmt(s.k)}${tm(s.A)} = ${entry((a) => `${fmt(s.k)}\\cdot${pf(a)}`)} = ${tm(Rr)}`);
        c2.set(R`(kA)\vec x = ${fmt(s.k)}\,${clr(C.u, tv(ax))} = ${clr(C.w, tv(rx))}`);
        c3.set(R`\det(kA) = k^{${n}}\det A = ${pf(s.k)}^{${n}}\cdot${pf(det(s.A))} = ${fmt(det(Rr))}`);
        note.set('', R`Naranja: $A\vec x$. Amarillo: el mismo vector multiplicado por $k$. Cada uno de los ${n} ejes se estira por $k$, por eso el determinante se multiplica por $k^{${n}}$.`);
      }
    }

    update();
    return { destroy: () => stop() };
  },
};
