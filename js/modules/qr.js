import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, col, matMul, transpose, qrDecomp, orthoPath, det, fmt, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS, basisColors } from '../core/presets.js';

const AC = [C.u, C.v, '#20c997']; // columnas de A (como en Gram-Schmidt)
const PRE = {
  2: [
    ['Como en Gram-Schmidt', [[3, 2], [1, 2.5]]],
    ['Cizalla', [[1, 1], [0, 1]]],
    ['Ya triangular', [[2, 1], [0, 1.5]]],
    ['Con reflexión', [[1, 2], [2, 1]]],
  ],
  3: [
    ['Como en Gram-Schmidt', [[2, 1, 1], [0, 2, 1], [1, 0, 2]]],
    ['Ya triangular', [[1, 1, 1], [0, 1, 1], [0, 0, 1]]],
    ['Con reflexión', [[0, 1, 0], [1, 0, 0], [0, 0, 2]]],
    ['Columnas dependientes', [[1, 0, 1], [0, 1, 1], [1, 1, 2]]],
  ],
};

const state = {
  2: { A: PRE[2][0][1], s: 2 },
  3: { A: PRE[3][0][1], s: 2 },
};

export default {
  id: 'qr',
  title: 'Factorización QR',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    let F = qrDecomp(st.A);
    // s ∈ [0,1]: se aplica R.  s ∈ [1,2]: se aplica Q encima.
    const M = () => {
      if (F.failAt >= 0) return st.A;
      return st.s <= 1 ? lerpMat(I, F.R, st.s) : matMul(orthoPath(F.Q, st.s - 1), F.R);
    };
    const frame = () => (F.failAt >= 0 || st.s <= 1 ? I : orthoPath(F.Q, st.s - 1));
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.4 : 0.25 });
    const target = AC.slice(0, n).map((c, j) => new Arrow(stage, c, { opacity: 0.3, radius: 0.025, label: R`\vec a_${j + 1}` }));
    const axes = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { opacity: 0.85, radius: 0.025, label: b.tex }));
    const cols = AC.slice(0, n).map((c, j) => new Arrow(stage, c, { radius: 0.05, label: R`\vec r_${j + 1}` }));
    AC.slice(0, n).forEach((c, j) => stage.addHandle({
      color: c, get: () => col(st.A, j),
      set: (p) => { stop(); st.A = st.A.map((r, i) => r.map((x, k) => (k === j ? p[i] : x))); st.s = 2; update(); },
    }));

    // --- panel ---
    const run = (a, b) => { stop(); st.s = a; update(); stop = animate(a, b, 1300 * (b - a), (v) => { st.s = v; update(); }); };
    const me = matEditor({ dim, colors: AC.slice(0, n), get: () => st.A, set: (A) => { stop(); st.A = A; st.s = 2; update(); } });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); run(0, 2); } }, name)));
    const ss = slider({ label: 's', min: 0, max: 2, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const phase = new Note();
    const cQR = new TexBox(), cR = new TexBox(), cChk = new TexBox(), nQR = new Note(), cUse = new TexBox();

    panel.append(
      ...intro('Factorización QR',
        R`Es <b>Gram-Schmidt escrito como matrices</b>. Las columnas de $A$ se reemplazan por una base ortonormal (las columnas de $Q$), y lo que se fue restando y dividiendo queda guardado en $R$, que es <b>triangular superior</b>. Geométricamente, $A = QR$ es: primero $R$ (estirar y cizallar sin salirse de los ejes «en orden»), luego $Q$ (solo girar o reflejar).`),
      card('Matriz A (sus columnas son los vectores)', me.el, pre),
      card('Paso a paso', ss.el,
        buttonRow(button('1 · Aplicar R', () => run(0, 1)), button('2 · Aplicar Q', () => run(1, 2)), button('▶ Todo', () => run(0, 2), 'primary')),
        phase.el),
      card('Las piezas', cQR.el, rich(R`Las entradas de $R$ son justo los números de Gram-Schmidt:`), cR.el, cChk.el, nQR.el),
      card('Para qué sirve', cUse.el,
        rich(R`En <b>mínimos cuadrados</b>, en vez de las ecuaciones normales $A^{\mathsf T}A\hat x = A^{\mathsf T}\vec b$ se resuelve $R\hat x = Q^{\mathsf T}\vec b$: un sistema triangular, más rápido y numéricamente más estable. También es la base del algoritmo QR que usan las computadoras para calcular autovalores.`)),
      details('Definición formal',
        rich(R`Si las columnas de $A$ son independientes, $A = QR$ con $Q^{\mathsf T}Q = I$ y $R$ triangular superior con diagonal positiva. Es única con esa condición.`),
        rich(R`$r_{ij} = \vec q_i\cdot\vec a_j$ para $i < j$ (la sombra de $\vec a_j$ sobre $\vec q_i$), $r_{jj} = \|\vec w_j\|$ (lo que queda de $\vec a_j$ tras quitarle las sombras) y $r_{ij} = 0$ para $i > j$: $\vec a_j$ solo usa $\vec q_1, \dots, \vec q_j$.`),
        rich(R`Como $\det Q = \pm1$, $|\det A| = r_{11}\cdots r_{nn}$.`)),
      tryList([
        R`Pulsa «1 · Aplicar R»: la primera columna se queda sobre el eje $x$${dim === 3 ? ' y la segunda dentro del plano $xy$' : ''}. Eso es lo que significa «triangular».`,
        R`Luego «2 · Aplicar Q»: todo gira rígido, sin deformarse, hasta las columnas reales de $A$.`,
        R`Con «Ya triangular», $Q = I$: no hace falta girar nada.`,
        R`Con «Con reflexión», $\det A < 0$: $Q$ tiene que voltear el espacio, no le basta con girar.`,
        R`Arrastra las puntas de las columnas $\vec a_j$ y mira cómo cambian $Q$ y $R$.`,
      ]),
    );

    function update() {
      F = qrDecomp(st.A);
      const Mt = M(), Fr = frame();
      grid.setMatrix(Mt);
      target.forEach((a, j) => a.set(O, col(st.A, j)));
      axes.forEach((a, j) => a.setVisible(F.failAt < 0).set(O, col(Fr, j))
        .setLabel(st.s > 1.01 && F.failAt < 0 ? R`\vec q_${j + 1}` : BASIS[j].tex));
      cols.forEach((a, j) => a.set(O, col(Mt, j)).setLabel(st.s > 0.02 && st.s <= 1.01 ? R`\vec r_${j + 1}` : ''));
      [me, ss].forEach((c) => c.refresh());

      if (F.failAt >= 0) {
        phase.set('neg', R`La columna $\vec a_${F.failAt + 1}$ es combinación de las anteriores: Gram-Schmidt se detiene ($\vec w_${F.failAt + 1} = \vec 0$) y no hay $Q$ cuadrada. QR completa exige columnas independientes.`);
        cQR.set(R`A = ${tm(st.A)}`); cR.set(''); cChk.set('');
        nQR.set('neg', R`$\det A = ${fmt(det(st.A))}$: la matriz es singular.`);
        cUse.set('');
        return;
      }
      const v = st.s;
      phase.set(v > 1.99 ? 'pos' : '', v < 0.01 ? 'Espacio original. Las flechas gruesas serán las columnas.'
        : v < 0.99 ? R`Aplicando $R$: estira y cizalla, pero la primera columna no se sale del eje $x$.`
          : v < 1.01 ? R`Después de $R$: las columnas gruesas son las de $R$, escritas en los ejes de siempre.`
            : v < 1.99 ? R`Aplicando $Q$: los ejes giran rígidos hasta $\vec q_1, \dots, \vec q_${n}$ y arrastran todo con ellos.`
              : R`Resultado: las columnas gruesas coinciden con las de $A$. Es decir, $QR = A$.`);

      const { Q, R: Rm } = F;
      cQR.set(R`${tm(st.A)} = \underbrace{${tm(Q)}}_{Q}\,\underbrace{${tm(Rm)}}_{R}`);
      const entries = [];
      for (let j = 0; j < n; j++) for (let i = 0; i <= j; i++) {
        entries.push(i === j ? R`r_{${i + 1}${j + 1}} = \|\vec w_${j + 1}\| = ${fmt(Rm[i][j])}` : R`r_{${i + 1}${j + 1}} = \vec q_${i + 1}\cdot\vec a_${j + 1} = ${fmt(Rm[i][j])}`);
      }
      cR.set(entries.join(',\\quad '));
      cChk.set(R`Q^{\mathsf T}Q = ${tm(matMul(transpose(Q), Q))}`);
      const dq = det(Q);
      nQR.set('pos', dq > 0
        ? R`$Q^{\mathsf T}Q = I$: columnas de largo 1 y perpendiculares. $\det Q = 1$, así que $Q$ es una <b>rotación</b>.`
        : R`$Q^{\mathsf T}Q = I$, pero $\det Q = -1$: $Q$ es una rotación seguida de una <b>reflexión</b> (porque $\det A < 0$).`);
      cUse.set(R`|\det A| = ${Rm.map((r, i) => fmt(r[i])).join('\\cdot')} = ${fmt(Math.abs(det(st.A)))}`);
    }

    update();
    return { destroy: () => stop() };
  },
};
