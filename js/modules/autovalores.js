import { Arrow, Lattice, Polyline, C } from '../core/stage.js';
import { identity, lerpMat, matVec, eigen, polyTex, scale, dot, norm, cross, normalize, det, solveSystem, fmt, pf, tv, tm, clr, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate, tabs, Stepper } from '../core/ui.js';
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
  2: { A: PRESETS[2][0][1], v: [2, 0.5], t: 1, tab: 'exp', step: 0, lam: 0 },
  3: { A: PRESETS[3][1][1], v: [1, 0, 1], t: 1, tab: 'exp', step: 0, lam: 0 },
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
    stage.addHandle({ color: C.x, visible: () => s.tab === 'exp', get: () => s.v, set: (p) => { stop(); s.v = p; update(); } });

    // --- panel ---
    const me = matEditor({ dim, colors: basisColors(n), get: () => s.A, set: (A) => { stop(); s.A = A; s.t = 1; update(); } });
    const presets = h('div', { class: 'presets' }, PRESETS[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { s.A = A.map((r) => [...r]); play(); update(); } }, name)));
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

    // --- procedimiento ---
    // escena de cada paso: g = 'A' (rejilla de A), 'lam' (A − λI con el λ del deslizador), 'B' (A − λ_i I)
    let scene = [], anim = { from: I, a: 1 }, stopAnim = () => {}, curE = eigen(s.A);
    const sub = (lam) => s.A.map((r, i) => r.map((x, j) => x - (i === j ? lam : 0)));
    const viewFor = (k) => {
      const sc = scene[k] ?? { g: 'A' };
      return sc.g === 'lam' ? sub(s.lam) : sc.g === 'B' ? curE.values[sc.i].B : s.A;
    };
    const stepper = new Stepper((i) => {
      const from = lerpMat(anim.from, viewFor(s.step), anim.a);
      s.step = i; stopAnim();
      anim = { from, a: 0 };
      stopAnim = animate(0, 1, 700, (a) => { anim.a = a; update(); });
    });
    /** Divide el polinomio mónico p entre (λ − r) mientras r sea raíz: { mult, rest }. */
    const deflate = (p, r) => {
      let mult = 0;
      for (;;) {
        if (p.length < 2) break;
        const q = [p[0]];
        for (let k = 1; k < p.length; k++) q.push(p[k] + r * q[k - 1]);
        const rem = q.pop();
        if (Math.abs(rem) > 1e-6 * (1 + Math.abs(r) ** p.length)) break;
        p = q; mult++;
      }
      return { mult, rest: p };
    };
    const ent = (x, d) => (d ? (Math.abs(x) < 1e-12 ? R`-\lambda` : R`${fmt(x)} - \lambda`) : fmt(x));
    const par = (x, d) => (d ? `(${ent(x, true)})` : pf(x));
    function buildProc() {
      const A = s.A, E = (curE = eigen(A)), lams = E.values.map((v) => v.lambda);
      const steps = [];
      scene = [];
      const add1 = (st, sc) => { steps.push(st); scene.push(sc); };
      add1({
        title: 'La idea: buscar qué aplasta A − λI',
        tex: [R`A\vec v = \lambda\vec v \iff A\vec v - \lambda I\vec v = \vec 0`, R`\iff (A - \lambda I)\,\vec v = \vec 0,\quad \vec v \neq \vec 0`],
        why: R`un autovector es un $\vec v\neq\vec 0$ que $A - \lambda I$ manda al origen. Una matriz solo manda al origen un vector no nulo si <b>aplasta</b> el espacio, y eso pasa exactamente cuando su determinante es 0. Así que primero se buscan los $\lambda$ con $\det(A - \lambda I) = 0$, y después los vectores.`,
      }, { g: 'A' });
      const Lm = R`\begin{bmatrix}${A.map((r, i) => r.map((x, j) => ent(x, i === j)).join('&')).join('\\\\')}\end{bmatrix}`;
      add1({
        title: 'Restar λ en la diagonal',
        tex: R`A - \lambda I = ${Lm}`,
        why: R`$\lambda I$ solo tiene $\lambda$ en la diagonal, así que se resta ahí. Mueve el deslizador: la rejilla es $A - \lambda I$ para ese $\lambda$. Casi siempre es una rejilla normal (no aplasta nada); solo para ciertos valores se aplana ${n === 2 ? 'en una recta' : 'en un plano o una recta'}.`,
      }, { g: 'lam' });
      const pA = n === 2 ? E.poly : E.poly.map((c) => -c);
      const a = A;
      const expand = n === 2
        ? [R`\det(A - \lambda I) = ${par(a[0][0], 1)}${par(a[1][1], 1)} - ${pf(a[0][1])}\cdot${pf(a[1][0])}`]
        : [R`\det(A - \lambda I) =`,
          R`\begin{aligned}&${par(a[0][0], 1)}\big[${par(a[1][1], 1)}${par(a[2][2], 1)} - ${pf(a[1][2])}\cdot${pf(a[2][1])}\big]\\ &- ${pf(a[0][1])}\big[${pf(a[1][0])}${par(a[2][2], 1)} - ${pf(a[1][2])}\cdot${pf(a[2][0])}\big]\\ &+ ${pf(a[0][2])}\big[${pf(a[1][0])}\cdot${pf(a[2][1])} - ${par(a[1][1], 1)}${pf(a[2][0])}\big]\end{aligned}`];
      add1({
        title: 'Calcular el determinante: un polinomio en λ',
        tex: [...expand, R`= ${clr(C.w, polyTex(pA))}`],
        why: R`es el determinante de siempre${n === 3 ? ' (desarrollado por la primera fila)' : ' ($ad - bc$)'}, pero con $\lambda$ dentro: el resultado es un polinomio de grado ${n}, el <b>polinomio característico</b>. Para cada $\lambda$ da el factor por el que $A - \lambda I$ cambia áreas${n === 3 ? ' (volúmenes)' : ''}: mira el valor junto al deslizador.`,
      }, { g: 'lam' });
      // raíces y factorización
      let rest = [...E.poly];
      const fac = [];
      let mtot = 0;
      lams.forEach((r) => { const d = deflate(rest, r); rest = d.rest; mtot += Math.max(d.mult, 1); fac.push([r, Math.max(d.mult, 1)]); });
      const lin = (r) => (Math.abs(r) < 1e-12 ? R`\lambda` : R`(\lambda ${r > 0 ? '-' : '+'} ${fmt(Math.abs(r))})`);
      const facTex = fac.map(([r, m], i) => clr(EC[i], lin(r) + (m > 1 ? `^${m}` : ''))).join('') + (rest.length === 3 ? R`\,(${polyTex(rest)})` : '');
      const sign = n === 3 ? '-' : '';
      const rootsList = lams.length ? lams.map((r, i) => R`\lambda_${i + 1} = ${clr(EC[i], fmt(r))}`).join(R`,\ `) : R`\text{ninguna real}`;
      if (n === 2) {
        const disc = E.tr * E.tr - 4 * E.poly[2];
        add1({
          title: 'Igualar a 0 y resolver',
          tex: [R`${polyTex(pA)} = 0`, R`\lambda = \frac{${fmt(E.tr)} \pm\sqrt{${fmt(disc)}}}{2}`, disc < -1e-10 ? R`\Delta = ${fmt(disc)} < 0` : R`${facTex} = 0\ \Rightarrow\ ${rootsList}`],
          why: disc < -1e-10
            ? R`la fórmula de la cuadrática pide la raíz de un número negativo: <b>no hay raíces reales</b>. Por mucho que muevas el deslizador, la rejilla nunca se aplana: ningún $\lambda$ real hace que $A - \lambda I$ aplaste algo, así que ninguna dirección se conserva.`
            : R`es una ecuación de segundo grado. Sus raíces son los únicos $\lambda$ que hacen que $A - \lambda I$ aplaste el plano: el deslizador se engancha en ellas y la rejilla se vuelve una recta.${fac.some(([, m]) => m > 1) ? R` Aquí la raíz es <b>doble</b>.` : ''}`,
        }, { g: 'lam' });
      } else {
        const d0 = E.poly[3];
        const intRoots = lams.filter((r) => Math.abs(r - Math.round(r)) < 1e-9 && Math.round(r) !== 0);
        add1({
          title: 'Igualar a 0 y resolver',
          tex: [R`${sign}(${polyTex(E.poly)}) = 0`, R`${facTex} = 0`, rootsList],
          why: (intRoots.length && Math.abs(d0 - Math.round(d0)) < 1e-9
            ? R`para un polinomio de grado 3 con coeficientes enteros se prueban los divisores del término independiente (${fmt(Math.abs(d0))}): por ejemplo $p(${fmt(intRoots[0])}) = 0$. Cada raíz encontrada permite dividir entre $(\lambda - r)$ y queda un polinomio más pequeño. `
            : R`las raíces de un polinomio de grado 3 se pueden hallar con la fórmula de Cardano o numéricamente. `)
            + (rest.length === 3 ? R`El factor de grado 2 que queda no tiene raíces reales. ` : '')
            + (fac.some(([, m]) => m > 1) ? R`Una raíz repetida aparece con exponente: es <b>múltiple</b>. ` : '')
            + R`Con el deslizador en una raíz, la rejilla de $A - \lambda I$ se aplana.`,
        }, { g: 'lam' });
      }
      // autovectores de cada λ
      E.values.forEach(({ lambda, B, vectors }, i) => {
        const S = solveSystem(B, Array(n).fill(0));
        const rref = S.M.map((r) => r.slice(0, n));
        const sol = vectors.length === n ? R`\text{todo } \mathbb{R}^${n}`
          : vectors.length === 1 ? R`t\,${clr(EC[i], tv(vectors[0]))}` : vectors.map((v, k) => `${['s', 't'][k]}\\,${clr(EC[i], tv(v))}`).join(' + ');
        add1({
          title: `Autovectores de λ = ${fmt(lambda)}`,
          tex: [R`A - ${fmt(lambda)}I = ${tm(B)}`, R`\to ${tm(rref)}`, R`\vec v = ${sol}`],
          why: R`con $\lambda = ${fmt(lambda)}$ la matriz $A - \lambda I$ tiene determinante 0: aplasta el espacio (la rejilla en la escena). Lo que manda al origen es su <b>núcleo</b>, y se halla escalonando como en «Rango y núcleo». ${vectors.length === 1 ? 'Sale una variable libre: una <b>recta</b> de autovectores (en color), la que se aplasta hasta el origen.' : vectors.length === 2 ? 'Salen dos variables libres: todo un <b>plano</b> de autovectores.' : 'Todas las variables son libres: todo vector es autovector.'}${fac[i][1] > vectors.length ? R` Ojo: $\lambda$ es raíz ${fac[i][1] === 2 ? 'doble' : 'triple'} pero solo da ${vectors.length} dirección: faltan autovectores.` : ''}`,
        }, { g: 'B', i, eig: [i] });
      });
      if (lams.length) {
        add1({
          title: 'Comprobar: A v = λ v',
          tex: E.values.flatMap(({ lambda, vectors }, i) => vectors.slice(0, 1).map((v) => R`A${clr(EC[i], tv(v))} = ${tv(matVec(A, v))} = ${fmt(lambda)}${clr(EC[i], tv(v))}`)),
          why: R`aplicando la $A$ <b>original</b>, cada autovector sale en su misma recta, multiplicado por su $\lambda$. En la escena, la rejilla es otra vez la de $A$ y las flechas no se salen de sus rectas.`,
        }, { g: 'A', eig: lams.map((_, i) => i) });
      }
      if (mtot === n && lams.length) {
        const all = fac.flatMap(([r, m]) => Array(m).fill(r));
        add1({
          title: 'Dos comprobaciones rápidas',
          tex: [R`${all.map(pf).join(' + ')} = ${fmt(all.reduce((x, y) => x + y, 0))} = \text{tr}A`, R`${all.map(pf).join('\\cdot ')} = ${fmt(all.reduce((x, y) => x * y, 1))} = \det A`],
          why: R`contando repeticiones, la suma de los autovalores es la traza (la suma de la diagonal) y su producto es el determinante. Tiene sentido: el determinante es cuánto cambia el volumen, y en las direcciones propias $A$ solo multiplica por cada $\lambda$.`,
        }, { g: 'A', eig: lams.map((_, i) => i) });
      }
      stepper.set(steps, s.step);
      s.step = stepper.i;
    }
    const lamS = slider({
      label: R`\lambda`, min: -4, max: 4, step: 0.05, get: () => s.lam,
      set: (l) => { const r = curE.values.map((v) => v.lambda).find((x) => Math.abs(x - l) < 0.12); s.lam = r ?? l; update(); },
    });
    const lamBox = new TexBox(), lamNote = new Note();
    const lamCard = card('Prueba valores de λ', lamS.el, lamBox.el, lamNote.el);
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => s.tab, (k) => {
      stop(); stopAnim(); s.tab = k; s.t = 1; anim = { from: I, a: 1 }; tb.refresh(); update();
    });

    panel.append(
      ...intro('Autovalores y autovectores',
        R`Al aplicar una matriz, casi todos los vectores cambian de dirección. Los <b>autovectores</b> son los especiales: se quedan en su misma recta y solo se estiran, se encogen o se invierten. El factor por el que se multiplican es su <b>autovalor</b> $\lambda$: $A\vec v = \lambda\vec v$.`),
      card('Matriz A', me.el, presets),
      tb.el, tb.panes.exp, tb.panes.calc,
    );
    tb.panes.calc.append(
      rich(R`Método: primero los autovalores (cuándo $A - \lambda I$ aplasta el espacio) y después los autovectores (qué aplasta). La escena sigue cada paso.`, 'p', 'note'),
      stepper.el, lamCard, stepper.listEl,
    );
    tb.panes.exp.append(
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
      const calc = s.tab === 'calc';
      buildProc();
      const sc = scene[s.step] ?? { g: 'A' };
      const Mt = calc ? lerpMat(anim.from, viewFor(s.step), anim.a) : M();
      const E = curE;
      grid.setMatrix(Mt);
      lamCard.style.display = calc && sc.g === 'lam' ? '' : 'none';
      lamS.refresh();
      const dl = det(sub(s.lam)), hit = Math.abs(dl) < 1e-9;
      lamBox.set(R`\det(A - ${fmt(s.lam)}I) = ${hit ? clr(C.x, '0') : fmt(dl)}`);
      lamNote.set(hit ? 'pos' : '', hit
        ? R`<b>Se aplana:</b> $\lambda = ${fmt(s.lam)}$ es un autovalor.`
        : R`La rejilla no se aplana: $A - ${fmt(s.lam)}I$ no aplasta ningún vector, así que ${fmt(s.lam)} no es autovalor.`);

      // espacios propios
      eLines.forEach((l) => l.setVisible(false));
      ePlanes.forEach((p) => p.setVisible(false));
      eArrows.forEach((a) => a.setVisible(false));
      E.values.forEach(({ vectors }, i) => {
        if (calc && !(sc.eig ?? []).includes(i)) return;
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
      vg.setVisible(!calc).set(O, s.v);
      Av.setVisible(!calc).set(O, matVec(Mt, s.v));
      if (circle && calc) { circle.setVisible(false); ellipse.setVisible(false); } else if (circle) {
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
    return { destroy: () => { stop(); stopAnim(); } };
  },
};
