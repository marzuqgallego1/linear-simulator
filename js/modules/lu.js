import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, col, matMul, matVec, luDecomp, fmt, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS, basisColors } from '../core/presets.js';

const PIV = '#ffd43b', MUL = '#cc5de8';
const PRE = {
  2: [
    ['Sencilla', [[2, 1], [4, 5]]],
    ['Pivote cero', [[0, 1], [2, 3]]],
    ['Singular', [[1, 2], [2, 4]]],
  ],
  3: [
    ['Sencilla', [[2, 1, 1], [4, 3, 3], [8, 7, 9]]],
    ['Pivote cero al inicio', [[0, 2, 1], [1, 1, 0], [2, 1, 1]]],
    ['Pivote cero a mitad', [[1, 2, 3], [2, 4, 7], [1, 3, 4]]],
    ['Singular', [[1, 2, 3], [4, 5, 6], [7, 8, 9]]],
  ],
};

const state = {
  2: { A: PRE[2][0][1], k: 99, s: 2, b: [3, 9] },
  3: { A: PRE[3][0][1], k: 99, s: 2, b: [4, 10, 24] },
};

/** Matriz en LaTeX coloreando algunas entradas. */
const tmc = (M, color) => R`\begin{bmatrix}${M.map((r, i) => r.map((x, j) => { const c = color(i, j, x); return c ? clr(c, fmt(x)) : fmt(x); }).join('&')).join('\\\\')}\end{bmatrix}`;

