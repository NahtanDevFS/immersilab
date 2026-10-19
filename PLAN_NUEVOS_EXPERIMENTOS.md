# Plan: renovación del catálogo de experimentos

Este documento es para quien va a implementar los cambios. Trae el contexto
del proyecto, las reglas que hay que respetar, la especificación de cada
experimento con sus retos y lo que hay que entregar al final para la revisión.

**Resumen del cambio.** El laboratorio pasa de 19 a 20 experimentos para
alinearse con los temarios de los cursos:

- **Salen 6:** Taylor, Tubo de Venturi, El sintonizador (ondas), Sintoniza la
  emisora (AM/FM), Recupera el mensaje (QAM) y Tu voz en el espectro.
- **Entran 7:** Razones de cambio, Leyes de Newton, Guía la carga, Divide la
  red, Rompe el bucle, Defiende el borde y El contador.
- **Se mejora 1:** Cubre el campus, al que se le agrega la demanda de usuarios.

| Cálculo (4) | Física (6) | Redes (6) | Electrónica (4) |
|---|---|---|---|
| Frena en el pico | Tiro parabólico | Arma el paquete (OSI) | Arma el circuito |
| **Llena el tanque** (nuevo) | **Leyes de Newton** (nuevo) | **Divide la red** (nuevo) | La fuente de poder |
| Suma de Riemann | Péndulo | **Rompe el bucle** (nuevo) | Arma la lógica |
| Tornea la pieza | Colisiones 1D | Encuentra el camino | **El contador** (nuevo) |
| | **Guía la carga** (nuevo) | Cubre el campus (con demanda) | |
| | La grúa electromagnética | **Defiende el borde** (nuevo) | |

---

## 1. Contexto del proyecto

ImmersiLab es un laboratorio virtual en 3D para estudiantes universitarios.
Cada experimento es un "juego" con un concepto, controles, retos y un tutor
por voz que conoce el estado del experimento. Se usa en la computadora y en el
celular dentro de un visor tipo Cardboard, con un control Bluetooth (un ESP32).

- **Stack:** Next.js 16, React 19, React Three Fiber y three.js, Supabase para
  cuentas y progreso, y Gemini para el tutor.
- **Cómo correrlo:** ver `README.md`. Para revisar tipos y estilo:
  `npx tsc --noEmit -p .` y `npx eslint`.
- **Documentos a leer antes de empezar:**
  - `README.md`, sección "Agregar un experimento".
  - `types/module.ts`, el contrato que implementa cada experimento. Está muy
    comentado y es la referencia principal.
  - `PLAN_DESARROLLO.md`, sección 3, con el diseño de los experimentos que ya
    existen.

### 1.1 Cómo está armado un experimento

Cada experimento vive en `components/modules/<área>/experiments/<slug>/` y
tiene tres piezas:

| Archivo | Qué hace |
|---|---|
| `engine.ts` | La lógica pura, **sin React ni three**. Implementa `ExperimentEngine`: `init`, `update(dt)` con paso fijo, `reset`, `getState` para la IA, y opcionalmente `getChallenges`, `resetChallenges` y `getSeries` para la mini gráfica. |
| `*Scene.tsx` | Dibuja la escena con R3F a partir del motor. Llama a `useFixedTimestep((dt) => engine.update(dt, variables))` y lee el estado del motor unas 10 veces por segundo para redibujar. |
| `*Controls.tsx` | Opcional. Los botones propios del experimento ("Lanzar", "Probar") en HTML, para el modo computadora. |
| `index.ts` | La `ExperimentDefinition`: slug, nombre, descripción, variables, `briefing`, `tutorHints`, `conceptTags`, `cameraView`, `vrActions`, `whiteboard` y la factoría del motor. |

El shell (`components/shell/ExperimentShell.tsx`) **no se toca**. A partir de
la definición dibuja el panel de variables, los resultados, los retos, la
explicación, el tutor, el modo visor y el progreso.

**Experimentos que conviene copiar como punto de partida:**

| Si necesitas... | Mira |
|---|---|
| Elegir piezas con `select` y un botón "Probar" con animación | `electronics/experiments/compuertas` |
| Objetos de la escena que se tocan con el mouse y con la mira del visor | `networks/experiments/enrutamiento` (usa `GazeMesh`) |
| Que el estudiante prediga un valor y se compare | `physics/experiments/colisiones-1d` (`pred_v1`, `pred_v2` y puntaje) |
| Lanzar algo y medir dónde cae | `physics/experiments/tiro-parabolico` |
| Un osciloscopio o una gráfica en la escena | `electronics/experiments/fuente-poder` |
| Un mapa con zonas pintadas según un cálculo | `networks/experiments/cobertura` |

### 1.2 El modo visor (VR)

Todo lo que se puede hacer en la computadora se tiene que poder hacer en el
visor. Esto es **obligatorio** y es lo que más se revisa.

- En el visor la imagen se dibuja dos veces, una por ojo, así que **el HTML no
  sirve**. Las acciones de `ControlsComponent` se repiten en `vrActions`, que
  el shell dibuja como botones 3D. Las líneas informativas van con
  `info: true`.
- Los objetos de la escena que se tocan (un enlace, una tarjeta, un switch)
  usan `GazeMesh` (`components/vr/GazeMesh.tsx`), que responde al clic y a la
  mira con el botón A.
- El texto dentro de la escena va con `VrText` o `SceneLabel` (en
  `components/vr/`), no con `<Html>` de drei. `SceneLabel` ya resuelve los dos
  modos.
- Las variables del esquema ya funcionan solas en el visor: los `number` se
  ajustan con el stick derecho y los `select` y `boolean` pasan al siguiente
  valor con A. Por eso, **cuanto más del experimento pase por variables, menos
  trabajo extra hay para el visor**.
- El texto se tiene que leer en el visor: letras grandes, alto contraste y
  pocas palabras por etiqueta.

### 1.3 El tutor por voz

- `briefing` (qué es, cómo se usa, cuál es el reto) se muestra en una tarjeta
  **y se lee en voz alta**. Va en segunda persona, sin fórmulas y con los
  números escritos como se dicen: "cuarenta y cinco grados", no "45°".
- `tutorHints` se agrega a las instrucciones del tutor. Explica las variables,
  los campos de `result`, el modelo con sus números, las confusiones típicas y
  qué **no** debe decir. Por ejemplo: "no des la respuesta, guía con
  preguntas". Usa el mismo estilo de los experimentos que ya existen.
- `getState().result` es lo que el tutor ve del experimento. Las claves van en
  español con guion bajo (`puntos_cubiertos`) y los valores como texto o
  número legible.

### 1.4 Retos y progreso

- Los retos los devuelve `getChallenges()` con `id`, `title`, `detail`, `done`
  y `progress` de 0 a 1.
