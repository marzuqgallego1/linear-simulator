import { Arrow, Polyline, Dot, C } from '../core/stage.js';
import { add, sub, scale, cross, norm, fmt, tv, clr, EPS, to3 } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { LineView, pointLine, affine, linform, shift, paramTex, dot } from '../core/geom.js';

const state = {
  2: { P: [1, 1], d: [2, 1], t: 1.5, Q: [-2, 3] },
  3: { P: [1, 1, 1], d: [2, 1, 1], t: 1.5, Q: [-1, 2, 3] },
};

export default {
  id: 'rectas',
  title: 'Rectas',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const O = Array(dim).fill(0);
    let stop = () => {};

    // --- escena ---
    const line = new LineView(stage, C.w);
    const pv = new Arrow(stage, C.u, { opacity: 0.35, radius: 0.02, label: R`\vec p_0` });
    const td = new Arrow(stage, C.x, { opacity: 0.5, radius: 0.028 });
    const da = new Arrow(stage, C.v, { label: R`\vec d` });
    const na = dim === 2 ? new Arrow(stage, C.j, { label: R`\vec n` }) : null;
    const perp = new Polyline(stage, '#ffffff', { opacity: 0.6, dashed: true, dash: 0.08 });
    const foot = new Dot(stage, '#ffffff', { radius: 0.06 });
    const Pt = new Dot(stage, C.x, { radius: 0.12 });
    const lblP0 = stage.addLabel('P_0', C.u);
    const lblPt = stage.addLabel('P(t)', C.x);
    const lblQ = stage.addLabel('Q', C.x2);

    stage.addHandle({ color: C.u, get: () => s.P, set: (p) => { s.P = p; update(); } });
    stage.addHandle({ color: C.v, get: () => add(s.P, s.d), set: (p) => { s.d = sub(p, s.P); update(); } });
    stage.addHandle({ color: C.x2, get: () => s.Q, set: (p) => { s.Q = p; update(); } });

    // --- panel ---
    const eP = vecEditor({ name: 'P_0', color: C.u, dim, get: () => s.P, set: (v) => { s.P = v; update(); } });
    const ed = vecEditor({ name: R`\vec d`, color: C.v, dim, get: () => s.d, set: (v) => { s.d = v; update(); } });
    const st = slider({ label: 't', min: -3, max: 3, step: 0.05, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const walk = () => { stop(); stop = animate(-3, 3, 3000, (t) => { s.t = t; update(); }); };
    const eQ = vecEditor({ name: 'Q', color: C.x2, dim, get: () => s.Q, set: (v) => { s.Q = v; update(); } });
    const cVec = new TexBox(), cPar = new TexBox(), cGen = new TexBox(), cAlt = new TexBox(), cPt = new TexBox();
    const cDist = new TexBox(), noteQ = new Note(), noteD = new Note();

    panel.append(
      ...intro('Rectas',
        R`Una recta queda determinada por <b>un punto</b> $P_0$ por donde pasa y <b>una dirección</b>, el <b>vector director</b> $\vec d$. El parámetro $t$ dice cuánto avanzas en esa dirección: cada valor de $t$ da un punto de la recta, $P(t) = P_0 + t\,\vec d$.`),
      card('Definir la recta', h('div', { class: 'row' }, eP.el, ed.el), noteD.el),
      card('Recorrer la recta', st.el, cPt.el, buttonRow(button('▶ Recorrer', walk, 'primary'))),
      card('Ecuaciones', rich('<b>Vectorial</b>'), cVec.el, rich('<b>Paramétricas</b> (una ecuación por coordenada)'), cPar.el,
        rich(dim === 2 ? R`<b>General</b>: los coeficientes de $x$ e $y$ forman un vector <b>normal</b> $\vec n$, perpendicular a la recta.` : '<b>Simétricas</b> (despejando $t$ en cada paramétrica)'),
        cGen.el, cAlt.el),
      card('Distancia de un punto a la recta', eQ.el, cDist.el, noteQ.el),
      details('Definición formal',
        rich(R`Ecuación vectorial: $\vec r(t) = \vec p_0 + t\,\vec d$, con $t\in\mathbb{R}$ y $\vec d\neq\vec 0$. Aquí $\vec p_0$ es el <b>vector de posición</b> del punto $P_0$ (la flecha del origen a $P_0$).`),
        rich(R`El vector director no es único: cualquier múltiplo $k\vec d$ con $k\neq 0$ describe la misma recta; solo cambia la «velocidad» con la que $t$ la recorre.`),
        dim === 2
          ? rich(R`Ecuación general: $ax + by = c$. El vector $(a, b)$ es normal a la recta, y $c = \vec n\cdot\vec p_0$. La distancia de $Q$ a la recta es $\dfrac{|\vec n\cdot Q - c|}{\|\vec n\|}$.`)
          : rich(R`En 3D una recta <b>no</b> tiene una sola ecuación $ax+by+cz=d$ (eso describe un plano). Por eso se usan las formas paramétrica o simétrica, o se escribe como intersección de dos planos. La distancia de $Q$ es $\dfrac{\|(Q-P_0)\times\vec d\|}{\|\vec d\|}$.`)),
      tryList([
        R`Duplica $\vec d$: la recta no cambia, pero $P(t)$ avanza el doble de rápido.`,
        R`Mueve $P_0$ a otro punto de la misma recta: las ecuaciones cambian, la recta no.`,
        R`Arrastra $Q$ (rosa) hasta que quede sobre la recta: la distancia se vuelve 0 y aparece su valor de $t$.`,
        dim === 2
          ? R`Pon $\vec d = (0, 1)$: la recta es vertical y no tiene pendiente, pero la ecuación general sigue funcionando.`
          : R`Gira la vista: en 3D hay infinitas direcciones perpendiculares a la recta, así que no tiene un único vector normal.`,
      ]),
    );

    function update() {
      const { P, d, t, Q } = s;
      const ok = norm(d) > EPS;
      const Pt_ = add(P, scale(d, t));
      line.set(P, d);
      pv.set(O, P);
      da.set(P, add(P, d));
      td.set(P, Pt_);
      Pt.setVisible(ok).set(Pt_);
      lblP0.position.set(...to3(P));
      lblPt.position.set(...to3(Pt_));
      lblPt.visible = ok && Math.abs(t) > 0.15;
      lblQ.position.set(...to3(Q));
      const n = dim === 2 ? [-d[1], d[0]] : null;
      if (na) na.set(P, add(P, n));

      eP.refresh(); ed.refresh(); st.refresh(); eQ.refresh();
      if (!ok) {
        noteD.set('neg', R`$\vec d = \vec 0$ no indica ninguna dirección: no define una recta.`);
        [cVec, cPar, cGen, cAlt, cPt, cDist].forEach((c) => c.set(''));
        noteQ.set('', '');
        perp.setVisible(false); foot.setVisible(false);
        return;
      }
      noteD.set('', R`La flecha naranja tenue es $\vec p_0$, el vector de posición de $P_0$. La recta son todos los puntos a los que llegas sumándole múltiplos de $\vec d$.`);

      cVec.set(R`\vec r(t) = \vec p_0 + t\,\vec d = ${clr(C.u, tv(P))} + t\,${clr(C.v, tv(d))}`);
      cPar.set(paramTex(P, d));
      cPt.set(R`P(${fmt(t)}) = ${clr(C.u, tv(P))} + ${fmt(t)}\,${clr(C.v, tv(d))} = ${clr(C.x, tv(Pt_))}`);

      if (dim === 2) {
        const c = dot(n, P);
        cGen.set(R`\vec n = (-d_2,\ d_1) = ${clr(C.j, tv(n))} \;\Rightarrow\; ${linform(n)} = ${fmt(c)}`);
        cAlt.set(Math.abs(d[0]) > EPS
          ? R`\text{Pendiente: } m = \frac{d_2}{d_1} = ${fmt(d[1] / d[0])} \;\Rightarrow\; y = ${affine(P[1] - (d[1] / d[0]) * P[0], d[1] / d[0], 'x')}`
          : R`\text{Recta vertical: } x = ${fmt(P[0])}\ \text{(no tiene pendiente)}`);
      } else {
        const vars = ['x', 'y', 'z'];
        const frac = [], fixed = [];
        d.forEach((di, i) => {
          if (Math.abs(di) > EPS) frac.push(R`\frac{${shift(vars[i], P[i])}}{${fmt(di)}}`);
          else fixed.push(`${vars[i]} = ${fmt(P[i])}`);
        });
        cGen.set(frac.length > 1 ? frac.join(' = ') : R`\text{(con una sola componente no nula no hay forma simétrica)}`);
        cAlt.set(fixed.length ? fixed.join(',\\quad ') + R`\quad\text{(componente de }\vec d\text{ nula)}` : '');
      }

      const { t: tF, F, dist } = pointLine(Q, P, d);
      perp.setVisible(dist > 1e-6).set([Q, F]);
      foot.setVisible(dist > 1e-6).set(F);
      const QP = sub(Q, P);
      cDist.set(dim === 2
        ? R`d(Q, \ell) = \frac{|\vec n\cdot(Q - P_0)|}{\|\vec n\|} = \frac{|${fmt(dot(n, QP))}|}{${fmt(norm(n))}} = ${clr(C.x2, fmt(dist))}`
        : R`d(Q, \ell) = \frac{\|(Q - P_0)\times\vec d\|}{\|\vec d\|} = \frac{${fmt(norm(cross(QP, d)))}}{${fmt(norm(d))}} = ${clr(C.x2, fmt(dist))}`);
      noteQ.set(dist < 1e-6 ? 'pos' : '', dist < 1e-6
        ? R`$Q$ <b>está en la recta</b>: corresponde a $t = ${fmt(tF)}$.`
        : R`$Q$ no está en la recta. El punto blanco es el <b>pie de la perpendicular</b>, el punto de la recta más cercano a $Q$ ($t = ${fmt(tF)}$).`);
    }

    update();
    return { destroy: () => stop() };
  },
};
