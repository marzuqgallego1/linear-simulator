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

// ---------- Sistemas de ecuaciones ----------

const tidy = (x) => (Math.abs(x) < 1e-10 ? 0 : x);

/**
 * Eliminación de Gauss-Jordan sobre la matriz aumentada [A | b].
 * Devuelve la forma escalonada reducida, los pasos (operación en LaTeX + matriz)
 * y las columnas pivote.
 */
export function gaussJordan(A, b) {
  const n = A.length, m = A[0].length;
  const M = A.map((r, i) => [...r, b[i]]);
  const steps = [];
  const pivots = [];
  const snap = (op) => steps.push({ op, M: M.map((r) => r.map(tidy)) });
  let row = 0;
  for (let c = 0; c < m && row < n; c++) {
    let p = -1;
    for (let r = row; r < n; r++) if (Math.abs(M[r][c]) > EPS) { p = r; break; }
    if (p < 0) continue;
    if (p !== row) {
      [M[p], M[row]] = [M[row], M[p]];
      snap(`F_${row + 1} \\leftrightarrow F_${p + 1}`);
    }
    const pv = M[row][c];
    if (Math.abs(pv - 1) > EPS) {
      M[row] = M[row].map((x) => tidy(x / pv));
      snap(`F_${row + 1} \\leftarrow \\frac{1}{${fmt(pv)}}\\,F_${row + 1}`);
    }
    for (let r = 0; r < n; r++) {
      if (r === row || Math.abs(M[r][c]) < EPS) continue;
      const f = M[r][c];
      M[r] = M[r].map((x, k) => tidy(x - f * M[row][k]));
      snap(`F_${r + 1} \\leftarrow F_${r + 1} ${f > 0 ? '-' : '+'} ${fmt(Math.abs(f)) === '1' ? '' : fmt(Math.abs(f))}F_${row + 1}`);
    }
    pivots.push(c);
    row++;
  }
  return { M: M.map((r) => r.map(tidy)), steps, pivots };
}

/**
 * Analiza A·x = b: rangos, si es compatible, una solución particular
 * y una base de las direcciones libres (núcleo de A).
 */
export function solveSystem(A, b) {
  const n = A[0].length;
  const { M, steps, pivots } = gaussJordan(A, b);
  const rank = pivots.length;
  const inconsistent = M.some((r) => r.slice(0, n).every((x) => Math.abs(x) < 1e-9) && Math.abs(r[n]) > 1e-9);
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  const xp = zero(n);
  pivots.forEach((c, i) => { xp[c] = M[i][n]; });
  const nullBasis = free.map((f) => {
    const v = zero(n);
    v[f] = 1;
    pivots.forEach((c, i) => { v[c] = tidy(-M[i][f]); });
    return v;
  });
  return { M, steps, pivots, rank, rankAug: rank + (inconsistent ? 1 : 0), consistent: !inconsistent, xp, nullBasis, free };
}

/** Matriz aumentada [A | b] en LaTeX. */
export const taug = (M) => {
  const n = M[0].length - 1;
  return `\\left[\\begin{array}{${'c'.repeat(n)}|c}${M.map((r) => r.map((x) => fmt(x)).join('&')).join('\\\\')}\\end{array}\\right]`;
};
