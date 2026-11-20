import { Arrow, Lattice, Polyline, Rod, C } from '../core/stage.js';
import { identity, lerpMat, matMul, matVec, transpose, inverse, sub, add, scale, dot, norm, normalize, cross, det, fmt, tv, tm, clr, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, slider, button, buttonRow, chips, TexBox, Note, rich, animate } from '../core/ui.js';
import { LineView, PlaneView } from '../core/geom.js';

const WC = '#20c997'; // subespacio W
const PC = '#8b93a7'; // complemento ortogonal W⊥
const AC = [C.u, C.v]; // vectores que generan W

const PRE = {
  2: { recta: [['Eje x', [[1, 0]]], ['Diagonal', [[1, 1]]], ['Pendiente 1/2', [[2, 1]]], ['Pendiente −2', [[-1, 2]]]] },
  3: {
    recta: [['Eje z', [[0, 0, 1]]], ['Diagonal', [[1, 1, 1]]], ['Otra', [[2, 1, 0]]]],
    plano: [['Plano xy', [[1, 0, 0], [0, 1, 0]]], ['Inclinado', [[1, 0, 1], [0, 1, 1]]], ['Plano xy (otra base)', [[1, 0, 0], [1, 1, 0]]]],
  },
};

const state = {
  2: { shape: 'recta', gens: { recta: [[2, 1]] }, b: [0.5, 3], target: 'W', t: 1 },
  3: { shape: 'plano', gens: { recta: [[1, 1, 1]], plano: [[1, 0, 1], [0, 1, 1]] }, b: [2, -1, 2.5], target: 'W', t: 1 },
};

/** Base ortonormal del espacio generado (Gram-Schmidt, descartando vectores dependientes). */
function onb(vs) {
  const qs = [];
  for (const v of vs) {
    let w = [...v];
    for (const q of qs) w = sub(w, scale(q, dot(q, w)));
    if (norm(w) > 1e-6) qs.push(normalize(w));
  }
  return qs;
}
const outer = (q) => q.map((x) => q.map((y) => x * y));
const addM = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
const subM = (A, B) => A.map((r, i) => r.map((x, j) => x - B[i][j]));
const tidy = (A) => A.map((r) => r.map((x) => (Math.abs(x) < 1e-12 ? 0 : x)));