- **El `id` de un reto no se cambia nunca después de publicarlo**, porque con
  él se guarda el progreso en la base (`challenge_completions`).
- `reset()` significa "intentar de nuevo" y **no borra logros**.
  `resetChallenges()` es el que borra los logros.
- Cada reto tiene que **poder lograrse** con los rangos de las variables. Para
  los que dependen de números, comprueba con una búsqueda exhaustiva en un
  script que existe al menos una solución, y que la solución no salga con los
  valores por defecto. Así se calibró "Cubre el campus" (ver el comentario de
  `propagation.ts`).

---

## 2. Reglas que hay que respetar

1. **Español neutro con "tú", sin voseo**, en todo: interfaz, explicaciones,
   pistas del tutor y comentarios del código. Se escribe "elige", "mira",
   "puedes", nunca "elegí", "mirá" o "podés".
2. **Gemini es el único proveedor de IA.** No se agrega ningún otro.
3. **El shell no se modifica** para un experimento en particular. Si de verdad
   hace falta algo nuevo en el contrato, se agrega como campo opcional en
   `types/module.ts` y se explica en la entrega.
4. **El motor es lógica pura y determinista**, sin `Math.random()` suelto. Si
   hace falta azar, usa una semilla fija por ronda.
5. **Rendimiento en el celular.**
   - No crees geometrías ni materiales dentro de `useFrame`.
   - Calcula lo pesado, como las líneas de campo, solo cuando cambian las
     variables, con `useMemo`.
   - Limita la cantidad de objetos y no uses texturas enormes.
   - Pruébalo en un celular de gama media.
6. **Modelos 3D:** se convierten con `scripts/obj2glb.py` y se comprimen con
   meshopt, nunca con Draco (ver `scripts/README.md`). Todo recurso externo se
   anota en `CREDITOS.md`. Si sale de Free3D, basta con decir que salió de
   Free3D.
7. **Las rutas y los slugs de este plan se respetan tal cual**, porque son la
   llave del progreso en la base de datos.
8. Cada pieza nueva lleva comentarios con la misma densidad y el mismo tono
   que el resto del código. Se explica el porqué, no el qué.
9. **Entrega en una rama aparte con commits por experimento.** No trabajes
   directamente sobre `main`.

---

## 3. Fase 1: quitar los seis experimentos

| Slug | Nombre | Área |
|---|---|---|
| `taylor` | ¿Cuántos términos? | Cálculo |
| `venturi` | Tubo de Venturi | Física |
| `ondas` | El sintonizador | Física |
| `modulacion` | Sintoniza la emisora | Redes |
| `qam` | Recupera el mensaje | Redes |
| `espectro` | Tu voz en el espectro | Redes |

Por cada uno:

1. Borrar su carpeta en `components/modules/<área>/experiments/<slug>/`.
2. Borrar su página `app/lab/<área>/<slug>/`.
3. Quitarlo de `lib/catalog.ts` (`EXPERIMENTS`), de
   `components/modules/registry.ts` y de `components/lobby/catalog.ts`.

Además:

- **Módulo de fluidos:** el módulo `fisica-fluidos` queda vacío, así que se
  quita de `MODULES` en `lib/catalog.ts`. Comprueba que la pantalla de
  progreso (`app/progreso/page.tsx`) no muestre módulos vacíos.
- **Recorrido guiado** (`lib/tour.ts`): la parada de `venturi` se cambia por
  `leyes-newton` y la de `espectro` por `subredes-vlan`, con su texto `say`.
  Hazlo cuando existan esos experimentos y actualiza el comentario del
  principio.
- **Referencias en el código:** busca los slugs en todo el proyecto con
  `grep -rn "taylor\|venturi\|modulacion\|qam\|espectro" --exclude-dir=node_modules`.
  - En `ExperimentActions.module.css` y `VariablesPanel.module.css` solo hay
    comentarios que los nombran: actualízalos.
  - El `id: "ondas"` de `calculus/shared/tracks.ts` es una **pista** de
    "Frena en el pico", no el experimento de ondas. **No se toca.**
- **Base de datos:**
  - **No se borran** las filas de `experiments` de los experimentos quitados:
    `challenge_completions` tiene `on delete cascade` y se perdería el
    historial de los estudiantes.
  - La app deja de mostrarlos porque ya no están en el catálogo. Comprueba que
    los retos viejos guardados en el dispositivo no rompan la pantalla de
    progreso.

Esta fase se puede entregar sola, antes de los experimentos nuevos.

---

## 4. Ubicación de los experimentos nuevos

### 4.1 Slugs, rutas y módulos

| Slug | Nombre visible | Ruta | Módulo (`lib/catalog.ts`) |
|---|---|---|---|
| `razones-cambio` | Llena el tanque | `/lab/calculus/razones-cambio` | `calculo-nucleo-a` |
| `leyes-newton` | Leyes de Newton | `/lab/physics/leyes-newton` | `fisica-nucleo-a` |
| `campo-electrico` | Guía la carga | `/lab/physics/campo-electrico` | `fisica-electromagnetismo` |
| `subredes-vlan` | Divide la red | `/lab/networks/subredes-vlan` | `redes-segmentacion` (nuevo) |
| `stp` | Rompe el bucle | `/lab/networks/stp` | `redes-segmentacion` (nuevo) |
| `firewall-nat` | Defiende el borde | `/lab/networks/firewall-nat` | `redes-seguridad` (nuevo) |
| `contador` | El contador | `/lab/electronics/contador` | `electronica-digital` |

### 4.2 Módulos de Redes

Se ordenan como el temario del curso. Los slugs que ya existen no cambian,
solo el orden:

| Orden | Slug | Nombre | Experimentos |
|---|---|---|---|
| 0 | `redes-arquitectura` | Arquitectura | osi |
| 1 | `redes-segmentacion` (nuevo) | Segmentación y redundancia | subredes-vlan, stp |
| 2 | `redes-capa-de-red` | Capa de red | enrutamiento |
| 3 | `redes-capa-fisica` | Capa física | cobertura |
| 4 | `redes-seguridad` (nuevo) | Seguridad | firewall-nat |

### 4.3 Orden de las puertas del lobby

Las puertas se colocan solas según el índice en `components/lobby/catalog.ts`.
Con 20 puertas el pasillo se alarga solo, pero hay que comprobar que se
camine bien en el visor.

1. **Física:** Tiro parabólico, Leyes de Newton, Colisiones 1D, Péndulo, Guía la carga, La grúa electromagnética.
2. **Cálculo:** Frena en el pico, Llena el tanque, Suma de Riemann, Tornea la pieza.
3. **Redes:** Arma el paquete, Divide la red, Rompe el bucle, Encuentra el camino, Cubre el campus, Defiende el borde.
4. **Electrónica:** Arma el circuito, La fuente de poder, Arma la lógica, El contador.

