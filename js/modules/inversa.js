import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, col, matVec, matMul, inverse, adjugate, nullVector, det, add, scale, fmt, tv, tm, clr, EPS } from '../core/math.js';
import { R, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate, tabs, Stepper } from '../core/ui.js';
import { BASIS, basisColors, presetButtons } from '../core/presets.js';

const state = {
  2: { A: [[2, 1], [1, 1]], x: [1, 1], s: 0, tab: 'exp', step: 0 },
  3: { A: [[1, 1, 0], [0, 1, 1], [1, 0, 1]], x: [1, 0, 1], s: 0, tab: 'exp', step: 0 },
};

const PIV = C.w, ROW = '#20c997';
const AX = ['x', 'y', 'z'];
const tidy = (x) => (Math.abs(x) < 1e-10 ? 0 : x);

/** [A | I] en LaTeX, con la fila modificada y el pivote resaltados. */
function taugI(M, n, row = -1, piv = null) {
  const cell = (x, i, j) => {
    if (piv && piv[0] === i && piv[1] === j) return clr(PIV, fmt(x));
    return i === row ? clr(ROW, fmt(x)) : fmt(x);
  };
  return `\\left[\\begin{array}{${'c'.repeat(n)}|${'c'.repeat(n)}}${M.map((r, i) => r.map((x, j) => cell(x, i, j)).join('&')).join('\\\\')}\\end{array}\\right]`;
}

/** Gauss-Jordan sobre [A | I], guardando cada operación. */
function gaussJordanInv(A) {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...identity(n)[i]]);
  const steps = [];
  const snap = (s) => steps.push({ ...s, M: M.map((r) => r.map(tidy)) });
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let r = c; r < n; r++) if (Math.abs(M[r][c]) > EPS) { p = r; break; }
    if (p < 0) { snap({ kind: 'fail', c }); return { steps, ok: false }; }
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; snap({ kind: 'swap', c, r: p, row: c, op: R`F_${c + 1} \leftrightarrow F_${p + 1}` }); }
    const pv = M[c][c];
    if (Math.abs(pv - 1) > EPS) {
      M[c] = M[c].map((x) => tidy(x / pv));
      snap({ kind: 'scale', c, row: c, pv, op: R`F_${c + 1} \leftarrow \tfrac{1}{${fmt(pv)}}\,F_${c + 1}` });
    }
    for (let r = 0; r < n; r++) {
      if (r === c || Math.abs(M[r][c]) < EPS) continue;
      const f = M[r][c];
      M[r] = M[r].map((x, k) => tidy(x - f * M[c][k]));
      snap({ kind: 'elim', c, r, row: r, f, op: R`F_${r + 1} \leftarrow F_${r + 1} ${f > 0 ? '-' : '+'} ${fmt(Math.abs(f)) === '1' ? '' : fmt(Math.abs(f))}F_${c + 1}` });
    }
  }
  return { steps, ok: true };
}

