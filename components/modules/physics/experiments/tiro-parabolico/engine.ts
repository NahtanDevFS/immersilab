import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

const DEG = Math.PI / 180;
const GROUND_Y = 0;

export type ProjectilePhase = "idle" | "flying" | "landed";

/** Modo de juego: tiro libre, ronda de blancos, o ronda con viento (F1 · Artillería). */
export type ProjectileMode = "libre" | "blancos" | "viento";

/** Posición x (m, en el mundo) del centro de cada blanco. */
export const TARGETS_X = [20, 32, 45];
/** Radio del centro del blanco: caer adentro cuenta como impacto. */
export const BULLSEYE_RADIUS = 1.5;
/** Puntos que se pierden por cada metro de error: a 12.5 m, cero. */
const POINTS_PER_METER = 8;
/** Metas de los retos, sobre 300 puntos por ronda. */
export const ROUND_GOAL = 220;
export const WIND_ROUND_GOAL = 180;

export interface Shot {
  /** Dónde cayó (x en el mundo). */
  x: number;
  /** Distancia al centro del blanco, en metros. */
  miss: number;
  points: number;
}

export interface RoundState {
  /** Blanco al que apunta el próximo disparo (0–2); 3 cuando terminó. */
  targetIndex: number;
  shots: Shot[];
  total: number;
  /** Aceleración del viento sobre el proyectil, m/s² (+ empuja hacia los blancos). */
  wind: number;
  finished: boolean;
}

export interface ProjectileRuntime {
  phase: ProjectilePhase;
  position: { x: number; y: number };
  trail: Array<{ x: number; y: number }>;
  range: number;
  maxHeight: number;
  flightTime: number;
  mode: ProjectileMode;
  round: RoundState;
}

// Extiende el contrato base (ExperimentEngine) con lo que necesita
// específicamente este experimento: disparar y leer el estado en vivo.
export interface ProjectileEngine extends ExperimentEngine {
  fire: () => void;
  /** Empieza una ronda nueva de blancos (con viento nuevo si es el modo con viento). */
  newRound: () => void;
  getRuntime: () => ProjectileRuntime;
}

/** Puntos de un disparo según cuánto le erró al centro. */
export function pointsFor(miss: number): number {
  return Math.max(0, Math.round(100 - POINTS_PER_METER * miss));
}

/**
 * Viento de una ronda: entre 0.6 y 1.8 m/s², a favor o en contra al azar.
 * En un vuelo de 2–3 s corre la caída varios metros: obliga a corregir el
 * tiro razonando, no repitiendo el ángulo de la ronda anterior.
 */
function randomWind(): number {
  const magnitude = 0.6 + Math.random() * 1.2;
  return Number(((Math.random() < 0.5 ? -1 : 1) * magnitude).toFixed(1));
}

/**
 * Motor de tiro parabólico, con resistencia del aire opcional (arrastre
 * lineal) y, en el modo de juego con viento, un empuje horizontal constante.
 *
 * Física:
 *   vx0 = v0 * cos(angulo)
 *   vy0 = v0 * sin(angulo)
 *   cada paso: ax = -k*vx + viento ; ay = -g - k*vy ; vx += ax*dt ; vy += ay*dt
 *              x += vx*dt ; y += vy*dt
 *
 * "k" (drag) es el coeficiente de arrastre — con k=0 se recupera el caso
 * ideal sin aire. No es un modelo aerodinámico real (no depende de la
 * forma/área del proyectil), es una aproximación didáctica: a mayor "k",
 * más frena la velocidad con el tiempo.
 *
 * Se integra con un delta de tiempo FIJO que nos da el shell
 * (useFixedTimestep), no con el framerate real del navegador.
 */
/**
 * Un paso de tiempo, exacto. En cada eje la aceleración es c − k·v (c es la
 * gravedad o el viento, constante), y esa ecuación tiene solución cerrada:
 *   v(dt) = c/k + (v − c/k)·e^(−k·dt)
 *   x(dt) = x + (c/k)·dt + (v − c/k)·(1 − e^(−k·dt))/k
 * Sin aire (k = 0) queda x + v·dt + c·dt²/2. Así el experimento da lo mismo
 * que las ecuaciones del pizarrón con cualquier paso, y el tutor puede
 * anticipar el resultado sin diferencias.
 */
function stepAxis(x: number, v: number, c: number, k: number, dt: number): [number, number] {
  if (k === 0) return [x + v * dt + 0.5 * c * dt * dt, v + c * dt];
  const terminal = c / k;
  const decay = Math.exp(-k * dt);
  return [x + terminal * dt + ((v - terminal) * (1 - decay)) / k, terminal + (v - terminal) * decay];
}

