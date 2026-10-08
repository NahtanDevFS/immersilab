# ImmersiLab — Plan de Desarrollo

> Laboratorio inmersivo para enseñar Cálculo, Física y Redes/Telecomunicaciones,
> con tutor por voz, pensado para visor 360 (celular + Cardboard/VR-box).
>
> Documento vivo. Última revisión: 2026-10-06.

---

## 0. Estado actual (línea base)

Lo que **ya funciona**:

| Pieza | Archivo | Estado |
|---|---|---|
| Contrato de módulos | `types/module.ts` | Sólido. El shell no conoce ninguna disciplina. |
| Shell de experimento | `components/shell/ExperimentShell.tsx` | Funciona; genérico. |
| Lobby 3D con puertas | `components/lobby/` | Pasillo con puertas enfrentadas; navegación por proximidad. |
| Colisiones del jugador | `lib/collision/` | Recinto del pasillo + cajas por objeto. |
| Voz que explica el experimento | `lib/narration/`, `components/shell/BriefingPanel.tsx` | Web Speech API; texto + audio. |
| Giroscopio + gate horizontal | `useDeviceOrientation.ts`, `OrientationGate.tsx` | Funciona. |
| Caminar con gamepad | `MovementController.tsx` | Stick izquierdo, relativo a la cámara. |
| Cursor virtual + sliders | `useVirtualCursor.ts` | Stick derecho + botón X (índice 0). |
| Panel de variables en 3D | `components/shell/VariablesHud3D.tsx` | Modo visor: el panel vive en la escena, no en la esquina de la pantalla. |
| Timestep fijo 1/60s | `lib/physics-engine/useFixedTimestep.ts` | Funciona. |
| Física: tiro parabólico | `.../tiro-parabolico/` | Funciona. |
| Física: colisiones 1D | `.../colisiones-1d/` | Funciona. |
| Redes: constelación QAM (R2) | `.../networks/experiments/qam/` | Funciona. |
| Redes: enrutamiento (R4) | `.../networks/experiments/enrutamiento/` | Funciona. |
| Redes: OSI y TCP/IP (R5) | `.../networks/experiments/osi/` | Funciona. |
| Redes: modulación AM/FM (R1) | `.../networks/experiments/modulacion/` | Funciona (lógica probada con 23 casos; audio sin probar en el celular). |
| Redes: propagación y cobertura (R3) | `.../networks/experiments/cobertura/` | Funciona (17 casos probados). |
| Redes: espectro de la voz (R6) | `.../networks/experiments/espectro/` | Funciona (probado con señales sintéticas; falta probar con voz real). |
| Física: tubo de Venturi (fluidos) | `.../physics/experiments/venturi/` | Funciona, con 3 retos. |
| Física: péndulo y energía (F3) | `.../physics/experiments/pendulo/` | Funciona (15 casos probados). |
| Física: ondas y superposición (F4) | `.../physics/experiments/ondas/` | Funciona (15 casos probados). |
| Cálculo: suma de Riemann (C2) | `.../calculus/experiments/suma-riemann/` | Funciona. |
| Cálculo: sólidos de revolución (C3) | `.../calculus/experiments/solidos-revolucion/` | Funciona. |
| Cálculo: derivada (C1) | `.../calculus/experiments/derivada-pico/` | Funciona. |
| Cálculo: series de Taylor (C4) | `.../calculus/experiments/taylor/` | Funciona (16 casos probados). |
| Catálogo de funciones y pistas | `components/modules/calculus/shared/` | Compartido por los experimentos de cálculo. |
| Texturas PBR con tiling | `useTiledPbrTexture.ts` | Funciona; convención Poly Haven. |
| Tutor por voz | `app/api/tutor/`, `components/tutor/`, `lib/tutor/` | Implementado (Fase B) con Gemini: push-to-talk R2/botón, streaming, TTS por oración, barge-in, subtítulos, modo sin conexión. Probado con la key real en escritorio; falta el celular. |

Lo que **falta**:

- Módulo de Física: completo (F1, F2, F3, F4 y Venturi).
- Módulo de Cálculo: completo (C1, C2, C3 y C4).
- Módulo de Redes: completo (R1 a R6).
- Tutor de IA: implementado con Gemini (`GEMINI_API_KEY`), con `tutorHints`
  en todos los experimentos y límite de preguntas por IP. Falta medir la latencia
  en el celular dentro del visor.
- Supabase: catálogo, `challenge_completions` y RLS en
  `supabase/migrations/20261006120000_catalogo_y_retos.sql` (generada por
  `scripts/generar_migracion_catalogo.py`), ya aplicada.
- Capa de "juego": HUD de retos unificado y retos en los 15 experimentos
  (47 en total).
  Progreso guardado (dispositivo + Supabase, migración ya aplicada),
  pantalla de progreso, comentario del tutor al lograr un reto y vista
  docente (`/docente`): Fase C completa.
- Calidad visual: ver sección 2.

---

## 1. Supuestos y decisiones tomadas

Estas decisiones se toman aquí para no bloquear el desarrollo. Si alguna no
coincide con lo que quieres, se cambia aquí y el resto del plan se ajusta.

| Decisión | Elección | Por qué |
|---|---|---|
| **Dispositivo objetivo** | Celular Android gama media (Snapdragon 6xx/7xx) dentro de un visor tipo Cardboard, Chrome | Es el escenario más restrictivo y el más probable en la defensa. Si corre ahí, corre en laptop. |
| **Presupuesto de render** | 60 fps objetivo, 30 fps piso. ~150k triángulos visibles, 1 sola luz con sombra | Un celular gama media no aguanta más. |
| **Post-proceso** | Solo **bloom selectivo** + vignette. Sin SSAO, sin DOF, sin motion blur | SSAO en móvil cuesta ~40% del frame para un efecto que casi no se nota en un visor. |
| **Dirección de arte** | **"Laboratorio limpio + HUD holográfico"** — espacio arquitectónico real y luminoso, con la data superpuesta en teal/ámbar translúcido | Es legible en proyector, se ve profesional en la defensa, y aprovecha los tokens teal/ámbar que ya existen en `globals.css`. Un lab oscuro sci-fi se ve genial en foto pero es ilegible en un visor barato, donde los lentes pierden contraste. |
| **Idioma** | Español neutro, tuteo (tú), sin voseo ni regionalismos, en todo texto que ve o escucha el usuario: interfaz, explicaciones, nombres de los juegos y voz del tutor | Decisión del equipo (2026-10-06): lo entiende cualquier hispanohablante, incluido el jurado. |
| **Modelo del tutor** | Google Gemini: `gemini-3.5-flash-lite` (respaldo `gemini-2.5-flash`), pensamiento bajo y streaming | Ver sección 4.3. |

---

## 2. Dirección visual — por qué se ve plano y cómo se arregla

### 2.1 Diagnóstico (verificado en el código)

1. **La luz del lobby es cenital y sin sombras.** `LobbyShell.tsx` monta
   `<directionalLight position={[0, 4.5, 0]} intensity={0.6} />` — apuntando
   recto hacia abajo desde el centro del techo. Luz vertical = cero volumen.
   Además **ninguna luz del lobby tiene `castShadow`** y ninguna pared tiene
   `receiveShadow`, así que el `shadows` del `<Canvas>` no produce nada.
2. **El HDRI de los experimentos está subexpuesto.** `LabBackground.tsx` usa
   `environmentIntensity={0.2}` — mata los reflejos y el rebote de luz, que es
   justamente lo que da profundidad.
3. **El techo es un plano de color liso** (`#0b1220`, `LobbyScene.tsx`). A 5 m
   sobre la cabeza y ocupando medio campo visual en un visor, es lo que más
   aplana la sala.
4. **La sala es una caja vacía**: 4 planos + piso + techo. Sin zócalo, sin
   cornisa, sin columnas, sin nada que dé escala.
5. **Los experimentos son primitivas grises.** El cañón es un `boxGeometry`
   color `#444`; los carritos, cubos lisos. Sin metalness/roughness, sin
   rejilla de referencia, sin cotas ni ejes.
