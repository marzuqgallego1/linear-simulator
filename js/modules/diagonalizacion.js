import { Arrow, Lattice, Polyline, Dot, C } from '../core/stage.js';
import { identity, lerpMat, matMul, matVec, transpose, inverse, eigen, det, add, scale, polyTex, fmt, pf, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, chips, TexBox, Note, rich, animate, tabs, Stepper } from '../core/ui.js';
import { basisColors } from '../core/presets.js';
import { LineView } from '../core/geom.js';

const EC = [C.u, C.v, '#20c997']; // un color por autovector (columna de P)
const EG = C.w; // rejilla de autovectores
const KMAX = 12;

const PRE = {
  2: [
    ['General', [[4, -1], [2, 1]]],
    ['Simétrica', [[2, 1], [1, 2]]],
    ['Markov', [[0.8, 0.3], [0.2, 0.7]]],
    ['Fibonacci', [[1, 1], [1, 0]]],
    ['Se apaga', [[0.5, 0.4], [0.1, 0.8]]],
    ['Reflexión', [[0, 1], [1, 0]]],
    ['Cizalla', [[1, 1], [0, 1]]],
    ['Rotación', [[0.8, -0.6], [0.6, 0.8]]],
  ],
  3: [
    ['General', [[2, 0, 1], [1, 1, 0], [0, 0, 3]]],
    ['Simétrica', [[2, 1, 0], [1, 2, 0], [0, 0, 3]]],
    ['Markov', [[0.7, 0.2, 0.1], [0.2, 0.6, 0.3], [0.1, 0.2, 0.6]]],
    ['Se apaga', [[0.9, 0.2, 0], [0, 0.6, 0.2], [0, 0, 0.4]]],
    ['Cizalla', [[1, 1, 0], [0, 1, 0], [0, 0, 2]]],
    ['Rotación (z)', [[0.8, -0.6, 0], [0.6, 0.8, 0], [0, 0, 1]]],
  ],
};

const state = {
  2: { A: PRE[2][0][1], x: [2, 1], mode: 'pasos', s: 3, k: 0, tab: 'exp', step: 0 },
  3: { A: PRE[3][0][1], x: [2, 0, 1], mode: 'pasos', s: 3, k: 0, tab: 'exp', step: 0 },
};

/** Multiplicidad algebraica de una raíz del polinomio (coeficientes de mayor a menor grado). */
function multiplicity(poly, x) {
  let p = [...poly], m = 0;
  while (p.length > 1) {
    const v = p.reduce((s, c) => s * x + c, 0);
    if (Math.abs(v) > 1e-6) break;
    m++;
    const deg = p.length - 1;
    p = p.slice(0, -1).map((c, i) => c * (deg - i)); // derivada
  }
  return Math.max(m, 1);
}

/** Intenta escribir A = P D P⁻¹. */
function diagonalize(A) {
  const n = A.length, E = eigen(A);
  const cols = [];
  E.values.forEach(({ lambda, vectors }) => vectors.forEach((v) => cols.push({ lambda, v: [...v] })));
  const info = E.values.map(({ lambda, vectors }) => ({ lambda, alg: multiplicity(E.poly, lambda), geo: vectors.length }));
  const realCount = info.reduce((s, x) => s + x.alg, 0);
  if (cols.length < n) return { ok: false, E, cols, info, complex: realCount < n };
  let P = transpose(cols.map((c) => c.v));
  // det P > 0: así el paso P⁻¹ es una deformación continua, sin aplastar el plano por el camino
  const flipped = det(P) < 0;
  if (flipped) { cols[n - 1].v = scale(cols[n - 1].v, -1); P = transpose(cols.map((c) => c.v)); }
  const lams = cols.map((c) => c.lambda);
  const Dm = (k = 1) => lams.map((l, i) => lams.map((_, j) => (i === j ? l ** k : 0)));
  return { ok: true, E, cols, info, P, Pi: inverse(P), lams, Dm, flipped };
}

const matPow = (A, k) => { let M = identity(A.length); for (let i = 0; i < k; i++) M = matMul(A, M); return M; };

