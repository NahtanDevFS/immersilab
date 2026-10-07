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
  /**
   * Dónde arranca el disparo, en coordenadas del mundo. Lo fija la escena
   * con la posición de la BOCA del cañón, que se mueve al cambiar el ángulo.
   *
   * Sin esto la física salía del origen mientras el cañón disparaba desde
   * dos metros más arriba y adelante, y la bola no coincidía con el tubo.
   * Además ahora la altura de la boca cuenta de verdad: por eso el alcance a
   * 45° no es exactamente el del caso ideal, y está bien que así sea.
   */
  setLaunch: (x: number, y: number) => void;
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
export function createProjectileEngine(): ProjectileEngine {
  let lastVariables: VariablesState = {};
  let time = 0;
  let velocity = { x: 0, y: 0 };
  const launch = { x: 0, y: 0 };

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

      // Symplectic Euler: actualiza velocidad primero, luego posición.
      // Es estable para este tipo de simulación con paso fijo pequeño.
      const ax = -k * velocity.x + wind;
      const ay = -g - k * velocity.y;
      velocity.x += ax * dt;
      velocity.y += ay * dt;
      runtime.position.x += velocity.x * dt;
      runtime.position.y += velocity.y * dt;
      time += dt;

      if (runtime.position.y > runtime.maxHeight) {
        runtime.maxHeight = runtime.position.y;
      }
      runtime.trail.push({ ...runtime.position });

      // Aterrizó: cruzó el suelo bajando.
      if (runtime.position.y <= GROUND_Y && velocity.y < 0) {
        runtime.position.y = GROUND_Y;
        runtime.phase = "landed";
        // Distancia recorrida desde la boca, no desde el origen del mundo.
        runtime.range = runtime.position.x - launch.x;
        runtime.flightTime = time;
        scoreShot();
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
      velocity = { x: v0 * Math.cos(angle), y: v0 * Math.sin(angle) };
      runtime.phase = "flying";
      runtime.trail.push({ ...runtime.position });
    },

    getRuntime() {
      return runtime;
    },

    setLaunch(x, y) {
      launch.x = x;
      launch.y = y;
      // Reposicionar el proyectil en reposo hace que siga la boca del cañón
      // mientras se mueve el slider de ángulo, antes de disparar.
      if (runtime.phase === "idle") {
        runtime.position.x = x;
        runtime.position.y = y;
      }
    },
  };
}