6. **No hay post-proceso instalado** (`@react-three/postprocessing` no está en
   `package.json`), así que el `emissive` teal de las puertas cambia de color
   pero no *brilla*.

### 2.2 Sistema de iluminación estándar (aplicar a lobby y experimentos)

Un solo esquema, reutilizable, en un componente nuevo `components/shell/LabLighting.tsx`:

- **Key light** — `directionalLight` en ángulo (≈ 35° de elevación, 40° de azimut),
  `castShadow`, `shadow-mapSize={[2048, 2048]}`, `shadow-bias={-0.0005}`, y el
  `shadow-camera` ceñido a la escena. Un frustum de sombra flojo desperdicia
  resolución y produce el "acné" de sombras.
- **Fill** — `hemisphereLight` (cielo frío / piso cálido, intensidad ~0.3).
  Reemplaza al `ambientLight` plano.
- **Rim / prácticas** — 2–3 `pointLight` de baja intensidad detrás de los props,
  para despegarlos del fondo.
- **Ambiente** — `<Environment>` con HDRI, `environmentIntensity` entre **0.6 y 1.0**
  (no 0.2).
- **`<ContactShadows>` de drei** bajo cada prop. Es la mejora costo/beneficio más
  alta que existe: cuesta poquísimo y hace que los objetos dejen de "flotar".

### 2.3 Arquitectura de la sala (lobby)

Reemplazar la caja de 6 planos por:

- **Zócalo** (0.12 m) y **cornisa** (0.15 m) en las 4 paredes — dos cajas finas
  por pared, casi gratis, y dan escala de inmediato.
- **Techo con retícula**: paneles de 1.2 × 0.6 m con tiras `emissive` entre ellos.
  Esas tiras son las que después alimentan el bloom.
- **Pilastras** cada 5 m sobre las paredes laterales.
- **Nichos por puerta**: cada puerta metida en un retranqueo de 0.4 m, con una luz
  de acento propia y un rótulo 3D encima. Convierte cada experimento en un
  "stand" en vez de una calcomanía sobre una pared.
- **Piso**: cambiar mármol por porcelanato técnico claro o vinílico de laboratorio,
  con una **franja de guía** de color hacia cada puerta — ayuda de navegación
  real en visor, no solo decoración.

### 2.4 Materiales de los experimentos

Sustituir todos los `meshStandardMaterial color="#444"` por materiales con
carácter:

| Objeto | Material |
|---|---|
| Cañón | Metal oscuro: `metalness: 0.9`, `roughness: 0.35`, `envMapIntensity: 1` |
| Riel de colisiones | Aluminio anodizado: `metalness: 0.8`, `roughness: 0.25` |
| Carritos | Plástico ABS de color: `metalness: 0.05`, `roughness: 0.5` + arista `emissive` tenue |
| Proyectil | Goma mate: `roughness: 0.85` |
| Trayectoria / vectores | `emissive` fuerte + bloom selectivo |
| Superficies de datos (curvas de cálculo) | `transparent`, `opacity: 0.35`, `side: DoubleSide`, `emissive` |

### 2.5 Presupuesto de post-proceso

```
@react-three/postprocessing  →  <EffectComposer>
  <Bloom  luminanceThreshold={1.0}  intensity={0.6}  mipmapBlur />
  <Vignette  offset={0.3}  darkness={0.4} />
```

Solo eso. Bloom con `luminanceThreshold` en 1.0 significa que **únicamente** los
materiales cuyo `emissive × emissiveIntensity` supere 1 brillan — o sea, el HUD y
las tiras de luz, no toda la escena. Vignette cuesta prácticamente cero y en un
visor ayuda a centrar la vista.

**Regla de escape:** si en el celular objetivo el frame baja de 30 fps, se apaga
el `EffectComposer` con una prop y se sube `emissiveIntensity` para compensar.
El diseño no debe *depender* del bloom.

### 2.6 Trampas encontradas al implementar la Fase A

Tres bugs reales que costaron tiempo. Todos tienen el mismo síntoma —
**pantalla negra, sin un solo error en consola** — y por eso quedan
documentados aquí y en comentarios dentro del código.

1. **Varias cargas bajo un mismo `<Suspense>` no resuelven nunca.**
   `useTexture` y `useGLTF` suspenden mientras descargan. Con React 19.2 +
   drei 10, si dos o más cuelgan del mismo límite, ese límite se queda
   pendiente para siempre. **Este bug ya estaba en el proyecto**: el lobby
   estaba en negro en toda carga en frío desde que se le pusieron texturas, y
   solo aparecía después de que el hot-reload lo re-renderizara — que es
   exactamente por qué no se había notado en desarrollo.
   *Regla:* cada superficie o modelo, en su propio
   `<Suspense fallback={null}>`. Separarlo en un componente aparte no
   alcanza; los hermanos que comparten límite se bloquean igual.

2. **`<Environment>` con `<Lightformer>` como hijos deja la escena en negro.**
   Con esta combinación de versiones, la variante de entorno procedural de
   drei rompe el render. *Regla:* usar `<Environment files="...">` con un
   HDRI. Es también la razón por la que el lobby hoy reutiliza el HDRI de
   atardecer hasta que esté el de interior (§5.2).

3. **`mipmapBlur` en `<Bloom>` deja la escena en negro.**
   Con @react-three/postprocessing 3.1.1 + postprocessing 6.39.4 + three
   0.185. El bloom sin esa opción se ve prácticamente igual.

Corolario de diseño, no solo de deuda técnica: mientras los assets cargan,
un `fallback={null}` es indistinguible de una app rota. Por eso el indicador
de progreso (`LoadingOverlay`) se adelantó de la Fase F a la Fase A.

**Un cuarto tropiezo, que no es un bug sino física de color:** un hex que en
un selector parece "gris azulado" (`#222c40`) sale casi negro en pantalla
después de pasar a espacio lineal y por el tone mapping ACES. El techo del
lobby estuvo tres iteraciones viéndose como un agujero por esto, y el
diagnóstico equivocado era "no le llega luz". Al elegir colores para
superficies grandes, partir de tonos bastante más claros de lo que parece
correcto.

### 2.7 HUD y tipografía

- **Fuente display**: Space Grotesk (ya hay una variable `--font-display` en
  `globals.css` esperando algo).
- **Fuente de números**: JetBrains Mono con `font-variant-numeric: tabular-nums`.
  Sin cifras tabulares, un valor que cambia en tiempo real *baila* y marea.
- **Paneles**: mantener el vidrio oscuro actual, pero agregar borde superior de
  1 px en el color de acento y una sombra proyectada suave. En visor, subir el
  tamaño base a **18 px** y el contraste: los lentes de un Cardboard comen
  contraste.
- **Zona segura en visor**: nada crítico en el 15% exterior de la pantalla — en
  un visor, los bordes quedan fuera del campo visual cómodo.

---

## 3. Catálogo de experimentos (los "juegos")

Cada experimento tiene: **concepto** (qué enseña), **mecánica** (qué hace el
jugador y cómo gana), **variables** (los sliders del `VariablesSchema`), y
**assets** propios.

Todos implementan `ExperimentDefinition` — el shell no cambia.

### 3.1 Física

**F1 · Tiro parabólico → "Artillería"** *(existe; agregarle el juego)*
- **Concepto**: descomposición vectorial, alcance máximo a 45°, independencia de ejes.
- **Mecánica**: 3 blancos a distancias distintas, 3 disparos. Puntaje por cercanía
  al centro. Un viento lateral aleatorio en el nivel 3 obliga a razonar, no a
  memorizar un ángulo.
- **Variables**: `angle` (0–90°), `velocity` (1–50 m/s), `gravity` (Luna/Tierra/Marte), `wind`.
- **Assets**: cañón (GLB), blancos, sonido de disparo e impacto.

**F2 · Colisiones 1D → "Predice el resultado"** *(existe; agregarle el juego)*
- **Concepto**: conservación de momento y energía; elástico vs. inelástico.
- **Mecánica**: el jugador **primero predice** v1' y v2' con dos sliders, después
  suelta los carritos. Puntaje = 100 − error porcentual. Esto convierte un
  simulador pasivo en un examen activo.
