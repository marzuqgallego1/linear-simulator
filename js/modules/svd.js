import { Arrow, Lattice, Polyline, C } from '../core/stage.js';
import { identity, lerpMat, matMul, matVec, transpose, svd, rotPow, orthoPath, det, eigen, polyTex, fmt, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate, tabs, Stepper } from '../core/ui.js';
import { basisColors } from '../core/presets.js';

const SC = [C.u, C.v, '#20c997']; // direcciones singulares 1, 2, 3
const PRE = {
  2: [
    ['Cizalla', [[1, 1], [0, 1]]],
    ['General', [[2, 1], [-1, 1.5]]],
    ['Simétrica', [[2, 1], [1, 2]]],
    ['Con reflexión', [[1, 2], [2, 1]]],
    ['Rango 1', [[1, 2], [0.5, 1]]],
    ['Rotación', [[0, -1], [1, 0]]],
  ],
  3: [
    ['Cizalla', [[1, 1, 0], [0, 1, 0], [0, 0, 1]]],
    ['General', [[2, 1, 0], [0, 1, 1], [1, 0, 1.5]]],
    ['Simétrica', [[2, 1, 0], [1, 2, 1], [0, 1, 2]]],
    ['Rango 2', [[1, 0, 1], [0, 1, 1], [1, 1, 2]]],
    ['Rotación (z)', [[0, -1, 0], [1, 0, 0], [0, 0, 1]]],
  ],
};

const state = {
  2: { A: PRE[2][0][1], s: 3, tab: 'exp', step: 0 },
  3: { A: PRE[3][1][1], s: 3, tab: 'exp', step: 0 },
};

const circle = (f, N = 72) => Array.from({ length: N + 1 }, (_, k) => f((2 * Math.PI * k) / N));

