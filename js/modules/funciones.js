import { Arrow, Polyline, Segments, Dot, C } from '../core/stage.js';
import { add, sub, scale, norm, dot, cross, normalize, matVec, matMul, transpose, inverse, det, solveSystem, eigen, polyTex, fmt, pf, tv, tm, clr, clamp } from '../core/math.js';
import { LineView, PlaneView } from '../core/geom.js';
import { R, h, tex, intro, card, details, tryList, vecEditor, slider, button, buttonRow, chips, tabs, TexBox, Note, rich, animate } from '../core/ui.js';
import { BASIS } from '../core/presets.js';
import { parse, evalExpr, texExpr, ExprError } from '../core/expr.js';

const KINDS = {
  22: { n: 2, m: 2, dim: 2, label: 'ℝ² → ℝ²' },
  23: { n: 2, m: 3, dim: 3, label: 'ℝ² → ℝ³' },
  33: { n: 3, m: 3, dim: 3, label: 'ℝ³ → ℝ³' },
  32: { n: 3, m: 2, dim: 3, label: 'ℝ³ → ℝ²' },
};
const PRE = {
  22: [
    ['Autovalores', ['2x + y', 'x + 2y']],
    ['Cizalla', ['x + y', 'y']],
    ['Rotación 90°', ['-y', 'x']],
    ['Escala', ['2x', '0.5y']],
    ['Proyección', ['x', '0']],
    ['Afín: cizallar y bajar', ['2x + y', 'y - 1']],
    ['No lineal: parábola', ['x', 'y + x^2/4']],
    ['No lineal: ondas', ['x + 0.5sin(y)', 'y + 0.5sin(x)']],
  ],
  23: [
    ['Plano inclinado', ['x', 'y', 'x + y']],
    ['Levantar (afín)', ['x', 'y', '1.5']],
    ['Doblar a otro plano', ['x + y', 'y', 'x - y']],
    ['Rango 1', ['x + y', 'x + y', '0.5(x + y)']],
    ['No lineal: paraboloide', ['x', 'y', '(x^2 + y^2)/4']],
  ],
  33: [
    ['Autovalores', ['2x + y', 'x + 2y', '3z']],
    ['Cizalla', ['x + z', 'y', 'z']],
    ['Rotación (eje z)', ['-y', 'x', 'z']],
    ['Escala', ['1.5x', 'y', '0.5z']],
    ['Traslación (afín)', ['x + 1', 'y', 'z - 1']],
    ['Aplastar', ['x', 'y', '0']],
    ['No lineal: torcer', ['x cos(z/2) - y sin(z/2)', 'x sin(z/2) + y cos(z/2)', 'z']],
  ],
  32: [
    ['Proyectar', ['x', 'y']],
    ['Sombra oblicua', ['x - 0.5z', 'y - 0.5z']],
    ['Sumar coordenadas', ['x + z', 'y + z']],
    ['Afín', ['x + z + 1', 'y - 1']],
    ['No lineal', ['x + z^2/4', 'y']],
  ],
};

/** Ejemplos para la segunda función S (pestaña «Operar»), por firma «entrada salida». */
const SPRE = {
  22: [['Rotación 90°', ['-y', 'x']], ['Cizalla', ['x + y', 'y']], ['Escala', ['2x', 'y']], ['Reflexión', ['y', 'x']], ['Traslación', ['x + 1', 'y']]],
  33: [['Rotación (eje z)', ['-y', 'x', 'z']], ['Cizalla', ['x + z', 'y', 'z']], ['Escala', ['2x', 'y', 'z']], ['Aplastar', ['x', 'y', '0']]],
  23: [['Plano inclinado', ['x', 'y', 'x + y']], ['Doblar', ['x + y', 'y', 'x - y']], ['Levantar (afín)', ['x', 'y', '1']]],
  32: [['Proyectar', ['x', 'y']], ['Sumar coordenadas', ['x + z', 'y + z']]],
};
const OPS = [['comp', 'Composición'], ['suma', 'Suma T + S'], ['esc', 'Escalar k·T'], ['inv', 'Inversa T⁻¹'], ['tr', 'Transpuesta Tᵀ']];

const shared = {
  kind: '22',
  exprs: Object.fromEntries(Object.entries(PRE).map(([k, l]) => [k, [...l[0][1]]])),
  x: { 2: [1.5, 1], 3: [1, 1, 1] },
  s: 1,
  anim: 'coord',
  tab: 'una',
  op: 'comp', order: 'TS', k: 2, so: 1,
  an: 'det', sa: 1,
  sEx: Object.fromEntries(Object.entries(SPRE).map(([k, l]) => [k, [...l[0][1]]])),
};

/** Sustituye variables por subárboles (para escribir T(S(x)) como fórmula). */
const subst = (nd, mp) => {
  if (nd.t === 'var') { const r = mp[nd.v]; return r.t === 'var' || r.t === 'fn' || (r.t === 'num' && r.v >= 0) ? r : { t: 'par', a: r }; }
  if (nd.t === 'num') return nd;
  const o = { ...nd };
  if (nd.a) o.a = subst(nd.a, mp);
  if (nd.b) o.b = subst(nd.b, mp);
  return o;
};
/** Coordenadas de A·x + b como fórmulas simplificadas en LaTeX. */
const affTex = (A, b, vars) => A.map((row, i) => {
  let s = '';
  row.forEach((a, j) => {
    const f = fmt(a);
    if (f === '0') return;
    const neg = f.startsWith('-'), mag = neg ? f.slice(1) : f;
    s += (s ? (neg ? ' - ' : ' + ') : neg ? '-' : '') + (mag === '1' ? '' : mag) + vars[j];
  });
  const fb = fmt(b ? b[i] : 0);
  if (fb !== '0') s += s ? (fb.startsWith('-') ? ` - ${fb.slice(1)}` : ` + ${fb}`) : fb;
  return s || '0';
});

const VAR = ['x', 'y', 'z'], OUT = ["x'", "y'", "z'"];
const OK = R`\textcolor{#51cf66}{\checkmark}`, BAD = R`\textcolor{#ff6b6b}{\times}`;
const near = (a, b) => a.every((x, i) => Number.isFinite(x) && Number.isFinite(b[i]) && Math.abs(x - b[i]) <= 1e-7 * (1 + Math.abs(x) + Math.abs(b[i])));
const pad = (v, D) => Array.from({ length: D }, (_, i) => v[i] ?? 0);
const finite = (v) => v.every((x) => Number.isFinite(x) && Math.abs(x) < 60);