- **Variables**: `mass1`, `mass2`, `v1`, `v2`, `restitution` (0–1).
- **Assets**: riel metálico, carritos, sonido de impacto (2 variantes: seco/elástico).

**F3 · Péndulo y energía → "Sincroniza los relojes"**
- **Concepto**: T = 2π√(L/g); la masa **no** afecta el periodo (contraintuitivo,
  gran momento de aprendizaje); intercambio energía cinética ↔ potencial.
- **Mecánica**: dos péndulos, uno fijo. Ajustar la longitud del segundo hasta que
  oscilen en fase. Barras de energía en vivo a los lados.
- **Variables**: `length` (0.2–3 m), `mass` (0.1–5 kg), `angle0`, `damping`.
- **Assets**: bastidor metálico, esfera pulida, sonido de tic.

> **Implementado** (`physics/experiments/pendulo/`). Se integra la ecuación
> completa (con sen θ) con RK4 y el período se MIDE entre cruces por cero:
> a 15° coincide con T₀(1 + θ₀²/16) a cuatro decimales y a 60° sale 7.3 %
> mayor que 2π√(L/g). Referencia fija de 0.7 m soltada a 15°. Retos:
> sincronizar (±1 % durante 3 períodos), mantener la sincronía con masas que
> difieran en 2 kg, y el doble de período (hace falta 4 × la longitud; con
> 2 × da √2). Cambiar longitud, gravedad o ángulo con el péndulo en
> movimiento lo vuelve a soltar desde el ángulo inicial (cambiar la
> longitud en vuelo inventaba energía); cambiar la masa no, porque el reto 2
> es justamente ese. Energía conservada con deriva < 10⁻⁶ sin rozamiento.

**F4 · Ondas y superposición → "El sintonizador"** *(puente hacia Redes)*
- **Concepto**: superposición, interferencia constructiva/destructiva, batido, y
  —clave— que **una señal compleja es una suma de senoidales**. Es el
  prerrequisito conceptual de Fourier y de todo el módulo de Redes.
- **Mecánica**: se muestra una onda objetivo. El jugador tiene 3 osciladores
  (amplitud, frecuencia, fase) y debe sumarlos hasta reproducirla. Un medidor de
  "ajuste %" da retroalimentación continua.
- **Variables**: `a1,f1,p1`, `a2,f2,p2`, `a3,f3,p3`.
- **Assets**: ninguno (geometría procedural) + audio: reproducir la suma con la
  Web Audio API. Escuchar el batido es didáctico y cuesta ~20 líneas.

> **Implementado** (`physics/experiments/ondas/`). Cuatro objetivos: una sola
> onda, batido (4 y 5 Hz), cuadrada (armónicos 1, 3, 5 con amplitudes ∝ 1/n)
> y sierra (1, 2, 3 con el segundo en contrafase). Ajuste = 1 − error RMS
> relativo al objetivo; meta 95 % sostenida 1 s. Calibrado para que lo
> incompleto no pase: la cuadrada con 2 de 3 armónicos da 81 %, con un
> armónico en contrafase 38 %, el batido corrido 0.1 Hz 50 %. El audio
> multiplica las frecuencias por 110 Hz (mantiene las proporciones entre
> armónicos) y el paso de frecuencia es 0.05 para poder oír batidos lentos.

### 3.2 Cálculo

Nota de diseño: en cálculo la tentación es dibujar una gráfica 2D flotando en 3D.
Eso desperdicia el medio. La regla aquí es **el jugador está parado dentro del
espacio de la función**.

**C1 · Derivada → "Frena en el pico"**
- **Concepto**: la derivada como pendiente instantánea; f'(x)=0 en máximos y mínimos.
- **Mecánica**: el jugador se desplaza sobre una pista curva 3D (la gráfica de
  f(x)) mientras una recta tangente gira con él y un velocímetro muestra f'(x).
  Objetivo: frenar exactamente donde f'(x)=0, sin ver la gráfica desde afuera.
  Se *siente* la pendiente porque la cámara sube y baja.
- **Variables**: `funcion` (select: polinómica / sen / exp), coeficientes `a`, `b`, `c`.
- **Assets**: material de pista, cartel de meta.

**C2 · Integral de Riemann → "Menos bloques, más precisión"**
- **Concepto**: la integral como límite de una suma; convergencia; error.
- **Mecánica**: bloques 3D llenando el volumen bajo la curva. El slider `n` los
  hace más finos. Meta: llegar a < 1% de error usando la **menor** cantidad de
  bloques posible. Comparar suma izquierda / derecha / trapecio muestra por qué
  el trapecio converge más rápido.
- **Variables**: `n` (1–200), `metodo` (izq/der/trapecio/Simpson), `a`, `b`.
- **Assets**: ninguno (procedural) — pero es *el* experimento donde el bloom en
  bloques translúcidos se luce.

**C3 · Sólidos de revolución → "Tornea la pieza"**
- **Concepto**: V = π∫f(x)²dx, método de discos y de capas.
- **Mecánica**: el jugador edita el perfil f(x) con puntos de control, la curva
  gira alrededor del eje y genera el sólido en tiempo real. Objetivo: igualar la
  silueta de una pieza objetivo con el mínimo error de volumen. **Este es el
  experimento que más justifica el 3D de todo el proyecto** — en papel es
  incomprensible, aquí se camina alrededor del sólido.
- **Variables**: 4–5 puntos de control del perfil, `metodo` (discos/capas), `eje`.
- **Assets**: ninguno (`LatheGeometry` procedural) + ambiente de taller.

**C4 · Series de Taylor → "¿Cuántos términos?"**
- **Concepto**: aproximación polinómica local, radio de convergencia.
- **Mecánica**: la curva real y la aproximación se dibujan juntas; cada término
  que se agrega hace que la aproximación "abrace" más la curva. Un rango de
  tolerancia sombreado muestra dónde ya es válida. Meta: cubrir un intervalo dado
  con el mínimo de términos.
- **Variables**: `funcion`, `terminos` (1–12), `centro` (a), `rango`.
- **Assets**: ninguno.

> **Implementado** (`calculus/experiments/taylor/`). Cambios respecto de lo
> planeado: `grado` (0–12) en vez de "términos", porque en el seno la mitad de
> los coeficientes valen cero y "términos" era ambiguo; la tolerancia es fija
> (0.05) en vez de una variable `rango`. Cuatro funciones elegidas por lo que
> enseñan: sen(x) y eˣ convergen en toda la recta; ln(1+x) y 1/(1−x) tienen
> radio finito y, **centradas en cero, no pueden cubrir su objetivo con ningún
> grado** — hay que mover el centro. El grado mínimo de cada reto se calcula
> buscando sobre la misma grilla de centros del slider: sen 7 (en 0 hace
> falta 9), eˣ 6 (en 0, 9), ln(1+x) 3, 1/(1−x) 4. La escena muestra la curva y
> el polinomio como tubos, una franja en el piso que se pone verde donde el
> error ya es menor que la tolerancia, y la barra del radio de convergencia.

### 3.3 Redes y Telecomunicaciones

Es tu carrera — este módulo debería ser el más fuerte y el que se muestre primero
en la defensa.

**R1 · Modulación AM/FM → "Sintoniza la emisora"**
- **Concepto**: portadora, moduladora, índice de modulación, ancho de banda.
- **Mecánica**: tres ondas en 3D apiladas (moduladora, portadora, modulada). El
  jugador ajusta la frecuencia del receptor hasta captar la emisora — cuando
  sintoniza, **el audio real se aclara** (Web Audio API); fuera de sintonía,
  estática. Es el mismo bucle de una radio de verdad.
- **Variables**: `fc` (portadora), `fm` (moduladora), `m` (índice), `tipo` (AM/FM), `f_receptor`.
- **Assets**: radio receptor (GLB), clip de audio de voz, ruido blanco.

