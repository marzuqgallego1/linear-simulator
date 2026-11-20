import { Arrow, Lattice, Polyline, Segments, Rod, Dot, C } from '../core/stage.js';
import { identity, matVec, transpose, symEigen, rotPow, det, dot, scale, add, normalize, fmt, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, chips, TexBox, Note, rich, animate } from '../core/ui.js';
import { LineView } from '../core/geom.js';

const EC = [C.u, C.v, '#20c997']; // direcciones principales (autovectores)
const POS = '#ff922b', NEG = '#4dabf7', ONE = C.w, ZERO = '#adb5bd';
const LV2 = [1, 4, 9, 16, 25, 36]; // niveles ±k²: anillos equiespaciados

const P2 = [
  ['Círculo', [[1, 0], [0, 1]]],
  ['Elipse', [[1, 0], [0, 4]]],
  ['Elipse inclinada', [[2, 1], [1, 2]]],
  ['Silla: x² − y²', [[1, 0], [0, -1]]],
  ['Silla: 2xy', [[0, 1], [1, 0]]],
  ['Semidefinida: (x + y)²', [[1, 1], [1, 1]]],
  ['Definida negativa', [[-2, -1], [-1, -2]]],
];
const P3 = [
  ['Esfera', [[1, 0, 0], [0, 1, 0], [0, 0, 1]]],
  ['Elipsoide', [[1, 0, 0], [0, 0.4, 0], [0, 0, 2]]],
  ['Elipsoide inclinado', [[2, 1, 0], [1, 2, 1], [0, 1, 2]]],
  ['Hiperboloide de una hoja', [[1, 0, 0], [0, 1, 0], [0, 0, -1]]],
  ['Hiperboloide de dos hojas', [[-1, 0, 0], [0, -1, 0], [0, 0, 1]]],
  ['Cilindro', [[1, 0, 0], [0, 1, 0], [0, 0, 0]]],
];

const state = {
  2: { A: P2[2][1], x: [1.5, 0.5], t: 0 },
  3: { mode: 'grafica', A2: P2[2][1], A3: P3[2][1], x2: [1.2, 0.4], x3: [1, 0.5, 0.8], c: 1, t: 0 },
};

const qf = (A, x) => dot(x, matVec(A, x));
const snap = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

/** Autovalores y una base ortonormal de autovectores con det = +1 (para poder girar hacia ella). */
function principal(A) {
  const n = A.length, E = symEigen(A);
  const lams = E.map((e) => snap(e.value));
  let vs = E.map((e) => normalize(e.vector));
  if (n === 2) {
    let v = vs[0];
    if (v[0] < -1e-9 || (Math.abs(v[0]) < 1e-9 && v[1] < 0)) v = scale(v, -1);
    vs = [v, [-v[1], v[0]]]; // giro mínimo
  } else if (det(transpose(vs)) < 0) vs[2] = scale(vs[2], -1);
  return { lams, vs, Q: transpose(vs) };
}

/** Curva de nivel q = c por «marching squares». Devuelve segmentos [a1, b1, a2, b2, ...]. */
function contour(f, L, N, c) {
  const hh = (2 * L) / N, o = -L + 1e-3;
  const V = Array.from({ length: N + 1 }, (_, i) => Array.from({ length: N + 1 }, (_, j) => f([o + i * hh, o + j * hh]) - c));
  const out = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cs = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
    for (let e = 0; e < 4; e++) {
      const [a, b] = [cs[e], cs[(e + 1) % 4]], va = V[a[0]][a[1]], vb = V[b[0]][b[1]];
      if ((va > 0) !== (vb > 0)) {
        const s = va / (va - vb);
        pts.push([o + (a[0] + s * (b[0] - a[0])) * hh, o + (a[1] + s * (b[1] - a[1])) * hh]);
      }
    }
    if (pts.length >= 2) out.push(pts[0], pts[1]);
    if (pts.length === 4) out.push(pts[2], pts[3]);
  }
  return out;
}

