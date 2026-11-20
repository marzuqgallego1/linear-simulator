import { Arrow, Quad, C } from '../core/stage.js';
import { add, scale, dot, cross, norm, clamp, deg, fmt, pf, tv, clr, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, TexBox, Note, rich, button, buttonRow } from '../core/ui.js';
import { setLabel } from '../core/stage.js';

const s = { u: [2, 0, 0.5], v: [0.5, 2, 0] };

export default {
  id: 'cruz',
  title: 'Producto cruz',
  dims: [3],

  mount({ stage, panel }) {
    const O = [0, 0, 0];

    // --- escena ---
    const par = new Quad(stage, C.w, { opacity: 0.22, edgeOpacity: 0.6 });
    const areaLbl = stage.addLabel('', C.w, 'badge');
    const ua = new Arrow(stage, C.u, { label: R`\vec{u}` });
    const va = new Arrow(stage, C.v, { label: R`\vec{v}` });
    const wa = new Arrow(stage, C.x, { label: R`\vec u\times\vec v`, radius: 0.045 });
    stage.addHandle({ color: C.u, get: () => s.u, set: (p) => { s.u = p; update(); } });
    stage.addHandle({ color: C.v, get: () => s.v, set: (p) => { s.v = p; update(); } });

    // --- panel ---
    const eu = vecEditor({ name: R`\vec{u}`, color: C.u, dim: 3, get: () => s.u, set: (v) => { s.u = v; update(); } });
    const ev = vecEditor({ name: R`\vec{v}`, color: C.v, dim: 3, get: () => s.v, set: (v) => { s.v = v; update(); } });
    const swap = () => { [s.u, s.v] = [s.v, s.u]; update(); };
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox();
    const note = new Note();

    panel.append(
      ...intro('Producto cruz',
        R`El producto cruz toma dos vectores de 3D y devuelve <b>otro vector</b>, perpendicular a ambos. Su <b>longitud</b> es el área del paralelogramo que forman, y su <b>sentido</b> lo da la regla de la mano derecha.`),
      card('Vectores', h('div', { class: 'row' }, eu.el, ev.el), buttonRow(button('Intercambiar u y v', swap))),
      card('Lo que estás viendo', c1.el, c2.el, note.el, c3.el),
      card('Regla de la mano derecha',
        rich(R`Apunta los dedos de tu mano derecha en la dirección de $\vec u$ y dóblalos hacia $\vec v$: el pulgar señala hacia donde va $\vec u\times\vec v$. Por eso el orden importa: $\vec v\times\vec u = -(\vec u\times\vec v)$.`)),
      details('Definición formal',
        rich(R`$\vec u\times\vec v = \begin{vmatrix}\hat\imath&\hat\jmath&\hat k\\u_1&u_2&u_3\\v_1&v_2&v_3\end{vmatrix} = (u_2v_3-u_3v_2,\; u_3v_1-u_1v_3,\; u_1v_2-u_2v_1)$`),
        rich(R`$\|\vec u\times\vec v\| = \|\vec u\|\,\|\vec v\|\sin\theta$: es máximo cuando son perpendiculares y cero cuando son paralelos.`),
        rich(R`Es <b>anticonmutativo</b> ($\vec u\times\vec v=-\vec v\times\vec u$) y solo existe así en $\mathbb{R}^3$.`)),
      tryList([
        'Pulsa «Intercambiar»: el resultado apunta exactamente al lado contrario.',
        R`Haz $\vec v$ paralelo a $\vec u$ (por ejemplo, $\vec v = (4, 0, 1)$): el paralelogramo se aplasta y el producto cruz es $\vec 0$.`,
        R`Pon $\vec u$ y $\vec v$ en el plano del suelo ($z = 0$): el resultado apunta justo sobre el eje $z$.`,
      ]),
    );

    function update() {
      const { u, v } = s;
      const w = cross(u, v), A = norm(w), nu = norm(u), nv = norm(v);
      ua.set(O, u);
      va.set(O, v);
      wa.set(O, w);
      par.set(O, u, add(u, v), v);
      areaLbl.position.set(...scale(add(u, v), 0.5));
      setLabel(areaLbl, R`\text{Área} = ${fmt(A)}`);

      eu.refresh(); ev.refresh();
      const row = (a, b, c, d) => `${pf(a)}\\cdot${pf(b)}-${pf(c)}\\cdot${pf(d)}`;
      c1.set(R`\vec u\times\vec v = \begin{bmatrix}${row(u[1], v[2], u[2], v[1])}\\${row(u[2], v[0], u[0], v[2])}\\${row(u[0], v[1], u[1], v[0])}\end{bmatrix} = ${clr(C.x, tv(w))}`);
      c2.set(R`\|\vec u\times\vec v\| = ${clr(C.w, fmt(A))} = \text{área del paralelogramo}`);

      if (A > EPS) {
        const theta = Math.acos(clamp(dot(u, v) / (nu * nv), -1, 1));
        note.set('pos', R`El resultado es <b>perpendicular</b> a los dos: $(\vec u\times\vec v)\cdot\vec u = ${fmt(dot(w, u))}$ y $(\vec u\times\vec v)\cdot\vec v = ${fmt(dot(w, v))}$.`);
        c3.set(R`\|\vec u\|\,\|\vec v\|\sin\theta = ${fmt(nu)}\cdot${fmt(nv)}\cdot\sin(${fmt(deg(theta), 1)}^\circ) = ${fmt(nu * nv * Math.sin(theta))}`);
      } else {
        note.set('zero', R`$\vec u\times\vec v = \vec 0$: los vectores son <b>paralelos</b> (o alguno es cero). No forman un paralelogramo con área, y no hay una única dirección perpendicular a ambos.`);
        c3.set('');
      }
    }

    update();
  },
};
