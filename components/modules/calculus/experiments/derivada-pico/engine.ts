import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";
import {
  findCriticalPoints,
  getTrack,
  type Track,
} from "@/components/modules/calculus/shared/tracks";

export type RidePhase = "listo" | "rodando" | "frenado";

export interface DerivativeRuntime {
  phase: RidePhase;
  /** Posición del vagón sobre el eje x de la función. */
  x: number;
  y: number;
  /** f'(x) en la posición actual: es el velocímetro del juego. */
  slope: number;
  /** Ceros de f' de la pista actual — las metas. */
  criticalPoints: number[];
  /** Distancia horizontal al cero de f' más cercano, al frenar. */
  missDistance: number;
  score: number;
  bestScore: number;
  attempts: number;
}

export interface DerivativeEngine extends ExperimentEngine {
  /** Arranca el recorrido desde el principio de la pista. */
  start: () => void;
  /** Frena donde esté el vagón — es la única acción del jugador. */
  brake: () => void;
  getRuntime: () => DerivativeRuntime;
}

/** Tolerancia del "clavado": por debajo de esto la pendiente se considera
 *  cero a ojo del juego. Es |f'|, no distancia en x, porque es la pendiente
 *  lo que el jugador está mirando en el velocímetro. */
const PERFECT_SLOPE = 0.05;

/**
 * Motor de "Frená en el pico" (C1).
 *
 * El vagón recorre la pista a velocidad constante EN X (no en longitud de
 * arco). Es una simplificación consciente: con velocidad sobre el arco, los
 * tramos empinados pasarían más lento y el jugador leería eso como "acá la
 * derivada es chica", que es exactamente lo contrario de lo que enseña el
 * experimento.
 *
 * El puntaje mide |f'| al frenar, no la distancia al pico: dos pistas pueden
 * tener el mismo error en x y pendientes muy distintas, y lo que el
 * experimento evalúa es si el jugador entendió la pendiente.
 */
export function createDerivativeEngine(): DerivativeEngine {
  let lastVariables: VariablesState = {};
  let track: Track = getTrack("ondas");
  let amp = 1;

  const runtime: DerivativeRuntime = {
    phase: "listo",
    x: 0,
    y: 0,
    slope: 0,
    criticalPoints: [],
    missDistance: 0,
    score: 0,
    bestScore: 0,
    attempts: 0,
  };

  /** Relee pista y amplitud, y recalcula las metas si alguna cambió. */
  function syncTrack(variables: VariablesState) {
    const nextTrack = getTrack(variables.pista ?? "ondas");
    const nextAmp = Number(variables.amplitud ?? 1);
    if (nextTrack === track && nextAmp === amp && runtime.criticalPoints.length)
      return;

    track = nextTrack;
    amp = nextAmp;
    runtime.criticalPoints = findCriticalPoints(track, amp);
    // Cambiar de pista a mitad de recorrido dejaría al vagón en una curva que
    // ya no existe, así que se vuelve a la salida.
    runtime.phase = "listo";
    runtime.x = track.domain[0];
    runtime.y = track.f(runtime.x, amp);
    runtime.slope = track.df(runtime.x, amp);
  }

  return {
    init(variables) {
      lastVariables = variables;
      syncTrack(variables);
    },

    update(dt, variables) {
      lastVariables = variables;
      syncTrack(variables);

      if (runtime.phase !== "rodando") return;

      const speed = Number(variables.velocidad ?? 1.5);
      runtime.x += speed * dt;

      // Llegó al final sin frenar: cuenta como intento perdido.
      if (runtime.x >= track.domain[1]) {
        runtime.x = track.domain[1];
        runtime.phase = "frenado";
        runtime.score = 0;
        runtime.attempts += 1;
      }

      runtime.y = track.f(runtime.x, amp);
      runtime.slope = track.df(runtime.x, amp);
    },

    reset() {
      runtime.phase = "listo";
      runtime.x = track.domain[0];
      runtime.y = track.f(runtime.x, amp);
      runtime.slope = track.df(runtime.x, amp);
      runtime.score = 0;
      runtime.missDistance = 0;
    },

    getState(): AIContext {
      return {
        experimentName: "Frená en el pico",
        disciplineName: "Cálculo",
        variables: lastVariables,
        result:
          runtime.phase === "frenado"
            ? {
                pendiente_al_frenar: Number(runtime.slope.toFixed(3)),
                distancia_al_pico: Number(runtime.missDistance.toFixed(3)),
                puntaje: runtime.score,
                mejor_puntaje: runtime.bestScore,
                intentos: runtime.attempts,
              }
            : undefined,
        conceptTags: [
          "derivada",
          "pendiente instantánea",
          "puntos críticos",
          "máximos y mínimos",
        ],
      };
    },

    start() {
      runtime.phase = "rodando";
      runtime.x = track.domain[0];
      runtime.y = track.f(runtime.x, amp);
      runtime.slope = track.df(runtime.x, amp);
      runtime.score = 0;
      runtime.missDistance = 0;
    },

    brake() {
      if (runtime.phase !== "rodando") return;
      runtime.phase = "frenado";
      runtime.attempts += 1;

      const slope = Math.abs(runtime.slope);
      runtime.missDistance = runtime.criticalPoints.reduce(
        (best, cp) => Math.min(best, Math.abs(cp - runtime.x)),
        Number.POSITIVE_INFINITY,
      );

      // 100 puntos cuando la pendiente es cero, cayendo suave: una exponencial
      // en vez de tramos fijos, para que el jugador vea que acercarse un poco
      // más siempre suma algo y no haya escalones arbitrarios.
      runtime.score =
        slope <= PERFECT_SLOPE ? 100 : Math.round(100 * Math.exp(-slope * 1.6));
      if (runtime.score > runtime.bestScore) runtime.bestScore = runtime.score;
    },

    getRuntime() {
      return runtime;
    },
  };
}