export default {
  id: 'svd',
  title: 'Descomposición SVD',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const st = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    let D = svd(st.A);
    const Sig = () => I.map((r, i) => r.map((x, j) => (i === j ? D.sigma[i] : 0)));
    const Vt = () => transpose(D.V);
    // s ∈ [0,1]: Vᵀ (giro)   [1,2]: Σ (estirar por ejes)   [2,3]: U (giro / reflexión)
    const M = () => {
      const s = st.s;
      if (s <= 1) return rotPow(Vt(), s);
      if (s <= 2) return matMul(lerpMat(I, Sig(), s - 1), Vt());
      return matMul(orthoPath(D.U, s - 2), matMul(Sig(), Vt()));
    };
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.3 : 0.18 });
    const curves = dim === 2
      ? [circle((a) => [Math.cos(a), Math.sin(a)])]
      : [circle((a) => [Math.cos(a), Math.sin(a), 0]), circle((a) => [Math.cos(a), 0, Math.sin(a)]), circle((a) => [0, Math.cos(a), Math.sin(a)]),
        circle((a) => [0.7 * Math.cos(a), 0.7 * Math.sin(a), 0.71]), circle((a) => [0.7 * Math.cos(a), 0.7 * Math.sin(a), -0.71])];
    const lines = curves.map((_, i) => new Polyline(stage, '#ffffff', { opacity: i < 3 ? 0.85 : 0.4 }));
    const ghost = SC.slice(0, n).map((c, i) => new Arrow(stage, c, { opacity: 0.25, radius: 0.02, label: R`\vec v_${i + 1}` }));
    const arr = SC.slice(0, n).map((c) => new Arrow(stage, c, { radius: 0.05, label: ' ' }));

    // --- panel ---
    const run = (a, b) => { stop(); st.s = a; update(); stop = animate(a, b, 1300 * (b - a), (v) => { st.s = v; update(); }); };
    const me = matEditor({ dim, colors: basisColors(n), get: () => st.A, set: (A) => { stop(); st.A = A; st.s = 3; update(); } });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); if (st.tab === 'calc') { stop(); update(); goScene(); } else run(0, 3); } }, name)));
    const ss = slider({ label: 's', min: 0, max: 3, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const phase = new Note();
    const cA = new TexBox(), cS = new TexBox(), nS = new Note(), cE = new TexBox();

    // --- procedimiento: AᵀA → λ → V → σ → U ---
    // escena de cada paso: momento s de la animación (0: inicio, 1: tras Vᵀ, 2: tras Σ, 3: A) o 'play'
    let scene = [];
    const Sm = () => I.map((r, i) => r.map((x, j) => (i === j ? D.sigma[i] : 0)));
    const goS = (b) => { stop(); const a = st.s; if (Math.abs(b - a) < 1e-6) return update(); stop = animate(a, b, 450 * Math.abs(b - a) + 300, (v) => { st.s = v; update(); }); };
    const goScene = () => { const sc = scene[st.step] ?? 3; if (sc === 'play') run(0, 3); else goS(sc); };
    const stepper = new Stepper((i) => { st.step = i; goScene(); });
    function buildProc() {
      const A = st.A, AtA = matMul(transpose(A), A), E = eigen(AtA), steps = [];
      scene = [];
      const add1 = (step, sc) => { steps.push(step); scene.push(sc); };
      add1({
        title: 'La idea: mirar AᵀA',
        tex: [R`(A\vec v_i)\cdot(A\vec v_j) = \vec v_i^{\mathsf T}(A^{\mathsf T}A)\,\vec v_j`, R`A^{\mathsf T}A = ${tm(AtA)}`],
        why: R`se buscan direcciones $\vec v_i$ perpendiculares que <b>sigan perpendiculares</b> después de aplicar $A$ (en la escena, ${dim === 2 ? 'el círculo' : 'la esfera'} y sus flechas). Los productos punto después de $A$ los calcula la matriz $A^{\mathsf T}A$, que es <b>simétrica</b>. Y una matriz simétrica siempre tiene autovectores perpendiculares: esos son los $\vec v_i$.`,
      }, 0);
      const lams = D.sigma.map((x) => x * x);
      add1({
        title: 'Autovalores de AᵀA',
        tex: [R`\det(\lambda I - A^{\mathsf T}A) =`, R`${polyTex(E.poly)} = 0`, lams.map((l, i) => clr(SC[i], R`\lambda_${i + 1} = ${fmt(l)}`)).join(R`,\ `)],
        why: R`se calculan como en «Autovalores». Al ser $A^{\mathsf T}A$ simétrica, todas las raíces son reales, y además ninguna es negativa: $\lambda_i = \vec v_i^{\mathsf T}A^{\mathsf T}A\,\vec v_i = \|A\vec v_i\|^2 \ge 0$. Se ordenan de mayor a menor.`,
      }, 0);
      add1({
        title: 'Autovectores unitarios: V',
        tex: [...D.vs.map((v, i) => clr(SC[i], R`\vec v_${i + 1} = ${tv(v)}`)), R`V = ${tm(D.V)}`],
        why: R`para cada $\lambda_i$ se resuelve $(A^{\mathsf T}A - \lambda_iI)\vec v = \vec 0$ y se divide entre su largo para que mida 1. Son perpendiculares entre sí, así que $V$ es ortogonal: $V^{\mathsf T}$ es un <b>giro</b> que lleva cada $\vec v_i$ a un eje (paso 1 en la escena).`,
      }, 1);
      add1({
        title: 'Valores singulares: σ = √λ',
        tex: [...D.sigma.map((x, i) => clr(SC[i], R`\sigma_${i + 1} = \sqrt{${fmt(lams[i])}} = ${fmt(x)}`)), R`\Sigma = ${tm(Sm())}`],
        why: R`como $\lambda_i = \|A\vec v_i\|^2$, la raíz $\sigma_i = \|A\vec v_i\|$ es <b>cuánto estira $A$</b> la dirección $\vec v_i$. $\Sigma$ estira cada eje por su $\sigma_i$ (paso 2): ${dim === 2 ? 'el círculo se vuelve una elipse' : 'la esfera se vuelve un elipsoide'} alineado con los ejes, de semiejes $\sigma_i$.${D.rank < n ? R` Un $\sigma = 0$ aplasta ese eje.` : ''}`,
      }, 2);
      add1({
        title: 'Las direcciones de salida: U',
        tex: [...D.us.flatMap((u, i) => (i < D.rank
          ? [R`\vec u_${i + 1} = \frac{A\vec v_${i + 1}}{\sigma_${i + 1}} = \frac{1}{${fmt(D.sigma[i])}}${tv(matVec(A, D.vs[i]))} = ${clr(SC[i], tv(u))}`]
          : [R`\vec u_${i + 1} = ${clr(SC[i], tv(u))}\ (\perp)`])), R`U = ${tm(D.U)}`],
        why: R`$A\vec v_i$ apunta a donde fue a parar la dirección $\vec v_i$ y mide $\sigma_i$; al dividir se obtiene la dirección unitaria $\vec u_i$. Como los $A\vec v_i$ son perpendiculares, $U$ también es ortogonal: otro giro (paso 3).${D.rank < n ? R` Si $\sigma_i = 0$ no se puede dividir: ese $\vec u_i$ se elige perpendicular a los demás (cualquiera sirve, porque se multiplica por 0).` : ''}`,
      }, 3);
      add1({
        title: 'Comprobar: UΣVᵀ = A',
        tex: [R`A\vec v_i = \sigma_i\vec u_i \iff AV = U\Sigma`, R`U\Sigma V^{\mathsf T} = ${tm(matMul(D.U, matMul(Sm(), transpose(D.V))))}`],
        why: R`las ecuaciones $A\vec v_i = \sigma_i\vec u_i$, puestas en columnas, son $AV = U\Sigma$; multiplicando por $V^{\mathsf T}$ a la derecha (como $VV^{\mathsf T} = I$) sale $A = U\Sigma V^{\mathsf T}$. La escena reproduce los tres pasos: girar, estirar, girar.`,
      }, 'play');
      stepper.set(steps, st.step);
      st.step = stepper.i;
    }
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => st.tab, (k) => {
      stop(); st.tab = k; tb.refresh(); update();
      if (k === 'calc') goScene();
    });

    panel.append(
      ...intro('Descomposición en valores singulares (SVD)',
        R`<b>Toda</b> matriz, sea cual sea, hace lo mismo en tres pasos: <b>girar, estirar por los ejes, girar</b>. Eso es $A = U\Sigma V^{\mathsf T}$. Por eso ${dim === 2 ? 'un círculo siempre se convierte en una elipse' : 'una esfera siempre se convierte en un elipsoide'}: los <b>valores singulares</b> $\sigma_i$ son las longitudes de sus semiejes.`),
      card('Matriz A', me.el, pre),
      tb.el, tb.panes.exp, tb.panes.calc,
    );
    tb.panes.calc.append(
      rich(R`Método: todo sale de la matriz simétrica $A^{\mathsf T}A$. Sus autovectores dan $V$, sus autovalores dan los $\sigma$, y con ellos se calcula $U$.`, 'p', 'note'),
      stepper.el, stepper.listEl,
    );
    tb.panes.exp.append(
      card('Los tres pasos', ss.el,
        buttonRow(button('1 · Vᵀ', () => run(0, 1)), button('2 · Σ', () => run(1, 2)), button('3 · U', () => run(2, 3)), button('▶ Todo', () => run(0, 3), 'primary')),
        phase.el),
      card('Las piezas', cA.el, cS.el, nS.el),
      card('Lo que dicen los σ', cE.el),
      details('Definición formal',
        rich(R`$A = U\Sigma V^{\mathsf T}$ con $U$ y $V$ ortogonales ($U^{\mathsf T}U = V^{\mathsf T}V = I$) y $\Sigma$ diagonal con $\sigma_1 \ge \sigma_2 \ge \dots \ge 0$.`),
        rich(R`Cómo se calcula: $A^{\mathsf T}A$ es simétrica; sus autovectores son las columnas de $V$ (direcciones de entrada) y sus autovalores son $\sigma_i^2$. Luego $\vec u_i = A\vec v_i/\sigma_i$. Es decir, $A\vec v_i = \sigma_i\vec u_i$: <b>direcciones perpendiculares que siguen perpendiculares</b> tras aplicar $A$.`),
        rich(R`Diferencia con los autovalores: un autovector no cambia de dirección ($A\vec v = \lambda\vec v$), pero no siempre existen (las rotaciones no tienen reales). La SVD existe <b>siempre</b>, para cualquier matriz, a cambio de usar dos bases distintas.`),
        rich(R`Usos: compresión de imágenes (quedarse con los $\sigma$ grandes), análisis de componentes principales (PCA), mínimos cuadrados con la pseudoinversa y medir qué tan cerca está una matriz de ser singular.`)),
      tryList([
        R`Con «Cizalla», mira el paso 1: las dos flechas perpendiculares $\vec v_i$ giran hasta los ejes. Tras $\Sigma$ y $U$ siguen perpendiculares: son los semiejes de la elipse.`,
        R`Con «Simétrica», $U = V$ y los $\sigma$ son los autovalores: girar, estirar y deshacer el giro.`,
        R`Con «Rotación», todos los $\sigma$ valen 1: no hay estiramiento, ${dim === 2 ? 'el círculo' : 'la esfera'} no se deforma.`,
        R`Con «Rango ${dim === 2 ? 1 : 2}», un $\sigma$ vale 0: ese eje se aplasta y ${dim === 2 ? 'la elipse se vuelve un segmento' : 'el elipsoide se vuelve una elipse plana'}.`,
      ]),
    );

    function update() {
      D = svd(st.A);
      buildProc();
      const Mt = M(), s = st.s;
      grid.setMatrix(Mt);
      lines.forEach((l, i) => l.set(curves[i].map((p) => matVec(Mt, p))));
      ghost.forEach((a, i) => a.setVisible(s > 0.02).set(O, D.vs[i]));
      arr.forEach((a, i) => {
        a.set(O, matVec(Mt, D.vs[i]));
        const lab = s < 0.02 ? R`\vec v_${i + 1}` : s > 0.98 && s < 1.02 ? R`\vec e_${i + 1}` : s > 1.98 && s < 2.02 ? R`\sigma_${i + 1}\vec e_${i + 1}` : s > 2.98 ? R`\sigma_${i + 1}\vec u_${i + 1}` : '';
        a.setLabel(lab);
      });
      [me, ss].forEach((c) => c.refresh());

      phase.set(s > 2.99 ? 'pos' : '', s < 0.01 ? R`Las flechas de colores son $\vec v_1, \dots, \vec v_${n}$: direcciones perpendiculares elegidas para que sigan perpendiculares después de $A$.`
        : s < 0.99 ? R`Paso 1, $V^{\mathsf T}$: un giro rígido que lleva cada $\vec v_i$ a un eje.`
          : s < 1.01 ? R`Después de $V^{\mathsf T}$: los $\vec v_i$ quedaron sobre los ejes. ${dim === 2 ? 'El círculo' : 'La esfera'} no ha cambiado.`
            : s < 1.99 ? R`Paso 2, $\Sigma$: cada eje se estira por su $\sigma_i$. Sin giros ni cizallas.`
              : s < 2.01 ? R`Después de $\Sigma$: ${dim === 2 ? 'una elipse' : 'un elipsoide'} alineado con los ejes, de semiejes $\sigma_i$.`
                : s < 2.99 ? R`Paso 3, $U$: otro giro${det(D.U) < 0 ? ' (con una reflexión al final, porque $\\det A < 0$)' : ''} que coloca los semiejes en su sitio.`
                  : R`Resultado: la misma rejilla que $A$. Cada $\vec v_i$ terminó en $\sigma_i\vec u_i$.`);

      cA.set(R`${tm(st.A)} = \underbrace{${tm(D.U)}}_{U}\,\underbrace{${tm(Sig())}}_{\Sigma}\,\underbrace{${tm(Vt())}}_{V^{\mathsf T}}`);
      cS.set(D.sigma.map((x, i) => clr(SC[i], R`\sigma_${i + 1} = ${fmt(x)}`)).join(',\\quad '));
      const zero = n - D.rank;
      nS.set(zero ? 'neg' : '', zero
        ? R`${zero === 1 ? 'Un valor singular es' : `${zero} valores singulares son`} 0: esa dirección se aplasta por completo. El rango es ${D.rank}.`
        : R`Ningún $\sigma$ es 0: $A$ es invertible y no aplasta ninguna dirección.`);
      const prod = D.sigma.reduce((p, x) => p * x, 1);
      const cond = D.sigma[n - 1] > 1e-9 ? fmt(D.sigma[0] / D.sigma[n - 1]) : R`\infty`;
      cE.set(R`\begin{gathered}${[
        R`\text{rango} = \#\{\sigma_i > 0\} = ${D.rank}`,
        R`|\det A| = ${D.sigma.map((x) => fmt(x)).join('\\cdot')} = ${fmt(prod)}`,
        R`\text{máximo estiramiento} = \sigma_1 = ${fmt(D.sigma[0])},\ \text{mínimo} = \sigma_${n} = ${fmt(D.sigma[n - 1])}`,
        R`\text{número de condición } \sigma_1/\sigma_${n} = ${cond}`,
      ].join('\\\\[4pt]')}\end{gathered}`);
    }

    update();
    return { destroy: () => stop() };
  },
};
