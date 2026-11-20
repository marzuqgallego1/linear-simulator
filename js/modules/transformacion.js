import { Arrow, Lattice, C } from '../core/stage.js';
import { identity, lerpMat, col, withCol, matVec, tv, clr, combo } from '../core/math.js';
import { R, intro, card, details, tryList, vecEditor, matEditor, slider, button, buttonRow, TexBox, rich, animate } from '../core/ui.js';
import { BASIS, basisColors, presetButtons } from '../core/presets.js';

const state = {
  2: { A: [[1, 1], [0, 1]], x: [1, 2], t: 1 },
  3: { A: [[1, 0, 1], [0, 1, 0], [0, 0, 1]], x: [1, 1, 1], t: 1 },
};

export default {
  id: 'transformacion',
  title: 'Matriz como transformación',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    const s = state[dim];
    const n = dim, I = identity(n), O = Array(n).fill(0);
    const M = () => lerpMat(I, s.A, s.t);
    let stop = () => {};

    // --- escena ---
    const grid = new Lattice(stage, C.grid, { opacity: dim === 2 ? 0.5 : 0.3 });
    const basis = BASIS.slice(0, n).map((b) => new Arrow(stage, b.color, { label: b.tex }));
    const xg = new Arrow(stage, C.x, { opacity: 0.3, radius: 0.025, label: R`\vec{x}` });
    const xa = new Arrow(stage, C.x, { label: R`A\vec{x}` });
    basis.forEach((_, j) =>
      stage.addHandle({
        color: BASIS[j].color,
        get: () => col(M(), j),
        set: (v) => { stop(); s.A = withCol(s.A, j, v); s.t = 1; update(); },
      }));
    stage.addHandle({ color: C.x, get: () => s.x, set: (v) => { s.x = v; update(); } });

    // --- panel ---
    const play = () => { stop(); stop = animate(0, 1, 1400, (t) => { s.t = t; update(); }); };
    const me = matEditor({ dim, colors: basisColors(n), get: () => s.A, set: (A) => { stop(); s.A = A; s.t = 1; update(); } });
    const st = slider({ label: 't', min: 0, max: 1, step: 0.01, get: () => s.t, set: (t) => { stop(); s.t = t; update(); } });
    const ex = vecEditor({ name: R`\vec{x}`, color: C.x, dim, get: () => s.x, set: (v) => { s.x = v; update(); } });
    const calc = new TexBox();
    const nb = dim === 2 ? R`$\hat\imath$ y $\hat\jmath$` : R`$\hat\imath$, $\hat\jmath$ y $\hat k$`;

    panel.append(
      ...intro('Matriz como transformación',
        R`Una matriz es una <b>función que mueve el espacio</b>. Sus columnas dicen a dónde van los vectores base ${nb}: la primera columna es el nuevo $\hat\imath$, la segunda el nuevo $\hat\jmath$${dim === 3 ? R`, la tercera el nuevo $\hat k$` : ''}. Todo lo demás los sigue.`),
      card('Matriz A', me.el, rich('Arrastra las puntas de colores o escribe los números. Ejemplos:'), presetButtons(dim, (A) => { s.A = A; play(); })),
      card('Aplicar la transformación', st.el,
        buttonRow(button('▶ Animar', play, 'primary'), button('Ver original', () => { stop(); s.t = 0; update(); }))),
      card('Vector de prueba', ex.el,
        rich(R`Cualquier vector es una combinación de ${nb}. Como $A$ mueve los vectores base, el resultado usa <b>los mismos coeficientes</b> con los vectores base nuevos:`),
        calc.el),
      details('Definición formal',
        rich(R`Una función $T$ es <b>lineal</b> si $T(\vec u+\vec v)=T(\vec u)+T(\vec v)$ y $T(c\,\vec u)=c\,T(\vec u)$.`),
        rich(R`Toda transformación lineal de $\mathbb{R}^n$ en $\mathbb{R}^n$ se escribe como $T(\vec x)=A\vec x$, y la columna $j$ de $A$ es $T(\vec e_j)$, la imagen del $j$-ésimo vector base.`),
        rich('Geométricamente: el origen no se mueve, y las líneas de la rejilla siguen siendo rectas, paralelas y equiespaciadas.')),
      tryList([
        'Elige «Rotación 90°»: la rejilla gira sin deformarse.',
        dim === 2
          ? R`Arrastra $\hat\jmath$ encima de $\hat\imath$: todo el plano se aplasta en una recta.`
          : R`Elige «Singular»: todo el espacio se aplasta en un plano.`,
        'Mueve el deslizador $t$ despacio: el origen nunca se mueve.',
      ]),
    );

    function update() {
      const Mt = M();
      grid.setMatrix(Mt);
      basis.forEach((a, j) => a.set(O, col(Mt, j)));
      xg.set(O, s.x);
      xa.set(O, matVec(Mt, s.x));
      me.refresh(); st.refresh(); ex.refresh();
      const cols = BASIS.slice(0, n).map((b, j) => clr(b.color, tv(col(s.A, j))));
      calc.set(R`A\vec{x} = ${combo(s.x.map((c, j) => [c, cols[j]]))} = ${clr(C.x, tv(matVec(s.A, s.x)))}`);
    }

    update();
    return { destroy: () => stop() };
  },
};
