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
| 20 | Gram-Schmidt (proyecciones, base ortonormal paso a paso) | ✓ | ✓ |
| 21 | Factorización QR (Gram-Schmidt como matrices: girar tras estirar) | ✓ | ✓ |
| 22 | Mínimos cuadrados (ajuste de recta; proyección en 3D) | ✓ | ✓ |
| 23 | SVD (girar, estirar, girar; valores singulares) | ✓ | ✓ |

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
js/modules/*.js       un archivo por tema
```

Para añadir un tema: crear `js/modules/<tema>.js` con `{ id, title, dims, mount({ stage, panel, dim }) }` y agregarlo a `SECTIONS` en `js/main.js`.
