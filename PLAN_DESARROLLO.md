# ImmersiLab — Plan de Desarrollo

> Laboratorio inmersivo para enseñar Cálculo, Física y Redes/Telecomunicaciones,
> con tutor por voz, pensado para visor 360 (celular + Cardboard/VR-box).
>
> Documento vivo. Última revisión: 2026-09-03.

---

## 0. Estado actual (línea base)

Lo que **ya funciona**:

| Pieza | Archivo | Estado |
|---|---|---|
| Contrato de módulos | `types/module.ts` | Sólido. El shell no conoce ninguna disciplina. |
| Shell de experimento | `components/shell/ExperimentShell.tsx` | Funciona; genérico. |
| Lobby 3D con puertas | `components/lobby/` | Funciona; navegación por proximidad. |
| Giroscopio + gate horizontal | `useDeviceOrientation.ts`, `OrientationGate.tsx` | Funciona. |
| Caminar con gamepad | `MovementController.tsx` | Stick izquierdo, relativo a la cámara. |
| Cursor virtual + sliders | `useVirtualCursor.ts` | Stick derecho + botón X (índice 0). |
| Timestep fijo 1/60s | `lib/physics-engine/useFixedTimestep.ts` | Funciona. |
| Física: tiro parabólico | `.../tiro-parabolico/` | Funciona. |
| Física: colisiones 1D | `.../colisiones-1d/` | Funciona. |
| Texturas PBR con tiling | `useTiledPbrTexture.ts` | Funciona; convención Poly Haven. |

Lo que **falta**:

- Módulos de Cálculo y Redes: cero. Solo hay Física.
- Tutor de IA: `AIContext` está definido en `types/module.ts` pero nadie lo consume.
- Voz: no existe (ni entrada ni salida).
- Supabase: instalado (`lib/supabase/`) pero sin esquema ni uso.
- Capa de "juego": no hay objetivos, puntaje, ni progreso.
- Calidad visual: ver sección 2.

---

## 1. Supuestos y decisiones tomadas

Estas decisiones se toman acá para no bloquear el desarrollo. Si alguna no
coincide con lo que querés, se cambia acá y el resto del plan se ajusta.

| Decisión | Elección | Por qué |
|---|---|---|
| **Dispositivo objetivo** | Celular Android gama media (Snapdragon 6xx/7xx) dentro de un visor tipo Cardboard, Chrome | Es el escenario más restrictivo y el más probable en la defensa. Si corre ahí, corre en laptop. |
| **Presupuesto de render** | 60 fps objetivo, 30 fps piso. ~150k triángulos visibles, 1 sola luz con sombra | Un celular gama media no aguanta más. |
| **Post-proceso** | Solo **bloom selectivo** + vignette. Sin SSAO, sin DOF, sin motion blur | SSAO en móvil cuesta ~40% del frame para un efecto que casi no se nota en un visor. |
| **Dirección de arte** | **"Laboratorio limpio + HUD holográfico"** — espacio arquitectónico real y luminoso, con la data superpuesta en teal/ámbar translúcido | Es legible en proyector, se ve profesional en la defensa, y aprovecha los tokens teal/ámbar que ya existen en `globals.css`. Un lab oscuro sci-fi se ve genial en foto pero es ilegible en un visor barato, donde los lentes pierden contraste. |
| **Idioma** | Español de Guatemala, voseo suave, como los comentarios actuales | Consistencia con el código existente. |
| **Modelo del tutor** | `claude-opus-5` con `effort: "low"` y streaming | Ver sección 4.3. |

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
documentados acá y en comentarios dentro del código.

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

**F2 · Colisiones 1D → "Predecí el resultado"** *(existe; agregarle el juego)*
- **Concepto**: conservación de momento y energía; elástico vs. inelástico.
- **Mecánica**: el jugador **primero predice** v1' y v2' con dos sliders, después
  suelta los carritos. Puntaje = 100 − error porcentual. Esto convierte un
  simulador pasivo en un examen activo.
- **Variables**: `mass1`, `mass2`, `v1`, `v2`, `restitution` (0–1).
- **Assets**: riel metálico, carritos, sonido de impacto (2 variantes: seco/elástico).

