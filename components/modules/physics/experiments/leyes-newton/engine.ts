import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * Motor de "Ley de la fuerza (2da de Newton)": fricción estática y cinética y
 * diagrama de cuerpo libre, en un plano inclinado o con una polea.
 *
 * Plano (eje a lo largo de la rampa, positivo hacia abajo):
 *   lo que empuja hacia abajo es D = mg·sen θ − F (F positiva hacia arriba);
 *   la fricción estática aguanta hasta μs·N, con N = mg·cos θ;
 *   si |D| ≤ μs·N la caja no se mueve y la fricción vale exactamente D;
 *   si no, resbala hacia donde empuja D y la fricción pasa a μk·N en contra.
 *
 * Polea (caja m1 en la mesa, pesa m2 colgando):
 *   se mueve si m2·g > μs·m1·g; entonces a = (m2·g − μk·m1·g)/(m1 + m2) y
 *   la tensión es T = m2·(g − a). Quieta, T = m2·g.
 *
 * La fricción estática no es "siempre μs·N": es la que haga falta, hasta ese
 * tope. Es la confusión que más se repite y por eso el motor la reporta así.
 */

export const G = 9.81;
/** Largo útil de la rampa y de la mesa, m. */
export const RAMP_LENGTH = 4;
/** Dónde arranca la caja, medido desde abajo de la rampa, m. */
export const START_S = 2;
export const TABLE_RUN = 1.6;

export interface Surface {
  id: string;
  label: string;
  mus: number;
  muk: number;
}

export const SURFACES: Surface[] = [
  { id: "madera", label: "Madera sobre madera", mus: 0.5, muk: 0.3 },
  { id: "acero", label: "Acero sobre acero", mus: 0.74, muk: 0.57 },
  { id: "caucho", label: "Caucho sobre concreto", mus: 1.0, muk: 0.8 },
  { id: "hielo", label: "Hielo", mus: 0.1, muk: 0.03 },
];

export function getSurface(id: unknown): Surface {
  return SURFACES.find((s) => s.id === id) ?? SURFACES[0];
}

export type Scenario = "plano" | "polea";

export interface Config {
  scenario: Scenario;
  angleDeg: number;
  m: number;
  m2: number;
  surface: Surface;
  force: number;
}

export function configOf(variables: VariablesState): Config {
  return {
    scenario: variables.escenario === "polea" ? "polea" : "plano",
    angleDeg: Number(variables.angulo ?? 20),
    m: Number(variables.masa ?? 10),
    m2: Number(variables.masa_colgante ?? 3),
    surface: getSurface(variables.superficie),
    force: Number(variables.fuerza ?? 0),
  };
}

/** Todas las fuerzas del diagrama, en N, y lo que resulta. */
export interface Forces {
  weight: number;
  /** Componentes del peso: a lo largo de la rampa (hacia abajo) y contra ella. */
  weightAlong: number;
  weightPerp: number;
  normal: number;
  /** Fricción, con signo en el eje del movimiento (negativa: hacia arriba de la rampa / hacia atrás). */
  friction: number;
  staticMax: number;
  kinetic: number;
  applied: number;
  tension: number;
  /** Suma de fuerzas en el eje del movimiento, N. */
  net: number;
  moves: boolean;
  /** +1 hacia abajo de la rampa (o hacia la polea), −1 hacia arriba, 0 quieta. */
  direction: number;
  /** Magnitud de la aceleración, m/s². */
  acceleration: number;
  /** Lo que empuja antes de la fricción (D en el plano, m2·g en la polea), N. */
  driving: number;
}

