// Escena compartida: plano 2D (cámara ortográfica) o espacio 3D (perspectiva),
// con primitivas (flechas, líneas, rejillas, paralelogramos) y puntos arrastrables.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import katex from 'katex';
import { to3, matVec } from './math.js';

export const C = {
  i: '#ff6b6b', j: '#51cf66', k: '#4dabf7',
  u: '#ff922b', v: '#cc5de8', w: '#ffd43b', x: '#22d3ee', x2: '#f783ac',
  grid: '#5c7cfa', neutral: '#868e96', pos: '#ffd43b', neg: '#f783ac',
};

const UP = new THREE.Vector3(0, 1, 0);
const shared = (g) => ((g.userData.shared = true), g);
const SHAFT_GEO = shared(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0));
const HEAD_GEO = shared(new THREE.ConeGeometry(1, 1, 16).translate(0, 0.5, 0));
const HANDLE_GEO = shared(new THREE.SphereGeometry(0.11, 14, 8));
const HIT_GEO = shared(new THREE.SphereGeometry(0.34, 8, 6));

export const v3 = (p) => new THREE.Vector3(...to3(p));

// ---------- Etiquetas (LaTeX sobre la escena) ----------

export function makeLabel(src, color = '#fff', cls = 'label', plain = false) {
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  inner.className = cls;
  inner.style.color = color;
  outer.appendChild(inner);
  const obj = new CSS2DObject(outer);
  obj.userData.inner = inner;
  obj.userData.plain = plain;
  setLabel(obj, src);
  return obj;
}

export function setLabel(obj, src) {
  if (obj.userData.src === src) return;
  obj.userData.src = src;
  if (obj.userData.plain) obj.userData.inner.textContent = src;
  else katex.render(src, obj.userData.inner, { throwOnError: false });
}

// ---------- Escena ----------

