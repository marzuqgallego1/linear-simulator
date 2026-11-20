import { Arrow, Polyline, C } from '../core/stage.js';
import { add, sub, scale, dot, norm, cross, fmt, tv, tm, clr, matMul, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, slider, button, buttonRow, TexBox, Note, rich } from '../core/ui.js';
import { BASIS } from '../core/presets.js';
import { PlaneView } from '../core/geom.js';

const VC = [C.u, C.v, '#20c997']; // vectores originales
const QC = BASIS.map((b) => b.color); // base ortonormal resultante

const state = {
  2: { v: [[3, 1], [2, 2.5]], step: 3 },
  3: { v: [[2, 0, 1], [1, 2, 0], [1, 1, 2]], step: 5 },
};

/** Ejecuta Gram-Schmidt guardando todo lo intermedio. */
function gram(vs) {
  const qs = [], ws = [], projs = [];
  for (const v of vs) {
    const p = qs.reduce((acc, q) => add(acc, scale(q, dot(v, q))), v.map(() => 0));
    const w = sub(v, p);
    projs.push(p);
    ws.push(w);
    if (norm(w) < 1e-9) return { qs, ws, projs, failAt: qs.length };
    qs.push(scale(w, 1 / norm(w)));
  }
  return { qs, ws, projs, failAt: -1 };
}

