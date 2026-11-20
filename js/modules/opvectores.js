import { Arrow, Polyline, Dot, C, setLabel } from '../core/stage.js';
import { add, sub, scale, norm, fmt, pf, tv, clr, EPS, to3 } from '../core/math.js';
import { R, h, card, details, tryList, vecEditor, slider, chips, TexBox, Note, rich, setRich } from '../core/ui.js';

const MODES = [['suma', 'Suma'], ['resta', 'Resta'], ['escalar', 'Por un escalar'], ['norma', 'Norma y unitario'], ['distancia', 'Distancia']];

const state = {
  2: { mode: 'suma', u: [3, 1], v: [1, 2], k: 2, P: [-2, -1], Q: [2, 2] },
  3: { mode: 'suma', u: [2, 1, 1], v: [0, 2, 1], k: 2, P: [-1, -1, 0], Q: [2, 1, 2] },
};

const LEAD = {
  suma: R`Para sumar dos vectores se pone uno a continuación del otro (<b>punta con cola</b>): la suma va del origen a la punta final. Si los pones en el otro orden llegas al mismo sitio: se forma un <b>paralelogramo</b> y la suma es su diagonal. En coordenadas, se suma componente a componente.`,
  resta: R`$\vec u - \vec v$ es el vector que hay que sumarle a $\vec v$ para llegar a $\vec u$: la flecha que va de la <b>punta de</b> $\vec v$ a la <b>punta de</b> $\vec u$. También es $\vec u + (-\vec v)$. Por eso la resta sirve para ir de un punto a otro.`,
  escalar: R`Multiplicar por un número $k$ (un <b>escalar</b>) estira o encoge el vector sin sacarlo de su recta. Si $k$ es negativo, además le da la vuelta.`,
  norma: R`La <b>norma</b> $\|\vec u\|$ es la longitud de la flecha. Sale del teorema de Pitágoras: las componentes son los catetos. Dividir un vector por su norma da el <b>vector unitario</b> $\hat u$: misma dirección, longitud 1.`,
  distancia: R`La distancia entre dos puntos es la longitud del vector que va de uno a otro: $d(P, Q) = \|Q - P\|$. Combina la resta y la norma.`,
};