export function forcesOf(c: Config): Forces {
  const theta = (c.angleDeg * Math.PI) / 180;
  if (c.scenario === "polea") {
    const weight = c.m * G;
    const normal = weight;
    const staticMax = c.surface.mus * normal;
    const kinetic = c.surface.muk * normal;
    const driving = c.m2 * G;
    const moves = driving > staticMax;
    const acceleration = moves ? (driving - kinetic) / (c.m + c.m2) : 0;
    const tension = c.m2 * (G - acceleration);
    const friction = moves ? -kinetic : -driving;
    return {
      weight, weightAlong: 0, weightPerp: weight, normal, friction, staticMax, kinetic,
      applied: 0, tension, net: (c.m + c.m2) * acceleration, moves, direction: moves ? 1 : 0,
      acceleration, driving,
    };
  }
  const weight = c.m * G;
  const weightAlong = weight * Math.sin(theta);
  const weightPerp = weight * Math.cos(theta);
  const normal = weightPerp;
  const staticMax = c.surface.mus * normal;
  const kinetic = c.surface.muk * normal;
  const driving = weightAlong - c.force;
  // Un margen mínimo: con tan θ = μs justo (caucho a 45°) el redondeo no
  // debería decidir si la caja se mueve.
  const moves = Math.abs(driving) > staticMax + 1e-9;
  const direction = moves ? Math.sign(driving) : 0;
  const friction = moves ? -direction * kinetic : -driving;
  const net = driving + friction;
  return {
    weight, weightAlong, weightPerp, normal, friction, staticMax, kinetic,
    applied: c.force, tension: 0, net, moves, direction,
    acceleration: Math.abs(net) / c.m, driving,
  };
}

/** El ángulo donde la caja empieza a resbalar sola: tan θ = μs. */
export function criticalAngle(surface: Surface): number {
  return (Math.atan(surface.mus) * 180) / Math.PI;
}

export type Phase = "idle" | "moving" | "stopped";

export interface Release {
  config: Config;
  forces: Forces;
  predictedMoves: boolean;
  predictedA: number;
  movesRight: boolean;
  /** Error relativo de la aceleración (null si no se mueve). */
  aError: number | null;
}

export interface NewtonRuntime {
  phase: Phase;
  /** Posición a lo largo del camino: en el plano, desde abajo de la rampa; en la polea, cuánto avanzó. */
  s: number;
  v: number;
  /** Las fuerzas que se dibujan: las del intento si está en curso, si no las de las variables. */
  forces: Forces;
  config: Config;
  last: Release | null;
}

export interface NewtonEngine extends ExperimentEngine {
  release: () => void;
  getRuntime: () => NewtonRuntime;
}

const sameConfig = (a: Config, b: Config) =>
  a.scenario === b.scenario &&
  a.surface.id === b.surface.id &&
  Math.abs(a.angleDeg - b.angleDeg) < 1e-6 &&
  Math.abs(a.m - b.m) < 1e-6 &&
  Math.abs(a.force - b.force) < 1e-6 &&
  (a.scenario === "plano" || Math.abs(a.m2 - b.m2) < 1e-6);

