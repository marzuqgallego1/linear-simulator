import { Arrow, Dot, Rod, C, setLabel } from '../core/stage.js';
import { add, sub, scale, cross, dot, norm, fmt, tv, clr, EPS, to3 } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, chips, TexBox, Note, rich } from '../core/ui.js';
import { LineView, PlaneView, closestLineLine, pointLine, linform, affine } from '../core/geom.js';

const state = {
  2: { mode: 'rr', P1: [-2, -1], d1: [2, 1], P2: [1, -2], d2: [-1, 2] },
  3: {
    mode: 'rr',
    P1: [-2, -1, 0], d1: [2, 1, 1], P2: [1, -2, 0], d2: [-1, 2, 1],
    A: [0, 0, 1], n1: [0, 0, 1], B: [0, 0, 0], n2: [1, 0, 1],
  },
};

// Qué objetos participa en cada caso: L1, L2 = rectas; S1, S2 = planos.
const tuple = (X) => `(${X.map((x) => fmt(x)).join(',\\ ')})`;
const USES = { rr: ['L1', 'L2'], rp: ['L1', 'S1'], pp: ['S1', 'S2'] };

export default {
  id: 'intersecciones',
  title: 'Intersecciones',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const has = (k) => USES[s.mode].includes(k);

    // --- escena ---
    const l1 = new LineView(stage, C.u), l2 = new LineView(stage, C.v);
    const d1a = new Arrow(stage, C.u, { label: R`\vec d_1` });
    const d2a = new Arrow(stage, C.v, { label: R`\vec d_2` });
    const pl1 = dim === 3 ? new PlaneView(stage, C.j) : null;
    const pl2 = dim === 3 ? new PlaneView(stage, C.k) : null;
    const n1a = new Arrow(stage, C.j, { label: R`\vec n_1` });
    const n2a = new Arrow(stage, C.k, { label: R`\vec n_2` });
    const res = new LineView(stage, C.w, { radius: 0.05 });
    const resDir = new Arrow(stage, C.w, { label: R`\vec d`, radius: 0.045 });
    const gap = new Rod(stage, C.w, { radius: 0.03 });
    const hit = new Dot(stage, '#ffffff', { radius: 0.14 });
    const badge = stage.addLabel('', C.w, 'badge');
    const lbl = {
      L1: stage.addLabel('P_1', C.u), L2: stage.addLabel('P_2', C.v),
      S1: stage.addLabel('Q_1', C.j), S2: stage.addLabel('Q_2', C.k),
    };

    const pointAndTip = (key, P, v, color) => {
      stage.addHandle({ color, visible: () => has(key), get: () => s[P], set: (p) => { s[P] = p; update(); } });
      stage.addHandle({ color, visible: () => has(key), get: () => add(s[P], s[v]), set: (p) => { s[v] = sub(p, s[P]); update(); } });
    };
    pointAndTip('L1', 'P1', 'd1', C.u);
    pointAndTip('L2', 'P2', 'd2', C.v);
    if (dim === 3) {
      pointAndTip('S1', 'A', 'n1', C.j);
      pointAndTip('S2', 'B', 'n2', C.k);
    }

    // --- panel ---
    const ed = (name, color, key) => vecEditor({ name, color, dim, get: () => s[key], set: (v) => { s[key] = v; update(); } });
    const eds = [
      ed('P_1', C.u, 'P1'), ed(R`\vec d_1`, C.u, 'd1'), ed('P_2', C.v, 'P2'), ed(R`\vec d_2`, C.v, 'd2'),
      ...(dim === 3 ? [ed('Q_1', C.j, 'A'), ed(R`\vec n_1`, C.j, 'n1'), ed('Q_2', C.k, 'B'), ed(R`\vec n_2`, C.k, 'n2')] : []),
    ];
    const group = (title, a, b) => h('div', {}, rich(title, 'p'), h('div', { class: 'row' }, a.el, b.el));
    const groups = {
      L1: group(R`<b>Recta</b> $\ell_1$: punto y vector director`, eds[0], eds[1]),
      L2: group(R`<b>Recta</b> $\ell_2$: punto y vector director`, eds[2], eds[3]),
      ...(dim === 3 && {
        S1: group(R`<b>Plano</b> $\Pi_1$: punto y vector normal`, eds[4], eds[5]),
        S2: group(R`<b>Plano</b> $\Pi_2$: punto y vector normal`, eds[6], eds[7]),
      }),
    };
    const mode = chips([['rr', 'Recta – recta'], ['rp', 'Recta – plano'], ['pp', 'Plano – plano']], () => s.mode, (m) => { s.mode = m; update(); });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox();
    const note = new Note();

    panel.append(
      ...intro('Intersecciones',
        R`Para saber dónde se cortan dos objetos buscamos los puntos que cumplen <b>las ecuaciones de los dos a la vez</b>: hay que resolver un sistema de ecuaciones. Comparando los vectores directores y normales se puede saber, antes de hacer cuentas, si habrá un punto, una recta, infinitos puntos o ninguno.`),
      dim === 3 ? card('Caso', mode.el) : null,
      card('Objetos', ...Object.values(groups)),
      card('Resolución', c1.el, note.el, c2.el, c3.el),
      details('Resumen de casos',
        dim === 2
          ? rich(R`<b>Dos rectas en el plano</b>: si $\vec d_1$ y $\vec d_2$ no son paralelos, se cortan en <b>un punto</b>. Si son paralelos, las rectas son <b>paralelas</b> (ningún punto en común) o <b>coincidentes</b> (todos).`)
          : h('div', {},
            rich(R`<b>Recta – recta</b>: si $\vec d_1\times\vec d_2\neq\vec 0$ pueden cortarse en un punto o <b>cruzarse</b> sin tocarse (están en planos distintos). Se distinguen con $(P_2-P_1)\cdot(\vec d_1\times\vec d_2)$: es 0 solo si se cortan. Si $\vec d_1\times\vec d_2=\vec 0$, son paralelas o coincidentes.`),
            rich(R`<b>Recta – plano</b>: si $\vec n\cdot\vec d\neq 0$ la recta atraviesa el plano en un punto. Si $\vec n\cdot\vec d = 0$ la recta es paralela al plano: o está contenida en él o no lo toca.`),
            rich(R`<b>Plano – plano</b>: si $\vec n_1\times\vec n_2\neq\vec 0$ se cortan en una <b>recta</b> con dirección $\vec n_1\times\vec n_2$. Si no, son paralelos o coincidentes.`))),
      tryList(dim === 2
        ? [R`Haz $\vec d_2$ paralelo a $\vec d_1$ (por ejemplo, $\vec d_2 = (4, 2)$): las rectas dejan de cortarse.`,
          R`Con las rectas paralelas, mueve $P_2$ sobre $\ell_1$: pasan a ser la misma recta.`]
        : [R`Recta – recta: sube $P_2$ a $z = 1$. Las rectas se <b>cruzan</b> sin tocarse; el segmento amarillo es la distancia mínima.`,
          R`Recta – plano: haz $\vec d_1$ horizontal (componente $z = 0$) con el plano $z = 1$: queda paralela.`,
          R`Plano – plano: haz $\vec n_2$ igual a $\vec n_1$: los planos quedan paralelos y la recta de corte desaparece.`]),
    );

    function update() {
      const { P1, d1, P2, d2 } = s;
      // visibilidad según el caso
      l1.setVisible(has('L1')); d1a.setVisible(has('L1'));
      l2.setVisible(has('L2')); d2a.setVisible(has('L2'));
      n1a.setVisible(has('S1')); n2a.setVisible(has('S2'));
      if (has('L1')) { l1.set(P1, d1); d1a.set(P1, add(P1, d1)); }
      if (has('L2')) { l2.set(P2, d2); d2a.set(P2, add(P2, d2)); }
      if (pl1) { pl1.setVisible(has('S1')); if (has('S1')) { pl1.set(s.A, s.n1); n1a.set(s.A, add(s.A, s.n1)); } }
      if (pl2) { pl2.setVisible(has('S2')); if (has('S2')) { pl2.set(s.B, s.n2); n2a.set(s.B, add(s.B, s.n2)); } }
      const pos = { L1: P1, L2: P2, S1: s.A, S2: s.B };
      for (const k in lbl) { lbl[k].visible = has(k) && !!pos[k]; if (pos[k]) lbl[k].position.set(...to3(pos[k])); }
      for (const k in groups) groups[k].style.display = has(k) ? '' : 'none';
      mode.refresh();
      eds.forEach((e) => e.refresh());

      // por defecto no se muestra ningún resultado
      hit.setVisible(false); res.setVisible(false); resDir.setVisible(false); gap.setVisible(false);
      badge.visible = false;
      const showHit = (X, text) => { hit.setVisible(true).set(X); badge.visible = true; badge.position.set(...to3(X)); setLabel(badge, text); };
      const showGap = (a, b) => {
        gap.setVisible(true).set(a, b);
        badge.visible = true;
        badge.position.set(...to3(scale(add(a, b), 0.5)));
        setLabel(badge, R`d = ${fmt(norm(sub(a, b)))}`);
      };

      if (s.mode === 'rr') solveLineLine(showHit, showGap);
      else if (s.mode === 'rp') solveLinePlane(showHit, showGap);
      else solvePlanePlane(showGap);
    }

    function solveLineLine(showHit, showGap) {
      const { P1, d1, P2, d2 } = s;
      const sys = P1.map((_, i) => `${affine(P1[i], d1[i], 't')} &= ${affine(P2[i], d2[i], 's')}`).join('\\\\');
      c1.set(R`P_1 + t\,\vec d_1 = P_2 + s\,\vec d_2 \;\Rightarrow\; \left\{\begin{aligned}${sys}\end{aligned}\right.`);
      if (norm(d1) < EPS || norm(d2) < EPS) {
        note.set('neg', 'Un vector director es $\\vec 0$: no define una recta.');
        c2.set(''); c3.set('');
        return;
      }
      const c = closestLineLine(P1, d1, P2, d2);
      if (c) {
        const gapLen = norm(sub(c.C1, c.C2));
        if (gapLen < 1e-6) {
          showHit(c.C1, tuple(c.C1));
          note.set('pos', 'Las direcciones no son paralelas y las rectas <b>se cortan en un único punto</b>: el sistema tiene solución única.');
          c2.set(R`t = ${fmt(c.t)},\quad s = ${fmt(c.s)}`);
          c3.set(R`P_1 + ${fmt(c.t)}\,\vec d_1 = ${clr('#ffffff', tv(c.C1))}`);
        } else {
          const w = cross(d1, d2), m = dot(sub(P2, P1), w);
          showGap(c.C1, c.C2);
          note.set('neg', 'Las direcciones no son paralelas, pero las rectas <b>se cruzan</b>: no se tocan porque están en planos distintos. El sistema no tiene solución. El segmento amarillo une los puntos más cercanos.');
          c2.set(R`(P_2 - P_1)\cdot(\vec d_1\times\vec d_2) = ${tv(sub(P2, P1))}\cdot${tv(w)} = ${fmt(m)} \neq 0`);
          c3.set(R`\text{distancia} = \frac{|(P_2 - P_1)\cdot(\vec d_1\times\vec d_2)|}{\|\vec d_1\times\vec d_2\|} = \frac{${fmt(Math.abs(m))}}{${fmt(norm(w))}} = ${clr(C.w, fmt(gapLen))}`);
        }
        return;
      }
      const pl = pointLine(P2, P1, d1);
      c2.set(R`\vec d_2 = ${fmt(norm(d2) / norm(d1) * Math.sign(dot(d1, d2)))}\,\vec d_1 \quad\text{(direcciones paralelas)}`);
      if (pl.dist < 1e-6) {
        note.set('zero', R`Las direcciones son paralelas y $P_2$ está en $\ell_1$: son la <b>misma recta</b>. Hay infinitas soluciones.`);
        c3.set('');
      } else {
        showGap(P2, pl.F);
        note.set('zero', 'Las direcciones son paralelas pero las rectas no tienen puntos en común: son <b>paralelas</b>. El sistema no tiene solución.');
        c3.set(R`\text{distancia entre ellas} = ${clr(C.w, fmt(pl.dist))}`);
      }
    }

    function solveLinePlane(showHit, showGap) {
      const { P1, d1, A, n1 } = s;
      const k = dot(n1, A), nP = dot(n1, P1), nd = dot(n1, d1);
      c1.set(R`\Pi_1:\ ${linform(n1)} = ${fmt(k)} \qquad \ell_1:\ X = P_1 + t\,\vec d_1 \;\Rightarrow\; \vec n_1\cdot(P_1 + t\,\vec d_1) = ${fmt(k)}`);
      if (norm(d1) < EPS || norm(n1) < EPS) {
        note.set('neg', 'El vector director o el normal es $\\vec 0$: falta información para definir los objetos.');
        c2.set(''); c3.set('');
        return;
      }
      if (Math.abs(nd) > EPS) {
        const t = (k - nP) / nd, X = add(P1, scale(d1, t));
        showHit(X, tuple(X));
        note.set('pos', R`$\vec n_1\cdot\vec d_1 \neq 0$: la recta no es paralela al plano, así que lo <b>atraviesa en un punto</b>.`);
        c2.set(R`t = \frac{${fmt(k)} - \vec n_1\cdot P_1}{\vec n_1\cdot\vec d_1} = \frac{${fmt(k)} - ${fmt(nP)}}{${fmt(nd)}} = ${fmt(t)}`);
        c3.set(R`X = P_1 + ${fmt(t)}\,\vec d_1 = ${clr('#ffffff', tv(X))}`);
        return;
      }
      c2.set(R`\vec n_1\cdot\vec d_1 = 0 \quad\text{(la recta es perpendicular a la normal)}`);
      const dist = Math.abs(nP - k) / norm(n1);
      if (dist < 1e-6) {
        note.set('zero', 'La recta es paralela al plano y uno de sus puntos está en él: la recta está <b>contenida en el plano</b>. Infinitas soluciones.');
        c3.set('');
      } else {
        showGap(P1, sub(P1, scale(n1, (nP - k) / dot(n1, n1))));
        note.set('zero', 'La recta es <b>paralela al plano</b> y no lo toca: la ecuación se queda en una igualdad falsa, sin solución.');
        c3.set(R`${fmt(nP)} + 0\cdot t = ${fmt(k)}\ \text{es imposible};\quad\text{distancia} = ${clr(C.w, fmt(dist))}`);
      }
    }

    function solvePlanePlane(showGap) {
      const { A, n1, B, n2 } = s;
      const k1 = dot(n1, A), k2 = dot(n2, B);
      c1.set(R`\begin{cases}${linform(n1)} = ${fmt(k1)}\\${linform(n2)} = ${fmt(k2)}\end{cases}`);
      if (norm(n1) < EPS || norm(n2) < EPS) {
        note.set('neg', 'Un vector normal es $\\vec 0$: no define un plano.');
        c2.set(''); c3.set('');
        return;
      }
      const dir = cross(n1, n2), D = dot(dir, dir);
      if (Math.sqrt(D) > EPS) {
        const n12 = dot(n1, n2);
        const p = scale(add(scale(n1, k1 * dot(n2, n2) - k2 * n12), scale(n2, k2 * dot(n1, n1) - k1 * n12)), 1 / D);
        res.setVisible(true).set(p, dir);
        resDir.setVisible(true).set(p, add(p, dir));
        note.set('pos', R`Las normales no son paralelas: los planos <b>se cortan en una recta</b>. Son 2 ecuaciones con 3 incógnitas, así que queda un parámetro libre $t$. La dirección de la recta es perpendicular a las dos normales: $\vec n_1\times\vec n_2$.`);
        c2.set(R`\vec d = \vec n_1\times\vec n_2 = ${clr(C.j, tv(n1))}\times${clr(C.k, tv(n2))} = ${clr(C.w, tv(dir))}`);
        c3.set(R`X = ${tv(p)} + t\,${clr(C.w, tv(dir))}`);
        return;
      }
      c2.set(R`\vec n_1\times\vec n_2 = \vec 0 \quad\text{(normales paralelas)}`);
      const off = dot(n1, B) - k1, dist = Math.abs(off) / norm(n1);
      if (dist < 1e-6) {
        note.set('zero', 'Las normales son paralelas y $Q_2$ está en $\\Pi_1$: es el <b>mismo plano</b>. Infinitas soluciones.');
        c3.set('');
      } else {
        showGap(B, sub(B, scale(n1, off / dot(n1, n1))));
        note.set('zero', 'Las normales son paralelas: los planos son <b>paralelos</b> y no se cortan. El sistema no tiene solución.');
        c3.set(R`\text{distancia entre los planos} = ${clr(C.w, fmt(dist))}`);
      }
    }

    update();
  },
};