export class Stage {
  constructor(container) {
    this.container = container;
    this.svgMode = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch {
      // Sin WebGL: modo de compatibilidad que dibuja la escena como SVG (más lento).
      this.svgMode = true;
      this.renderer = new SVGRenderer();
      this.renderer.setQuality('low');
      const msg = document.createElement('div');
      msg.className = 'no-webgl';
      msg.textContent = 'Modo compatible (sin WebGL)';
      msg.title = 'Tu navegador no tiene WebGL activado. La escena se dibuja con SVG, que es más lento. Activa la aceleración por hardware para verla con mejor calidad.';
      container.appendChild(msg);
    }
    this.renderer.setClearColor(new THREE.Color(0x0d1016));
    container.appendChild(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'labels';
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    // El modo SVG no aplica corrección de color: con luces más suaves los colores quedan fieles.
    this.scene.add(new THREE.AmbientLight(0xffffff, this.svgMode ? 0.8 : 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, this.svgMode ? 0.35 : 1.8);
    sun.position.set(4, -5, 9);
    this.scene.add(sun);
    this.background = new THREE.Group();
    this.content = new THREE.Group();
    this.scene.add(this.background, this.content);

    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    this.persp = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    this.persp.up.set(0, 0, 1); // en 3D el eje z apunta hacia arriba, como en los libros

    this.handles = [];
    this.drag = null;
    this.snap = 0.5;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane();

    // Estos listeners se registran ANTES que los de OrbitControls para poder
    // interceptar el clic cuando cae sobre un punto arrastrable.
    const dom = this.renderer.domElement;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', (e) => this._down(e));
    dom.addEventListener('pointermove', (e) => this._move(e));
    dom.addEventListener('pointerup', (e) => this._up(e));
    dom.addEventListener('pointercancel', (e) => this._up(e));

    this.dim = 0;
    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();
    this.setDim(2);

    const loop = () => {
      requestAnimationFrame(loop);
      this._frame();
    };
    loop();
  }

  setDim(dim) {
    if (dim === this.dim) return;
    this.dim = dim;
    this.camera = dim === 2 ? this.ortho : this.persp;
    this.controls?.dispose();
    const c = new OrbitControls(this.camera, this.renderer.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.15;
    if (dim === 2) {
      c.enableRotate = false;
      c.screenSpacePanning = true;
      c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
      c.minZoom = 0.25;
      c.maxZoom = 6;
    } else {
      c.minDistance = 3;
      c.maxDistance = 60;
    }
    this.controls = c;
    this._buildBackground();
    this.resetView();
  }

  resetView() {
    if (this.dim === 2) {
      this.ortho.position.set(0, 0, 50);
      this.ortho.zoom = 1;
      this.ortho.updateProjectionMatrix();
    } else {
      this.persp.position.set(8, -10.5, 7);
    }
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  /** Borra todo lo que puso el módulo anterior. */
  clear() {
    this.handles = [];
    this.content.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.content.clear();
  }

  addLabel(src, color, cls = 'label') {
    const l = makeLabel(src, color, cls);
    this.content.add(l);
    return l;
  }

  /** Punto arrastrable. get() devuelve su posición; set(v) recibe la nueva. */
  addHandle({ get, set, color, visible = () => true }) {
    const mesh = new THREE.Mesh(HANDLE_GEO, new THREE.MeshBasicMaterial({ color }));
    const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial());
    hit.visible = false; // invisible, pero el raycaster sí la detecta (zona de agarre amplia)
    mesh.add(hit);
    this.content.add(mesh);
    const h = { mesh, hit, get, set, visible };
    this.handles.push(h);
    return h;
  }

  // ---------- internos ----------

  _resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    const a = w / h;
    const H = a >= 1 ? 6 : 6 / a;
    Object.assign(this.ortho, { left: -H * a, right: H * a, top: H, bottom: -H });
    this.ortho.updateProjectionMatrix();
    this.persp.aspect = a;
    this.persp.updateProjectionMatrix();
  }

  _buildBackground() {
    const g = this.background;
    g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    g.clear();
    const segs = (pts, color, opacity = 1) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map(v3));
      const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      l.frustumCulled = false;
      g.add(l);
    };
    const text = (s, p, cls) => {
      const l = makeLabel(s, undefined, cls, true);
      l.position.copy(v3(p));
      g.add(l);
    };

    if (this.dim === 2) {
      const N = 30, z = -0.02, minor = [];
      for (let i = -N; i <= N; i++) {
        if (!i) continue;
        minor.push([i, -N, z], [i, N, z], [-N, i, z], [N, i, z]);
      }
      segs(minor, 0x232a38);
      segs([[-N, 0, -0.01], [N, 0, -0.01], [0, -N, -0.01], [0, N, -0.01]], 0xa3abbf);
      for (let i = -12; i <= 12; i++) {
        if (!i) continue;
        text(String(i), [i, 0], 'tick');
        text(String(i), [0, i], 'tick');
      }
    } else {
      const N = 5, grid = [];
      for (let i = -N; i <= N; i++) grid.push([i, -N, 0], [i, N, 0], [-N, i, 0], [N, i, 0]);
      segs(grid, 0x222837);
      segs([[-N, 0, 0], [N + 0.5, 0, 0], [0, -N, 0], [0, N + 0.5, 0], [0, 0, -N], [0, 0, N + 0.5]], 0xa3abbf);
      text('x', [N + 0.7, 0, 0], 'axis');
      text('y', [0, N + 0.7, 0], 'axis');
      text('z', [0, 0, N + 0.7], 'axis');
      for (let i = -4; i <= 4; i++) {
        if (!i) continue;
        text(String(i), [i, 0, 0], 'tick');
        text(String(i), [0, i, 0], 'tick');
        text(String(i), [0, 0, i], 'tick');
      }
    }
  }