> **Implementado** como "Sintoniza la emisora" (`networks/experiments/modulacion/`).
> Diferencias con lo planeado: el jugador maneja a la vez la emisora propia
> (tipo, índice m/β, tono) y el receptor (dial + **ajuste fino**: sin él, en
> AM cada píxel del slider eran ~6 kHz con canales de 10 kHz y sintonizar era
> imposible). No hay radio GLB: es una radio modelada con primitivas. El audio
> se genera con Web Audio (tono + estática filtrada, saturación al
> sobremodular, y baja al 20 % mientras habla el tutor), sin clips externos.
> La escena pone lado a lado el tiempo (tres ondas) y la frecuencia (espectro
> propio con Bessel y regla de Carson), y el dial con el filtro del receptor.
> Retos: sintonizar Radio UMG (AM, 1040 kHz), modular entre 0.9 y 1 sin
> sobremodular, sintonizar UMG FM (95.3 MHz).

**R2 · Constelación QAM → "Recupera el mensaje"**
- **Concepto**: I/Q, modulación digital (BPSK/QPSK/16-QAM/64-QAM), SNR, BER, y el
  compromiso central de las comunicaciones digitales: más bits por símbolo ⇒
  menos tolerancia al ruido.
- **Mecánica**: el diagrama de constelación como nube de puntos 3D flotante. El
  jugador sube el SNR y ve la nube contraerse en puntos limpios; lo baja y los
  puntos se mezclan. Se transmite un texto real y se muestra el texto recibido
  degradándose carácter por carácter. Meta: transmitir el mensaje sin errores con
  la **mínima** potencia. Contador de BER en vivo.
- **Variables**: `esquema` (BPSK/QPSK/16-QAM/64-QAM), `snr` (0–30 dB), `potencia`, `simbolos`.
- **Assets**: ninguno (nube de puntos procedural) — el bloom aquí es esencial.

**R3 · Propagación y cobertura → "Cubre el campus"**
- **Concepto**: pérdida de espacio libre (FSPL = 20·log d + 20·log f + 32.44),
  sombra por obstáculos, presupuesto de enlace, reutilización de frecuencias.
- **Mecánica**: un plano 3D del campus con edificios. El jugador coloca antenas
  (presupuesto limitado), elige potencia y frecuencia, y ve un **mapa de calor de
  cobertura** actualizarse. Meta: cubrir todos los puntos marcados sin exceder el
  presupuesto ni provocar interferencia entre celdas del mismo canal.
- **Variables**: por antena — `potencia` (dBm), `frecuencia` (900 MHz / 2.4 / 5 GHz), `altura`, `tipo` (omni/sectorial).
- **Assets**: edificios low-poly, torre de antena, antena sectorial, terreno.

> **Implementado** (`networks/experiments/cobertura/`). Cambios respecto de lo
> planeado: sin modelos GLB (edificios, postes y antenas con primitivas);
> las antenas van en 7 postes candidatos y no en cualquier punto (en el
> visor no hay cómo apuntar un lugar del piso con precisión), con banda y
> potencia comunes y canal por antena (1, 6, 11). El modelo es
> log-distancia (FSPL a 1 m + 10·n·log d, n = 2.4) más pérdida por edificio
> atravesado (8/12/18 dB según banda), sensibilidad −78 dBm y SIR ≥ 6 dB.
> **Calibrado con búsqueda exhaustiva**: con espacio libre puro (n = 2) una
> antena de 900 MHz cubría todo a la mínima potencia; con n = 2.4, 900 MHz
> se resuelve con 1 antena (18 dBm), 2.4 GHz necesita 2 (26 dBm) y 5 GHz no
> alcanza con 3. Retos: cubrir los 12 puntos, hacerlo en 2.4 GHz, y con 3
> antenas y solo 2 canales (reutilización de frecuencias). Todas en el
> mismo canal es siempre imposible por interferencia.

**R4 · Enrutamiento → "Gánale a Dijkstra"**
- **Concepto**: grafos, costo de enlace, vector-distancia vs. estado de enlace,
  convergencia tras una caída de enlace.
- **Mecánica**: el jugador está **dentro** de la red — nodos como racks flotantes
  unidos por haces de luz cuyo grosor es el ancho de banda. Elige el siguiente
  salto para llevar un paquete al destino, contrarreloj. Al final se compara su
  ruta contra la óptima de Dijkstra. Nivel avanzado: se cae un enlace a mitad de
  camino y hay que re-enrutar.
- **Variables**: `topologia` (select), `metrica` (saltos / ancho de banda / latencia), `nodo_caido`.
- **Assets**: rack de servidores, switch, router (GLB), paquete (cubo emisivo).

**R5 · Encapsulación OSI/TCP-IP → "Arma la trama"**
- **Concepto**: las 7 capas, encapsulación y desencapsulación, qué cabecera agrega
  cada capa, MTU y fragmentación.
- **Mecánica**: cajas literalmente anidadas. Los datos bajan por un tubo vertical
  de 7 pisos y en cada piso se les monta una cabecera; del otro lado suben y se
  van desarmando. El jugador arrastra cada cabecera a su capa correcta,
  contrarreloj. Se ven los bytes reales de cada cabecera.
- **Variables**: `protocolo` (TCP/UDP), `mtu`, `tamano_payload`.
- **Assets**: ninguno (cajas + texto) — sonido de "encaje" al acertar.

**R6 · Espectro en vivo (FFT del micrófono) → "Tu voz en el dominio de la frecuencia"** *(bonus de alto impacto)*
- **Concepto**: dominio del tiempo vs. dominio de la frecuencia, Fourier, el ancho
  de banda de la voz humana (~300–3400 Hz) y por qué la telefonía usa justamente
  ese rango.
- **Mecánica**: el usuario habla y ve su propia voz como un espectro 3D que se
  desplaza en el tiempo (cascada / waterfall). Retos: dar con un tono puro,
  silbar para ver un solo pico, decir una vocal para ver los formantes.
- **Assets**: ninguno.

> **Implementado** como "Tu voz en el espectro" (`networks/experiments/espectro/`).
> Cascada 3D de 96 columnas × 64 instantes (~3 s), escala logarítmica o lineal,
> banda telefónica marcada. Los tres retos se miden sobre el espectro:
> - **Silba**: un solo pico agudo (>45 % de la energía en ±2 bins, entre 500 y
>   4500 Hz) sostenido 1 s. Un pico grave NO cuenta: una "u" sostenida también
>   concentra casi toda su energía en un armónico.
> - **De "u" a "i"**: la energía de 1800–3200 Hz relativa a la de 200–1000 Hz
>   tiene que subir 8 dB respecto de la "u" del mismo jugador. Relativo a
>   propósito: no depende del micrófono ni de la voz.
> - **Habla 3 s**: mide qué porcentaje de la energía de la voz cae en 300–3400 Hz.
>
> Decisiones: el micrófono se pide con `echoCancellation`, `noiseSuppression`
> y `autoGainControl` apagados (la supresión de ruido borra los silbidos); el
> analizador no se conecta a los parlantes (evita el acople); "sonando" =
> 12 dB sobre el ruido de fondo estimado, o más de −40 dBFS en absoluto.
> La lógica se verificó con espectros sintéticos (silencio, silbido, "u", "i",
> voz, ruido constante). **Pendiente**: calibrar umbrales con voces reales en
> el celular objetivo.

### 3.3b Electromagnetismo y Electrónica (Fase G, 2026-10-08) ✅

Los cuatro están hechos, con su motor probado en Node, escena, retos,
pistas del tutor, acciones para la vista VR y puerta en el lobby (el área
Electrónica tiene color violeta). El recorrido guiado suma una parada por
cada módulo nuevo (nueve en total).

Pedido del equipo: más física del curso (electromagnetismo) y electrónica de
la carrera. Cuatro experimentos nuevos, en este orden:

**E1 · Electroimán → "La grúa electromagnética"** *(Física · Electromagnetismo)*
- **Concepto**: campo de un solenoide B = μ₀·μr·N·I/L (Ampère), el núcleo
  ferromagnético, fuerza de atracción ∝ B² que cae rápido con la distancia,
  calor en la bobina P = I²R. Solo los ferromagnéticos se atraen.
