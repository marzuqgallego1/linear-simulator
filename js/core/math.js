// Operaciones de álgebra lineal sobre arreglos simples.
// Vectores: [x, y] o [x, y, z]. Matrices: arreglo de filas, A[fila][columna].

export const EPS = 1e-9;

export const zero = (n) => Array(n).fill(0);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const scale = (a, s) => a.map((x) => x * s);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));
export const normalize = (a) => {
  const n = norm(a);
  return n < EPS ? a.map(() => 0) : scale(a, 1 / n);
};
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Un vector unitario perpendicular a `e` (en 2D o 3D). */
export function perpendicular(e) {
  if (e.length === 2) return normalize([-e[1], e[0]]);
  const ax = Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize(cross(e, ax));
}

export const identity = (n) =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const col = (A, j) => A.map((r) => r[j]);
export const withCol = (A, j, v) => A.map((r, i) => r.map((x, k) => (k === j ? v[i] : x)));
export const matVec = (A, v) => A.map((r) => dot(r, v));
export const matMul = (A, B) =>
  A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
export const lerpMat = (A, B, t) => A.map((r, i) => r.map((x, j) => x + (B[i][j] - x) * t));

const minor3 = (A, i, j) => {
  const m = A.filter((_, r) => r !== i).map((r) => r.filter((_, c) => c !== j));
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
};

export function det(A) {
  if (A.length === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
  return A[0][0] * minor3(A, 0, 0) - A[0][1] * minor3(A, 0, 1) + A[0][2] * minor3(A, 0, 2);
}

/** Matriz adjunta (traspuesta de la matriz de cofactores). */
export function adjugate(A) {
  if (A.length === 2) {
    const [[a, b], [c, d]] = A;
    return [[d, -b], [-c, a]];
  }
  const adj = identity(3);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) adj[j][i] = ((i + j) % 2 ? -1 : 1) * minor3(A, i, j);
  return adj;
}

export function inverse(A) {
  const d = det(A);
  if (Math.abs(d) < EPS) return null;
  return adjugate(A).map((r) => r.map((x) => x / d));
}

/** Un vector no nulo del núcleo de A (A·n = 0), suponiendo que A es singular. */
export function nullVector(A) {
  const rows = A.filter((r) => norm(r) > EPS);
  if (A.length === 2) {
    if (!rows.length) return [1, 0];
    return normalize([-rows[0][1], rows[0][0]]);
  }
  if (!rows.length) return [1, 0, 0];
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const c = cross(rows[i], rows[j]);
      if (norm(c) > 1e-6) return normalize(c);
    }
  return perpendicular(rows[0]); // rango 1: cualquier perpendicular a la fila sirve
}

export const to3 = (v) => (v.length === 3 ? v : [v[0], v[1], 0]);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const deg = (r) => (r * 180) / Math.PI;

// ---------- Formato para mostrar (texto y LaTeX) ----------

export function fmt(x, d = 2) {
  if (!Number.isFinite(x)) return '\\infty';
  const r = Math.round(x * 10 ** d) / 10 ** d;
  if (r === 0) return '0';
  let s = r.toFixed(d);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
/** Número con paréntesis si es negativo: útil dentro de productos. */
export const pf = (x) => (fmt(x).startsWith('-') ? `(${fmt(x)})` : fmt(x));
export const tv = (v) => `\\begin{bmatrix}${v.map((x) => fmt(x)).join('\\\\')}\\end{bmatrix}`;
export const tm = (A) =>
  `\\begin{bmatrix}${A.map((r) => r.map((x) => fmt(x)).join('&')).join('\\\\')}\\end{bmatrix}`;
export const clr = (c, s) => `\\textcolor{${c}}{${s}}`;

/** Combinación lineal en LaTeX: [[coef, tex], ...] -> "2\vec u - 1\vec v" */
export function combo(terms) {
  return terms
    .map(([c, t], i) => {
      const neg = fmt(c).startsWith('-');
      const sign = neg ? '-' : i ? '+' : '';
      return `${sign}${fmt(Math.abs(c))}${t}`;
    })
    .join('');
}