export default {
  id: 'inversa',
  title: 'Matriz inversa',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const inv = () => inverse(st.A);
    let proc = { steps: [], mats: [] };
    const anim = { from: st.A, to: st.A, t: 1 };
    const procM = () => lerpMat(anim.from, anim.to, anim.t);
    // s ∈ [0,1]: se aplica A poco a poco.  s ∈ [1,2]: se aplica A⁻¹ sobre el resultado.
    const M = () => {
      if (st.tab === 'calc') return procM();
      if (st.s <= 1) return lerpMat(I, st.A, st.s);
      const Ai = inv();
      return Ai ? matMul(lerpMat(I, Ai, st.s - 1), st.A) : st.A;
    };
    const x2 = () => add(st.x, scale(nullVector(st.A), 1.5));
    let stop = () => {};

    function buildProc() {
      const A = st.A, G = gaussJordanInv(A);
      const left = (Mx) => Mx.map((r) => r.slice(0, n));
      const steps = [], mats = [];
      let prev = A.map((r, i) => [...r, ...I[i]]);
      steps.push({
        title: 'Escribir [A | I]',
        tex: R`[\,A \mid I\,] = ${taugI(prev, n)}`,
        why: R`la idea es hacer operaciones de fila hasta que la parte izquierda sea $I$. Cada operación de fila equivale a multiplicar por una matriz elemental $E$, así que si $E_k\cdots E_1A = I$, entonces $E_k\cdots E_1 = A^{-1}$. Poner $I$ a la derecha sirve para ir <b>anotando</b> ese producto: lo que se hace a $A$ se hace también a $I$. La rejilla muestra la parte izquierda: ahora es la deformación de $A$.`,
      });
      mats.push(A);
      for (const s of G.steps) {
        if (s.kind === 'fail') {
          steps.push({
            title: `Columna ${s.c + 1}: no hay pivote`,
            tex: taugI(prev, n, -1),
            note: ['neg', R`<b>$A$ no tiene inversa</b> ($\det A = ${fmt(det(A))}$).`],
            why: R`de la fila ${s.c + 1} hacia abajo, la columna ${s.c + 1} de la izquierda es todo ceros: nunca se podrá conseguir el 1 de $I$ ahí. En la escena, la rejilla está <b>aplastada</b>. Las operaciones de fila son reversibles, así que no pueden «desaplastar» nada: lo que $A$ juntó en un mismo punto ya no se puede separar.`,
          });
          mats.push(left(prev));
          continue;
        }
        const piv = [s.c, s.c];
        const why = s.kind === 'swap'
          ? R`el pivote (${s.c + 1}, ${s.c + 1}) es 0 y hace falta un número distinto de 0 para seguir, así que se trae la fila ${s.r + 1}. Intercambiar filas es un <b>reflejo</b>: en la escena, los ejes $${AX[s.c]}$ y $${AX[s.r]}$ se cambian de lugar.`
          : s.kind === 'scale'
            ? R`se divide la fila ${s.c + 1} entre el pivote ${fmt(s.pv)} para que quede un <b>1</b> en la diagonal, como en $I$. Es <b>estirar o encoger</b> la dirección del eje $${AX[s.c]}$ por $\frac{1}{${fmt(s.pv)}}$${s.pv < 0 ? ' (y voltearla, porque el pivote es negativo)' : ''}.`
            : R`se resta ${fmt(s.f)} veces la fila ${s.c + 1} a la fila ${s.r + 1} para que la entrada (${s.r + 1}, ${s.c + 1}) sea <b>0</b>, como en $I$. Es una <b>cizalla</b>: la rejilla se desliza en la dirección del eje $${AX[s.r]}$ y se endereza un poco más.`;
        steps.push({
          title: s.kind === 'swap' ? `Intercambiar las filas ${s.c + 1} y ${s.r + 1}` : s.kind === 'scale' ? `Poner un 1 en el pivote (${s.c + 1}, ${s.c + 1})` : `Hacer cero la entrada (${s.r + 1}, ${s.c + 1})`,
          tex: [s.op, taugI(s.M, n, s.row, piv)],
          why,
        });
        mats.push(left(s.M));
        prev = s.M;
      }
      if (G.ok) {
        const Ai = prev.map((r) => r.slice(n));
        steps.push({
          title: 'La izquierda es I: la derecha es A⁻¹',
          tex: [taugI(prev, n), R`A^{-1} = ${tm(Ai)}`],
          why: R`la parte izquierda llegó a $I$: la rejilla volvió a la cuadrícula original, es decir, las operaciones juntas <b>deshicieron</b> $A$. La parte derecha acumuló exactamente esas mismas operaciones aplicadas a $I$, o sea el producto $E_k\cdots E_1$. Como ese producto convierte $A$ en $I$, es $A^{-1}$.`,
        });
        mats.push(I);
        const extra = [R`A\,A^{-1} = ${tm(matMul(st.A, Ai))} = I`];
        if (dim === 2) extra.push(R`\begin{aligned}A^{-1} &= \frac{1}{ad - bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix} \\ &= \frac{1}{${fmt(det(st.A))}}${tm(adjugate(st.A))} = ${tm(inverse(st.A))}\end{aligned}`);
        steps.push({
          title: 'Comprobación',
          tex: extra,
          why: dim === 2
            ? R`multiplicar por $A$ debe devolver $I$. La fórmula $2\times2$ es Gauss-Jordan hecho con letras: por eso aparece $ad - bc$ dividiendo. Si $\det A = 0$, esa división es imposible, igual que el pivote 0 en la eliminación.`
            : R`multiplicar por $A$ debe devolver $I$. También existe la fórmula $A^{-1} = \frac{1}{\det A}\,\text{adj}(A)$, pero en $3\times3$ requiere nueve determinantes $2\times2$: Gauss-Jordan es más corto y es lo que se usa en la práctica.`,
        });
        mats.push(st.A);
      }
      proc = { steps, mats };
      stepper.set(steps, st.step);
      st.step = stepper.i;
    }

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.5 : 0.3 });
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    const xg = new Arrow(stage, C.x, { opacity: 0.3, radius: 0.025, label: R`\vec{x}` });
    const xa = new Arrow(stage, C.x, { label: R`\vec{x}` });
    const x2g = new Arrow(stage, C.x2, { opacity: 0.3, radius: 0.025, label: R`\vec{x}'` });
    const x2a = new Arrow(stage, C.x2);
    stage.addHandle({ color: C.x, visible: () => st.tab === 'exp', get: () => st.x, set: (v) => { st.x = v; update(); } });

    // --- panel ---
    const run = (from, to) => { stop(); stop = animate(from, to, 1300, (v) => { st.s = v; update(); }); };
    const goStep = (i, from) => {
      st.step = i; stop();
      anim.from = proc.mats[from] ?? procM(); anim.to = proc.mats[i]; anim.t = 0;
      stop = animate(0, 1, 900, (t) => { anim.t = t; update(); });
      update();
    };
    const stepper = new Stepper(goStep);
    const changed = () => { buildProc(); anim.from = anim.to = proc.mats[stepper.i]; anim.t = 1; update(); };
    const me = matEditor({
      dim, colors: basisColors(n), get: () => st.A,
      set: (A) => { stop(); st.A = A; if (!inv() && st.s > 1) st.s = 1; changed(); },
    });
    const ss = slider({ label: 's', min: 0, max: 2, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const btnA = button('1 · Aplicar A', () => run(0, 1), 'primary');
    const btnInv = button('2 · Aplicar A⁻¹', () => run(1, 2), 'primary');
    const phase = new Note();
    const ex = vecEditor({ name: R`\vec{x}`, color: C.x, dim, get: () => st.x, set: (v) => { st.x = v; update(); } });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox();
    const note = new Note();
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => st.tab, (k) => {
      stop(); st.tab = k; tb.refresh();
      anim.from = anim.to = proc.mats[stepper.i]; anim.t = 1;
      update();
    });

    tb.panes.exp.append(
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
        R`Abre «Cómo se calcula»: Gauss-Jordan paso a paso con tu matriz, viendo cómo cada operación endereza la rejilla.`,
      ]),
    );
    tb.panes.calc.append(
      rich(R`Método: <b>Gauss-Jordan</b> sobre $[\,A \mid I\,]$. En verde, la fila que cambia; en amarillo, el pivote. La escena muestra la parte izquierda: con cada paso la rejilla se endereza hasta volver a la original.`, 'p', 'note'),
      stepper.el, stepper.listEl,
    );

    panel.append(
      ...intro('Matriz inversa',
        R`La inversa $A^{-1}$ es la transformación que <b>deshace</b> lo que hizo $A$: si $A$ lleva $\vec x$ a $\vec y$, entonces $A^{-1}$ devuelve $\vec y$ a $\vec x$. Aplicar una y después la otra es como no hacer nada: $A^{-1}A = I$.`),
      card('Matriz A', me.el, presetButtons(dim, (A) => { stop(); st.A = A; st.s = 0; stepper.i = 0; st.step = 0; changed(); if (st.tab === 'exp') run(0, 1); })),
      tb.el, tb.panes.exp, tb.panes.calc,
    );

    function update() {
      const Ai = inv(), calc = st.tab === 'calc';
      const Mt = M();
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, col(Mt, j)));
      xg.setVisible(!calc).set(O, st.x);
      xa.setVisible(!calc).set(O, matVec(Mt, st.x));
      xa.setLabel(st.s < 0.5 ? R`\vec{x}` : st.s <= 1.5 ? R`A\vec{x}` : R`A^{-1}A\vec{x}`);
      x2g.setVisible(!Ai && !calc).set(O, x2());
      x2a.setVisible(!Ai && !calc).set(O, matVec(Mt, x2()));

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

    buildProc();
    anim.from = anim.to = proc.mats[stepper.i];
    update();
    return { destroy: () => stop() };
  },
};
