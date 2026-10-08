import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export type CollisionPhase = "idle" | "moving" | "collided";

/** F2 · Predice el resultado: lo que el alumno anotó antes de soltar y cómo le fue. */
export interface Prediction {
  predicted: { v1: number; v2: number };
  actual: { v1: number; v2: number } | null;
  /** 0–100, null hasta que chocan. */
  score: number | null;
}

export interface CollisionRuntime {
  phase: CollisionPhase;
  pos1: number;
  pos2: number;
  vel1: number;
  vel2: number;
  /** La predicción congelada al soltar (null antes del primer intento). */
  prediction: Prediction | null;
}

export interface CollisionEngine extends ExperimentEngine {
  start: () => void;
  getRuntime: () => CollisionRuntime;
}

const START_X1 = -6;
const START_X2 = 6;
/**
 * Medio largo del riel (mide 16 m). En cada punta hay un tope que frena al
 * carrito que llega: antes no había nada y, después del choque, los
 * carritos salían del riel y seguían para siempre.
 */
export const RAIL_HALF = 8;
// Mitad del ancho que DIBUJA la escena (0.6 + 0.2·m): antes el motor usaba
// 0.05 por kg y la escena 0.2, así que con masas grandes los carritos se
// encimaban en pantalla antes de "chocar".
const BASE_HALF_WIDTH = 0.3;
const WIDTH_PER_MASS = 0.1;

/** Puntaje mínimo de una predicción para contar en los retos. */
export const GOOD_PREDICTION = 90;

/**
 * Puntaje de una predicción: 100 menos el error total relativo a la rapidez
 * con que venían los carritos. Relativo a eso y no a cada velocidad final:
 * una velocidad final de cero (choque plástico de masas iguales) haría que
 * el error porcentual fuera infinito.
 */
export function predictionScore(
  predicted: { v1: number; v2: number },
  actual: { v1: number; v2: number },
  initial: { v1: number; v2: number },
): number {
  const error = Math.abs(predicted.v1 - actual.v1) + Math.abs(predicted.v2 - actual.v2);
  const scale = Math.max(1, Math.abs(initial.v1) + Math.abs(initial.v2));
  return Math.max(0, Math.round(100 - (100 * error) / scale));
}

function halfWidth(mass: number) {
  return BASE_HALF_WIDTH + mass * WIDTH_PER_MASS;
}

interface CollisionResult {
  v1: number;
  v2: number;
  energyLostPct: number;
}

/**
 * Motor de colisión 1D entre dos carritos sobre una vía recta.
 *
 * Convención de signos: velocidad positiva = se mueve hacia +x (derecha).
 * El carrito 1 arranca a la izquierda (x=-6), el carrito 2 a la derecha
 * (x=6) — para que choquen, la velocidad 1 debe ser positiva (hacia la
 * derecha) y/o la velocidad 2 negativa (hacia la izquierda).
 *
 * Al detectar contacto (según el "ancho" de cada carrito, proporcional a
 * su masa), se resuelve el choque con la fórmula de restitución. El primero
 * es el que cuenta (resultado y puntaje de la predicción); si después se
 * vuelven a tocar (uno rebota en un tope y alcanza al otro), se resuelve
 * igual para que no se atraviesen, pero ya no cambia el resultado.
 *
 * Los topes de las puntas frenan en seco al carrito que llega. Cuando los
 * dos quedan quietos, el intento terminó.
 */
