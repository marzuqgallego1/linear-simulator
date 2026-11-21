import { Arrow, Lattice, Quad, Box, C, setLabel } from '../core/stage.js';
import { identity, lerpMat, col, withCol, add, scale, det, luDecomp, fmt, pf, clr, EPS } from '../core/math.js';
import { R, intro, card, details, tryList, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate, tabs, Stepper } from '../core/ui.js';
import { BASIS, basisColors, presetButtons } from '../core/presets.js';

const state = {
  2: { A: [[2, 1], [0.5, 1.5]], t: 1, tab: 'exp', step: 0 },
  3: { A: [[1.5, 0, 0.5], [0, 1, 0], [0, 0.5, 1]], t: 1, tab: 'exp', step: 0 },
};

const PIV = C.w, MUL = C.v; // pivote y entrada que se anula
const AX = ['x', 'y', 'z'];

/** Matriz en LaTeX con algunas entradas coloreadas: hi = [[fila, col, color], ...] */
const tmHi = (M, hi = []) => `\\begin{bmatrix}${M.map((r, i) => r.map((x, j) => {
  const c = hi.find(([a, b]) => a === i && b === j);
  return c ? clr(c[2], fmt(x)) : fmt(x);
}).join('&')).join('\\\\')}\\end{bmatrix}`;