/**
 * El disparo completo con estos valores, sin animarlo: lo que va a pasar si
 * se dispara ahora. Es la misma física que el experimento (mismo integrador,
 * mismo punto de caída interpolado), con un paso más fino.
 *
 * Es para el tutor: con resistencia del aire el alcance no tiene una fórmula
 * cerrada (hay que despejar t en una ecuación con exponenciales), y el modelo
 * de voz respondía que "no se puede calcular".
 */
export function predictShot(angleDeg: number, v0: number, g: number, k: number, wind: number) {
  const dt = 1 / 600;
  const rad = angleDeg * DEG;
  let vx = v0 * Math.cos(rad);
  let vy = v0 * Math.sin(rad);
  let x = 0;
  let y = 0;
  let t = 0;
  let maxHeight = 0;
  for (let i = 0; i < 600 * 120; i++) {
    const px = x;
    const py = y;
    [x, vx] = stepAxis(x, vx, wind, k, dt);
    [y, vy] = stepAxis(y, vy, -g, k, dt);
    t += dt;
    maxHeight = Math.max(maxHeight, y);
    if (y <= GROUND_Y && vy < 0) {
      const f = (py - GROUND_Y) / (py - y);
      return { range: px + (x - px) * f, maxHeight, flightTime: t - dt * (1 - f) };
    }
  }
  return { range: x, maxHeight, flightTime: t };
}

/** La cuenta que el tutor tiene que poder explicar, con los valores de ahora. */
function calculation(
  angle: number,
  v0: number,
  g: number,
  k: number,
  wind: number,
  rad: number,
  fmt: (n: number) => string,
): string {
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  if (k === 0) {
    const t = (2 * v0 * sin) / g;
    const h = (v0 * sin) ** 2 / (2 * g);
    if (wind === 0) {
      return [
        `sen(2·${angle}°) = ${Math.sin(2 * rad).toFixed(4)}`,
        `alcance = ${v0}² · ${Math.sin(2 * rad).toFixed(4)} / ${g} = ${fmt((v0 * v0 * Math.sin(2 * rad)) / g)} m`,
        `altura máxima = (${v0} · sen ${angle}°)² / (2 · ${g}) = ${fmt(h)} m`,
        `tiempo de vuelo = 2 · ${v0} · sen ${angle}° / ${g} = ${fmt(t)} s`,
      ].join("; ");
    }
    // El viento solo empuja en horizontal: el tiempo de vuelo es el mismo.
    const range = v0 * cos * t + 0.5 * wind * t * t;
    return [
      `con viento el tiempo de vuelo no cambia: t = 2 · ${v0} · sen ${angle}° / ${g} = ${fmt(t)} s`,
      `en horizontal hay aceleración constante: alcance = ${v0} · cos ${angle}° · t + ½ · (${wind.toFixed(2)}) · t² = ${fmt(v0 * cos * t)} ${wind >= 0 ? "+" : "−"} ${fmt(Math.abs(0.5 * wind * t * t))} = ${fmt(range)} m`,
      `altura máxima = (${v0} · sen ${angle}°)² / (2 · ${g}) = ${fmt(h)} m`,
    ].join("; ");
  }
  const shot = predictShot(angle, v0, g, k, wind);
  const ideal = (v0 * v0 * Math.sin(2 * rad)) / g;
  return [
    `con resistencia del aire (a = −k·v${wind ? " + viento" : ""}) hay ecuaciones exactas para cada instante: ` +
      (wind
        ? `x(t) = ((${fmt(v0 * cos)} − ${wind.toFixed(2)}/${k})/${k}) · (1 − e^(−${k}·t)) + (${wind.toFixed(2)}/${k}) · t, `
        : `x(t) = (${fmt(v0 * cos)}/${k}) · (1 − e^(−${k}·t)), `) +
      `y(t) = (${fmt(v0 * sin)}/${k} + ${g}/${k}²) · (1 − e^(−${k}·t)) − (${g}/${k}) · t`,
    "el alcance NO tiene fórmula cerrada: hay que buscar el t donde y vuelve a 0, y eso se resuelve numéricamente",
    `resolviéndolo (simulación con los valores actuales): tiempo de vuelo ${fmt(shot.flightTime)} s, alcance ${fmt(shot.range)} m, altura máxima ${fmt(shot.maxHeight)} m`,
    `sin aire daría ${fmt(ideal)} m: el aire le quita ${fmt(ideal - shot.range)} m`,
  ].join("; ");
}