/** Superficie λ₁y₁² + λ₂y₂² + λ₃y₃² = c en coordenadas principales: lista de parches {F, u, w} y su nombre. */
function quadric(lams, c) {
  const BIG = 4.2, U = 2.4;
  const zero = Math.abs(c) < 0.03;
  const mu = lams.map((l) => (zero ? l : l / c));
  const P = [0, 1, 2].filter((i) => mu[i] > 1e-9), Nn = [0, 1, 2].filter((i) => mu[i] < -1e-9), Z = [0, 1, 2].filter((i) => Math.abs(mu[i]) <= 1e-9);
  const a = mu.map((m) => (Math.abs(m) > 1e-9 ? 1 / Math.sqrt(Math.abs(m)) : 0));
  const y = (pairs) => { const v = [0, 0, 0]; pairs.forEach(([i, x]) => { v[i] = x; }); return v; };
  const T = [0, 2 * Math.PI], key = `${P.length}${Nn.length}${Z.length}`;
  if (zero) {
    const [M, m] = P.length === 2 ? [P, Nn] : [Nn, P];
    if ((key === '210' || key === '120')) return { name: 'un cono doble', patches: [{ F: (s, w) => y([[M[0], a[M[0]] * s * Math.cos(w)], [M[1], a[M[1]] * s * Math.sin(w)], [m[0], a[m[0]] * s]]), u: [-BIG, BIG], w: T }] };
    if (key === '111') return { name: 'dos planos que se cortan', patches: [1, -1].map((sg) => ({ F: (u, w) => y([[P[0], a[P[0]] * u], [Nn[0], sg * a[Nn[0]] * u], [Z[0], w]]), u: [-BIG, BIG], w: [-BIG, BIG] })) };
    if (Z.length === 2) return { name: 'un plano (doble)', patches: [{ F: (u, w) => y([[Z[0], u], [Z[1], w]]), u: [-BIG, BIG], w: [-BIG, BIG] }] };
    if (Z.length === 1) return { name: 'una recta (solo el núcleo)', patches: [] };
    if (Z.length === 3) return { name: 'todo el espacio', patches: [] };
    return { name: 'solo el origen', patches: [] };
  }
  switch (key) {
    case '300': return { name: lams[0] === lams[2] ? 'una esfera' : 'un elipsoide', patches: [{ F: (u, w) => y([[P[0], a[P[0]] * Math.cos(u) * Math.cos(w)], [P[1], a[P[1]] * Math.cos(u) * Math.sin(w)], [P[2], a[P[2]] * Math.sin(u)]]), u: [-Math.PI / 2, Math.PI / 2], w: T }] };
    case '210': return { name: 'un hiperboloide de una hoja', patches: [{ F: (u, w) => y([[P[0], a[P[0]] * Math.cosh(u) * Math.cos(w)], [P[1], a[P[1]] * Math.cosh(u) * Math.sin(w)], [Nn[0], a[Nn[0]] * Math.sinh(u)]]), u: [-U, U], w: T }] };
    case '120': return { name: 'un hiperboloide de dos hojas', patches: [1, -1].map((sg) => ({ F: (u, w) => y([[P[0], sg * a[P[0]] * Math.cosh(u)], [Nn[0], a[Nn[0]] * Math.sinh(u) * Math.cos(w)], [Nn[1], a[Nn[1]] * Math.sinh(u) * Math.sin(w)]]), u: [0, U], w: T })) };
    case '201': return { name: 'un cilindro elíptico', patches: [{ F: (u, w) => y([[P[0], a[P[0]] * Math.cos(w)], [P[1], a[P[1]] * Math.sin(w)], [Z[0], u]]), u: [-BIG, BIG], w: T }] };
    case '111': return { name: 'un cilindro hiperbólico', patches: [1, -1].map((sg) => ({ F: (u, w) => y([[P[0], sg * a[P[0]] * Math.cosh(u)], [Nn[0], a[Nn[0]] * Math.sinh(u)], [Z[0], w]]), u: [-U, U], w: [-BIG, BIG] })) };
    case '102': return { name: 'dos planos paralelos', patches: [1, -1].map((sg) => ({ F: (u, w) => y([[P[0], sg * a[P[0]]], [Z[0], u], [Z[1], w]]), u: [-BIG, BIG], w: [-BIG, BIG] })) };
    default: return { name: 'vacía (ningún punto cumple la ecuación)', patches: [] };
  }
}

