import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export type CollisionPhase = "idle" | "moving" | "collided";

export interface CollisionRuntime {
  phase: CollisionPhase;
  pos1: number;
  pos2: number;
  vel1: number;
  vel2: number;
}

export interface CollisionEngine extends ExperimentEngine {
  start: () => void;
  getRuntime: () => CollisionRuntime;
}

const START_X1 = -6;
const START_X2 = 6;
const BASE_HALF_WIDTH = 0.3;
const WIDTH_PER_MASS = 0.05;

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
 * su masa), se resuelve el choque una sola vez con la fórmula de
 * restitución, y después los carritos siguen moviéndose a sus nuevas
 * velocidades — no hay una segunda colisión simulada en este primer
 * experimento (alcanza para mostrar el concepto).
 */
export function createCollisionEngine(): CollisionEngine {
  let lastVariables: VariablesState = {};
  let collisionResult: CollisionResult | null = null;

  const runtime: CollisionRuntime = {
    phase: "idle",
    pos1: START_X1,
    pos2: START_X2,
    vel1: 0,
    vel2: 0,
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

      if (runtime.phase === "moving") {
        const m1 = Number(variables.mass1 ?? 1);
        const m2 = Number(variables.mass2 ?? 1);
        const gap = runtime.pos2 - runtime.pos1;
        const minGap = halfWidth(m1) + halfWidth(m2);

        if (gap <= minGap) {
          const overlap = minGap - gap;
          runtime.pos1 -= overlap / 2;
          runtime.pos2 += overlap / 2;

          const e = Number(variables.restitution ?? 1);
          const v1 = runtime.vel1;
          const v2 = runtime.vel2;

          const v1f = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
          const v2f = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2);

          const keBefore = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
          const keAfter = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
          const energyLostPct =
            keBefore > 0 ? ((keBefore - keAfter) / keBefore) * 100 : 0;

          runtime.vel1 = v1f;
          runtime.vel2 = v2f;
          runtime.phase = "collided";
          collisionResult = { v1: v1f, v2: v2f, energyLostPct };
        }
      }
    },

    reset() {
      resetRuntime();
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
      runtime.phase = "moving";
    },

    getRuntime() {
      return runtime;
    },
  };
}