export function createCollisionEngine(): CollisionEngine {
  let lastVariables: VariablesState = {};
  let collisionResult: CollisionResult | null = null;
  /** Velocidades con que se soltaron, para puntuar la predicción. */
  let released = { v1: 0, v2: 0 };
  // Logros de F2: aparte del estado del choque, `reset()` no los borra.
  let bestElastic = 0;
  let bestPlastic = 0;
  let bestMixed = 0;

  const runtime: CollisionRuntime = {
    phase: "idle",
    pos1: START_X1,
    pos2: START_X2,
    vel1: 0,
    vel2: 0,
    prediction: null,
  };

  function resetRuntime() {
    runtime.phase = "idle";
    runtime.pos1 = START_X1;
    runtime.pos2 = START_X2;
    runtime.vel1 = 0;
    runtime.vel2 = 0;
    collisionResult = null;
  }

  return {
    init(variables) {
      lastVariables = variables;
      resetRuntime();
    },

    update(dt, variables) {
      lastVariables = variables;
      if (runtime.phase === "idle") return;

      runtime.pos1 += runtime.vel1 * dt;
      runtime.pos2 += runtime.vel2 * dt;

      const m1 = Number(variables.mass1 ?? 1);
      const m2 = Number(variables.mass2 ?? 1);
      const gap = runtime.pos2 - runtime.pos1;
      const minGap = halfWidth(m1) + halfWidth(m2);

      if (gap <= minGap) {
        const overlap = minGap - gap;
        runtime.pos1 -= overlap / 2;
        runtime.pos2 += overlap / 2;
      }

      // Se tocan y se acercan: hay choque. Si ya se están separando (justo
      // después de un choque), solo se corrige la superposición de arriba.
      if (gap <= minGap && runtime.vel1 > runtime.vel2) {
        const e = Number(variables.restitution ?? 1);
        const v1 = runtime.vel1;
        const v2 = runtime.vel2;

        const v1f = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
        const v2f = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2);
        runtime.vel1 = v1f;
        runtime.vel2 = v2f;

        if (runtime.phase === "moving") {

          const keBefore = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
          const keAfter = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
          const energyLostPct =
            keBefore > 0 ? ((keBefore - keAfter) / keBefore) * 100 : 0;

          runtime.phase = "collided";
          collisionResult = { v1: v1f, v2: v2f, energyLostPct };

          // Se puntúa la predicción que se congeló al soltar.
          if (runtime.prediction) {
            const actual = { v1: v1f, v2: v2f };
            const score = predictionScore(runtime.prediction.predicted, actual, released);
            runtime.prediction.actual = actual;
            runtime.prediction.score = score;
            if (e >= 0.99) bestElastic = Math.max(bestElastic, score);
            else if (e <= 0.01) bestPlastic = Math.max(bestPlastic, score);
            else if (e >= 0.2 && e <= 0.8 && Math.abs(m1 - m2) >= 1) {
              bestMixed = Math.max(bestMixed, score);
            }
          }
        }
      }

      // Topes: el carrito 1 siempre queda a la izquierda del 2, así que
      // solo puede llegar al tope izquierdo, y el 2 al derecho.
      const leftStop = -RAIL_HALF + halfWidth(m1);
      if (runtime.pos1 < leftStop) {
        runtime.pos1 = leftStop;
        if (runtime.vel1 < 0) runtime.vel1 = 0;
      }
      const rightStop = RAIL_HALF - halfWidth(m2);
      if (runtime.pos2 > rightStop) {
        runtime.pos2 = rightStop;
        if (runtime.vel2 > 0) runtime.vel2 = 0;
      }

      // Si se soltaron alejándose (o quietos), nunca chocan: cuando los dos
      // quedan frenados en los topes, el intento terminó igual.
      if (runtime.phase === "moving" && runtime.vel1 === 0 && runtime.vel2 === 0) {
        runtime.phase = "collided";
      }
    },

    reset() {
      resetRuntime();
      runtime.prediction = null;
    },

    resetChallenges() {
      bestElastic = 0;
      bestPlastic = 0;
      bestMixed = 0;
    },

    getChallenges(): ChallengeStatus[] {
      const challenge = (id: string, title: string, detail: string, best: number) => ({
        id,
        title,
        detail: `${detail} Mejor predicción: ${best} pts.`,
        done: best >= GOOD_PREDICTION,
        progress: best / GOOD_PREDICTION,
      });
      return [
        challenge(
          "elastico",
          "Predice un choque elástico",
          `Con restitución 1, acierta las dos velocidades finales (${GOOD_PREDICTION} pts o más).`,
          bestElastic,
        ),
        challenge(
          "plastico",
          "Predice un choque plástico",
          "Con restitución 0 quedan pegados: ¿a qué velocidad siguen juntos?",
          bestPlastic,
        ),
        challenge(
          "mixto",
          "Masas distintas, choque a medias",
          "Restitución entre 0.2 y 0.8 y masas que difieran en 1 kg o más.",
          bestMixed,
        ),
      ];
    },

    getState(): AIContext {
      return {
        experimentName: "Colisiones 1D",
        disciplineName: "Física",
        variables: lastVariables,
        result: collisionResult
          ? {
              velocidad_1_final_ms: Number(collisionResult.v1.toFixed(2)),
              velocidad_2_final_ms: Number(collisionResult.v2.toFixed(2)),
              energia_perdida_pct: Number(
                collisionResult.energyLostPct.toFixed(1),
              ),
              ...(runtime.prediction?.score != null
                ? {
                    prediccion_v1_ms: runtime.prediction.predicted.v1,
                    prediccion_v2_ms: runtime.prediction.predicted.v2,
                    puntaje_prediccion: runtime.prediction.score,
                  }
                : {}),
            }
          : undefined,
        conceptTags: [
          "conservación del momento",
          "coeficiente de restitución",
          "energía cinética",
        ],
      };
    },

    start() {
      if (runtime.phase === "moving") return;
      resetRuntime();
      runtime.vel1 = Number(lastVariables.velocity1 ?? 5);
      runtime.vel2 = Number(lastVariables.velocity2 ?? -3);
      released = { v1: runtime.vel1, v2: runtime.vel2 };
      // La predicción se congela al soltar: lo que cuenta es lo que se
      // anotó ANTES de ver el choque, no un ajuste hecho después.
      runtime.prediction = {
        predicted: {
          v1: Number(lastVariables.pred_v1 ?? 0),
          v2: Number(lastVariables.pred_v2 ?? 0),
        },
        actual: null,
        score: null,
      };
      runtime.phase = "moving";
    },

    getRuntime() {
      return runtime;
    },
  };
}