export default {
  id: 'funciones',
  title: 'Transformaciones como funciones',
  dims: [2, 3],

  mount({ stage, panel, dim }) {
    if (dim === 2) shared.kind = '22';
    else if (shared.kind === '22') shared.kind = '33';
    const kind = shared.kind, { n, m } = KINDS[kind], D = dim;
    const vars = VAR.slice(0, n), exprs = shared.exprs[kind];
    const env = (p) => Object.fromEntries(vars.map((v, i) => [v, p[i]]));
    const O = Array(n).fill(0), E = Array.from({ length: n }, (_, j) => O.map((_, i) => (i === j ? 1 : 0)));
    const switchTo = (k) => { shared.kind = k; document.querySelector(`[data-dim="${KINDS[k].dim}"]`)?.click(); };
    let stop = () => {};

    // --- fórmulas ---
    const trees = exprs.map(() => ({ t: 'num', v: 0 }));
    const errors = exprs.map(() => null);
    const compile = (i) => {
      try { trees[i] = parse(exprs[i], vars); errors[i] = null; }
      catch (e) { if (!(e instanceof ExprError)) throw e; errors[i] = e.message; }
    };
    exprs.forEach((_, i) => compile(i));
    const T = (p) => { const e = env(p); return trees.map((t) => evalExpr(t, e)); };

    /** ¿lineal, afín o no lineal? Se prueba con varios vectores (no solo con los que se muestran). */
    const classifyF = (F, din, dout) => {
      const Oi = Array(din).fill(0), Ei = Oi.map((_, j) => Oi.map((__, i) => (i === j ? 1 : 0)));
      const T0 = F(Oi);
      const G = (p) => sub(F(p), T0);
      const samples = [[0.7, -1.3, 0.4], [-2.1, 0.6, 1.7], [1.9, 2.3, -0.8], [-0.4, -1.1, -2.6], [3.1, -0.2, 0.9]].map((v) => v.slice(0, din));
      let affine = finite(T0);
      for (let i = 0; i < samples.length && affine; i++) {
        const u = samples[i], v = samples[(i + 2) % samples.length], c = [2.5, -1.5, 0.3, 4, -3][i];
        if (!near(G(add(u, v)), add(G(u), G(v))) || !near(G(scale(u, c)), scale(G(u), c))) affine = false;
      }
      const lin = affine && near(T0, Array(dout).fill(0));
      const A = affine ? Array.from({ length: dout }, (_, i) => Ei.map((e) => G(e)[i])) : null;
      return { type: lin ? 'lineal' : affine ? 'afin' : 'no', T0, A };
    };
    const classify = () => classifyF(T, n, m);

    // --- posiciones durante la animación ---
    const steps = () => (shared.anim === 'coord' ? D : shared.anim === 'afin' ? 2 : 1);
    let info = classify();
    const place = (p, s) => {
      const st = pad(p, D), Tp = T(p);
      if (!finite(Tp)) return null;
      const en = pad(Tp, D);
      if (shared.anim === 'todo') return st.map((x, k) => x + (en[k] - x) * s);
      if (shared.anim === 'afin' && info.A) {
        const mid = pad(info.A.map((r) => r.reduce((acc, a, j) => acc + a * p[j], 0)), D);
        return s <= 0.5 ? st.map((x, k) => x + (mid[k] - x) * 2 * s) : mid.map((x, k) => x + (en[k] - x) * (2 * s - 1));
      }
      return st.map((x, k) => x + (en[k] - x) * clamp(s * D - k, 0, 1));
    };

    // --- escena ---
    const L = n === 2 ? (D === 2 ? 5 : 3) : 2, S = n === 2 ? (D === 2 ? 50 : 30) : 16;
    const lines = [];
    const sampleLine = (fix, dir) => Array.from({ length: S + 1 }, (_, k) => { const p = [...fix]; p[dir] = -L + (2 * L * k) / S; return p; });
    if (n === 2) for (let a = -L; a <= L; a++) { lines.push(sampleLine([a, 0], 1), sampleLine([0, a], 0)); }
    else for (let a = -L; a <= L; a++) for (let b = -L; b <= L; b++) lines.push(sampleLine([0, a, b], 0), sampleLine([a, 0, b], 1), sampleLine([a, b, 0], 2));
    const box = n === 2
      ? [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]]
      : [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]].flatMap((a, i, all) => all.slice(i + 1).filter((b) => norm(sub(a, b)) === 1).map((b) => [a, b]));
    const boxLines = box.map(([a, b]) => Array.from({ length: 13 }, (_, k) => add(a, scale(sub(b, a), k / 12))));

    const ghost = new Segments(stage, C.grid, { opacity: D === 2 ? 0.18 : 0.1 });
    const grid = new Segments(stage, C.grid, { opacity: D === 2 ? 0.75 : 0.45 });
    const boxSeg = new Segments(stage, '#20c997', { opacity: 0.95 });
    const eArr = [0, 1, 2].map((j) => new Arrow(stage, BASIS[j].color, { radius: 0.045, label: ' ' }));
    // «Operar», suma: T(x) y S(x) por separado
    const tArr = new Arrow(stage, C.u, { radius: 0.035, opacity: 0.8, label: R`T(\vec x)` });
    const sArr = new Arrow(stage, C.v, { radius: 0.035, opacity: 0.8, label: R`S(\vec x)` });
    const sArr2 = new Arrow(stage, C.v, { radius: 0.025, opacity: 0.35 });
    // «Analizar T»: núcleo (rojo), imagen (verde) y direcciones propias (colores)
    const KER = C.x2, IMG = '#51cf66', EIG = [C.u, C.v, '#20c997'];
    const kerLine = new LineView(stage, KER, { radius: 0.03 });
    const kerPlane = D === 3 ? new PlaneView(stage, KER, { opacity: 0.16 }) : null;
    const imgLine = new LineView(stage, IMG, { radius: 0.03 });
    const imgPlane = D === 3 ? new PlaneView(stage, IMG, { opacity: 0.16 }) : null;
    const kArr = [0, 1, 2].map((i) => new Arrow(stage, KER, { radius: 0.05, label: R`\vec k_${i + 1}` }));
    const eigLines = [0, 1, 2].map((i) => new LineView(stage, EIG[i], { radius: 0.02 }));
    const eigArr = EIG.flatMap((c) => [0, 1].map(() => new Arrow(stage, c, { radius: 0.05, label: ' ' }))); // dos por color (un plano propio)
    const hideAn = () => {
      [kerLine, imgLine, ...eigLines].forEach((l) => l.setVisible(false));
      kerPlane?.setVisible(false); imgPlane?.setVisible(false);
      [...kArr, ...eigArr].forEach((a) => a.setVisible(false));
    };
    const oDot = new Dot(stage, C.x2, { radius: 0.11 });
    const xg = new Arrow(stage, C.x, { opacity: 0.4, radius: 0.025, label: R`\vec x` });
    const xa = new Arrow(stage, C.w, { radius: 0.045, label: ' ' });
    const toSegs = (pls, s) => {
      const out = [];
      for (const pl of pls) {
        let prev = null;
        for (const p of pl) {
          const q = s == null ? pad(p, D) : place(p, s);
          if (prev && q) out.push(prev, q);
          prev = q;
        }
      }
      return out;
    };
    let ghostKey = '';
    const setGhost = (key, segs) => { if (ghostKey !== key) { ghostKey = key; ghost.set(segs()); } };
    // dimensión del vector x que se arrastra: la entrada de lo que se está mirando
    const xDim = () => (shared.tab === 'op' && shared.op === 'tr' && info.type === 'lineal' ? m : n);
    stage.addHandle({ color: C.x, get: () => pad(shared.x[xDim()], D), set: (p) => { stop(); stopOp(); const d = xDim(); shared.x[d] = p.slice(0, d); update(); } });

    // rejillas para cualquier espacio de partida (ℝ² o ℝ³)
    const geoCache = {};
    const geoFor = (d) => geoCache[d] ??= (() => {
      const Ld = d === 2 ? (D === 2 ? 5 : 3) : 2, Sd = d === 2 ? (D === 2 ? 50 : 30) : 16, ls = [];
      const sl = (fix, dir) => Array.from({ length: Sd + 1 }, (_, k) => { const p = [...fix]; p[dir] = -Ld + (2 * Ld * k) / Sd; return p; });
      if (d === 2) for (let a = -Ld; a <= Ld; a++) ls.push(sl([a, 0], 1), sl([0, a], 0));
      else for (let a = -Ld; a <= Ld; a++) for (let b = -Ld; b <= Ld; b++) ls.push(sl([0, a, b], 0), sl([a, 0, b], 1), sl([a, b, 0], 2));
      const bx = d === 2
        ? [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]]
        : [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]].flatMap((a, i, all) => all.slice(i + 1).filter((b) => norm(sub(a, b)) === 1).map((b) => [a, b]));
      const O0 = Array(d).fill(0);
      return { lines: ls, box: bx.map(([a, b]) => Array.from({ length: 13 }, (_, k) => add(a, scale(sub(b, a), k / 12)))), O: O0, E: O0.map((_, j) => O0.map((__, i) => (i === j ? 1 : 0))) };
    })();
    const segsWith = (pls, fn) => {
      const out = [];
      for (const pl of pls) {
        let prev = null;
        for (const p of pl) { const q = fn(p); if (prev && q) out.push(prev, q); prev = q; }
      }
      return out;
    };

    // --- panel ---
    const kindChips = chips(Object.entries(KINDS).map(([k, v]) => [k, v.label]), () => shared.kind, switchTo);
    const errNote = new Note(), cT = new TexBox();
    const fields = exprs.map((txt, i) => {
      const inp = h('input', { type: 'text', class: 'expr', value: txt, spellcheck: 'false', autocomplete: 'off' });
      inp.addEventListener('input', () => { stop(); exprs[i] = inp.value; compile(i); refreshAll(); });
      return { inp, row: h('label', { class: 'expr-row' }, tex(OUT[i]), '=', inp) };
    });
    const pre = h('div', { class: 'presets' }, PRE[kind].map(([name, ex]) => h('button', {
      class: 'chip', onclick: () => {
        ex.forEach((t, i) => { exprs[i] = t; fields[i].inp.value = t; compile(i); });
        refreshAll();
        if (shared.tab === 'op') runOp(0, 1); else if (shared.tab === 'an') runAn(0, 1); else run(0, 1);
      },
    }, name)));
    const animChips = chips([['coord', 'Coordenada por coordenada'], ['todo', 'Todo a la vez'], ['afin', 'Parte lineal, luego traslación']],
      () => shared.anim, (k) => { stop(); shared.anim = k; shared.s = 0; update(); });
    const ss = slider({ label: 's', min: 0, max: 1, step: 0.005, get: () => shared.s, set: (v) => { stop(); shared.s = v; update(); } });
    const run = (a, b) => { stop(); shared.s = a; update(); stop = animate(a, b, Math.max(500, 1400 * Math.abs(b - a) * steps()), (v) => { shared.s = v; update(); }); };
    const next = () => {
      const k = steps(), target = Math.min(1, (Math.floor(shared.s * k + 1e-6) + 1) / k);
      run(shared.s >= 0.999 ? 0 : shared.s, shared.s >= 0.999 ? 1 / k : target);
    };
    const phase = new Note(), cStep = new TexBox();
    const cTests = new TexBox(), nLin = new Note(), cM = new TexBox(), nM = new Note();
    const ex = vecEditor({ name: R`\vec x`, color: C.x, dim: n, get: () => shared.x[n], set: (v) => { stop(); shared.x[n] = v; update(); } });
    const cX = new TexBox(), nX = new Note();

    // ---------- pestaña «Operar» ----------
    const tb = tabs([['una', 'Una función'], ['op', 'Operar'], ['an', 'Analizar T']], () => shared.tab, (k) => {
      stop(); stopOp(); shared.tab = k; tb.refresh(); rebuildS(); update();
      if (k === 'op') runOp(0, 1); else if (k === 'an') runAn(0, 1);
    });
    let stopOp = () => {};
    // ---------- pestaña «Analizar T» ----------
    const runAn = (a, b) => { stopOp(); shared.sa = a; update(); stopOp = animate(a, b, 1500, (v) => { shared.sa = v; update(); }); };
    const anChips = chips([['det', 'Determinante'], ['nuc', 'Núcleo'], ['img', 'Imagen'], ['eig', 'Autovalores']], () => shared.an,
      (k) => { stopOp(); shared.an = k; update(); runAn(0, 1); });
    const anDesc = new Note(), anWarn = new Note();
    const sa = slider({ label: 's', min: 0, max: 1, step: 0.005, get: () => shared.sa, set: (v) => { stopOp(); shared.sa = v; update(); } });
    const anPhase = new Note();
    const anBoxes = [0, 1, 2, 3].map(() => new TexBox()), anNote = new Note(), anNote2 = new Note();
    const runOp = (a, b) => { stopOp(); shared.so = a; update(); stopOp = animate(a, b, 1300 * Math.max(1, opStages()), (v) => { shared.so = v; update(); }); };
    const opChips = chips(OPS, () => shared.op, (k) => { stopOp(); shared.op = k; rebuildS(); update(); runOp(0, 1); });
    const opDesc = new Note();
    const orderChips = chips([['TS', 'T ∘ S: primero S'], ['ST', 'S ∘ T: primero T']], () => shared.order, (k) => { stopOp(); shared.order = k; rebuildS(); update(); runOp(0, 1); });
    const sSig = new TexBox(), sFields = h('div'), sPre = h('div', { class: 'presets' }), sErr = new Note();
    const sCard = card('La otra función S', orderChips.el, sSig.el, sFields, sErr.el, sPre);
    const ks = slider({ label: 'k', min: -3, max: 3, step: 0.1, get: () => shared.k, set: (v) => { stopOp(); shared.k = Math.round(v * 10) / 10; update(); } });
    const kCard = card('El número k', ks.el);
    const cRes = new TexBox(), cRes2 = new TexBox(), cRes3 = new TexBox(), nRes = new Note();
    const so = slider({ label: 's', min: 0, max: 1, step: 0.005, get: () => shared.so, set: (v) => { stopOp(); shared.so = v; update(); } });
    const opPhase = new Note();
    // un editor por dimensión: el vector de partida es de ℝⁿ, salvo en la transpuesta (ℝᵐ)
    const exEds = Object.fromEntries([2, 3].map((d) => [d, vecEditor({ name: R`\vec x`, color: C.x, dim: d, get: () => shared.x[d], set: (v) => { stopOp(); shared.x[d] = v; update(); } })]));
    const exOpBox = h('div');
    const cOpX = new TexBox(), nOpX = new Note(), cMat = new TexBox(), nMat = new Note();
    const go = (id) => () => { location.hash = `#${id}`; };
    const linkRow = buttonRow(button('Producto de matrices →', go('producto')), button('Suma de matrices →', go('sumamat')),
      button('Inversa →', go('inversa')), button('Transpuesta →', go('transpuesta')));

    // la segunda función S
    const opS = { sig: '', vars: [], din: 2, dout: 2, trees: [], errors: [] };
    const sigOf = () => (shared.op === 'suma' ? `${n}${m}` : shared.op === 'comp' ? (shared.order === 'TS' ? `${n}${n}` : `${m}${m}`) : '');
    const Sf = (p) => { const e = Object.fromEntries(opS.vars.map((v, i) => [v, p[i]])); return opS.trees.map((t) => evalExpr(t, e)); };
    function rebuildS() {
      const sig = sigOf();
      orderChips.el.style.display = shared.op === 'comp' ? '' : 'none';
      sCard.style.display = sig ? '' : 'none';
      kCard.style.display = shared.op === 'esc' ? '' : 'none';
      if (!sig || sig === opS.sig) return;
      const din = +sig[0], dout = +sig[1], sv = VAR.slice(0, din), ex = shared.sEx[sig];
      Object.assign(opS, { sig, vars: sv, din, dout, trees: ex.map(() => ({ t: 'num', v: 0 })), errors: ex.map(() => null) });
      const comp = (i) => {
        try { opS.trees[i] = parse(ex[i], sv); opS.errors[i] = null; } catch (e) { if (!(e instanceof ExprError)) throw e; opS.errors[i] = e.message; }
      };
      ex.forEach((_, i) => comp(i));
      const fs = ex.map((txt, i) => {
        const inp = h('input', { type: 'text', class: 'expr', value: txt, spellcheck: 'false', autocomplete: 'off' });
        inp.addEventListener('input', () => { stopOp(); ex[i] = inp.value; comp(i); update(); });
        return { inp, row: h('label', { class: 'expr-row' }, tex(`S_${i + 1}`), '=', inp) };
      });
      opS.fields = fs;
      sFields.replaceChildren(h('div', { class: 'expr-box' }, ...fs.map((f) => f.row)));
      sPre.replaceChildren(...SPRE[sig].map(([name, e]) => h('button', {
        class: 'chip', onclick: () => { e.forEach((t, i) => { ex[i] = t; fs[i].inp.value = t; comp(i); }); update(); runOp(0, 1); },
      }, name)));
      sSig.set(R`S: \mathbb{R}^${din} \to \mathbb{R}^${dout},\quad S(${sv.join(', ')})`);
    }

    panel.append(
      ...intro('Transformaciones como funciones',
        R`Una transformación es una <b>función</b>: entra un vector y sale otro. Aquí se escribe con fórmulas, como $T(x, y) = (2x + y,\ x + 2y)$, y se ve aplicarse poco a poco. Luego se comprueba si es <b>lineal</b>, es decir, si respeta sumas y múltiplos. Las lineales son exactamente las que se pueden escribir con una matriz.`),
      card('Tipo', kindChips.el, rich(D === 2 ? R`$\mathbb{R}^2 \to \mathbb{R}^2$ se ve en la vista 2D; los demás tipos abren la vista 3D.` : R`En 3D, $\mathbb{R}^2$ es el plano $z = 0$. ${n === 3 && m === 2 ? 'La salida cae en ese plano.' : n === 2 ? 'La entrada es ese plano y la salida puede salirse de él.' : ''}`, 'p', 'note')),
      card('La fórmula', h('div', { class: 'expr-box' }, ...fields.map((f) => f.row)), errNote.el, pre, cT.el,
        rich(R`Se puede escribir $2x$, $x\cdot y$, $x^2$, $(x+y)/2$, $\sin(y)$, $\cos$, $\exp$, $\sqrt{\ }$… Las variables son ${vars.map((v) => `$${v}$`).join(', ')}.`, 'p', 'note')),
      tb.el, tb.panes.una, tb.panes.op, tb.panes.an,
    );
    tb.panes.op.append(
      card('Operación', opChips.el, opDesc.el),
      sCard, kCard,
      card('Resultado', cRes.el, cRes2.el, cRes3.el, nRes.el),
      card('Verla', so.el, buttonRow(button('▶ Animar', () => runOp(0, 1), 'primary'), button('↺ Inicio', () => { stopOp(); shared.so = 0; update(); })), opPhase.el),
      card('Con un vector', exOpBox, cOpX.el, nOpX.el),
      details('Lo mismo con matrices', cMat.el, nMat.el, linkRow),
    );
    tb.panes.an.append(
      card('Qué mirar', anChips.el, anDesc.el, anWarn.el),
      card('Aplicar T', sa.el, buttonRow(button('▶ Animar', () => runAn(0, 1), 'primary'), button('↺ Inicio', () => { stopOp(); shared.sa = 0; update(); })), anPhase.el),
      card('Cálculo desde la fórmula', ...anBoxes.map((b) => b.el), anNote.el, anNote2.el),
    );
    tb.panes.una.append(
      card('Aplicar poco a poco', animChips.el, ss.el,
        buttonRow(button('Siguiente paso ▶', next, 'primary'), button('▶ Todo seguido', () => run(0, 1)), button('↺ Inicio', () => { stop(); shared.s = 0; update(); })),
        phase.el, cStep.el),
      card('¿Es lineal?', cTests.el, nLin.el),
      card('La matriz', cM.el, nM.el),
      card('Un vector x', ex.el, cX.el, nX.el),
      details('Definición formal',
        rich(R`Una función $T: \mathbb{R}^n \to \mathbb{R}^m$ es <b>lineal</b> si para todos los vectores $\vec u, \vec v$ y todo escalar $c$: $T(\vec u + \vec v) = T(\vec u) + T(\vec v)$ y $T(c\vec u) = c\,T(\vec u)$. De ahí sale gratis $T(\vec 0) = \vec 0$ (tomando $c = 0$).`),
        rich(R`<b>Teorema:</b> $T$ es lineal si y solo si existe una matriz $A$ de $m\times n$ con $T(\vec x) = A\vec x$. Su columna $j$ es $T(\vec e_j)$: como $\vec x = x_1\vec e_1 + \dots + x_n\vec e_n$, la linealidad da $T(\vec x) = x_1T(\vec e_1) + \dots + x_nT(\vec e_n)$.`),
        rich(R`En fórmulas: $T$ es lineal cuando cada coordenada es una suma de términos «número $\times$ variable», sin constantes sueltas, sin potencias ni productos de variables y sin funciones como $\sin$.`),
        rich(R`Una transformación <b>afín</b> es $T(\vec x) = A\vec x + \vec b$: lineal más una traslación. No es lineal (si $\vec b \ne \vec 0$), pero conserva rectas y paralelas. En gráficos por computadora se vuelve lineal agregando una coordenada extra (coordenadas homogéneas).`),
        rich(R`Las pruebas con vectores concretos solo pueden <b>refutar</b> la linealidad. Para demostrarla hay que verlo en general, por ejemplo, encontrando la matriz.`)),
      tryList([
        n === 2 && m === 2
          ? R`Con «Autovalores», pon $\vec x = (1, 1)$: sale $T(\vec x) = (3, 3) = 3\vec x$, solo se estira (autovalor 3). Con $\vec x = (1, -1)$ sale el mismo vector (autovalor 1). Cualquier otro $\vec x$ cambia de dirección.`
          : n === 3 && m === 3
            ? R`Con «Autovalores», pon $\vec x = (1, 1, 0)$ o $(0, 0, 1)$: $T(\vec x) = 3\vec x$. Con $(1, -1, 0)$: $T(\vec x) = \vec x$. Esos son los autovectores; los demás vectores cambian de dirección.`
            : R`Los autovalores solo tienen sentido cuando entrada y salida son el mismo espacio ($\mathbb{R}^2 \to \mathbb{R}^2$ o $\mathbb{R}^3 \to \mathbb{R}^3$): aquí $T(\vec x)$ y $\vec x$ viven en espacios distintos, no se pueden comparar.`,
        n === 2 && m === 2 ? R`Con «Afín: cizallar y bajar», pulsa «Siguiente paso» dos veces: primero cambia solo $x'$ (la rejilla se cizalla), luego $y'$ (todo baja una unidad). El punto rosa es la imagen del origen: si se mueve, no es lineal.` : null,
        n === 2 && m === 2 ? R`En esa misma afín, borra el «− 1» de la fórmula: pasa a ser lineal y aparece la matriz.` : null,
        R`Prueba una fórmula no lineal: la rejilla se <b>curva</b>. Las lineales siempre mandan rectas a rectas y conservan el espaciado de la rejilla.`,
        n === 3 && m === 2 ? R`En $\mathbb{R}^3 \to \mathbb{R}^2$, el último paso descarta la $z$: todo el espacio cae al plano.` : n === 2 && m === 3 ? R`En $\mathbb{R}^2 \to \mathbb{R}^3$, el último paso levanta el plano: aparece la tercera coordenada.` : R`Cambia a «Parte lineal, luego traslación» con una afín: se ve $A\vec x$ y después $+\vec b$.`,
      ].filter(Boolean)),
    );

    function refreshAll() {
      info = classify();
      if (shared.anim === 'afin' && !info.A) shared.anim = 'coord';
      update();
    }

    function update() {
      tArr.setVisible(false); sArr.setVisible(false); sArr2.setVisible(false);
      hideAn();
      if (shared.tab === 'op') updateOp(); else if (shared.tab === 'an') updateAn(); else updateUna();
    }

    // ---------- «Analizar T» ----------
    function updateAn() {
      const what = shared.an, s = shared.sa, A = info.A, sq = n === m;
      [sa, anChips].forEach((c) => c.refresh());
      anDesc.set('', {
        det: R`Cuánto agranda o achica $T$ las áreas${n === 3 ? ' y volúmenes' : ''}: mira ${n === 2 ? 'el cuadrado' : 'el cubo'} verde.`,
        nuc: R`Qué vectores manda $T$ al origen: las soluciones de $T(\vec x) = \vec 0$.`,
        img: R`Todo lo que $T$ puede producir: hacia dónde cae la rejilla entera.`,
        eig: R`Las direcciones que $T$ no gira: $T(\vec x) = \lambda\vec x$.`,
      }[what]);
      const box = (i, t) => anBoxes[i].set(t ?? '');
      anBoxes.forEach((b) => b.set(''));
      anNote.set('', ''); anNote2.set('', '');

      // escena: T aplicada «todo a la vez» con la parte lineal (la traslación no cambia nada de esto)
      const Tl = A ? (p) => matVec(A, p) : T;
      const placeA = (p, t) => { const q = Tl(p); return finite(q) ? pad(p, D).map((v, i) => v + (pad(q, D)[i] - v) * t) : null; };
      setGhost('una', () => toSegs(lines, null));
      grid.set(segsWith(lines, (p) => placeA(p, s)));
      boxSeg.set(segsWith(boxLines, (p) => placeA(p, s)));
      oDot.setVisible(false);
      eArr.forEach((a, j) => {
        if (j >= n) return a.setVisible(false);
        const q = placeA(E[j], s);
        a.setVisible(!!q);
        if (q) a.set(pad(O, D), q).setLabel(s < 0.01 ? R`\vec e_${j + 1}` : s > 0.99 ? R`T(\vec e_${j + 1})` : '');
      });
      const x = shared.x[n];
      xg.set(pad(O, D), pad(x, D));
      const qx = placeA(x, s);
      xa.setVisible(!!qx && what === 'eig');
      xg.setVisible(what === 'eig');
      if (qx) xa.set(pad(O, D), qx).setLabel(s > 0.99 ? R`T(\vec x)` : '');
      anPhase.set(s > 0.995 ? 'pos' : '', s < 0.005 ? R`Antes de aplicar $T$.` : s > 0.995 ? R`Después de aplicar $T$.` : R`Aplicando $T$…`);

      if (!A) {
        anWarn.set('neg', R`<b>$T$ no es lineal</b>, así que no tiene matriz y estas herramientas no se aplican tal cual: una función no lineal estira de forma distinta en cada zona. (En cálculo se analiza por zonas con la matriz de derivadas, la <i>jacobiana</i>.)`);
        xg.setVisible(true);
        return;
      }
      anWarn.set(info.type === 'afin' ? 'zero' : '', info.type === 'afin' ? R`$T$ es afín: se analiza su parte lineal $A\vec x$. La traslación $\vec b = ${tv(info.T0)}$ mueve todo sin deformarlo, así que no cambia áreas, núcleo ni direcciones.` : '');
      const rows = affTex(A, null, vars);

      if (what === 'det') {
        if (sq) {
          const d = det(A);
          if (n === 2) {
            const [[a, b], [c, dd]] = A;
            box(0, R`\begin{gathered}${OUT[0]} = ${clr(C.u, fmt(a))}x ${b < 0 ? '-' : '+'} ${clr(C.u, fmt(Math.abs(b)))}y \\ ${OUT[1]} = ${clr(C.v, fmt(c))}x ${dd < 0 ? '-' : '+'} ${clr(C.v, fmt(Math.abs(dd)))}y\end{gathered}`);
            box(1, R`\det A = ad - bc = ${pf(a)}\cdot${pf(dd)} - ${pf(b)}\cdot${pf(c)} = ${clr(C.w, fmt(d))}`);
          } else {
            box(0, R`A = ${tm(A)}`);
            box(1, R`\det A = ${clr(C.w, fmt(d))}`);
          }
          const unit = n === 2 ? 'área' : 'volumen', fig = n === 2 ? 'el cuadrado unidad' : 'el cubo unidad';
          anNote.set(Math.abs(d) < 1e-9 ? 'neg' : 'pos', Math.abs(d) < 1e-9
            ? R`$\det A = 0$: ${fig} queda <b>aplastado</b> (${unit} 0). $T$ pierde una dimensión: no tiene inversa y su núcleo no es solo $\vec 0$.`
            : R`${fig.charAt(0).toUpperCase() + fig.slice(1)} (${unit} 1) se convierte en un ${n === 2 ? 'paralelogramo' : 'paralelepípedo'} de ${unit} $|\det A| = ${fmt(Math.abs(d))}$. <b>Toda</b> figura cambia su ${unit} por ese mismo factor, porque $T$ estira igual en todas partes.${d < 0 ? ' El signo negativo dice que además <b>voltea</b> la orientación (como un espejo).' : ''}`);
          anNote2.set('', n === 2 ? R`Los números salen directo de la fórmula: $a, b$ son los coeficientes de $${OUT[0]}$ y $c, d$ los de $${OUT[1]}$.` : R`Se calcula por cofactores o escalonando (ver «Determinante»).`);
        } else if (n === 2) {
          const c1 = A.map((r) => r[0]), c2 = A.map((r) => r[1]), w = cross(c1, c2);
          box(0, R`T(\vec e_1) = ${tv(c1)},\quad T(\vec e_2) = ${tv(c2)}`);
          box(1, R`\|T(\vec e_1)\times T(\vec e_2)\| = \|${tv(w)}\| = ${clr(C.w, fmt(norm(w)))}`);
          anNote.set('zero', R`$T$ va de $\mathbb{R}^2$ a $\mathbb{R}^3$: la matriz es de 3×2 y <b>no tiene determinante</b>. Pero el cuadrado unidad sí se convierte en un paralelogramo dentro de $\mathbb{R}^3$, y su área se mide con el producto cruz: <b>factor de área</b> ${fmt(norm(w))}.${norm(w) < 1e-9 ? ' Es 0: el plano se aplasta a una recta.' : ''}`);
          anNote2.set('', R`Ese factor también es $\sqrt{\det(A^{\mathsf T}A)} = \sqrt{${fmt(det(matMul(transpose(A), A)))}}$.`);
        } else {
          box(0, R`A = ${tm(A)}\quad (2\times3)`);
          anNote.set('zero', R`$T$ va de $\mathbb{R}^3$ a $\mathbb{R}^2$: <b>no tiene determinante</b> (la matriz no es cuadrada). Todo el espacio cae en un plano, así que cualquier volumen termina en 0: siempre se pierde al menos una dimensión (mira el núcleo).`);
        }
        return;
      }

      const S0 = solveSystem(A, Array(m).fill(0)), ker = S0.nullBasis, r = S0.rank;
      const eqs = R`\begin{cases}${rows.map((t) => `${t} = 0`).join('\\\\')}\end{cases}`;
      if (what === 'nuc') {
        box(0, R`T(\vec x) = \vec 0:\quad ${eqs}`);
        if (!ker.length) {
          box(1, R`\text{solución única: } \vec x = \vec 0`);
          anNote.set('pos', R`Solo el origen va a parar al origen: el núcleo es $\{\vec 0\}$ (dimensión 0). $T$ no aplasta nada${sq ? ' y tiene inversa' : ''}: puntos distintos van a sitios distintos.`);
        } else {
          box(1, R`\text{libres: } ${S0.free.map((f) => vars[f]).join(', ')}`);
          box(2, R`\vec x = ${S0.free.map((f, i) => `${vars[f]}\\,${clr(KER, tv(ker[i]))}`).join(' + ')}`);
          anNote.set('neg', R`El núcleo es ${ker.length === 1 ? 'una <b>recta</b>' : ker.length === 2 ? 'un <b>plano</b>' : 'todo el espacio'} (dimensión ${ker.length}), en rojo. Al animar, las flechas rojas se encogen hasta el origen: ${ker.length === 1 ? 'toda esa recta' : 'todo ese plano'} se pierde. Consecuencia: puntos que difieren en un vector del núcleo van a parar <b>al mismo sitio</b>.`);
          anNote2.set('', R`Se resuelve como cualquier sistema: igualando cada fórmula a 0 y escalonando (ver «Rango, núcleo y nulidad»).`);
          if (ker.length === 1) kerLine.setVisible(true).set(pad(O, D), pad(ker[0], D));
          else if (ker.length === 2 && D === 3) kerPlane.setVisible(true).set([0, 0, 0], cross(pad(ker[0], 3), pad(ker[1], 3)));
          ker.forEach((k, i) => { const q = placeA(k, s); if (q) kArr[i].setVisible(true).set(pad(O, D), q); });
        }
        return;
      }
      if (what === 'img') {
        const cols = E.map((e) => A.map((row) => matVec([row], e)[0]));
        box(0, R`T(${vars.join(', ')}) = ${vars.map((v, j) => `${v}\\,${tv(cols[j])}`).join(' + ')}`);
        box(1, r ? R`\text{Im}\,T = \text{span}\left\{${S0.pivots.map((j) => clr(IMG, tv(cols[j]))).join(',\\ ')}\right\}` : R`\text{Im}\,T = \{\vec 0\}`);
        box(2, R`\underbrace{${r}}_{\dim \text{Im}} + \underbrace{${ker.length}}_{\dim \text{Ker}} = ${n}`);
        const where = r === m ? (m === 2 ? 'todo el plano' : 'todo el espacio') : r === 2 ? 'un <b>plano</b>' : r === 1 ? 'una <b>recta</b>' : 'solo el origen';
        anNote.set(r === m ? 'pos' : 'zero', R`Separando cada variable, $T(\vec x)$ es una <b>combinación de las columnas</b> $T(\vec e_j)$. Lo que puede producir es todo lo que esas columnas generan: ${where} (dimensión ${r}, el <b>rango</b>).${r < m ? ` Los puntos fuera de ${r === 1 ? 'esa recta' : 'ese plano'} (en verde) no son $T$ de nada: $T(\\vec x) = \\vec b$ no tiene solución para ellos.` : ''}${r < n ? ' Las columnas que sobran son combinación de las otras.' : ''}`);
        anNote2.set('', R`<b>Teorema del rango:</b> cada dimensión de la entrada o sobrevive (imagen) o se pierde (núcleo): ${r} + ${ker.length} = ${n}.`);
        const ic = S0.pivots.map((j) => cols[j]);
        if (r === 1) imgLine.setVisible(s > 0.5).set(pad(O, D), pad(ic[0], D));
        else if (r === 2 && m === 3) imgPlane.setVisible(s > 0.5).set([0, 0, 0], cross(ic[0], ic[1]));
        return;
      }
      // autovalores
      if (!sq) {
        anNote.set('zero', R`Los autovalores solo tienen sentido si $T$ va de un espacio a <b>sí mismo</b> ($\mathbb{R}^2 \to \mathbb{R}^2$ o $\mathbb{R}^3 \to \mathbb{R}^3$): aquí $T(\vec x)$ y $\vec x$ viven en espacios distintos y no se puede pedir que $T(\vec x) = \lambda\vec x$.`);
        return;
      }
      const Ev = eigen(A), pA = n === 2 ? Ev.poly : Ev.poly.map((c) => -c);
      box(0, R`T(\vec x) = \lambda\vec x:\quad \begin{cases}${rows.map((t, i) => `${t} = \\lambda ${vars[i]}`).join('\\\\')}\end{cases}`);
      box(1, R`\det(A - \lambda I) = ${polyTex(pA)} = 0`);
      if (!Ev.values.length) {
        anNote.set('neg', R`El polinomio no tiene raíces reales: <b>ninguna dirección se conserva</b>, todo gira. Al animar, ninguna recta por el origen se queda en su sitio.`);
        return;
      }
      box(2, Ev.values.map(({ lambda }, i) => clr(EIG[i], R`\lambda_${i + 1} = ${fmt(lambda)}`)).join(R`,\ `));
      box(3, R`\begin{gathered}${Ev.values.map(({ lambda, vectors }, i) => R`\lambda = ${fmt(lambda)}:\ ${vectors.map((v) => clr(EIG[i], tv(v))).join(',\\ ')}`).join(' \\\\[4pt] ')}\end{gathered}`);
      const total = Ev.values.reduce((a, v) => a + v.vectors.length, 0);
      anNote.set('pos', R`Pasando todo a un lado, $T(\vec x) = \lambda\vec x$ es $(A - \lambda I)\vec x = \vec 0$, que solo tiene soluciones no nulas si $\det(A - \lambda I) = 0$. Al animar, las flechas de colores <b>no se salen de sus rectas</b>: solo se estiran por su $\lambda$.${total < n ? ` Solo hay ${total} dirección${total === 1 ? '' : 'es'} propia${total === 1 ? '' : 's'} independiente${total === 1 ? '' : 's'}: no alcanzan para una base (no es diagonalizable).` : ''}`);
      anNote2.set('', R`Mueve $\vec x$ (cian) hasta una recta de color: $T(\vec x)$ queda sobre ella.`);
      Ev.values.forEach(({ lambda, vectors }, i) => vectors.slice(0, 2).forEach((v, q) => {
        if (vectors.length === 1) eigLines[i].setVisible(true).set(pad(O, D), pad(v, D));
        const p = placeA(scale(normalize(v), 1.5), s);
        if (p) eigArr[2 * i + q].setVisible(true).set(pad(O, D), p).setLabel(q ? '' : s > 0.99 ? R`${fmt(lambda)}\,\vec v_${i + 1}` : R`\vec v_${i + 1}`);
      }));
    }

    // ---------- modelo de cada operación ----------
    const opStages = () => opModel().stages?.length ?? 1;
    function opModel() {
      const op = shared.op, Tc = info, k = shared.k;
      const linT = Tc.type === 'lineal', affT = !!Tc.A;
      const Vn = vars, Vm = VAR.slice(0, m);
      if (op === 'comp') {
        const Sc = classifyF(Sf, opS.din, opS.dout), TS = shared.order === 'TS';
        const first = TS ? { f: Sf, c: Sc, trees: opS.trees, nm: 'S' } : { f: T, c: Tc, trees, nm: 'T' };
        const second = TS ? { f: T, c: Tc, trees, nm: 'T' } : { f: Sf, c: Sc, trees: opS.trees, nm: 'S' };
        const F = (p) => second.f(first.f(p));
        const mid = TS ? n : m, mp = Object.fromEntries(VAR.slice(0, mid).map((v, i) => [v, first.trees[i]]));
        const fn = `${second.nm}\\circ ${first.nm}`;
        return {
          ok: true, d0: n, dout: m, F, fn, Fc: classifyF(F, n, m),
          stages: [{ f: first.f, nm: first.nm }, { f: second.f, nm: second.nm }],
          sym: second.trees.map((t) => texExpr(subst(t, mp))), symHead: R`${second.nm}\big(${first.nm}(${Vn.join(', ')})\big)`,
          pieces: [first, second],
        };
      }
      if (op === 'suma') {
        const Sc = classifyF(Sf, n, m), F = (p) => add(T(p), Sf(p));
        return {
          ok: true, d0: n, dout: m, F, fn: 'T + S', Fc: classifyF(F, n, m), stages: [{ f: F, nm: 'T + S' }],
          sym: trees.map((t, i) => `\\left(${texExpr(t)}\\right) + \\left(${texExpr(opS.trees[i])}\\right)`), symHead: R`T(${Vn.join(', ')}) + S(${Vn.join(', ')})`, Sc,
        };
      }
      if (op === 'esc') {
        const F = (p) => scale(T(p), k);
        return {
          ok: true, d0: n, dout: m, F, fn: `${fmt(k)}\\,T`, Fc: classifyF(F, n, m),
          stages: [{ f: T, nm: 'T' }, { f: (q) => scale(q, k), nm: `${fmt(k)}\\cdot` }],
          sym: trees.map((t) => `${fmt(k)}\\left(${texExpr(t)}\\right)`), symHead: R`${fmt(k)}\,T(${Vn.join(', ')})`,
        };
      }
      if (op === 'inv') {
        if (n !== m) return { ok: false, msg: R`$T$ va de $\mathbb{R}^${n}$ a $\mathbb{R}^${m}$: entrada y salida tienen distinta dimensión, así que no puede haber inversa. ${n > m ? 'Al bajar de dimensión, muchos puntos caen en el mismo sitio y no se sabe a cuál volver.' : 'Al subir de dimensión, la salida es solo un plano dentro de ℝ³: los puntos fuera de él no vienen de ningún lado.'}` };
        if (!affT) return { ok: false, msg: R`$T$ no es lineal ni afín. Invertirla sería despejar ${vars.map((v) => `$${v}$`).join(', ')} de ecuaciones no lineales: a veces se puede a mano y a veces no (si dos puntos van a parar al mismo sitio). Aquí se invierten las lineales y afines, que siempre se despejan con la matriz.` };
        const A = Tc.A, dA = det(A);
        if (Math.abs(dA) < 1e-9) return { ok: false, msg: R`$\det A = 0$: $T$ aplasta el espacio (la rejilla queda en ${n === 2 ? 'una recta' : 'un plano o una recta'}). Muchos puntos van al mismo sitio, así que no se puede deshacer: <b>no hay inversa</b>.` };
        const Ai = inverse(A), b = Tc.T0, Ti = (y) => matVec(Ai, sub(y, b));
        return {
          ok: true, d0: n, dout: n, F: Ti, fn: 'T^{-1}', Fc: { type: linT ? 'lineal' : 'afin', A: Ai, T0: Ti(Array(n).fill(0)) },
          stages: [{ f: T, nm: 'T' }, { f: Ti, nm: 'T^{-1}' }], A, Ai, b,
        };
      }
      // transpuesta
      if (!linT) return { ok: false, msg: affT ? R`$T$ es afín (tiene un término constante). La transpuesta se define para transformaciones <b>lineales</b>; quítale la constante y prueba otra vez.` : R`$T$ no es lineal: no tiene matriz, y la transpuesta solo existe para transformaciones lineales.` };
      const At = transpose(Tc.A), F = (p) => matVec(At, p);
      return {
        ok: true, d0: m, dout: n, F, fn: 'T^{\\mathsf T}', Fc: { type: 'lineal', A: At, T0: Array(n).fill(0) },
        stages: [{ f: F, nm: 'T^{\\mathsf T}' }], At, Vm,
      };
    }

    function updateOp() {
      const Mo = opModel(), op = shared.op, s = shared.so;
      const fa = Mo.ok && ['comp', 'suma', 'esc'].includes(op) ? `(${Mo.fn})` : Mo.fn; // (T + S)(x), no T + S(x)
      opDesc.set('', {
        comp: R`Aplicar una función y luego otra. $T\circ S$ se lee «$T$ después de $S$»: $(T\circ S)(\vec x) = T(S(\vec x))$.`,
        suma: R`Sumar los resultados: $(T + S)(\vec x) = T(\vec x) + S(\vec x)$. Las dos tienen que ir del mismo espacio al mismo espacio.`,
        esc: R`Multiplicar el resultado por un número: $(kT)(\vec x) = k\,T(\vec x)$.`,
        inv: R`La función que <b>deshace</b> $T$: si $T(\vec x) = \vec y$, entonces $T^{-1}(\vec y) = \vec x$. Se obtiene despejando.`,
        tr: R`La función que va en sentido contrario y cumple $T(\vec u)\cdot\vec v = \vec u\cdot T^{\mathsf T}(\vec v)$. No deshace $T$: es otra cosa.`,
      }[op]);
      [so, ks, opChips, orderChips].forEach((c) => c.refresh());
      const errS = opS.errors.findIndex((e) => e);
      sErr.set(errS >= 0 && sigOf() ? 'neg' : '', errS >= 0 && sigOf() ? `S_${errS + 1}: ${opS.errors[errS]}` : '');
      opS.fields?.forEach((f, i) => f.inp.classList.toggle('bad', !!opS.errors[i]));

      // --- escena ---
      const d0 = Mo.ok ? Mo.d0 : n, G = geoFor(d0), stages = Mo.ok ? Mo.stages : [];
      setGhost(`op${d0}`, () => segsWith(G.lines, (p) => pad(p, D)));
      const K = Math.max(1, stages.length);
      const placeOp = (p, t) => {
        let cur = p;
        const pts = [p];
        for (const stg of stages) { cur = stg.f(cur); if (!finite(cur)) return null; pts.push(cur); }
        if (!stages.length) return pad(p, D);
        const kk = Math.min(K - 1, Math.floor(t * K)), loc = clamp(t * K - kk, 0, 1);
        const a = pad(pts[kk], D), b = pad(pts[kk + 1], D);
        return a.map((v, i) => v + (b[i] - v) * loc);
      };
      grid.set(segsWith(G.lines, (p) => placeOp(p, s)));
      boxSeg.set(segsWith(G.box, (p) => placeOp(p, s)));
      const o = placeOp(G.O, s);
      oDot.setVisible(!!o).set(o ?? pad(G.O, D));
      eArr.forEach((a, j) => {
        if (j >= d0) return a.setVisible(false);
        const q = placeOp(G.E[j], s);
        a.setVisible(!!q && !!o);
        if (q && o) a.set(o, q).setLabel(s < 0.01 ? R`\vec e_${j + 1}` : s > 0.99 && Mo.ok ? R`${fa}(\vec e_${j + 1})` : '');
      });
      const x = shared.x[d0];
      xg.set(pad(G.O, D), pad(x, D));
      const qx = placeOp(x, s);
      xa.setVisible(!!qx);
      if (qx) xa.set(pad(G.O, D), qx).setLabel(s > 0.99 && Mo.ok ? R`${fa}(\vec x)` : '');
      if (op === 'suma' && Mo.ok) {
        const tx = T(x), sx = Sf(x);
        if (finite(tx) && finite(sx)) {
          tArr.setVisible(true).set(pad(G.O, D), pad(tx, D));
          sArr.setVisible(true).set(pad(G.O, D), pad(sx, D));
          sArr2.setVisible(true).set(pad(tx, D), pad(add(tx, sx), D));
        }
      }
      exOpBox.firstChild !== exEds[d0].el && exOpBox.replaceChildren(exEds[d0].el);
      exEds[d0].refresh();

      if (!Mo.ok) {
        cRes.set(''); cRes2.set(''); cRes3.set('');
        nRes.set('neg', Mo.msg);
        opPhase.set('', 'No hay nada que animar: la rejilla se queda como está.');
        cOpX.set(''); nOpX.set('', ''); cMat.set(''); nMat.set('', '');
        return;
      }
      const Vin = VAR.slice(0, d0), Fc = Mo.Fc, simp = Fc.A ? affTex(Fc.A, Fc.type === 'afin' ? Fc.T0 : null, Vin) : null;
      const col = (arr) => R`\begin{bmatrix}${arr.join('\\\\')}\end{bmatrix}`;

      // --- fases de la animación ---
      const kk = Math.min(K - 1, Math.floor(s * K - 1e-9));
      opPhase.set(s > 0.995 ? 'pos' : '', s < 0.005 ? R`Inicio: la rejilla de $\mathbb{R}^${d0}$ sin transformar.`
        : s > 0.995 ? (op === 'inv' ? R`Listo: después de $T$ y $T^{-1}$ todo volvió a su sitio. $T^{-1}(T(\vec x)) = \vec x$.` : R`Listo: cada punto $\vec x$ está en $${fa}(\vec x)$.`)
          : K === 1 ? R`Cada punto viaja de $\vec x$ a $${fa}(\vec x)$.`
            : R`Paso ${kk + 1} de ${K}: se aplica $${Mo.stages[kk].nm}$${kk ? ' a lo que dejó el paso anterior' : ''}.`);

      // --- resultado ---
      if (op === 'inv') {
        const eqs = Mo.A.map((r, i) => R`${OUT[i]} = ${affTex([r], [Mo.b[i]], vars)[0]}`);
        const sol = affTex(Mo.Ai, Mo.Fc.T0, OUT.slice(0, n)).map((t, i) => R`${vars[i]} = ${t}`);
        cRes.set(R`\begin{gathered}\begin{cases}${eqs.join('\\\\')}\end{cases}\\[2pt] \Downarrow \\[4pt] \begin{cases}${sol.join('\\\\')}\end{cases}\end{gathered}`);
        cRes2.set(R`T^{-1}(${vars.join(', ')}) = ${col(simp)}`);
        cRes3.set('');
        nRes.set('pos', R`Se escribe $\vec x' = T(\vec x)$ y se despeja $\vec x$ en función de $\vec x'$ (resolviendo el sistema). Al final se cambia el nombre de las variables: ${OUT.slice(0, n).map((v, i) => `$${v} \\to ${vars[i]}$`).join(', ')}.`);
      } else if (op === 'tr') {
        cRes.set(R`T^{\mathsf T}(${Mo.Vm.join(', ')}) = ${col(simp)}`);
        cRes2.set(R`\begin{gathered}T(${vars.join(', ')}) = ${col(affTex(info.A, null, vars))} \\[4pt] T^{\mathsf T}(\vec e_j) = \text{pesos de la fórmula } j \text{ de } T\end{gathered}`);
        cRes3.set('');
        nRes.set('pos', R`Truco para leerla: la fórmula de la coordenada $j$ de $T$ dice con qué pesos se combinan ${vars.map((v) => `$${v}$`).join(', ')}. Esos mismos pesos forman el vector $T^{\mathsf T}(\vec e_j)$: <b>las filas de $T$ se vuelven columnas</b>. $T^{\mathsf T}$ va de $\mathbb{R}^${m}$ a $\mathbb{R}^${n}$, al revés que $T$.`);
      } else {
        cRes.set(R`\begin{gathered}${Mo.symHead} \\[4pt] = ${col(Mo.sym)}\end{gathered}`);
        cRes2.set('');
        cRes3.set(simp ? R`\begin{gathered}(${Mo.fn})(${Vin.join(', ')}) \\[4pt] = ${col(simp)}\end{gathered}` : '');
        const tp = { lineal: 'lineal', afin: 'afín', no: 'no lineal' }[Fc.type];
        nRes.set(Fc.type === 'no' ? 'zero' : 'pos', (simp ? R`Al simplificar queda la fórmula de abajo, y el resultado es <b>${tp}</b>.` : R`No se simplifica a una forma «número × variable»: el resultado es <b>${tp}</b>.`)
          + (op === 'comp' && n === m && info.A && Mo.pieces[0].c.A && Mo.pieces[1].c.A ? (() => {
            const other = (p) => (shared.order === 'TS' ? Sf(T(p)) : T(Sf(p)));
            const same = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]].map((v) => v.slice(0, n)).every((v) => near(other(v), Mo.F(v)));
            return same ? R` Aquí, cambiar el orden da lo mismo: $T$ y $S$ <b>conmutan</b> (pasa pocas veces).` : R` Si cambias el orden, el resultado es <b>otro</b>: componer no es conmutativo.`;
          })() : ''));
      }

      // --- con un vector ---
      const V = (w) => (finite(w) ? tv(w) : R`\text{no definido}`);
      if (op === 'comp') {
        const [f1, f2] = Mo.pieces, y1 = f1.f(x);
        cOpX.set(R`\begin{gathered}${f1.nm}(\vec x) = ${f1.nm}${tv(x)} = ${V(y1)} \\[4pt] ${f2.nm}(${f1.nm}(\vec x)) = ${f2.nm}${V(y1)} = ${clr(C.w, V(Mo.F(x)))}\end{gathered}`);
        nOpX.set('', R`Lo que sale de $${f1.nm}$ es lo que entra en $${f2.nm}$. Por eso las dimensiones tienen que encajar.`);
      } else if (op === 'suma') {
        cOpX.set(R`\begin{gathered}${clr(C.u, V(T(x)))} + ${clr(C.v, V(Sf(x)))} \\[4pt] = ${clr(C.w, V(Mo.F(x)))}\end{gathered}`);
        nOpX.set('', R`En la escena: $T(\vec x)$ (naranja) y $S(\vec x)$ (violeta) se suman con la regla del paralelogramo.`);
      } else if (op === 'esc') {
        cOpX.set(R`\begin{gathered}${shared.k < 0 ? `(${fmt(shared.k)})` : fmt(shared.k)}\cdot T${tv(x)} = ${fmt(shared.k)}\cdot ${V(T(x))} \\[4pt] = ${clr(C.w, V(Mo.F(x)))}\end{gathered}`);
        nOpX.set('', shared.k < 0 ? R`Con $k < 0$, además de estirar, el resultado se voltea al lado contrario del origen.` : '');
      } else if (op === 'inv') {
        const y = T(x);
        cOpX.set(R`\begin{gathered}T${tv(x)} = ${V(y)} \\[4pt] T^{-1}${V(y)} = ${clr(C.w, V(Mo.F(y)))}\end{gathered}`);
        nOpX.set('pos', R`$T^{-1}$ devuelve cada punto a donde estaba antes de $T$.`);
      } else {
        const u = [1, 2, -1].slice(0, n), Tu = T(u), Ttv = Mo.F(x);
        cOpX.set(R`\begin{gathered}T^{\mathsf T}${tv(x)} = ${clr(C.w, V(Ttv))} \\[4pt] \vec u = ${tv(u)} \\[4pt] T(\vec u)\cdot\vec x = ${fmt(dot(Tu, x))},\quad \vec u\cdot T^{\mathsf T}(\vec x) = ${fmt(dot(u, Ttv))}\end{gathered}`);
        nOpX.set('pos', R`Los dos productos punto dan lo mismo: esa es la propiedad que <b>define</b> la transpuesta. Medir $T(\vec u)$ con la regla $\vec x$ equivale a medir $\vec u$ con la regla $T^{\mathsf T}(\vec x)$.${n === m && near(matMul(transpose(info.A), info.A).flat(), matMul(transpose(info.A), info.A).flat().map((_, i) => (i % (n + 1) === 0 ? 1 : 0))) ? R` Además, aquí $T$ es una rotación o reflexión: $T^{\mathsf T} = T^{-1}$.` : ''}`);
      }

      // --- con matrices ---
      const Mt = (c) => (c?.A ? tm(c.A) : null);
      if (op === 'comp') {
        const [f1, f2] = Mo.pieces;
        if (f1.c.type === 'lineal' && f2.c.type === 'lineal') {
          cMat.set(R`\begin{gathered}[${Mo.fn}] = ${Mt(f2.c)}${Mt(f1.c)} \\[4pt] = ${tm(Mo.Fc.A)}\end{gathered}`);
          nMat.set('', R`Componer es <b>multiplicar matrices</b>, y la que actúa primero (${f1.nm}) va a la <b>derecha</b>, porque $${f2.nm}(${f1.nm}(\vec x)) = A_{${f2.nm}}(A_{${f1.nm}}\vec x) = (A_{${f2.nm}}A_{${f1.nm}})\vec x$.`);
        } else { cMat.set(''); nMat.set('', R`Con matrices solo se puede si las dos son lineales (o afines, añadiendo la traslación aparte).`); }
      } else if (op === 'suma') {
        if (info.type === 'lineal' && Mo.Sc.type === 'lineal') {
          cMat.set(R`\begin{gathered}[T + S] = ${tm(info.A)} + ${tm(Mo.Sc.A)} \\[4pt] = ${tm(Mo.Fc.A)}\end{gathered}`);
          nMat.set('', R`Se suman <b>entrada por entrada</b>: la columna $j$ es $T(\vec e_j) + S(\vec e_j)$.`);
        } else { cMat.set(''); nMat.set('', R`Con matrices solo se puede si las dos son lineales.`); }
      } else if (op === 'esc') {
        if (info.type === 'lineal') { cMat.set(R`\begin{gathered}[${fmt(shared.k)}\,T] = ${fmt(shared.k)}${tm(info.A)} \\[4pt] = ${tm(Mo.Fc.A)}\end{gathered}`); nMat.set('', 'Cada entrada se multiplica por $k$.'); }
        else { cMat.set(''); nMat.set('', R`Con matrices solo se puede si $T$ es lineal.`); }
      } else if (op === 'inv') {
        cMat.set(R`\begin{gathered}A^{-1} = ${tm(Mo.A)}^{-1} \\[4pt] = ${tm(Mo.Ai)}\end{gathered}`);
        nMat.set('', R`Despejar es resolver el sistema $A\vec x = \vec x'${info.type === 'afin' ? R` - \vec b` : ''}$: la matriz de $T^{-1}$ es la inversa de la de $T$.${info.type === 'afin' ? R` Como $T$ es afín, primero se deshace la traslación y luego la parte lineal.` : ''}`);
      } else {
        cMat.set(R`\begin{gathered}A^{\mathsf T} = ${tm(info.A)}^{\mathsf T} \\[4pt] = ${tm(Mo.At)}\end{gathered}`);
        nMat.set('', R`Las filas de $A$ pasan a ser columnas. $A$ es de ${m}×${n} y $A^{\mathsf T}$ de ${n}×${m}.`);
      }
    }

    function updateUna() {
      const s = shared.s, x = shared.x[n];
      // --- escena ---
      setGhost('una', () => toSegs(lines, null));
      grid.set(toSegs(lines, s));
      boxSeg.set(toSegs(boxLines, s));
      const o = place(O, s);
      oDot.setVisible(!!o).set(o ?? pad(O, D));
      eArr.forEach((a, j) => {
        if (j >= n) return a.setVisible(false);
        const q = place(E[j], s);
        a.setVisible(!!q && !!o);
        if (q && o) a.set(o, q).setLabel(s < 0.01 ? R`\vec e_${j + 1}` : s > 0.99 ? R`T(\vec e_${j + 1})` : '');
      });
      xg.set(pad(O, D), pad(x, D));
      const qx = place(x, s);
      xa.setVisible(!!qx);
      if (qx) xa.set(pad(O, D), qx).setLabel(s > 0.99 ? R`T(\vec x)` : '');
      [ss, ex, animChips, kindChips].forEach((c) => c.refresh());
      animChips.el.children[2].disabled = !info.A || info.type === 'lineal';

      // --- fórmula ---
      const err = errors.findIndex((e) => e);
      errNote.set(err >= 0 ? 'neg' : '', err >= 0 ? `${OUT[err]}: ${errors[err]} (se sigue usando la última fórmula válida)` : '');
      fields.forEach((f, i) => f.inp.classList.toggle('bad', !!errors[i]));
      const Ttex = trees.map((t) => texExpr(t));
      cT.set(R`T\begin{pmatrix}${vars.join('\\\\')}\end{pmatrix} = \begin{bmatrix}${Ttex.join('\\\\')}\end{bmatrix}`);

      // --- fase ---
      const K = steps(), k = Math.min(K - 1, Math.floor(s * K - 1e-9));
      const Tx = T(x), ok = finite(Tx);
      let ph = '', step = '';
      if (s < 0.005) ph = R`Inicio: la rejilla es $\mathbb{R}^${n}$ sin transformar. Las flechas de colores son $\vec e_1, \dots, \vec e_${n}$ y el cuadrado verde es ${n === 2 ? 'el cuadrado' : 'el cubo'} unidad.`;
      else if (s > 0.995) ph = R`Listo: cada punto $\vec x$ está en $T(\vec x)$.${info.type !== 'lineal' ? R` El punto rosa es $T(\vec 0) = ${tv(info.T0)}$.` : ''}`;
      else if (shared.anim === 'todo') ph = R`Cada punto viaja en línea recta desde $\vec x$ hasta $T(\vec x)$.`;
      else if (shared.anim === 'afin') {
        ph = k === 0 ? R`Parte lineal: se aplica $A\vec x$. El origen no se mueve.` : R`Traslación: a todo se le suma $\vec b = ${tv(info.T0)}$. El origen se mueve hasta $\vec b$.`;
      } else if (k < m && k < n && Ttex[k] === VAR[k]) {
        ph = R`Paso ${k + 1} de ${K}: $${OUT[k]} = ${VAR[k]}$, así que esta coordenada <b>no cambia</b> y en este paso no se mueve nada.`;
      } else if (k < m && k < n) {
        ph = R`Paso ${k + 1} de ${K}: la coordenada $${OUT[k]}$ pasa de $${VAR[k]}$ a $${Ttex[k]}$. Las demás todavía no cambian. Ojo: se calcula con los valores <b>originales</b> de ${vars.map((v) => `$${v}$`).join(', ')}.`;
      } else if (k < m) {
        ph = R`Paso ${k + 1} de ${K}: aparece una tercera coordenada que la entrada no tenía: $z' = ${Ttex[k]}$. El plano se levanta de $z = 0$.`;
      } else {
        ph = R`Paso ${k + 1} de ${K}: la salida solo tiene 2 coordenadas, así que la $z$ se descarta y todo cae al plano. Así se aplasta $\mathbb{R}^3$ en $\mathbb{R}^2$.`;
      }
      if (shared.anim === 'coord' && s > 0.005 && s <= 0.995 && k < m && ok && Ttex[k] !== VAR[k]) {
        step = R`\text{con } \vec x = ${tv(x)}:\quad ${OUT[k]} = ${Ttex[k]} = ${texExpr(trees[k], env(x))} = ${fmt(Tx[k])}`;
      }
      phase.set(s > 0.995 ? 'pos' : '', ph);
      cStep.set(step);

      // --- linealidad ---
      const u = [1, 2, -1].slice(0, n), v = [-2, 1, 3].slice(0, n), c = 3;
      const T0 = T(O), Tu = T(u), Tv = T(v), Tuv = T(add(u, v)), Tcu = T(scale(u, c));
      const t1 = near(T0, Array(m).fill(0)), t2 = near(Tuv, add(Tu, Tv)), t3 = near(Tcu, scale(Tu, c));
      const V = (w) => (finite(w) ? tv(w) : R`\text{no definido}`);
      cTests.set(R`\begin{gathered}\vec u = ${tv(u)},\ \vec v = ${tv(v)},\ c = ${c} \\[6pt]
        \text{1) } T(\vec 0) = ${V(T0)}\ ${t1 ? OK : BAD} \\[6pt]
        \text{2) } T(\vec u + \vec v) = ${V(Tuv)} \\ ${t2 ? '=' : R`\ne`}\ T(\vec u) + T(\vec v) = ${V(add(Tu, Tv))}\ ${t2 ? OK : BAD} \\[6pt]
        \text{3) } T(c\,\vec u) = ${V(Tcu)} \\ ${t3 ? '=' : R`\ne`}\ c\,T(\vec u) = ${V(scale(Tu, c))}\ ${t3 ? OK : BAD}\end{gathered}`);
      if (info.type === 'lineal') nLin.set('pos', R`<b>Es lineal.</b> Pasa las tres pruebas, y también con otros vectores elegidos al azar. Cada coordenada es una suma de «número × variable».`);
      else if (info.type === 'afin') nLin.set('zero', R`<b>No es lineal: es afín.</b> Falla porque $T(\vec 0) \ne \vec 0$: hay un término constante. Por eso también fallan la 2 y la 3: en $T(\vec u) + T(\vec v)$ la constante se suma dos veces, y en $c\,T(\vec u)$ se multiplica por $c$. Si le quitas la constante, $T(\vec x) - T(\vec 0)$ sí es lineal.`);
      else nLin.set('neg', R`<b>No es lineal.</b> ${t1 && t2 && t3 ? 'Con estos $\\vec u$, $\\vec v$ pasa por casualidad, pero falla con otros vectores. ' : ''}Hay términos que no son «número × variable» (potencias, productos de variables, $\\sin$…): duplicar la entrada no duplica la salida.`);

      // --- matriz ---
      const colTex = (j) => clr(BASIS[j].color, tv(sub(T(E[j]), info.type === 'afin' ? info.T0 : Array(m).fill(0))));
      if (info.A) {
        const Atex = R`\begin{bmatrix}${info.A.map((r) => r.map((a, j) => clr(BASIS[j].color, fmt(a))).join('&')).join('\\\\')}\end{bmatrix}`;
        const imgs = E.map((e, j) => R`T(\vec e_${j + 1}) ${info.type === 'afin' ? R`- T(\vec 0)` : ''} = ${colTex(j)}`).join(n === 3 || info.type === 'afin' ? ' \\\\[2pt] ' : ',\\quad ');
        cM.set(R`\begin{gathered}${imgs} \\[6pt] T(\vec x) = \underbrace{${Atex}}_{A\ (${m}\times ${n})}${vars.length ? R`\begin{bmatrix}${vars.join('\\\\')}\end{bmatrix}` : ''}${info.type === 'afin' ? R` + \underbrace{${tv(info.T0)}}_{\vec b}` : ''}\end{gathered}`);
        nM.set('pos', R`Las columnas de $A$ son ${info.type === 'afin' ? 'los desplazamientos $T(\\vec e_j) - T(\\vec 0)$' : 'las imágenes $T(\\vec e_j)$'}. $A$ tiene ${m} filas porque la salida tiene ${m} coordenadas y ${n} columnas porque la entrada tiene ${n}.${m !== n ? ' No es cuadrada: no tiene determinante ni inversa.' : ''}`);
      } else {
        const comb = E.reduce((acc, e, j) => add(acc, scale(T(e), x[j])), Array(m).fill(0));
        cM.set(R`\begin{gathered}${E.map((e, j) => R`T(\vec e_${j + 1}) = ${V(T(e))}`).join(' \\\\[2pt] ')}\end{gathered}`);
        nM.set('neg', R`<b>No hay matriz.</b> Las imágenes $T(\vec e_j)$ se pueden calcular, pero no reconstruyen $T$: con el $\vec x$ de abajo, ${vars.map((vv, j) => `${fmt(x[j])}\\,T(\\vec e_${j + 1})`).map((t) => `$${t}$`).join(' + ')} $= ${V(comb)}$, pero $T(\vec x) = ${V(Tx)}$.`);
      }

      // --- vector x ---
      const sub1 = trees.map((t) => texExpr(t, env(x)));
      cX.set(R`\begin{gathered}T${R`\begin{pmatrix}${x.map((a) => fmt(a)).join('\\\\')}\end{pmatrix}`} = \begin{bmatrix}${sub1.join('\\\\')}\end{bmatrix} = ${V(Tx)}${info.type === 'lineal' ? R` \\[4pt] = ${x.map((a, j) => `${a < 0 ? `(${fmt(a)})` : fmt(a)}\\,${colTex(j)}`).join(' + ')}` : ''}\end{gathered}`);
      const nxx = norm(x), lam = n === m && nxx > 1e-9 && ok ? Tx.reduce((acc, t, i) => acc + t * x[i], 0) / (nxx * nxx) : null;
      if (lam == null || info.type !== 'lineal') nX.set('', '');
      else if (norm(sub(Tx, scale(x, lam))) < 1e-9 * (1 + norm(Tx))) nX.set('pos', R`<b>$\vec x$ es un autovector:</b> $T(\vec x) = ${fmt(lam) === '1' ? '' : fmt(lam) === '-1' ? '-' : `${fmt(lam)}\\,`}\vec x$. La transformación solo lo ${Math.abs(lam) < 1e-9 ? 'aplasta a $\\vec 0$' : lam < 0 ? 'estira y lo voltea' : Math.abs(lam - 1) < 1e-9 ? 'deja igual' : 'estira'}, sin cambiarle la dirección. El autovalor es $\lambda = ${fmt(lam)}$.`);
      else nX.set('', R`$T(\vec x)$ no es un múltiplo de $\vec x$: este $\vec x$ no es autovector. Busca direcciones donde la flecha amarilla quede sobre la recta de $\vec x$.`);
    }

    rebuildS();
    refreshAll();
    return { destroy: () => { stop(); stopOp(); } };
  },
};