export default {
  id: 'opvectores',
  title: 'Operaciones con vectores',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const O = Array(dim).fill(0);
    const is = (...m) => m.includes(s.mode);

    // --- escena ---
    const unit = dim === 2 ? new Polyline(stage, '#ffffff', { opacity: 0.3, dashed: true, dash: 0.08 }) : null;
    unit?.set(Array.from({ length: 97 }, (_, k) => [Math.cos((k * Math.PI) / 48), Math.sin((k * Math.PI) / 48)]));
    const legs = new Polyline(stage, '#ffffff', { opacity: 0.7, dashed: true, dash: 0.1 });
    const ghostV = new Arrow(stage, C.v, { opacity: 0.4, radius: 0.025 });
    const ghostU = new Arrow(stage, C.u, { opacity: 0.4, radius: 0.025 });
    const negV = new Arrow(stage, C.v, { opacity: 0.4, radius: 0.025, label: R`-\vec v` });
    const resO = new Arrow(stage, C.w, { opacity: 0.35, radius: 0.025 });
    const ua = new Arrow(stage, C.u, { label: R`\vec u` });
    const va = new Arrow(stage, C.v, { label: R`\vec v` });
    const res = new Arrow(stage, C.w, { radius: 0.05 });
    const dP = new Dot(stage, C.u, { radius: 0.1 }), dQ = new Dot(stage, C.v, { radius: 0.1 });
    const lP = stage.addLabel('P', C.u), lQ = stage.addLabel('Q', C.v);
    const badge = stage.addLabel('', C.w, 'badge');

    stage.addHandle({ color: C.u, visible: () => !is('distancia'), get: () => s.u, set: (p) => { s.u = p; update(); } });
    stage.addHandle({ color: C.v, visible: () => is('suma', 'resta'), get: () => s.v, set: (p) => { s.v = p; update(); } });
    stage.addHandle({ color: C.u, visible: () => is('distancia'), get: () => s.P, set: (p) => { s.P = p; update(); } });
    stage.addHandle({ color: C.v, visible: () => is('distancia'), get: () => s.Q, set: (p) => { s.Q = p; update(); } });

    // --- panel ---
    const mode = chips(MODES, () => s.mode, (m) => { s.mode = m; update(); });
    const lead = rich('', 'p', 'lead');
    const ed = (name, color, key) => vecEditor({ name, color, dim, get: () => s[key], set: (v) => { s[key] = v; update(); } });
    const eu = ed(R`\vec u`, C.u, 'u'), ev = ed(R`\vec v`, C.v, 'v'), eP = ed('P', C.u, 'P'), eQ = ed('Q', C.v, 'Q');
    const sk = slider({ label: 'k', min: -3, max: 3, step: 0.1, get: () => s.k, set: (k) => { s.k = k; update(); } });
    const rowUV = h('div', { class: 'row' }, eu.el, ev.el), rowPQ = h('div', { class: 'row' }, eP.el, eQ.el);
    const c1 = new TexBox(), c2 = new TexBox(), note = new Note();

    panel.append(
      h('h2', {}, 'Operaciones con vectores'),
      card('Operación', mode.el), lead,
      card('Datos', rowUV, rowPQ, sk.el),
      card('Cálculo', c1.el, c2.el, note.el),
      details('Definición formal',
        rich(R`Con $\vec u = (u_1,\dots,u_n)$ y $\vec v = (v_1,\dots,v_n)$: $\vec u \pm \vec v = (u_1 \pm v_1,\dots,u_n \pm v_n)$ y $k\vec u = (ku_1,\dots,ku_n)$.`),
        rich(R`Norma: $\|\vec u\| = \sqrt{u_1^2+\dots+u_n^2} = \sqrt{\vec u\cdot\vec u}$. Vector unitario: $\hat u = \vec u/\|\vec u\|$ (solo si $\vec u\neq\vec 0$).`),
        rich(R`Propiedades: la suma es conmutativa y asociativa, $\|k\vec u\| = |k|\,\|\vec u\|$, y la <b>desigualdad triangular</b> $\|\vec u+\vec v\| \le \|\vec u\| + \|\vec v\|$: el camino directo nunca es más largo.`)),
      tryList([
        'En «Suma», compara las dos rutas punta con cola: llegan al mismo punto.',
        R`En «Resta», arrastra $\vec v$ hasta que coincida con $\vec u$: la diferencia es $\vec 0$.`,
        R`En «Por un escalar», pasa $k$ por 0: el vector se encoge hasta desaparecer y luego sale al revés.`,
        R`En «Norma», pon $\vec u = (3, 4)$: su longitud es exactamente 5, el clásico triángulo 3-4-5.`,
      ]),
    );

    function update() {
      const { u, v, k, P, Q } = s;
      [ghostV, ghostU, negV, resO, va, res].forEach((a) => a.setVisible(false));
      ua.setVisible(!is('distancia'));
      legs.setVisible(false);
      unit?.setVisible(is('norma'));
      [dP, dQ].forEach((d) => d.setVisible(is('distancia')));
      lP.visible = lQ.visible = is('distancia');
      badge.visible = false;
      ua.set(O, u);
      rowUV.style.display = is('distancia') ? 'none' : '';
      ev.el.style.display = is('suma', 'resta') ? '' : 'none';
      rowPQ.style.display = is('distancia') ? '' : 'none';
      sk.el.style.display = is('escalar') ? '' : 'none';
      [mode, eu, ev, eP, eQ, sk].forEach((c) => c.refresh());
      const L = LEAD[s.mode];
      if (lead.dataset.src !== L) { lead.dataset.src = L; setRich(lead, L); }

      const comp = (a, b, op) => R`\begin{bmatrix}${a.map((x, i) => `${pf(x)} ${op} ${pf(b[i])}`).join('\\\\')}\end{bmatrix}`;

      if (s.mode === 'suma') {
        const w = add(u, v);
        va.setVisible(true).set(O, v);
        ghostV.setVisible(true).set(u, w);
        ghostU.setVisible(true).set(v, w);
        res.setVisible(true).set(O, w).setLabel(R`\vec u + \vec v`);
        c1.set(R`\vec u + \vec v = ${clr(C.u, tv(u))} + ${clr(C.v, tv(v))} = ${comp(u, v, '+')} = ${clr(C.w, tv(w))}`);
        c2.set(R`\|\vec u + \vec v\| = ${fmt(norm(w))} \;\le\; \|\vec u\| + \|\vec v\| = ${fmt(norm(u))} + ${fmt(norm(v))} = ${fmt(norm(u) + norm(v))}`);
        note.set('', R`Las flechas tenues son las dos rutas punta con cola: $\vec u$ luego $\vec v$, o $\vec v$ luego $\vec u$. Las dos llegan a la punta de $\vec u + \vec v$. La desigualdad de abajo dice que ir directo es más corto (o igual).`);
      } else if (s.mode === 'resta') {
        const w = sub(u, v);
        va.setVisible(true).set(O, v);
        negV.setVisible(true).set(O, scale(v, -1));
        resO.setVisible(true).set(O, w);
        res.setVisible(true).set(v, u).setLabel(R`\vec u - \vec v`);
        c1.set(R`\vec u - \vec v = ${clr(C.u, tv(u))} - ${clr(C.v, tv(v))} = ${comp(u, v, '-')} = ${clr(C.w, tv(w))}`);
        c2.set('');
        note.set('', R`La flecha amarilla va de la punta de $\vec v$ a la de $\vec u$. La tenue desde el origen es el mismo vector: $\vec u + (-\vec v)$. Un vector no depende de dónde lo dibujes, solo de su dirección y longitud.`);
      } else if (s.mode === 'escalar') {
        const w = scale(u, k);
        res.setVisible(true).set(O, w).setLabel(R`${fmt(k)}\vec u`);
        c1.set(R`k\vec u = ${fmt(k)}${clr(C.u, tv(u))} = ${clr(C.w, tv(w))}`);
        c2.set(R`\|k\vec u\| = |k|\,\|\vec u\| = ${fmt(Math.abs(k))}\cdot${fmt(norm(u))} = ${fmt(norm(w))}`);
        const kind = Math.abs(k) < EPS ? ['zero', 'Con $k = 0$ el resultado es el vector cero: se pierde la dirección.']
          : k < 0 ? ['neg', `Con $k < 0$ el vector se <b>invierte</b> (apunta al lado contrario) y su longitud se multiplica por $|k| = ${fmt(Math.abs(k))}$.`]
            : Math.abs(k) > 1 ? ['pos', 'Con $k > 1$ el vector se <b>estira</b> sin cambiar de dirección.']
              : ['pos', 'Con $0 < k < 1$ el vector se <b>encoge</b> sin cambiar de dirección.'];
        note.set(...kind);
      } else if (s.mode === 'norma') {
        const nu = norm(u);
        const steps = dim === 2 ? [O, [u[0], 0], u] : [O, [u[0], 0, 0], [u[0], u[1], 0], u];
        legs.setVisible(true).set(steps);
        if (nu > EPS) res.setVisible(true).set(O, scale(u, 1 / nu)).setLabel(R`\hat u`);
        const sq = u.map((x) => `${pf(x)}^2`).join(' + ');
        c1.set(R`\|\vec u\| = \sqrt{${u.map((_, i) => `u_${i + 1}^2`).join(' + ')}} = \sqrt{${sq}} = \sqrt{${fmt(nu * nu)}} = ${clr(C.u, fmt(nu))}`);
        c2.set(nu > EPS ? R`\hat u = \frac{\vec u}{\|\vec u\|} = \frac{1}{${fmt(nu)}}${clr(C.u, tv(u))} = ${clr(C.w, tv(scale(u, 1 / nu)))}` : '');
        note.set(nu > EPS ? '' : 'neg', nu > EPS
          ? (dim === 2
            ? 'Las líneas punteadas son los catetos ($u_1$ en horizontal, $u_2$ en vertical): Pitágoras da la hipotenusa. El vector unitario cae siempre sobre la circunferencia de radio 1.'
            : 'Las líneas punteadas recorren $u_1$, $u_2$ y $u_3$ por separado: Pitágoras se aplica dos veces (primero en el suelo, luego hacia arriba).')
          : 'El vector cero tiene norma 0 y no tiene vector unitario: no apunta a ningún lado.');
      } else {
        const w = sub(Q, P), d = norm(w);
        dP.set(P); dQ.set(Q);
        lP.position.set(...to3(P)); lQ.position.set(...to3(Q));
        res.setVisible(true).set(P, Q).setLabel(R`Q - P`);
        badge.visible = d > EPS;
        badge.position.set(...to3(scale(add(P, Q), 0.5)));
        setLabel(badge, R`d = ${fmt(d)}`);
        c1.set(R`Q - P = ${clr(C.v, tv(Q))} - ${clr(C.u, tv(P))} = ${clr(C.w, tv(w))}`);
        c2.set(R`d(P, Q) = \|Q - P\| = \sqrt{${w.map((x) => `${pf(x)}^2`).join(' + ')}} = ${clr(C.w, fmt(d))}`);
        note.set('', 'Primero se resta (para obtener el vector que va de $P$ a $Q$) y luego se mide su longitud. El orden de la resta cambia el sentido de la flecha, pero no la distancia.');
      }
    }

    update();
  },
};
