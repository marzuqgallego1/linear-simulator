import { Arrow, Lattice, Dot, C } from '../core/stage.js';
import { identity, lerpMat, col, matVec, add, scale, cross, normalize, solveSystem, fmt, tv, tm, clr } from '../core/math.js';
import { LineView, PlaneView } from '../core/geom.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS, basisColors } from '../core/presets.js';

const PRE = {
  2: [
    ['Invertible', [[2, 1], [1, 1]]],
    ['Rango 1', [[1, 2], [2, 4]]],
    ['Proyección sobre x', [[1, 0], [0, 0]]],
    ['Matriz cero', [[0, 0], [0, 0]]],
  ],
  3: [
    ['Invertible', [[1, 1, 0], [0, 1, 1], [1, 0, 1]]],
    ['Rango 2', [[1, 0, 1], [0, 1, 1], [1, 1, 2]]],
    ['Rango 1', [[1, 2, -1], [1, 2, -1], [1, 2, -1]]],
    ['Proyección sobre xy', [[1, 0, 0], [0, 1, 0], [0, 0, 0]]],
    ['Matriz cero', [[0, 0, 0], [0, 0, 0], [0, 0, 0]]],
  ],
};

const state = {
  2: { A: PRE[2][1][1], t: 1, x: [2, 1] },
  3: { A: PRE[3][1][1], t: 1, x: [1, 1, 0] },
};

const KER = '#f03e3e', IMG = '#20c997';
const DIM_NAME = ['solo el origen (un punto)', 'una recta por el origen', 'un plano por el origen', 'todo el espacio'];

