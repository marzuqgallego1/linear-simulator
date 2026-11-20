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
| 1 | Vectores y combinación lineal (span, independencia) | ✓ | ✓ |
| 2 | Producto punto (proyección, ángulo) | ✓ | ✓ |
| 3 | Producto cruz (área, regla de la mano derecha) | – | ✓ |
| 4 | Rectas (vector director, ecuaciones, distancia a un punto) | ✓ | ✓ |
| 5 | Planos (vector normal, directores, distancia a un punto) | – | ✓ |
| 6 | Intersecciones (recta–recta, recta–plano, plano–plano) | ✓ | ✓ |
| 7 | Sistemas Ax = b (filas, columnas, Gauss-Jordan, rangos) | ✓ | ✓ |
| 8 | Matriz como transformación | ✓ | ✓ |
| 9 | Determinante (área / volumen con signo) | ✓ | ✓ |
| 10 | Matriz inversa (deshacer, caso singular) | ✓ | ✓ |
| 11 | Cambio de base (coordenadas, rotar los ejes, punto de vista) | ✓ | ✓ |

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