### 4.4 La migración de la base de datos

Crea `supabase/migrations/20261020120000_catalogo_v2.sql` con el mismo patrón
de `20261008130000_electronica.sql`: `insert ... on conflict (slug) do update`
para los módulos nuevos, el nuevo orden y los siete experimentos. Al final va
una consulta de comprobación.

También puedes correr `python scripts/generar_migracion_catalogo.py`, que
regenera el catálogo completo desde el código. Revisa que no intente borrar
nada.

### 4.5 Por cada experimento nuevo

- [ ] Carpeta con `engine.ts`, escena, controles e `index.ts`.
- [ ] Página `app/lab/<área>/<slug>/page.tsx` con `ExperimentShell`,
      `disciplineName` ("Física", "Cálculo", "Redes" o "Electrónica") y
      `moduleName`.
- [ ] Entradas en `lib/catalog.ts`, `components/modules/registry.ts` y
      `components/lobby/catalog.ts`.
- [ ] `briefing`, `tutorHints`, `conceptTags`, `cameraView` y, si aplica,
      `whiteboard` con las fórmulas.
- [ ] Paridad en el visor: `vrActions`, `GazeMesh` y texto con `VrText` o
      `SceneLabel`.
- [ ] Retos calibrados y comprobados (sección 1.4).
- [ ] Fila en la tabla de retos de `PRUEBAS.md` y su sección en
      `PLAN_DESARROLLO.md` §3.

---

## 5. Especificación de los experimentos nuevos

Cada especificación trae el concepto, la escena, las variables, el modelo, los
retos y lo que va al visor. Los números de ejemplo están calculados. Si al
calibrar cambias alguno, anótalo en la entrega.

### 5.1 Llena el tanque · `razones-cambio` (Cálculo 1, módulo 3)

**Concepto.** Razones de cambio relacionadas: si dos cantidades están unidas
por una ecuación, sus rapideces de cambio también lo están. Se deriva la
ecuación respecto al tiempo.

**Escena.**
- Un tanque de vidrio con una llave arriba y una regla vertical.
- Una marca roja en la altura meta.
- Un "velocímetro" que muestra la rapidez con que sube el nivel, en
  centímetros por segundo.
- En el escenario de la escalera: una pared, el piso y una escalera de 5 m
  cuya base se jala hacia afuera, con flechas de velocidad en la base y en la
  punta.

**Escenarios** (variable `escenario`):

| Escenario | Geometría | Relación | Rapidez |
|---|---|---|---|
| `cono` | Cono invertido de 2 m de alto y 1 m de radio arriba, r = h/2 | V = πh³/12 | dh/dt = 4Q/(πh²) |
| `cilindro` | Cilindro de 0.5 m de radio | V = πr²h | dh/dt = Q/(πr²), constante |
| `escalera` | Escalera de L = 5 m, base a x de la pared y punta a y = √(L² − x²) | x² + y² = L² | dy/dt = −(x/y)·dx/dt |

**Variables.**

| Clave | Tipo | Rango | Uso |
|---|---|---|---|
| `escenario` | select | cono, cilindro, escalera | |
| `caudal` | number | 2 a 20 L/s, paso 1, por defecto 10 | tanques |
| `altura_meta` | number | 0.4 a 1.8 m, paso 0.1 | tanques |
| `velocidad_base` | number | 0.2 a 1.0 m/s, paso 0.1 | escalera |
| `x_meta` | number | 1 a 4.5 m, paso 0.5 | escalera |
| `prediccion` | number | −100 a 100 cm/s, paso 0.01 | la predicción del estudiante |
| `camara_lenta` | boolean | | divide el tiempo entre 4 al acercarse a la meta |

**Cómo se juega.**
1. Lees la situación, calculas y pones tu predicción.
2. Aprietas "Abrir la llave" (o "Jalar la escalera").
3. Al cruzar la meta, la escena se congela un momento y muestra la rapidez
   real junto a tu predicción.
4. El puntaje se calcula como 100 − error relativo en %. Un acierto es un
   error menor al 5 %.

La predicción se congela al empezar, como en colisiones.

**Modelo.**
- Tanques: se integra V += Q·dt, con Q en m³/s (litros entre 1000), y se
  despeja h. Para el cono, h = ∛(12V/π).
- Escalera: x += v·dt e y = √(L² − x²). Se detiene antes de que y llegue a 0.
- `getSeries()` devuelve la altura (o y) contra el tiempo, para la mini
  gráfica.

**Valores de comprobación.**
- Cono con Q = 10 L/s y h = 1 m: dh/dt = 0.04/π = 0.0127 m/s, es decir
  **1.27 cm/s**. Tarda unos 26 s en llegar.
- Escalera con v = 0.5 m/s y x = 3 m (y = 4 m): dy/dt = **−0.375 m/s**, o
  −37.5 cm/s.

**Retos.**

| id | Título | Se logra cuando |
|---|---|---|
| `cono` | El cono que se llena | Aciertas en el cono con la meta en 1 m o más |
| `cilindro` | ¿Y si es un cilindro? | Aciertas en el cilindro |
| `escalera` | La escalera que resbala | Aciertas la rapidez de la punta, con signo negativo, porque baja |
| `doble-altura` | El doble de alto | En el cono, aciertas dos veces seguidas con el mismo caudal y una meta al doble de la otra, por ejemplo 0.6 y 1.2 m. Enseña que la rapidez baja a la cuarta parte |

**Visor.**
- `vrActions`: la línea de la situación, "Abrir la llave" o "Jalar la
  escalera" como acción principal, "Vaciar el tanque" y el puntaje.
- La predicción ya es una variable, así que se ajusta con el stick.

**Pizarrón.** V = πh³/12, dV/dt = (πh²/4)·dh/dt, x² + y² = L² y
2x·dx/dt + 2y·dy/dt = 0.

**Pistas para el tutor.** La confusión típica es usar el volumen total en vez
de derivar. El tutor guía con preguntas: "¿qué relación une el volumen y la
altura?" y "¿qué pasa al derivar los dos lados respecto al tiempo?". No da el
número.

---

### 5.2 Leyes de Newton · `leyes-newton` (Física 1, semanas 10 y 11)

**Concepto.** La segunda ley de Newton, la fricción estática y la cinética, y
el diagrama de cuerpo libre.

**Escena.**
- Una rampa de madera que se inclina y una caja encima.
- Sobre la caja, el **diagrama de cuerpo libre** con flechas 3D de colores y
  etiquetas:
  - peso (mg);
  - normal (N);
  - fricción (f);
  - fuerza aplicada (F);
  - tensión (T), en el escenario de la polea.
- La variable `componentes` muestra mg·sen θ y mg·cos θ como flechas
  punteadas.