**F3 · Péndulo y energía → "Sincronizá los relojes"**
- **Concepto**: T = 2π√(L/g); la masa **no** afecta el periodo (contraintuitivo,
  gran momento de aprendizaje); intercambio energía cinética ↔ potencial.
- **Mecánica**: dos péndulos, uno fijo. Ajustar la longitud del segundo hasta que
  oscilen en fase. Barras de energía en vivo a los lados.
- **Variables**: `length` (0.2–3 m), `mass` (0.1–5 kg), `angle0`, `damping`.
- **Assets**: bastidor metálico, esfera pulida, sonido de tic.

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

### 3.2 Cálculo

Nota de diseño: en cálculo la tentación es dibujar una gráfica 2D flotando en 3D.
Eso desperdicia el medio. La regla acá es **el jugador está parado dentro del
espacio de la función**.

**C1 · Derivada → "Frená en el pico"**
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

**C3 · Sólidos de revolución → "Torneá la pieza"**
- **Concepto**: V = π∫f(x)²dx, método de discos y de capas.
- **Mecánica**: el jugador edita el perfil f(x) con puntos de control, la curva
  gira alrededor del eje y genera el sólido en tiempo real. Objetivo: igualar la
  silueta de una pieza objetivo con el mínimo error de volumen. **Este es el
  experimento que más justifica el 3D de todo el proyecto** — en papel es
  incomprensible, acá se camina alrededor del sólido.
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

### 3.3 Redes y Telecomunicaciones

Es tu carrera — este módulo debería ser el más fuerte y el que se muestre primero
en la defensa.

**R1 · Modulación AM/FM → "Sintonizá la emisora"**
- **Concepto**: portadora, moduladora, índice de modulación, ancho de banda.
- **Mecánica**: tres ondas en 3D apiladas (moduladora, portadora, modulada). El
  jugador ajusta la frecuencia del receptor hasta captar la emisora — cuando
  sintoniza, **el audio real se aclara** (Web Audio API); fuera de sintonía,
  estática. Es el mismo bucle de una radio de verdad.
- **Variables**: `fc` (portadora), `fm` (moduladora), `m` (índice), `tipo` (AM/FM), `f_receptor`.
- **Assets**: radio receptor (GLB), clip de audio de voz, ruido blanco.

**R2 · Constelación QAM → "Recuperá el mensaje"**
- **Concepto**: I/Q, modulación digital (BPSK/QPSK/16-QAM/64-QAM), SNR, BER, y el
  compromiso central de las comunicaciones digitales: más bits por símbolo ⇒
  menos tolerancia al ruido.
- **Mecánica**: el diagrama de constelación como nube de puntos 3D flotante. El
  jugador sube el SNR y ve la nube contraerse en puntos limpios; lo baja y los
  puntos se mezclan. Se transmite un texto real y se muestra el texto recibido
  degradándose carácter por carácter. Meta: transmitir el mensaje sin errores con
  la **mínima** potencia. Contador de BER en vivo.
- **Variables**: `esquema` (BPSK/QPSK/16-QAM/64-QAM), `snr` (0–30 dB), `potencia`, `simbolos`.
- **Assets**: ninguno (nube de puntos procedural) — el bloom acá es esencial.

**R3 · Propagación y cobertura → "Cubrí el campus"**
- **Concepto**: pérdida de espacio libre (FSPL = 20·log d + 20·log f + 32.44),
  sombra por obstáculos, presupuesto de enlace, reutilización de frecuencias.
- **Mecánica**: un plano 3D del campus con edificios. El jugador coloca antenas
  (presupuesto limitado), elige potencia y frecuencia, y ve un **mapa de calor de
  cobertura** actualizarse. Meta: cubrir todos los puntos marcados sin exceder el
  presupuesto ni provocar interferencia entre celdas del mismo canal.
- **Variables**: por antena — `potencia` (dBm), `frecuencia` (900 MHz / 2.4 / 5 GHz), `altura`, `tipo` (omni/sectorial).
- **Assets**: edificios low-poly, torre de antena, antena sectorial, terreno.