  _ray(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  _pick(e) {
    this._ray(e);
    const active = this.handles.filter((h) => h.mesh.visible);
    const hits = this.raycaster.intersectObjects(active.map((h) => h.hit), false);
    return hits.length ? active.find((h) => h.hit === hits[0].object) : null;
  }

  _down(e) {
    if (e.button !== 0) return;
    const h = this._pick(e);
    if (!h) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    // En 2D arrastramos sobre el plano z=0; en 3D sobre un plano de frente a la cámara.
    const n = this.dim === 2 ? new THREE.Vector3(0, 0, 1) : this.camera.getWorldDirection(new THREE.Vector3());
    this.plane.setFromNormalAndCoplanarPoint(n, v3(h.get()));
    this.drag = h;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.controls.enabled = false;
    this.container.classList.add('dragging');
  }

  _move(e) {
    if (!this.drag) {
      if (e.buttons === 0) this.container.classList.toggle('can-grab', !!this._pick(e));
      return;
    }
    e.stopImmediatePropagation();
    this._ray(e);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, p)) return;
    const s = this.snap;
    const r = (x) => Number((s ? Math.round(x / s) * s : x).toFixed(s ? 4 : 2)) + 0;
    this.drag.set(this.dim === 2 ? [r(p.x), r(p.y)] : [r(p.x), r(p.y), r(p.z)]);
  }

  _up(e) {
    if (!this.drag) return;
    try { this.renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
    this.drag = null;
    this.controls.enabled = true;
    this.container.classList.remove('dragging');
  }

  _frame() {
    this.controls.update();
    for (const h of this.handles) {
      const vis = h.visible();
      h.mesh.visible = vis;
      if (vis) h.mesh.position.copy(v3(h.get()));
    }
    // En modo SVG redibujar es caro: lo hacemos uno de cada dos cuadros.
    if (this.svgMode && (this._skip = !this._skip)) return;
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}

// ---------- Primitivas ----------

export class Arrow {
  constructor(stage, color, { label = null, radius = 0.035, opacity = 1 } = {}) {
    const mat = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    this.group = new THREE.Group();
    this.shaft = new THREE.Mesh(SHAFT_GEO, mat);
    this.head = new THREE.Mesh(HEAD_GEO, mat);
    this.group.add(this.shaft, this.head);
    stage.content.add(this.group);
    this.r = radius;
    this.shown = true;
    this.label = label ? stage.addLabel(label, color, opacity < 1 ? 'label faded' : 'label') : null;
  }

  set(from, to) {
    const a = v3(from), b = v3(to), d = b.clone().sub(a), len = d.length();
    const vis = this.shown && len > 1e-6;
    this.group.visible = vis;
    if (this.label) {
      this.label.visible = vis;
      this.label.position.copy(b);
    }
    if (!vis) return this;
    const hl = Math.min(0.3, len * 0.4);
    const hr = Math.max(this.r * 2.8, 0.09);
    this.shaft.scale.set(this.r, Math.max(len - hl, 1e-4), this.r);
    this.head.position.set(0, len - hl, 0);
    this.head.scale.set(hr, hl, hr);
    this.group.position.copy(a);
    this.group.quaternion.setFromUnitVectors(UP, d.normalize());
    return this;
  }

  setLabel(src) { if (this.label) setLabel(this.label, src); return this; }
  setVisible(b) { this.shown = b; if (!b) { this.group.visible = false; if (this.label) this.label.visible = false; } return this; }
}

export class Polyline {
  constructor(stage, color, { opacity = 1, dashed = false, dash = 0.12 } = {}) {
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: dash * 0.8, transparent: true, opacity })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    this.line = new THREE.Line(new THREE.BufferGeometry(), mat);
    this.line.frustumCulled = false;
    this.dashed = dashed;
    stage.content.add(this.line);
  }
  set(points) {
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry().setFromPoints(points.map(v3));
    if (this.dashed) this.line.computeLineDistances();
    return this;
  }
  setVisible(b) { this.line.visible = b; return this; }
}