- Escenario de la polea: una caja sobre una mesa unida por una cuerda a una
  pesa que cuelga de una polea en el borde.

**Variables.**

| Clave | Tipo | Rango |
|---|---|---|
| `escenario` | select | plano (plano inclinado), polea |
| `angulo` | number | 0 a 60°, paso 0.5 |
| `masa` | number | 1 a 20 kg, paso 0.5 (en la polea, la caja de la mesa) |
| `masa_colgante` | number | 0.5 a 20 kg, paso 0.5 (solo polea) |
| `superficie` | select | madera sobre madera (μs 0.5, μk 0.3), acero sobre acero (0.74, 0.57), caucho sobre concreto (1.0, 0.8), hielo (0.1, 0.03) |
| `fuerza` | number | −150 a 150 N, paso 1, a lo largo de la rampa; positiva hacia arriba |
| `componentes` | boolean | muestra las componentes del peso |
| `pred_se_mueve` | select | sí, no |
| `prediccion_a` | number | 0 a 10 m/s², paso 0.01 |

**Modelo**, con g = 9.81 m/s²:
- **Plano:** la fuerza que empuja hacia abajo es mg·sen θ − F. La fricción
  estática máxima es μs·mg·cos θ.
  - Si la fuerza que empuja no la supera, a = 0.
  - Si la supera, la fricción cinética μk·mg·cos θ se opone al movimiento y
    a = (fuerza neta) / m.
- **Polea:** se mueve si m₂g > μs·m₁g. Si se mueve,
  a = (m₂g − μk·m₁g)/(m₁ + m₂) y la tensión es T = m₂(g − a).
- Al apretar "Soltar", la caja se mueve con la aceleración calculada y se
  frena al final de la rampa o al chocar con la polea.

**Valores de comprobación.**
- Madera, 30°, 10 kg y F = 0: mg·sen θ = 49.05 N supera a la fricción
  estática máxima de 42.48 N, así que se mueve con a = 9.81·(0.5 − 0.3·0.866)
  = **2.36 m/s²**.
- Ángulo crítico de la madera: arctan 0.5 = **26.57°**.
- Polea con 5 kg en la mesa, 3 kg colgando y madera: 29.43 N > 24.53 N, así
  que se mueve con a = **1.84 m/s²**.

**Retos.**

| id | Título | Se logra cuando |
|---|---|---|
| `se-mueve` | ¿Se mueve o no? | Predices bien si se mueve en tres situaciones seguidas, al menos una que no se mueve |
| `aceleracion` | Predice la aceleración | Error menor al 5 % en una caja que resbala |
| `angulo-critico` | El ángulo crítico | Con F = 0, dejas la caja quieta en un ángulo a menos de 1° por debajo del crítico, y al subir 1° resbala. Sale de tan θ = μs |
| `empuja` | Súbela con lo justo | Encuentras la fuerza mínima que hace subir la caja, a 2 N o menos de mg·sen θ + μs·mg·cos θ |
| `polea` | La pesa que tira | Error menor al 5 % en la aceleración de la polea |

**Visor.**
- `vrActions`: "Soltar", "Volver a poner la caja", el resultado de la
  predicción y una línea con la fuerza neta.
- Las flechas tienen que leerse a 2 m de distancia.

**Pizarrón.** ΣF = m·a, f_s ≤ μs·N, f_k = μk·N, N = mg·cos θ y
a = (m₂g − μk·m₁g)/(m₁ + m₂).

**Pistas para el tutor.** La confusión típica es pensar que la normal siempre
vale mg, o que la fricción estática siempre vale μs·N. El tutor pide dibujar
primero el diagrama.

---

### 5.3 Guía la carga · `campo-electrico` (Física 2, semanas 1 a 3)

**Concepto.**
- La ley de Coulomb y el campo eléctrico de cargas puntuales.
- El movimiento de una carga en un campo eléctrico.
- Las líneas de campo: salen de las positivas y entran en las negativas.

**Escena.**
- Una cámara de vacío grande en la que el estudiante está **adentro**: las
  líneas de campo pasan a su alrededor. Es lo que más aprovecha el visor.
- Cuatro pedestales con esferas cargadas en posiciones fijas. Cada esfera
  toma el color de su signo, rojo para positiva y azul para negativa, con un
  tamaño según la carga.
- Un lanzador que dispara una esferita cargada.
- Un aro como blanco.
- La trayectoria queda dibujada después de cada tiro.

**Escala.**
- La partícula es una esferita de 1 g con carga de ±1 µC, sin gravedad,
  porque está en vacío y en caída libre (se explica en el `briefing`).
- Las cargas fijas van de −5 a 5 µC, a distancias de unos metros.
- Con k = 9×10⁹ N·m²/C², una carga de 5 µC a 1 m ejerce 0.045 N sobre la
  partícula, una aceleración de 45 m/s². Con velocidades de 1 a 6 m/s las
  trayectorias se ven bien.
- Son **unidades reales**, no hay una k inventada.

**Niveles** (variable `nivel`):
1. **Desvía:** el aro está fuera de la línea recta del lanzador y alcanza con
   una carga bien puesta.
2. **Entre placas:** dos placas paralelas con voltaje dan un campo uniforme
   E = V/d. La partícula entra horizontal y sale desviada en parábola, como el
   tiro parabólico pero con fuerza eléctrica, que es como funcionan las
   pantallas de rayos catódicos. Aquí las cargas puntuales se apagan.
3. **Rodea el obstáculo:** hay un muro entre el lanzador y el aro, y hacen
   falta al menos dos cargas.
4. **Campo nulo:** con dos cargas fijas, mueves un sensor hasta el punto donde
   el campo se anula.

**Variables.**

| Clave | Tipo | Rango |
|---|---|---|
| `nivel` | select | desvia, placas, obstaculo, campo-nulo |
| `q1` a `q4` | number | −5 a 5 µC, paso 1 (grupo "Cargas") |
| `signo_particula` | select | positiva, negativa |
| `velocidad` | number | 1 a 6 m/s, paso 0.1 |
| `angulo` | number | −45 a 45°, paso 1 |
| `voltaje` | number | 0 a 3000 V, paso 50 (solo placas) |
| `sensor_x` | number | posición del sensor en el nivel 4, paso 0.05 m |
| `lineas` | boolean | muestra las líneas de campo |

**Modelo.**
- La fuerza sobre la partícula es la suma de k·q·qᵢ·r̂/r² de cada carga, más
  q·V/d entre placas.
- Se integra con pasos chicos (RK4 o Euler semi-implícito con subpasos) para
  que la trayectoria no dependa de los fotogramas.
- Si la partícula toca una esfera, se pega a ella y es un fallo. Si sale de la
  cámara, también.
