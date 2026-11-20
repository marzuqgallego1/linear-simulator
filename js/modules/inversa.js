import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, col, matVec, matMul, inverse, adjugate, nullVector, det, add, scale, fmt, tv, tm, clr, EPS } from '../core/math.js';
import { R, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS, basisColors, presetButtons } from '../core/presets.js';

const state = {
  2: { A: [[2, 1], [1, 1]], x: [1, 1], s: 0 },
  3: { A: [[1, 1, 0], [0, 1, 1], [1, 0, 1]], x: [1, 0, 1], s: 0 },
};

export default {
  id: 'inversa',
  title: 'Matriz inversa',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const inv = () => inverse(st.A);
    // s ∈ [0,1]: se aplica A poco a poco.  s ∈ [1,2]: se aplica A⁻¹ sobre el resultado.
    const M = () => {
      if (st.s <= 1) return lerpMat(I, st.A, st.s);
      const Ai = inv();
      return Ai ? matMul(lerpMat(I, Ai, st.s - 1), st.A) : st.A;
    };
    const x2 = () => add(st.x, scale(nullVector(st.A), 1.5));
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.5 : 0.3 });
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    const xg = new Arrow(stage, C.x, { opacity: 0.3, radius: 0.025, label: R`\vec{x}` });
    const xa = new Arrow(stage, C.x, { label: R`\vec{x}` });
    const x2g = new Arrow(stage, C.x2, { opacity: 0.3, radius: 0.025, label: R`\vec{x}'` });
    const x2a = new Arrow(stage, C.x2);
    stage.addHandle({ color: C.x, get: () => st.x, set: (v) => { st.x = v; update(); } });

    // --- panel ---
    const run = (from, to) => { stop(); stop = animate(from, to, 1300, (v) => { st.s = v; update(); }); };
    const me = matEditor({
      dim, colors: basisColors(n), get: () => st.A,
      set: (A) => { stop(); st.A = A; if (!inv() && st.s > 1) st.s = 1; update(); },
    });
    const ss = slider({ label: 's', min: 0, max: 2, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const btnA = button('1 · Aplicar A', () => run(0, 1), 'primary');
    const btnInv = button('2 · Aplicar A⁻¹', () => run(1, 2), 'primary');
    const phase = new Note();
    const ex = vecEditor({ name: R`\vec{x}`, color: C.x, dim, get: () => st.x, set: (v) => { st.x = v; update(); } });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox();
    const note = new Note();

    panel.append(
      ...intro('Matriz inversa',
        R`La inversa $A^{-1}$ es la transformación que <b>deshace</b> lo que hizo $A$: si $A$ lleva $\vec x$ a $\vec y$, entonces $A^{-1}$ devuelve $\vec y$ a $\vec x$. Aplicar una y después la otra es como no hacer nada: $A^{-1}A = I$.`),
      card('Matriz A', me.el, presetButtons(dim, (A) => { stop(); st.A = A; st.s = 0; update(); run(0, 1); })),
      card('Paso a paso', ss.el, buttonRow(btnA, btnInv, button('Reiniciar', () => { stop(); st.s = 0; update(); })), phase.el),
      card('Vector de prueba', ex.el),
      card('Lo que estás viendo', c1.el, note.el, c2.el, c3.el),
      details('Definición formal',
        rich(R`$A^{-1}$ es la matriz que cumple $A^{-1}A = AA^{-1} = I$. Existe <b>si y solo si</b> $\det A \neq 0$.`),
        rich(dim === 2
          ? R`Para $2\times2$: $\begin{bmatrix}a&b\\c&d\end{bmatrix}^{-1} = \dfrac{1}{ad-bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}$.`
          : R`En general, $A^{-1} = \dfrac{1}{\det A}\,\text{adj}(A)$, donde $\text{adj}(A)$ es la traspuesta de la matriz de cofactores. En la práctica se calcula con eliminación de Gauss-Jordan.`),
        rich(R`Sirve para resolver sistemas: si $A\vec x = \vec y$, entonces $\vec x = A^{-1}\vec y$.`)),
      tryList([
        'Pulsa «1 · Aplicar A» y luego «2 · Aplicar A⁻¹»: todo vuelve exactamente a su sitio.',
        R`Elige «Rotación 90°»: su inversa es la rotación de $-90°$.`,
        R`Elige «Singular»: $\vec x$ y $\vec{x}'$ son distintos, pero $A$ los lleva al <b>mismo punto</b>. Por eso no se puede deshacer.`,
      ]),
    );

    function update() {
      const Ai = inv();
      const Mt = M();
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, col(Mt, j)));
      xg.set(O, st.x);
      xa.set(O, matVec(Mt, st.x));
      xa.setLabel(st.s < 0.5 ? R`\vec{x}` : st.s <= 1.5 ? R`A\vec{x}` : R`A^{-1}A\vec{x}`);
      x2g.setVisible(!Ai).set(O, x2());
      x2a.setVisible(!Ai).set(O, matVec(Mt, x2()));

      ss.input.max = Ai ? 2 : 1;
      btnInv.disabled = !Ai;
      me.refresh(); ss.refresh(); ex.refresh();

      const sv = st.s;
      if (sv < 0.005) phase.set('', 'Estado: <b>espacio original</b>.');
      else if (sv < 0.995) phase.set('', 'Aplicando $A$…');
      else if (sv < 1.005) phase.set('', Ai ? 'Después de $A$: todo se ha movido. Ahora aplica $A^{-1}$ para volver.' : 'Después de $A$. Como $\\det A = 0$, no hay vuelta atrás.');
      else if (sv < 1.995) phase.set('', 'Aplicando $A^{-1}$…');
      else phase.set('pos', 'De vuelta al inicio: $A^{-1}A = I$.');

      const d = det(st.A), y = matVec(st.A, st.x);
      if (Ai) {
        c1.set(dim === 2
          ? R`A^{-1} = \frac{1}{\det A}\begin{bmatrix}d&-b\\-c&a\end{bmatrix} = \frac{1}{${fmt(d)}}${tm(adjugate(st.A))} = ${tm(Ai)}`
          : R`A^{-1} = \frac{1}{\det A}\,\text{adj}(A) = \frac{1}{${fmt(d)}}${tm(adjugate(st.A))} = ${tm(Ai)}`);
        note.set('pos', R`$\det A = ${fmt(d)} \neq 0$, así que $A$ tiene inversa: ningún punto se pierde y cada destino viene de un único origen.`);
        c2.set(R`\vec y = A\vec x = ${clr(C.x, tv(y))} \qquad A^{-1}\vec y = ${clr(C.x, tv(matVec(Ai, y)))} = \vec x`);
        c3.set(R`A^{-1}A = ${tm(matMul(Ai, st.A))} = I`);
      } else {
        c1.set(R`\det A = 0 \;\Rightarrow\; A^{-1}\ \text{no existe}`);
        note.set('zero', R`$A$ aplasta el espacio: puntos distintos acaban en el mismo lugar. Mira $\vec x$ y $\vec{x}'$ (rosa): después de aplicar $A$ coinciden. Si solo ves el resultado, no puedes saber de cuál venía, así que no hay forma de deshacerlo.`);
        c2.set(R`A\vec x = ${clr(C.x, tv(y))} \qquad A\vec{x}' = ${clr(C.x2, tv(matVec(st.A, x2())))}`);
        c3.set('');
      }
    }

    update();
    return { destroy: () => stop() };
  },
};
