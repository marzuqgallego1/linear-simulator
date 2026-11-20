import { Arrow, Dot, C, setLabel } from '../core/stage.js';
import { add, scale, dot, norm, cross, col, withCol, fmt, tv, clr, combo, solveSystem, taug, EPS, to3 } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, matEditor, chips, TexBox, Note, rich } from '../core/ui.js';
import { LineView, PlaneView, linform } from '../core/geom.js';
import { BASIS, basisColors } from '../core/presets.js';

const ROW = [C.u, C.v, C.x]; // color de cada ecuación (fila)
const VARS = ['x', 'y', 'z'];

const PRESETS = {
  2: [
    ['Solución única', [[1, 1], [1, -1]], [3, 1]],
    ['Infinitas', [[1, 2], [2, 4]], [3, 6]],
    ['Sin solución', [[1, 2], [2, 4]], [3, 2]],
  ],
  3: [
    ['Solución única', [[1, 1, 1], [1, -1, 0], [0, 1, -1]], [3, 0, 0]],
    ['Infinitas (recta)', [[1, 1, 1], [1, -1, 0], [2, 0, 1]], [3, 0, 3]],
    ['Infinitas (plano)', [[1, 1, 1], [2, 2, 2], [-1, -1, -1]], [1, 2, -1]],
    ['Sin solución', [[1, 1, 1], [1, -1, 0], [2, 0, 1]], [3, 0, 1]],
  ],
};

const state = {
  2: { view: 'filas', A: PRESETS[2][0][1], b: PRESETS[2][0][2] },
  3: { view: 'filas', A: PRESETS[3][0][1], b: PRESETS[3][0][2] },
};

const tuple = (X) => `(${X.map((x) => fmt(x)).join(',\\ ')})`;

