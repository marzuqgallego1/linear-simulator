import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, col, matMul, transpose, qrDecomp, orthoPath, det, add, sub, scale, dot, norm, fmt, pf, tv, tm, clr } from '../core/math.js';
import { R, h, intro, card, details, tryList, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate, tabs, Stepper } from '../core/ui.js';
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
  2: { A: PRE[2][0][1], s: 2, tab: 'exp', step: 0 },
  3: { A: PRE[3][0][1], s: 2, tab: 'exp', step: 0 },
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
    // procedimiento: sombras de a_j sobre los q ya hechos, el resto w_j y los q terminados
    const shadows = [0, 1].map(() => new Arrow(stage, C.neutral, { radius: 0.03, opacity: 0.8 }));
    const wArr = new Arrow(stage, C.x, { radius: 0.045 });
    const qArr = AC.slice(0, n).map((c, j) => new Arrow(stage, c, { radius: 0.06, label: R`\vec q_${j + 1}` }));
    AC.slice(0, n).forEach((c, j) => stage.addHandle({
      color: c, get: () => col(st.A, j),
      set: (p) => { stop(); st.A = st.A.map((r, i) => r.map((x, k) => (k === j ? p[i] : x))); st.s = st.tab === 'calc' ? 0 : 2; update(); },
    }));

    // --- panel ---
    const run = (a, b) => { stop(); st.s = a; update(); stop = animate(a, b, 1300 * (b - a), (v) => { st.s = v; update(); }); };
    const me = matEditor({ dim, colors: AC.slice(0, n), get: () => st.A, set: (A) => { stop(); st.A = A; st.s = st.tab === 'calc' ? 0 : 2; update(); } });
    const pre = h('div', { class: 'presets' }, PRE[dim].map(([name, A]) =>
      h('button', { class: 'chip', onclick: () => { st.A = A.map((r) => [...r]); if (st.tab === 'calc') { stop(); st.s = 0; update(); } else run(0, 2); } }, name)));
    const ss = slider({ label: 's', min: 0, max: 2, step: 0.01, get: () => st.s, set: (v) => { stop(); st.s = v; update(); } });
    const phase = new Note();
    const cQR = new TexBox(), cR = new TexBox(), cChk = new TexBox(), nQR = new Note(), cUse = new TexBox();

    // --- procedimiento: Gram-Schmidt con números ---
    // escena de cada paso: { j, phase: 'proj'|'norm'|'fail'|'end', done: cuántos q se muestran }
    let scene = [];
    const stepper = new Stepper((i) => {
      st.step = i; stop();
      if (scene[i]?.phase === 'end') run(0, 2); else { st.s = 0; update(); }
    });
    function buildProc() {
      const A = st.A, a = transpose(A), qs = [], steps = [];
      scene = [];
      const R0 = A.map(() => Array(n).fill(0));
      for (let j = 0; j < n; j++) {
        const aj = a[j], J = j + 1;
        let w = aj;
        if (j > 0) {
          const rs = qs.map((q) => dot(q, aj));
          rs.forEach((r, i) => { R0[i][j] = r; });
          const sh = rs.reduce((acc, r, i) => add(acc, scale(qs[i], r)), Array(n).fill(0));
          w = sub(aj, sh);
          steps.push({
            title: `Columna ${J}: quitar las sombras`,
            tex: [
              ...rs.map((r, i) => R`r_{${i + 1}${J}} = \vec q_${i + 1}\cdot\vec a_${J} = ${fmt(r)}`),
              R`\vec w_${J} = \vec a_${J} - ${rs.map((_, i) => R`r_{${i + 1}${J}}\vec q_${i + 1}`).join(' - ')}`,
              R`= ${tv(aj)} - ${tv(sh)}`, R`= ${clr(C.x, tv(w))}`,
            ],
            why: R`cada $r_{i${J}}$ es la <b>sombra</b> (proyección) de $\vec a_${J}$ sobre un $\vec q_i$ ya terminado: como $\vec q_i$ mide 1, basta un producto punto. Al restar las sombras (flechas grises) queda $\vec w_${J}$, la parte de $\vec a_${J}$ que es <b>perpendicular</b> a ${j === 1 ? R`$\vec q_1$` : R`$\vec q_1$ y $\vec q_2$`}: lo «nuevo» que aporta esta columna.`,
          });
          scene.push({ j, phase: 'proj', done: j, sh: rs.map((r, i) => scale(qs[i], r)), w });
        }
        const l = norm(w);
        if (l < 1e-9) {
          steps.push({
            title: `Columna ${J}: no queda nada`,
            tex: R`\vec w_${J} = \vec 0`,
            why: R`$\vec a_${J}$ era pura sombra: está en el ${j === 1 ? 'recta' : 'plano'} de las columnas anteriores (es combinación de ellas). No hay dirección nueva que normalizar, así que Gram-Schmidt se detiene y no existe una $Q$ cuadrada.`,
          });
          scene.push({ j, phase: 'fail', done: j });
          break;
        }
        R0[j][j] = l;
        const q = scale(w, 1 / l);
        qs.push(q);
        steps.push({
          title: `Columna ${J}: normalizar`,
          tex: [
            R`r_{${J}${J}} = \|${j ? R`\vec w_${J}` : R`\vec a_1`}\|`, R`= \sqrt{${(j ? w : aj).map((x) => `${pf(x)}^2`).join('+')}} = ${fmt(l)}`,
            R`\vec q_${J} = \frac{${j ? R`\vec w_${J}` : R`\vec a_1`}}{${fmt(l)}} = ${clr(AC[j], tv(q))}`,
          ],
          why: j === 0
            ? R`la primera columna no tiene nada que quitar: solo se divide entre su largo para que mida 1. Así $\vec a_1 = r_{11}\vec q_1$, y la primera columna de $R$ es $(r_{11}, 0${n === 3 ? ', 0' : ''})$.`
            : R`se divide $\vec w_${J}$ entre su largo para que mida 1. Juntando: $\vec a_${J} = ${qs.map((_, i) => R`r_{${i + 1}${J}}\vec q_${i + 1}`).join(' + ')}$. Esa es la columna ${J} de $R$: solo usa $\vec q_1, \dots, \vec q_${J}$, y por eso abajo hay ceros.`,
        });
        scene.push({ j, phase: 'norm', done: j + 1, w });
      }
      if (qs.length === n) {
        const Q = transpose(qs);
        steps.push({
          title: 'Armar Q y R, y comprobar',
          tex: [R`Q = ${tm(Q)}`, R`R = ${tm(R0)}`, R`QR = ${tm(matMul(Q, R0))} = A`],
          why: R`$Q$ lleva los $\vec q_j$ como columnas y $R$ los números que se fueron calculando: sombras arriba de la diagonal, largos en la diagonal, ceros abajo. En la escena se aplica $R$ (la primera columna no se sale del eje $x$) y luego $Q$ gira todo hasta $A$.`,
        });
        scene.push({ phase: 'end', done: 0 });
      }
      stepper.set(steps, st.step);
      st.step = stepper.i;
    }
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => st.tab, (k) => {
      stop(); st.tab = k; tb.refresh();
      if (k === 'calc' && scene[st.step]?.phase !== 'end') st.s = 0; else st.s = 2;
      update();
    });

    panel.append(
      ...intro('Factorización QR',
        R`Es <b>Gram-Schmidt escrito como matrices</b>. Las columnas de $A$ se reemplazan por una base ortonormal (las columnas de $Q$), y lo que se fue restando y dividiendo queda guardado en $R$, que es <b>triangular superior</b>. Geométricamente, $A = QR$ es: primero $R$ (estirar y cizallar sin salirse de los ejes «en orden»), luego $Q$ (solo girar o reflejar).`),
      card('Matriz A (sus columnas son los vectores)', me.el, pre),
      tb.el, tb.panes.exp, tb.panes.calc,
    );
    tb.panes.calc.append(
      rich(R`Método: Gram-Schmidt columna por columna. A cada $\vec a_j$ se le quitan sus sombras sobre los $\vec q$ anteriores y lo que queda se normaliza. Los números que salen forman $R$.`, 'p', 'note'),
      stepper.el, stepper.listEl,
    );
    tb.panes.exp.append(
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
      buildProc();
      const calc = st.tab === 'calc', sc = calc ? scene[st.step] ?? { phase: 'end' } : null;
      const pv = calc && sc.phase !== 'end';
      const Mt = pv ? I : M(), Fr = frame();
      grid.setMatrix(Mt);
      // escena del procedimiento
      shadows.forEach((a, i) => {
        const vis = pv && sc.phase === 'proj' && i < sc.sh.length;
        a.setVisible(vis);
        if (vis) { const from = sc.sh.slice(0, i).reduce((acc, v) => add(acc, v), O); a.set(from, add(from, sc.sh[i])); }
      });
      wArr.setVisible(pv && (sc.phase === 'proj' || sc.phase === 'norm'));
      if (pv && sc.phase === 'proj') wArr.set(sc.sh.reduce((acc, v) => add(acc, v), O), col(st.A, sc.j)).setLabel(R`\vec w_${sc.j + 1}`);
      else if (pv && sc.phase === 'norm') wArr.set(O, sc.w).setLabel(sc.j ? R`\vec w_${sc.j + 1}` : '');
      qArr.forEach((a, j) => { const vis = pv && j < sc.done; a.setVisible(vis); if (vis) a.set(O, scale(F.qs[j], 1)); });
      target.forEach((a, j) => a.set(O, col(st.A, j)));
      axes.forEach((a, j) => a.setVisible(F.failAt < 0 && !pv).set(O, col(Fr, j))
        .setLabel(st.s > 1.01 && F.failAt < 0 ? R`\vec q_${j + 1}` : BASIS[j].tex));
      cols.forEach((a, j) => a.setVisible(!pv).set(O, col(Mt, j)).setLabel(st.s > 0.02 && st.s <= 1.01 ? R`\vec r_${j + 1}` : ''));
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