- **Líneas de campo:** se integran desde cada carga positiva en unas 12 a 16
  direcciones, con unos 200 pasos, y se calculan **solo cuando cambian las
  cargas** (con `useMemo` en la escena o en el motor).

**Valores de comprobación.**
- Placas separadas 0.2 m con 1000 V: E = 5000 V/m. Sobre 1 µC la fuerza es
  5×10⁻³ N y la aceleración 5 m/s².
- Con placas de 1 m de largo y la partícula a 2 m/s, tarda 0.5 s en
  atravesarlas y se desvía ½·5·0.25 = **0.625 m**. Ajusta el largo o la
  separación para que entre en la escena.
- Campo nulo con +4 µC y +1 µC separadas 3 m: el campo se anula a **2 m** de
  la de 4 µC, que sale de (x/(3 − x))² = 4.

**Retos.**

| id | Título | Se logra cuando |
|---|---|---|
| `desvia` | Primer desvío | Pasas por el aro del nivel 1 |
| `placas` | Entre placas | Pasas por el aro del nivel 2. Hay una variante con el signo de la partícula al revés, que obliga a cambiar el voltaje |
| `obstaculo` | Rodea el muro | Pasas por el aro del nivel 3 |
| `campo-nulo` | Donde el campo se anula | Dejas el sensor a menos de 5 cm del punto exacto durante un segundo |

**Visor.**
- `vrActions`: "Lanzar", "Borrar las trayectorias", "Mostrar u ocultar las
  líneas" y el resultado del tiro.
- Que el sensor también se pueda mover con el stick, porque es una variable.

**Pizarrón.** F = k·q₁·q₂/r², E = F/q, E = V/d (placas) y a = qE/m.

**Pistas para el tutor.**
- Confusión típica: creer que la partícula sigue las líneas de campo. No las
  sigue, porque la línea marca la dirección de la fuerza, no la de la
  velocidad.
- Otra confusión: olvidar que una partícula negativa se desvía al revés.

---

### 5.4 Divide la red · `subredes-vlan` (Redes, semanas 2, 3 y 10)

**Concepto.**
- Subredes con máscara variable (VLSM).
- VLAN para separar departamentos en el mismo switch.
- Enrutamiento entre VLAN con router-on-a-stick.
- De paso, la **red jerárquica**: acceso, distribución y núcleo.

**Escena.** Un edificio de oficinas en corte, con dos pisos:
- Cada piso tiene sus PC por departamento, de colores, y un **switch de
  acceso**.
- Los dos switches de acceso suben a un **switch de distribución**, y de ahí
  sale el **router**.
- Cada capa lleva un cartel con su nombre: "Acceso", "Distribución" y
  "Núcleo / router".
- Al lado hay un pizarrón grande con la tabla de subredes: departamento,
  hosts pedidos, máscara, dirección de red, primera y última IP usable,
  broadcast, hosts disponibles y desperdicio.

**Parte 1, subredes.** Bloque 192.168.10.0/24. El estudiante elige la máscara
de cada departamento. El motor asigna las subredes en orden, de la más grande
a la más chica y alineadas, y llena la tabla. Una subred queda en rojo si no
alcanza para sus hosts, y todo queda en rojo si se sale del bloque.

| Ronda | Departamentos (hosts) | Solución óptima |
|---|---|---|
| 1 | Ventas 50, Soporte 25, Contabilidad 12, Gerencia 5 | /26, /27, /28, /29: usa 120 de 256 |
| 2 (ajustada) | Ventas 100, Soporte 60, Contabilidad 28, Gerencia 10, enlace al ISP 2 | /25, /26, /27, /28, /30: usa 244 de 256 |

**Parte 2, VLAN.**
- Cada departamento es una VLAN: 10 Ventas, 20 Soporte, 30 Contabilidad y 40
  Gerencia.
- Hay 8 PC repartidas en los dos pisos, mezcladas.
- El estudiante asigna la VLAN de cada puerto **tocando la PC en la escena**,
  con `GazeMesh`, que pasa a la VLAN siguiente. La variable `pcN` refleja lo
  mismo.
- También decide si el enlace entre switches es **troncal** y si el router
  tiene **subinterfaces**, una por VLAN.

**Prueba de conectividad.** El botón "Probar con ping" manda paquetes animados
de una PC a otra:

| Caso | Resultado |
|---|---|
| Misma VLAN y mismo switch | Llega |
| Misma VLAN, otro switch | Llega solo si el enlace es troncal |
| Otra VLAN | Llega solo si el router tiene subinterfaces y la PC usa su puerta de enlace, la primera IP de su subred |
| Una PC en una VLAN que no es la de su departamento | La prueba la marca como error de configuración |

**Variables.**
- `ronda`: select.
- `mascara_ventas`, `mascara_soporte`, `mascara_contabilidad`,
  `mascara_gerencia` y `mascara_enlace`: select de /24 a /30, grupo "Máscaras".
- `pc1` a `pc8`: select con VLAN 10, 20, 30 o 40, grupo "Puertos".
- `troncal` y `subinterfaces`: boolean.

**Retos.**

| id | Título | Se logra cuando |
|---|---|---|
| `sin-desperdicio` | Sin desperdiciar | La ronda 1 con las máscaras óptimas |
| `ajustada` | Que todo quepa | La ronda 2 sin salirse del /24 |
| `vlan` | Cada quien en su VLAN | Las 8 PC bien asignadas, y la prueba muestra que las VLAN distintas no se ven sin el router |
| `entre-vlan` | Que se hablen | El ping entre VLAN distintas funciona con troncal y subinterfaces |

**Visor.**
- `vrActions`: "Probar con ping", el resultado de la última prueba y una
  línea con el resumen de la tabla, por ejemplo "120 de 256 direcciones
  usadas".
- La tabla del pizarrón tiene que leerse en el visor. Si no cabe, muestra
  solo la fila del departamento que se mira.

**Pistas para el tutor.**
- Hosts usables = 2^(32 − prefijo) − 2.
- Confusión típica: elegir la máscara por el número de hosts sin restar la red
  y el broadcast. 62 hosts caben en /26, pero 64 no.
- No da las máscaras: pregunta cuántas direcciones necesita cada uno.

---

### 5.5 Rompe el bucle · `stp` (Redes, semana 5)

**Concepto.**
- Los bucles de capa 2 y la tormenta de broadcast.
- El protocolo STP: elección del puente raíz, puertos raíz, designados y
  bloqueados, y la reconvergencia cuando se cae un enlace.
- EtherChannel.

**Topología fija:**

| Switch | Prioridad inicial | MAC (termina en) |
|---|---|---|
| Núcleo | 32768 | :04 |
| Distribución | 32768 | :03 |
| Acceso 1 | 32768 | :01 |
| Acceso 2 | 32768 | :02 |

Los enlaces, con costo STP de 4 para 1 Gbps y 19 para 100 Mbps:

