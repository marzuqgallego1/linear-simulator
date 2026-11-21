import { Arrow, Lattice, Dot, C } from '../core/stage.js';
import { identity, lerpMat, col, matVec, add, scale, cross, normalize, solveSystem, fmt, tv, tm, clr } from '../core/math.js';
import { LineView, PlaneView } from '../core/geom.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate, tabs, Stepper } from '../core/ui.js';
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
  2: { A: PRE[2][1][1], t: 1, x: [2, 1], tab: 'exp', step: 0 },
  3: { A: PRE[3][1][1], t: 1, x: [1, 1, 0], tab: 'exp', step: 0 },
};

const KER = '#f03e3e', IMG = '#20c997';
const ROWC = [C.u, C.v, C.k]; // una ecuación (fila) por color
const PIV = C.w;
const VARS = ['x_1', 'x_2', 'x_3'];
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
    stage.addHandle({ color: C.x, visible: () => st.tab === 'exp', get: () => st.x, set: (p) => { st.x = p; update(); } });

    // --- procedimiento: escalonar Ax = 0 ---
    const rowViews = Array.from({ length: n }, (_, i) => (dim === 2 ? new LineView(stage, ROWC[i], { radius: 0.02 }) : new PlaneView(stage, ROWC[i], { opacity: 0.1, L: 4 })));
    const kArr = Array.from({ length: n }, (_, i) => new Arrow(stage, KER, { radius: 0.05, label: R`\vec n_${i + 1}` }));
    const stepper = new Stepper((i) => { st.step = i; update(); });
    let proc = { scene: [] };
    const linEq = (r) => {
      const terms = r.map((a, j) => [a, j]).filter(([a]) => Math.abs(a) > 1e-9);
      if (!terms.length) return '0 = 0';
      return `${terms.map(([a, j], k) => {
        const mag = Math.abs(Math.abs(a) - 1) < 1e-9 ? '' : fmt(Math.abs(a));
        return `${a < 0 ? '-' : k ? '+' : ''} ${mag}${VARS[j]}`;
      }).join(' ')} = 0`;
    };
    const eqTex = (M) => R`\begin{cases}${M.map((r, i) => clr(ROWC[i], linEq(r))).join('\\\\')}\end{cases}`;
    const rowsOf = (M) => M.map((r) => r.slice(0, n));
    function buildProc() {
      const A = st.A, S = solveSystem(A, O), r = S.rank, ker = S.nullBasis, nul = ker.length;
      const steps = [], scene = [];
      const add1 = (step, sc) => { steps.push(step); scene.push({ rows: A, ker: false, img: false, ...sc }); };
      add1({
        title: 'Plantear el sistema Ax = 0',
        tex: eqTex(A),
        why: R`el núcleo son los $\vec x$ que cumplen $A\vec x = \vec 0$, y cada fila de $A$ es una ecuación. En la escena, cada ecuación es ${dim === 2 ? 'una recta' : 'un plano'} por el origen (los puntos que la cumplen), en su color. El núcleo, en rojo, es lo que todas tienen en común: su <b>intersección</b>.`,
      }, { rows: A });
      let rows = A;
      for (const s of S.steps) {
        rows = rowsOf(s.M);
        const kind = s.op.includes('leftrightarrow') ? 'swap' : s.op.includes('frac{1}') ? 'scale' : 'elim';
        add1({
          title: `Escalonar: $${s.op}$`,
          tex: eqTex(rows),
          why: kind === 'swap'
            ? R`cambiar el orden de las ecuaciones no cambia sus soluciones. Se hace para tener un número distinto de 0 en la posición del pivote.`
            : kind === 'scale'
              ? R`multiplicar una ecuación por un número distinto de 0 da la <b>misma</b> ${dim === 2 ? 'recta' : 'superficie'}: los mismos puntos la cumplen. Se hace para que el pivote valga 1.`
              : R`sumar a una ecuación un múltiplo de otra <b>cambia</b> esa ${dim === 2 ? 'recta' : 'ecuación'} (en la escena gira), pero todo punto que cumplía las dos las sigue cumpliendo. Por eso la intersección, el núcleo en rojo, <b>no se mueve</b>. Así se van simplificando las ecuaciones sin cambiar la respuesta.`,
        }, { rows });
      }
      const Mr = rowsOf(S.M);
      const pivTex = R`\begin{bmatrix}${Mr.map((row, i) => row.map((x, j) => (S.pivots[i] === j ? clr(PIV, fmt(x)) : fmt(x))).join('&')).join('\\\\')}\end{bmatrix}`;
      const zeroRows = Mr.filter((row) => row.every((x) => Math.abs(x) < 1e-9)).length;
      add1({
        title: 'Pivotes y variables libres',
        tex: [pivTex, R`\text{pivotes: } ${S.pivots.length ? S.pivots.map((j) => VARS[j]).join(', ') : R`\text{ninguno}`}\qquad \text{libres: } ${S.free.length ? S.free.map((j) => VARS[j]).join(', ') : R`\text{ninguna}`}`],
        why: R`en la forma escalonada reducida cada fila no nula empieza con un 1, el <b>pivote</b> (en amarillo). Las variables con pivote se pueden despejar; las que no tienen pivote son <b>libres</b>: se les puede dar cualquier valor. El rango es el número de pivotes: $\text{rg}A = ${r}$.${zeroRows ? R` ${zeroRows === 1 ? 'La fila de ceros dice' : `Las ${zeroRows} filas de ceros dicen`} $0 = 0$: ${zeroRows === 1 ? 'era una ecuación que dependía' : 'eran ecuaciones que dependían'} de las otras y no restringe${zeroRows === 1 ? '' : 'n'} nada (en la escena ya no aparece${zeroRows === 1 ? '' : 'n'}).` : ''}`,
      }, { rows: Mr });
      if (nul === 0) {
        add1({
          title: 'Sin variables libres: solo x = 0',
          tex: R`\vec x = ${tv(O)}\qquad \text{Ker}A = \{\vec 0\},\ \dim\text{Ker}A = 0`,
          why: R`cada variable tiene pivote y la ecuación de su fila la obliga a valer 0. Las ${dim === 2 ? 'rectas' : 'superficies'} solo se cortan en el origen: <b>nada se pierde</b>.`,
        }, { rows: Mr });
      } else {
        const sol = S.pivots.map((p, i) => {
          const rhs = S.free.map((f) => [-Mr[i][f], f]).filter(([c]) => Math.abs(c) > 1e-9);
          return `${VARS[p]} = ${rhs.length ? rhs.map(([c, f], k) => `${c < 0 ? '-' : k ? '+' : ''} ${Math.abs(Math.abs(c) - 1) < 1e-9 ? '' : fmt(Math.abs(c))}${VARS[f]}`).join(' ') : '0'}`;
        }).concat(S.free.map((f) => `${VARS[f]}\\ \\text{libre}`));
        add1({
          title: 'Despejar las variables con pivote',
          tex: R`\begin{cases}${sol.join('\\\\')}\end{cases}`,
          why: R`cada fila con pivote dice cuánto vale su variable en función de las libres (se pasan al otro lado con el signo cambiado).`,
        }, { rows: Mr });
        add1({
          title: 'Escribir la solución como vector',
          tex: R`\vec x = ${S.free.map((f, k) => `${VARS[f]}\\,${clr(KER, tv(ker[k]))}`).join(' + ')}`,
          why: R`cada variable libre se saca como factor. El vector que la acompaña es el que sale de darle el valor 1 a esa libre y 0 a las demás. Cada libre aporta <b>una dirección</b> del núcleo (flechas rojas), así que la nulidad es el número de libres: $\dim\text{Ker}A = ${nul}$.`,
        }, { rows: Mr, ker: true });
        add1({
          title: 'Comprobar',
          tex: ker.map((v) => R`A${clr(KER, tv(v))} = ${tv(matVec(A, v))}`),
          why: R`multiplicar por la matriz <b>original</b> debe dar $\vec 0$. Al aplicar $A$ (en la escena), las flechas rojas se aplastan en el origen.`,
        }, { rows: Mr, ker: true, apply: true });
      }
      add1({
        title: 'La imagen y el teorema del rango',
        tex: [
          r ? R`\text{Im}A = \text{span}\left\{${S.pivots.map((j) => clr(IMG, tv(col(A, j)))).join(',\\ ')}\right\}` : R`\text{Im}A = \{\vec 0\}`,
          R`\underbrace{${r}}_{\text{pivotes}} + \underbrace{${nul}}_{\text{libres}} = ${n}`,
        ],
        why: R`las operaciones de fila cambian las columnas, pero <b>no las relaciones</b> entre ellas: si en la escalonada una columna es combinación de otras, en $A$ también. Por eso las columnas pivote de la $A$ <b>original</b> son una base de la imagen (en verde). Y cada variable o tiene pivote (esa dimensión sobrevive) o es libre (se pierde en el núcleo): rango + nulidad = $${n}$.`,
      }, { rows: Mr, ker: nul > 0, img: true, apply: true });
      proc = { scene };
      stepper.set(steps, st.step);
      st.step = stepper.i;
    }

    // --- panel ---
    const run = (a, b) => { stop(); st.t = a; update(); stop = animate(a, b, 1400, (v) => { st.t = v; update(); }); };
    const me = matEditor({ dim, colors: basisColors(n), get: () => st.A, set: (A) => { stop(); st.A = A; st.t = 1; update(); } });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); run(0, 1); } }, name)));
    const ts = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => st.t, set: (v) => { stop(); st.t = v; update(); } });
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => st.x, set: (v) => { st.x = v; update(); } });
    const cR = new TexBox(), cIm = new TexBox(), cKer = new TexBox(), cChk = new TexBox(), cThm = new TexBox(), cX = new TexBox();
    const nR = new Note(), nK = new Note(), nT = new Note(), nX = new Note();
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => st.tab, (k) => { stop(); st.tab = k; tb.refresh(); update(); });

    panel.append(
      ...intro('Rango, núcleo y nulidad',
        R`Una matriz puede <b>aplastar</b> el espacio. El <b>rango</b> mide cuántas dimensiones sobreviven: es la dimensión de la imagen (todo lo que $A$ puede producir). El <b>núcleo</b> es lo que se pierde: los vectores que $A$ manda al origen. Su dimensión es la <b>nulidad</b>.`),
      card('Matriz A', me.el, pre),
      tb.el, tb.panes.exp, tb.panes.calc,
    );
    tb.panes.calc.append(
      rich(R`Método: escalonar el sistema $A\vec x = \vec 0$. Cada ecuación se dibuja ${dim === 2 ? 'como una recta' : 'como un plano'} de su color; el núcleo (rojo) es donde se cortan todas.`, 'p', 'note'),
      stepper.el, stepper.listEl,
    );
    tb.panes.exp.append(
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
      // escena del procedimiento
      buildProc();
      const calc = st.tab === 'calc', sc = proc.scene[stepper.i];
      [xa, x2a, Ax].forEach((a) => calc && a.setVisible(false));
      if (!calc) { xa.setVisible(true); Ax.setVisible(true); }
      rowViews.forEach((v, i) => {
        const row = sc?.rows[i];
        if (!calc || !row || row.every((x) => Math.abs(x) < 1e-9)) return v.setVisible(false);
        v.set(O, dim === 2 ? [-row[1], row[0]] : row);
      });
      kArr.forEach((a, i) => {
        const vis = calc && sc?.ker && i < nul;
        a.setVisible(!!vis);
        if (vis) a.set(O, matVec(sc.apply ? A : I, ker[i]));
      });
      if (calc) {
        const Mc = sc?.apply ? A : I;
        grid.setMatrix(Mc);
        basis.forEach((a, j) => a.set(O, col(Mc, j)));
        dots.forEach((d) => d.setVisible(false));
        if (!sc?.img) { imLine.setVisible(false); imPlane?.setVisible(false); }
      }
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