export default {
  id: 'determinante',
  title: 'Determinante',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const word = dim === 2 ? 'área' : 'volumen', fig = dim === 2 ? 'paralelogramo' : 'paralelepípedo';
    let stop = () => {};

    // --- procedimiento: eliminación hasta triangular ---
    let proc = { steps: [], mats: [] };
    const anim = { from: s.A, to: s.A, t: 1 };
    const procM = () => lerpMat(anim.from, anim.to, anim.t);
    const M = () => (s.tab === 'calc' ? procM() : lerpMat(I, s.A, s.t));

    function buildProc() {
      const A = s.A, F = luDecomp(A);
      const steps = [], mats = [];
      let sign = 1, prev = A, singular = false;
      const tracker = (U) => R`\det A = ${sign < 0 ? '-' : ''}\det${tmHi(U)}`;
      steps.push({
        title: 'La idea: deformar sin cambiar el ' + word,
        text: R`$\det A$ es el ${word} con signo del ${fig} que forman las columnas de $A$ (la figura amarilla).`,
        tex: R`A = ${tmHi(A)}`,
        why: R`medir el ${word} de una figura inclinada es incómodo. La estrategia es deformarla con operaciones de fila que <b>no cambian el ${word}</b> hasta que la matriz quede <b>triangular</b>; ahí el ${word} es simplemente base × altura${dim === 3 ? ' × profundidad' : ''}.`,
      });
      mats.push(A);
      for (const st of F.steps) {
        if (st.kind === 'elim') {
          const { r, c, m } = st;
          steps.push({
            title: `Hacer cero la entrada (${r + 1}, ${c + 1})`,
            tex: [
              R`m = \frac{${clr(MUL, fmt(prev[r][c]))}}{${clr(PIV, fmt(prev[c][c]))}} = ${fmt(m)},\qquad ${st.op}`,
              tmHi(st.U, [[c, c, PIV], [r, c, MUL]]),
              tracker(st.U),
            ],
            why: R`restar a la fila ${r + 1} un múltiplo de la fila ${c + 1} es aplicar una <b>cizalla</b> $E$ con $\det E = 1$. En la escena, cada punto se desliza en la dirección del eje $${AX[r]}$, tanto más cuanto mayor es su coordenada $${AX[c]}$. La figura se inclina, pero su ${word} no cambia. Se elige $m$ justo para que la entrada (${r + 1}, ${c + 1}) quede en 0.`,
          });
          mats.push(st.U); prev = st.U;
        } else if (st.kind === 'swap') {
          sign = -sign;
          steps.push({
            title: `Intercambiar las filas ${st.c + 1} y ${st.r + 1}`,
            tex: [R`${st.op}:\quad ${tmHi(st.U, [[st.c, st.c, PIV]])}`, tracker(st.U)],
            why: R`el pivote (${st.c + 1}, ${st.c + 1}) era 0 y no se puede dividir entre 0, así que se trae una fila de abajo. Intercambiar filas es un <b>reflejo</b>: el ${word} es el mismo, pero la orientación se invierte (el color cambia), y por eso el determinante <b>cambia de signo</b>.`,
          });
          mats.push(st.U); prev = st.U;
        } else {
          singular = true;
          steps.push({
            title: `Columna ${st.c + 1}: no hay pivote`,
            tex: tmHi(prev, Array.from({ length: n - st.c }, (_, k) => [st.c + k, st.c, C.neg])),
            why: R`de la diagonal hacia abajo, la columna ${st.c + 1} es todo ceros: esta columna es combinación de las anteriores. La figura ya está <b>aplastada</b>, así que su ${word} es 0.`,
          });
          mats.push(prev);
        }
      }
      const U = prev, diag = U.map((r, i) => r[i]), prod = diag.reduce((a, b) => a * b, 1), dA = sign * prod;
      const dc = clr(Math.abs(dA) < EPS ? C.neutral : dA > 0 ? C.pos : C.neg, fmt(dA));
      steps.push({
        title: 'Triangular: el ' + word + ' es el producto de la diagonal',
        tex: [
          R`\det${tmHi(U, diag.map((_, i) => [i, i, PIV]))} = ${diag.map((x) => pf(x)).join('\\cdot')} = ${fmt(prod)}`,
          R`\det A = ${sign < 0 ? R`-(${fmt(prod)})` : fmt(prod)} = ${dc}`,
        ],
        note: singular ? ['zero', R`Hay un 0 en la diagonal: $\det A = 0$ y $A$ no tiene inversa.`] : sign < 0 ? ['neg', 'Hubo un intercambio de filas, así que se cambia el signo.'] : null,
        why: dim === 2
          ? R`en una matriz triangular superior, la primera columna $(${fmt(U[0][0])}, 0)$ está <b>sobre el eje $x$</b>: es la base, de largo $|${fmt(U[0][0])}|$. La segunda columna sube hasta la <b>altura</b> $${fmt(U[1][1])}$. Área = base × altura = $u_{11}\,u_{22}$.`
          : R`la primera columna está sobre el eje $x$ y la segunda dentro del plano $xy$: forman una base de área $|u_{11}u_{22}|$. La tercera columna sube hasta la altura $u_{33}$. Volumen = área de la base × altura = $u_{11}\,u_{22}\,u_{33}$.`,
      });
      mats.push(U);
      // fórmula cerrada
      let formula;
      if (dim === 2) {
        const [[a, b], [c, e]] = A;
        formula = [R`\det\begin{bmatrix}a&b\\c&d\end{bmatrix} = ad - bc = ${pf(a)}\cdot${pf(e)} - ${pf(b)}\cdot${pf(c)} = ${dc}`];
        if (Math.abs(a) > EPS) formula.push(R`\text{Sale de lo anterior: } a\left(d - \tfrac{c}{a}\,b\right) = ad - bc`);
      } else {
        const [[a, b, c], [d1, e, f], [g, hh, i]] = A;
        const br = (p, q, r, t) => `(${pf(p)}\\cdot${pf(q)}-${pf(r)}\\cdot${pf(t)})`;
        formula = [R`\begin{aligned}\det A &= a\,(ei - fh) \\ &\quad - b\,(di - fg) \\ &\quad + c\,(dh - eg) \\[4pt]
          &= ${pf(a)}${br(e, i, f, hh)} \\ &\quad - ${pf(b)}${br(d1, i, f, g)} \\ &\quad + ${pf(c)}${br(d1, hh, e, g)} \\ &= ${dc}\end{aligned}`];
      }
      steps.push({
        title: 'Comprobación con la fórmula',
        tex: formula,
        why: dim === 2
          ? R`la fórmula $ad - bc$ es la misma eliminación hecha con letras: al anular $c$ la diagonal queda $a$ y $d - \frac{c}{a}b$, y su producto es $ad - bc$. Para $2\times2$ conviene la fórmula; para matrices grandes, la eliminación es muchísimo más rápida.`
          : R`es el <b>desarrollo por cofactores</b> de la primera fila: cada término es una entrada por el determinante $2\times2$ que queda al tachar su fila y su columna, con signos alternados $+,-,+$. Da lo mismo que la eliminación, pero en $n\times n$ necesita del orden de $n!$ multiplicaciones, contra unas $n^3/3$ de la eliminación.`,
      });
      mats.push(A);
      proc = { steps, mats };
      stepper.set(steps, s.step);
      s.step = stepper.i;
    }

    // --- escena ---
    new Lattice(stage, C.grid, { opacity: 0.18 }).setMatrix(I);
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.3 : 0.18 });
    let shape;
    if (dim === 2) {
      new Quad(stage, '#ffffff', { opacity: 0, edgeOpacity: 0.35 }).set([0, 0], [1, 0], [1, 1], [0, 1]);
      shape = new Quad(stage, C.pos, { opacity: 0.35 });
    } else {
      new Box(stage, '#ffffff', { opacity: 0, edgeOpacity: 0.25 }).set([1, 0, 0], [0, 1, 0], [0, 0, 1]);
      shape = new Box(stage, C.pos, { opacity: 0.28 });
    }
    const badge = stage.addLabel('', C.pos, 'badge');
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    basis.forEach((_, j) =>
      stage.addHandle({
        color: BASIS[j].color,
        visible: () => s.tab === 'exp',
        get: () => col(M(), j),
        set: (v) => { stop(); s.A = withCol(s.A, j, v); s.t = 1; changed(); },
      }));

    // --- panel ---
    const play = () => { stop(); stop = animate(0, 1, 1400, (t) => { s.t = t; update(); }); };
    const goStep = (i, from) => {
      s.step = i;
      stop();
      anim.from = proc.mats[from] ?? procM(); anim.to = proc.mats[i]; anim.t = 0;
      stop = animate(0, 1, 900, (t) => { anim.t = t; update(); });
      update();
    };
    const stepper = new Stepper(goStep);
    const changed = () => { buildProc(); anim.from = anim.to = proc.mats[stepper.i]; anim.t = 1; update(); };
    const me = matEditor({ dim, colors: basisColors(n), get: () => s.A, set: (A) => { stop(); s.A = A; s.t = 1; changed(); } });
    const st = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const calc = new TexBox();
    const note = new Note();
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => s.tab, (k) => {
      stop(); s.tab = k; tb.refresh(); s.t = 1;
      anim.from = anim.to = proc.mats[stepper.i]; anim.t = 1;
      update();
    });

    tb.panes.exp.append(
      card('Aplicar la transformación', st.el,
        buttonRow(button('▶ Animar', play, 'primary'), button('Ver original', () => { stop(); s.t = 0; update(); }))),
      card('Lo que estás viendo', calc.el, note.el),
      details('Definición formal',
        rich(dim === 2
          ? R`$\det\begin{bmatrix}a&b\\c&d\end{bmatrix} = ad - bc$.`
          : R`Desarrollo por la primera fila: $\det A = a(ei-fh) - b(di-fg) + c(dh-eg)$, con $A=\begin{bmatrix}a&b&c\\d&e&f\\g&h&i\end{bmatrix}$.`),
        rich(R`Propiedades: $\det I = 1$; si intercambias dos columnas cambia de signo; $\det(AB)=\det A\cdot\det B$ (aplicar dos transformaciones multiplica sus factores de ${word}).`),
        rich(R`$A$ tiene inversa <b>si y solo si</b> $\det A \neq 0$.`)),
      tryList([
        R`Elige «Escalado»: la forma cambia, pero el ${word} se conserva ($\det = 1$).`,
        R`Elige «Cizalla»: la figura se inclina, pero el ${word} no cambia.`,
        dim === 2
          ? R`Arrastra $\hat\imath$ al otro lado de $\hat\jmath$: el color cambia y el determinante se vuelve negativo.`
          : R`Elige «Reflexión»: el determinante es $-1$, el espacio queda como en un espejo.`,
        dim === 2
          ? R`Arrastra $\hat\imath$ sobre la recta de $\hat\jmath$: el paralelogramo se aplasta y $\det = 0$.`
          : R`Elige «Singular»: el cubo se aplasta en un plano y $\det = 0$.`,
        R`Abre «Cómo se calcula» para ver el determinante calculado paso a paso con tu matriz.`,
      ]),
    );
    tb.panes.calc.append(
      rich(R`Método: <b>eliminación</b> hasta dejar la matriz triangular, llevando la cuenta de qué le pasa al ${word}. La escena muestra la figura de cada paso. Cambia $A$ arriba y el procedimiento se rehace con tus números.`, 'p', 'note'),
      stepper.el, stepper.listEl,
    );

    panel.append(
      ...intro('Determinante',
        dim === 2
          ? R`El determinante dice <b>por cuánto se multiplica el área</b> al aplicar la matriz. El cuadrado unitario que forman $\hat\imath$ y $\hat\jmath$ (área 1) se convierte en un paralelogramo de área $|\det A|$. El <b>signo</b> indica si el plano se dio la vuelta.`
          : R`El determinante dice <b>por cuánto se multiplica el volumen</b> al aplicar la matriz. El cubo unitario que forman $\hat\imath$, $\hat\jmath$ y $\hat k$ (volumen 1) se convierte en un paralelepípedo de volumen $|\det A|$. El <b>signo</b> indica si el espacio se dio la vuelta.`),
      card('Matriz A', me.el, presetButtons(dim, (A) => { s.A = A; stepper.i = 0; s.step = 0; changed(); if (s.tab === 'exp') play(); })),
      tb.el, tb.panes.exp, tb.panes.calc,
    );

    function update() {
      const Mt = M(), dt = det(Mt), cols = [0, 1, 2].slice(0, n).map((j) => col(Mt, j));
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, cols[j]));
      const color = Math.abs(dt) < 1e-6 ? C.neutral : dt > 0 ? C.pos : C.neg;
      shape.setColor(color);
      if (dim === 2) shape.set(O, cols[0], add(cols[0], cols[1]), cols[1]);
      else shape.set(...cols);
      badge.position.set(...[...scale(cols.reduce(add), 0.5), 0].slice(0, 3));
      badge.userData.inner.style.color = color;
      setLabel(badge, R`\det = ${fmt(dt)}`);

      me.refresh(); st.refresh();
      const A = s.A, d = det(A);
      const dc = clr(Math.abs(d) < EPS ? C.neutral : d > 0 ? C.pos : C.neg, fmt(d));
      if (dim === 2) {
        const [[a, b], [c, e]] = A;
        calc.set(R`\det A = ad - bc = ${pf(a)}\cdot${pf(e)} - ${pf(b)}\cdot${pf(c)} = ${dc}`);
      } else {
        const [[a, b, c], [d1, e, f], [g, hh, i]] = A;
        const br = (p, q, r, t) => `[${pf(p)}\\cdot${pf(q)}-${pf(r)}\\cdot${pf(t)}]`;
        calc.set(R`\det A = ${pf(a)}${br(e, i, f, hh)} - ${pf(b)}${br(d1, i, f, g)} + ${pf(c)}${br(d1, hh, e, g)} = ${dc}`);
      }

      if (Math.abs(d) < EPS)
        note.set('zero', dim === 2
          ? R`<b>$\det A = 0$</b>: $A$ aplasta el plano en una recta (o en un punto). El área se vuelve cero y la transformación <b>no se puede deshacer</b>: $A$ no tiene inversa.`
          : R`<b>$\det A = 0$</b>: $A$ aplasta el espacio en un plano, una recta o un punto. El volumen se vuelve cero y la transformación <b>no se puede deshacer</b>: $A$ no tiene inversa.`);
      else if (d < 0)
        note.set('neg', dim === 2
          ? R`<b>Negativo</b>: la orientación se <b>invierte</b>, como ver el plano en un espejo ($\hat\jmath$ queda a la derecha de $\hat\imath$ en vez de a la izquierda). El área se multiplica por $|\det A| = ${fmt(Math.abs(d))}$.`
          : R`<b>Negativo</b>: la orientación se <b>invierte</b>; la «mano derecha» se convierte en mano izquierda. El volumen se multiplica por $|\det A| = ${fmt(Math.abs(d))}$.`);
      else {
        const how = Math.abs(d - 1) < EPS ? 'se conserva' : d > 1 ? 'crece' : 'se encoge';
        note.set('pos', R`<b>Positivo</b>: la orientación se mantiene. Cualquier región multiplica su ${word} por $${fmt(d)}$: el ${word} <b>${how}</b>.`);
      }
    }

    buildProc();
    anim.from = anim.to = proc.mats[stepper.i];
    update();
    return { destroy: () => stop() };
  },
};