/** Malla de alambre de los parches (ya en coordenadas x = Q y), recortada a una caja. */
function wire(patches, Q, box = 4.2, lines = 14, samples = 40) {
  const segs = [];
  const inBox = (p) => Math.max(...p.map(Math.abs)) <= box;
  for (const { F, u, w } of patches) {
    const at = (s, r) => matVec(Q, F(u[0] + s * (u[1] - u[0]), w[0] + r * (w[1] - w[0])));
    for (let dir = 0; dir < 2; dir++) for (let k = 0; k <= lines; k++) {
      let prev = null;
      for (let m = 0; m <= samples; m++) {
        const p = dir ? at(k / lines, m / samples) : at(m / samples, k / lines);
        if (prev && inBox(p) && inBox(prev)) segs.push(prev, p);
        prev = p;
      }
    }
  }
  return segs;
}

/** Polinomio xᵀAx en LaTeX. */
function polyQ(A) {
  const n = A.length, v = ['x', 'y', 'z'], terms = [];
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    const k = i === j ? A[i][i] : 2 * A[i][j];
    if (Math.abs(k) < 1e-12) continue;
    const mono = i === j ? `${v[i]}^2` : `${v[i]}${v[j]}`;
    const co = Math.abs(Math.abs(k) - 1) < 1e-12 ? '' : fmt(Math.abs(k));
    terms.push(`${k < 0 ? '-' : terms.length ? '+' : ''} ${co}${mono}`);
  }
  return terms.length ? terms.join(' ') : '0';
}

const classify = (lams) => {
  const p = lams.filter((l) => l > 0).length, m = lams.filter((l) => l < 0).length, n = lams.length;
  if (p === n) return ['definida positiva', 'pos'];
  if (m === n) return ['definida negativa', 'neg'];
  if (p && m) return ['indefinida', 'zero'];
  if (p) return ['semidefinida positiva', 'pos'];
  if (m) return ['semidefinida negativa', 'neg'];
  return ['nula', ''];
};