/** Rejilla de líneas que se deforma con una matriz (2×2 o 3×3). */
export class Lattice {
  constructor(stage, color, { opacity = 0.5, extent } = {}) {
    const n = stage.dim;
    const N = extent ?? (n === 2 ? 12 : 2);
    const base = [];
    for (let i = -N; i <= N; i++) {
      if (n === 2) base.push([i, -N], [i, N], [-N, i], [N, i]);
      else for (let j = -N; j <= N; j++) base.push([i, j, -N], [i, j, N], [i, -N, j], [i, N, j], [-N, i, j], [N, i, j]);
    }
    this.base = base;
    this.attr = new THREE.BufferAttribute(new Float32Array(base.length * 3), 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', this.attr);
    this.obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    this.obj.frustumCulled = false;
    stage.content.add(this.obj);
  }
  setMatrix(M) {
    this.base.forEach((p, k) => {
      const q = to3(matVec(M, p));
      this.attr.setXYZ(k, q[0], q[1], q[2]);
    });
    this.attr.needsUpdate = true;
    return this;
  }
}

/** Cuadrilátero relleno (paralelogramos, planos). */
export class Quad {
  constructor(stage, color, { opacity = 0.3, edgeOpacity = 0.9 } = {}) {
    this.attr = new THREE.BufferAttribute(new Float32Array(12), 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.attr);
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', this.attr);
    this.edge = new THREE.LineLoop(ge, new THREE.LineBasicMaterial({ color, transparent: true, opacity: edgeOpacity }));
    this.hasFill = opacity > 0;
    this.hasEdge = edgeOpacity > 0;
    for (const o of [this.fill, this.edge]) { o.frustumCulled = false; stage.content.add(o); }
    this.setVisible(true);
  }
  set(...pts) {
    pts.forEach((p, i) => this.attr.setXYZ(i, ...to3(p)));
    this.attr.needsUpdate = true;
    return this;
  }
  setColor(c) { this.fill.material.color.set(c); this.edge.material.color.set(c); return this; }
  setVisible(b) { this.fill.visible = b && this.hasFill; this.edge.visible = b && this.hasEdge; return this; }
}

/** Paralelepípedo generado por tres vectores. */
export class Box {
  constructor(stage, color, { opacity = 0.25, edgeOpacity = 0.9 } = {}) {
    this.attr = new THREE.BufferAttribute(new Float32Array(24), 3);
    const faces = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.attr);
    g.setIndex(faces.flatMap(([a, b, c, d]) => [a, b, c, a, c, d]));
    const edges = [];
    for (let v = 0; v < 8; v++) for (const bit of [1, 2, 4]) if (!(v & bit)) edges.push(v, v | bit);
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', this.attr);
    ge.setIndex(edges);
    this.fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    this.edge = new THREE.LineSegments(ge, new THREE.LineBasicMaterial({ color, transparent: true, opacity: edgeOpacity }));
    this.fill.visible = opacity > 0;
    for (const o of [this.fill, this.edge]) { o.frustumCulled = false; stage.content.add(o); }
  }
  set(a, b, c) {
    for (let v = 0; v < 8; v++) {
      const p = [0, 1, 2].map((i) => (v & 1 ? a[i] : 0) + (v & 2 ? b[i] : 0) + (v & 4 ? c[i] : 0));
      this.attr.setXYZ(v, ...p);
    }
    this.attr.needsUpdate = true;
    return this;
  }
  setColor(c) { this.fill.material.color.set(c); this.edge.material.color.set(c); return this; }
}

/** Cilindro delgado entre dos puntos (para rectas, que con líneas de 1px casi no se ven en 3D). */
export class Rod {
  constructor(stage, color, { radius = 0.02, opacity = 1 } = {}) {
    this.mesh = new THREE.Mesh(SHAFT_GEO, new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
    stage.content.add(this.mesh);
    this.r = radius;
    this.shown = true;
  }
  set(a, b) {
    const A = v3(a), d = v3(b).sub(A), len = d.length();
    this.mesh.visible = this.shown && len > 1e-6;
    if (!this.mesh.visible) return this;
    this.mesh.position.copy(A);
    this.mesh.scale.set(this.r, len, this.r);
    this.mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    return this;
  }
  setVisible(b) { this.shown = b; if (!b) this.mesh.visible = false; return this; }
}

/** Punto fijo (no arrastrable). */
export class Dot {
  constructor(stage, color, { radius = 0.1 } = {}) {
    this.mesh = new THREE.Mesh(HANDLE_GEO, new THREE.MeshBasicMaterial({ color }));
    this.mesh.scale.setScalar(radius / 0.11);
    stage.content.add(this.mesh);
  }
  set(p) { this.mesh.position.copy(v3(p)); return this; }
  setVisible(b) { this.mesh.visible = b; return this; }
}

/** Conjunto de segmentos sueltos: set([a1, b1, a2, b2, ...]). */
export class Segments {
  constructor(stage, color, { opacity = 0.3 } = {}) {
    this.obj = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    this.obj.frustumCulled = false;
    stage.content.add(this.obj);
  }
  set(points) {
    this.obj.geometry.dispose();
    this.obj.geometry = new THREE.BufferGeometry().setFromPoints(points.map(v3));
    return this;
  }
  setVisible(b) { this.obj.visible = b; return this; }
}