- **Mecánica**: una grúa con un electroimán sobre un patio de chatarra (lata
  de acero, bloque de hierro, olla de aluminio, tubo de cobre, motor, carro).
  Se levanta si la fuerza magnética supera m·g; cortar la corriente suelta.
- **Variables**: corriente, vueltas, núcleo (aire, hierro dulce, acero),
  altura sobre el objeto.
- **Retos**: levanta la lata; separa la chatarra (solo lo magnético al
  contenedor); levanta el carro sin recalentar la bobina.

Slugs ya cargados en Supabase (`supabase/migrations/20261008130000_electronica.sql`,
con nombre y descripción): área `electronics`, módulos `electronica-circuitos`
y `electronica-digital`, experimentos `protoboard`, `fuente-poder` y
`compuertas`. Al construirlos hay que usar exactamente esos slugs y textos.

**C1 · Ohm y Kirchhoff → "Arma el circuito"** *(Electrónica · Circuitos)*
- Protoboard con batería de 9 V, resistencias comerciales con código de
  colores, LED y multímetro. Retos: enciende el LED sin quemarlo (10–20 mA);
  saca 3.3 V de 9 V con un divisor; comprueba Kirchhoff en paralelo.

**C2 · Fuente de poder → "La fuente de poder"** *(Electrónica · Circuitos)*
- 120 V AC → transformador → rectificador → capacitor → 5 V, con osciloscopio
  por etapa. Retos: 5 V para un cargador USB; rizado menor al 5 %; el mismo
  rizado con la mitad de capacitor usando el puente de diodos.

**C3 · Compuertas lógicas → "Arma la lógica"** *(Electrónica · Electrónica digital)*
- Entrenador digital: interruptores A, B, C, zócalos con chips reales
  (7408, 7432, 7404), cables que se encienden con un 1, LED de salida y tabla
  de verdad. Se elige la compuerta de cada zócalo y se prueba la tabla
  completa. Niveles: la alarma (A·B), el portón ((A+B)·C̄), los tres jueces
  (AB+AC+BC). Reto extra: el nivel 3 sin un intento fallido.

### 3.4 Capa de juego compartida (transversal)

En vez de programar puntaje dentro de cada experimento, se extiende el contrato
en `types/module.ts` con un objetivo opcional:

```ts
export interface ExperimentChallenge {
  id: string;
  prompt: string;                       // "Acierta a los 3 blancos"
  evaluate: (state: AIContext) => {
    solved: boolean;
    score: number;                      // 0–100
    feedback: string;                   // lo lee el tutor por voz
  };
}
```

Y `ExperimentDefinition` gana `challenges?: ExperimentChallenge[]`. El shell
dibuja el objetivo, el puntaje y el resultado — **ningún experimento necesita
saber cómo se ve un HUD de puntaje**. Es el mismo principio que ya usas con
`VariablesSchema`.

Los resultados se guardan en Supabase (sección 6), para que el proyecto tenga una
historia de "seguimiento del aprendizaje", no solo demos sueltos.

---

## 4. Tutor por voz

Requisito: en un visor 360 el usuario **no tiene manos ni teclado**. La
interacción tiene que ser: hablar → escuchar. Todo el diseño sale de ahí.

### 4.1 Arquitectura

```
  ┌──────────── CLIENTE (navegador del celular) ─────────────┐
  │                                                           │
  │  Gatillo (botón R2 del gamepad, o "profe" como palabra     │
  │  de activación)                                            │
  │              │                                            │
  │              ▼                                            │
  │  [1] STT — Web Speech API (SpeechRecognition, es-GT)       │
  │              │  transcripción                             │
  │              ▼                                            │
  │  [2] engine.getState() → AIContext                         │
  │      (variables actuales, resultado, conceptTags)          │
  │              │                                            │
  └──────────────┼────────────────────────────────────────────┘
                 │  POST /api/tutor  { transcript, context, history }
  ┌──────────────▼───────── SERVIDOR (Next.js Route Handler) ──┐
  │  [3] @google/genai → ai.models.generateContentStream()      │
  │      model: gemini-3.5-flash-lite, thinking: LOW            │
  │      La API key NUNCA sale del servidor.                    │
  └──────────────┼─────────────────────────────────────────────┘
                 │  stream de texto
  ┌──────────────▼───────── CLIENTE ───────────────────────────┐
  │  [4] Buffer por oración: en cuanto llega un ". " completo,  │
  │      se manda a TTS. No se espera la respuesta entera.      │
  │              ▼                                             │
  │  [5] TTS — SpeechSynthesis (voz es-*), cola de oraciones    │
  │              ▼                                             │
  │  [6] Subtítulo flotante en 3D + anillo de estado            │
  └────────────────────────────────────────────────────────────┘
```

### 4.2 Por qué Web Speech API en la fase 1

| | Web Speech API | STT/TTS en servidor (Whisper + TTS comercial) |
|---|---|---|
| Costo | $0 | ~$0.01–0.05 por intercambio |
| Latencia | Muy baja | +600–1500 ms de subida y proceso |
| Calidad de voz es-GT | Aceptable (voces del sistema Android) | Notablemente mejor |
| Soporte | Chrome/Android: sí. iOS Safari: parcial e inestable | Universal |
| Complejidad | ~80 líneas | Streaming de audio, colas, manejo de errores |

**Decisión: empezar con Web Speech API.** El dispositivo objetivo es Android +
Chrome, donde funciona bien y sale gratis. Se encapsula todo detrás de dos hooks
(`useSpeechInput`, `useSpeechOutput`) para que, si la calidad de voz no alcanza
en la defensa, se cambie la implementación **sin tocar nada más**.

> **Advertencia para documentar en la tesis**: `SpeechRecognition` en Chrome de
> escritorio envía el audio a servidores de Google para transcribirlo; en Android
> es en el dispositivo. Vale la pena mencionarlo en la sección de privacidad.

### 4.3 El endpoint del tutor

**Proveedor: Google Gemini** (decisión del equipo: todo el proyecto usa
Gemini). Implementado en `app/api/tutor/route.ts` — Route Handler de Next.js,
**runtime Node.js**, con el SDK oficial `@google/genai`. El system prompt
completo está en ese archivo.

Cómo funciona y por qué:

- **Modelos con respaldo.** Primero `gemini-3.5-flash-lite`; si Google
  responde 503/429 (saturado o sin cuota) antes del primer token, se
  reintenta con `gemini-2.5-flash`. Medido con la key del proyecto el
  2026-10-06: Flash-Lite 3.5 da el primer token en **~0.6–0.9 s**; los Flash
  más grandes (3.5, 3.8, `gemini-flash-latest`) devolvían 503 "high demand" o
  tardaban 20–30 s, inservibles para voz. Se fijan versiones concretas, no
  alias `-latest`, para que el tutor no cambie solo antes de la defensa.
- **Pensamiento bajo** (`thinkingLevel: LOW` en 3.x — Flash-Lite no acepta
  `MINIMAL` —; `thinkingBudget: 0` en 2.5). Es conversación, no análisis.
- **Streaming** — indispensable. Sin él, el usuario espera en silencio la
  respuesta completa. Con él, el TTS arranca al cerrarse la primera oración.
- **Se espera el primer pedazo antes de responder** — así una key inválida
  o un modelo saturado devuelven un status de error de verdad (y permiten
  probar el modelo de respaldo), en vez de un 200 con el stream cortado.
- **`AIContext` va en el mensaje del usuario, no en el system** — el system
  prompt queda byte a byte idéntico y Gemini puede aprovechar su caché
  implícito. Las `tutorHints` del experimento se anexan al system (son
  fijas por experimento).
- **Historial append-only, solo texto**, que guarda el cliente; el
  servidor lo valida y lo recorta a los últimos 20 turnos.
- **`maxOutputTokens: 1024`** — el prompt ya limita a 3 oraciones; esto es
  el techo duro.
