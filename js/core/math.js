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

// ---------- Autovalores (solo raíces reales) ----------

/** Redondea a un valor "bonito" si está muy cerca (evita 2.9999999 en vez de 3). */
const snapNice = (x) => {
  const r = Math.round(x * 1000) / 1000;
  return Math.abs(x - r) < 1e-7 ? r : x;
};

/** Raíces reales distintas de λ³ + aλ² + bλ + c = 0, de mayor a menor. */
export function cubicRoots(a, b, c) {
  const f = (x) => ((x + a) * x + b) * x + c;
  const df = (x) => (3 * x + 2 * a) * x + b;
  const p = b - (a * a) / 3, q = (2 * a * a * a) / 27 - (a * b) / 3 + c;
  const D = (q * q) / 4 + (p * p * p) / 27;
  const tol = 1e-10 * (1 + q * q + Math.abs(p * p * p));
  let ys;
  if (Math.abs(p) < 1e-12 && Math.abs(q) < 1e-12) ys = [0];
  else if (D > tol) ys = [Math.cbrt(-q / 2 + Math.sqrt(D)) + Math.cbrt(-q / 2 - Math.sqrt(D))];
  else if (D > -tol) ys = [2 * Math.cbrt(-q / 2), -Math.cbrt(-q / 2)];
  else {
    const r = 2 * Math.sqrt(-p / 3);
    const phi = Math.acos(clamp((3 * q) / (p * r), -1, 1));
    ys = [0, 1, 2].map((k) => r * Math.cos(phi / 3 - (2 * Math.PI * k) / 3));
  }
  const roots = ys.map((y) => {
    let x = y - a / 3;
    for (let i = 0; i < 4; i++) { const d = df(x); if (Math.abs(d) > 1e-12) x -= f(x) / d; }
    return snapNice(x);
  });
  return roots.sort((u, v) => v - u).filter((x, i, arr) => i === 0 || Math.abs(x - arr[i - 1]) > 1e-6);
}

/**
 * Autovalores reales de A (2×2 o 3×3) con la base de cada espacio propio.
 * Devuelve { poly: coeficientes de det(λI − A) de mayor a menor grado, values: [{ lambda, vectors }] }.
 */
export function eigen(A) {
  const n = A.length;
  const tr = A.reduce((s, r, i) => s + r[i], 0);
  let poly, roots;
  if (n === 2) {
    const d = det(A), disc = tr * tr - 4 * d;
    poly = [1, -tr, d];
    if (disc < -1e-10) roots = [];
    else if (Math.abs(disc) <= 1e-10) roots = [snapNice(tr / 2)];
    else roots = [snapNice((tr + Math.sqrt(disc)) / 2), snapNice((tr - Math.sqrt(disc)) / 2)];
  } else {
    const m = minor3(A, 0, 0) + minor3(A, 1, 1) + minor3(A, 2, 2);
    const d = det(A);
    poly = [1, -tr, m, -d];
    roots = cubicRoots(-tr, m, -d);
  }
  const values = roots.map((lambda) => {
    const B = A.map((r, i) => r.map((x, j) => x - (i === j ? lambda : 0)));
    return { lambda, B, vectors: solveSystem(B, zero(n)).nullBasis };
  });
  return { tr, poly, values };
}

/** Polinomio en λ en LaTeX: coeficientes de mayor a menor grado. */
export function polyTex(coefs, v = '\\lambda') {
  const deg0 = coefs.length - 1;
  let out = '';
  coefs.forEach((c, i) => {
    const s = fmt(c);
    if (s === '0') return;
    const k = deg0 - i, neg = s.startsWith('-'), a = neg ? s.slice(1) : s;
    const pw = k === 0 ? '' : k === 1 ? v : `${v}^${k}`;
    const term = (a === '1' && k > 0 ? '' : a) + pw;
    out += out ? (neg ? ' - ' : ' + ') + term : (neg ? '-' : '') + term;
  });
  return out || '0';
}

// ---------- Factorizaciones (QR, LU, SVD) ----------

export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const cleanM = (A) => A.map((r) => r.map((x) => (Math.abs(x) < 1e-12 ? 0 : x)));

/** A = QR por Gram-Schmidt sobre las columnas. failAt = índice de la primera columna dependiente (o -1). */
export function qrDecomp(A) {
  const n = A.length, cols = transpose(A), qs = [];
  const Rm = A.map(() => Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let w = cols[j];
    for (let i = 0; i < qs.length; i++) { Rm[i][j] = dot(qs[i], cols[j]); w = sub(w, scale(qs[i], Rm[i][j])); }
    const l = norm(w);
    if (l < 1e-9) return { Q: null, R: cleanM(Rm), qs, failAt: j };
    Rm[j][j] = l;
    qs.push(scale(w, 1 / l));
  }
  return { Q: cleanM(transpose(qs)), R: cleanM(Rm), qs, failAt: -1 };
}

/**
 * PA = LU (Doolittle). Solo intercambia filas cuando el pivote es 0, para que los pasos
 * coincidan con lo que se haría a mano. steps: [{ kind:'swap'|'elim'|'skip', op, U, L, r, c, m }].
 */
