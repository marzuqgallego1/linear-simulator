// Rectas, planos y fórmulas de geometría analítica (dibujo + cálculo + LaTeX).
import { Quad, Segments, Rod } from './stage.js';
import { add, sub, scale, dot, cross, norm, normalize, perpendicular, fmt, EPS } from './math.js';

/** Base ortonormal {e1, e2} del plano perpendicular a n. */
export function planeBasis(n) {
  const nh = normalize(n);
  const e1 = perpendicular(nh);
  return [e1, cross(nh, e1)];
}

/** Punto de la recta P + t·d más cercano al origen (centro estable para dibujarla). */
export const lineCenter = (P, d) => sub(P, scale(d, dot(P, d) / dot(d, d)));

/** Punto del plano n·X = k más cercano al origen. */
export const planeCenter = (n, k) => scale(n, k / dot(n, n));

/** Recta infinita, dibujada como un cilindro delgado. */
export class LineView {
  constructor(stage, color, { radius = 0.022, L } = {}) {
    this.rod = new Rod(stage, color, { radius });
    this.L = L ?? (stage.dim === 2 ? 40 : 7);
  }
  set(P, d) {
    if (norm(d) < EPS) return this.setVisible(false);
    this.setVisible(true);
    const c = lineCenter(P, d), u = normalize(d);
    this.rod.set(sub(c, scale(u, this.L)), add(c, scale(u, this.L)));
    return this;
  }
  setVisible(b) { this.rod.setVisible(b); return this; }
}

/** Plano (trozo cuadrado con una rejilla para dar sensación de profundidad). */
export class PlaneView {
  constructor(stage, color, { opacity = 0.14, L = 5 } = {}) {
    this.quad = new Quad(stage, color, { opacity, edgeOpacity: 0.5 });
    this.grid = new Segments(stage, color, { opacity: 0.22 });
    this.L = L;
  }
  /** Plano que pasa por P con normal n. */
  set(P, n) {
    if (norm(n) < EPS) return this.setVisible(false);
    this.setVisible(true);
    const L = this.L, c = planeCenter(n, dot(n, P));
    const [e1, e2] = planeBasis(n);
    const at = (x, y) => add(c, add(scale(e1, x), scale(e2, y)));
    this.quad.set(at(L, L), at(-L, L), at(-L, -L), at(L, -L));
    const pts = [];
    for (let k = -L + 1; k < L; k++) pts.push(at(k, -L), at(k, L), at(-L, k), at(L, k));
    this.grid.set(pts);
    return this;
  }
  setVisible(b) { this.quad.setVisible(b); this.grid.setVisible(b); return this; }
}

/**
 * Puntos más cercanos entre las rectas P1 + t·d1 y P2 + s·d2.
 * Devuelve null si son paralelas.
 */
export function closestLineLine(P1, d1, P2, d2) {
  const w = sub(P1, P2);
  const a = dot(d1, d1), b = dot(d1, d2), c = dot(d2, d2), d = dot(d1, w), e = dot(d2, w);
  const D = a * c - b * b;
  if (Math.abs(D) < EPS * Math.max(1, a * c)) return null;
  const t = (b * e - c * d) / D, s = (a * e - b * d) / D;
  return { t, s, C1: add(P1, scale(d1, t)), C2: add(P2, scale(d2, s)) };
}

/** Distancia del punto Q a la recta P + t·d, con el pie de la perpendicular. */
export function pointLine(Q, P, d) {
  const t = dot(sub(Q, P), d) / dot(d, d);
  const F = add(P, scale(d, t));
  return { t, F, dist: norm(sub(Q, F)) };
}

// ---------- LaTeX ----------

/** "c + k·v" sin términos nulos ni unos sobrantes: affine(1, -2, 't') -> "1 - 2t" */
export function affine(c, k, v) {
  const cs = fmt(c), ks = fmt(k);
  if (ks === '0') return cs;
  const kv = ks === '1' ? v : ks === '-1' ? `-${v}` : `${ks}${v}`;
  if (cs === '0') return kv;
  return kv.startsWith('-') ? `${cs} - ${kv.slice(1)}` : `${cs} + ${kv}`;
}

/** Forma lineal: linform([2, -1, 0]) -> "2x - y" */
export function linform(coefs, vars = ['x', 'y', 'z']) {
  let out = '';
  coefs.forEach((c, i) => {
    const s = fmt(c);
    if (s === '0') return;
    const neg = s.startsWith('-');
    const a = neg ? s.slice(1) : s;
    const term = (a === '1' ? '' : a) + vars[i];
    out += out ? (neg ? ' - ' : ' + ') + term : (neg ? '-' : '') + term;
  });
  return out || '0';
}

/** "x - c" bien escrito: shift('x', -2) -> "x + 2" */
export function shift(v, c) {
  const s = fmt(c);
  return s === '0' ? v : s.startsWith('-') ? `${v} + ${s.slice(1)}` : `${v} - ${s}`;
}

/** Ecuaciones paramétricas en un bloque cases. */
export const paramTex = (P, d, t = 't', vars = ['x', 'y', 'z']) =>
  `\\begin{cases}${P.map((p, i) => `${vars[i]} = ${affine(p, d[i], t)}`).join('\\\\')}\\end{cases}`;

export { cross, dot, norm };
