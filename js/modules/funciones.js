import { Arrow, Polyline, Segments, Dot, C } from '../core/stage.js';
import { add, sub, scale, norm, fmt, tv, clr, clamp } from '../core/math.js';
import { R, h, tex, intro, card, details, tryList, vecEditor, slider, button, buttonRow, chips, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS } from '../core/presets.js';
import { parse, evalExpr, texExpr, ExprError } from '../core/expr.js';

const KINDS = {
  22: { n: 2, m: 2, dim: 2, label: 'ℝ² → ℝ²' },
  23: { n: 2, m: 3, dim: 3, label: 'ℝ² → ℝ³' },
  33: { n: 3, m: 3, dim: 3, label: 'ℝ³ → ℝ³' },
  32: { n: 3, m: 2, dim: 3, label: 'ℝ³ → ℝ²' },
};
const PRE = {
  22: [
    ['Tu ejemplo (afín)', ['2x + y', 'y - 1']],
    ['Cizalla', ['x + y', 'y']],
    ['Rotación 90°', ['-y', 'x']],
    ['Escala', ['2x', '0.5y']],
    ['Proyección', ['x', '0']],
    ['No lineal: parábola', ['x', 'y + x^2/4']],
    ['No lineal: ondas', ['x + 0.5sin(y)', 'y + 0.5sin(x)']],
  ],
  23: [
    ['Plano inclinado', ['x', 'y', 'x + y']],
    ['Levantar (afín)', ['x', 'y', '1.5']],
    ['Doblar a otro plano', ['x + y', 'y', 'x - y']],
    ['Rango 1', ['x + y', 'x + y', '0.5(x + y)']],
    ['No lineal: paraboloide', ['x', 'y', '(x^2 + y^2)/4']],
  ],
  33: [
    ['Cizalla', ['x + z', 'y', 'z']],
    ['Rotación (eje z)', ['-y', 'x', 'z']],
    ['Escala', ['1.5x', 'y', '0.5z']],
    ['Traslación (afín)', ['x + 1', 'y', 'z - 1']],
    ['Aplastar', ['x', 'y', '0']],
    ['No lineal: torcer', ['x cos(z/2) - y sin(z/2)', 'x sin(z/2) + y cos(z/2)', 'z']],
  ],
  32: [
    ['Proyectar', ['x', 'y']],
    ['Sombra oblicua', ['x - 0.5z', 'y - 0.5z']],
    ['Sumar coordenadas', ['x + z', 'y + z']],
    ['Afín', ['x + z + 1', 'y - 1']],
    ['No lineal', ['x + z^2/4', 'y']],
  ],
};

const shared = {
  kind: '22',
  exprs: Object.fromEntries(Object.entries(PRE).map(([k, l]) => [k, [...l[0][1]]])),
  x: { 2: [1.5, 1], 3: [1, 1, 1] },
  s: 1,
  anim: 'coord',
};

const VAR = ['x', 'y', 'z'], OUT = ["x'", "y'", "z'"];
const OK = R`\textcolor{#51cf66}{\checkmark}`, BAD = R`\textcolor{#ff6b6b}{\times}`;
const near = (a, b) => a.every((x, i) => Number.isFinite(x) && Number.isFinite(b[i]) && Math.abs(x - b[i]) <= 1e-7 * (1 + Math.abs(x) + Math.abs(b[i])));
const pad = (v, D) => Array.from({ length: D }, (_, i) => v[i] ?? 0);
const finite = (v) => v.every((x) => Number.isFinite(x) && Math.abs(x) < 60);