export default {
  id: 'diagonalizacion',
  title: 'Diagonalización y potencias',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    let F = diagonalize(st.A);
    const powAt = (kk) => {
      const a = Math.floor(kk), f = kk - a;
      return f < 1e-9 ? matPow(st.A, a) : lerpMat(matPow(st.A, a), matPow(st.A, a + 1), f);
    };
    // modo «pasos», s ∈ [0,1]: P⁻¹   [1,2]: D   [2,3]: P
    const M = () => {
      if (st.mode === 'pot' && st.tab === 'exp') return powAt(st.k);
      if (!F.ok) return st.A;
      const s = st.s;
      if (s <= 1) return lerpMat(I, F.Pi, s);
      if (s <= 2) return matMul(lerpMat(I, F.Dm(), s - 1), F.Pi);
      return matMul(lerpMat(I, F.P, s - 2), matMul(F.Dm(), F.Pi));
    };
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.18 : 0.1 });
    const egrid = new Lattice(stage, EG, { opacity: dim === 2 ? 0.4 : 0.22 });
    const eLines = EC.slice(0, n).map((c) => new LineView(stage, c, { radius: 0.02 }));
    const eArr = EC.slice(0, n).map((c) => new Arrow(stage, c, { radius: 0.05, label: ' ' }));
    const comp = EC.slice(0, n).map((c) => new Arrow(stage, c, { radius: 0.025, opacity: 0.6 }));
    const xg = new Arrow(stage, C.x, { opacity: 0.35, radius: 0.025, label: R`\vec x` });
    const xa = new Arrow(stage, C.x, { radius: 0.045, label: ' ' });
    const orbit = new Polyline(stage, C.x, { opacity: 0.5, dashed: true, dash: 0.08 });
    const dots = Array.from({ length: KMAX + 1 }, () => new Dot(stage, C.x, { radius: dim === 2 ? 0.07 : 0.06 }));
    stage.addHandle({ color: C.x, visible: () => st.tab === 'exp', get: () => st.x, set: (p) => { stop(); st.x = p; update(); } });

    // --- panel ---
    const runS = (a, b) => { stop(); st.s = a; update(); stop = animate(a, b, 1300 * (b - a), (v) => { st.s = v; update(); }); };
    const runK = (b) => {
      stop(); const a = st.k;
      if (b === a) return;
      stop = animate(a, b, Math.min(5000, 650 * Math.abs(b - a)), (v) => { st.k = v; update(); });
    };
    const me = matEditor({ dim, colors: basisColors(n), get: () => st.A, set: (A) => { stop(); st.A = A; st.s = 3; update(); } });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); F = diagonalize(st.A); if (st.mode === 'pasos') runS(0, 3); else { st.k = 0; runK(dim === 2 ? 8 : 6); } } }, name)));
    const mode = chips([['pasos', 'A = PDP⁻¹ en tres pasos'], ['pot', 'Potencias Aᵏ']], () => st.mode, (m) => { stop(); st.mode = m; update(); });

    const ss = slider({ label: 's', min: 0, max: 3, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const bS = [button('1 · P⁻¹', () => runS(0, 1)), button('2 · D', () => runS(1, 2)), button('3 · P', () => runS(2, 3)), button('▶ Todo', () => runS(0, 3), 'primary')];
    const phase = new Note();
    const cardS = card('Los tres pasos', ss.el, buttonRow(...bS), phase.el);

    const sk = slider({ label: 'k', min: 0, max: KMAX, step: 1, get: () => st.k, set: (v) => { stop(); st.k = v; update(); }, format: (x) => fmt(x, 1) });
    const phaseK = new Note(), cPow = new TexBox();
    const cardK = card('Potencias: aplicar A una y otra vez', sk.el,
      buttonRow(button('◀ k − 1', () => runK(Math.max(0, Math.ceil(st.k) - 1))), button('k + 1 ▶', () => runK(Math.min(KMAX, Math.floor(st.k) + 1))),
        button(`▶ Hasta ${KMAX}`, () => runK(KMAX), 'primary'), button('k = 0', () => { stop(); st.k = 0; update(); })),
      rich(R`Los puntos son $\vec x, A\vec x, A^2\vec x, \dots$ La rejilla muestra $A^k$.`, 'p', 'note'),
      cPow.el, phaseK.el);

    const cP = new TexBox(), nD = new Note();
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => st.x, set: (v) => { stop(); st.x = v; update(); } });
    const cX = new TexBox(), nX = new Note();

    // --- procedimiento ---
    // escena de cada paso: s = momento de la animación PDP⁻¹ (0: base de siempre, 1: tras P⁻¹, 3: A),
    // eig = cuántas direcciones propias se muestran, eg = si se ve la rejilla de autovectores
    let scene = [];
    const goS = (b) => { stop(); const a = st.s; if (Math.abs(b - a) < 1e-6) return update(); stop = animate(a, b, 500 * Math.abs(b - a) + 300, (v) => { st.s = v; update(); }); };
    const stepper = new Stepper((i) => { st.step = i; update(); goS(scene[i]?.s ?? 3); });
    const Ptex = () => R`\begin{bmatrix}${Array.from({ length: n }, (_, i) => F.cols.map((cc, j) => clr(EC[j], fmt(cc.v[i]))).join('&')).join('\\\\')}\end{bmatrix}`;
    const Dtex = () => R`\begin{bmatrix}${F.lams.map((l, i) => F.lams.map((_, j) => (i === j ? clr(EC[i], fmt(l)) : '0')).join('&')).join('\\\\')}\end{bmatrix}`;
    function buildProc() {
      const A = st.A, E = F.E, steps = [];
      scene = [];
      const add1 = (step, sc) => { steps.push(step); scene.push({ s: 0, eig: 0, eg: false, ...sc }); };
      const lin = (r) => (Math.abs(r) < 1e-12 ? R`\lambda` : R`(\lambda ${r > 0 ? '-' : '+'} ${fmt(Math.abs(r))})`);
      const pA = n === 2 ? E.poly : E.poly.map((c) => -c);
      const fac = F.info.map(({ lambda, alg }) => lin(lambda) + (alg > 1 ? `^${alg}` : '')).join('');
      add1({
        title: '1. Los autovalores',
        tex: [...(n === 2 ? [R`\det(A - \lambda I) = ${polyTex(pA)}`] : [R`\det(A - \lambda I) =`, R`${polyTex(pA)}`]), F.info.length ? R`${n === 3 ? '-' : ''}${fac}${F.complex ? R`\cdots` : ''} = 0` : R`\text{sin raíces reales}`,
          F.info.length ? F.info.map(({ lambda }, i) => R`\lambda_${i + 1} = ${fmt(lambda)}`).join(R`,\ `) : ''].filter(Boolean),
        why: R`$D$ va a llevar en la diagonal los factores por los que $A$ estira cada dirección propia: los autovalores. Se hallan como en «Autovalores»: las raíces de $\det(A - \lambda I)$, los $\lambda$ que hacen que $A - \lambda I$ aplaste el espacio.`,
      }, { s: 3 });
      let k = 0;
      E.values.forEach(({ lambda, B, vectors }, i) => {
        k += vectors.length;
        add1({
          title: `2. Autovectores de λ = ${fmt(lambda)}`,
          tex: [R`(A - ${fmt(lambda)}I)\vec v = ${tm(B)}\vec v = \vec 0`, R`\Rightarrow\ ${vectors.map((v, q) => R`\vec v_${k - vectors.length + q + 1} = ${tv(v)}`).join(R`,\ `)}`],
          why: R`son el núcleo de $A - \lambda I$ (escalonando). ${vectors.length === 1 ? 'Sale una recta: se toma un vector que la represente; cualquier múltiplo no nulo serviría igual.' : `Sale ${vectors.length === 2 ? 'un plano' : 'todo el espacio'}: se toman ${vectors.length} vectores independientes que ${vectors.length === 2 ? 'lo' : 'lo'} generen.`} En la escena aparecen sus rectas: las direcciones que $A$ no gira.`,
        }, { s: 3, eig: k });
      });
      const tab = F.info.map(({ lambda, alg, geo }) => R`\lambda = ${fmt(lambda)}:\ \text{raíz ${alg === 1 ? 'simple' : alg === 2 ? 'doble' : 'triple'}},\ ${geo}\ \text{autovector${geo === 1 ? '' : 'es'}}`);
      if (!F.ok) {
        add1({
          title: '3. ¿Alcanzan? No',
          tex: tab.length ? [...tab, R`${F.cols.length} < ${n}`] : R`0 < ${n}`,
          why: F.complex
            ? R`hacen falta ${n} autovectores independientes para formar las columnas de $P$, pero ${F.info.length ? 'algunas raíces' : 'las raíces'} del polinomio no son reales: en los reales no hay suficientes direcciones que se conserven. <b>No es diagonalizable</b> (en $\mathbb{R}$).`
            : R`hacen falta ${n} autovectores independientes para las columnas de $P$. Una raíz repetida aporta como mucho tantos como su multiplicidad, y aquí aporta menos: le faltan direcciones. <b>No es diagonalizable</b>: no hay base en la que $A$ solo estire.`,
        }, { s: 3, eig: F.cols.length });
      } else {
        add1({
          title: '3. ¿Alcanzan? Sí',
          tex: [...tab, R`${n}\ \text{autovectores independientes}`],
          why: F.info.every((x) => x.alg === 1)
            ? R`con ${n} autovalores distintos, los autovectores siempre son independientes: hay justo los ${n} que hacen falta para las columnas de $P$.`
            : R`la raíz repetida tiene tantos autovectores independientes como su multiplicidad, así que en total hay ${n}: basta para formar $P$.`,
        }, { s: 3, eig: n });
        add1({
          title: '4. Armar P y D',
          tex: [R`P = ${Ptex()}`, R`D = ${Dtex()}`],
          why: R`$P$ lleva los autovectores como <b>columnas</b>, y $D$ sus autovalores en la diagonal, <b>en el mismo orden</b> (cada color con su color). En la escena, la rejilla amarilla es la que forman los autovectores: la «cuadrícula natural» de $A$.${F.flipped ? ' (Se cambió el signo de un autovector para que $\\det P > 0$; también es autovector.)' : ''}`,
        }, { s: 0, eig: n, eg: true });
        const P = F.P, dP = det(P);
        add1({
          title: '5. Calcular P⁻¹',
          tex: n === 2
            ? [R`P^{-1} = \frac{1}{${fmt(dP)}}\begin{bmatrix}${fmt(P[1][1])} & ${fmt(-P[0][1])}\\ ${fmt(-P[1][0])} & ${fmt(P[0][0])}\end{bmatrix}`, R`= ${tm(F.Pi)}`]
            : [R`\det P = ${fmt(dP)} \neq 0`, R`P^{-1} = ${tm(F.Pi)}`],
          why: R`${n === 2 ? 'con la fórmula de la inversa $2\\times2$ (intercambiar la diagonal, cambiar el signo de la otra, dividir entre el determinante)' : 'con Gauss-Jordan sobre $[P\\,|\\,I]$, como en «Matriz inversa»'}. $P^{-1}$ pasa a <b>coordenadas de autovectores</b>: en la escena, la rejilla amarilla se endereza y cada $\vec v_i$ cae sobre su eje $\vec e_i$.`,
        }, { s: 1, eig: n, eg: true });
        add1({
          title: '6. Comprobar: AP = PD',
          tex: [R`AP = ${tm(matMul(A, P))}`, R`PD = ${tm(matMul(P, F.Dm()))}`],
          why: R`es más fácil que comprobar $A = PDP^{-1}$ y dice lo mismo: columna por columna, $A\vec v_i = \lambda_i\vec v_i$. Multiplicando por $P^{-1}$ a la derecha sale $A = PDP^{-1}$. En la escena se completa: $P^{-1}$, luego $D$ (solo estira los ejes) y luego $P$ (vuelve).`,
        }, { s: 3, eig: n, eg: true });
        add1({
          title: '7. Para qué: potencias',
          tex: [R`A^k = P\,D^k\,P^{-1}`, R`D^k = \begin{bmatrix}${F.lams.map((l, i) => F.lams.map((_, j) => (i === j ? clr(EC[i], `${pf(l)}^k`) : '0')).join('&')).join('\\\\')}\end{bmatrix}`],
          why: R`al multiplicar $(PDP^{-1})(PDP^{-1})\cdots$, cada $P^{-1}P$ del medio se cancela. Y elevar una diagonal es elevar cada número: calcular $A^{100}$ cuesta lo mismo que $A^2$. Pruébalo en «Explorar», modo «Potencias».`,
        }, { s: 3, eig: n, eg: true });
      }
      stepper.set(steps, st.step);
      st.step = stepper.i;
    }
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => st.tab, (key) => {
      stop(); st.tab = key; tb.refresh(); update();
      if (key === 'calc') goS(scene[st.step]?.s ?? 3);
    });

    panel.append(
      ...intro('Diagonalización y potencias',
        R`Si $A$ tiene ${n} autovectores independientes, en la base formada por ellos $A$ <b>solo estira cada eje</b>: es una matriz diagonal. Eso se escribe $A = PDP^{-1}$, donde $P$ tiene los autovectores como columnas y $D$ los autovalores en la diagonal. La ganancia: $A^k = PD^kP^{-1}$, y elevar una diagonal es elevar cada número.`),
      card('Matriz A', me.el, pre),
      tb.el, tb.panes.exp, tb.panes.calc,
    );
    tb.panes.calc.append(
      rich(R`Método: hallar autovalores y autovectores, comprobar que hay ${n} independientes, y ponerlos en $P$ y $D$. La escena sigue cada paso con la animación $P^{-1}$, $D$, $P$.`, 'p', 'note'),
      stepper.el, stepper.listEl,
    );
    tb.panes.exp.append(
      card('Qué ver', mode.el),
      cardS, cardK,
      card('Las piezas', cP.el, nD.el),
      card('Un vector en la base de autovectores', ex.el, cX.el, nX.el),
      details('Definición formal',
        rich(R`$A$ (de $n\times n$) es <b>diagonalizable</b> si existe $P$ invertible y $D$ diagonal con $A = PDP^{-1}$. Ocurre <b>si y solo si</b> $A$ tiene $n$ autovectores linealmente independientes; entonces las columnas de $P$ son esos autovectores y $d_{ii}$ es el autovalor de la columna $i$.`),
        rich(R`Por qué funciona: $AP = PD$ dice columna por columna $A\vec v_i = \lambda_i\vec v_i$. Y $A^k = (PDP^{-1})(PDP^{-1})\cdots = PD^kP^{-1}$, porque cada $P^{-1}P$ del medio se cancela.`),
        rich(R`Condiciones prácticas: si los $n$ autovalores son <b>distintos</b>, es diagonalizable. Si alguno se repite, hace falta que su espacio propio tenga tanta dimensión como veces se repite (multiplicidad geométrica = algebraica). Si $A$ es <b>simétrica</b>, siempre es diagonalizable y $P$ puede ser ortogonal: $A = QDQ^{\mathsf T}$.`),
        rich(R`$P$ no es única: cualquier múltiplo no nulo de un autovector sirve, y el orden de las columnas solo cambia el orden de $D$. Aquí se cambia el signo de un autovector si hace falta para que $\det P > 0$ (la animación queda más limpia).`),
        rich(R`Para $A\vec x$ con $\vec x = c_1\vec v_1 + \dots + c_n\vec v_n$: $A^k\vec x = c_1\lambda_1^k\vec v_1 + \dots + c_n\lambda_n^k\vec v_n$. Con $k$ grande gana el autovalor de mayor $|\lambda|$ (el <b>dominante</b>): así funcionan las cadenas de Markov, el PageRank y el método de la potencia.`)),
      tryList([
        R`Con «General», en el paso 1 la rejilla amarilla (la de los autovectores) se endereza; en el paso 2 solo se estira por los ejes; en el 3 vuelve. Las líneas amarillas nunca giran.`,
        R`Pasa a «Potencias» con «Markov»: no importa dónde empiece $\vec x$, termina en la recta de $\vec v_1$ (el estado estable, $\lambda = 1$).`,
        R`Con «Fibonacci» y $\vec x = (1, 0)$, los puntos son pares de números de Fibonacci y su cociente tiende a $\varphi \approx 1.618$, el autovalor dominante.`,
        R`Con «Reflexión», $\lambda = -1$ hace que esa componente cambie de signo en cada paso: los puntos saltan de un lado a otro.`,
        R`Con «Cizalla» y «Rotación» no hay $P$: falta${dim === 2 ? '' : 'n'} autovectores. Las potencias se pueden calcular igual, multiplicando, pero sin el atajo.`,
      ].filter((t) => dim === 2 || !t.includes('Fibonacci'))),
    );

    function update() {
      F = diagonalize(st.A);
      const calc = st.tab === 'calc', pot = st.mode === 'pot' && !calc;
      buildProc();
      const sc = calc ? scene[st.step] ?? { eig: n, eg: true } : { eig: n, eg: true };
      if (!pot && !F.ok) st.s = 3;
      const Mt = M(), s = st.s, kk = st.k, kInt = Math.abs(kk - Math.round(kk)) < 1e-6;
      cardS.style.display = pot ? 'none' : '';
      cardK.style.display = pot ? '' : 'none';

      // --- escena ---
      grid.setMatrix(Mt);
      egrid.obj.visible = F.ok && sc.eg;
      if (F.ok) egrid.setMatrix(matMul(Mt, F.P));
      eLines.forEach((l, i) => (F.cols[i] && i < sc.eig ? l.setVisible(true).set(O, matVec(Mt, F.cols[i].v)) : l.setVisible(false)));
      eArr.forEach((a, i) => {
        const c = F.cols[i];
        if (!c || i >= sc.eig) return a.setVisible(false);
        a.setVisible(true).set(O, matVec(Mt, c.v));
        const j = i + 1;
        a.setLabel(pot ? (kInt ? (Math.round(kk) === 0 ? R`\vec v_${j}` : R`\lambda_${j}^{${Math.round(kk)}}\vec v_${j}`) : '')
          : !F.ok ? R`\vec v_${j}` : s < 0.02 ? R`\vec v_${j}` : s > 0.98 && s < 1.02 ? R`\vec e_${j}` : s > 1.98 && s < 2.02 ? R`\lambda_${j}\vec e_${j}` : s > 2.98 ? R`\lambda_${j}\vec v_${j}` : '');
      });
      const c = F.ok ? matVec(F.Pi, st.x) : null;
      let acc = O;
      comp.forEach((a, i) => {
        const vis = !pot && F.ok && !calc;
        a.setVisible(vis);
        if (!vis) return;
        const nxt = add(acc, matVec(Mt, scale(F.cols[i].v, c[i])));
        a.set(acc, nxt); acc = nxt;
      });
      xg.setVisible(!calc && (pot ? kk > 0.02 : s > 0.02 || !F.ok)).set(O, st.x);
      xa.setVisible(!calc).set(O, matVec(Mt, st.x)).setLabel(pot ? (kInt ? (Math.round(kk) === 0 ? R`\vec x` : R`A^{${Math.round(kk)}}\vec x`) : '') : (s > 2.98 || !F.ok ? R`A\vec x` : s < 0.02 ? R`\vec x` : ''));
      const pts = [];
      dots.forEach((d, j) => {
        const vis = pot && j <= Math.floor(kk + 1e-9);
        d.setVisible(vis);
        if (vis) { const p = matVec(matPow(st.A, j), st.x); d.set(p); pts.push(p); }
      });
      if (pot) pts.push(matVec(Mt, st.x));
      orbit.setVisible(pot && pts.length > 1).set(pts.length > 1 ? pts : [O, O]);
      [me, ss, sk, ex, mode].forEach((x) => x.refresh());
      ss.input.disabled = !F.ok;
      bS.forEach((b) => { b.disabled = !F.ok; });

      // --- las piezas ---
      if (F.ok) {
        const Pt = R`\begin{bmatrix}${Array.from({ length: n }, (_, i) => F.cols.map((cc, j) => clr(EC[j], fmt(cc.v[i]))).join('&')).join('\\\\')}\end{bmatrix}`;
        const Dt = R`\begin{bmatrix}${F.lams.map((l, i) => F.lams.map((_, j) => (i === j ? clr(EC[i], fmt(l)) : '0')).join('&')).join('\\\\')}\end{bmatrix}`;
        cP.set(R`\underbrace{${tm(st.A)}}_{A} = \underbrace{${Pt}}_{P}\,\underbrace{${Dt}}_{D}\,\underbrace{${tm(F.Pi)}}_{P^{-1}}`);
        const rep = F.info.find((x) => x.alg > 1);
        nD.set('pos', R`Hay ${n} autovectores independientes (las columnas de $P$, en colores): <b>es diagonalizable</b>.${rep ? R` Aunque $\lambda = ${fmt(rep.lambda)}$ se repite, tiene tantos autovectores independientes como repeticiones, y eso basta.` : ''}${dim === 2 && Math.abs(st.A[0][1] - st.A[1][0]) < 1e-9 || dim === 3 && [[0, 1], [0, 2], [1, 2]].every(([a, b]) => Math.abs(st.A[a][b] - st.A[b][a]) < 1e-9) ? R` Como $A$ es simétrica, los autovectores son perpendiculares.` : ''}`);
      } else {
        cP.set(R`A = ${tm(st.A)}`);
        const def = F.info.find((x) => x.geo < x.alg);
        nD.set('neg', R`<b>No es diagonalizable</b>${F.complex ? R` (en los reales): ${F.cols.length ? `solo ${F.cols.length === 1 ? 'hay una dirección propia' : `hay ${F.cols.length} direcciones propias`}; las otras raíces del polinomio característico no son reales` : 'ninguna raíz del polinomio característico es real, así que ninguna dirección se conserva'}.` : def ? R`: $\lambda = ${fmt(def.lambda)}$ es raíz ${def.alg === 2 ? 'doble' : 'triple'} pero solo tiene ${def.geo === 1 ? 'una recta' : 'un plano'} de autovectores.` : '.'} Hay ${F.cols.length} autovector${F.cols.length === 1 ? '' : 'es'} independiente${F.cols.length === 1 ? '' : 's'} y hacen falta ${n}: no alcanzan para formar la matriz $P$.`);
      }

      // --- fase de los pasos ---
      if (!pot) {
        const sph = dim === 2 ? 'plano' : 'espacio';
        phase.set(!F.ok ? 'neg' : s > 2.99 ? 'pos' : '', !F.ok ? R`Sin base de autovectores no hay $P$ ni $D$: la rejilla muestra $A$ directamente.`
          : s < 0.01 ? R`La rejilla amarilla está hecha con los autovectores: es la «cuadrícula natural» de $A$. Las flechas gruesas son $\vec v_1, \dots, \vec v_${n}$.`
            : s < 0.99 ? R`Paso 1, $P^{-1}$: pasar a coordenadas de autovectores. La rejilla amarilla se endereza hasta ser la cuadrícula de siempre.`
              : s < 1.01 ? R`Después de $P^{-1}$: cada $\vec v_i$ quedó sobre el eje $\vec e_i$. $\vec x$ tiene coordenadas $(${c.map((x) => fmt(x)).join(', ')})$ en esta base.`
                : s < 1.99 ? R`Paso 2, $D$: cada eje se multiplica por su $\lambda_i$${F.lams.some((l) => l < 0) ? ' (si $\\lambda_i < 0$, ese eje además se voltea)' : ''}. Nada más: sin giros ni cizallas.`
                  : s < 2.01 ? R`Después de $D$: la rejilla solo se estiró a lo largo de los ejes. Esa es toda la «acción» de $A$.`
                    : s < 2.99 ? R`Paso 3, $P$: volver a la base de siempre. Los ejes regresan a las direcciones de los autovectores.`
                      : R`Resultado: lo mismo que aplicar $A$ de una vez. La rejilla amarilla solo se estiró a lo largo de sus propias líneas; ninguna giró. Es el ${sph} visto «en la base correcta».`);
      }

      // --- potencias ---
      const k = Math.round(kk);
      if (pot) {
        const Ak = matPow(st.A, k);
        if (F.ok) {
          const Dk = R`\begin{bmatrix}${F.lams.map((l, i) => F.lams.map((_, j) => (i === j ? clr(EC[i], `${l < 0 ? `(${fmt(l)})` : fmt(l)}^{${k}}`) : '0')).join('&')).join('\\\\')}\end{bmatrix}`;
          cPow.set(R`A^{${k}} = P\,${Dk}\,P^{-1} = ${tm(Ak)}`);
        } else cPow.set(R`A^{${k}} = ${k === 0 ? 'I' : Array(Math.min(k, 4)).fill('A').join('') + (k > 4 ? R`\cdots` : '')} = ${tm(Ak)}`);
        const abs = F.cols.map((x) => Math.abs(x.lambda)).sort((a, b) => b - a);
        const top = F.cols.filter((x) => Math.abs(Math.abs(x.lambda) - abs[0]) < 1e-6);
        const mixed = top.some((x) => Math.abs(x.lambda - top[0].lambda) > 1e-6), tied = mixed || top.length === n;
        if (!F.ok) phaseK.set('zero', F.complex ? R`Sin autovalores reales suficientes, $\vec x$ ${dim === 2 ? 'gira' : 'gira alrededor del eje propio'} en vez de alinearse con alguna dirección.` : R`No es diagonalizable: no hay atajo con $D^k$, hay que multiplicar $A$ una y otra vez. Aun así, con $k$ grande $\vec x$ suele acercarse a una dirección propia.`);
        else if (tied) phaseK.set('', R`Ningún autovalor domina en valor absoluto${mixed ? R` ($\lambda = ${fmt(Math.abs(top[0].lambda))}$ y $\lambda = ${fmt(-Math.abs(top[0].lambda))}$ empatan)` : ''}: $A^k\vec x$ no se alinea con una sola dirección.`);
        else {
          const l1 = top[0].lambda, where = top.length > 1 ? 'su plano de autovectores' : 'su autovector';
          const fate = Math.abs(abs[0] - 1) < 1e-6 ? R`y como $|\lambda| = 1$, no crece ni se apaga: <b>se estabiliza</b>${l1 > 0 ? '' : ' (alternando de signo)'}`
            : abs[0] > 1 ? R`y como $|\lambda| > 1$, <b>crece</b> sin límite` : R`y como $|\lambda| < 1$, todo <b>se apaga</b> hacia $\vec 0$`;
          phaseK.set('pos', R`El autovalor dominante es $\lambda = ${fmt(l1)}$: con $k$ grande, $A^k\vec x$ se alinea con ${where} ${fate}.`);
        }
      }

      // --- vector x ---
      if (F.ok) {
        const terms = (kexp) => F.cols.map((cc, i) => clr(EC[i], R`${fmt(c[i])}${kexp == null ? '' : R`\cdot ${cc.lambda < 0 ? `(${fmt(cc.lambda)})` : fmt(cc.lambda)}^{${kexp}}`}\,\vec v_${i + 1}`)).join(' + ').replace(/\+ \\textcolor\{([^}]*)\}\{-/g, '- \\textcolor{$1}{');
        const kk2 = pot ? k : 1;
        cX.set(R`\begin{gathered}\vec x = ${tv(st.x)} = ${terms(null)} \\[4pt] A^{${kk2}}\vec x = ${terms(kk2)} = ${tv(matVec(matPow(st.A, kk2), st.x))}\end{gathered}`);
        const zeroC = c.findIndex((x) => Math.abs(x) < 1e-9);
        nX.set('', zeroC >= 0 ? R`$c_${zeroC + 1} = 0$: $\vec x$ no tiene componente sobre $\vec v_${zeroC + 1}$, y nunca la tendrá. Si $\vec x$ es un autovector, $A^k\vec x$ se queda en su recta.`
          : R`Los coeficientes $c_i$ son las coordenadas de $\vec x$ en la base de autovectores: $\vec c = P^{-1}\vec x$. Aplicar $A^k$ solo multiplica cada uno por $\lambda_i^k$.`);
      } else {
        cX.set(R`A${pot ? `^{${k}}` : ''}\vec x = ${tv(matVec(matPow(st.A, pot ? k : 1), st.x))}`);
        nX.set('', R`Sin base de autovectores, $\vec x$ no se puede partir en piezas que $A$ solo estire.`);
      }
    }

    update();
    return { destroy: () => stop() };
  },
};
