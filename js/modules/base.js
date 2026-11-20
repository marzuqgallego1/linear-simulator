import { Arrow, Lattice, C, setLabel } from '../core/stage.js';
import { identity, lerpMat, matVec, matMul, inverse, det, add, scale, fmt, tv, tm, clr, combo, deg, EPS, to3 } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS } from '../core/presets.js';

const BC = [C.u, C.v, '#20c997']; // colores de b1, b2, b3
const BT = [R`\vec b_1`, R`\vec b_2`, R`\vec b_3`];

const rot = (th, dim) => {
  const c = Math.cos(th), s = Math.sin(th);
  return dim === 2 ? [[c, s], [-s, c]] : [[c, s, 0], [-s, c, 0], [0, 0, 1]];
};

const PRESETS = {
  2: [
    ['Estándar', [[1, 0], [0, 1]]],
    ['Ejes rotados 30°', rot(Math.PI / 6, 2)],
    ['Oblicua', [[1, 0.5], [0.5, 1]]],
    ['Escalada', [[2, 0], [0, 0.5]]],
    ['Otra oblicua', [[2, 1], [-1, 1]]],
  ],
  3: [
    ['Estándar', [[1, 0, 0], [0, 1, 0], [0, 0, 1]]],
    ['Rotada 30° (eje z)', rot(Math.PI / 6, 3)],
    ['Oblicua', [[1, 0.5, 0], [0, 1, 0.5], [0.5, 0, 1]]],
    ['Escalada', [[2, 0, 0], [0, 1, 0], [0, 0, 0.5]]],
  ],
};

const state = {
  2: { B: [[2, 1], [-1, 1]], x: [3, 3], t: 0, theta: 0 },
  3: { B: [[1, 0.5, 0], [0, 1, 0.5], [0.5, 0, 1]], x: [2, 2, 1], t: 0, theta: 0 },
};