**R4 · Enrutamiento → "Ganale a Dijkstra"**
- **Concepto**: grafos, costo de enlace, vector-distancia vs. estado de enlace,
  convergencia tras una caída de enlace.
- **Mecánica**: el jugador está **dentro** de la red — nodos como racks flotantes
  unidos por haces de luz cuyo grosor es el ancho de banda. Elige el siguiente
  salto para llevar un paquete al destino, contrarreloj. Al final se compara su
  ruta contra la óptima de Dijkstra. Nivel avanzado: se cae un enlace a mitad de
  camino y hay que re-enrutar.
- **Variables**: `topologia` (select), `metrica` (saltos / ancho de banda / latencia), `nodo_caido`.
- **Assets**: rack de servidores, switch, router (GLB), paquete (cubo emisivo).

**R5 · Encapsulación OSI/TCP-IP → "Armá la trama"**
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
- **Por qué es barato**: reutiliza **el mismo micrófono y el mismo `AudioContext`
  del tutor de voz** (sección 4). Una vez concedido el permiso de micrófono,
  `AnalyserNode.getByteFrequencyData()` da el espectro con ~30 líneas. Máximo
  impacto en la defensa por unidad de esfuerzo.

### 3.4 Capa de juego compartida (transversal)

En vez de programar puntaje dentro de cada experimento, se extiende el contrato
en `types/module.ts` con un objetivo opcional:

```ts
export interface ExperimentChallenge {
  id: string;
  prompt: string;                       // "Acertá a los 3 blancos"
  evaluate: (state: AIContext) => {
    solved: boolean;
    score: number;                      // 0–100
    feedback: string;                   // lo lee el tutor por voz
  };
}
```

Y `ExperimentDefinition` gana `challenges?: ExperimentChallenge[]`. El shell
dibuja el objetivo, el puntaje y el resultado — **ningún experimento necesita
saber cómo se ve un HUD de puntaje**. Es el mismo principio que ya usás con
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
  │  [3] @anthropic-ai/sdk → client.messages.stream()           │
  │      model: claude-opus-5, effort: low, prompt caching      │
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

`app/api/tutor/route.ts` — Route Handler de Next.js, **runtime Node.js** (no Edge,
para usar el SDK oficial cómodamente).

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

const SYSTEM = `Sos el tutor de ImmersiLab, un laboratorio virtual universitario.
Hablás español de Guatemala, en segunda persona (vos), con tono de auxiliar de
cátedra: cercano pero preciso.

REGLAS DE FORMATO — tu respuesta se convierte en AUDIO, no se lee:
- Máximo 3 oraciones. Si necesitás más, terminá con una pregunta y esperá.
- Cero markdown, cero listas, cero símbolos. "v sub uno", no "v₁".
- Las fórmulas se dicen habladas: "ele sobre ge, todo bajo raíz", no "√(L/g)".
- Los números se redondean a 2 decimales.

PEDAGOGÍA:
- Si el estudiante puede deducirlo, guialo con una pregunta antes de dar la respuesta.
- Usá SIEMPRE los valores concretos de las variables actuales del experimento.
- Si preguntan algo fuera del experimento, respondé breve y traelos de vuelta.`;