export default {
  id: 'proyecciones',
  title: 'Proyecciones ortogonales',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const gens = () => st.gens[st.shape];
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.3 : 0.15 });
    const wLine = new LineView(stage, WC, { radius: 0.03 });
    const pLine = new LineView(stage, PC, { radius: 0.02 });
    const wPlane = dim === 3 ? new PlaneView(stage, WC, { opacity: 0.16 }) : null;
    const pPlane = dim === 3 ? new PlaneView(stage, PC, { opacity: 0.1 }) : null;
    const aArr = AC.map((c, j) => new Arrow(stage, c, { label: R`\vec a_${j + 1}` }));
    const bGhost = new Arrow(stage, C.x, { label: R`\vec b`, opacity: 0.45, radius: 0.03 });
    const pArr = new Arrow(stage, C.w, { label: ' ', radius: 0.05 });
    const err = new Rod(stage, C.x2, { radius: 0.025 });
    const corner = new Polyline(stage, '#ffffff', { opacity: 0.7 });
    [0, 1].forEach((j) => stage.addHandle({
      color: AC[j], visible: () => j < gens().length,
      get: () => gens()[j],
      set: (p) => { stop(); st.gens[st.shape] = gens().map((v, k) => (k === j ? p : v)); update(); },
    }));
    stage.addHandle({ color: C.x, get: () => st.b, set: (p) => { stop(); st.b = p; update(); } });

    // --- panel ---
    const shapeChips = dim === 3 ? chips([['recta', 'Recta (dim 1)'], ['plano', 'Plano (dim 2)']], () => st.shape, (s) => { stop(); st.shape = s; build(); update(); }) : null;
    const genBox = h('div'), preBox = h('div', { class: 'presets' });
    let eds = [];
    const build = () => {
      eds = gens().map((_, j) => vecEditor({ name: R`\vec a_${j + 1}`, color: AC[j], dim, get: () => gens()[j], set: (v) => { stop(); st.gens[st.shape] = gens().map((u, k) => (k === j ? v : u)); update(); } }));
      genBox.replaceChildren(...eds.map((e) => e.el));
      preBox.replaceChildren(...PRE[dim][st.shape].map(([name, vs]) =>
        h('button', { class: 'chip', onclick: () => { st.gens[st.shape] = vs.map((v) => [...v]); run(0, 1); } }, name)));
    };
    build();
    const tgt = chips([['W', 'Sobre W'], ['Wp', R`Sobre W⊥ (con I − P)`]], () => st.target, (k) => { st.target = k; run(0, 1); });
    const eb = vecEditor({ name: R`\vec b`, color: C.x, dim, get: () => st.b, set: (v) => { stop(); st.b = v; update(); } });
    const run = (a, b) => { stop(); st.t = a; update(); stop = animate(a, b, 1300, (v) => { st.t = v; update(); }); };
    const ss = slider({ label: 't', min: 0, max: 2, step: 0.01, get: () => st.t, set: (v) => { stop(); st.t = v; update(); } });
    const phase = new Note();
    const cF = new TexBox(), cE = new TexBox(), nE = new Note();
    const cP = new TexBox(), cProp = new TexBox(), nP = new Note();

    panel.append(
      ...intro('Proyecciones ortogonales',
        R`Proyectar $\vec b$ sobre un subespacio $W$ es buscar el punto de $W$ <b>más cercano</b> a $\vec b$: su sombra cuando la luz cae perpendicular. Lo que sobra, el error $\vec e = \vec b - \vec p$, es perpendicular a $W$. Proyectar es lineal, así que es una matriz $P$, y esa matriz tiene una firma muy clara: $P^2 = P$ y $P^{\mathsf T} = P$.`),
      card('Subespacio W', shapeChips?.el, genBox, preBox,
        rich(R`$W$ en verde; su complemento ortogonal $W^\perp$ (todo lo perpendicular a $W$) en gris. Arrastra las puntas de ${dim === 3 ? 'los $\\vec a_j$' : '$\\vec a_1$'} o de $\vec b$.`, 'p', 'note')),
      card('Vector b', eb.el, tgt.el),
      card('Proyectar todo el espacio', ss.el,
        buttonRow(button('▶ Proyectar', () => run(0, 1), 'primary'), button('Proyectar otra vez', () => run(1, 2)), button('t = 0', () => { stop(); st.t = 0; update(); })),
        phase.el),
      card('La proyección de b', cF.el, cE.el, nE.el),
      card('La matriz de proyección', cP.el, cProp.el, nP.el),
      details('Definición formal',
        rich(R`Si las columnas de $A$ forman una base de $W$, la proyección es $\vec p = A\hat x$ donde $\hat x$ cumple que el error es perpendicular a cada columna: $A^{\mathsf T}(\vec b - A\hat x) = \vec 0$, o sea $A^{\mathsf T}A\,\hat x = A^{\mathsf T}\vec b$ (las <b>ecuaciones normales</b> de mínimos cuadrados). De ahí $P = A(A^{\mathsf T}A)^{-1}A^{\mathsf T}$.`),
        rich(R`Para una recta (una sola columna $\vec a$): $P = \dfrac{\vec a\,\vec a^{\mathsf T}}{\vec a^{\mathsf T}\vec a}$. Si la base es ortonormal (columnas de $Q$), todo se simplifica a $P = QQ^{\mathsf T}$: por eso Gram-Schmidt es tan útil.`),
        rich(R`$P$ depende solo de $W$, no de la base elegida. $I - P$ proyecta sobre $W^\perp$, y $\vec b = P\vec b + (I-P)\vec b$ parte cada vector en una pieza de $W$ y otra perpendicular, de forma única.`),
        rich(R`Una matriz es una proyección ortogonal si y solo si $P^2 = P$ y $P^{\mathsf T} = P$. Si solo cumple $P^2 = P$, es una proyección <b>oblicua</b>: la «luz» cae inclinada y el error ya no es perpendicular.`),
        rich(R`Sus autovalores son $1$ (en $W$: ya está proyectado) y $0$ (en $W^\perp$: se aplasta). Es diagonalizable, su rango y su traza valen $\dim W$, y si $W \ne \mathbb{R}^${n}$ es singular: no se puede deshacer.`)),
      tryList([
        R`Pulsa «Proyectar» y luego «Proyectar otra vez»: la segunda vez <b>nada se mueve</b>. Eso es $P^2 = P$.`,
        R`Mueve $\vec b$ hasta que caiga en $W$: $\vec p = \vec b$ y el error desaparece. Ponlo en $W^\perp$: $\vec p = \vec 0$.`,
        dim === 3 ? R`Compara «Plano xy» con «Plano xy (otra base)»: los $\vec a_j$ cambian, pero $P$ es exactamente la misma.` : R`Cambia la longitud de $\vec a_1$ (por ejemplo, de $(2, 1)$ a $(4, 2)$): $P$ no cambia, porque la recta es la misma.`,
        R`Cambia a «Sobre W⊥»: ahora la flecha amarilla es el error de antes, y $P + (I-P) = I$.`,
        dim === 3 ? R`Pon $\vec a_2$ paralelo a $\vec a_1$: ya no generan un plano y $A^{\mathsf T}A$ deja de ser invertible.` : R`Mira la rejilla con $t = 1$: todo el plano quedó aplastado sobre la recta. Por eso $\det P = 0$.`,
      ]),
    );

    function update() {
      const G = gens(), qs = onb(G), k = qs.length;
      const P = tidy(qs.reduce((M, q) => addM(M, outer(q)), O.map(() => [...O])));
      const onW = st.target === 'W';
      const Q = onW ? P : tidy(subM(I, P));
      const t = st.t, Mt = t <= 1 ? lerpMat(I, Q, t) : Q;
      const b = st.b, p = matVec(Q, b), e = sub(b, p);

      // --- escena ---
      grid.setMatrix(Mt);
      const perpOf = () => (k === 0 ? null : k === 1 ? qs[0] : cross(qs[0], qs[1]));
      // W y W⊥
      wLine.setVisible(false); pLine.setVisible(false); wPlane?.setVisible(false); pPlane?.setVisible(false);
      if (dim === 2) {
        if (k === 1) { wLine.set(O, qs[0]); pLine.set(O, [-qs[0][1], qs[0][0]]); }
      } else if (k === 1) { wLine.set(O, qs[0]); pPlane.set(O, qs[0]); }
      else if (k === 2) { wPlane.set(O, perpOf()); pLine.set(O, perpOf()); }
      aArr.forEach((a, j) => a.setVisible(j < G.length).set(O, G[j] ?? O));
      bGhost.set(O, b);
      pArr.set(O, matVec(Mt, b)).setLabel(t < 0.02 ? '' : onW ? R`P\vec b` : R`(I-P)\vec b`);
      const showE = t > 0.98 && norm(e) > 0.05 && norm(p) > 1e-6;
      err.setVisible?.(showE);
      err.set(p, showE ? b : p);
      if (showE) {
        const s = Math.min(0.3, norm(e) / 3, norm(p) / 3), u = normalize(e), w = normalize(p);
        corner.setVisible(true).set([add(p, scale(u, s)), add(p, add(scale(u, s), scale(w, -s))), add(p, scale(w, -s))]);
      } else corner.setVisible(false);
      [ss, eb, tgt, shapeChips].forEach((c) => c?.refresh());
      eds.forEach((x) => x.refresh());

      const tgtTex = onW ? 'W' : R`W^\perp`;
      phase.set(t > 1.01 ? 'pos' : '', t < 0.01 ? R`Todavía sin proyectar. Pulsa «Proyectar» para ver cómo se aplasta todo el espacio sobre $${tgtTex}$.`
        : t < 0.99 ? R`Cada punto viaja en línea recta, perpendicular a $${tgtTex}$, hasta caer en $${tgtTex}$.`
          : t <= 1.01 ? R`Todo el ${dim === 2 ? 'plano' : 'espacio'} quedó sobre $${tgtTex}$. Lo que era perpendicular a $${tgtTex}$ se fue a $\vec 0$.`
            : R`Segunda proyección: <b>nada se mueve</b>, porque todo ya estaba en $${tgtTex}$. Por eso $P^2 = P$: proyectar dos veces es lo mismo que una.`);

      if (k === 0) {
        cF.set(''); cE.set(''); cP.set(''); cProp.set('');
        phase.set('neg', R`Sin subespacio $W$, «proyectar» manda todo a $\vec 0$.`);
        nE.set('neg', R`$\vec a_1 = \vec 0$ no genera nada: no hay subespacio sobre el que proyectar.`);
        nP.set('', '');
        return;
      }

      // --- fórmula de p ---
      const A = transpose(G), AtA = matMul(G, A), full = k === G.length;
      if (G.length === 1) {
        const a = G[0], ab = dot(a, b), aa = dot(a, a);
        cF.set(R`\vec p = \frac{\vec a_1\cdot\vec b}{\vec a_1\cdot\vec a_1}\,\vec a_1 = \frac{${fmt(ab)}}{${fmt(aa)}}${tv(a)} = ${clr(C.w, tv(matVec(P, b)))}`);
      } else if (full) {
        const xh = matVec(inverse(AtA), matVec(G, b));
        cF.set(R`\begin{gathered}A^{\mathsf T}A\,\hat x = A^{\mathsf T}\vec b:\quad ${tm(AtA)}\hat x = ${tv(matVec(G, b))} \;\Rightarrow\; \hat x = ${tv(xh)} \\[4pt] \vec p = A\hat x = ${fmt(xh[0])}\,${clr(AC[0], R`\vec a_1`)} ${xh[1] < 0 ? '-' : '+'} ${fmt(Math.abs(xh[1]))}\,${clr(AC[1], R`\vec a_2`)} = ${clr(C.w, tv(matVec(P, b)))}\end{gathered}`);
      } else cF.set(R`\vec p = ${clr(C.w, tv(matVec(P, b)))}`);
      const ePerp = sub(b, matVec(P, b));
      cE.set(R`\vec e = \vec b - \vec p = ${clr(C.x2, tv(ePerp))},\quad ${G.map((a, j) => R`\vec e\cdot${clr(AC[j], R`\vec a_${j + 1}`)} = ${fmt(dot(ePerp, a))}`).join(',\\ ')},\quad \|\vec e\| = ${fmt(norm(ePerp))}`);
      nE.set(full ? 'pos' : 'neg', !full ? R`$\vec a_2$ es paralelo a $\vec a_1$: no generan un plano, sino una recta. $A^{\mathsf T}A$ no es invertible ($\det = ${fmt(det(AtA))}$). Aquí se proyecta sobre esa recta.`
        : norm(ePerp) < 1e-9 ? R`$\vec e = \vec 0$: $\vec b$ ya estaba en $W$, así que $\vec p = \vec b$.`
          : R`El error es perpendicular a ${G.length === 1 ? '$\\vec a_1$' : 'los dos $\\vec a_j$'}, por lo tanto a todo $W$. $\|\vec e\| = ${fmt(norm(ePerp))}$ es la <b>distancia</b> de $\vec b$ a $W$: ningún otro punto de $W$ está más cerca.${onW ? '' : R` (Con «Sobre W⊥», la flecha amarilla es justo este $\vec e$.)`}`);

      // --- la matriz ---
      const name = onW ? 'P' : 'I - P';
      cP.set(G.length === 1
        ? R`P = \frac{\vec a_1\vec a_1^{\mathsf T}}{\vec a_1^{\mathsf T}\vec a_1} = \frac{1}{${fmt(dot(G[0], G[0]))}}${tm(outer(G[0]))} = ${tm(P)}${onW ? '' : R`,\qquad I - P = ${tm(Q)}`}`
        : R`P = A(A^{\mathsf T}A)^{-1}A^{\mathsf T} = ${tm(P)}${onW ? '' : R`,\qquad I - P = ${tm(Q)}`}`);
      const kk = onW ? k : n - k;
      const ones = Array(kk).fill('1'), zeros = Array(n - kk).fill('0');
      const Q2 = tidy(matMul(Q, Q));
      cProp.set(R`\begin{gathered}(${name})^2 = ${tm(Q2)} = ${name},\qquad (${name})^{\mathsf T} = ${name} \\[4pt] \lambda = ${[...ones, ...zeros].join(',\\ ')},\qquad \text{rango} = \text{tr}(${name}) = ${kk},\qquad \det(${name}) = ${fmt(det(Q))}\end{gathered}`);
      nP.set('', R`Autovalor 1 en $${tgtTex}$ (lo que ya está ahí no se mueve) y 0 en ${onW ? R`$W^\perp$` : '$W$'} (lo perpendicular se aplasta). El rango es la dimensión del subespacio de llegada: ${kk}.`);
    }

    update();
    return { destroy: () => stop() };
  },
};