- **Validación y límites de tamaño** — el endpoint es público.
- La API key va en `.env` / `.env.local` como `GEMINI_API_KEY` y **nunca**
  con prefijo `NEXT_PUBLIC_` — eso la expondría en el bundle del cliente.

**Límite por IP** (`lib/tutor/rate-limit.ts`): 12 preguntas por minuto por
IP; al pasarse responde 429 con `Retry-After` y el tutor dice "Me hiciste
muchas preguntas seguidas". Vive en la memoria del proceso: alcanza para un
servidor único (`next start`); en serverless con varias instancias haría
falta un almacén compartido (p. ej. Supabase).

### 4.4 Detalles de interacción que deciden si se siente bien o mal

1. **Push-to-talk, no escucha continua.** Un gatillo del gamepad
   (`pad.buttons[7]` = R2 en el layout estándar; `useVirtualCursor.ts` ya lee
   `pad.buttons[0]`, así que la infraestructura está). Mantener apretado =
   grabando. Es infinitamente más confiable que una palabra de activación en un
   salón ruidoso, y no gasta batería escuchando.
   - *Alternativa sin control*: `SpeechRecognition` en modo continuo filtrando por
     la palabra "profe" al inicio. Implementarlo como respaldo, no como
     mecanismo principal.
2. **Barge-in.** Si el usuario aprieta el gatillo mientras el tutor habla, se corta
   el TTS (`speechSynthesis.cancel()`) de inmediato. Sin esto, una respuesta larga
   se vuelve una cárcel.
3. **Estados visibles siempre.** Un anillo de color en el HUD: gris = inactivo,
   azul pulsante = escuchando, ámbar = pensando, teal = hablando. En un visor, sin
   retroalimentación visual el usuario no sabe si el sistema lo oyó.
4. **Subtítulos.** Mostrar lo que el sistema entendió y lo que responde. Sirve para
   accesibilidad, para salones ruidosos, y para que el jurado siga la conversación.
5. **Ducking.** Bajar el audio del experimento (R1, F4) al 20% mientras el tutor
   habla.
6. **Cambio de experimento = memoria nueva.** Al salir de un experimento se
   reinicia el `history`. El tutor no debería arrastrar el tiro parabólico a una
   conversación sobre QAM.
7. **Modo sin conexión.** Si `/api/tutor` falla, hablar por TTS un mensaje
   preescrito ("No me puedo conectar en este momento") en vez de quedarse mudo. En una
   defensa, un fallo de red no puede ser un fallo silencioso.

### 4.5 Estructura de archivos del tutor

```
app/api/tutor/route.ts                  ← endpoint (arriba)
components/tutor/VoiceTutor.tsx         ← orquestador; se monta en ExperimentShell
components/tutor/TutorHUD.tsx           ← anillo de estado + subtítulos
components/tutor/useSpeechInput.ts      ← STT; expone { start, stop, transcript, listening }
components/tutor/useSpeechOutput.ts     ← TTS con cola por oración; { speak, cancel, speaking }
components/tutor/useTutorSession.ts     ← historial, fetch en streaming, buffer de oraciones
lib/tutor/sentence-buffer.ts            ← corta el stream en oraciones para el TTS
```

`VoiceTutor` recibe `engine` y llama a `engine.getState()` en cada pregunta.
**Cero cambios en los experimentos** — el `AIContext` que ya definiste en
`types/module.ts` es exactamente el contrato que hacía falta. Ese diseño ya estaba
bien pensado; solo faltaba consumirlo.

---

## 5. Assets a descargar

Convención de carpetas ya establecida en el proyecto:
`public/textures/<nombre>/<slug>_diff.jpg`, `_nor_gl.jpg`, `_rough.jpg` — así lo
espera `useTiledPbrTexture.ts`. **No cambiar los sufijos.**

### 5.1 Texturas PBR — [polyhaven.com/textures](https://polyhaven.com/textures) (CC0)

Descargar en **JPG 2K** (no 4K: en celular se ve igual y triplica la carga). De
cada textura hacen falta exactamente 3 archivos: **Diffuse**, **Normal GL**,
**Roughness**.

| # | Buscar en Poly Haven | Guardar en | Uso |
|---|---|---|---|
| 1 | `concrete floor` o `tiles` (piso técnico claro) | `public/textures/lab-floor/` | Piso del lobby (reemplaza el mármol) |
| 2 | `painted plaster` o `white plaster` | `public/textures/lab-wall/` | Paredes claras del lobby |
| 3 | `ceiling` o `acoustic panel` | `public/textures/lab-ceiling/` | Techo (mata el plano negro actual) |
| 4 | `brushed metal` o `metal plate` | `public/textures/metal/` | Cañón, riel, estructuras |
| 5 | `wood table` o `plywood` | `public/textures/wood/` | Mesas de trabajo |
| 6 | `asphalt` o `concrete pavement` | `public/textures/pavement/` | Escenario exterior de antenas (R3) |
| 7 | `rubber` o `plastic` | `public/textures/plastic/` | Carritos, proyectil |

Ya están y se conservan: `floor/marble_01`, `wall/grey_plaster`, `grass/leafy_grass`.

### 5.2 HDRIs — [polyhaven.com/hdris](https://polyhaven.com/hdris) (CC0)

Descargar en **2K HDR**. En celular, 4K de HDRI es desperdicio puro.

| Buscar | Guardar en | Uso |
|---|---|---|
| Categoría `Indoor` → un estudio o interior luminoso | `public/textures/sky/` | Iluminación del lobby (hoy no tiene HDRI) |
| Categoría `Skies` → un día despejado de mediodía | `public/textures/sky/` | Escenario de antenas (R3); más legible que el atardecer |

Ya está y se conserva: `qwantani_dusk_2_puresky.hdr` (queda bien para F1/F2).

### 5.3 Modelos 3D (.glb)

