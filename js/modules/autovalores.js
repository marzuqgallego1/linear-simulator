import { Arrow, Lattice, Polyline, C } from '../core/stage.js';
import { identity, lerpMat, matVec, eigen, polyTex, scale, dot, norm, cross, normalize, fmt, tv, tm, clr, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { basisColors } from '../core/presets.js';
import { LineView, PlaneView } from '../core/geom.js';

const EC = [C.u, C.v, '#20c997']; // un color por autovalor

const PRESETS = {
  2: [
    ['Simétrica', [[2, 1], [1, 2]]],
    ['Escalado', [[2, 0], [0, 0.5]]],
    ['General', [[1, 1], [0, 2]]],
    ['Reflexión', [[0, 1], [1, 0]]],
    ['Proyección', [[1, 0], [0, 0]]],
    ['Cizalla', [[1, 1], [0, 1]]],
    ['Rotación 90°', [[0, -1], [1, 0]]],
    ['A = 2I', [[2, 0], [0, 2]]],
  ],
  3: [
    ['Diagonal', [[2, 0, 0], [0, 1, 0], [0, 0, 0.5]]],
    ['Simétrica', [[2, 1, 0], [1, 2, 0], [0, 0, 3]]],
    ['General', [[2, 0, 1], [1, 1, 0], [0, 0, 3]]],
    ['Cizalla', [[1, 1, 0], [0, 1, 0], [0, 0, 2]]],
    ['Rotación (eje z)', [[0, -1, 0], [1, 0, 0], [0, 0, 1]]],
  ],
};

const state = {
  2: { A: PRESETS[2][0][1], v: [2, 0.5], t: 1 },
  3: { A: PRESETS[3][1][1], v: [1, 0, 1], t: 1 },
};

export default {
  id: 'autovalores',
  title: 'Autovalores y autovectores',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const M = () => lerpMat(I, s.A, s.t);
    let stop = () => {};
    const L = 40;

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.35 : 0.2 });
    const eLines = EC.map((c) => new LineView(stage, c, { radius: 0.03 }));
    const ePlanes = dim === 3 ? EC.map((c) => new PlaneView(stage, c, { opacity: 0.12 })) : [];
    const eArrows = EC.map((c, i) => new Arrow(stage, c, { label: R`\vec v_${i + 1}`, radius: 0.045 }));
    const circle = dim === 2 ? new Polyline(stage, C.x, { opacity: 0.3, dashed: true, dash: 0.1 }) : null;
    const ellipse = dim === 2 ? new Polyline(stage, C.w, { opacity: 0.55 }) : null;
    const vg = new Arrow(stage, C.x, { opacity: 0.4, radius: 0.025, label: R`\vec v` });
    const Av = new Arrow(stage, C.w, { label: R`A\vec v` });
    stage.addHandle({ color: C.x, get: () => s.v, set: (p) => { stop(); s.v = p; update(); } });

    // --- panel ---
    const me = matEditor({ dim, colors: basisColors(n), get: () => s.A, set: (A) => { stop(); s.A = A; s.t = 1; update(); } });
    const presets = h('div', { class: 'presets' }, PRESETS[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { s.A = A.map((r) => [...r]); play(); } }, name)));
    const st = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const play = () => { stop(); stop = animate(0, 1, 1600, (t) => { s.t = t; update(); }); };
    const ev = vecEditor({ name: R`\vec v`, color: C.x, dim, get: () => s.v, set: (v) => { stop(); s.v = v; update(); } });
    const sweep = () => {
      stop();
      s.t = 1;
      const r = norm(s.v) || 2, a0 = Math.atan2(s.v[1], s.v[0]);
      stop = animate(0, 2 * Math.PI, 6000, (a) => { s.v = [r * Math.cos(a0 + a), r * Math.sin(a0 + a)]; update(); });
    };
    const noteV = new Note(), noteE = new Note();
    const cPoly = new TexBox(), cRoots = new TexBox();
    const vecBoxes = h('div');

    panel.append(
      ...intro('Autovalores y autovectores',
        R`Al aplicar una matriz, casi todos los vectores cambian de dirección. Los <b>autovectores</b> son los especiales: se quedan en su misma recta y solo se estiran, se encogen o se invierten. El factor por el que se multiplican es su <b>autovalor</b> $\lambda$: $A\vec v = \lambda\vec v$.`),
      card('Matriz A', me.el, presets),
      card('Aplicar la transformación', st.el, buttonRow(button('▶ Animar', play, 'primary')),
        rich('Las rectas de colores son las direcciones propias: mientras la rejilla se deforma, las flechas de color no salen de su recta.', 'p', 'note')),
      card('Vector de prueba', ev.el,
        dim === 2 ? buttonRow(button('↻ Barrer (girar v)', sweep)) : null,
        dim === 2 ? rich(R`La circunferencia punteada son todos los $\vec v$ de esa longitud; la curva amarilla es donde los manda $A$. Al barrer, fíjate en cuándo $A\vec v$ queda sobre la recta de $\vec v$.`, 'p') : null,
        noteV.el),
      card('Cálculo', rich(R`Buscamos $\lambda$ tal que $(A - \lambda I)\vec v = \vec 0$ tenga soluciones no nulas, es decir, que $A - \lambda I$ aplaste algo: $\det(A - \lambda I) = 0$.`),
        cPoly.el, cRoots.el, noteE.el, vecBoxes),
      details('Definición formal',
        rich(R`$\lambda$ es un <b>autovalor</b> de $A$ si existe $\vec v\neq\vec 0$ con $A\vec v = \lambda\vec v$; ese $\vec v$ es un <b>autovector</b>. Todos los autovectores de un mismo $\lambda$ (más el $\vec 0$) forman su <b>espacio propio</b>: el núcleo de $A - \lambda I$.`),
        rich(R`Los autovalores son las raíces del <b>polinomio característico</b> $\det(A - \lambda I)$, de grado $n$. Cuando todas son reales: $\lambda_1 + \dots + \lambda_n = \text{tr}(A)$ y $\lambda_1\cdots\lambda_n = \det A$.`),
        rich(R`Si $A$ es <b>simétrica</b>, todos sus autovalores son reales y sus autovectores son perpendiculares entre sí.`),
        rich(R`Algunas matrices, como las rotaciones, tienen raíces que no son números reales. Aquí solo trabajamos con reales: en ese caso decimos que <b>no hay direcciones que se conserven</b>.`)),
      tryList([
        R`Pulsa «Simétrica» y anima: las dos rectas propias son perpendiculares y la rejilla se estira a lo largo de ellas.`,
        dim === 2 ? R`Pulsa «Barrer»: $\vec v$ y $A\vec v$ quedan alineados justo cuatro veces, dos por cada recta propia.` : R`Pulsa «Simétrica»: $\lambda = 3$ tiene todo un <b>plano</b> de autovectores.`,
        R`Pulsa «Rotación»: ninguna recta (que pase por el origen y esté en el plano de giro) se conserva.`,
        dim === 2 ? R`Pulsa «Cizalla»: hay un solo autovalor ($\lambda = 1$) y una sola recta propia, no dos.` : R`Pulsa «Cizalla»: $\lambda = 1$ es raíz doble, pero solo tiene una recta de autovectores.`,
      ]),
    );

    function update() {
      const Mt = M();
      const E = eigen(s.A);
      grid.setMatrix(Mt);

      // espacios propios
      eLines.forEach((l) => l.setVisible(false));
      ePlanes.forEach((p) => p.setVisible(false));
      eArrows.forEach((a) => a.setVisible(false));
      E.values.forEach(({ vectors }, i) => {
        if (vectors.length === 1) {
          const e = vectors[0], shown = scale(normalize(e), 2);
          eLines[i].setVisible(true).set(O, e);
          eArrows[i].setVisible(true).set(O, matVec(Mt, shown));
        } else if (vectors.length === 2 && dim === 3) {
          ePlanes[i].setVisible(true).set(O, cross(vectors[0], vectors[1]));
          eArrows[i].setVisible(true).set(O, matVec(Mt, scale(normalize(vectors[0]), 2)));
        }
      });

      // vector de prueba
      vg.set(O, s.v);
      Av.set(O, matVec(Mt, s.v));
      if (circle) {
        const r = norm(s.v);
        const pts = Array.from({ length: 97 }, (_, k) => { const a = (2 * Math.PI * k) / 96; return [r * Math.cos(a), r * Math.sin(a)]; });
        circle.setVisible(r > EPS).set(pts);
        ellipse.setVisible(r > EPS).set(pts.map((p) => matVec(Mt, p)));
      }

      me.refresh(); st.refresh(); ev.refresh();

      // nota del vector de prueba (siempre con A completa)
      const w = matVec(s.A, s.v), nv = norm(s.v), nw = norm(w);
      if (nv < EPS) noteV.set('', R`$\vec v = \vec 0$ no cuenta: un autovector tiene que ser no nulo.`);
      else if (nw < 1e-9) noteV.set('pos', R`$A\vec v = \vec 0 = 0\cdot\vec v$: $\vec v$ es autovector con $\lambda = 0$ (la matriz lo aplasta).`);
      else {
        const sin = norm(dim === 2 ? [s.v[0] * w[1] - s.v[1] * w[0]] : cross(s.v, w)) / (nv * nw);
        const lam = dot(w, s.v) / (nv * nv);
        if (sin < 0.01) noteV.set('pos', R`<b>¡$\vec v$ es autovector!</b> $A\vec v = ${tv(w)} = ${fmt(lam)}\,\vec v$, así que $\lambda = ${fmt(lam)}$.`);
        else noteV.set('', R`$A\vec v = ${tv(w)}$ apunta en otra dirección que $\vec v$: no es autovector.`);
      }

      // cálculo
      const lam = R`\lambda`;
      cPoly.set(dim === 2
        ? R`\det(A - ${lam} I) = ${lam}^2 - (\text{tr}A)\,${lam} + \det A = ${polyTex(E.poly)}`
        : R`\det(${lam} I - A) = ${polyTex(E.poly)}`);
      const roots = E.values.map((v) => v.lambda);
      if (dim === 2) {
        const disc = E.tr * E.tr - 4 * E.poly[2];
        cRoots.set(R`\Delta = (\text{tr}A)^2 - 4\det A = ${fmt(disc)}` + (roots.length ? R`\;\Rightarrow\; ${roots.map((r, i) => `\\lambda_${i + 1} = ${clr(EC[i], fmt(r))}`).join(',\\ ')}` : R`< 0`));
      } else {
        cRoots.set(roots.map((r, i) => `\\lambda_${i + 1} = ${clr(EC[i], fmt(r))}`).join(',\\quad '));
      }

      const total = E.values.reduce((k, v) => k + v.vectors.length, 0);
      if (!roots.length) noteE.set('neg', R`<b>No hay autovalores reales</b> (el discriminante es negativo): ninguna dirección se conserva. Es lo que hace una rotación: <i>todo</i> gira.`);
      else if (E.values.some((v) => v.vectors.length === n)) noteE.set('pos', R`$A = ${fmt(roots[0])}I$: <b>todos</b> los vectores son autovectores. La matriz estira todo por igual, sin girar nada.`);
      else if (total < n) noteE.set('zero', dim === 2
        ? R`El autovalor es una raíz <b>doble</b>, pero solo tiene una recta de autovectores: no hay una base de autovectores (la matriz no es <b>diagonalizable</b>).`
        : R`Solo hay ${total > 1 ? `${total} direcciones propias independientes` : '1 dirección propia'}, menos que 3: o alguna raíz no es real, o una raíz repetida tiene menos autovectores. No hay una base de autovectores.`);
      else noteE.set('pos', R`Hay ${n} direcciones propias independientes: forman una <b>base de autovectores</b>. En esa base, $A$ solo estira cada eje (es diagonal).`);

      const src = E.values.map(({ lambda, B, vectors }, i) => {
        const space = vectors.length === n ? R`\text{todo } \mathbb{R}^${n}`
          : vectors.length === 1 ? clr(EC[i], tv(vectors[0]))
            : vectors.map((v, k) => `${['s', 't'][k]}\\,${clr(EC[i], tv(v))}`).join(' + ');
        return R`\lambda_${i + 1} = ${fmt(lambda)}:\quad A - ${fmt(lambda)}I = ${tm(B)} \;\Rightarrow\; \vec v_${i + 1} = ${space}`;
      }).join('|');
      if (vecBoxes.dataset.src !== src) {
        vecBoxes.dataset.src = src;
        vecBoxes.replaceChildren(...src.split('|').filter(Boolean).map((x) => { const b = new TexBox(); b.set(x); return b.el; }));
      }
    }

    update();
    return { destroy: () => stop() };
  },
};
