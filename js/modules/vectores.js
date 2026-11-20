import { Arrow, Polyline, Quad, C } from '../core/stage.js';
import { add, scale, sub, dot, cross, norm, normalize, det, fmt, tv, clr, combo, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, slider, TexBox, Note, rich } from '../core/ui.js';

const state = {
  2: { u: [2, 1], v: [-1, 2], a: 1, b: 1 },
  3: { u: [2, 0, 1], v: [0, 2, 1], a: 1, b: 1 },
};

export default {
  id: 'vectores',
  title: 'Vectores y combinación lineal',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const O = Array(dim).fill(0);
    const w = () => add(scale(s.u, s.a), scale(s.v, s.b));
    const independent = () =>
      dim === 2 ? Math.abs(det([s.u, s.v])) > EPS : norm(cross(s.u, s.v)) > EPS;

    // --- escena ---
    const spanFill = new Quad(stage, C.w, { opacity: dim === 2 ? 0.05 : 0.13, edgeOpacity: dim === 2 ? 0 : 0.35 });
    const spanLine = new Polyline(stage, C.w, { opacity: 0.55 });
    const au = new Arrow(stage, C.u, { opacity: 0.4, radius: 0.025 });
    const bv = new Arrow(stage, C.v, { opacity: 0.4, radius: 0.025 });
    const ua = new Arrow(stage, C.u, { label: R`\vec{u}` });
    const va = new Arrow(stage, C.v, { label: R`\vec{v}` });
    const wa = new Arrow(stage, C.w, { label: R`\vec{w}`, radius: 0.045 });

    stage.addHandle({ color: C.u, get: () => s.u, set: (p) => { s.u = p; update(); } });
    stage.addHandle({ color: C.v, get: () => s.v, set: (p) => { s.v = p; update(); } });
    if (dim === 2) {
      // Arrastrar w: resolvemos a·u + b·v = w (regla de Cramer)
      stage.addHandle({
        color: C.w, get: w, visible: independent,
        set: (p) => {
          const D = det([s.u, s.v]);
          s.a = (p[0] * s.v[1] - p[1] * s.v[0]) / D;
          s.b = (s.u[0] * p[1] - s.u[1] * p[0]) / D;
          update();
        },
      });
    }

    // --- panel ---
    const eu = vecEditor({ name: R`\vec{u}`, color: C.u, dim, get: () => s.u, set: (v) => { s.u = v; update(); } });
    const ev = vecEditor({ name: R`\vec{v}`, color: C.v, dim, get: () => s.v, set: (v) => { s.v = v; update(); } });
    const sa = slider({ label: 'a', min: -3, max: 3, step: 0.1, get: () => s.a, set: (x) => { s.a = x; update(); } });
    const sb = slider({ label: 'b', min: -3, max: 3, step: 0.1, get: () => s.b, set: (x) => { s.b = x; update(); } });
    const calc = new TexBox();
    const note = new Note();

    panel.append(
      ...intro('Vectores y combinación lineal',
        'Un <b>vector</b> es una flecha con dirección y longitud. Hacer una <b>combinación lineal</b> es estirar cada vector (multiplicarlo por un número) y luego sumarlos poniendo uno a continuación del otro.'),
      card('Vectores', h('div', { class: 'row' }, eu.el, ev.el)),
      card('Coeficientes', sa.el, sb.el),
      card('Lo que estás viendo', calc.el, note.el),
      details('Definición formal',
        rich(R`Dados vectores $\vec v_1,\dots,\vec v_k$ y escalares $c_1,\dots,c_k\in\mathbb{R}$, su <b>combinación lineal</b> es $c_1\vec v_1+\dots+c_k\vec v_k$.`),
        rich(R`El <b>span</b> (espacio generado) es el conjunto de <i>todas</i> sus combinaciones lineales.`),
        rich(R`Los vectores son <b>linealmente independientes</b> si la única forma de obtener $\vec 0$ es con todos los $c_i = 0$. Intuitivamente: ninguno sobra, cada uno aporta una dirección nueva.`)),
      tryList([
        'Pon $a$ o $b$ en valores negativos: esa parte de la flecha se invierte.',
        dim === 2
          ? R`Arrastra $\vec v$ hasta $(4, 2)$, sobre la misma recta que $\vec u$. ¿Qué pasa con el span?`
          : R`Arrastra $\vec v$ hasta que sea paralelo a $\vec u$ (por ejemplo, $(4,0,2)$): el plano se reduce a una recta.`,
        dim === 2
          ? R`Arrastra la punta amarilla $\vec w$ a cualquier sitio: si $\vec u$ y $\vec v$ son independientes, siempre existen $a$ y $b$ que llegan ahí.`
          : R`Gira la vista: el plano siempre contiene a $\vec u$, $\vec v$ y $\vec w$. Con solo dos vectores no puedes salir de él.`,
      ]),
    );

    function update() {
      const W = w(), A = scale(s.u, s.a);
      ua.set(O, s.u);
      va.set(O, s.v);
      au.set(O, A);
      bv.set(A, W);
      wa.set(O, W);

      // span
      const L = dim === 2 ? 40 : 5;
      const indep = independent();
      const dir = norm(s.u) > EPS ? s.u : s.v;
      spanFill.setVisible(indep);
      spanLine.setVisible(!indep && norm(dir) > EPS);
      if (indep) {
        if (dim === 2) spanFill.set([-L, -L], [L, -L], [L, L], [-L, L]);
        else {
          const e1 = normalize(s.u);
          const e2 = normalize(sub(s.v, scale(e1, dot(s.v, e1))));
          const P = (x, y) => add(scale(e1, x * L), scale(e2, y * L));
          spanFill.set(P(1, 1), P(-1, 1), P(-1, -1), P(1, -1));
        }
      } else if (norm(dir) > EPS) {
        const d = normalize(dir);
        spanLine.set([scale(d, -L), scale(d, L)]);
      }

      eu.refresh(); ev.refresh(); sa.refresh(); sb.refresh();
      calc.set(R`${clr(C.w, R`\vec w`)} = a${clr(C.u, R`\vec u`)} + b${clr(C.v, R`\vec v`)} = ` +
        combo([[s.a, clr(C.u, tv(s.u))], [s.b, clr(C.v, tv(s.v))]]) + ` = ${clr(C.w, tv(W))}`);

      if (indep && dim === 2)
        note.set('pos', R`$\vec u$ y $\vec v$ apuntan en direcciones distintas: son <b>linealmente independientes</b>. Combinándolos llegas a <b>cualquier punto del plano</b>: su span es todo $\mathbb{R}^2$ (zona sombreada).`);
      else if (indep)
        note.set('pos', R`Son <b>linealmente independientes</b>: su span es un <b>plano</b> que pasa por el origen. Para llenar todo el espacio 3D haría falta un tercer vector fuera de ese plano.`);
      else if (norm(dir) > EPS)
        note.set('zero', R`Son <b>linealmente dependientes</b>: uno es múltiplo del otro, así que no aportan direcciones distintas. Solo alcanzas los puntos de una <b>recta</b>.`);
      else note.set('neg', 'Ambos son el vector cero: el span es solo el origen.');
    }

    update();
  },
};