Fuentes recomendadas, todas de uso libre:
- **[Quaternius](https://quaternius.com/)** — CC0, low-poly. **La mejor opción para este proyecto** (pesos ideales para celular).
- **[Kenney](https://kenney.nl/assets)** — CC0, low-poly, packs enormes de props y UI.
- **[Poly Haven Models](https://polyhaven.com/models)** — CC0, calidad alta, catálogo chico.
- **[Sketchfab](https://sketchfab.com/)** — filtrar por licencia **CC0** o **CC-BY** (si es CC-BY, hay que dar crédito en la tesis).

| # | Modelo | Buscar como | Guardar en | Usado por |
|---|---|---|---|---|
| 1 | Mesa de laboratorio | "lab table", "workbench" | `public/models/lab-table.glb` | Lobby, todos |
| 2 | Taburete / banco | "stool", "lab chair" | `public/models/stool.glb` | Lobby |
| 3 | Pizarra / panel informativo | "whiteboard", "sign" | `public/models/board.glb` | Lobby |
| 4 | Cañón / lanzador | "cannon", "catapult", "launcher" | `public/models/cannon.glb` | F1 |
| 5 | Diana / blanco | "target", "bullseye" | `public/models/target.glb` | F1 |
| 6 | Bastidor de péndulo | "frame", "stand", "gantry" | `public/models/pendulum-rig.glb` | F3 |
| 7 | Radio receptor | "vintage radio", "receiver" | `public/models/radio.glb` | R1 |
| 8 | Rack de servidores | "server rack" | `public/models/server-rack.glb` | R4 |
| 9 | Router / switch | "network switch", "router" | `public/models/router.glb` | R4 |
| 10 | Torre de antena | "antenna tower", "cell tower", "radio mast" | `public/models/antenna-tower.glb` | R3 |
| 11 | Antena sectorial / parabólica | "sector antenna", "satellite dish" | `public/models/antenna-sector.glb` | R3 |
| 12 | Edificios low-poly (pack) | "low poly buildings" (Quaternius / Kenney) | `public/models/buildings/` | R3 |
| ✔ | Árboles de fondo | *ya incorporado* (`22-trees_9_obj`) | `public/models/trees.glb` | Todos los exteriores |
| 13 | Osciloscopio | "oscilloscope", "measuring device" | `public/models/oscilloscope.glb` | R1, F4 |

**Antes de subir cualquier `.glb` al repo, comprímelo.** Si viene en `.obj`,
el flujo completo está en [`scripts/README.md`](scripts/README.md):
`obj2glb.py` → `gltf-transform simplify` → `gltf-transform meshopt`. El pack
de árboles pasó de 33 MB a 1.46 MB así.
Comprime texturas y colapsa mallas; suele bajar el peso 60–80%. En celular eso es
la diferencia entre cargar en 2 s o en 15 s.

**Presupuesto por modelo**: ≤ 15k triángulos, ≤ 2 MB, texturas ≤ 1024 px. Si un
modelo de Sketchfab pesa 40 MB, no sirve — busca el equivalente low-poly.

### 5.4 Audio

| Fuente | Qué buscar | Guardar en |
|---|---|---|
| [Kenney Audio](https://kenney.nl/assets?q=audio) (CC0) | clicks de UI, "correcto" / "incorrecto", impactos | `public/audio/ui/` |
| [freesound.org](https://freesound.org/) (filtrar por **CC0**) | disparo de cañón, impacto metálico, tic de péndulo, ambiente de laboratorio (hum), estática de radio | `public/audio/sfx/` |

Formato: **.ogg** o **.mp3**, mono, 44.1 kHz, ≤ 200 KB por efecto.

### 5.5 Tipografías — [fonts.google.com](https://fonts.google.com)

No hace falta descargarlas: se cargan con `next/font/google` en `app/layout.tsx`.

- **Space Grotesk** → variable `--font-display` (títulos, HUD)
- **JetBrains Mono** → variable `--font-mono` (valores numéricos, con `tabular-nums`)

### 5.6 Lo que NO hace falta descargar

Todo esto se genera por código y no ocupa nada:
- Curvas, superficies y sólidos de revolución (C1–C4)
- Constelaciones y nubes de puntos (R2)
- Ondas y espectros (F4, R1, R6)
- Mapas de calor de cobertura (R3)
- Grafos de red y haces de conexión (R4)
- Cajas de encapsulación (R5)

---

## 6. Roadmap por fases

Cada fase termina en algo demostrable. Nada de fases que solo "preparan".

### Fase A — Levantar el nivel visual *(la base de todo lo demás)*
1. `components/shell/LabLighting.tsx` con el esquema de §2.2; usarlo en ambos shells.
2. Activar sombras de verdad: `castShadow` en la key light, `receiveShadow` en piso
   y paredes, frustum de sombra ceñido.
3. Subir `environmentIntensity` a 0.6–1.0 en `LabBackground.tsx`; agregar HDRI
   interior al lobby.
4. Rediseñar `LobbyScene.tsx`: zócalo, cornisa, pilastras, techo con paneles y
   tiras emisivas, nichos por puerta, franjas de guía en el piso.
5. Instalar `@react-three/postprocessing`; bloom selectivo + vignette, con
   interruptor de calidad.
6. Materiales PBR reales en los experimentos existentes (§2.4).
7. Cargar Space Grotesk + JetBrains Mono; subir tamaño y contraste del HUD.
8. `<ContactShadows>` bajo cada prop.

**Entregable:** el lobby y los dos experimentos actuales, mismo contenido, vistos
como producto y no como prototipo. Comparativa antes/después para la tesis.

### Fase B — Tutor por voz *(implementada; falta validar en el dispositivo)*
1. ✅ `useSpeechInput` / `useSpeechOutput` + `lib/tutor/sentence-buffer.ts`.
2. ✅ `app/api/tutor/route.ts` con streaming (§4.3).
3. ✅ `VoiceTutor` + `TutorHUD`; montado en `ExperimentShell`.
4. ✅ Push-to-talk en R2, barge-in, subtítulos, modo sin conexión.
   Ducking queda para cuando haya experimentos con audio (R1, F4).
5. ⏳ Probar en el celular objetivo dentro del visor. Medir el tiempo hasta el
   primer audio (meta: < 1.2 s).
6. ✅ `tutorHints` en los 9 experimentos y límite de preguntas por IP.
7. ⏳ Opcional: subtítulos en 3D para el modo visor (hoy son un overlay HTML).

**Entregable:** en el tiro parabólico se puede preguntar "¿por qué a cuarenta y
cinco grados llega más lejos?" y recibir respuesta hablada, usando los valores
actuales de los sliders.

### Fase C — Capa de juego + persistencia ✅
1. ✅ HUD de retos en el shell (`components/shell/ChallengeHUD.tsx`).
   Cambio respecto de lo planeado: en vez de `ExperimentChallenge` con un
   `evaluate(AIContext)` sin estado, el **motor** expone `getChallenges()` y
   `resetChallenges()` (`ChallengeStatus` en `types/module.ts`). Casi todos
   los retos tienen estado que no se deduce de una foto del contexto
   (sostener algo un segundo, recordar el mejor intento, en qué modelos ya se
   logró). `resetChallenges()` es aparte de `reset()`, que en varios
   experimentos significa "intentar de nuevo" y no debe borrar logros.
   El HUD vive en un "dock" abajo a la derecha, apilado sobre los controles
   del experimento; se pliega a "Retos 2/3" y avisa con un sonido corto
   cuando se completa uno. Venturi, que no estaba en el catálogo de juegos,
   recibió los suyos al final: 9 veces más rápido (continuidad, el cuello a
   un tercio del radio), presión del cuello bajo 30 kPa sin cavitar
   (Bernoulli) y flujo laminar (Reynolds; con agua es imposible en el rango
   de los sliders, hay que cambiar de fluido). Los tres piden sostener la
   condición 1 s. Retos en 13 experimentos (los 6 nuevos ya los
   tenían; se agregaron a derivada, Riemann, sólidos, QAM, enrutamiento y
   OSI). Arreglo de paso: el canvas tiene su propio contexto de
   apilamiento, así las etiquetas `<Html>` de drei ya no tapan los paneles.
2. ✅ Juegos y retos de F1 y F2.
   - **F1 · Artillería**: variable `modo` (libre / blancos / con viento).
     Tres blancos a 20, 32 y 45 m, un disparo por blanco, 100 − 8 pts por
     metro de error. Con viento, una aceleración horizontal al azar por ronda
     (±0.6–1.8 m/s²) que corre la caída unos 3.6 m: probado que repetir los
     tiros sin viento da 157/300 y corrigiendo se llega a 300. Retos: un
     impacto, ronda ≥ 220 sin viento, ronda ≥ 180 con viento.
   - **F2 · Predice el resultado**: `pred_v1` y `pred_v2` se congelan al
     soltar; puntaje = 100 − error total relativo a la rapidez inicial (no
     a cada velocidad final, que puede ser cero). Retos ≥ 90 pts: elástico,
     plástico, y a medias con masas distintas.
   - Arreglos de paso: el motor de colisiones usaba otro ancho de carrito
     que la escena (se encimaban con masas grandes); el shell acepta una
     cámara inicial por experimento (`cameraView`), porque los blancos a
     45 m quedaban fuera de vista; el panel de variables se scrollea en vez
     de tapar el header; colisiones centrado en la vista.
3. ✅ Persistencia, con registro **opcional**: sin cuenta, los retos se
   guardan en el dispositivo (`lib/progress/store.ts`, separados por dueño
   para celulares compartidos); al ingresar o registrarse, lo del invitado
   pasa a la cuenta y se sube a `challenge_completions` (insert con "on
   conflict do nothing": se conserva la primera fecha). Sin red, queda en
   cola y se sube al volver la conexión. Al cerrar sesión, lo de esa cuenta
   deja de verse en el dispositivo. En vez de la tabla `attempts` planeada se
   usa `challenge_completions`; `sessions`, `predictions` y
   `ai_conversations` siguen sin usarse (quedan protegidas con RLS).
4. ✅ `/progreso` (retos por experimento, con fecha) y `/cuenta` (ingresar,
   registrarse, cerrar sesión). Acceso desde el header del lobby.
5. ✅ El tutor comenta el reto logrado por voz. El HUD emite un evento
   (`lib/tutor/events.ts`) y el tutor dice "¡Reto logrado!" al instante con
   la voz del dispositivo; después Gemini agrega una o dos oraciones con los
   valores del experimento (va como un turno más: si el alumno pregunta
   "¿cómo lo hice?", el tutor tiene el contexto). No interrumpe: si el tutor
   está hablando o escuchando, o se está leyendo la explicación, queda solo
   el aviso visual. Sin red se calla en vez de decir "no me puedo conectar".
6. ✅ Vista docente (`/docente`), solo para cuentas con rol `teacher` o
   `admin`. Los datos los protege RLS (`is_staff()`); la página solo explica
   qué pasa si no hay sesión o permiso. Muestra: cantidad de estudiantes,
   retos logrados, promedio por estudiante y el reto que menos lograron;
   lista de estudiantes con buscador, totales por disciplina y detalle por
   experimento; qué porcentaje de la clase logró cada reto; y descarga en
   CSV (con BOM para que Excel lea los acentos). Las cuentas están en
   `lib/teacher/aggregate.ts` como funciones puras, probadas con datos
   inventados. Solo cuentan los perfiles `student` y los retos que siguen
   en el catálogo. Para dar el rol de docente (desde el SQL Editor):
   `update public.profiles set role = 'teacher' where id = '<uuid>';`

**Entregable:** un estudiante juega, obtiene puntaje, y el puntaje queda guardado.
Esto es lo que convierte el proyecto en un sistema educativo evaluable, no en una
demo suelta.

### Fase D — Módulo de Cálculo ✅
C2 (Riemann) ✅ → C1 (derivada) ✅ → C3 (sólidos de revolución) ✅ → C4 (Taylor) ✅.
Ese orden: C2 es el más simple y valida el patrón; C3 es el más impresionante y
conviene tenerlo listo con tiempo de sobra.

**Entregable:** puerta de Cálculo en el lobby con 4 experimentos.

### Fase E — Módulo de Redes *(el módulo estrella)*
R6 (espectro) ✅ → R2 (QAM) ✅ → R1 (modulación) ✅ →
R5 (OSI) ✅ → R4 (enrutamiento) ✅ → R3 (cobertura) ✅. Fase E cerrada.

**Entregable:** puerta de Redes con 5–6 experimentos.

### Fase F — Pulido y defensa
1. Perfilado en el dispositivo real; ajustar el interruptor de calidad.
2. Precarga de assets con pantalla de carga. Hoy el `Suspense fallback={null}`
   muestra una pantalla vacía mientras cargan las texturas — reemplazar por un
   indicador real de progreso.
3. ✅ Tutorial de entrada de 30 segundos, en el lobby (`LobbyTutorial`,
   `TutorialProbe`, `tutorialStore`). Cuatro pasos: mirar, caminar, hablar
   con el tutor y entrar por una puerta. Mirar y caminar avanzan cuando el
   alumno lo hace de verdad (se mide la cámara: giro acumulado de 60° y 2 m
   caminados, sin contar el primer segundo, que es el salto inicial del
   giroscopio). Los otros dos se leen y avanzan solos. El texto cambia según
   el aparato: visor, control, mouse o dedo. Con el visor puesto todo se
   hace con el control (A siguiente, B saltar); en la compu, Enter y Escape.
   Sale la primera vez en cada dispositivo y se reabre con "¿Cómo me muevo?".
4. ✅ Recorrido guiado (`lib/tour.ts`, `TourPanel`), pensado para mostrar el
   laboratorio en clase. Botón "Recorrido guiado" en el lobby; seis
   paradas, una por módulo (Tiro parabólico en modo artillería, Tubo de
   Venturi, Tornea la pieza, Tu voz en el espectro, Encuentra el camino y
   Arma el paquete) y al final la pantalla de progreso. En cada
   parada, una tarjeta corta que se lee en voz alta reemplaza a la
   explicación larga (sigue disponible con "Explicación completa"); al
   plegarla queda una pastilla arriba al centro con "Siguiente". El estado
   vive en la URL (`?recorrido=N`): se puede abrir una parada directo o
   recargar sin perderse. "Salir del recorrido" deja el experimento libre.
5. Documentación y créditos: ✅ `README.md` (puesta en marcha, variables,
   base de datos, prueba en el celular, cómo agregar un experimento),
   ✅ `CREDITOS.md` y ✅ `.env.example`. Falta: confirmar el origen y la
   licencia del cañón, la madera del cañón y el pack de árboles (marcados
   "por confirmar"), y grabar el video de demostración.

6. Vista VR, como la de YouTube en los videos 360: botón "Visor" en el
   encabezado que alterna entre la vista 360 (una imagen, se mira moviendo
   el celular) y la pantalla partida para el visor (una imagen por ojo).
   - ✅ Etapa 1: `StereoView` dibuja la escena dos veces con `StereoEffect`
     de three (ojos a 6.4 cm, campo visual de 75°), mira en el centro de la
     vista, pantalla completa en horizontal al entrar, "Salir del visor"
     en cada mitad. El post-proceso se apaga en esta vista. Todo el HTML
     (paneles, retos, etiquetas de drei) se oculta: se dibujaría una sola
     vez y cada ojo vería medio panel. El tutor sigue funcionando con R2.
   - ✅ Etapa 2: interfaz esencial en 3D (`components/vr/`). Se apunta con
     la mira y se activa con A, tocando la pantalla o con Enter
     (`lib/view/gaze.ts`: el rayo va solo contra los botones registrados).
     A la izquierda, las variables con − y + (y < > en las listas); a la
     derecha, los retos y las acciones de cada experimento (`vrActions` en
     la definición, que replica su panel HTML) y "Siguiente parada" en el
     recorrido; pegados a la vista, el aviso de reto y los subtítulos del
     tutor (`lib/tutor/hudStore.ts`). Los paneles acompañan al caminar y
     siguen la vista solo si se gira más de 55°. Las puertas del lobby
     también tienen su etiqueta en 3D. Texto con troika y una fuente local
     (Geist), para que funcione sin internet.
   - ⏳ Etapa 3: etiquetas de cada experimento como texto 3D.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El celular no aguanta y baja de 30 fps | Interruptor de calidad desde la Fase A; el diseño no depende del post-proceso. Perfilar en el dispositivo real desde el principio, no al final. |
| Las voces TTS en español del celular suenan robóticas | Los hooks aíslan la implementación; se cambia a un TTS de servidor sin tocar el resto. Probarlo temprano en el dispositivo objetivo. |
| No hay internet en la defensa | Modo sin conexión con respuestas preescritas + hotspot del celular como respaldo. Los experimentos funcionan sin red; solo el tutor la necesita. |
| Los assets de Sketchfab pesan demasiado | `gltf-transform` obligatorio; presupuesto duro de 2 MB por modelo. Preferir Quaternius/Kenney. |
| El alcance es grande para el tiempo disponible | El roadmap está ordenado por valor: cada fase entrega algo defendible por sí sola. Si el tiempo se acaba en la Fase D, hay un producto completo igual. |
| El giroscopio pide permiso en iOS y no en Android | Ya está resuelto en `useDeviceOrientation.ts`. Documentarlo en la tesis. |

---

## 8. Cambios al contrato de módulos

Únicos cambios previstos en `types/module.ts`. Todo lo demás del contrato actual
se conserva:

```ts
// NUEVO — retos opcionales por experimento (§3.4)
export interface ExperimentChallenge { /* ... */ }

export interface ExperimentDefinition {
  // ... todo lo actual, sin cambios ...
  challenges?: ExperimentChallenge[];

  // NUEVO — pistas para el tutor de voz, específicas de este experimento.
  // Se anexan al system prompt para que las respuestas usen el vocabulario
  // correcto de la disciplina.
  tutorHints?: string;

  // NUEVO — sugerencia de calidad. Un experimento pesado (R3) puede pedir
  // que se apague el post-proceso.
  performanceProfile?: "light" | "heavy";
}
```

La decisión de mantener el shell ignorante de las disciplinas fue correcta y **no
se toca**. Todo lo nuevo entra como campos opcionales.
