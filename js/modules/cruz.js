import { Arrow, Quad, C } from '../core/stage.js';
import { add, scale, dot, cross, norm, clamp, deg, fmt, pf, tv, clr, EPS } from '../core/math.js';
import { R, h, intro, card, details, tryList, vecEditor, TexBox, Note, rich, button, buttonRow, tabs, Stepper } from '../core/ui.js';
import { BASIS } from '../core/presets.js';
import { setLabel } from '../core/stage.js';

const s = { u: [2, 0, 0.5], v: [0.5, 2, 0], tab: 'exp', step: 0 };
const AX = ['x', 'y', 'z'], PL = ['yz', 'xz', 'xy'];

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
    // procedimiento: sombra del paralelogramo sobre un plano de coordenadas y componentes de w
    const shadow = new Quad(stage, C.x, { opacity: 0.35, edgeOpacity: 0.9 });
    const comps = BASIS.map((b, k) => new Arrow(stage, b.color, { radius: 0.05, label: R`w_${AX[k]}` }));
    stage.addHandle({ color: C.u, get: () => s.u, set: (p) => { s.u = p; update(); } });
    stage.addHandle({ color: C.v, get: () => s.v, set: (p) => { s.v = p; update(); } });

    const stepper = new Stepper((i) => { s.step = i; update(); });
    function buildProc() {
      const { u, v } = s, w = cross(u, v);
      const minor = (k) => {
        const [a, b] = [0, 1, 2].filter((j) => j !== k);
        return { a, b, val: u[a] * v[b] - u[b] * v[a] };
      };
      const m = [0, 1, 2].map(minor);
      const big = R`\begin{vmatrix}\hat\imath&\hat\jmath&\hat k\\ ${u.map((x) => fmt(x)).join('&')}\\ ${v.map((x) => fmt(x)).join('&')}\end{vmatrix}`;
      const steps = [{
        title: 'Montar el determinante',
        tex: R`\vec u\times\vec v = ${big}`,
        why: R`se busca un vector $\vec w$ perpendicular a $\vec u$ y a $\vec v$, es decir, con $\vec w\cdot\vec u = 0$ y $\vec w\cdot\vec v = 0$. Resolviendo ese sistema, la solución cuya longitud es el área del paralelogramo tiene exactamente la forma de este «determinante» con $\hat\imath, \hat\jmath, \hat k$ en la primera fila. Es una forma cómoda de recordar la fórmula: cada componente sale de tachar su columna.`,
      }];
      const names = ['\\hat\\imath', '\\hat\\jmath', '\\hat k'];
      m.forEach(({ a, b, val }, k) => {
        const sg = k === 1 ? '-' : '+';
        steps.push({
          title: `Componente ${AX[k]}: tachar la columna de $${names[k]}$`,
          tex: [
            R`w_${AX[k]} = ${sg === '-' ? '-' : ''}\begin{vmatrix}${fmt(u[a])}&${fmt(u[b])}\\${fmt(v[a])}&${fmt(v[b])}\end{vmatrix}`,
            R`= ${sg === '-' ? '-' : ''}(${pf(u[a])}\cdot${pf(v[b])} - ${pf(u[b])}\cdot${pf(v[a])}) = ${clr(BASIS[k].color, fmt(k === 1 ? -val : val))}`,
          ],
          why: R`ese determinante $2\times2$ usa solo las coordenadas $${AX[a]}$ y $${AX[b]}$: es el <b>área con signo de la sombra</b> del paralelogramo sobre el plano $${PL[k]}$ (en azul). Cuanto más «de frente» al eje $${AX[k]}$ esté el paralelogramo, más grande es esa sombra y más apunta $\vec w$ hacia $${AX[k]}$.${k === 1 ? R` El signo menos viene del patrón $+,-,+$ del desarrollo: mide la sombra con la orientación $z \to x$ en lugar de $x \to z$.` : ''}`,
        });
      });
      const A = norm(w);
      steps.push({
        title: 'Juntar y comprobar',
        tex: [
          R`\vec w = ${clr(C.x, tv(w))}`,
          R`\vec w\cdot\vec u = ${fmt(dot(w, u))},\qquad \vec w\cdot\vec v = ${fmt(dot(w, v))}`,
          R`\|\vec w\| = \sqrt{${w.map((x) => `${pf(x)}^2`).join(' + ')}} = ${fmt(A)}`,
        ],
        why: R`los dos productos punto dan 0: $\vec w$ es perpendicular a $\vec u$ y a $\vec v$. Y su longitud es el área del paralelogramo, por un «Pitágoras de áreas»: el cuadrado del área es la suma de los cuadrados de sus tres sombras.`,
      });
      steps.push({
        title: 'El sentido: mano derecha',
        tex: R`\det\begin{bmatrix}\vec u & \vec v & \vec w\end{bmatrix} = \|\vec w\|^2 = ${fmt(A * A)} ${A > EPS ? '> 0' : '= 0'}`,
        why: R`hay dos vectores perpendiculares con esa longitud ($\vec w$ y $-\vec w$). La fórmula elige el que hace que $\vec u, \vec v, \vec w$ tengan la misma orientación que $\hat\imath, \hat\jmath, \hat k$ (determinante positivo): la regla de la mano derecha. Por eso intercambiar $\vec u$ y $\vec v$ cambia el signo.`,
      });
      stepper.set(steps, s.step);
      s.step = stepper.i;
    }

    // --- panel ---
    const eu = vecEditor({ name: R`\vec{u}`, color: C.u, dim: 3, get: () => s.u, set: (v) => { s.u = v; update(); } });
    const ev = vecEditor({ name: R`\vec{v}`, color: C.v, dim: 3, get: () => s.v, set: (v) => { s.v = v; update(); } });
    const swap = () => { [s.u, s.v] = [s.v, s.u]; update(); };
    const tb = tabs([['exp', 'Explorar'], ['calc', 'Cómo se calcula']], () => s.tab, (k) => { s.tab = k; tb.refresh(); update(); });
    const c1 = new TexBox(), c2 = new TexBox(), c3 = new TexBox();
    const note = new Note();

    panel.append(
      ...intro('Producto cruz',
        R`El producto cruz toma dos vectores de 3D y devuelve <b>otro vector</b>, perpendicular a ambos. Su <b>longitud</b> es el área del paralelogramo que forman, y su <b>sentido</b> lo da la regla de la mano derecha.`),
      card('Vectores', h('div', { class: 'row' }, eu.el, ev.el), buttonRow(button('Intercambiar u y v', swap))),
      tb.el, tb.panes.exp, tb.panes.calc,
    );
    tb.panes.calc.append(
      rich(R`Cada componente de $\vec u\times\vec v$ es un determinante $2\times2$. En la escena se ve qué mide cada uno: la sombra del paralelogramo sobre un plano de coordenadas.`, 'p', 'note'),
      stepper.el, stepper.listEl,
    );
    tb.panes.exp.append(
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
      buildProc();
      // escena del procedimiento: sombra del paso actual y componentes ya calculadas
      const calc = s.tab === 'calc', k = s.step - 1;
      const showW = !calc || s.step >= 4;
      wa.setVisible(showW).set(O, w);
      const proj = (p) => p.map((x, j) => (j === k ? 0 : x));
      shadow.setVisible(calc && k >= 0 && k < 3);
      if (calc && k >= 0 && k < 3) {
        shadow.set(O, proj(u), proj(add(u, v)), proj(v));
        shadow.setColor(Math.abs(w[k]) < EPS ? C.neutral : w[k] > 0 ? C.x : C.neg);
      }
      let acc = O;
      comps.forEach((a, j) => {
        const vis = calc && j <= k && s.step <= 3 && Math.abs(w[j]) > EPS;
        a.setVisible(vis);
        if (vis) { const nx = add(acc, w.map((_, q) => (q === j ? w[j] : 0))); a.set(acc, nx); acc = nx; }
      });
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
