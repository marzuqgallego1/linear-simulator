import { Arrow, Polyline, Quad, Dot, Rod, C, setLabel } from '../core/stage.js';
import { sub, dot, norm, cross, matVec, fmt, pf, tv, tm, clr, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, slider, button, buttonRow, chips, TexBox, Note, rich } from '../core/ui.js';
import { LineView, PlaneView } from '../core/geom.js';
import { BASIS } from '../core/presets.js';

const MAXP = 10;
const state = {
  2: { pts: [[-3, -1.5], [-1.5, 0], [0, 0.5], [1.5, 2.5], [3, 2.5]], mine: { m: 0.3, b: 1 }, squares: true, which: 'best' },
  3: { pts: [[0, 1], [1, 1], [2, 3]] },
};

/** Recta de mínimos cuadrados y = m·x + b por las ecuaciones normales. */
function fit(pts) {
  const N = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const D = sxx * N - sx * sx;
  const AtA = [[sxx, sx], [sx, N]], Atb = [sxy, sy];
  if (Math.abs(D) < EPS) return { ok: false, AtA, Atb };
  return { ok: true, AtA, Atb, m: (sxy * N - sx * sy) / D, b: (sxx * sy - sx * sxy) / D };
}
const sse = (pts, m, b) => pts.reduce((s, [x, y]) => s + (y - (m * x + b)) ** 2, 0);
const lineTex = (m, b) => {
  const bs = fmt(b);
  return `y = ${fmt(m)}x ${bs.startsWith('-') ? '-' : '+'} ${bs.replace('-', '')}`;
};

export default {
  id: 'minimos',
  title: 'Mínimos cuadrados',
  dims: [2, 3],

  mount(ctx) {
    return ctx.dim === 2 ? mount2(ctx) : mount3(ctx);
  },
};