export function createProjectileEngine(): ProjectileEngine {
  let lastVariables: VariablesState = {};
  let time = 0;
  let velocity = { x: 0, y: 0 };
  /**
   * El disparo sale del pivote del tubo, a nivel del suelo (el cañón está en
   * una trinchera, ver ProjectileScene). Antes salía de la boca, a 2.4–3.8 m
   * de alto según el ángulo: esa altura no se mencionaba en ningún lado y
   * corría el alcance hasta un 50 % de lo que da v²·sen(2θ)/g, así que la
   * cuenta del curso no acertaba a los blancos. Desde el suelo, la fórmula
   * vale exacta y las distancias se miden desde el cañón.
   */
  const launch = { x: 0, y: 0 };

  /**
   * Con qué valores se hizo el último disparo. El tutor recibe el resultado
   * junto a las variables ACTUALES: si después se movió el ángulo, sin esto
   * leía el alcance de otro ángulo como si fuera el de ahora.
   */
  let lastShot: { angle: number; velocity: number; gravity: number; drag: number; mode: ProjectileMode } | null = null;

  // Logros de F1, aparte del estado del tiro: `reset()` no los borra.
  let anyHit = false;
  let bestRound = 0;
  let bestWindRound = 0;

  function freshRound(mode: ProjectileMode): RoundState {
    return {
      targetIndex: 0,
      shots: [],
      total: 0,
      wind: mode === "viento" ? randomWind() : 0,
      finished: false,
    };
  }

  const runtime: ProjectileRuntime = {
    phase: "idle",
    position: { x: launch.x, y: launch.y },
    trail: [],
    range: 0,
    maxHeight: 0,
    flightTime: 0,
    mode: "libre",
    round: freshRound("libre"),
  };

  function resetRuntime() {
    time = 0;
    velocity = { x: 0, y: 0 };
    runtime.phase = "idle";
    runtime.position = { x: launch.x, y: launch.y };
    runtime.trail = [];
    runtime.range = 0;
    runtime.maxHeight = 0;
    runtime.flightTime = 0;
  }

  function readMode(variables: VariablesState) {
    const mode = String(variables.modo ?? "libre") as ProjectileMode;
    if (mode !== runtime.mode) {
      runtime.mode = mode;
      runtime.round = freshRound(mode);
      resetRuntime();
    }
  }

  /** Se llama al aterrizar: puntúa el disparo contra el blanco de turno. */
  function scoreShot() {
    const { round } = runtime;
    if (runtime.mode === "libre" || round.finished) return;

    const target = TARGETS_X[round.targetIndex];
    const miss = Math.abs(runtime.position.x - target);
    const points = pointsFor(miss);
    round.shots.push({ x: runtime.position.x, miss, points });
    round.total += points;
    round.targetIndex += 1;
    if (miss <= BULLSEYE_RADIUS) anyHit = true;

    if (round.targetIndex >= TARGETS_X.length) {
      round.finished = true;
      if (runtime.mode === "viento") bestWindRound = Math.max(bestWindRound, round.total);
      else bestRound = Math.max(bestRound, round.total);
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      readMode(variables);
      resetRuntime();
    },

    update(dt, variables) {
      lastVariables = variables;
      readMode(variables);
      if (runtime.phase !== "flying") return;

      const g = Number(variables.gravity ?? 9.81);
      const k = Number(variables.drag ?? 0);
      const wind = runtime.mode === "viento" ? runtime.round.wind : 0;

      // Paso exacto (ver stepAxis): sin aire es la parábola de v²·sen(2θ)/g,
      // con aire las exponenciales. Con Euler simple caía unos 20 cm antes.
      const prev = { ...runtime.position };
      [runtime.position.x, velocity.x] = stepAxis(runtime.position.x, velocity.x, wind, k, dt);
      [runtime.position.y, velocity.y] = stepAxis(runtime.position.y, velocity.y, -g, k, dt);
      time += dt;

      if (runtime.position.y > runtime.maxHeight) {
        runtime.maxHeight = runtime.position.y;
      }

      // Aterrizó: cruzó el suelo bajando. El punto de caída se interpola
      // dentro del paso, no se toma el primero que quedó bajo tierra (que
      // se pasaba hasta un paso entero, unos 30 cm).
      if (runtime.position.y <= GROUND_Y && velocity.y < 0) {
        const f = (prev.y - GROUND_Y) / (prev.y - runtime.position.y);
        runtime.position.x = prev.x + (runtime.position.x - prev.x) * f;
        time -= dt * (1 - f);
        runtime.position.y = GROUND_Y;
        runtime.trail.push({ ...runtime.position });
        runtime.phase = "landed";
        runtime.range = runtime.position.x - launch.x;
        runtime.flightTime = time;
        scoreShot();
      } else {
        runtime.trail.push({ ...runtime.position });
      }
    },

    reset() {
      resetRuntime();
    },

    newRound() {
      runtime.round = freshRound(runtime.mode);
      resetRuntime();
    },

    resetChallenges() {
      anyHit = false;
      bestRound = 0;
      bestWindRound = 0;
    },

    getChallenges(): ChallengeStatus[] {
      return [
        {
          id: "impacto",
          title: "Primer impacto",
          detail: `En modo blancos, cae a menos de ${BULLSEYE_RADIUS} m del centro de un blanco.`,
          done: anyHit,
          progress: anyHit ? 1 : 0,
        },
        {
          id: "ronda",
          title: "Ronda de artillero",
          detail: `Tres blancos sin viento: ${ROUND_GOAL} puntos o más. Mejor ronda: ${bestRound}.`,
          done: bestRound >= ROUND_GOAL,
          progress: bestRound / ROUND_GOAL,
        },
        {
          id: "viento",
          title: "Contra el viento",
          detail: `Una ronda con viento: ${WIND_ROUND_GOAL} puntos o más. Mejor ronda: ${bestWindRound}.`,
          done: bestWindRound >= WIND_ROUND_GOAL,
          progress: bestWindRound / WIND_ROUND_GOAL,
        },
      ];
    },

    getState(): AIContext {
      const { round, mode } = runtime;
      const game =
        mode === "libre"
          ? {}
          : {
              modo: mode === "viento" ? "ronda con viento" : "ronda de blancos",
              blanco_actual_m: round.finished ? "ronda terminada" : TARGETS_X[round.targetIndex],
              disparos: round.shots
                .map((s, i) => `blanco ${i + 1}: erró por ${s.miss.toFixed(1)} m (${s.points} pts)`)
                .join("; ") || "ninguno",
              puntaje_ronda: round.total,
              ...(mode === "viento"
                ? { viento_m_s2: round.wind, viento: round.wind > 0 ? "a favor" : "en contra" }
                : {}),
            };
      const angle = Number(lastVariables.angle ?? 45);
      const v0 = Number(lastVariables.velocity ?? 20);
      const g = Number(lastVariables.gravity ?? 9.81);
      const drag = Number(lastVariables.drag ?? 0);
      const shotChanged =
        lastShot !== null &&
        (lastShot.angle !== angle || lastShot.velocity !== v0 || lastShot.gravity !== g || lastShot.drag !== drag);
      // La cuenta ideal con los valores de ahora, hecha acá: el modelo de voz
      // se equivocaba en la aritmética (senos, cuadrados) o la salteaba. Solo
      // sin aire ni viento, que es cuando la fórmula vale.
      const rad = angle * DEG;
      const wind = mode === "viento" ? round.wind : 0;
      const fmt = (n: number) => n.toFixed(2);
      return {
        experimentName: "Tiro parabólico",
        disciplineName: "Física",
        variables: lastVariables,
        result: {
          ...(runtime.phase === "landed"
            ? {
                alcance_m: Number(runtime.range.toFixed(2)),
                altura_maxima_m: Number(runtime.maxHeight.toFixed(2)),
                tiempo_vuelo_s: Number(runtime.flightTime.toFixed(2)),
              }
            : {}),
          ...game,
        },
        // Para el tutor, no para el panel de resultados.
        tutorNotes: {
          ...(runtime.phase === "landed" && lastShot
            ? {
                resultado_es_del_disparo: `con ángulo ${lastShot.angle}°, velocidad ${lastShot.velocity} m/s, gravedad ${lastShot.gravity} m/s² y resistencia ${lastShot.drag} 1/s`,
                ...(shotChanged
                  ? { aviso: "el estudiante cambió valores después de ese disparo: el resultado NO es el de los valores actuales" }
                  : {}),
              }
            : {}),
          calculo_con_los_valores_actuales: calculation(angle, v0, g, drag, wind, rad, fmt),
        },
        conceptTags: ["cinemática", "movimiento parabólico", "gravedad"],
      };
    },

    getSeries() {
      return runtime.trail;
    },

    // Método propio de este experimento (no forma parte del contrato base):
    // inicia el disparo usando el ángulo y velocidad actuales.
    fire() {
      if (runtime.phase === "flying") return;
      // Con la ronda terminada no se dispara más: hay que empezar otra.
      if (runtime.mode !== "libre" && runtime.round.finished) return;
      resetRuntime();
      const angle = Number(lastVariables.angle ?? 45) * DEG;
      const v0 = Number(lastVariables.velocity ?? 20);
      lastShot = {
        angle: Number(lastVariables.angle ?? 45),
        velocity: v0,
        gravity: Number(lastVariables.gravity ?? 9.81),
        drag: Number(lastVariables.drag ?? 0),
        mode: runtime.mode,
      };
      velocity = { x: v0 * Math.cos(angle), y: v0 * Math.sin(angle) };
      runtime.phase = "flying";
      runtime.trail.push({ ...runtime.position });
    },

    getRuntime() {
      return runtime;
    },

  };
}