| Enlace | Velocidad |
|---|---|
| Núcleo–Distribución | **Dos enlaces paralelos** de 1 Gbps |
| Núcleo–Acceso 1 y Núcleo–Acceso 2 | 1 Gbps |
| Distribución–Acceso 1 y Distribución–Acceso 2 | 100 Mbps |

Cada switch de acceso tiene dos PC. Con las prioridades por defecto **el
puente raíz es Acceso 1**, por tener la MAC más baja. Es una mala raíz, y esa
es la lección: hay que configurar la prioridad.

**Escena.**
- Los cuatro switches sobre bastidores, unidos por cables 3D. El grosor y el
  color del cable muestran la carga.
- Cada puerto tiene un LED de color: verde para el puerto raíz, azul para el
  designado y naranja para el bloqueado.
- Las tramas son cubitos que viajan por los cables.

**Partes.**
1. **Sin STP:** "Enviar un broadcast" hace que las tramas se multipliquen en
   cada switch. El contador de tramas por segundo se dispara, los cables se
   ponen rojos y aparece "Tormenta de broadcast: la red está caída". Se
   detiene con "Apagar los switches".
2. **Elige la raíz:** el estudiante cambia la prioridad de los switches en
   múltiplos de 4096 para que el Núcleo sea la raíz.
3. **Predice:** antes de activar STP, marca qué enlaces cree que quedarán
   bloqueados, tocándolos en la escena o con las variables. Luego "Activar
   STP" anima los BPDU y pinta los puertos.
4. **Cae un enlace:** al tocar un enlace se corta. STP reconverge con una
   animación de unos segundos y la nota "STP clásico tarda de 30 a 50
   segundos, aquí se acelera". El estudiante comprueba que el broadcast sigue
   llegando a todas las PC.
5. **EtherChannel:** al agrupar los dos enlaces Núcleo–Distribución, STP los
   ve como uno solo y ninguno se bloquea. Se muestra el ancho de banda: 2 Gbps
   en vez de 1.

**Algoritmo**, en el motor y documentado en comentarios:
1. La raíz es el switch con el menor ID (prioridad y luego MAC).
2. El costo hacia la raíz se calcula con caminos mínimos.
3. Cada switch que no es raíz elige su puerto raíz: el de menor costo. Si hay
   empate, gana el vecino con menor ID y después el puerto con menor número.
4. En cada enlace, el puerto designado es el del switch con menor costo a la
   raíz, y si hay empate, el de menor ID.
5. Todos los demás puertos quedan bloqueados.

Con el Núcleo como raíz se bloquean un enlace Núcleo–Distribución, el lado de
Distribución en Distribución–Acceso 1 y en Distribución–Acceso 2. Verifícalo
con el motor.

**Variables.**
- `prioridad_nucleo`, `prioridad_distribucion`, `prioridad_acceso1` y
  `prioridad_acceso2`: select de 0 a 61440 en pasos de 4096.
- `stp`: boolean.
- `etherchannel`: boolean.
- `pred_enlace1` a `pred_enlace6`: boolean, grupo "Tu predicción: ¿se
  bloquea?".
- `enlace_caido`: select con ninguno o cada enlace.

**Retos.**

| id | Título | Se logra cuando |
|---|---|---|
| `tormenta` | Provoca una tormenta | Mandas un broadcast sin STP y ves caer la red |
| `raiz` | Elige bien la raíz | El Núcleo queda como puente raíz |
| `prediccion` | Piensa como STP | Tu predicción de enlaces bloqueados coincide con la de STP en el primer intento con esa raíz |
| `se-recupera` | La red se recupera | Con STP activo, cortas un enlace y el broadcast llega a las 4 PC |
| `etherchannel` | Todo el ancho de banda | Con EtherChannel no se bloquea ningún enlace entre Núcleo y Distribución |

**Visor.**
- `vrActions`: "Enviar un broadcast", "Activar STP" o "Apagar STP", "Apagar
  los switches", "Restaurar los enlaces" y la línea de estado ("Raíz:
  Núcleo").
- Los enlaces se tocan con la mira, con `GazeMesh`.

**Pistas para el tutor.** Confusión típica: creer que STP bloquea "el enlace
más lento". Bloquea según el costo hacia la raíz y el ID del switch, y un
mismo enlace tiene un lado designado y otro bloqueado.

---

### 5.6 Defiende el borde · `firewall-nat` (Redes, semanas 13 y 14)

**Concepto.**
- Listas de control de acceso: se evalúa la primera regla que coincide, el
  orden importa y al final hay un "deny" implícito.
- La inspección de las conexiones ya establecidas.
- NAT y PAT, y el reenvío de puertos.

**La mecánica principal es elegir y ordenar, no escribir.** El estudiante
escoge tarjetas de un mazo y las ordena en un rack.

**Escena.**
- A la izquierda, la nube de internet.
- En medio, el router con un **rack de 6 ranuras** numeradas de arriba hacia
  abajo y, debajo de la última, la placa fija "Bloquear todo lo demás", que es
  el deny implícito.
- A la derecha, la red interna:
  - servidor web en 192.168.1.20;
  - base de datos en 192.168.1.30;
  - tres PC de empleados de 192.168.1.10 a .12;
  - la PC del administrador.
- Sobre una mesa, el mazo de tarjetas. Al tocar una tarjeta (`GazeMesh`), va a
  la primera ranura libre. Al tocar una tarjeta del rack, vuelve al mazo.

**El mazo:**

| id | Tarjeta | Nota |
|---|---|---|
| `web` | Permitir web (TCP 80 y 443) hacia el servidor web | necesaria |
| `ssh-admin` | Permitir SSH (TCP 22) desde 200.10.5.7 (el administrador) | necesaria en la ronda 2 |
| `respuestas` | Permitir respuestas de conexiones iniciadas desde adentro | necesaria |
| `bloquear-ssh` | Bloquear SSH desde cualquier origen | trampa de orden |
| `bloquear-bd` | Bloquear TCP 3306 (base de datos) desde internet | redundante |
| `bloquear-ping` | Bloquear ping (ICMP) desde internet | redundante |
| `permitir-todo` | Permitir todo | trampa |
| `bloquear-todo` | Bloquear todo | trampa: tumba el servicio |
| `permitir-bd` | Permitir TCP 3306 desde cualquier origen | trampa |
| `permitir-ssh` | Permitir SSH desde cualquier origen | trampa |
| `permitir-ping` | Permitir ping desde cualquier origen | trampa leve |
| `bloquear-web` | Bloquear TCP 80 hacia el servidor web | trampa |

**El tráfico:**

