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

/**
 * Motor de tiro parabólico, con resistencia del aire opcional (arrastre
 * lineal).
 *
 * Física:
 *   vx0 = v0 * cos(angulo)
 *   vy0 = v0 * sin(angulo)
 *   cada paso: ax = -k*vx ; ay = -g - k*vy ; vx += ax*dt ; vy += ay*dt
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

  const runtime: ProjectileRuntime = {
    phase: "idle",
    position: { x: launch.x, y: launch.y },
    trail: [],
    range: 0,
    maxHeight: 0,
    flightTime: 0,
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

  return {
    init(variables) {
      lastVariables = variables;
      resetRuntime();
    },

    update(dt, variables) {
      lastVariables = variables;
      if (runtime.phase !== "flying") return;

            const g = Number(variables.gravity ?? 9.81);
      const k = Number(variables.drag ?? 0);

      // Symplectic Euler: actualiza velocidad primero, luego posición.
      // Es estable para este tipo de simulación con paso fijo pequeño.
      const ax = -k * velocity.x;
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