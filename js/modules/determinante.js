import { Arrow, Lattice, Quad, Box, C, setLabel } from '../core/stage.js';
import { identity, lerpMat, col, withCol, add, scale, det, fmt, pf, clr, EPS } from '../core/math.js';
import { R, intro, card, details, tryList, matEditor, slider, button, buttonRow, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS, basisColors, presetButtons } from '../core/presets.js';

const state = {
  2: { A: [[2, 1], [0.5, 1.5]], t: 1 },
  3: { A: [[1.5, 0, 0.5], [0, 1, 0], [0, 0.5, 1]], t: 1 },
};

export default {
  id: 'determinante',
  title: 'Determinante',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const M = () => lerpMat(I, s.A, s.t);
    const word = dim === 2 ? 'área' : 'volumen';
    let stop = () => {};

    // --- escena ---
    new Lattice(stage, C.grid, { opacity: 0.18 }).setMatrix(I);
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.3 : 0.18 });
    let shape;
    if (dim === 2) {
      new Quad(stage, '#ffffff', { opacity: 0, edgeOpacity: 0.35 }).set([0, 0], [1, 0], [1, 1], [0, 1]);
      shape = new Quad(stage, C.pos, { opacity: 0.35 });
    } else {
      new Box(stage, '#ffffff', { opacity: 0, edgeOpacity: 0.25 }).set([1, 0, 0], [0, 1, 0], [0, 0, 1]);
      shape = new Box(stage, C.pos, { opacity: 0.28 });
    }
    const badge = stage.addLabel('', C.pos, 'badge');
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    basis.forEach((_, j) =>
      stage.addHandle({
        color: BASIS[j].color,
        get: () => col(M(), j),
        set: (v) => { stop(); s.A = withCol(s.A, j, v); s.t = 1; update(); },
      }));

    // --- panel ---
    const play = () => { stop(); stop = animate(0, 1, 1400, (t) => { s.t = t; update(); }); };
    const me = matEditor({ dim, colors: basisColors(n), get: () => s.A, set: (A) => { stop(); s.A = A; s.t = 1; update(); } });
    const st = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const calc = new TexBox();
    const note = new Note();

    panel.append(
      ...intro('Determinante',
        dim === 2
          ? R`El determinante dice <b>por cuánto se multiplica el área</b> al aplicar la matriz. El cuadrado unitario que forman $\hat\imath$ y $\hat\jmath$ (área 1) se convierte en un paralelogramo de área $|\det A|$. El <b>signo</b> indica si el plano se dio la vuelta.`
          : R`El determinante dice <b>por cuánto se multiplica el volumen</b> al aplicar la matriz. El cubo unitario que forman $\hat\imath$, $\hat\jmath$ y $\hat k$ (volumen 1) se convierte en un paralelepípedo de volumen $|\det A|$. El <b>signo</b> indica si el espacio se dio la vuelta.`),
      card('Matriz A', me.el, presetButtons(dim, (A) => { s.A = A; play(); })),
      card('Aplicar la transformación', st.el,
        buttonRow(button('▶ Animar', play, 'primary'), button('Ver original', () => { stop(); s.t = 0; update(); }))),
      card('Lo que estás viendo', calc.el, note.el),
      details('Definición formal',
        rich(dim === 2
          ? R`$\det\begin{bmatrix}a&b\\c&d\end{bmatrix} = ad - bc$.`
          : R`Desarrollo por la primera fila: $\det A = a(ei-fh) - b(di-fg) + c(dh-eg)$, con $A=\begin{bmatrix}a&b&c\\d&e&f\\g&h&i\end{bmatrix}$.`),
        rich(R`Propiedades: $\det I = 1$; si intercambias dos columnas cambia de signo; $\det(AB)=\det A\cdot\det B$ (aplicar dos transformaciones multiplica sus factores de ${word}).`),
        rich(R`$A$ tiene inversa <b>si y solo si</b> $\det A \neq 0$.`)),
      tryList([
        R`Elige «Escalado»: la forma cambia, pero el ${word} se conserva ($\det = 1$).`,
        R`Elige «Cizalla»: la figura se inclina, pero el ${word} no cambia.`,
        dim === 2
          ? R`Arrastra $\hat\imath$ al otro lado de $\hat\jmath$: el color cambia y el determinante se vuelve negativo.`
          : R`Elige «Reflexión»: el determinante es $-1$, el espacio queda como en un espejo.`,
        dim === 2
          ? R`Arrastra $\hat\imath$ sobre la recta de $\hat\jmath$: el paralelogramo se aplasta y $\det = 0$.`
          : R`Elige «Singular»: el cubo se aplasta en un plano y $\det = 0$.`,
      ]),
    );

    function update() {
      const Mt = M(), dt = det(Mt), cols = [0, 1, 2].slice(0, n).map((j) => col(Mt, j));
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, cols[j]));
      const color = Math.abs(dt) < 1e-6 ? C.neutral : dt > 0 ? C.pos : C.neg;
      shape.setColor(color);
      if (dim === 2) shape.set(O, cols[0], add(cols[0], cols[1]), cols[1]);
      else shape.set(...cols);
      badge.position.set(...[...scale(cols.reduce(add), 0.5), 0].slice(0, 3));
      badge.userData.inner.style.color = color;
      setLabel(badge, R`\det = ${fmt(dt)}`);

      me.refresh(); st.refresh();
      const A = s.A, d = det(A);
      const dc = clr(Math.abs(d) < EPS ? C.neutral : d > 0 ? C.pos : C.neg, fmt(d));
      if (dim === 2) {
        const [[a, b], [c, e]] = A;
        calc.set(R`\det A = ad - bc = ${pf(a)}\cdot${pf(e)} - ${pf(b)}\cdot${pf(c)} = ${dc}`);
      } else {
        const [[a, b, c], [d1, e, f], [g, hh, i]] = A;
        const br = (p, q, r, t) => `[${pf(p)}\\cdot${pf(q)}-${pf(r)}\\cdot${pf(t)}]`;
        calc.set(R`\det A = ${pf(a)}${br(e, i, f, hh)} - ${pf(b)}${br(d1, i, f, g)} + ${pf(c)}${br(d1, hh, e, g)} = ${dc}`);
      }

      if (Math.abs(d) < EPS)
        note.set('zero', dim === 2
          ? R`<b>$\det A = 0$</b>: $A$ aplasta el plano en una recta (o en un punto). El área se vuelve cero y la transformación <b>no se puede deshacer</b>: $A$ no tiene inversa.`
          : R`<b>$\det A = 0$</b>: $A$ aplasta el espacio en un plano, una recta o un punto. El volumen se vuelve cero y la transformación <b>no se puede deshacer</b>: $A$ no tiene inversa.`);
      else if (d < 0)
        note.set('neg', dim === 2
          ? R`<b>Negativo</b>: la orientación se <b>invierte</b>, como ver el plano en un espejo ($\hat\jmath$ queda a la derecha de $\hat\imath$ en vez de a la izquierda). El área se multiplica por $|\det A| = ${fmt(Math.abs(d))}$.`
          : R`<b>Negativo</b>: la orientación se <b>invierte</b>; la «mano derecha» se convierte en mano izquierda. El volumen se multiplica por $|\det A| = ${fmt(Math.abs(d))}$.`);
      else {
        const how = Math.abs(d - 1) < EPS ? 'se conserva' : d > 1 ? 'crece' : 'se encoge';
        note.set('pos', R`<b>Positivo</b>: la orientación se mantiene. Cualquier región multiplica su ${word} por $${fmt(d)}$: el ${word} <b>${how}</b>.`);
      }
    }

    update();
    return { destroy: () => stop() };
  },
};