export function createNewtonEngine(): NewtonEngine {
  let lastVariables: VariablesState = {};
  const initialConfig = configOf({});
  const runtime: NewtonRuntime = {
    phase: "idle",
    s: START_S,
    v: 0,
    forces: forcesOf(initialConfig),
    config: initialConfig,
    last: null,
  };

  // Retos.
  /** Predicciones de movimiento acertadas seguidas, en situaciones distintas. */
  let streak: Release[] = [];
  let moveDone = false;
  let accelDone = false;
  let criticalDone = false;
  let pushDone = false;
  let pulleyDone = false;
  let bestAError: number | null = null;
  /** La caja quieta justo por debajo del ángulo crítico, esperando el grado de más. */
  let criticalCandidate: { surface: string; angle: number } | null = null;

  function rest() {
    runtime.phase = "idle";
    runtime.s = runtime.config.scenario === "plano" ? START_S : 0;
    runtime.v = 0;
  }

  function score(r: Release) {
    const { config: c, forces: f } = r;

    // ¿Se mueve o no? Tres aciertos seguidos en situaciones distintas, con al
    // menos una en que la caja se queda quieta.
    if (r.movesRight) {
      if (!streak.some((s) => sameConfig(s.config, c))) streak.push(r);
      if (streak.length >= 3 && streak.some((s) => !s.forces.moves)) moveDone = true;
    } else {
      streak = [];
    }

    if (r.aError !== null) {
      bestAError = bestAError === null ? r.aError : Math.min(bestAError, r.aError);
      if (r.aError < 0.05) {
        if (c.scenario === "plano") accelDone = true;
        else pulleyDone = true;
      }
    }

    if (c.scenario === "plano" && Math.abs(c.force) < 1e-9) {
      const critical = criticalAngle(c.surface);
      if (
        criticalCandidate &&
        criticalCandidate.surface === c.surface.id &&
        f.moves &&
        Math.abs(c.angleDeg - (criticalCandidate.angle + 1)) < 1e-6
      ) {
        criticalDone = true;
      }
      if (!f.moves && critical - c.angleDeg >= -1e-9 && critical - c.angleDeg < 1) {
        criticalCandidate = { surface: c.surface.id, angle: c.angleDeg };
      }
    }

    // La fuerza justa para subirla: lo que tira hacia abajo más la fricción
    // estática máxima, con 2 N de margen.
    if (c.scenario === "plano" && f.moves && f.direction < 0) {
      const minimum = f.weightAlong + f.staticMax;
      if (c.force - minimum <= 2) pushDone = true;
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      runtime.config = configOf(variables);
      runtime.forces = forcesOf(runtime.config);
      rest();
    },

    update(dt, variables) {
      lastVariables = variables;
      if (runtime.phase === "idle") {
        const next = configOf(variables);
        if (next.scenario !== runtime.config.scenario) {
          runtime.config = next;
          rest();
        }
        runtime.config = next;
        runtime.forces = forcesOf(next);
        return;
      }
      if (runtime.phase !== "moving") return;

      const f = runtime.forces;
      if (!f.moves) {
        runtime.phase = "stopped";
        return;
      }
      runtime.v += f.acceleration * dt;
      if (runtime.config.scenario === "plano") {
        // s crece hacia arriba de la rampa; "hacia abajo" es restar.
        runtime.s -= f.direction * runtime.v * dt;
        if (runtime.s <= 0.3 || runtime.s >= RAMP_LENGTH - 0.3) {
          runtime.s = Math.min(RAMP_LENGTH - 0.3, Math.max(0.3, runtime.s));
          runtime.phase = "stopped";
        }
      } else {
        runtime.s += runtime.v * dt;
        if (runtime.s >= TABLE_RUN) {
          runtime.s = TABLE_RUN;
          runtime.phase = "stopped";
        }
      }
    },

    release() {
      if (runtime.phase === "moving") return;
      const config = configOf(lastVariables);
      runtime.config = config;
      runtime.forces = forcesOf(config);
      rest();
      // Las predicciones se congelan al soltar, como en colisiones.
      const predictedMoves = lastVariables.pred_se_mueve === "si";
      const predictedA = Number(lastVariables.prediccion_a ?? 0);
      const f = runtime.forces;
      const release: Release = {
        config,
        forces: f,
        predictedMoves,
        predictedA,
        movesRight: predictedMoves === f.moves,
        aError: f.moves && f.acceleration > 1e-9 ? Math.abs(predictedA - f.acceleration) / f.acceleration : null,
      };
      runtime.last = release;
      runtime.phase = "moving";
      score(release);
    },

    reset() {
      runtime.config = configOf(lastVariables);
      runtime.forces = forcesOf(runtime.config);
      rest();
    },

    resetChallenges() {
      streak = [];
      moveDone = false;
      accelDone = false;
      criticalDone = false;
      pushDone = false;
      pulleyDone = false;
      bestAError = null;
      criticalCandidate = null;
    },

    getRuntime() {
      return runtime;
    },

    getChallenges(): ChallengeStatus[] {
      const streakStill = streak.some((s) => !s.forces.moves);
      return [
        {
          id: "se-mueve",
          title: "¿Se mueve o no?",
          detail: moveDone
            ? "Tres predicciones seguidas bien hechas."
            : `Predice si se mueve en tres situaciones distintas seguidas, al menos una quieta. Vas ${Math.min(3, streak.length)} de 3${streak.length > 0 && !streakStill ? ", falta una quieta" : ""}.`,
          done: moveDone,
          progress: moveDone ? 1 : Math.min(3, streak.length) / 3,
        },
        {
          id: "aceleracion",
          title: "Predice la aceleración",
          detail: "En el plano, con la caja resbalando, acierta la aceleración con error menor al 5 %.",
          done: accelDone,
          progress: accelDone ? 1 : 0,
        },
        {
          id: "angulo-critico",
          title: "El ángulo crítico",
          detail: criticalDone
            ? "Encontraste el ángulo donde empieza a resbalar."
            : criticalCandidate
              ? `Quieta a ${criticalCandidate.angle}°. Sube un grado y suéltala.`
              : "Sin fuerza aplicada, deja la caja quieta a menos de 1° del ángulo crítico; luego sube 1° y que resbale.",
          done: criticalDone,
          progress: criticalDone ? 1 : criticalCandidate ? 0.5 : 0,
        },
        {
          id: "empuja",
          title: "Súbela con lo justo",
          detail: "Haz subir la caja con la fuerza mínima, a 2 N o menos de lo justo.",
          done: pushDone,
          progress: pushDone ? 1 : 0,
        },
        {
          id: "polea",
          title: "La pesa que tira",
          detail: "Con la polea, acierta la aceleración con error menor al 5 %.",
          done: pulleyDone,
          progress: pulleyDone ? 1 : 0,
        },
      ];
    },

    getState(): AIContext {
      const { config: c, forces: f, last } = runtime;
      const n = (x: number) => Number(x.toFixed(2));
      const result: Record<string, number | string> = {
        escenario: c.scenario === "plano" ? "plano inclinado" : "polea",
        superficie: `${c.surface.label} (μs ${c.surface.mus}, μk ${c.surface.muk})`,
        peso_n: n(f.weight),
        normal_n: n(f.normal),
      };
      if (c.scenario === "plano") {
        result.peso_a_lo_largo_n = n(f.weightAlong);
        result.peso_contra_la_rampa_n = n(f.weightPerp);
        result.fuerza_aplicada_n = c.force;
        result.friccion_estatica_maxima_n = n(f.staticMax);
      } else {
        result.peso_de_la_pesa_n = n(f.driving);
        result.friccion_estatica_maxima_n = n(f.staticMax);
        result.tension_n = n(f.tension);
      }
      result.estado = runtime.phase === "idle" ? "sin soltar" : runtime.phase === "moving" ? "soltada" : "detenida";
      if (last) {
        result.ultimo_intento_se_mueve = last.forces.moves
          ? last.forces.direction > 0
            ? c.scenario === "plano" ? "sí, baja" : "sí"
            : "sí, sube"
          : "no";
        result.ultimo_intento_aceleracion_ms2 = n(last.forces.acceleration);
        result.ultimo_intento_friccion_n = n(Math.abs(last.forces.friction));
        result.ultimo_intento_fuerza_neta_n = n(Math.abs(last.forces.net));
        result.prediccion_se_mueve = last.predictedMoves ? "sí" : "no";
        result.prediccion_acertada = last.movesRight ? "sí" : "no";
        result.prediccion_aceleracion_ms2 = last.predictedA;
        if (last.aError !== null) result.error_aceleracion_pct = Number((last.aError * 100).toFixed(1));
      }
      return {
        experimentName: "Ley de la fuerza (2da de Newton)",
        disciplineName: "Física",
        variables: lastVariables,
        result,
        conceptTags: ["segunda ley de Newton", "fricción estática", "fricción cinética", "diagrama de cuerpo libre", "plano inclinado", "tensión"],
      };
    },
  };
}