export default {
  id: 'gramschmidt',
  title: 'Gram-Schmidt',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, O = Array(n).fill(0);
    const last = 2 * n - 1; // pasos: 0 inicio, luego (proyectar k, normalizar k) para k = 2..n
    // paso 1 = normalizar v1; paso 2k-2 = proyectar v_k; paso 2k-1 = normalizar w_k

    // --- escena ---
    const unit = dim === 2 ? new Polyline(stage, '#ffffff', { opacity: 0.25, dashed: true, dash: 0.08 }) : null;
    if (unit) unit.set(Array.from({ length: 97 }, (_, k) => [Math.cos((k * Math.PI) / 48), Math.sin((k * Math.PI) / 48)]));
    const plane = dim === 3 ? new PlaneView(stage, '#8b93a7', { opacity: 0.12, L: 4 }) : null;
    const vA = s.v.map((_, j) => new Arrow(stage, VC[j], { label: R`\vec v_${j + 1}` }));
    const qA = s.v.map((_, j) => new Arrow(stage, QC[j], { label: R`\vec q_${j + 1}`, radius: 0.05 }));
    const projA = new Arrow(stage, C.w, { label: R`\text{proj}`, radius: 0.04 });
    const wA = new Arrow(stage, C.x, { label: R`\vec w`, radius: 0.04 });
    const drop = new Polyline(stage, '#ffffff', { opacity: 0.7, dashed: true, dash: 0.08 });
    s.v.forEach((_, j) => stage.addHandle({ color: VC[j], get: () => s.v[j], set: (p) => { s.v = s.v.map((v, k) => (k === j ? p : v)); update(); } }));

    // --- panel ---
    const ev = s.v.map((_, j) => vecEditor({ name: R`\vec v_${j + 1}`, color: VC[j], dim, get: () => s.v[j], set: (p) => { s.v = s.v.map((v, k) => (k === j ? p : v)); update(); } }));
    const ss = slider({ label: R`\text{paso}`, min: 0, max: last, step: 1, get: () => s.step, set: (k) => { s.step = k; update(); }, format: (k) => `${k}/${last}` });
    const stepTitle = h('p', {}), cStep = new TexBox(), cStep2 = new TexBox(), note = new Note();
    const cFinal = new TexBox(), noteFinal = new Note();

    panel.append(
      ...intro('Gram-Schmidt',
        R`Las bases <b>ortonormales</b> (vectores de longitud 1 y perpendiculares entre sí) son las más cómodas: las coordenadas se sacan con productos punto. Gram-Schmidt convierte cualquier base en una ortonormal que genera lo mismo, vector por vector: a cada uno le <b>quita su sombra</b> sobre los anteriores y luego lo <b>normaliza</b>.`),
      card('Vectores de partida', h('div', { class: 'row' }, ev.map((e) => e.el))),
      card('Paso a paso', ss.el,
        buttonRow(button('◀ Anterior', () => { s.step = Math.max(0, s.step - 1); update(); }), button('Siguiente ▶', () => { s.step = Math.min(last, s.step + 1); update(); }, 'primary')),
        stepTitle, cStep.el, cStep2.el, note.el),
      card('Resultado', cFinal.el, noteFinal.el),
      details('Definición formal',
        rich(R`Proyección sobre un vector unitario: $\text{proj}_{\vec q}\vec v = (\vec v\cdot\vec q)\,\vec q$. Sobre un subespacio con base ortonormal $\{\vec q_1,\dots,\vec q_k\}$: $\text{proj}_W\vec v = \sum_i(\vec v\cdot\vec q_i)\,\vec q_i$.`),
        rich(R`Algoritmo: $\vec w_k = \vec v_k - \sum_{i<k}(\vec v_k\cdot\vec q_i)\,\vec q_i$, y $\vec q_k = \vec w_k/\|\vec w_k\|$. El vector $\vec w_k$ es perpendicular a todos los anteriores.`),
        rich(R`Si $Q$ tiene a los $\vec q_i$ como columnas, $Q^TQ = I$. Además $A = QR$ con $R$ triangular superior: es la <b>factorización QR</b>.`)),
      tryList([
        'Avanza paso a paso y mira cómo la línea punteada (lo que se quita) siempre llega en ángulo recto.',
        R`Arrastra $\vec v_2$: $\vec q_1$ no cambia, porque solo depende de $\vec v_1$.`,
        dim === 2 ? R`Pon $\vec v_2$ paralelo a $\vec v_1$: no queda nada después de quitar la sombra ($\vec w_2 = \vec 0$).` : R`Pon $\vec v_3$ dentro del plano de $\vec v_1$ y $\vec v_2$: $\vec w_3 = \vec 0$, no aporta una dirección nueva.`,
        dim === 2 ? 'Todas las $\\vec q$ terminan sobre la circunferencia punteada (longitud 1).' : 'Al final, $\\vec q_1$, $\\vec q_2$, $\\vec q_3$ son como unos ejes $x$, $y$, $z$ girados.',
      ]),
    );

    function update() {
      const G = gram(s.v);
      const k = s.step;
      // qué vector se está procesando en este paso y en qué fase
      const idx = k === 0 ? -1 : k === 1 ? 0 : Math.floor(k / 2); // 0-based
      const phase = k === 0 ? 'inicio' : k === 1 || k % 2 === 1 ? 'norm' : 'proj';
      const done = (j) => (j === 0 ? k >= 1 : k >= 2 * j + 1); // q_j ya calculado

      s.v.forEach((v, j) => vA[j].setVisible(!done(j) || j === idx).set(O, v));
      qA.forEach((a, j) => a.setVisible(done(j) && j < G.qs.length).set(O, G.qs[j] ?? O));
      const showProj = phase === 'proj' && idx < G.ws.length;
      projA.setVisible(showProj && norm(G.projs[idx]) > EPS);
      wA.setVisible((showProj || (phase === 'norm' && idx > 0)) && idx < G.ws.length);
      drop.setVisible(showProj);
      if (idx >= 0 && idx < G.ws.length) {
        projA.set(O, G.projs[idx]);
        wA.set(O, G.ws[idx]);
        drop.set([s.v[idx], G.projs[idx]]);
      }
      if (plane) {
        const showPlane = idx === 2 && G.qs.length >= 2;
        plane.setVisible(showPlane);
        if (showPlane) plane.set(O, cross(G.qs[0], G.qs[1]));
      }

      ev.forEach((e) => e.refresh());
      ss.refresh();

      // explicación del paso
      const vi = idx + 1;
      const failedHere = G.failAt >= 0 && idx >= G.failAt;
      if (phase === 'inicio') {
        stepTitle.innerHTML = '<b>Inicio.</b> Los vectores de partida, en general ni unitarios ni perpendiculares.';
        cStep.set(s.v.map((v, j) => R`\vec v_${j + 1}\cdot\vec v_${(j + 1) % n + 1} = ${fmt(dot(v, s.v[(j + 1) % n]))}`).slice(0, n === 2 ? 1 : 3).join(',\\quad '));
        cStep2.set(''); note.set('', 'Si estos productos punto no son 0, los vectores no son perpendiculares. Pulsa «Siguiente».');
      } else if (failedHere) {
        stepTitle.innerHTML = `<b>Paso ${k}.</b> Problema con $\\vec v_${G.failAt + 1}$.`;
        setTitleMath();
        cStep.set(R`\vec w_${G.failAt + 1} = \vec v_${G.failAt + 1} - \text{proj} = \vec 0`); cStep2.set('');
        note.set('neg', R`$\vec v_${G.failAt + 1}$ ya estaba en el span de los anteriores: al quitarle su sombra no queda nada. Los vectores de partida no son linealmente independientes.`);
      } else if (phase === 'norm' && idx === 0) {
        stepTitle.innerHTML = '<b>Paso 1. Normalizar $\\vec v_1$.</b> Lo dividimos por su longitud para que mida 1.';
        setTitleMath();
        cStep.set(R`\vec q_1 = \frac{\vec v_1}{\|\vec v_1\|} = \frac{1}{${fmt(norm(s.v[0]))}}${clr(VC[0], tv(s.v[0]))} = ${clr(QC[0], tv(G.qs[0]))}`);
        cStep2.set(''); note.set('', 'Misma dirección que $\\vec v_1$, longitud 1.');
      } else if (phase === 'proj') {
        stepTitle.innerHTML = `<b>Paso ${k}. Quitar a $\\vec v_${vi}$ su sombra</b> sobre ${idx === 1 ? '$\\vec q_1$' : 'el plano de $\\vec q_1$ y $\\vec q_2$'}.`;
        setTitleMath();
        const terms = G.qs.slice(0, idx).map((q, i) => R`(${fmt(dot(s.v[idx], q))})${clr(QC[i], tv(q))}`).join(' + ');
        cStep.set(R`\text{proj} = ${G.qs.slice(0, idx).map((_, i) => R`(\vec v_${vi}\cdot\vec q_${i + 1})\,\vec q_${i + 1}`).join(' + ')} = ${terms} = ${clr(C.w, tv(G.projs[idx]))}`);
        cStep2.set(R`\vec w_${vi} = \vec v_${vi} - \text{proj} = ${clr(VC[idx], tv(s.v[idx]))} - ${clr(C.w, tv(G.projs[idx]))} = ${clr(C.x, tv(G.ws[idx]))}`);
        note.set('', R`La flecha amarilla es la sombra (proyección). Lo que queda, $\vec w_${vi}$ (cian), es perpendicular a ${idx === 1 ? '$\\vec q_1$' : 'todo el plano'}: la línea punteada llega en ángulo recto.`);
      } else {
        stepTitle.innerHTML = `<b>Paso ${k}. Normalizar $\\vec w_${vi}$.</b>`;
        setTitleMath();
        cStep.set(R`\vec q_${vi} = \frac{\vec w_${vi}}{\|\vec w_${vi}\|} = \frac{1}{${fmt(norm(G.ws[idx]))}}${clr(C.x, tv(G.ws[idx]))} = ${clr(QC[idx], tv(G.qs[idx]))}`);
        cStep2.set(G.qs.slice(0, idx).map((q, i) => R`\vec q_${vi}\cdot\vec q_${i + 1} = ${fmt(dot(G.qs[idx], q))}`).join(',\\quad '));
        note.set('pos', R`$\vec q_${vi}$ mide 1 y es perpendicular a ${idx === 1 ? '$\\vec q_1$' : 'los anteriores'} (productos punto = 0).`);
      }

      if (G.failAt >= 0) {
        cFinal.set('');
        noteFinal.set('neg', 'No se puede completar: los vectores de partida son dependientes.');
      } else {
        const Q = G.qs[0].map((_, i) => G.qs.map((q) => q[i]));
        const QtQ = matMul(G.qs, Q);
        cFinal.set(R`Q = [\,${G.qs.map((_, i) => `\\vec q_${i + 1}`).join('\\ ')}\,] = ${tm(Q)},\qquad Q^TQ = ${tm(QtQ)}`);
        noteFinal.set(k === last ? 'pos' : '', k === last ? 'Listo: una base ortonormal ($Q^TQ = I$) que genera el mismo espacio que los vectores de partida.' : 'Así quedará la base ortonormal al terminar.');
      }
    }

    function setTitleMath() {
      // renderiza las fórmulas $...$ que haya en el título del paso
      const html = stepTitle.innerHTML;
      stepTitle.replaceChildren(rich(html, 'span'));
    }

    update();
  },
};