| id | Paquete | Tipo |
|---|---|---|
| `cliente-https` | Un cliente de internet visita la web (TCP 443) | legítimo |
| `cliente-http` | Un cliente visita la web (TCP 80) | legítimo |
| `respuesta` | La respuesta a un empleado que navega | legítimo |
| `admin-ssh` | El administrador entra por SSH desde 200.10.5.7 | legítimo, ronda 2 |
| `fuerza-bruta` | Un atacante (45.33.12.9) prueba contraseñas por SSH | ataque, ronda 2 |
| `ataque-bd` | Un atacante intenta entrar a la base de datos (TCP 3306) | ataque |
| `escaneo` | Un atacante hace ping a toda la red buscando equipos | ataque |
| `ransomware` | Un atacante intenta entrar a una PC por TCP 445 | ataque |

**Cómo se juega.**
- "Lanzar el tráfico" manda los paquetes de la ronda uno por uno, como cubitos
  con etiqueta. Cada uno baja por el rack y se ilumina la regla que coincidió,
  o la placa del deny implícito.
- El resultado de cada paquete es uno de cuatro:
  - legítimo que pasa: verde;
  - legítimo bloqueado: "Servicio caído" en naranja;
  - ataque bloqueado: escudo verde;
  - ataque que pasa: el equipo atacado se pone en rojo con "Te atacaron".
- Al final se ve un resumen: cuántos legítimos pasaron, cuántos ataques se
  frenaron y cuántas reglas usaste.

**Rondas** (variable `ronda`):
1. **Protege la base de datos:** paquetes `cliente-https`, `cliente-http`,
   `respuesta`, `ataque-bd` y `escaneo`. Solución mínima: `web` y
   `respuestas`. Todo lo demás lo frena el deny implícito.
2. **El orden importa:** todos los paquetes. Solución mínima: `ssh-admin`,
   `web` y `respuestas`. Si se pone `bloquear-ssh` antes de `ssh-admin`, el
   administrador queda afuera. Esa es la lección.
3. **NAT:**
   - Las PC de los empleados navegan y se ve la **tabla de traducción**
     llenándose: 192.168.1.10:51000 sale como 190.56.20.4:40001, y así con
     cada una.
   - Luego llega un visitante a la web pública. Sin reenvío de puertos no
     llega, porque NAT no sabe a quién dárselo.
   - El estudiante elige una tarjeta de NAT entre:
     - "Reenviar 443 al servidor web", la correcta;
     - "Reenviar todos los puertos a la PC de Gerencia", una trampa;
     - "Reenviar 3306 a la base de datos", otra trampa.
   - Con la correcta, el visitante llega y nadie más queda expuesto.

**Variables.**
- `ronda`: select.
- `regla1` a `regla6`: select con "vacía" o cada tarjeta. Es el orden del
  rack.
- `nat_reenvio`: select con ninguno o cada tarjeta de NAT.

Las tarjetas de la escena solo cambian estas variables. Así el visor funciona
sin trabajo extra y el tutor ve el rack completo.

**Retos.**

| id | Título | Se logra cuando |
|---|---|---|
| `base-protegida` | Protege la base de datos | La ronda 1 sin ataques ni servicio caído |
| `orden` | El orden importa | La ronda 2 sin ataques ni servicio caído |
| `minimo` | Con lo justo | La ronda 2 con 3 reglas o menos |
| `nat` | Abre solo lo necesario | La ronda 3 con la web visible y nada más expuesto |

**Visor.**
- `vrActions`: "Lanzar el tráfico", "Vaciar el rack", la línea de la ronda y
  el resumen del último lanzamiento.
- Tanto las tarjetas como las ranuras se tocan con la mira.

**Pistas para el tutor.** Explica el deny implícito y por qué "permitir lo
necesario y bloquear lo demás" es más seguro que "bloquear lo malo". No dice
qué tarjetas van: pregunta qué tráfico necesita entrar.

---

### 5.7 El contador · `contador` (Digital, semanas 8, 10 y 13)

**Concepto.**
- Flip-flops y circuitos secuenciales.
- Contador asíncrono de cuatro bits, ascendente y descendente.
- Divisor de frecuencia.
- Contadores de módulo N con reinicio.
- El decodificador a siete segmentos.

**Escena:** una mesa de laboratorio con:
- un **generador de reloj** con su LED;
- **cuatro flip-flops T**, J = K = 1, activos en el flanco de bajada, como
  chips grandes con un LED en Q;
- un **decodificador** BCD a siete segmentos con su **display**. Del 10 al 15
  muestra A, b, C, d, E y F, como un decodificador hexadecimal;
- una **compuerta NAND de reinicio** cuyas entradas se eligen;
- una pantalla con el **diagrama de tiempos**, cinco canales (reloj, Q0, Q1,
  Q2 y Q3) que avanzan con el tiempo. Se puede reutilizar el osciloscopio de
  la fuente de poder.

**Variables.**

| Clave | Tipo | Rango |
|---|---|---|
| `reloj` | select | manual, automático |
| `frecuencia` | number | 0.5 a 8 Hz, paso 0.5 |
| `clk_ff2`, `clk_ff3`, `clk_ff4` | select | "Q del anterior" o "Q̄ del anterior" |
| `rst_q0` a `rst_q3` | boolean | qué salidas entran a la NAND de reinicio (grupo "Reinicio") |
| `valor_carga` | number | 0 a 15, paso 1: lo que se carga cuando la NAND se activa (0 es un reinicio normal) |
| `pred_frecuencia_q3` | number | 0 a 8 Hz, paso 0.125 |

**Modelo.**
- El reloj del primer flip-flop es el generador. Cada flip-flop siguiente toma
  su reloj de Q o Q̄ del anterior, según la variable, y cambia en el flanco de
  bajada.
- Con Q la cuenta sube y con Q̄ baja. Con mezclas salen secuencias raras, y
  eso también sirve para aprender.
- **Reinicio asíncrono:** cuando todas las salidas elegidas valen 1, el
  contador se carga con `valor_carga`.
  - Durante un instante muy breve el display alcanza a mostrar el estado
    prohibido (el 10 en un contador de década). Se dibuja como un destello
    para explicar el **estado transitorio**.
  - Si no hay entradas elegidas, la NAND no hace nada.
- "Dar un pulso" genera un flanco en modo manual.

**Valores de comprobación.**

| Caso | Configuración |
|---|---|
| Ascendente | Los tres relojes en Q |
| Descendente | Los tres en Q̄ |
| Década (0 a 9) | Ascendente, NAND con Q3 y Q1 (el 10 es 1010) y carga 0 |
| Módulo 6 (0 a 5) | Ascendente, NAND con Q2 y Q1 (el 6 es 0110) y carga 0 |
| De 9 a 0 | Descendente, NAND con Q3, Q2, Q1 y Q0 (el 15 que aparece después del 0) y carga 9 |
| Divisor | Con reloj de 8 Hz, Q3 va a **0.5 Hz** |

**Retos.**