export default {
  id: 'nucleo',
  title: 'Rango, núcleo y nulidad',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const imgName = (r) => (r === n && n === 2 ? 'todo el plano' : DIM_NAME[r]);
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.45 : 0.28 });
    const kerLine = new LineView(stage, KER, { radius: 0.03 });
    const kerPlane = dim === 3 ? new PlaneView(stage, KER, { opacity: 0.12, L: 4 }) : null;
    const imLine = new LineView(stage, IMG, { radius: 0.03 });
    const imPlane = dim === 3 ? new PlaneView(stage, IMG, { opacity: 0.12, L: 4 }) : null;
    const K = dim === 2 ? 4 : 3;
    const dots = [];
    for (let i = 0; i < (2 * K + 1) ** (dim === 3 ? 2 : 1); i++) dots.push(new Dot(stage, KER, { radius: dim === 2 ? 0.11 : 0.08 }));
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    const xa = new Arrow(stage, C.x, { opacity: 0.45, radius: 0.025, label: R`\vec x` });
    const x2a = new Arrow(stage, C.v, { opacity: 0.45, radius: 0.025, label: R`\vec x + \vec n` });
    const Ax = new Arrow(stage, C.w, { radius: 0.045, label: R`A\vec x` });
    stage.addHandle({ color: C.x, get: () => st.x, set: (p) => { st.x = p; update(); } });

    // --- panel ---
    const run = (a, b) => { stop(); st.t = a; update(); stop = animate(a, b, 1400, (v) => { st.t = v; update(); }); };
    const me = matEditor({ dim, colors: basisColors(n), get: () => st.A, set: (A) => { stop(); st.A = A; st.t = 1; update(); } });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); run(0, 1); } }, name)));
    const ts = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => st.t, set: (v) => { stop(); st.t = v; update(); } });
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => st.x, set: (v) => { st.x = v; update(); } });
    const cR = new TexBox(), cIm = new TexBox(), cKer = new TexBox(), cChk = new TexBox(), cThm = new TexBox(), cX = new TexBox();
    const nR = new Note(), nK = new Note(), nT = new Note(), nX = new Note();

    panel.append(
      ...intro('Rango, núcleo y nulidad',
        R`Una matriz puede <b>aplastar</b> el espacio. El <b>rango</b> mide cuántas dimensiones sobreviven: es la dimensión de la imagen (todo lo que $A$ puede producir). El <b>núcleo</b> es lo que se pierde: los vectores que $A$ manda al origen. Su dimensión es la <b>nulidad</b>.`),
      card('Matriz A', me.el, pre),
      card('Aplicar A', ts.el, buttonRow(button('▶ Animar', () => run(0, 1), 'primary'), button('Reiniciar', () => { stop(); st.t = 0; update(); }))),
      card('Imagen y rango', cR.el, cIm.el, nR.el),
      card('Núcleo y nulidad', cKer.el, cChk.el, nK.el),
      card('Teorema del rango', cThm.el, nT.el),
      card('Vectores con la misma imagen', ex.el, cX.el, nX.el),
      details('Definición formal',
        rich(R`<b>Imagen</b> (espacio columna): $\text{Im}A = \{A\vec x\} = \text{span}$ de las columnas de $A$. <b>Rango</b>: $\text{rg}A = \dim \text{Im}A$ = número de pivotes al escalonar = número de columnas linealmente independientes.`),
        rich(R`<b>Núcleo</b>: $\text{Ker}A = \{\vec x : A\vec x = \vec 0\}$, las soluciones del sistema homogéneo. <b>Nulidad</b>: $\dim\text{Ker}A$ = número de variables libres.`),
        rich(R`<b>Teorema del rango</b>: $\text{rg}A + \dim\text{Ker}A = n$ (número de columnas). Cada dimensión de entrada o sobrevive en la imagen o se pierde en el núcleo.`),
        rich(R`Para una matriz cuadrada son equivalentes: $A$ invertible $\iff \text{rg}A = n \iff \text{Ker}A = \{\vec 0\} \iff \det A \neq 0$. Y $A\vec x = \vec b$ tiene solución $\iff \vec b \in \text{Im}A$; si tiene una, todas las demás se obtienen sumándole vectores del núcleo.`)),
      tryList([
        R`Con «Rango 1», anima: los puntos rojos del núcleo caen todos al origen y la rejilla se aplasta sobre la recta verde.`,
        R`Arrastra $\vec x$: $\vec x$ y $\vec x + \vec n$ son vectores distintos, pero $A$ los manda al mismo sitio. Por eso una matriz con núcleo no se puede invertir.`,
        R`Con «Invertible», el núcleo es solo $\vec 0$ y la imagen es todo: nada se pierde.`,
        R`Edita una columna para que sea combinación de las otras y mira cómo baja el rango y sube la nulidad.`,
      ]),
    );

    function update() {
      const A = st.A, Mt = lerpMat(I, A, st.t);
      const S = solveSystem(A, O);
      const r = S.rank, ker = S.nullBasis, nul = ker.length;
      const piv = S.pivots.map((j) => col(A, j));

      // escena
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, col(Mt, j)));
      kerLine.setVisible(false); kerPlane?.setVisible(false);
      imLine.setVisible(false); imPlane?.setVisible(false);
      if (nul === 1) kerLine.set(O, ker[0]);
      if (nul === 2 && dim === 3) kerPlane.set(O, cross(ker[0], ker[1]));
      if (r === 1) imLine.set(O, piv[0]);
      if (r === 2 && dim === 3) imPlane.set(O, cross(piv[0], piv[1]));
      const show = nul >= 1 && nul < n;
      const e = ker.slice(0, 2).map(normalize);
      dots.forEach((d, i) => {
        if (!show || (nul === 1 && dim === 3 && i >= 2 * K + 1)) return d.setVisible(false);
        const a = (i % (2 * K + 1)) - K, b = Math.floor(i / (2 * K + 1)) - K;
        const p = nul === 1 ? scale(e[0], a) : add(scale(e[0], a), scale(e[1], b));
        d.setVisible(true).set(matVec(Mt, p));
      });
      const nv = nul && nul < n ? scale(normalize(ker[0]), 1.5) : null;
      const x2 = nv ? add(st.x, nv) : st.x;
      xa.set(O, st.x);
      x2a.setVisible(!!nv).set(O, x2);
      Ax.set(O, matVec(Mt, st.x)).setLabel(st.t > 0.99 ? R`A\vec x` : R`\vec x`);
      [me, ts, ex].forEach((c) => c.refresh());

      // imagen y rango
      cR.set(R`A = ${tm(A)}\ \xrightarrow{\text{escalonar}}\ ${tm(S.M.map((row) => row.slice(0, n)))}\qquad \text{rg}A = ${r}`);
      cIm.set(r === 0 ? R`\text{Im}A = \{\vec 0\}`
        : R`\text{Im}A = \text{span}\left\{${S.pivots.map((j) => clr(BASIS[j].color, tv(col(A, j)))).join(',\\ ')}\right\}`);
      nR.set(r === n ? 'pos' : 'neg', r === 0
        ? R`No hay pivotes: $A$ manda <b>todo</b> al origen. La imagen es solo el punto $\vec 0$.`
        : R`${r === 1 ? 'Hay 1 pivote' : `Hay ${r} pivotes`} (columna${r > 1 ? 's' : ''} ${S.pivots.map((j) => j + 1).join(', ')}): ${r === 1 ? 'esa columna es independiente' : 'esas columnas son independientes'}${r < n ? (r === 1 ? ' y las demás son múltiplos de ella' : ' y las demás son combinación de ellas') : ''}. La imagen es <b>${imgName(r)}</b>${r < n ? ' (en verde)' : ''}.`);

      // núcleo
      cKer.set(nul === 0 ? R`\text{Ker}A = \{\vec 0\},\qquad \dim\text{Ker}A = 0`
        : R`\text{Ker}A = \text{span}\left\{${ker.map((v) => clr(KER, tv(v))).join(',\\ ')}\right\},\qquad \dim\text{Ker}A = ${nul}`);
      cChk.set(nul === 0 ? R`A\vec x = \vec 0\ \Rightarrow\ \vec x = \vec 0`
        : ker.map((v, i) => R`A${clr(KER, tv(v))} = ${tv(matVec(A, v))}`).join('\\qquad '));
      nK.set(nul === 0 ? 'pos' : 'neg', nul === 0
        ? R`Solo $\vec 0$ va a parar al origen: <b>no se pierde nada</b>.`
        : nul === n ? R`Todo el espacio es núcleo: cualquier vector va al origen.`
          : R`Hay ${nul === 1 ? 'una recta' : 'un plano'} de vectores (en rojo) que $A$ manda al origen. Las variables libres son ${S.free.map((j) => `$x_${j + 1}$`).join(' y ')}. Al animar, los puntos rojos <b>colapsan</b> en $\vec 0$.`);

      // teorema
      cThm.set(R`\underbrace{${r}}_{\text{rango}} + \underbrace{${nul}}_{\text{nulidad}} = ${n}\ \text{(columnas)}`);
      nT.set(r === n ? 'pos' : '', r === n
        ? R`Rango completo: $A$ es <b>invertible</b> ($\det A \neq 0$).`
        : R`Se pierde${nul > 1 ? 'n' : ''} ${nul} dimensi${nul > 1 ? 'ones' : 'ón'} y sobrevive${r === 1 ? '' : 'n'} ${r}. $A$ <b>no es invertible</b> ($\det A = 0$).`);

      // vector de prueba
      if (nv) {
        cX.set(R`A${clr(C.x, tv(st.x))} = A${clr(C.v, tv(x2))} = ${clr(C.w, tv(matVec(A, st.x)))}`);
        nX.set('', R`$\vec x$ y $\vec x + \vec n$ (con $\vec n$ en el núcleo) son distintos pero tienen la <b>misma imagen</b>. Viendo solo $A\vec x$ no se puede saber de cuál venía: por eso no hay inversa.`);
      } else {
        cX.set(R`A${clr(C.x, tv(st.x))} = ${clr(C.w, tv(matVec(A, st.x)))}`);
        nX.set('', nul === 0 ? R`Con núcleo trivial, cada imagen viene de un único $\vec x$.` : R`Todo vector va al origen.`);
      }
    }

    update();
    return { destroy: () => stop() };
  },
};
