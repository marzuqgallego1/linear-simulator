import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, matVec, matMul, col, det, fmt, pf, tv, tm, clr } from '../core/math.js';
import { LineView, PlaneView } from '../core/geom.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, sizePicker, slider, button, buttonRow, chips, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS, basisColors } from '../core/presets.js';

const OK = '#51cf66', BAD = '#ff6b6b';
const c = Math.SQRT1_2;
const PAIRS = {
  2: [
    ['Rotar y cizallar', [[0, -1], [1, 0]], [[1, 1], [0, 1]]],
    ['Escalar y rotar', [[0, -1], [1, 0]], [[2, 0], [0, 1]]],
    ['Dos rotaciones', [[c, -c], [c, c]], [[0, -1], [1, 0]]],
    ['Dos reflexiones', [[-1, 0], [0, 1]], [[0, 1], [1, 0]]],
    ['A · A (cuadrado)', [[1, 1], [0, 1]], [[1, 1], [0, 1]]],
  ],
  3: [
    ['Rotar y cizallar', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[1, 0, 1], [0, 1, 0], [0, 0, 1]]],
    ['Escalar y rotar', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[2, 0, 0], [0, 1, 0], [0, 0, 1]]],
    ['Dos rotaciones (eje z)', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]]],
    ['Rotaciones en ejes distintos', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, -1], [0, 1, 0]]],
  ],
};
// Ejemplos de tamaños libres: [nombre, A, B]
const RECT = {
  2: [
    ['Matriz · vector', [[0, -1], [1, 0]], [[2], [1]]],
    ['Fila · columna', [[1, 2]], [[3], [1]]],
    ['Columna · fila', [[3], [1]], [[1, 2]]],
    ['No encajan', [[1], [2]], [[1, 0], [0, 1]]],
    ['Vector · vector', [[1], [2]], [[3], [1]]],
  ],
  3: [
    ['Matriz · vector', [[1, 0, 1], [0, 1, 0], [1, 1, 1]], [[1], [2], [1]]],
    ['Levantar y aplanar', [[1, 0, 1], [0, 1, 1]], [[1, 0], [0, 1], [1, 1]]],
    ['Fila · columna', [[1, 2, -1]], [[2], [0], [1]]],
    ['No encajan', [[1, 0, 1], [0, 1, 1]], [[1, 2], [0, 1]]],
    ['Vector · vector', [[1], [2], [1]], [[2], [0], [1]]],
  ],
};

const state = {
  2: { mode: 'cuad', A: PAIRS[2][0][1], B: PAIRS[2][0][2], order: 'AB', x: [1, 1], s: 2, RA: RECT[2][1][1], RB: RECT[2][1][2], xr: [1, 1] },
  3: { mode: 'cuad', A: PAIRS[3][0][1], B: PAIRS[3][0][2], order: 'AB', x: [1, 1, 1], s: 2, RA: RECT[3][1][1], RB: RECT[3][1][2], xr: [1, 1, 1] },
};

const size = (M) => [M.length, M[0].length];
const resize = (M, r, k) => Array.from({ length: r }, (_, i) => Array.from({ length: k }, (_, j) => M[i]?.[j] ?? (i === j ? 1 : 0)));
const Rn = (d) => R`\mathbb{R}^{${d}}`;
const fit = (v, p) => Array.from({ length: p }, (_, i) => v[i] ?? 0);