export function luDecomp(A) {
  const n = A.length;
  const U = A.map((r) => [...r]), L = identity(n), perm = [...Array(n).keys()];
  const steps = [];
  const snap = (s) => steps.push({ ...s, U: cleanM(U), L: cleanM(L), perm: [...perm] });
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let r = c; r < n; r++) if (Math.abs(U[r][c]) > EPS) { p = r; break; }
    if (p < 0) { snap({ kind: 'skip', c, op: `\\text{columna ${c + 1}: sin pivote}` }); continue; }
    if (p !== c) {
      [U[p], U[c]] = [U[c], U[p]];
      [perm[p], perm[c]] = [perm[c], perm[p]];
      for (let k = 0; k < c; k++) [L[p][k], L[c][k]] = [L[c][k], L[p][k]];
      snap({ kind: 'swap', r: p, c, op: `F_${c + 1} \\leftrightarrow F_${p + 1}` });
    }
    for (let r = c + 1; r < n; r++) {
      const m = U[r][c] / U[c][c];
      if (Math.abs(m) < EPS) continue;
      U[r] = U[r].map((x, k) => tidy(x - m * U[c][k]));
      U[r][c] = 0;
      L[r][c] = m;
      snap({ kind: 'elim', r, c, m, op: `F_${r + 1} \\leftarrow F_${r + 1} ${m > 0 ? '-' : '+'} ${fmt(Math.abs(m)) === '1' ? '' : fmt(Math.abs(m))}F_${c + 1}` });
    }
  }
  const P = perm.map((i) => identity(n)[i]);
  return { L: cleanM(L), U: cleanM(U), P, perm, steps };
}

/** Autovalores y autovectores de una matriz simétrica (método de Jacobi). Ordenados de mayor a menor. */
export function symEigen(S) {
  const n = S.length;
  const A = S.map((r) => [...r]), V = identity(n);
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return [...Array(n).keys()].map((i) => ({ value: A[i][i], vector: col(V, i) })).sort((a, b) => b.value - a.value);
}

/** Completa una lista de vectores ortonormales hasta una base de R^n. */
function completeBasis(us, n) {
  const out = [...us];
  for (let k = 0; k < n && out.length < n; k++) {
    let w = identity(n)[k];
    for (const u of out) w = sub(w, scale(u, dot(w, u)));
    if (norm(w) > 1e-6) out.push(scale(w, 1 / norm(w)));
  }
  return out;
}

/**
 * A = U Σ Vᵀ. V sale de los autovectores de AᵀA, σ = √λ, u_i = A v_i / σ_i.
 * Se elige V con det = +1, y U también cuando hay un σ = 0 (libertad de signo); si det A < 0, U es una reflexión.
 */
export function svd(A) {
  const n = A.length;
  const eig = symEigen(matMul(transpose(A), A));
  const vs = eig.map((e) => normalize(e.vector));
  if (det(transpose(vs)) < 0) vs[n - 1] = scale(vs[n - 1], -1);
  const sig = eig.map((e) => Math.sqrt(Math.max(e.value, 0)));
  const tol = 1e-7 * Math.max(1, sig[0]);
  const rank = sig.filter((s) => s > tol).length;
  const us = completeBasis(vs.slice(0, rank).map((v, i) => scale(matVec(A, v), 1 / sig[i])), n);
  if (rank < n && det(transpose(us)) < 0) us[n - 1] = scale(us[n - 1], -1);
  return {
    U: cleanM(transpose(us)), V: cleanM(transpose(vs)), us, vs,
    sigma: sig.map((s, i) => (i < rank ? s : 0)), rank,
  };
}

/** Rotación R elevada a t (0 → I, 1 → R), interpolando el ángulo de verdad. */
export function rotPow(Rm, t) {
  const n = Rm.length;
  if (n === 2) {
    const a = Math.atan2(Rm[1][0], Rm[0][0]) * t;
    return [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]];
  }
  const th = Math.acos(clamp((Rm[0][0] + Rm[1][1] + Rm[2][2] - 1) / 2, -1, 1));
  if (th < 1e-9) return identity(3);
  let k;
  if (th < Math.PI - 1e-6) k = normalize([Rm[2][1] - Rm[1][2], Rm[0][2] - Rm[2][0], Rm[1][0] - Rm[0][1]]);
  else {
    const B = Rm.map((r, i) => r.map((x, j) => x + (i === j ? 1 : 0)));
    k = normalize(transpose(B).reduce((a, c) => (norm(c) > norm(a) ? c : a)));
  }
  const K = [[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]], K2 = matMul(K, K);
  const s = Math.sin(th * t), c1 = 1 - Math.cos(th * t);
  return identity(3).map((r, i) => r.map((x, j) => x + s * K[i][j] + c1 * K2[i][j]));
}

/** Camino de I a la matriz ortogonal Q: giro continuo y, si Q refleja, el último eje se voltea al final. */
export function orthoPath(Q, t) {
  const n = Q.length;
  if (det(Q) > 0) return rotPow(Q, t);
  const F = identity(n); F[n - 1][n - 1] = -1;
  return matMul(rotPow(matMul(Q, F), t), lerpMat(identity(n), F, t));
}
