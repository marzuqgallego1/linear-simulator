# Álgebra lineal visual

Aplicación web interactiva para ver qué significan las operaciones de álgebra lineal en 2D y 3D (solo números reales).

## Ejecutar

No necesita instalación ni compilación. Desde esta carpeta:

```bash
python3 serve.py
```

Luego abre http://localhost:5173 en el navegador (necesita WebGL e internet para cargar Three.js y KaTeX desde CDN).

## Temas

| # | Tema | 2D | 3D |
|---|------|----|----|
| 1 | Operaciones con vectores (suma, resta, escalar, norma, distancia) | ✓ | ✓ |
| 2 | Vectores y combinación lineal (span, independencia) | ✓ | ✓ |
| 3 | Producto punto (proyección, ángulo) | ✓ | ✓ |
| 4 | Producto cruz (área, regla de la mano derecha) | – | ✓ |
| 5 | Rectas (vector director, ecuaciones, distancia a un punto) | ✓ | ✓ |
| 6 | Planos (vector normal, directores, distancia a un punto) | – | ✓ |
| 7 | Intersecciones (recta–recta, recta–plano, plano–plano) | ✓ | ✓ |
| 8 | Sistemas Ax = b (filas, columnas, Gauss-Jordan, rangos) | ✓ | ✓ |
| 9 | Matriz como transformación | ✓ | ✓ |
| 10 | Suma de matrices y producto por escalar | ✓ | ✓ |
| 11 | Producto de matrices (composición, AB ≠ BA, potencias) | ✓ | ✓ |
| 12 | Transpuesta (simétricas, ortogonales, producto punto) | ✓ | ✓ |
| 13 | Determinante (área / volumen con signo) | ✓ | ✓ |
| 14 | Matriz inversa (deshacer, caso singular) | ✓ | ✓ |
| 15 | Rango, núcleo y nulidad (imagen, teorema del rango) | ✓ | ✓ |
| 16 | Factorización LU (eliminación guardada, PA = LU, sustitución) | ✓ | ✓ |
| 17 | Cambio de base (coordenadas, rotar los ejes, punto de vista) | ✓ | ✓ |
| 18 | Autovalores y autovectores (direcciones que no giran) | ✓ | ✓ |
| 19 | Diagonalización y potencias (A = PDP⁻¹, Aᵏ, autovalor dominante) | ✓ | ✓ |
| 20 | Transformaciones como funciones (fórmulas, paso a paso, ¿es lineal?; operar: composición, suma, k·T, inversa, transpuesta; analizar: determinante, núcleo, imagen, autovalores) | ✓ | ✓ |
| 21 | Proyecciones ortogonales (P² = P, Pᵀ = P, complemento ortogonal) | ✓ | ✓ |
| 22 | Gram-Schmidt (proyecciones, base ortonormal paso a paso) | ✓ | ✓ |
| 23 | Factorización QR (Gram-Schmidt como matrices: girar tras estirar) | ✓ | ✓ |
| 24 | Mínimos cuadrados (ajuste de recta; proyección en 3D) | ✓ | ✓ |
| 25 | SVD (girar, estirar, girar; valores singulares) | ✓ | ✓ |
| 26 | Formas cuadráticas (ejes principales, definida/indefinida, cónicas y cuádricas) | ✓ | ✓ |

### Pestaña «Cómo se calcula»

Los temas con un cálculo no elemental tienen dos pestañas: **Explorar** y **Cómo se calcula**. La segunda hace el procedimiento paso a paso con los números de la matriz actual. Cada paso explica *por qué* se hace así, y la escena lo muestra:

| Tema | Procedimiento |
|------|---------------|
| Producto cruz | determinante con î, ĵ, k̂; cada componente es la sombra del paralelogramo |
| Determinante | eliminación hasta triangular (cizallas que no cambian el área) |
| Matriz inversa | Gauss-Jordan sobre [A \| I] |
| Rango y núcleo | escalonar Ax = 0, variables libres, teorema del rango |
| Cambio de base | Gauss-Jordan sobre [P \| x] (cada operación transforma todo el espacio) |
| Autovalores | det(A − λI), raíces (deslizador de λ: la rejilla se aplana) y núcleo de A − λI |
| Diagonalización | autovalores → P y D → P⁻¹ → AP = PD → Aᵏ |
| QR | Gram-Schmidt con números: sombras, normalizar, armar Q y R |
| Mínimos cuadrados | ecuaciones normales AᵀA ĉ = Aᵀy (el error es perpendicular) |
| SVD | AᵀA → λ → V → σ = √λ → uᵢ = Avᵢ/σᵢ |
| Formas cuadráticas | ejes principales (girar) y completar cuadrados (cizallar) |

Sistemas, LU y Gram-Schmidt ya eran procedimientos paso a paso en su vista principal.

### «Transformaciones como funciones»: pestaña «Operar»

Cierra la sección de matrices. Con T escrita como fórmula (y una segunda función S), se ven como funciones las operaciones que en las otras secciones son cuentas con matrices:

| Operación | Como funciones | Con matrices |
|-----------|----------------|--------------|
| Composición | T(S(x)) o S(T(x)), animadas en orden | producto (la que actúa primero va a la derecha) |
| Suma | T(x) + S(x), regla del paralelogramo | suma entrada por entrada |
| Escalar | k·T(x) | k·A |
| Inversa | despejar x de x′ = T(x); T y luego T⁻¹ devuelve la rejilla | A⁻¹ (también afines) |
| Transpuesta | la que cumple T(u)·v = u·Tᵀ(v); va de ℝᵐ a ℝⁿ | Aᵀ |

Cada resultado se escribe como fórmula (sin simplificar y simplificada) y se dice si es lineal, afín o no lineal. Cuando una operación no tiene sentido (inversa de una no cuadrada o que aplasta, transpuesta de una no lineal), se explica por qué.

La pestaña **«Analizar T»** lee la transformación desde su fórmula:

| Análisis | Qué se calcula | Qué se ve |
|----------|----------------|-----------|
| Determinante | ad − bc con los coeficientes de la fórmula (en ℝ²→ℝ³, factor de área con el producto cruz) | el cuadrado o cubo unidad cambia de área/volumen |
| Núcleo | igualar cada fórmula a 0 y resolver | la recta o plano rojo se encoge hasta el origen |
| Imagen | T(x) = x·T(e₁) + y·T(e₂) + …, columnas pivote, teorema del rango | la rejilla cae sobre la recta o plano verde |
| Autovalores | T(x) = λx → det(A − λI) = 0 → direcciones | las flechas de colores no se salen de sus rectas |

Con una T afín se analiza su parte lineal; con una no lineal se explica por qué no se puede.

## Estructura

```
index.html            página y mapa de importación (Three.js, KaTeX)
css/styles.css
js/main.js            navegación y orden del curso
js/core/math.js       operaciones (det, inversa, cruz, …) y formato LaTeX
js/core/stage.js      escena 2D/3D, flechas, rejillas, puntos arrastrables
js/core/ui.js         controles del panel (editores de vector/matriz, sliders)
js/core/presets.js    vectores base y matrices de ejemplo
js/core/geom.js       rectas, planos e intersecciones (dibujo y fórmulas)
js/core/expr.js       lector de fórmulas escritas por el usuario (sin eval)
js/modules/*.js       un archivo por tema
```

Para añadir un tema: crear `js/modules/<tema>.js` con `{ id, title, dims, mount({ stage, panel, dim }) }` y agregarlo a `SECTIONS` en `js/main.js`.