export default {
  id: 'producto',
  title: 'Producto de matrices',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const rect = () => st.mode === 'rect';
    const ab = () => st.order === 'AB';
    // En AB se aplica primero B (factor derecho) y luego A (factor izquierdo).
    const names = () => (ab() ? ['B', 'A'] : ['A', 'B']); // [primera, segunda]
    const info = () => {
      const [A, B] = rect() ? [st.RA, st.RB] : [st.A, st.B];
      const [L, Rf] = ab() ? [A, B] : [B, A];
      const [m, kin] = size(L), [k, p] = size(Rf);
      return { L, Rf, m, kin, k, p, ok: kin === k };
    };
    const pad = (Mx) => I.map((r, i) => r.map((_, j) => Mx[i]?.[j] ?? 0));
    const proj = (d) => I.map((r, i) => r.map((x, j) => (i === j && i < d ? 1 : 0)));
    const M = () => {
      const { L, Rf, k, p, ok } = info();
      const s = rect() && !ok ? Math.min(st.s, 1) : st.s;
      if (s <= 1) return lerpMat(proj(p), pad(Rf), s);
      return matMul(lerpMat(proj(k), pad(L), s - 1), pad(Rf));
    };
    const xin = () => (rect() ? fit(fit(st.xr, info().p), n) : st.x);
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.45 : 0.28 });
    const outSp = new LineView(stage, OK, { radius: 0.03 }), outPl = dim === 3 ? new PlaneView(stage, OK, { opacity: 0.1, L: 4 }) : null;
    const inSp = new LineView(stage, BAD, { radius: 0.03 }), inPl = dim === 3 ? new PlaneView(stage, BAD, { opacity: 0.1, L: 4 }) : null;
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    const xg = new Arrow(stage, C.x, { opacity: 0.3, radius: 0.025, label: R`\vec x` });
    const xa = new Arrow(stage, C.x, { radius: 0.045, label: ' ' });
    stage.addHandle({
      color: C.x, get: () => xin(),
      set: (p) => { if (rect()) st.xr = fit(p, info().p); else st.x = p; update(); },
    });

    // --- panel: comunes ---
    const run = (a, b) => { stop(); st.s = a; update(); stop = animate(a, b, 1300 * (b - a), (v) => { st.s = v; update(); }); };
    const mode = chips([['cuad', 'Cuadradas (transformaciones)'], ['rect', 'Cualquier tamaño']], () => st.mode, (m) => { stop(); st.mode = m; st.s = 2; build(); update(); });
    const order = chips([['AB', 'AB: primero B, luego A'], ['BA', 'BA: primero A, luego B']], () => st.order, (o) => { st.order = o; build(); run(0, 2); });
    const ss = slider({ label: 's', min: 0, max: 2, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const b1 = button('1 · Primera', () => run(0, 1));
    const b2 = button('2 · Segunda', () => run(1, 2));
    const phase = new Note();

    // --- panel: cuadradas ---
    const colors = basisColors(n);
    const setSq = (key) => (Mx) => { stop(); st[key] = Mx; update(); };
    const mA = matEditor({ dim, colors, get: () => st.A, set: setSq('A'), name: 'A' });
    const mB = matEditor({ dim, colors, get: () => st.B, set: setSq('B'), name: 'B' });
    const pairs = h('div', { class: 'presets' }, PAIRS[dim].map(([name, A, B]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); st.B = B.map((r) => [...r]); run(0, 2); } }, name)));
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => st.x, set: (v) => { st.x = v; update(); } });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox(), cmp = new Note(), cx = new TexBox();
    const sqBox = h('div', {},
      card('Matrices', h('div', { class: 'row' }, mA.el, mB.el), pairs),
      card('El producto', c1.el, rich(R`Cada columna del producto es la primera matriz aplicada a la columna correspondiente de la otra; cada entrada es <b>fila por columna</b>:`), c2.el, c3.el, cmp.el),
      card('Vector de prueba', ex.el, cx.el));

    // --- panel: cualquier tamaño ---
    const edBox = h('div'), exBox = h('div');
    const rectPre = h('div', { class: 'presets' }, RECT[dim].map(([name, A, B]) =>
      h('button', { class: 'chip', onclick: () => { st.RA = A.map((r) => [...r]); st.RB = B.map((r) => [...r]); st.order = 'AB'; build(); run(0, 2); } }, name)));
    const cSize = new TexBox(), nSize = new Note(), cMap = new TexBox();
    const cProd = new TexBox(), cEntry = new TexBox(), nProd = new Note(), nOther = new Note();
    let rEds = [];
    function build() {
      rEds = [];
      const blk = (key, name) => {
        const sp = sizePicker({ max: n, get: () => size(st[key]), set: ([r, k]) => { stop(); st[key] = resize(st[key], r, k); build(); update(); } });
        const ed = matEditor({ rows: st[key].length, cols: st[key][0].length, get: () => st[key], set: (Mx) => { stop(); st[key] = Mx; update(); }, name });
        rEds.push(sp, ed);
        return h('div', { class: 'mat-block' }, h('span', { class: 'size-picker' }, rich(`$${name}$:`, 'span'), sp.el), ed.el);
      };
      edBox.replaceChildren(h('div', { class: 'row' }, blk('RA', 'A'), blk('RB', 'B')));
      const p = info().p;
      const rx = vecEditor({ name: R`\vec x \in ${Rn(p)}`, color: C.x, dim: p, get: () => fit(st.xr, p), set: (v) => { st.xr = v; update(); } });
      rEds.push(rx);
      exBox.replaceChildren(rx.el);
    }
    const rectBox = h('div', {},
      card('Tamaños y valores', rich(R`Elige filas × columnas de cada matriz (hasta ${n}, porque el dibujo es en ${n}D). Un <b>vector</b> es una matriz de una sola columna.`), edBox, rectPre),
      card('¿Se pueden multiplicar?', cSize.el, nSize.el, cMap.el),
      card('El producto', cProd.el, cEntry.el, nProd.el, nOther.el),
      card('Vector de prueba', exBox));

    panel.append(
      ...intro('Producto de matrices',
        R`Multiplicar matrices es <b>encadenar transformaciones</b>. $AB$ significa: primero aplica $B$, y al resultado aplícale $A$ (se lee de derecha a izquierda, igual que $A(B\vec x)$). Como el orden de las acciones importa, en general $AB \neq BA$.`),
      card('Tipo de matrices', mode.el),
      sqBox, rectBox,
      card('Orden', order.el, ss.el, buttonRow(b1, b2, button('▶ Todo', () => run(0, 2), 'primary'), button('Reiniciar', () => { stop(); st.s = 0; update(); })), phase.el),
      details('Definición formal',
        rich(R`Si $A$ es $m\times n$ y $B$ es $n\times p$, $(AB)_{ij} = \sum_k a_{ik}\,b_{kj}$: la fila $i$ de $A$ por la columna $j$ de $B$. El resultado es $m\times p$. Para que exista, $A$ debe tener <b>tantas columnas como filas tiene</b> $B$: los dos números «de dentro» deben coincidir.`),
        rich(R`Como transformaciones: una matriz $m\times n$ toma vectores de $\mathbb{R}^n$ (tantos números como columnas) y devuelve vectores de $\mathbb{R}^m$ (tantos como filas). Encadenar exige que lo que sale de la primera sea lo que acepta la segunda.`),
        rich(R`Propiedades: es asociativo, $(AB)C = A(BC)$, pero <b>no</b> conmutativo. Si son cuadradas, $\det(AB) = \det A\cdot\det B$ y $(AB)^{-1} = B^{-1}A^{-1}$ (para deshacer, se deshace en orden inverso).`),
        rich(R`Las potencias son productos repetidos: $A^2 = AA$ es aplicar $A$ dos veces. Solo existen para matrices cuadradas.`)),
      tryList([
        'Con «Rotar y cizallar», cambia entre AB y BA: la rejilla final es distinta.',
        R`Con «Dos rotaciones», cambia el orden: el resultado es el mismo. Las rotaciones ${dim === 2 ? 'del plano' : 'alrededor del mismo eje'} conmutan.`,
        R`En «Cualquier tamaño», prueba «Fila · columna» y luego cambia a BA: un solo número (producto punto) contra una matriz ${n}×${n} entera.`,
        R`En «No encajan», mira el «?» en rojo: a la fila le sobran números o le faltan para emparejarse con la columna. Luego cambia el orden: en el otro sentido sí encajan.`,
        R`En «Vector · vector», no encaja en ningún orden. Por eso el producto punto se escribe $\vec u^{\mathsf T}\vec v$: hay que tumbar uno de los dos.`,
      ]),
    );

    function update() {
      const isR = rect(), F = info();
      sqBox.style.display = isR ? 'none' : '';
      rectBox.style.display = isR ? '' : 'none';
      if (isR && !F.ok && st.s > 1) st.s = 1;
      const Mt = M(), x = xin();
      const [f, g] = names();
      grid.setMatrix(Mt);
      const pIn = isR ? F.p : n;
      basis.forEach((a, j) => a.setVisible(j < pIn).set(O, col(Mt, j)));
      xg.set(O, x);
      xa.set(O, matVec(Mt, x));
      xa.setLabel(st.s < 0.5 ? R`\vec x` : st.s <= 1.5 ? R`${f}\vec x` : R`${g}${f}\vec x`);

      // cuando no encajan: espacio de salida de la primera (verde) y de entrada de la segunda (rojo)
      [outSp, inSp].forEach((v) => v.setVisible(false));
      [outPl, inPl].forEach((v) => v?.setVisible(false));
      if (isR && !F.ok) {
        const showSp = (d, line, pl) => { if (d === 1) line.set(O, I[0]); else if (d === 2 && pl) pl.set(O, I[2]); };
        showSp(F.k, outSp, outPl);
        showSp(F.kin, inSp, inPl);
      }

      ss.input.max = isR && !F.ok ? '1' : '2';
      [mode, order, ss].forEach((cc) => cc.refresh());
      b1.textContent = `1 · Aplicar ${f}`;
      b2.textContent = `2 · Aplicar ${g}`;
      b2.disabled = isR && !F.ok;

      const v = st.s;
      if (isR && !F.ok) {
        phase.set('neg', v < 0.995 ? `Aplicando $${f}$…` : R`Después de $${f}$ los vectores tienen ${F.k} componente${F.k > 1 ? 's' : ''}, pero $${g}$ necesita vectores de ${F.kin}. <b>No se puede seguir.</b>`);
      } else {
        phase.set(v > 1.995 ? 'pos' : '', v < 0.005 ? 'Estado: espacio original.'
          : v < 0.995 ? `Aplicando $${f}$ (la que va a la derecha)…`
            : v < 1.005 ? `Después de $${f}$. Ahora se aplica $${g}$ sobre lo que ya se movió.`
              : v < 1.995 ? `Aplicando $${g}$…` : `Resultado: la rejilla final es la de la matriz $${g}${f}$.`);
      }

      if (isR) updateRect(F, f, g); else updateSquare();
    }

    function updateSquare() {
      [mA, mB, ex].forEach((cc) => cc.refresh());
      const P = ab() ? matMul(st.A, st.B) : matMul(st.B, st.A);
      const Q = ab() ? matMul(st.B, st.A) : matMul(st.A, st.B);
      const [L, Rr] = ab() ? [st.A, st.B] : [st.B, st.A];
      const [ln, rn] = ab() ? ['A', 'B'] : ['B', 'A'];
      c1.set(R`${ln}${rn} = ${tm(L)}${tm(Rr)} = ${tm(P)}`);
      c2.set(R`${ln}${rn} = \big[\,${BASIS.slice(0, n).map((b, j) => clr(b.color, `${ln}\\,\\vec ${rn.toLowerCase()}_${j + 1}`)).join('\\ \\ ')}\,\big]`);
      const row0 = L[0], col0 = col(Rr, 0);
      c3.set(R`(${ln}${rn})_{11} = \text{fila 1 de } ${ln}\cdot\text{columna 1 de } ${rn} = ${row0.map((a, k) => `${pf(a)}\\cdot${pf(col0[k])}`).join(' + ')} = ${fmt(P[0][0])}`);
      const same = P.every((r, i) => r.every((x, j) => Math.abs(x - Q[i][j]) < 1e-9));
      cmp.set(same ? 'pos' : 'neg', same
        ? R`Aquí $AB = BA$: estas dos matrices <b>conmutan</b>, el orden no importa. Es la excepción, no la regla.`
        : R`$${rn}${ln} = ${tm(Q)} \neq ${ln}${rn}$: <b>el orden importa</b>. Cambia el orden y mira cómo cambia la rejilla final.`);
      const y1 = matVec(Rr, st.x), y2 = matVec(L, y1);
      cx.set(R`${ln}(${rn}\vec x) = ${ln}${clr(C.x, tv(y1))} = ${clr(C.x, tv(y2))} = (${ln}${rn})\vec x\qquad \det(${ln}${rn}) = ${fmt(det(L))}\cdot${fmt(det(Rr))} = ${fmt(det(P))}`);
    }

    function updateRect(F, f, g) {
      rEds.forEach((cc) => cc.refresh());
      const { L, Rf, m, kin, k, p, ok } = F;
      const cc = ok ? OK : BAD;
      cSize.set(R`\underset{${m}\times${clr(cc, kin)}}{${g}}\ \underset{${clr(cc, k)}\times${p}}{${f}}${ok ? R`\ =\ \underset{${m}\times${p}}{${g}${f}}` : R`\quad\text{no existe}`}`);
      nSize.set(ok ? 'pos' : 'neg', ok
        ? R`Los números de dentro coinciden (${kin} = ${k}): cada fila de $${g}$ tiene tantos números como cada columna de $${f}$. El resultado toma los de fuera: ${m}×${p}.`
        : R`Los números de dentro no coinciden (${kin} ≠ ${k}): las filas de $${g}$ tienen ${kin} número${kin > 1 ? 's' : ''} y las columnas de $${f}$ tienen ${k}. No se pueden emparejar.`);
      cMap.set(R`${Rn(p)}\ \xrightarrow{\ ${f}\ }\ ${clr(OK, Rn(k))}\ ${ok ? '=' : '\\neq'}\ ${clr(ok ? OK : BAD, Rn(kin))}\ \xrightarrow{\ ${g}\ }\ ${Rn(m)}`);

      const row0 = L[0], col0 = col(Rf, 0);
      const pair = (t) => (t < kin && t < k ? `${pf(row0[t])}\\cdot${pf(col0[t])}`
        : t < kin ? `${pf(row0[t])}\\cdot${clr(BAD, '?')}` : `${clr(BAD, '?')}\\cdot${pf(col0[t])}`);
      const terms = Array.from({ length: Math.max(kin, k) }, (_, t) => pair(t)).join(' + ');
      if (ok) {
        const P = matMul(L, Rf);
        cProd.set(R`${g}${f} = ${tm(L)}${tm(Rf)} = ${tm(P)}`);
        cEntry.set(R`(${g}${f})_{11} = \text{fila 1 de } ${g}\cdot\text{columna 1 de } ${f} = ${terms} = ${fmt(P[0][0])}`);
        nProd.set('', m === 1 && p === 1
          ? R`Una fila por una columna da un solo número: es el <b>producto punto</b>, $\vec u^{\mathsf T}\vec v$.`
          : p === 1 ? R`Matriz por vector: el resultado es otro vector, de ${m} componente${m > 1 ? 's' : ''}. Es aplicar la transformación al vector.`
            : kin === 1 ? R`Columna por fila: cada entrada es un solo producto. El resultado (${m}×${p}) tiene rango 1: todas sus columnas son múltiplos de la misma.`
              : R`Cada entrada es una fila de $${g}$ por una columna de $${f}$, y cada una tiene ${k} números.`);
        const y = matVec(L, matVec(Rf, fit(st.xr, p)));
        nOther.set('', R`Con el vector de prueba: $${g}(${f}\vec x) = ${tv(y)}$, un vector de $${Rn(m)}$.`);
      } else {
        const lo = Math.min(k, kin), hi = Math.max(k, kin);
        cProd.set(R`${g}${f} = ${tm(L)}${tm(Rf)} = \ ${clr(BAD, '?')}`);
        cEntry.set(R`\text{fila 1 de } ${g}\cdot\text{columna 1 de } ${f} = ${terms}`);
        nProd.set('neg', R`Al emparejar fila con columna, ${kin > k ? 'a la fila le sobran números' : 'a la columna le sobran números'}: el «?» no tiene pareja. Geométricamente, $${f}$ entrega vectores de $${Rn(k)}$ (verde) y $${g}$ solo sabe transformar vectores de $${Rn(kin)}$ (rojo). En el dibujo $${Rn(lo)}$ aparece dentro del espacio, pero un vector de ${lo} número${lo > 1 ? 's' : ''} no es un vector de ${hi}: falta información o sobra.`);
        const otherOk = p === m;
        nOther.set(otherOk ? 'pos' : '', otherOk
          ? R`En el otro orden sí encajan: $${f}${g}$ es (${k}×${p})(${m}×${kin}) = ${k}×${kin}. Cambia el orden para verlo.`
          : R`En el otro orden tampoco: (${k}×${p})(${m}×${kin}) tiene ${p} ≠ ${m} dentro.`);
      }
    }

    build();
    update();
    return { destroy: () => stop() };
  },
};