export default {
  id: 'lu',
  title: 'Factorización LU',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    let F = luDecomp(st.A);
    const M = () => (st.s <= 1 ? lerpMat(I, F.U, st.s) : matMul(lerpMat(I, F.L, st.s - 1), F.U));
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.45 : 0.28 });
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));

    // --- panel ---
    const run = (a, b) => { stop(); st.s = a; update(); stop = animate(a, b, 1300 * (b - a), (v) => { st.s = v; update(); }); };
    const reset = () => { stop(); st.k = 0; st.s = 2; update(); };
    const me = matEditor({ dim, colors: basisColors(n), get: () => st.A, set: (A) => { stop(); st.A = A; st.k = 99; st.s = 2; update(); } });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); reset(); } }, name)));
    const ks = slider({ label: R`\text{paso}`, min: 0, max: 1, step: 1, get: () => Math.min(st.k, F.steps.length), set: (k) => { st.k = k; update(); }, format: (k) => `${k}/${F.steps.length}` });
    const cStep = new TexBox(), nStep = new Note();
    const cRes = new TexBox(), nRes = new Note();
    const eb = vecEditor({ name: R`\vec b`, color: C.w, dim, get: () => st.b, set: (v) => { st.b = v; update(); } });
    const cF = new TexBox(), cB = new TexBox(), cX = new TexBox(), nX = new Note();
    const ss = slider({ label: 's', min: 0, max: 2, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const phase = new Note();

    panel.append(
      ...intro('Factorización LU',
        R`Es la <b>eliminación gaussiana guardada</b>. Al escalonar $A$ se obtiene una matriz triangular superior $U$; los números por los que se multiplicó cada fila (los <b>multiplicadores</b>) se apuntan en una triangular inferior $L$. Resultado: $A = LU$. Si algún pivote es 0 hay que intercambiar filas, y entonces se escribe $PA = LU$.`),
      card('Matriz A', me.el, pre),
      card('Eliminación paso a paso', ks.el,
        buttonRow(button('◀ Anterior', () => { st.k = Math.max(0, Math.min(st.k, F.steps.length) - 1); update(); }),
          button('Siguiente ▶', () => { st.k = Math.min(F.steps.length, st.k + 1); update(); }, 'primary')),
        cStep.el, nStep.el),
      card('Resultado', cRes.el, nRes.el),
      card(R`Resolver A x = b`, rich(R`Con $L$ y $U$ ya calculadas, cada sistema nuevo se resuelve con dos sistemas <b>triangulares</b>, que se despejan de arriba abajo y de abajo arriba sin volver a escalonar.`),
        eb.el, cF.el, cB.el, cX.el, nX.el),
      card('Como transformaciones', ss.el,
        buttonRow(button('1 · Aplicar U', () => run(0, 1)), button('2 · Aplicar L', () => run(1, 2)), button('▶ Todo', () => run(0, 2), 'primary')),
        phase.el),
      details('Definición formal',
        rich(R`$L$ es triangular inferior con unos en la diagonal: $l_{ij} = m_{ij}$, el multiplicador usado en $F_i \leftarrow F_i - m_{ij}F_j$. $U$ es la forma escalonada (sin normalizar los pivotes).`),
        rich(R`$P$ es una <b>matriz de permutación</b>: la identidad con las filas reordenadas. Multiplicar $PA$ reordena las filas de $A$ igual que los intercambios de la eliminación.`),
        rich(R`Para resolver $A\vec x = \vec b$: $L\vec c = P\vec b$ (sustitución hacia adelante) y luego $U\vec x = \vec c$ (sustitución hacia atrás). Además $\det A = \pm\, u_{11}\cdots u_{nn}$ (signo $-$ si hubo un número impar de intercambios).`),
        rich(R`Ventaja: factorizar cuesta del orden de $n^3$ operaciones, pero cada $\vec b$ nuevo solo $n^2$. Es lo que hacen las calculadoras y los programas al resolver sistemas.`)),
      tryList([
        R`Avanza paso a paso y compara: el número que se resta en $U$ (multiplicador) aparece en morado en la misma posición de $L$.`,
        R`Con «Pivote cero», el primer paso es un intercambio de filas: sin él habría que dividir entre 0.`,
        dim === 3 ? R`Con «Pivote cero a mitad», el intercambio llega después de eliminar: mira cómo los multiplicadores ya guardados en $L$ también cambian de fila.` : R`Cambia $\vec b$: $L$ y $U$ no cambian, solo se repiten las dos sustituciones.`,
        R`Con «Singular», sale un 0 en la diagonal de $U$: la factorización existe, pero la sustitución hacia atrás falla.`,
      ]),
    );

    function update() {
      F = luDecomp(st.A);
      const N = F.steps.length, k = Math.min(st.k, N);
      ks.input.max = String(N);
      const swaps = F.steps.filter((s) => s.kind === 'swap').length;
      const hasP = swaps > 0;

      // escena
      const Mt = M();
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, col(Mt, j)));
      [me, ks, eb, ss].forEach((c) => c.refresh());

      // paso actual
      const cur = k === 0 ? { U: st.A, L: I, perm: [...Array(n).keys()] } : F.steps[k - 1];
      const done = new Set(F.steps.slice(0, k).filter((s) => s.kind === 'elim').map((s) => `${s.r},${s.c}`));
      const pivCols = new Set(F.steps.slice(0, k).filter((s) => s.kind !== 'skip').map((s) => s.c));
      const Ut = tmc(cur.U, (i, j) => (i === j && pivCols.has(j) ? PIV : null));
      const Lt = tmc(cur.L, (i, j) => (done.has(`${i},${j}`) || (i > j && Math.abs(cur.L[i][j]) > 1e-12) ? MUL : null));
      const head = k === 0 ? R`\text{inicio}` : R`\text{paso ${k}: } ${cur.op}`;
      cStep.set(R`${head}\qquad U = ${Ut},\quad L = ${Lt}`);
      if (k === 0) nStep.set('', R`Al principio $U = A$ y $L = I$. En cada paso se usa el <b>pivote</b> (amarillo) para hacer ceros debajo de él.`);
      else if (cur.kind === 'elim') {
        const prev = k === 1 ? st.A : F.steps[k - 2].U;
        nStep.set('', R`Multiplicador $m_{${cur.r + 1}${cur.c + 1}} = \dfrac{${fmt(prev[cur.r][cur.c])}}{${fmt(prev[cur.c][cur.c])}} = ${fmt(cur.m)}$: es lo que hay que restar de la fila ${cur.c + 1} para hacer un cero debajo del pivote. Ese número se apunta en $L$ en la posición $(${cur.r + 1},${cur.c + 1})$.`);
      } else if (cur.kind === 'swap') {
        nStep.set('neg', R`El pivote de la columna ${cur.c + 1} es 0 y no se puede dividir entre él. Se intercambian las filas ${cur.c + 1} y ${cur.r + 1} (y los multiplicadores ya guardados en esas filas de $L$). Se anota en $P$.`);
      } else {
        nStep.set('neg', R`La columna ${cur.c + 1} no tiene ningún número distinto de 0 desde la diagonal hacia abajo: no hay pivote. Queda un 0 en la diagonal de $U$ y la matriz es singular.`);
      }

      // resultado
      const PA = matMul(F.P, st.A), LU = matMul(F.L, F.U);
      const lhs = hasP ? R`\underbrace{${tm(F.P)}}_{P}${tm(st.A)}` : tm(st.A);
      cRes.set(R`${lhs} = \underbrace{${tmc(F.L, (i, j) => (i > j && F.L[i][j] ? MUL : null))}}_{L}\,\underbrace{${tmc(F.U, (i, j) => (i === j ? PIV : null))}}_{U}`);
      const ok = PA.every((r, i) => r.every((x, j) => Math.abs(x - LU[i][j]) < 1e-9));
      const prod = F.U.reduce((p, r, i) => p * r[i], 1);
      nRes.set(ok ? 'pos' : 'neg', R`${hasP ? `$PA = LU$ con ${swaps} intercambio${swaps > 1 ? 's' : ''}.` : '$A = LU$, sin intercambios.'} $\det A = ${swaps % 2 ? '-' : ''}(${F.U.map((r, i) => fmt(r[i])).join(')(')}) = ${fmt((swaps % 2 ? -1 : 1) * prod)}$: el producto de los pivotes${swaps % 2 ? ', cambiado de signo' : ''}.`);

      // resolver
      const Pb = matVec(F.P, st.b);
      const c = [];
      for (let i = 0; i < n; i++) c.push(Pb[i] - F.L[i].slice(0, i).reduce((s, l, j) => s + l * c[j], 0));
      cF.set(R`\text{1) } L\vec c = ${hasP ? 'P' : ''}\vec b:\quad ${tm(F.L)}\vec c = ${clr(C.w, tv(Pb))}\ \Rightarrow\ \vec c = ${tv(c)}`);
      const sing = F.U.some((r, i) => Math.abs(r[i]) < 1e-9);
      if (sing) {
        cB.set(R`\text{2) } U\vec x = \vec c:\quad ${tm(F.U)}\vec x = ${tv(c)}`);
        cX.set('');
        nX.set('neg', R`Hay un 0 en la diagonal de $U$: al despejar de abajo arriba habría que dividir entre 0. $A$ es singular, así que el sistema no tiene solución única (puede no tener ninguna o tener infinitas; ver el módulo de Sistemas).`);
        phase.set('', 'Como U tiene un pivote 0, la rejilla se aplasta en el primer paso.');
      } else {
        const x = Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) x[i] = (c[i] - F.U[i].slice(i + 1).reduce((s, u, j) => s + u * x[i + 1 + j], 0)) / F.U[i][i];
        cB.set(R`\text{2) } U\vec x = \vec c:\quad ${tm(F.U)}\vec x = ${tv(c)}\ \Rightarrow\ \vec x = ${clr(C.x, tv(x))}`);
        cX.set(R`\text{Comprobación: } A\vec x = ${tv(matVec(st.A, x))} = \vec b`);
        nX.set('pos', R`El paso 1 se despeja de arriba abajo (la primera ecuación tiene una sola incógnita) y el paso 2 de abajo arriba. Ningún paso requiere escalonar otra vez.`);
      }
      if (!sing) {
        const v = st.s;
        phase.set(v > 1.99 ? 'pos' : '', v < 0.01 ? 'Espacio original.'
          : v < 0.99 ? R`Aplicando $U$: el eje $x$ solo se estira (la primera columna de $U$ tiene un único número).`
            : v < 1.01 ? R`Después de $U$. Ahora $L$: cizallas que inclinan cada eje solo hacia los ejes que vienen después (por eso es triangular inferior).`
              : v < 1.99 ? R`Aplicando $L$…` : R`Resultado: la rejilla de ${hasP ? '$PA$ ($A$ con las filas reordenadas)' : '$A$'}.`);
      }
    }

    update();
    return { destroy: () => stop() };
  },
};