| id | Título | Se logra cuando |
|---|---|---|
| `divisor` | Divide la frecuencia | Predices bien la frecuencia de Q3 con un reloj distinto de 1 Hz |
| `cuenta-atras` | Cuenta hacia atrás | Recorre una vuelta completa de 15 a 0 |
| `decada` | Solo hasta 9 | Una vuelta completa de 0 a 9 sin mostrar letras, salvo el destello transitorio |
| `temporizador` | El temporizador | Cuenta de 9 a 0 y vuelve a 9 dos veces seguidas |
| `reloj` | Las decenas del reloj | Una vuelta completa de 0 a 5 |

**Visor.**
- `vrActions`: "Dar un pulso" (manual), "Arrancar" o "Detener" (automático),
  "Poner en cero" y una línea con la cuenta en binario y en decimal.
- El diagrama de tiempos tiene que leerse en el visor: líneas gruesas y pocos
  ciclos en pantalla.

**Pizarrón.** f_Qn = f_reloj / 2^(n+1), "Q → cuenta hacia arriba, Q̄ → cuenta
hacia abajo" y "Reinicio: NAND de las salidas que valen 1 en el número N".

**Pistas para el tutor.** La confusión típica es poner en la NAND el último
número que debe mostrarse (9) en vez del primero que no (10). El tutor pide
escribir en binario el número donde debe reiniciar.

---

## 6. Mejora de Cubre el campus · `cobertura`

Hoy un punto se cuenta como cubierto solo por tener señal. Se le agrega la
**demanda**, para que diseñar sea cubrir **y** aguantar la carga en la hora
pico, como en un diseño de red real.

**Lo que se agrega:**
- **Usuarios por punto**, en `propagation.ts` junto a `POINTS`, con un perfil
  horario de 24 valores entre 0 y 1. Por ejemplo:
  - Cafetería con pico a las 12 y 13 horas.
  - Aulas con pico de 8 a 11 y de 14 a 17.
  - Biblioteca más pareja.
  - Parqueo y Entrada con picos al llegar y al salir.
- **Demanda por usuario:** 0.5 Mbps, o lo que salga al calibrar.
- **Capacidad por antena según la banda:** unos 50 Mbps en 900 MHz, 150 en
  2.4 GHz y 600 en 5 GHz, compartidos entre los puntos que atiende.
- **Asignación:** cada punto se conecta a la antena con mejor señal. La carga
  de una antena es la suma de la demanda de sus puntos. Si se pasa de su
  capacidad, sus puntos quedan **saturados**, con un color nuevo en el piso y
  en las columnas (naranja).
- **Variable nueva** `hora`: number de 0 a 23 con paso 1, por defecto 13.
- **Gráfica:** `getSeries()` devuelve la demanda total contra la hora del día,
  y así el panel de resultados muestra la curva de consumo.
- **Escena:** una barra de carga sobre cada antena, en verde, amarillo o rojo
  según el porcentaje de uso, con el texto "80 de 150 Mbps".

**Reto nuevo:**

| id | Título | Se logra cuando |
|---|---|---|
| `hora-pico` | Aguanta la hora pico | En la hora de mayor demanda, todos los puntos con buena señal, sin interferencia y sin antenas saturadas |

**Calibración.** Este es el punto más delicado. Con una búsqueda exhaustiva
sobre banda, potencia, postes y canales, comprueba que:
- con 900 MHz no alcanza la capacidad aunque se cubra todo;
- con 2.4 GHz y tres antenas bien repartidas sí se puede;
- la solución no es la de los valores por defecto.

Los retos `campus`, `wifi` y `reutilizar` **no cambian**, ni su id ni su
condición.

**Hay que actualizar:**
- `briefing`, agregando la demanda y la hora pico;
- `tutorHints`, con el modelo de capacidad y los números;
- `getState().result`, con la hora, la demanda total, la carga de cada antena
  y los puntos saturados;
- `vrActions`, con la leyenda del color naranja y una línea con la carga de
  cada antena.

---

## 7. Documentación a actualizar

- `README.md`: la lista de "Qué incluye" con los 20 experimentos.
- `PLAN_DESARROLLO.md` §3: quitar o marcar como retirados los seis y agregar
  la sección de cada nuevo con su diseño, el modelo y los números de
  calibración.
- `PRUEBAS.md` §2:
  - el título pasa a "los 20";
  - la tabla de retos y el total;
  - las pistas de solución de cada experimento nuevo.
- `PRUEBAS.md` §5: las paradas del recorrido.
- `CREDITOS.md`: los modelos o texturas nuevas.
- La documentación de Word del proyecto **no** se toca. Se actualiza aparte
  después de la revisión.

---

## 8. Orden de trabajo sugerido

1. **Fase 1:** quitar los seis experimentos (sección 3). Entregar.
2. **Cubre el campus con demanda** (sección 6), porque ya existe la base.
3. **Llena el tanque** y **Leyes de Newton**, los más directos, que sirven
   para agarrar el ritmo del contrato.
4. **El contador**, que se parece a "Arma la lógica".
5. **Defiende el borde** y **Divide la red**.
6. **Rompe el bucle**.
7. **Guía la carga**, que tiene la escena más pesada por las líneas de campo.
8. El recorrido guiado, la migración de la base y los documentos.

Conviene entregar después de cada experimento, o de cada dos, para revisarlos
por partes.

---

## 9. Qué entregar para la revisión

Por cada entrega:

1. **El nombre de la rama** y la lista de commits.
2. **Una nota corta por experimento**, con:
   - lo que se hizo y lo que quedó distinto a este plan, con el motivo;
   - los números de calibración de cada reto y una solución de ejemplo
     comprobada;
   - lo que falta o lo que no se pudo probar.
3. **Capturas** en modo computadora y en modo visor, con la pantalla dividida
   en dos.
4. Que `npx tsc --noEmit -p .` y `npx eslint` pasen sin errores.
5. Confirmación de que se probó en un celular dentro del visor, y si fue con
   el control Bluetooth.

### Lo que se va a revisar

- **El concepto está bien enseñado:**
  - los números del modelo son correctos;
  - el `briefing` lo entiende alguien que nunca vio el tema;
  - el tutor tiene lo que necesita para guiar sin dar la respuesta.
- **Los retos se pueden lograr**, no se logran solos con los valores por
  defecto y sus ids siguen este plan.
- **Paridad total en el visor:** todo lo que se hace con el mouse se puede
  hacer con la mira y el control, y todo el texto se lee.
- **Rendimiento aceptable en un celular.**
- **Español neutro sin voseo** en todos los textos y comentarios.
- **El código sigue el estilo del resto:** motor puro, escena que solo dibuja
  y comentarios que explican el porqué.
- **No se modificó el shell** sin justificarlo.
- **No se borró nada de la base de datos.**
