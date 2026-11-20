import { Arrow, Polyline, Dot, C } from '../core/stage.js';
import { add, sub, scale, cross, dot, norm, fmt, tv, clr, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, chips, TexBox, Note, rich } from '../core/ui.js';
import { PlaneView, linform } from '../core/geom.js';

const s = {
  mode: 'normal',
  P: [1, 1, 1],
  n: [1, 1, 2],
  u: [2, 0, -1],
  v: [0, 2, -1],
  Q: [-2, -1, 3],
};

/** Dos vectores directores sencillos perpendiculares a n. */
function directorsFor(n) {
  const k = [0, 1, 2].reduce((a, i) => (Math.abs(n[i]) < Math.abs(n[a]) ? i : a), 0);
  const e = [0, 0, 0];
  e[k] = 1;
  const u = cross(n, e);
  return [u, cross(n, u).map((x) => x / Math.max(1, norm(n)))];
}

export default {
  id: 'planos',
  title: 'Planos',
  dims: [3],

  mount({ stage, panel }) {
    const N = () => (s.mode === 'normal' ? s.n : cross(s.u, s.v));
    const byNormal = () => s.mode === 'normal';

    // --- escena ---
    const plane = new PlaneView(stage, C.w);
    const ua = new Arrow(stage, C.u, { label: R`\vec u` });
    const va = new Arrow(stage, C.v, { label: R`\vec v` });
    const na = new Arrow(stage, C.j, { label: R`\vec n`, radius: 0.04 });
    const P0 = new Dot(stage, '#ffffff', { radius: 0.08 });
    const perp = new Polyline(stage, '#ffffff', { opacity: 0.7, dashed: true, dash: 0.08 });
    const foot = new Dot(stage, '#ffffff', { radius: 0.06 });
    const lblP0 = stage.addLabel('P_0', '#ffffff');
    const lblQ = stage.addLabel('Q', C.x2);

    stage.addHandle({ color: '#ffffff', get: () => s.P, set: (p) => { s.P = p; update(); } });
    stage.addHandle({ color: C.j, visible: byNormal, get: () => add(s.P, s.n), set: (p) => { s.n = sub(p, s.P); update(); } });
    stage.addHandle({ color: C.u, visible: () => !byNormal(), get: () => add(s.P, s.u), set: (p) => { s.u = sub(p, s.P); update(); } });
    stage.addHandle({ color: C.v, visible: () => !byNormal(), get: () => add(s.P, s.v), set: (p) => { s.v = sub(p, s.P); update(); } });
    stage.addHandle({ color: C.x2, get: () => s.Q, set: (p) => { s.Q = p; update(); } });

    // --- panel ---
    const mode = chips([['normal', 'Punto + vector normal'], ['dirs', 'Punto + 2 vectores directores']], () => s.mode, (m) => {
      if (m === s.mode) return;
      // Pasamos de una forma a la otra conservando el mismo plano.
      if (m === 'normal') s.n = cross(s.u, s.v);
      else if (norm(cross(cross(s.u, s.v), s.n)) > EPS) [s.u, s.v] = directorsFor(s.n);
      s.mode = m;
      update();
    });
    const eP = vecEditor({ name: 'P_0', color: '#ffffff', dim: 3, get: () => s.P, set: (v) => { s.P = v; update(); } });
    const en = vecEditor({ name: R`\vec n`, color: C.j, dim: 3, get: () => s.n, set: (v) => { s.n = v; update(); } });
    const eu = vecEditor({ name: R`\vec u`, color: C.u, dim: 3, get: () => s.u, set: (v) => { s.u = v; update(); } });
    const ev = vecEditor({ name: R`\vec v`, color: C.v, dim: 3, get: () => s.v, set: (v) => { s.v = v; update(); } });
    const eQ = vecEditor({ name: 'Q', color: C.x2, dim: 3, get: () => s.Q, set: (v) => { s.Q = v; update(); } });
    const rowN = h('div', { class: 'row' }, eP.el, en.el);
    const rowD = h('div', { class: 'row' }, eu.el, ev.el);
    const cN = new TexBox(), cEq = new TexBox(), cVec = new TexBox(), cDist = new TexBox();
    const noteDef = new Note(), noteQ = new Note();

    panel.append(
      ...intro('Planos',
        R`Un plano queda determinado por un punto $P_0$ y una dirección perpendicular a él, el <b>vector normal</b> $\vec n$. Un punto $X$ está en el plano si $X - P_0$ es perpendicular a $\vec n$, es decir, si $\vec n\cdot(X - P_0) = 0$. También se puede definir con un punto y <b>dos vectores directores</b> no paralelos que «abren» el plano; su producto cruz da la normal.`),
      card('Definir el plano', mode.el, rowN, rowD, noteDef.el),
      card('Ecuaciones', cN.el, rich('<b>General</b> (o cartesiana): los coeficientes de $x$, $y$, $z$ son las componentes de $\\vec n$.'), cEq.el,
        rich('<b>Vectorial</b>: cada par $(s, t)$ da un punto del plano. En modo «normal» se muestran dos directores posibles (hay infinitos).'), cVec.el),
      card('Distancia de un punto al plano', eQ.el, cDist.el, noteQ.el),
      details('Definición formal',
        rich(R`Ecuación general: $ax + by + cz = d$, donde $\vec n = (a, b, c)\neq\vec 0$ y $d = \vec n\cdot\vec p_0$.`),
        rich(R`Ecuación vectorial: $X = P_0 + s\,\vec u + t\,\vec v$, con $s, t\in\mathbb{R}$ y $\vec u$, $\vec v$ no paralelos. Es el span de $\vec u$ y $\vec v$ desplazado hasta $P_0$.`),
        rich(R`Distancia de $Q$ al plano: $\dfrac{|\vec n\cdot Q - d|}{\|\vec n\|}$. El signo de $\vec n\cdot Q - d$ dice de qué lado del plano está $Q$.`)),
      tryList([
        R`Pon $\vec n = (0, 0, 1)$: el plano queda horizontal y su ecuación es $z = $ constante.`,
        R`Duplica $\vec n$: la ecuación se multiplica por 2, pero el plano es el mismo.`,
        R`En modo directores, haz $\vec v$ paralelo a $\vec u$: $\vec u\times\vec v = \vec 0$ y ya no definen un plano.`,
        R`Lleva $Q$ de un lado al otro del plano: el signo de $\vec n\cdot Q - d$ cambia.`,
      ]),
    );

    function update() {
      const n = N(), ok = norm(n) > EPS, k = dot(n, s.P);
      const dirs = !byNormal();
      plane.setVisible(ok);
      if (ok) plane.set(s.P, n);
      P0.set(s.P);
      lblP0.position.set(...s.P);
      lblQ.position.set(...s.Q);
      ua.setVisible(dirs).set(s.P, add(s.P, s.u));
      va.setVisible(dirs).set(s.P, add(s.P, s.v));
      na.set(s.P, add(s.P, n));

      rowN.style.display = dirs ? 'none' : '';
      rowD.style.display = dirs ? '' : 'none';
      if (dirs) rowD.prepend(eP.el); else rowN.prepend(eP.el);
      mode.refresh(); eP.refresh(); en.refresh(); eu.refresh(); ev.refresh(); eQ.refresh();

      if (!ok) {
        noteDef.set('neg', dirs
          ? R`$\vec u$ y $\vec v$ son paralelos (o alguno es cero): $\vec u\times\vec v = \vec 0$. Solo generan una recta, no un plano.`
          : R`$\vec n = \vec 0$ no indica ninguna dirección: no define un plano.`);
        [cN, cEq, cVec, cDist].forEach((c) => c.set(''));
        noteQ.set('', '');
        perp.setVisible(false); foot.setVisible(false);
        return;
      }
      noteDef.set('', dirs
        ? R`La normal (verde) se calcula como $\vec u\times\vec v$: es perpendicular a los dos directores y, por tanto, al plano.`
        : R`Arrastra la punta verde para inclinar el plano y la esfera blanca para moverlo. El plano siempre es perpendicular a $\vec n$.`);

      cN.set(dirs
        ? R`\vec n = \vec u\times\vec v = ${clr(C.u, tv(s.u))}\times${clr(C.v, tv(s.v))} = ${clr(C.j, tv(n))}`
        : R`\vec n = ${clr(C.j, tv(n))},\qquad P_0 = ${tv(s.P)}`);
      cEq.set(R`\vec n\cdot(X - P_0) = 0 \;\Rightarrow\; ${linform(n)} = ${fmt(k)}`);
      const [u, v] = dirs ? [s.u, s.v] : directorsFor(n);
      cVec.set(R`X = P_0 + s\,\vec u + t\,\vec v = ${tv(s.P)} + s\,${clr(C.u, tv(u))} + t\,${clr(C.v, tv(v))}`);

      const side = dot(n, s.Q) - k, dist = Math.abs(side) / norm(n);
      const F = sub(s.Q, scale(n, side / dot(n, n)));
      perp.setVisible(dist > 1e-6).set([s.Q, F]);
      foot.setVisible(dist > 1e-6).set(F);
      cDist.set(R`d(Q, \Pi) = \frac{|\vec n\cdot Q - d|}{\|\vec n\|} = \frac{|${fmt(dot(n, s.Q))} - ${fmt(k)}|}{${fmt(norm(n))}} = ${clr(C.x2, fmt(dist))}`);
      noteQ.set(dist < 1e-6 ? 'pos' : '', dist < 1e-6
        ? R`$Q$ <b>está en el plano</b>: cumple la ecuación.`
        : R`$\vec n\cdot Q - d = ${fmt(side)}$ es ${side > 0 ? '<b>positivo</b>: $Q$ está del lado hacia donde apunta $\\vec n$' : '<b>negativo</b>: $Q$ está del lado contrario a $\\vec n$'}. El punto blanco es su proyección sobre el plano.`);
    }

    update();
  },
};