// ---------- 2D: ajustar una recta a puntos ----------
function mount2({ stage, panel }) {
  const s = state[2];

  const bestLine = new LineView(stage, C.w, { radius: 0.035 });
  const myLine = new LineView(stage, '#adb5bd', { radius: 0.025 });
  const resid = Array.from({ length: MAXP }, () => new Polyline(stage, C.x2, { opacity: 0.9 }));
  const sq = Array.from({ length: MAXP }, () => new Quad(stage, C.x2, { opacity: 0.18, edgeOpacity: 0.5 }));
  for (let i = 0; i < MAXP; i++) {
    stage.addHandle({
      color: C.x, visible: () => i < s.pts.length, get: () => s.pts[i] ?? [0, 0],
      set: (p) => { s.pts = s.pts.map((q, k) => (k === i ? p : q)); update(); },
    });
  }

  const sm = slider({ label: 'm', min: -3, max: 3, step: 0.05, get: () => s.mine.m, set: (x) => { s.mine.m = x; update(); } });
  const sb = slider({ label: 'b', min: -5, max: 5, step: 0.05, get: () => s.mine.b, set: (x) => { s.mine.b = x; update(); } });
  const which = chips([['best', 'Mejor recta'], ['mine', 'Tu recta']], () => s.which, (w) => { s.which = w; update(); });
  const sqToggle = chips([[true, 'Ver cuadrados'], [false, 'Solo distancias']], () => s.squares, (v) => { s.squares = v; update(); });
  const add = () => {
    if (s.pts.length >= MAXP) return;
    const k = s.pts.length;
    s.pts = [...s.pts, [((k * 7) % 9) - 4, ((k * 5) % 7) - 3]];
    update();
  };
  const remove = () => { if (s.pts.length > 2) { s.pts = s.pts.slice(0, -1); update(); } };
  const cNormal = new TexBox(), cSol = new TexBox(), cErr = new TexBox(), note = new Note(), cmp = new Note();

  panel.append(
    ...intro('Mínimos cuadrados',
      R`Con muchos datos casi nunca hay una recta que pase por <b>todos</b> los puntos: el sistema no tiene solución. Mínimos cuadrados busca la recta que se equivoca <b>lo menos posible</b>, midiendo el error como la suma de los cuadrados de las distancias verticales (los <b>residuos</b>).`),
    card('Datos', rich('Arrastra los puntos cian.', 'p'), buttonRow(button('+ Punto', add), button('− Punto', remove))),
    card('Qué recta mirar', which.el, sqToggle.el, rich('Mueve tu recta y compara su error con el de la mejor:', 'p'), sm.el, sb.el,
      buttonRow(button('Copiar la mejor recta', () => { const F = fit(s.pts); if (F.ok) { s.mine = { m: F.m, b: F.b }; update(); } })), cmp.el),
    card('Ecuaciones normales', rich(R`Queremos $y_i \approx m x_i + b$ para todos los puntos: $A\vec c \approx \vec y$ con $A$ = [columna de $x_i$, columna de unos]. La mejor solución cumple $A^TA\,\vec c = A^T\vec y$:`),
      cNormal.el, cSol.el, cErr.el, note.el),
    details('Definición formal',
      rich(R`Si $A\vec x = \vec b$ no tiene solución, la solución de <b>mínimos cuadrados</b> $\hat x$ minimiza $\|A\vec x - \vec b\|^2$. Se obtiene resolviendo las <b>ecuaciones normales</b> $A^TA\,\hat x = A^T\vec b$.`),
      rich(R`Geométricamente, $A\hat x$ es la <b>proyección</b> de $\vec b$ sobre el espacio de columnas de $A$, y el error $\vec b - A\hat x$ es perpendicular a ese espacio. Míralo en la vista 3D.`)),
    tryList([
      'Arrastra un punto muy lejos de los demás: la mejor recta se inclina hacia él, porque su error se eleva al cuadrado.',
      'Ponte en «Tu recta» e intenta bajar el error moviendo $m$ y $b$: nunca bajarás del de la mejor recta.',
      'Alinea todos los puntos: el error mínimo se vuelve 0, porque ahora sí hay solución exacta.',
      'Pon todos los puntos con la misma $x$: no hay una recta $y = mx + b$ que sirva (la recta sería vertical).',
    ]),
  );

  function update() {
    const F = fit(s.pts);
    bestLine.setVisible(F.ok);
    if (F.ok) bestLine.set([0, F.b], [1, F.m]);
    myLine.setVisible(s.which === 'mine').set([0, s.mine.b], [1, s.mine.m]);
    const use = s.which === 'mine' ? s.mine : F.ok ? F : null;

    for (let i = 0; i < MAXP; i++) {
      const p = s.pts[i];
      const vis = !!p && !!use;
      resid[i].setVisible(vis);
      sq[i].setVisible(vis && s.squares);
      if (!vis) continue;
      const yl = use.m * p[0] + use.b, e = p[1] - yl;
      resid[i].set([p, [p[0], yl]]);
      // cuadrado de lado |e| pegado al residuo
      const side = Math.abs(e), dir = 1;
      sq[i].set([p[0], yl], [p[0], p[1]], [p[0] + dir * side, p[1]], [p[0] + dir * side, yl]);
    }

    sm.refresh(); sb.refresh(); which.refresh(); sqToggle.refresh();
    cNormal.set(R`A^TA = ${tm(F.AtA)},\qquad A^T\vec y = ${tv(F.Atb)}`);
    if (!F.ok) {
      cSol.set(''); cErr.set('');
      note.set('neg', R`Todos los puntos tienen la misma $x$: las columnas de $A$ son paralelas y $A^TA$ no es invertible. No existe una recta $y = mx + b$ que los ajuste (haría falta una recta vertical).`);
      cmp.set('', '');
      return;
    }
    const best = sse(s.pts, F.m, F.b), mine = sse(s.pts, s.mine.m, s.mine.b);
    cSol.set(R`${tm(F.AtA)}\begin{bmatrix}m\\b\end{bmatrix} = ${tv(F.Atb)} \;\Rightarrow\; m = ${fmt(F.m)},\ b = ${fmt(F.b)} \;\Rightarrow\; ${clr(C.w, lineTex(F.m, F.b))}`);
    cErr.set(R`\text{Error} = \sum_i (y_i - \hat y_i)^2 = ${clr(C.x2, fmt(best, 3))}`);
    note.set(best < 1e-9 ? 'pos' : '', best < 1e-9
      ? 'Los puntos están alineados: la recta pasa por todos y el error es 0 (el sistema sí tenía solución exacta).'
      : 'Las áreas rosas son los cuadrados de los residuos. La mejor recta hace que su suma total sea la menor posible.');
    cmp.set(s.which === 'mine' ? (mine - best < 1e-6 ? 'pos' : 'zero') : '', s.which === 'mine'
      ? R`Tu recta $${lineTex(s.mine.m, s.mine.b)}$ tiene error <b>${fmt(mine, 3)}</b>; la mejor, <b>${fmt(best, 3)}</b>.${mine - best < 1e-6 ? ' ¡La encontraste!' : ''}`
      : R`Mejor recta: $${lineTex(F.m, F.b)}$, error ${fmt(best, 3)}. Pulsa «Tu recta» para intentar superarla.`);
  }

  update();
}