export default {
  id: 'sistemas',
  title: 'Sistemas de ecuaciones',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, O = Array(n).fill(0);
    const rows = () => s.A;
    const filas = () => s.view === 'filas';
    const objName = dim === 2 ? 'rectas' : 'planos';
    const theObjs = dim === 2 ? 'las rectas' : 'los planos';
    const allObjs = dim === 2 ? 'todas las rectas' : 'todos los planos';

    // --- escena: vista por filas ---
    const rowObjs = rows().map((_, i) => (dim === 2 ? new LineView(stage, ROW[i]) : new PlaneView(stage, ROW[i], { opacity: 0.12 })));
    const solPoint = new Dot(stage, '#ffffff', { radius: 0.14 });
    const solLine = new LineView(stage, C.w, { radius: 0.05 });
    const solPlane = dim === 3 ? new PlaneView(stage, C.w, { opacity: 0.25 }) : null;
    const badge = stage.addLabel('', '#ffffff', 'badge');

    // --- escena: vista por columnas ---
    const colArrows = BASIS.slice(0, n).map((bs, j) => new Arrow(stage, bs.color, { label: R`\vec a_${j + 1}` }));
    const pathArrows = BASIS.slice(0, n).map((bs) => new Arrow(stage, bs.color, { opacity: 0.45, radius: 0.025 }));
    const bArrow = new Arrow(stage, C.w, { label: R`\vec b`, radius: 0.045 });
    const spanLine = new LineView(stage, '#6c7488', { radius: 0.03 });
    const spanPlane = dim === 3 ? new PlaneView(stage, '#8b93a7', { opacity: 0.1 }) : null;

    // Arrastrar en filas: desplaza la recta/plano i en paralelo (cambia b_i).
    rows().forEach((_, i) => {
      stage.addHandle({
        color: ROW[i],
        visible: () => filas() && norm(s.A[i]) > EPS,
        get: () => scale(s.A[i], s.b[i] / dot(s.A[i], s.A[i])),
        set: (p) => { s.b = s.b.map((x, k) => (k === i ? Number(dot(s.A[i], p).toFixed(4)) : x)); update(); },
      });
    });
    // Arrastrar en columnas: mueve las columnas de A y el vector b.
    BASIS.slice(0, n).forEach((bs, j) =>
      stage.addHandle({ color: bs.color, visible: () => !filas(), get: () => col(s.A, j), set: (v) => { s.A = withCol(s.A, j, v); update(); } }));
    stage.addHandle({ color: C.w, visible: () => !filas(), get: () => s.b, set: (v) => { s.b = v; update(); } });

    // --- panel ---
    const sysTex = new TexBox();
    const me = matEditor({ dim, colors: basisColors(n), get: () => s.A, set: (A) => { s.A = A; update(); } });
    const eb = vecEditor({ name: R`\vec b`, color: C.w, dim, get: () => s.b, set: (v) => { s.b = v; update(); } });
    const presets = h('div', { class: 'presets' }, PRESETS[dim].map(([name, A, b]) =>
      h('button', { class: 'chip', onclick: () => { s.A = A.map((r) => [...r]); s.b = [...b]; update(); } }, name)));
    const view = chips([['filas', `Por filas (${objName})`], ['columnas', 'Por columnas (combinación)']], () => s.view, (v) => { s.view = v; update(); });
    const viewNote = new Note();
    const note = new Note();
    const cRank = new TexBox(), cSol = new TexBox(), cCheck = new TexBox();
    const stepsBox = h('div');

    panel.append(
      ...intro('Sistemas de ecuaciones',
        R`Un sistema lineal $A\vec x = \vec b$ se puede leer de dos formas. <b>Por filas</b>: cada ecuación es ${dim === 2 ? 'una recta' : 'un plano'} y las soluciones son los puntos comunes a todas. <b>Por columnas</b>: buscamos cuánto de cada columna de $A$ hay que sumar para llegar a $\vec b$. Son la misma pregunta vista desde dos lados.`),
      card('El sistema', sysTex.el, h('div', { class: 'row' }, me.el, eb.el), presets),
      card('Cómo mirarlo', view.el, viewNote.el),
      card('Resultado', note.el, cRank.el, cSol.el, cCheck.el),
      card('Eliminación de Gauss-Jordan', rich(R`Operaciones de fila sobre la matriz aumentada $[A\,|\,\vec b]$ hasta la forma escalonada reducida. Ninguna operación cambia las soluciones.`), stepsBox),
      details('Definición formal',
        rich(R`<b>Teorema de Rouché–Frobenius</b>: con $n$ incógnitas, el sistema tiene solución si y solo si $\text{rango}(A) = \text{rango}([A\,|\,\vec b])$. Si además ese rango es $n$, la solución es única; si es menor, hay infinitas, con $n - \text{rango}(A)$ parámetros libres.`),
        rich(R`Toda solución se escribe como $\vec x = \vec x_p + \vec x_h$: una solución particular más cualquier solución del sistema homogéneo $A\vec x = \vec 0$ (el <b>núcleo</b> de $A$).`),
        rich(R`Si $A$ es cuadrada e invertible ($\det A\neq 0$), la única solución es $\vec x = A^{-1}\vec b$.`)),
      tryList([
        `En la vista por filas, arrastra una esfera de color: la ${dim === 2 ? 'recta' : 'plano'} se desplaza en paralelo (cambia un número de $\\vec b$) y el punto de corte la sigue.`,
        'Pulsa «Sin solución» y cambia a la vista por columnas: $\\vec b$ queda fuera de la zona gris que generan las columnas.',
        'Con «Infinitas», mira los pasos de Gauss-Jordan: aparece una fila de ceros, que es una ecuación que sobraba.',
        dim === 3 ? 'Con «Solución única», mueve un plano hasta que los tres compartan una recta.' : 'Arrastra una columna hasta que sea paralela a la otra: el determinante se anula y la solución deja de ser única.',
      ]),
    );

    function update() {
      const A = s.A, b = s.b;
      const S = solveSystem(A, b);
      const vf = filas();

      // ---- vista por filas ----
      rowObjs.forEach((o, i) => {
        const a = A[i], ok = vf && norm(a) > EPS;
        o.setVisible(ok);
        if (!ok) return;
        const P = scale(a, b[i] / dot(a, a));
        if (dim === 2) o.set(P, [-a[1], a[0]]);
        else o.set(P, a);
      });
      const k = S.nullBasis.length;
      solPoint.setVisible(vf && S.consistent && k === 0);
      solLine.setVisible(vf && S.consistent && k === 1);
      solPlane?.setVisible(vf && S.consistent && k === 2);
      badge.visible = vf && S.consistent && k === 0;
      if (S.consistent) {
        solPoint.set(S.xp);
        badge.position.set(...to3(S.xp));
        setLabel(badge, tuple(S.xp));
        if (k === 1) solLine.set(S.xp, S.nullBasis[0]);
        if (k === 2 && solPlane) solPlane.set(S.xp, cross(S.nullBasis[0], S.nullBasis[1]));
      }

      // ---- vista por columnas ----
      const cols = [...Array(n).keys()].map((j) => col(A, j));
      colArrows.forEach((a, j) => a.setVisible(!vf).set(O, cols[j]));
      bArrow.setVisible(!vf).set(O, b);
      let cur = O;
      pathArrows.forEach((a, j) => {
        const next = add(cur, scale(cols[j], S.xp[j]));
        a.setVisible(!vf && S.consistent).set(cur, next);
        cur = next;
      });
      // span de las columnas (solo interesa cuando no llenan todo el espacio)
      const indep = S.pivots.map((j) => cols[j]);
      spanLine.setVisible(!vf && S.rank === 1);
      spanPlane?.setVisible(!vf && S.rank === 2 && dim === 3);
      if (S.rank === 1) spanLine.set(O, indep[0]);
      if (S.rank === 2 && dim === 3) spanPlane.set(O, cross(indep[0], indep[1]));

      // ---- panel ----
      me.refresh(); eb.refresh(); view.refresh();
      sysTex.set(R`\begin{cases}${A.map((r, i) => clr(ROW[i], `${linform(r, VARS)} = ${fmt(b[i])}`)).join('\\\\')}\end{cases}`);
      viewNote.set('', vf
        ? `Cada color es una ecuación. Las esferas mueven cada ${dim === 2 ? 'recta' : 'plano'} en paralelo. La solución (blanco o amarillo) es lo que tienen en común.`
        : R`Las flechas de colores son las columnas $\vec a_j$ de $A$ (arrastrables). La solución dice cuánto de cada una sumar, punta con cola, para llegar a $\vec b$.`);

      const nn = `n = ${n}`;
      cRank.set(R`\text{rango}(A) = ${S.rank},\quad \text{rango}([A\,|\,\vec b]) = ${S.rankAug},\quad ${nn}\ \text{incógnitas}`);
      const where = k === n ? 'A es la matriz cero: cualquier vector es solución' : vf
        ? { 0: `${theObjs} se cortan en un solo punto`, 1: dim === 2 ? 'las dos rectas coinciden: son la misma recta' : 'los planos comparten una recta', 2: 'los planos coinciden en uno solo' }[k] ?? 'todas las ecuaciones son 0 = 0'
        : { 0: 'hay una única forma de combinar las columnas para llegar a $\\vec b$', 1: 'las columnas son dependientes y hay infinitas combinaciones que llegan a $\\vec b$', 2: 'solo una columna aporta dirección y hay infinitas combinaciones' }[k] ?? 'A es la matriz cero';
      if (!S.consistent) {
        note.set('neg', vf
          ? `<b>Sin solución</b> (sistema incompatible): no hay ningún punto común a ${allObjs}. Al eliminar aparece una ecuación imposible del tipo $0 = c$.`
          : `<b>Sin solución</b> (sistema incompatible): $\\vec b$ está fuera de la zona que generan las columnas (en gris), así que ninguna combinación llega a él.`);
        cSol.set(R`\text{rango}(A) = ${S.rank} < ${S.rankAug} = \text{rango}([A\,|\,\vec b])`);
        cCheck.set('');
      } else if (k === 0) {
        note.set('pos', `<b>Solución única</b> (compatible determinado): ${where}.`);
        cSol.set(R`\vec x = ${clr('#ffffff', tv(S.xp))}`);
        cCheck.set(R`${combo(S.xp.map((x, j) => [x, clr(BASIS[j].color, tv(cols[j]))]))} = ${clr(C.w, tv(b))}`);
      } else {
        note.set('zero', `<b>Infinitas soluciones</b> (compatible indeterminado): ${where}. ${k > 1 ? `Quedan ${k} parámetros libres` : 'Queda 1 parámetro libre'}.`);
        const params = ['t', 's', 'r'];
        cSol.set(R`\vec x = ${clr('#ffffff', tv(S.xp))}` + S.nullBasis.map((v, i) => ` + ${params[i]}\\,${clr(C.w, tv(v))}`).join(''));
        cCheck.set(R`\text{Solución particular } (${S.free.map((f, i) => `${VARS[f]} = ${params[i]} = 0`).join(',\\ ')}):\ ` +
          `${combo(S.xp.map((x, j) => [x, clr(BASIS[j].color, tv(cols[j]))]))} = ${clr(C.w, tv(b))}`);
      }

      // pasos de Gauss-Jordan
      const start = taug(A.map((r, i) => [...r, b[i]]));
      const parts = [start, ...S.steps.map((st) => R`\xrightarrow{${st.op}} ${taug(st.M)}`)];
      const src = `\\begin{aligned}&${parts.join('\\\\&')}\\end{aligned}`;
      if (stepsBox.dataset.src !== src) {
        stepsBox.dataset.src = src;
        const box = new TexBox();
        box.set(src);
        stepsBox.replaceChildren(box.el,
          S.steps.length ? rich(`${S.steps.length} operaci${S.steps.length > 1 ? 'ones' : 'ón'}. Cada fila con un 1 delantero (pivote) fija una incógnita; las columnas sin pivote son variables libres.`, 'p', 'note')
            : rich('La matriz ya estaba en forma escalonada reducida.', 'p', 'note'));
      }
    }

    update();
  },
};