export default {
  id: 'funciones',
  title: 'Transformaciones como funciones',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    if (dim === 2) shared.kind = '22';
    else if (shared.kind === '22') shared.kind = '33';
    const kind = shared.kind, { n, m } = KINDS[kind], D = dim;
    const vars = VAR.slice(0, n), exprs = shared.exprs[kind];
    const env = (p) => Object.fromEntries(vars.map((v, i) => [v, p[i]]));
    const O = Array(n).fill(0), E = Array.from({ length: n }, (_, j) => O.map((_, i) => (i === j ? 1 : 0)));
    const switchTo = (k) => { shared.kind = k; document.querySelector(`[data-dim="${KINDS[k].dim}"]`)?.click(); };
    let stop = () => {};

    // --- fórmulas ---
    const trees = exprs.map(() => ({ t: 'num', v: 0 }));
    const errors = exprs.map(() => null);
    const compile = (i) => {
      try { trees[i] = parse(exprs[i], vars); errors[i] = null; }
      catch (e) { if (!(e instanceof ExprError)) throw e; errors[i] = e.message; }
    };
    exprs.forEach((_, i) => compile(i));
    const T = (p) => { const e = env(p); return trees.map((t) => evalExpr(t, e)); };

    /** ¿lineal, afín o no lineal? Se prueba con varios vectores (no solo con los que se muestran). */
    const classify = () => {
      const T0 = T(O);
      const G = (p) => sub(T(p), T0);
      const samples = [[0.7, -1.3, 0.4], [-2.1, 0.6, 1.7], [1.9, 2.3, -0.8], [-0.4, -1.1, -2.6], [3.1, -0.2, 0.9]].map((v) => v.slice(0, n));
      let affine = finite(T0);
      for (let i = 0; i < samples.length && affine; i++) {
        const u = samples[i], v = samples[(i + 2) % samples.length], c = [2.5, -1.5, 0.3, 4, -3][i];
        if (!near(G(add(u, v)), add(G(u), G(v))) || !near(G(scale(u, c)), scale(G(u), c))) affine = false;
      }
      const lin = affine && near(T0, Array(m).fill(0));
      const A = affine ? Array.from({ length: m }, (_, i) => E.map((e) => G(e)[i])) : null;
      return { type: lin ? 'lineal' : affine ? 'afin' : 'no', T0, A };
    };

    // --- posiciones durante la animación ---
    const steps = () => (shared.anim === 'coord' ? D : shared.anim === 'afin' ? 2 : 1);
    let info = classify();
    const place = (p, s) => {
      const st = pad(p, D), Tp = T(p);
      if (!finite(Tp)) return null;
      const en = pad(Tp, D);
      if (shared.anim === 'todo') return st.map((x, k) => x + (en[k] - x) * s);
      if (shared.anim === 'afin' && info.A) {
        const mid = pad(info.A.map((r) => r.reduce((acc, a, j) => acc + a * p[j], 0)), D);
        return s <= 0.5 ? st.map((x, k) => x + (mid[k] - x) * 2 * s) : mid.map((x, k) => x + (en[k] - x) * (2 * s - 1));
      }
      return st.map((x, k) => x + (en[k] - x) * clamp(s * D - k, 0, 1));
    };

    // --- escena ---
    const L = n === 2 ? (D === 2 ? 5 : 3) : 2, S = n === 2 ? (D === 2 ? 50 : 30) : 16;
    const lines = [];
    const sampleLine = (fix, dir) => Array.from({ length: S + 1 }, (_, k) => { const p = [...fix]; p[dir] = -L + (2 * L * k) / S; return p; });
    if (n === 2) for (let a = -L; a <= L; a++) { lines.push(sampleLine([a, 0], 1), sampleLine([0, a], 0)); }
    else for (let a = -L; a <= L; a++) for (let b = -L; b <= L; b++) lines.push(sampleLine([0, a, b], 0), sampleLine([a, 0, b], 1), sampleLine([a, b, 0], 2));
    const box = n === 2
      ? [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]]
      : [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]].flatMap((a, i, all) => all.slice(i + 1).filter((b) => norm(sub(a, b)) === 1).map((b) => [a, b]));
    const boxLines = box.map(([a, b]) => Array.from({ length: 13 }, (_, k) => add(a, scale(sub(b, a), k / 12))));

    const ghost = new Segments(stage, C.grid, { opacity: D === 2 ? 0.18 : 0.1 });
    const grid = new Segments(stage, C.grid, { opacity: D === 2 ? 0.75 : 0.45 });
    const boxSeg = new Segments(stage, '#20c997', { opacity: 0.95 });
    const eArr = E.map((_, j) => new Arrow(stage, BASIS[j].color, { radius: 0.045, label: ' ' }));
    const oDot = new Dot(stage, C.x2, { radius: 0.11 });
    const xg = new Arrow(stage, C.x, { opacity: 0.4, radius: 0.025, label: R`\vec x` });
    const xa = new Arrow(stage, C.w, { radius: 0.045, label: ' ' });
    const toSegs = (pls, s) => {
      const out = [];
      for (const pl of pls) {
        let prev = null;
        for (const p of pl) {
          const q = s == null ? pad(p, D) : place(p, s);
          if (prev && q) out.push(prev, q);
          prev = q;
        }
      }
      return out;
    };
    ghost.set(toSegs(lines, null));
    stage.addHandle({ color: C.x, get: () => pad(shared.x[n], D), set: (p) => { stop(); shared.x[n] = p.slice(0, n); update(); } });

    // --- panel ---
    const kindChips = chips(Object.entries(KINDS).map(([k, v]) => [k, v.label]), () => shared.kind, switchTo);
    const errNote = new Note(), cT = new TexBox();
    const fields = exprs.map((txt, i) => {
      const inp = h('input', { type: 'text', class: 'expr', value: txt, spellcheck: 'false', autocomplete: 'off' });
      inp.addEventListener('input', () => { stop(); exprs[i] = inp.value; compile(i); refreshAll(); });
      return { inp, row: h('label', { class: 'expr-row' }, tex(OUT[i]), '=', inp) };
    });
    const pre = h('div', { class: 'presets' }, PRE[kind].map(([name, ex]) => h('button', {
      class: 'chip', onclick: () => {
        ex.forEach((t, i) => { exprs[i] = t; fields[i].inp.value = t; compile(i); });
        refreshAll(); run(0, 1);
      },
    }, name)));
    const animChips = chips([['coord', 'Coordenada por coordenada'], ['todo', 'Todo a la vez'], ['afin', 'Parte lineal, luego traslación']],
      () => shared.anim, (k) => { stop(); shared.anim = k; shared.s = 0; update(); });
    const ss = slider({ label: 's', min: 0, max: 1, step: 0.005, get: () => shared.s, set: (v) => { stop(); shared.s = v; update(); } });
    const run = (a, b) => { stop(); shared.s = a; update(); stop = animate(a, b, Math.max(500, 1400 * Math.abs(b - a) * steps()), (v) => { shared.s = v; update(); }); };
    const next = () => {
      const k = steps(), target = Math.min(1, (Math.floor(shared.s * k + 1e-6) + 1) / k);
      run(shared.s >= 0.999 ? 0 : shared.s, shared.s >= 0.999 ? 1 / k : target);
    };
    const phase = new Note(), cStep = new TexBox();
    const cTests = new TexBox(), nLin = new Note(), cM = new TexBox(), nM = new Note();
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim: n, get: () => shared.x[n], set: (v) => { stop(); shared.x[n] = v; update(); } });
    const cX = new TexBox();

    panel.append(
      ...intro('Transformaciones como funciones',
        R`Una transformación es una <b>función</b>: entra un vector y sale otro. Aquí se escribe con fórmulas, como $T(x, y) = (2x + y,\ y - 1)$, y se ve aplicarse poco a poco. Luego se comprueba si es <b>lineal</b>, es decir, si respeta sumas y múltiplos. Las lineales son exactamente las que se pueden escribir con una matriz.`),
      card('Tipo', kindChips.el, rich(D === 2 ? R`$\mathbb{R}^2 \to \mathbb{R}^2$ se ve en la vista 2D; los demás tipos abren la vista 3D.` : R`En 3D, $\mathbb{R}^2$ es el plano $z = 0$. ${n === 3 && m === 2 ? 'La salida cae en ese plano.' : n === 2 ? 'La entrada es ese plano y la salida puede salirse de él.' : ''}`, 'p', 'note')),
      card('La fórmula', h('div', { class: 'expr-box' }, ...fields.map((f) => f.row)), errNote.el, pre, cT.el,
        rich(R`Se puede escribir $2x$, $x\cdot y$, $x^2$, $(x+y)/2$, $\sin(y)$, $\cos$, $\exp$, $\sqrt{\ }$… Las variables son ${vars.map((v) => `$${v}$`).join(', ')}.`, 'p', 'note')),
      card('Aplicar poco a poco', animChips.el, ss.el,
        buttonRow(button('Siguiente paso ▶', next, 'primary'), button('▶ Todo seguido', () => run(0, 1)), button('↺ Inicio', () => { stop(); shared.s = 0; update(); })),
        phase.el, cStep.el),
      card('¿Es lineal?', cTests.el, nLin.el),
      card('La matriz', cM.el, nM.el),
      card('Un vector x', ex.el, cX.el),
      details('Definición formal',
        rich(R`Una función $T: \mathbb{R}^n \to \mathbb{R}^m$ es <b>lineal</b> si para todos los vectores $\vec u, \vec v$ y todo escalar $c$: $T(\vec u + \vec v) = T(\vec u) + T(\vec v)$ y $T(c\vec u) = c\,T(\vec u)$. De ahí sale gratis $T(\vec 0) = \vec 0$ (tomando $c = 0$).`),
        rich(R`<b>Teorema:</b> $T$ es lineal si y solo si existe una matriz $A$ de $m\times n$ con $T(\vec x) = A\vec x$. Su columna $j$ es $T(\vec e_j)$: como $\vec x = x_1\vec e_1 + \dots + x_n\vec e_n$, la linealidad da $T(\vec x) = x_1T(\vec e_1) + \dots + x_nT(\vec e_n)$.`),
        rich(R`En fórmulas: $T$ es lineal cuando cada coordenada es una suma de términos «número $\times$ variable», sin constantes sueltas, sin potencias ni productos de variables y sin funciones como $\sin$.`),
        rich(R`Una transformación <b>afín</b> es $T(\vec x) = A\vec x + \vec b$: lineal más una traslación. No es lineal (si $\vec b \ne \vec 0$), pero conserva rectas y paralelas. En gráficos por computadora se vuelve lineal agregando una coordenada extra (coordenadas homogéneas).`),
        rich(R`Las pruebas con vectores concretos solo pueden <b>refutar</b> la linealidad. Para demostrarla hay que verlo en general, por ejemplo, encontrando la matriz.`)),
      tryList([
        R`Con «Tu ejemplo (afín)», pulsa «Siguiente paso» dos veces: primero cambia solo $x'$ (la rejilla se cizalla), luego $y'$ (todo baja una unidad). El punto rosa es la imagen del origen: si se mueve, no es lineal.`,
        R`Borra el «− 1» de la fórmula: pasa a ser lineal y aparece la matriz.`,
        R`Prueba una fórmula no lineal: la rejilla se <b>curva</b>. Las lineales siempre mandan rectas a rectas y conservan el espaciado de la rejilla.`,
        n === 3 && m === 2 ? R`En $\mathbb{R}^3 \to \mathbb{R}^2$, el último paso descarta la $z$: todo el espacio cae al plano.` : n === 2 && m === 3 ? R`En $\mathbb{R}^2 \to \mathbb{R}^3$, el último paso levanta el plano: aparece la tercera coordenada.` : R`Cambia a «Parte lineal, luego traslación» con una afín: se ve $A\vec x$ y después $+\vec b$.`,
      ]),
    );

    function refreshAll() {
      info = classify();
      if (shared.anim === 'afin' && !info.A) shared.anim = 'coord';
      update();
    }

    function update() {
      const s = shared.s, x = shared.x[n];
      // --- escena ---
      grid.set(toSegs(lines, s));
      boxSeg.set(toSegs(boxLines, s));
      const o = place(O, s);
      oDot.setVisible(!!o).set(o ?? pad(O, D));
      eArr.forEach((a, j) => {
        const q = place(E[j], s);
        a.setVisible(!!q && !!o);
        if (q && o) a.set(o, q).setLabel(s < 0.01 ? R`\vec e_${j + 1}` : s > 0.99 ? R`T(\vec e_${j + 1})` : '');
      });
      xg.set(pad(O, D), pad(x, D));
      const qx = place(x, s);
      xa.setVisible(!!qx);
      if (qx) xa.set(pad(O, D), qx).setLabel(s > 0.99 ? R`T(\vec x)` : '');
      [ss, ex, animChips, kindChips].forEach((c) => c.refresh());
      animChips.el.children[2].disabled = !info.A || info.type === 'lineal';

      // --- fórmula ---
      const err = errors.findIndex((e) => e);
      errNote.set(err >= 0 ? 'neg' : '', err >= 0 ? `${OUT[err]}: ${errors[err]} (se sigue usando la última fórmula válida)` : '');
      fields.forEach((f, i) => f.inp.classList.toggle('bad', !!errors[i]));
      const Ttex = trees.map((t) => texExpr(t));
      cT.set(R`T\begin{pmatrix}${vars.join('\\\\')}\end{pmatrix} = \begin{bmatrix}${Ttex.join('\\\\')}\end{bmatrix}`);

      // --- fase ---
      const K = steps(), k = Math.min(K - 1, Math.floor(s * K - 1e-9));
      const Tx = T(x), ok = finite(Tx);
      let ph = '', step = '';
      if (s < 0.005) ph = R`Inicio: la rejilla es $\mathbb{R}^${n}$ sin transformar. Las flechas de colores son $\vec e_1, \dots, \vec e_${n}$ y el cuadrado verde es ${n === 2 ? 'el cuadrado' : 'el cubo'} unidad.`;
      else if (s > 0.995) ph = R`Listo: cada punto $\vec x$ está en $T(\vec x)$.${info.type !== 'lineal' ? R` El punto rosa es $T(\vec 0) = ${tv(info.T0)}$.` : ''}`;
      else if (shared.anim === 'todo') ph = R`Cada punto viaja en línea recta desde $\vec x$ hasta $T(\vec x)$.`;
      else if (shared.anim === 'afin') {
        ph = k === 0 ? R`Parte lineal: se aplica $A\vec x$. El origen no se mueve.` : R`Traslación: a todo se le suma $\vec b = ${tv(info.T0)}$. El origen se mueve hasta $\vec b$.`;
      } else if (k < m && k < n && Ttex[k] === VAR[k]) {
        ph = R`Paso ${k + 1} de ${K}: $${OUT[k]} = ${VAR[k]}$, así que esta coordenada <b>no cambia</b> y en este paso no se mueve nada.`;
      } else if (k < m && k < n) {
        ph = R`Paso ${k + 1} de ${K}: la coordenada $${OUT[k]}$ pasa de $${VAR[k]}$ a $${Ttex[k]}$. Las demás todavía no cambian. Ojo: se calcula con los valores <b>originales</b> de ${vars.map((v) => `$${v}$`).join(', ')}.`;
      } else if (k < m) {
        ph = R`Paso ${k + 1} de ${K}: aparece una tercera coordenada que la entrada no tenía: $z' = ${Ttex[k]}$. El plano se levanta de $z = 0$.`;
      } else {
        ph = R`Paso ${k + 1} de ${K}: la salida solo tiene 2 coordenadas, así que la $z$ se descarta y todo cae al plano. Así se aplasta $\mathbb{R}^3$ en $\mathbb{R}^2$.`;
      }
      if (shared.anim === 'coord' && s > 0.005 && s <= 0.995 && k < m && ok && Ttex[k] !== VAR[k]) {
        step = R`\text{con } \vec x = ${tv(x)}:\quad ${OUT[k]} = ${Ttex[k]} = ${texExpr(trees[k], env(x))} = ${fmt(Tx[k])}`;
      }
      phase.set(s > 0.995 ? 'pos' : '', ph);
      cStep.set(step);

      // --- linealidad ---
      const u = [1, 2, -1].slice(0, n), v = [-2, 1, 3].slice(0, n), c = 3;
      const T0 = T(O), Tu = T(u), Tv = T(v), Tuv = T(add(u, v)), Tcu = T(scale(u, c));
      const t1 = near(T0, Array(m).fill(0)), t2 = near(Tuv, add(Tu, Tv)), t3 = near(Tcu, scale(Tu, c));
      const V = (w) => (finite(w) ? tv(w) : R`\text{no definido}`);
      cTests.set(R`\begin{gathered}\vec u = ${tv(u)},\ \vec v = ${tv(v)},\ c = ${c} \\[6pt]
        \text{1) } T(\vec 0) = ${V(T0)}\ ${t1 ? OK : BAD} \\[6pt]
        \text{2) } T(\vec u + \vec v) = ${V(Tuv)} \ ${t2 ? '=' : R`\ne`}\ T(\vec u) + T(\vec v) = ${V(add(Tu, Tv))}\ ${t2 ? OK : BAD} \\[6pt]
        \text{3) } T(c\,\vec u) = ${V(Tcu)} \ ${t3 ? '=' : R`\ne`}\ c\,T(\vec u) = ${V(scale(Tu, c))}\ ${t3 ? OK : BAD}\end{gathered}`);
      if (info.type === 'lineal') nLin.set('pos', R`<b>Es lineal.</b> Pasa las tres pruebas, y también con otros vectores elegidos al azar. Cada coordenada es una suma de «número × variable».`);
      else if (info.type === 'afin') nLin.set('zero', R`<b>No es lineal: es afín.</b> Falla porque $T(\vec 0) \ne \vec 0$: hay un término constante. Por eso también fallan la 2 y la 3: en $T(\vec u) + T(\vec v)$ la constante se suma dos veces, y en $c\,T(\vec u)$ se multiplica por $c$. Si le quitas la constante, $T(\vec x) - T(\vec 0)$ sí es lineal.`);
      else nLin.set('neg', R`<b>No es lineal.</b> ${t1 && t2 && t3 ? 'Con estos $\\vec u$, $\\vec v$ pasa por casualidad, pero falla con otros vectores. ' : ''}Hay términos que no son «número × variable» (potencias, productos de variables, $\\sin$…): duplicar la entrada no duplica la salida.`);

      // --- matriz ---
      const colTex = (j) => clr(BASIS[j].color, tv(sub(T(E[j]), info.type === 'afin' ? info.T0 : Array(m).fill(0))));
      if (info.A) {
        const Atex = R`\begin{bmatrix}${info.A.map((r) => r.map((a, j) => clr(BASIS[j].color, fmt(a))).join('&')).join('\\\\')}\end{bmatrix}`;
        const imgs = E.map((e, j) => R`T(\vec e_${j + 1}) ${info.type === 'afin' ? R`- T(\vec 0)` : ''} = ${colTex(j)}`).join(',\\quad ');
        cM.set(R`\begin{gathered}${imgs} \\[6pt] T(\vec x) = \underbrace{${Atex}}_{A\ (${m}\times ${n})}${vars.length ? R`\begin{bmatrix}${vars.join('\\\\')}\end{bmatrix}` : ''}${info.type === 'afin' ? R` + \underbrace{${tv(info.T0)}}_{\vec b}` : ''}\end{gathered}`);
        nM.set('pos', R`Las columnas de $A$ son ${info.type === 'afin' ? 'los desplazamientos $T(\\vec e_j) - T(\\vec 0)$' : 'las imágenes $T(\\vec e_j)$'}. $A$ tiene ${m} filas porque la salida tiene ${m} coordenadas y ${n} columnas porque la entrada tiene ${n}.${m !== n ? ' No es cuadrada: no tiene determinante ni inversa.' : ''}`);
      } else {
        const comb = E.reduce((acc, e, j) => add(acc, scale(T(e), x[j])), Array(m).fill(0));
        cM.set(E.map((e, j) => R`T(\vec e_${j + 1}) = ${V(T(e))}`).join(',\\quad '));
        nM.set('neg', R`<b>No hay matriz.</b> Las imágenes $T(\vec e_j)$ se pueden calcular, pero no reconstruyen $T$: con el $\vec x$ de abajo, ${vars.map((vv, j) => `${fmt(x[j])}\\,T(\\vec e_${j + 1})`).map((t) => `$${t}$`).join(' + ')} $= ${V(comb)}$, pero $T(\vec x) = ${V(Tx)}$.`);
      }

      // --- vector x ---
      const sub1 = trees.map((t) => texExpr(t, env(x)));
      cX.set(R`T${R`\begin{pmatrix}${x.map((a) => fmt(a)).join('\\\\')}\end{pmatrix}`} = \begin{bmatrix}${sub1.join('\\\\')}\end{bmatrix} = ${V(Tx)}${info.type === 'lineal' ? R` = ${x.map((a, j) => `${a < 0 ? `(${fmt(a)})` : fmt(a)}\\,${colTex(j)}`).join(' + ')}` : ''}`);
    }

    refreshAll();
    return { destroy: () => stop() };
  },
};