// ---------- 3D: la misma idea como proyección ----------
function mount3({ stage, panel }) {
  const s = state[3];
  const O = [0, 0, 0];
  const cols = () => [s.pts.map((p) => p[0]), [1, 1, 1]];
  const yv = () => s.pts.map((p) => p[1]);

  const plane = new PlaneView(stage, '#8b93a7', { opacity: 0.14 });
  const a1 = new Arrow(stage, BASIS[0].color, { label: R`\vec a_1 = \vec x` });
  const a2 = new Arrow(stage, BASIS[1].color, { label: R`\vec a_2 = \vec 1` });
  const bA = new Arrow(stage, C.x, { label: R`\vec y`, radius: 0.045 });
  const pA = new Arrow(stage, C.w, { label: R`A\hat c`, radius: 0.045 });
  const err = new Rod(stage, C.x2, { radius: 0.03 });
  const foot = new Dot(stage, C.w, { radius: 0.08 });
  const badge = stage.addLabel('', C.x2, 'badge');
  stage.addHandle({ color: C.x, get: yv, set: (p) => { s.pts = s.pts.map((q, i) => [q[0], p[i]]); update(); } });

  const eds = s.pts.map((_, i) => vecEditor({
    name: `(x_${i + 1},\\,y_${i + 1})`, color: C.x, dim: 2, get: () => s.pts[i],
    set: (p) => { s.pts = s.pts.map((q, k) => (k === i ? p : q)); update(); },
  }));
  const cSys = new TexBox(), cProj = new TexBox(), cPerp = new TexBox(), note = new Note();

  panel.append(
    ...intro('Mínimos cuadrados: la geometría',
      R`Con 3 datos $(x_i, y_i)$, ajustar $y = mx + b$ es el sistema $A\vec c = \vec y$ de 3 ecuaciones y 2 incógnitas. Las columnas de $A$ son $\vec x = (x_1, x_2, x_3)$ y $\vec 1 = (1, 1, 1)$, dos vectores de $\mathbb{R}^3$: solo generan un <b>plano</b>. Si $\vec y$ no está en ese plano, no hay solución exacta.`),
    card('Los 3 datos', h('div', { class: 'row' }, eds.map((e) => e.el)), rich(R`También puedes arrastrar la punta de $\vec y$ (cian): cambia los tres $y_i$ a la vez.`, 'p')),
    card('Lo que estás viendo', cSys.el, note.el, cProj.el, cPerp.el),
    details('Por qué salen las ecuaciones normales',
      rich(R`El punto del plano más cercano a $\vec y$ es su <b>proyección</b> $A\hat c$. El error $\vec e = \vec y - A\hat c$ es perpendicular al plano, así que es perpendicular a cada columna: $\vec a_1\cdot\vec e = 0$ y $\vec a_2\cdot\vec e = 0$.`),
      rich(R`Escrito con matrices: $A^T(\vec y - A\hat c) = \vec 0$, es decir, $A^TA\,\hat c = A^T\vec y$. Son las mismas ecuaciones que en la vista 2D.`)),
    tryList([
      R`Arrastra la punta de $\vec y$ hasta el plano gris: el error se hace 0 y los tres puntos quedan alineados.`,
      'Gira la vista hasta ver el plano de canto: el segmento rosa (el error) llega en ángulo recto.',
      R`Pon $x_1 = x_2 = x_3$: $\vec x$ y $\vec 1$ son paralelos y ya no generan un plano.`,
    ]),
  );

  function update() {
    const [x, one] = cols(), y = yv();
    const F = fit(s.pts);
    a1.set(O, x);
    a2.set(O, one);
    bA.set(O, y);
    const nrm = cross(x, one);
    eds.forEach((e) => e.refresh());
    cSys.set(R`A\vec c = \vec y:\quad ${tm(s.pts.map((p) => [p[0], 1]))}\begin{bmatrix}m\\b\end{bmatrix} = ${clr(C.x, tv(y))}`);
    if (!F.ok || norm(nrm) < EPS) {
      plane.setVisible(false); pA.setVisible(false); err.setVisible(false); foot.setVisible(false); badge.visible = false;
      note.set('neg', R`Las tres $x_i$ son iguales: $\vec x$ y $\vec 1$ son paralelos, generan solo una recta y no se puede despejar $m$.`);
      cProj.set(''); cPerp.set('');
      return;
    }
    plane.setVisible(true).set(O, nrm);
    const p = matVec(s.pts.map((q) => [q[0], 1]), [F.m, F.b]);
    const e = sub(y, p);
    pA.setVisible(true).set(O, p);
    foot.setVisible(true).set(p);
    err.setVisible(norm(e) > 1e-6).set(p, y);
    badge.visible = norm(e) > 1e-6;
    badge.position.set(...p.map((v, i) => (v + y[i]) / 2));
    setLabel(badge, R`\|\vec e\| = ${fmt(norm(e))}`);

    note.set(norm(e) < 1e-6 ? 'pos' : 'zero', norm(e) < 1e-6
      ? R`$\vec y$ está en el plano de las columnas: hay solución exacta y los 3 puntos están alineados.`
      : R`$\vec y$ (cian) está <b>fuera</b> del plano gris de las columnas, así que $A\vec c = \vec y$ no tiene solución. Lo mejor que podemos hacer es llegar al punto del plano más cercano: la <b>proyección</b> $A\hat c$ (amarillo).`);
    cProj.set(R`\hat c = \begin{bmatrix}${fmt(F.m)}\\${fmt(F.b)}\end{bmatrix}\;(y = ${fmt(F.m)}x ${fmt(F.b).startsWith('-') ? '' : '+'} ${fmt(F.b)}),\qquad A\hat c = ${clr(C.w, tv(p))},\qquad \vec e = \vec y - A\hat c = ${clr(C.x2, tv(e))}`);
    cPerp.set(R`\vec a_1\cdot\vec e = ${fmt(dot(x, e))},\quad \vec a_2\cdot\vec e = ${fmt(dot(one, e))} \;\Rightarrow\; \vec e \perp \text{plano}`);
  }

  update();
}
