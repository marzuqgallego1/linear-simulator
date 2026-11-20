// Lector de fórmulas: «2x + y», «x^2/4», «0,5·sin(y)»… sin usar eval.
// parse(texto, variables) → árbol; evalExpr(árbol, valores) → número; texExpr(árbol, valores?) → LaTeX.

import { fmt } from './math.js';

const FN = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs,
  ln: Math.log, log: Math.log, sen: Math.sin,
};
const FN_TEX = { sin: '\\sin', sen: '\\sin', cos: '\\cos', tan: '\\tan', exp: '\\exp', ln: '\\ln', log: '\\ln' };

export class ExprError extends Error {}

function tokenize(src) {
  const s = src.replace(/·|×/g, '*').replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const raw = s.slice(i, j).replace(',', '.');
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) throw new ExprError(`Número mal escrito: «${s.slice(i, j)}»`);
      out.push({ k: 'num', v: parseFloat(raw), at: i });
      i = j; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const w = s.slice(i, j).toLowerCase();
      // palabras conocidas; si no, se separan en letras (así «xy» = x·y)
      if (FN[w] || w === 'pi' || w === 'π') out.push(FN[w] ? { k: 'fn', v: w, at: i } : { k: 'num', v: Math.PI, pi: true, at: i });
      else {
        let p = i;
        while (p < j) {
          const rest = s.slice(p, j).toLowerCase();
          const f = Object.keys(FN).find((name) => rest.startsWith(name));
          if (f) { out.push({ k: 'fn', v: f, at: p }); p += f.length; }
          else if (rest.startsWith('pi')) { out.push({ k: 'num', v: Math.PI, pi: true, at: p }); p += 2; }
          else { out.push({ k: 'var', v: rest[0], at: p }); p++; }
        }
      }
      i = j; continue;
    }
    if (c === 'π') { out.push({ k: 'num', v: Math.PI, pi: true, at: i }); i++; continue; }
    if ('+-*/^()'.includes(c)) { out.push({ k: c, at: i }); i++; continue; }
    throw new ExprError(`Símbolo no válido: «${c}»`);
  }
  return out;
}

/** Convierte el texto en un árbol. vars: letras permitidas, p. ej. ['x', 'y']. */
export function parse(src, vars) {
  if (!src.trim()) throw new ExprError('Falta la fórmula');
  const tk = tokenize(src);
  let p = 0;
  const peek = () => tk[p], eat = (k) => (tk[p]?.k === k ? tk[p++] : null);
  const startsAtom = (t) => t && (t.k === 'num' || t.k === 'var' || t.k === 'fn' || t.k === '(');

  function expr() {
    let a = term();
    for (;;) {
      if (eat('+')) a = { t: 'bin', op: '+', a, b: term() };
      else if (eat('-')) a = { t: 'bin', op: '-', a, b: term() };
      else return a;
    }
  }
  function term() {
    let a = unary();
    for (;;) {
      if (eat('*')) a = { t: 'bin', op: '*', a, b: unary() };
      else if (eat('/')) a = { t: 'bin', op: '/', a, b: unary() };
      else if (startsAtom(peek())) a = { t: 'bin', op: '*', implicit: true, a, b: power() }; // 2x, 3(x+y), x y
      else return a;
    }
  }
  function unary() {
    if (eat('-')) return { t: 'neg', a: unary() };
    if (eat('+')) return unary();
    return power();
  }
  function power() {
    const a = atom();
    if (eat('^')) return { t: 'bin', op: '^', a, b: unary() };
    return a;
  }
  function atom() {
    const t = peek();
    if (!t) throw new ExprError('La fórmula termina antes de tiempo');
    if (t.k === 'num') { p++; return { t: 'num', v: t.v, pi: t.pi }; }
    if (t.k === 'var') {
      p++;
      if (!vars.includes(t.v)) throw new ExprError(vars.includes('z') || t.v !== 'z'
        ? `La letra «${t.v}» no es una variable (usa ${vars.join(', ')})`
        : 'En ℝ² solo hay x e y: no se puede usar z');
      return { t: 'var', v: t.v };
    }
    if (t.k === 'fn') {
      p++;
      if (!eat('(')) throw new ExprError(`Después de «${t.v}» va un paréntesis: ${t.v}(…)`);
      const a = expr();
      if (!eat(')')) throw new ExprError('Falta cerrar un paréntesis');
      return { t: 'fn', f: t.v, a };
    }
    if (eat('(')) {
      const a = expr();
      if (!eat(')')) throw new ExprError('Falta cerrar un paréntesis');
      return { t: 'par', a };
    }
    throw new ExprError(`No se esperaba «${t.k}» aquí`);
  }

  const tree = expr();
  if (p < tk.length) throw new ExprError(tk[p].k === ')' ? 'Sobra un paréntesis de cierre' : `No se esperaba «${tk[p].k === 'num' ? tk[p].v : tk[p].k === 'var' || tk[p].k === 'fn' ? tk[p].v : tk[p].k}» aquí`);
  return tree;
}