export default {
  id: 'base',
  title: 'Cambio de base',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim]; // s.B = lista de vectores de la base (no la matriz)
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const P = () => I.map((_, i) => s.B.map((b) => b[i])); // columnas = vectores de la base
    const Pinv = () => inverse(P());
    const M = () => { const Pi = Pinv(); return Pi ? lerpMat(I, Pi, s.t) : I; }; // punto de vista
    let stop = () => {};
    /** Si B es una rotación (alrededor de z en 3D), su ángulo en grados; si no, null. */
    const rotAngle = () => {
      const Pm = P();
      const PtP = matMul(Pm.map((_, i) => Pm.map((r) => r[i])), Pm);
      const orth = PtP.every((r, i) => r.every((v, j) => Math.abs(v - (i === j ? 1 : 0)) < 1e-6));
      if (!orth || det(Pm) < 0 || (n === 3 && Math.abs(s.B[2][2] - 1) > 1e-6)) return null;
      return deg(Math.atan2(s.B[0][1], s.B[0][0]));
    };

    // --- escena ---
    const stdGrid = new Lattice(stage, '#8b93a7', { opacity: 0.25 });
    const bGrid = new Lattice(stage, C.u, { opacity: dim === 2 ? 0.45 : 0.3 });
    const eArrows = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { opacity: 0.35, radius: 0.022 }));
    const bArrows = s.B.map((_, j) => new Arrow(stage, BC[j], { label: BT[j] }));
    const parts = s.B.map((_, j) => new Arrow(stage, BC[j], { opacity: 0.45, radius: 0.025 }));
    const xA = new Arrow(stage, C.x, { label: R`\vec x`, radius: 0.045 });
    const badge = stage.addLabel('', C.x, 'badge');

    const editable = () => s.t < 0.005;
    s.B.forEach((_, j) => stage.addHandle({
      color: BC[j], visible: editable, get: () => s.B[j],
      set: (v) => { s.B = s.B.map((b, k) => (k === j ? v : b)); update(); },
    }));
    stage.addHandle({ color: C.x, visible: editable, get: () => s.x, set: (v) => { s.x = v; update(); } });

    // --- panel ---
    const eb = s.B.map((_, j) => vecEditor({
      name: BT[j], color: BC[j], dim, get: () => s.B[j],
      set: (v) => { stop(); s.t = 0; s.B = s.B.map((b, k) => (k === j ? v : b)); update(); },
    }));
    const presets = h('div', { class: 'presets' }, PRESETS[dim].map(([name, B]) =>
      h('button', { class: 'chip', onclick: () => { stop(); s.t = 0; s.B = B.map((r) => [...r]); s.theta = rotAngle() ?? 0; update(); } }, name)));
    const sTheta = slider({
      label: R`\theta`, min: -180, max: 180, step: 1, get: () => s.theta, format: (x) => `${fmt(x, 0)}°`,
      set: (th) => { stop(); s.t = 0; s.theta = th; s.B = rot((th * Math.PI) / 180, dim); update(); },
    });
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim, get: () => s.x, set: (v) => { s.x = v; update(); } });
    const st = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const go = (to) => { stop(); stop = animate(s.t, to, 1300, (t) => { s.t = t; update(); }); };
    const btnB = button('▶ Ver desde B', () => go(1), 'primary');
    const cCoords = new TexBox(), cP = new TexBox(), cInv = new TexBox(), cCheck = new TexBox();
    const note = new Note(), viewNote = new Note();
    const nb = dim === 2 ? R`$\vec b_1$ y $\vec b_2$` : R`$\vec b_1$, $\vec b_2$ y $\vec b_3$`;

    panel.append(
      ...intro('Cambio de base',
        R`Las coordenadas de un vector dependen de los ejes con que lo midas. Una <b>base</b> son tus «reglas de medir»: las coordenadas de $\vec x$ en la base $B$ son los números $c_i$ tales que $\vec x = ${dim === 2 ? R`c_1\vec b_1 + c_2\vec b_2` : R`c_1\vec b_1 + c_2\vec b_2 + c_3\vec b_3`}$. El vector es el mismo; lo que cambia es cómo lo describes.`),
      card('Base B', h('div', { class: 'row' }, eb.map((e) => e.el)), presets),
      card('Rotar el sistema de referencia',
        rich(dim === 2 ? 'Gira los ejes un ángulo $\\theta$ (base ortonormal):' : 'Gira los ejes alrededor del eje $z$ un ángulo $\\theta$:'), sTheta.el),
      card('Vector x', ex.el, cCoords.el, note.el),
      card('Cambiar el punto de vista', st.el, buttonRow(btnB, button('Ver desde la base estándar', () => go(0))), viewNote.el),
      card('Lo que está pasando',
        rich(R`La <b>matriz de cambio de base</b> $P$ tiene a ${nb} como columnas. Traduce coordenadas de $B$ a coordenadas estándar: $\vec x = P\,[\vec x]_B$. Para ir al revés se usa su inversa:`),
        cP.el, cInv.el, cCheck.el),
      details('Definición formal',
        rich(R`Una <b>base</b> de $\mathbb{R}^${n}$ es un conjunto de ${n} vectores linealmente independientes: generan todo el espacio y cada vector se escribe de <b>una única forma</b> como combinación de ellos.`),
        rich(R`Si $P = [\,\vec b_1\ \cdots\ \vec b_${n}\,]$, entonces $\vec x = P\,[\vec x]_B$ y $[\vec x]_B = P^{-1}\vec x$.`),
        rich(R`Si la base es <b>ortonormal</b> (vectores unitarios y perpendiculares), $P^{-1} = P^T$ y cada coordenada es un producto punto: $c_i = \vec b_i\cdot\vec x$.`),
        rich(R`Una transformación con matriz $A$ en la base estándar tiene matriz $P^{-1}AP$ en la base $B$: es la misma transformación descrita con otras reglas de medir.`)),
      tryList([
        R`Pulsa «▶ Ver desde B»: la rejilla naranja se vuelve cuadrada y $\vec x$ queda en sus coordenadas $[\vec x]_B$.`,
        R`Mueve $\theta$ a 30° y mira desde $B$: el vector aparece girado $-30°$. Rotar los ejes en un sentido equivale a rotar el vector en el contrario.`,
        R`Cuenta sobre la rejilla naranja cuántos $\vec b_1$ y $\vec b_2$ hacen falta para llegar a la punta de $\vec x$: son sus coordenadas en $B$.`,
        dim === 2 ? R`Arrastra $\vec b_2$ sobre la recta de $\vec b_1$: dejan de ser una base y no pueden describir todos los vectores.` : R`Haz $\vec b_3$ igual a $\vec b_1 + \vec b_2$: los tres quedan en un plano y dejan de ser una base.`,
      ]),
    );

    function update() {
      const Pm = P(), Pi = Pinv(), ok = !!Pi;
      if (!ok && s.t > 0) { stop(); s.t = 0; }
      const Mt = M();
      const xB = ok ? matVec(Pi, s.x) : null;

      stdGrid.setMatrix(Mt);
      bGrid.setMatrix(matMul(Mt, Pm));
      eArrows.forEach((a, j) => a.set(O, Mt.map((row) => row[j])));
      bArrows.forEach((a, j) => a.set(O, matVec(Mt, s.B[j])));
      xA.set(O, matVec(Mt, s.x));
      let cur = O;
      parts.forEach((a, j) => {
        const next = ok ? add(cur, scale(s.B[j], xB[j])) : cur;
        a.setVisible(ok).set(matVec(Mt, cur), matVec(Mt, next));
        cur = next;
      });
      badge.visible = ok;
      if (ok) {
        badge.position.set(...to3(matVec(Mt, s.x)));
        setLabel(badge, R`[\vec x]_B = (${xB.map((c) => fmt(c)).join(',\ ')})`);
      }

      eb.forEach((e) => e.refresh()); ex.refresh(); st.refresh(); sTheta.refresh();
      btnB.disabled = !ok;
      st.input.disabled = !ok;

      const cols = s.B.map((b, j) => clr(BC[j], tv(b)));
      cP.set(R`P = ${tm(Pm)},\qquad \det P = ${fmt(det(Pm))}`);
      if (!ok) {
        note.set('neg', `${nb} <b>no forman una base</b>: son linealmente dependientes (det $P$ = 0). Solo generan ${dim === 2 ? 'una recta' : 'un plano o una recta'}, así que hay vectores que no se pueden escribir con ellos.`);
        cCoords.set(R`[\vec x]_E = ${clr(C.x, tv(s.x))},\qquad [\vec x]_B\ \text{no está definido}`);
        cInv.set(R`P^{-1}\ \text{no existe}`);
        cCheck.set('');
        viewNote.set('neg', 'Con una base que no es base no hay otro punto de vista posible.');
        return;
      }
      cCoords.set(R`[\vec x]_E = ${clr(C.x, tv(s.x))}\qquad [\vec x]_B = ${clr(C.x, tv(xB))}`);
      const orth = Math.max(...matMul(Pm.map((_, i) => Pm.map((r) => r[i])), Pm).flatMap((r, i) => r.map((v, j) => Math.abs(v - (i === j ? 1 : 0))))) < 1e-6;
      note.set('pos', orth
        ? R`Mismo vector, dos descripciones. La base es <b>ortonormal</b>, así que cada coordenada es una proyección: $c_i = \vec b_i\cdot\vec x$.`
        : R`Mismo vector, dos descripciones: en la base estándar son los números de la izquierda; contando con ${nb} (rejilla naranja), los de la derecha.`);
      cInv.set(R`[\vec x]_B = P^{-1}\vec x = ${tm(Pi)}${tv(s.x)} = ${clr(C.x, tv(xB))}`);
      cCheck.set(R`\text{Comprobación: } ${combo(xB.map((c, j) => [c, cols[j]]))} = ${clr(C.x, tv(s.x))}`);

      const ang = rotAngle();
      const isRot = ang !== null && Math.abs(ang) > 0.5;
      viewNote.set('', s.t < 0.005
        ? 'Ahora lo ves con los ejes estándar (rejilla gris). La rejilla naranja es la de la base $B$.'
        : s.t > 0.995
          ? (isRot
            ? `Así lo ve alguien cuyos ejes están girados ${fmt(ang, 0)}°: para esa persona su rejilla es la cuadrada, y $\\vec x$ aparece girado ${fmt(-ang, 0)}°.`
            : 'Así lo ve alguien que mide con la base $B$: para esa persona su rejilla es la cuadrada, y la estándar (gris) es la deformada. Las coordenadas de $\\vec x$ son ahora $[\\vec x]_B$.')
          : 'Transformando el espacio con $P^{-1}$…');
    }

    update();
    return { destroy: () => stop() };
  },
};
