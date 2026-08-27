import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

const DEG = Math.PI / 180;
const GROUND_Y = 0;

export type ProjectilePhase = "idle" | "flying" | "landed";

export interface ProjectileRuntime {
  phase: ProjectilePhase;
  position: { x: number; y: number };
  trail: Array<{ x: number; y: number }>;
  range: number;
  maxHeight: number;
  flightTime: number;
}

// Extiende el contrato base (ExperimentEngine) con lo que necesita
// específicamente este experimento: disparar y leer el estado en vivo.
export interface ProjectileEngine extends ExperimentEngine {
  fire: () => void;
  getRuntime: () => ProjectileRuntime;
}

/**
 * Motor de tiro parabólico.
 *
 * Física: caída libre con velocidad inicial en ángulo.
 *   vx0 = v0 * cos(angulo)
 *   vy0 = v0 * sin(angulo)
 *   cada paso: vy -= g * dt ; x += vx * dt ; y += vy * dt
 *
 * Se integra con un delta de tiempo FIJO que nos da el shell
 * (useFixedTimestep), no con el framerate real del navegador.
 */
export function createProjectileEngine(): ProjectileEngine {
  let lastVariables: VariablesState = {};
  let time = 0;
  let velocity = { x: 0, y: 0 };

  const runtime: ProjectileRuntime = {
    phase: "idle",
    position: { x: 0, y: GROUND_Y },
    trail: [],
    range: 0,
    maxHeight: 0,
    flightTime: 0,
  };

  function resetRuntime() {
    time = 0;
    velocity = { x: 0, y: 0 };
    runtime.phase = "idle";
    runtime.position = { x: 0, y: GROUND_Y };
    runtime.trail = [];
    runtime.range = 0;
    runtime.maxHeight = 0;
    runtime.flightTime = 0;
  }

  return {
    init(variables) {
      lastVariables = variables;
      resetRuntime();
    },

    update(dt, variables) {
      lastVariables = variables;
      if (runtime.phase !== "flying") return;

      const g = Number(variables.gravity ?? 9.81);

      // Symplectic Euler: actualiza velocidad primero, luego posición.
      // Es estable para este tipo de simulación con paso fijo pequeño.
      velocity.y -= g * dt;
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
        runtime.range = runtime.position.x;
        runtime.flightTime = time;
      }
    },

    reset() {
      resetRuntime();
    },

    getState(): AIContext {
      return {
        experimentName: "Tiro parabólico",
        disciplineName: "Física",
        variables: lastVariables,
        result:
          runtime.phase === "landed"
            ? {
                alcance_m: Number(runtime.range.toFixed(2)),
                altura_maxima_m: Number(runtime.maxHeight.toFixed(2)),
                tiempo_vuelo_s: Number(runtime.flightTime.toFixed(2)),
              }
            : undefined,
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
  };
}