/** Evalúa el árbol. env: { x: 1, y: 2, ... } */
export function evalExpr(n, env) {
  switch (n.t) {
    case 'num': return n.v;
    case 'var': return env[n.v];
    case 'neg': return -evalExpr(n.a, env);
    case 'par': return evalExpr(n.a, env);
    case 'fn': return FN[n.f](evalExpr(n.a, env));
    default: {
      const a = evalExpr(n.a, env), b = evalExpr(n.b, env);
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : a ** b;
    }
  }
}

/** LaTeX del árbol. Si se pasa env, las variables se sustituyen por sus valores (entre paréntesis si son negativos). */
export function texExpr(n, env = null, colors = {}) {
  const T = (m) => texExpr(m, env, colors);
  switch (n.t) {
    case 'num': return n.pi ? '\\pi' : fmt(n.v, 4);
    case 'var': {
      if (!env) return colors[n.v] ? `\\textcolor{${colors[n.v]}}{${n.v}}` : n.v;
      const s = fmt(env[n.v]);
      const v = s.startsWith('-') ? `(${s})` : s;
      return colors[n.v] ? `\\textcolor{${colors[n.v]}}{${v}}` : v;
    }
    case 'neg': return `-${n.a.t === 'bin' && (n.a.op === '+' || n.a.op === '-') ? `(${T(n.a)})` : T(n.a)}`;
    case 'par': return `\\left(${T(n.a)}\\right)`;
    case 'fn': {
      const inner = env && n.a.t === 'var' ? fmt(env[n.a.v]) : T(n.a);
      return n.f === 'sqrt' ? `\\sqrt{${inner}}` : n.f === 'abs' ? `\\left|${inner}\\right|` : `${FN_TEX[n.f]}\\left(${inner}\\right)`;
    }
    default: {
      const { op, a, b } = n;
      if (op === '/') return `\\frac{${T(strip(a))}}{${T(strip(b))}}`;
      if (op === '^') return `{${a.t === 'bin' || a.t === 'neg' ? `\\left(${T(strip(a))}\\right)` : T(a)}}^{${T(strip(b))}}`;
      if (op === '+') return `${T(a)} + ${b.t === 'neg' ? `(${T(b)})` : T(b)}`;
      if (op === '-') return `${T(a)} - ${b.t === 'neg' || (b.t === 'bin' && (b.op === '+' || b.op === '-')) ? `(${T(b)})` : T(b)}`;
      // producto
      const wrap = (m) => (m.t === 'bin' && (m.op === '+' || m.op === '-') ? `(${T(m)})` : m.t === 'neg' && m !== a ? `(${T(m)})` : T(m));
      const numLike = (m) => m.t === 'num' || (env && m.t === 'var') || (m.t === 'bin' && m.op === '^' && numLike(m.a)) || m.t === 'neg';
      const sep = env || b.t === 'num' || (numLike(a) && numLike(b)) ? '\\cdot ' : '';
      return `${wrap(a)}${sep}${wrap(b)}`;
    }
  }
}
const strip = (m) => (m.t === 'par' ? m.a : m);