export default {
  id: 'cuadraticas',
  title: 'Formas cuadráticas',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const mode = () => (dim === 2 ? 'plano' : st.mode);
    const A = () => (dim === 2 ? st.A : mode() === 'grafica' ? st.A2 : st.A3);
    const setA = (M) => { if (dim === 2) st.A = M; else if (mode() === 'grafica') st.A2 = M; else st.A3 = M; };
    const X = () => (dim === 2 ? st.x : mode() === 'grafica' ? st.x2 : st.x3);
    const setX = (v) => { if (dim === 2) st.x = v; else if (mode() === 'grafica') st.x2 = v; else st.x3 = v; };
    let stop = () => {};
    let cache = { key: '' };

    // --- escena ---
    const grid = dim === 2 ? new Lattice(stage, C.grid, { opacity: 0.22 }) : null;
    const segOne = new Segments(stage, ONE, { opacity: 0.95 });
    const segNegOne = new Segments(stage, NEG, { opacity: 0.95 });
    const segPos = new Segments(stage, POS, { opacity: 0.4 });
    const segNeg = new Segments(stage, NEG, { opacity: 0.4 });
    const surf = dim === 3 ? new Segments(stage, '#9fb4ff', { opacity: 0.35 }) : null;
    const zeroLines = [0, 1].map(() => new LineView(stage, ZERO, { radius: 0.015 }));
    const axes = [0, 1, 2].map((i) => new LineView(stage, EC[i], { radius: 0.02 }));
    const axArr = [0, 1, 2].map((i) => new Arrow(stage, EC[i], { radius: 0.04, label: R`\vec v_${i + 1}` }));
    const parab = dim === 3 ? [0, 1].map((i) => new Polyline(stage, EC[i])) : [];
    const xa = new Arrow(stage, C.x, { radius: 0.035, label: R`\vec x` });
    const rod = dim === 3 ? new Rod(stage, C.x, { radius: 0.02 }) : null;
    const top = dim === 3 ? new Dot(stage, C.x, { radius: 0.09 }) : null;
    stage.addHandle({
      color: C.x,
      get: () => { const x = X(), Rt = rot(); const p = matVec(Rt, x); return mode() === 'grafica' ? [...p, 0] : p; },
      set: (p) => { stop(); const Rt = rot(), v = mode() === 'grafica' ? [p[0], p[1]] : p; setX(matVec(transpose(Rt), v)); update(); },
    });

    // --- panel ---
    const modeChips = dim === 3 ? chips([['grafica', 'Gráfica z = q(x, y)'], ['nivel', 'Superficie q(x, y, z) = c']], () => st.mode, (m) => { stop(); st.mode = m; st.t = 0; build(); update(); }) : null;
    const edBox = h('div'), preBox = h('div', { class: 'presets' }), xBox = h('div');
    let me, ex;
    const symSet = (M) => {
      const old = A();
      const Mm = M.map((r) => [...r]);
      for (let i = 0; i < Mm.length; i++) for (let j = 0; j < Mm.length; j++) if (Mm[i][j] !== old[i][j]) Mm[j][i] = Mm[i][j];
      stop(); setA(Mm); update();
    };
    const build = () => {
      const m = A().length;
      me = matEditor({ dim: m, get: A, set: symSet });
      ex = vecEditor({ name: R`\vec x`, color: C.x, dim: m, get: X, set: (v) => { stop(); setX(v); update(); } });
      edBox.replaceChildren(me.el);
      xBox.replaceChildren(ex.el);
      preBox.replaceChildren(...(m === 2 ? P2 : P3).map(([name, M]) =>
        h('button', { class: 'chip', onclick: () => { stop(); setA(M.map((r) => [...r])); st.t = 0; update(); } }, name)));
      cardC.style.display = mode() === 'nivel' ? '' : 'none';
    };
    const run = (a, b) => { stop(); st.t = a; update(); stop = animate(a, b, 1400, (v) => { st.t = v; update(); }); };
    const ts = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => st.t, set: (v) => { stop(); st.t = v; update(); } });
    const cs = slider({ label: 'c', min: -3, max: 3, step: 0.05, get: () => st.c, set: (v) => { stop(); st.c = Math.abs(v) < 0.03 ? 0 : v; update(); } });
    const cardC = card('Nivel c', cs.el, rich(R`Pasa por $c = 0$ con una forma indefinida: el hiperboloide se convierte en un cono y luego cambia de tipo.`, 'p', 'note'));
    const phase = new Note();
    const cQ = new TexBox(), cY = new TexBox(), cX = new TexBox(), nX = new Note();
    const cL = new TexBox(), nC = new Note(), cS = new TexBox(), nS = new Note();

    panel.append(
      ...intro('Formas cuadráticas',
        R`Una forma cuadrática es $q(\vec x) = \vec x^{\mathsf T}A\vec x$ con $A$ simétrica: un polinomio cuyos términos son todos de grado 2 ($x^2$, $xy$, $y^2$…). La pregunta central es su <b>signo</b>: ¿$q$ es siempre positiva? Los autovalores de $A$ lo responden, porque en los ejes de los autovectores la forma se vuelve una suma de cuadrados <b>sin términos cruzados</b>.`),
      modeChips ? card('Qué ver', modeChips.el) : '',
      card('Matriz simétrica A', edBox, preBox,
        rich(R`Al cambiar $a_{ij}$ también cambia $a_{ji}$: la matriz de una forma cuadrática siempre se toma simétrica.`, 'p', 'note'), cQ.el),
      cardC,
      card('Girar a los ejes principales', ts.el,
        buttonRow(button('▶ Girar', () => run(0, 1), 'primary'), button('↺ Ejes originales', () => run(1, 0))),
        phase.el, cY.el),
      card('Clasificación', cL.el, nC.el, cS.el, nS.el),
      card('Un vector de prueba', xBox, cX.el, nX.el),
      details('Definición formal',
        rich(R`Una <b>forma cuadrática</b> en $\mathbb{R}^n$ es $q(\vec x) = \vec x^{\mathsf T}A\vec x = \sum_{i,j} a_{ij}x_ix_j$. Cualquier matriz da una forma, pero $A$ y $\tfrac12(A + A^{\mathsf T})$ dan la misma, así que se toma simétrica: el coeficiente de $x_ix_j$ se reparte mitad en $a_{ij}$ y mitad en $a_{ji}$.`),
        rich(R`<b>Teorema de los ejes principales.</b> Como $A$ es simétrica, $A = QDQ^{\mathsf T}$ con $Q$ ortogonal. Con $\vec y = Q^{\mathsf T}\vec x$ (un giro): $q = \vec y^{\mathsf T}D\vec y = \lambda_1y_1^2 + \dots + \lambda_ny_n^2$.`),
        rich(R`Clasificación: <b>definida positiva</b> si $q(\vec x) > 0$ para todo $\vec x \ne \vec 0$ (todos los $\lambda_i > 0$); <b>semidefinida positiva</b> si $q \ge 0$ (todos $\lambda_i \ge 0$); igual con negativa; <b>indefinida</b> si toma ambos signos (hay $\lambda$ de los dos signos).`),
        rich(R`<b>Criterio de Sylvester:</b> $A$ es definida positiva si y solo si todos sus menores principales $\Delta_1 = a_{11}$, $\Delta_2$, … , $\Delta_n = \det A$ son positivos; definida negativa si alternan $-, +, -, \dots$ Para las semidefinidas este criterio no basta.`),
        rich(R`<b>Cociente de Rayleigh:</b> sobre los vectores de largo 1, el máximo de $q$ es $\lambda_{\max}$ y el mínimo es $\lambda_{\min}$, alcanzados en sus autovectores. Usos: el criterio de la segunda derivada (la matriz hessiana) para máximos, mínimos y puntos de silla; la energía en física; la clasificación de cónicas y cuádricas.`)),
      tryList(dim === 2 ? [
        R`Con «Elipse inclinada», pulsa «Girar»: las elipses se enderezan y $q = 3y_1^2 + y_2^2$. El término $2xy$ desaparece.`,
        R`Con las dos sillas: son la misma forma girada 45°. Las curvas son hipérbolas y $q = 0$ en dos rectas (gris).`,
        R`Con «Semidefinida», las curvas son rectas paralelas: $q = (x+y)^2$ vale 0 en toda una recta, el núcleo de $A$.`,
        R`Cambia $a_{12}$ poco a poco desde «Círculo»: mientras $|a_{12}| < 1$ son elipses; al pasar de 1, $\det A < 0$ y se vuelven hipérbolas.`,
      ] : [
        R`En «Gráfica», compara «Elipse inclinada» (un cuenco), «Silla: x² − y²» (silla de montar) y «Semidefinida» (un canal). Las parábolas de colores son los cortes por los ejes principales: su curvatura es $\lambda_i$.`,
        R`En «Superficie», con «Hiperboloide de una hoja», baja $c$ hasta 0 (un cono) y luego a negativo: se vuelve de dos hojas.`,
        R`Con «Elipsoide», los semiejes miden $1/\sqrt{\lambda_i}$: el $\lambda$ más grande da el eje más corto.`,
        R`Con «Elipsoide inclinado», pulsa «Girar»: el elipsoide queda alineado con los ejes y la ecuación pierde los términos cruzados.`,
      ]),
    );

    function rot() {
      const { Q } = principal(A());
      return rotPow(transpose(Q), st.t);
    }

    function update() {
      const M = A(), m = M.length, md = mode();
      const { lams, vs, Q } = principal(M);
      const Rt = rotPow(transpose(Q), st.t);
      const f = (p) => qf(M, p);
      const tr = (p) => matVec(Rt, p);
      const lift = (p, z) => [...matVec(Rt, p), z];

      // --- geometría que depende solo de A (se cachea) ---
      const key = `${md}|${JSON.stringify(M)}|${md === 'nivel' ? st.c : ''}`;
      if (cache.key !== key) {
        cache = { key };
        if (md === 'plano') {
          cache.one = contour(f, 8, 90, 1); cache.negOne = contour(f, 8, 90, -1);
          cache.pos = LV2.slice(1).flatMap((c) => contour(f, 8, 90, c));
          cache.neg = LV2.slice(1).flatMap((c) => contour(f, 8, 90, -c));
        } else if (md === 'grafica') {
          const segs = [], ZM = 4, L = 3, K = 12, S = 60;
          for (let dir = 0; dir < 2; dir++) for (let k = 0; k <= K; k++) {
            let prev = null;
            for (let s = 0; s <= S; s++) {
              const u = -L + (2 * L * k) / K, w = -L + (2 * L * s) / S;
              const p = dir ? [u, w] : [w, u], z = f(p);
              if (prev && Math.abs(z) <= ZM && Math.abs(prev[1]) <= ZM) segs.push(prev, [p, z]);
              prev = [p, z];
            }
          }
          cache.surf = segs;
          cache.one = contour(f, 3, 60, 1); cache.negOne = contour(f, 3, 60, -1);
          cache.pos = [2, 3].flatMap((c) => contour(f, 3, 60, c).map((p) => [p, c]));
          cache.neg = [2, 3].flatMap((c) => contour(f, 3, 60, -c).map((p) => [p, -c]));
        } else {
          cache.quad = quadric(lams, st.c);
          cache.surf = wire(cache.quad.patches, Q);
        }
      }

      // --- escena ---
      grid?.setMatrix(Rt);
      [segOne, segNegOne, segPos, segNeg].forEach((s) => s.setVisible(md !== 'nivel'));
      surf?.setVisible(md !== 'plano');
      if (md === 'plano') {
        segOne.set(cache.one.map(tr)); segNegOne.set(cache.negOne.map(tr));
        segPos.set(cache.pos.map(tr)); segNeg.set(cache.neg.map(tr));
      } else if (md === 'grafica') {
        surf.set(cache.surf.map(([p, z]) => lift(p, z)));
        segOne.set(cache.one.map((p) => lift(p, 1)).concat(cache.one.map((p) => lift(p, 0))));
        segNegOne.set(cache.negOne.map((p) => lift(p, -1)).concat(cache.negOne.map((p) => lift(p, 0))));
        segPos.set(cache.pos.map(([p, z]) => lift(p, z))); segNeg.set(cache.neg.map(([p, z]) => lift(p, z)));
      } else surf.set(cache.surf.map(tr));

      // conjunto q = 0 en el plano (rectas): asíntotas o núcleo
      zeroLines.forEach((l) => l.setVisible(false));
      if (md !== 'nivel') {
        const flat = (d) => (md === 'grafica' ? [...tr(d), 0] : tr(d));
        const O3 = md === 'grafica' ? [0, 0, 0] : [0, 0];
        if (lams[0] > 0 && lams[1] < 0) {
          const r = Math.sqrt(lams[0] / -lams[1]);
          [1, -1].forEach((sg, i) => zeroLines[i].set(O3, flat(add(vs[0], scale(vs[1], sg * r)))));
        } else if (lams.filter((l) => l === 0).length === 1) zeroLines[0].set(O3, flat(vs[lams.findIndex((l) => l === 0)]));
      }

      axes.forEach((l, i) => {
        if (i >= m) return l.setVisible(false);
        const d = tr(vs[i]);
        l.set(md === 'grafica' ? [0, 0, 0] : Array(m).fill(0), md === 'grafica' ? [...d, 0] : d);
      });
      axArr.forEach((a, i) => {
        if (i >= m) return a.setVisible(false);
        const d = tr(vs[i]);
        a.setVisible(true).set(md === 'grafica' ? [0, 0, 0] : Array(m).fill(0), md === 'grafica' ? [...d, 0] : d)
          .setLabel(st.t > 0.98 ? R`\vec v_${i + 1} = \vec e_${i + 1}` : R`\vec v_${i + 1}`);
      });
      parab.forEach((pl, i) => {
        pl.setVisible(md === 'grafica');
        if (md !== 'grafica') return;
        const smax = Math.min(3, Math.abs(lams[i]) > 1e-9 ? Math.sqrt(4 / Math.abs(lams[i])) : 3);
        pl.set(Array.from({ length: 41 }, (_, k) => { const s = -smax + (2 * smax * k) / 40; return lift(scale(vs[i], s), lams[i] * s * s); }));
      });
      const x = X(), qx = f(x), xr = tr(x);
      if (md === 'grafica') {
        xa.set([0, 0, 0], [...xr, 0]);
        rod.setVisible(true).set([...xr, 0], [...xr, qx]);
        top.setVisible(Math.abs(qx) <= 6).set([...xr, qx]);
      } else {
        xa.set(Array(m).fill(0), xr);
        rod?.setVisible(false); top?.setVisible(false);
      }
      [ts, cs, me, ex, modeChips].forEach((c) => c?.refresh());

      // --- textos ---
      const vars = ['x', 'y', 'z'].slice(0, m);
      const yv = matVec(transpose(Q), x);
      const co = (l) => (fmt(l) === '1' ? '' : fmt(l) === '-1' ? '-' : fmt(l) + '\\,');
      const sumY = lams.map((l, i) => clr(EC[i], `${co(l)}y_${i + 1}^2`)).join(' + ').replace(/\+ \\textcolor\{([^}]*)\}\{-/g, '- \\textcolor{$1}{');
      cQ.set(R`q(${vars.join(', ')}) = \vec x^{\mathsf T}A\vec x = ${polyQ(M)}`);
      const t = st.t;
      phase.set(t > 0.99 ? 'pos' : '', t < 0.01 ? R`Ejes originales. ${M.some((r, i) => r.some((v, j) => i !== j && Math.abs(v) > 1e-12)) ? 'Los términos cruzados inclinan la figura respecto a los ejes.' : 'No hay términos cruzados: la figura ya está alineada con los ejes.'}`
        : t < 0.99 ? R`Girando con $Q^{\mathsf T}$: los autovectores van hacia los ejes. Un giro no cambia formas ni distancias, solo el punto de vista.`
          : R`En los ejes principales la figura queda derecha y la fórmula pierde los términos cruzados.`);
      cY.set(R`\vec y = Q^{\mathsf T}\vec x \;\Rightarrow\; q = ${sumY}`);

      const [cname, ckind] = classify(lams);
      cL.set(lams.map((l, i) => clr(EC[i], R`\lambda_${i + 1} = ${fmt(l)}`)).join(',\\quad '));
      const shape = md === 'plano'
        ? { 'definida positiva': 'las curvas de nivel son elipses y $q > 0$ fuera del origen', 'definida negativa': 'elipses también, pero con $q < 0$ fuera del origen', 'indefinida': 'las curvas son hipérbolas: $q > 0$ en unas direcciones (naranja) y $q < 0$ en otras (azul), separadas por las rectas grises donde $q = 0$', 'semidefinida positiva': 'las curvas son pares de rectas paralelas: $q \\ge 0$ y vale 0 sobre la recta gris (el núcleo)', 'semidefinida negativa': 'pares de rectas paralelas, con $q \\le 0$', nula: '$q = 0$ en todas partes' }[cname]
        : md === 'grafica'
          ? { 'definida positiva': 'la gráfica es un <b>cuenco</b>: el origen es un mínimo estricto', 'definida negativa': 'la gráfica es un cuenco al revés: el origen es un máximo estricto', 'indefinida': 'la gráfica es una <b>silla de montar</b>: sube en una dirección principal y baja en la otra', 'semidefinida positiva': 'la gráfica es un <b>canal</b>: mínimo, pero no estricto (vale 0 en toda una recta)', 'semidefinida negativa': 'un canal al revés', nula: 'la gráfica es el plano $z = 0$' }[cname]
          : R`la superficie $q = ${fmt(st.c)}$ es ${cache.quad.name}`;
      nC.set(ckind, R`$q$ es <b>${cname}</b>: ${shape}.`);
      const minors = Array.from({ length: m }, (_, k) => (k === 0 ? M[0][0] : det(M.slice(0, k + 1).map((r) => r.slice(0, k + 1)))));
      cS.set(minors.map((d, k) => R`\Delta_${k + 1} = ${fmt(d)}`).join(',\\quad '));
      const allPos = minors.every((d) => d > 1e-9), alt = minors.every((d, k) => (k % 2 ? d > 1e-9 : d < -1e-9));
      nS.set('', R`Sylvester: ${allPos ? 'todos los $\\Delta_k > 0$, así que es definida positiva (coincide con los $\\lambda$).' : alt ? 'los $\\Delta_k$ alternan $-, +, \\dots$: definida negativa.' : 'no son todos positivos ni alternan, así que <b>no</b> es definida (ni positiva ni negativa). Para distinguir semidefinida de indefinida, mira los $\\lambda$.'}`);

      cX.set(R`\begin{gathered}q(\vec x) = ${polyQ(M).replace(/([xyz])/g, (v) => `(${fmt(x[vars.indexOf(v)])})`)} = ${fmt(qx)} \\[4pt] \vec y = Q^{\mathsf T}\vec x = ${tv(yv)},\quad ${lams.map((l, i) => clr(EC[i], `${fmt(l)}(${fmt(yv[i])})^2`)).join(' + ')} = ${fmt(qx)}\end{gathered}`);
      const nx = Math.hypot(...x);
      nX.set(qx > 1e-9 ? 'pos' : qx < -1e-9 ? 'neg' : '', md === 'nivel'
        ? R`$q(\vec x) = ${fmt(qx)}$ ${Math.abs(qx - st.c) < 0.05 ? `: $\\vec x$ está sobre la superficie` : qx < st.c ? R`$< c$` : R`$> c$`}. Arrastra $\vec x$ y mira el signo.`
        : R`$q(\vec x) = ${fmt(qx)}$.${nx > 1e-9 ? R` Dividido entre $\|\vec x\|^2$ da ${fmt(qx / (nx * nx))}, que siempre queda entre $\lambda_{\min} = ${fmt(lams[m - 1])}$ y $\lambda_{\max} = ${fmt(lams[0])}$.` : ''}`);
    }

    build();
    update();
    return { destroy: () => stop() };
  },
};
