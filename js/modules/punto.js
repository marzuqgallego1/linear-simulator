import { Arrow, Polyline, C } from '../core/stage.js';
import { add, sub, scale, dot, norm, normalize, perpendicular, clamp, deg, fmt, pf, tv, clr, EPS, to3 } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, TexBox, Note, rich } from '../core/ui.js';

const state = {
  2: { u: [3, 1], v: [1, 2] },
  3: { u: [3, 0, 1], v: [1, 2, 2] },
};

export default {
  id: 'punto',
  title: 'Producto punto',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const O = Array(dim).fill(0);

    // --- escena ---
    const uLine = new Polyline(stage, C.u, { opacity: 0.35, dashed: true, dash: 0.15 });
    const perp = new Polyline(stage, '#ffffff', { opacity: 0.6, dashed: true, dash: 0.08 });
    const arc = new Polyline(stage, '#ffffff', { opacity: 0.85 });
    const thetaLbl = stage.addLabel(R`\theta`, '#ffffff', 'label small');
    const proj = new Arrow(stage, C.w, { radius: 0.055, label: R`\text{proj}_{\vec u}\vec v` });
    const ua = new Arrow(stage, C.u, { label: R`\vec{u}` });
    const va = new Arrow(stage, C.v, { label: R`\vec{v}` });
    stage.addHandle({ color: C.u, get: () => s.u, set: (p) => { s.u = p; update(); } });
    stage.addHandle({ color: C.v, get: () => s.v, set: (p) => { s.v = p; update(); } });

    // --- panel ---
    const eu = vecEditor({ name: R`\vec{u}`, color: C.u, dim, get: () => s.u, set: (v) => { s.u = v; update(); } });
    const ev = vecEditor({ name: R`\vec{v}`, color: C.v, dim, get: () => s.v, set: (v) => { s.v = v; update(); } });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox();
    const note = new Note();

    panel.append(
      ...intro('Producto punto',
        R`El producto punto mide <b>cuánto apunta un vector en la dirección de otro</b>. Proyecta $\vec v$ sobre la recta de $\vec u$ (la "sombra" amarilla): el producto punto es la longitud de esa sombra multiplicada por la longitud de $\vec u$. El resultado es un <b>número</b>, no un vector.`),
      card('Vectores', h('div', { class: 'row' }, eu.el, ev.el)),
      card('Lo que estás viendo', c1.el, note.el, c2.el, c3.el),
      details('Definición formal',
        rich(R`$\vec u\cdot\vec v = \sum_i u_i v_i = \|\vec u\|\,\|\vec v\|\cos\theta$, donde $\theta$ es el ángulo entre ambos.`),
        rich(R`Propiedades: es conmutativo ($\vec u\cdot\vec v=\vec v\cdot\vec u$), $\vec u\cdot\vec u = \|\vec u\|^2$, y $\vec u\cdot\vec v = 0$ si y solo si son <b>ortogonales</b> (perpendiculares).`),
        rich(R`Proyección: $\text{proj}_{\vec u}\vec v = \dfrac{\vec u\cdot\vec v}{\|\vec u\|^2}\,\vec u$.`)),
      tryList([
        dim === 2
          ? R`Pon $\vec v = (-1, 3)$: queda perpendicular a $\vec u=(3,1)$ y el producto punto da 0.`
          : R`Pon $\vec v = (0, 1, 0)$: queda perpendicular a $\vec u=(3,0,1)$ y el producto punto da 0.`,
        R`Gira $\vec v$ alrededor del origen: el signo cambia justo al cruzar los 90°.`,
        R`Alarga $\vec u$ al doble: el producto punto se duplica, pero la proyección (la sombra) no cambia.`,
      ]),
    );

    function update() {
      const u = s.u, v = s.v;
      const d = dot(u, v), nu = norm(u), nv = norm(v);
      ua.set(O, u);
      va.set(O, v);

      const okU = nu > EPS, ok = okU && nv > EPS;
      const P = okU ? scale(u, d / (nu * nu)) : O;
      uLine.setVisible(okU);
      if (okU) uLine.set([scale(u, -40 / nu), scale(u, 40 / nu)]);
      proj.set(O, P);
      perp.setVisible(okU && norm(sub(v, P)) > 1e-6);
      if (okU) perp.set([v, P]);

      // arco del ángulo
      const theta = ok ? Math.acos(clamp(d / (nu * nv), -1, 1)) : 0;
      arc.setVisible(ok && theta > 1e-3);
      thetaLbl.visible = ok && theta > 0.08;
      if (ok) {
        const e1 = scale(u, 1 / nu);
        let e2 = sub(v, scale(e1, dot(v, e1)));
        e2 = norm(e2) > 1e-9 ? normalize(e2) : perpendicular(e1);
        const r = Math.min(0.9, 0.35 * Math.min(nu, nv));
        const at = (phi, rr) => add(scale(e1, rr * Math.cos(phi)), scale(e2, rr * Math.sin(phi)));
        arc.set(Array.from({ length: 41 }, (_, k) => at((theta * k) / 40, r)));
        thetaLbl.position.set(...to3(at(theta / 2, r + 0.3)));
      }

      eu.refresh(); ev.refresh();
      const sign = d > EPS ? 'pos' : d < -EPS ? 'neg' : 'zero';
      const sc = { pos: C.j, neg: C.i, zero: C.w }[sign];
      const idx = u.map((_, i) => `u_${i + 1}v_${i + 1}`).join('+');
      const nums = u.map((x, i) => `${pf(x)}\\cdot${pf(v[i])}`).join('+');
      c1.set(R`\vec u\cdot\vec v = ${idx} = ${nums} = ${clr(sc, fmt(d))}`);

      note.set(sign, {
        pos: R`<b>Positivo</b>: $\vec v$ tiene una parte en la <b>misma</b> dirección que $\vec u$ (ángulo menor de 90°).`,
        neg: R`<b>Negativo</b>: $\vec v$ apunta en parte en la dirección <b>opuesta</b> a $\vec u$ (ángulo mayor de 90°). La sombra cae hacia atrás.`,
        zero: R`<b>Cero</b>: los vectores son <b>perpendiculares</b>. $\vec v$ no tiene nada en la dirección de $\vec u$: su sombra es un punto.`,
      }[sign]);

      if (ok) {
        const cos = d / (nu * nv);
        c2.set(R`\cos\theta = \frac{\vec u\cdot\vec v}{\|\vec u\|\,\|\vec v\|} = \frac{${fmt(d)}}{${fmt(nu)}\cdot${fmt(nv)}} = ${fmt(cos, 3)}\;\Rightarrow\;\theta = ${fmt(deg(theta), 1)}^\circ`);
        c3.set(R`\text{proj}_{\vec u}\vec v = \frac{\vec u\cdot\vec v}{\|\vec u\|^2}\,\vec u = \frac{${fmt(d)}}{${fmt(nu * nu)}}${clr(C.u, tv(u))} = ${clr(C.w, tv(P))}`);
      } else {
        c2.set(R`\text{Con un vector nulo el ángulo no está definido.}`);
        c3.set('');
      }
    }

    update();
  },
};