export async function POST(req: Request) {
  const { transcript, context, history } = await req.json();

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low" }, // baja latencia: es conversación, no análisis
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      ...history,
      {
        role: "user",
        content:
          `[Estado del experimento]\n${JSON.stringify(context)}\n\n` +
          `[Pregunta del estudiante]\n${transcript}`,
      },
    ],
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(new TextEncoder().encode(event.delta.text));
          }
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
```

Por qué está así:

- **`effort: "low"`** — es una conversación corta, no un problema difícil. Baja el
  tiempo hasta el primer token, que es lo único que el usuario percibe.
- **`cache_control` en el system prompt** — el prompt es idéntico en cada pregunta;
  cachearlo abarata y acelera cada intercambio a partir del segundo.
- **Streaming** — indispensable. Sin él, el usuario espera en silencio la respuesta
  completa (2–4 s). Con él, el TTS arranca al cerrarse la primera oración (~600 ms).
- **`max_tokens: 1024`** — el prompt ya limita a 3 oraciones; esto es el techo duro.
- **`AIContext` va en el mensaje del usuario, no en el system** — así el system
  prompt se mantiene byte a byte idéntico y el caché no se invalida.
- **Costo estimado** (`claude-opus-5`: $5/MTok entrada, $25/MTok salida): con el
  system cacheado, ~250 tokens de entrada nueva + ~120 de salida ≈ **$0.004 por
  pregunta**. Una demo de 30 preguntas cuesta unos 12 centavos de dólar.
- La API key va en `.env.local` como `ANTHROPIC_API_KEY` y **nunca** con prefijo
  `NEXT_PUBLIC_` — eso la expondría en el bundle del cliente.

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
   preescrito ("No me puedo conectar ahorita") en vez de quedarse mudo. En una
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

**Antes de subir cualquier `.glb` al repo, comprimilo.** Si viene en `.obj`,
el flujo completo está en [`scripts/README.md`](scripts/README.md):
`obj2glb.py` → `gltf-transform simplify` → `gltf-transform meshopt`. El pack
de árboles pasó de 33 MB a 1.46 MB así.
Comprime texturas y colapsa mallas; suele bajar el peso 60–80%. En celular eso es
la diferencia entre cargar en 2 s o en 15 s.

**Presupuesto por modelo**: ≤ 15k triángulos, ≤ 2 MB, texturas ≤ 1024 px. Si un
modelo de Sketchfab pesa 40 MB, no sirve — buscá el equivalente low-poly.

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

### Fase B — Tutor por voz
1. `useSpeechInput` / `useSpeechOutput` + `lib/tutor/sentence-buffer.ts`.
2. `app/api/tutor/route.ts` con streaming (§4.3).
3. `VoiceTutor` + `TutorHUD`; montarlo en `ExperimentShell`.
4. Push-to-talk en R2, barge-in, ducking, subtítulos, modo sin conexión.
5. Probar en el celular objetivo dentro del visor. Medir el tiempo hasta el primer
   audio (meta: < 1.2 s).

**Entregable:** en el tiro parabólico se puede preguntar "¿por qué a cuarenta y
cinco grados llega más lejos?" y recibir respuesta hablada, usando los valores
actuales de los sliders.

### Fase C — Capa de juego + persistencia
1. `ExperimentChallenge` en `types/module.ts` + HUD de objetivo/puntaje en el shell.
2. Retos para F1 y F2.
3. Esquema en Supabase: `profiles`, `attempts` (experimento, reto, puntaje,
   variables, duración), `sessions`.
4. Pantalla de progreso del estudiante.
5. El tutor lee el `feedback` del reto por voz al terminar.

**Entregable:** un estudiante juega, obtiene puntaje, y el puntaje queda guardado.
Esto es lo que convierte el proyecto en un sistema educativo evaluable, no en una
demo suelta.

### Fase D — Módulo de Cálculo
C2 (Riemann) → C1 (derivada) → C3 (sólidos de revolución) → C4 (Taylor).
Ese orden: C2 es el más simple y valida el patrón; C3 es el más impresionante y
conviene tenerlo listo con tiempo de sobra.

**Entregable:** puerta de Cálculo en el lobby con 4 experimentos.

### Fase E — Módulo de Redes *(el módulo estrella)*
R6 (espectro, casi gratis reusando el micrófono) → R2 (QAM) → R1 (modulación) →
R5 (OSI) → R4 (enrutamiento) → R3 (cobertura, el más pesado).

**Entregable:** puerta de Redes con 5–6 experimentos.

### Fase F — Pulido y defensa
1. Perfilado en el dispositivo real; ajustar el interruptor de calidad.
2. Precarga de assets con pantalla de carga. Hoy el `Suspense fallback={null}`
   muestra una pantalla vacía mientras cargan las texturas — reemplazar por un
   indicador real de progreso.
3. Tutorial de entrada de 30 segundos (cómo caminar, cómo hablar).
4. Modo "recorrido guiado" para el jurado.
5. Documentación, créditos de assets, video de demostración.

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
