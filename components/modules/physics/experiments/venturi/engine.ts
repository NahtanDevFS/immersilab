import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export interface Fluid {
  id: string;
  label: string;
  /** Densidad, kg/m³. */
  rho: number;
  /** Presión de vapor a temperatura ambiente, Pa. Debajo de esto, cavita. */
  vapor: number;
  color: string;
}

/**
 * Los tres fluidos del experimento. La presión de vapor es la que decide
 * cuándo aparece la cavitación, que es el "castigo" del juego: por eso el
 * aceite aguanta muchísimo más estrangulamiento que el agua, y el aire
 * directamente no cavita (no hay líquido que hierva).
 */
export const FLUIDS: Fluid[] = [
  { id: "agua", label: "Agua (20 °C)", rho: 998, vapor: 2340, color: "#2dd4bf" },
  { id: "aceite", label: "Aceite liviano", rho: 870, vapor: 20, color: "#f2a65a" },
  { id: "aire", label: "Aire", rho: 1.2, vapor: 0, color: "#9fd8ff" },
];

export function getFluid(id: string | number | boolean): Fluid {
  return FLUIDS.find((f) => f.id === String(id)) ?? FLUIDS[0];
}

export interface VenturiRuntime {
  /** Velocidad en el tramo ancho y en el cuello, m/s. */
  v1: number;
  v2: number;
  /** Presiones absolutas, Pa. */
  p1: number;
  p2: number;
  /** Caída de presión en el cuello respecto del tramo ancho, Pa. */
  drop: number;
  /** El líquido hierve en el cuello: la presión bajó de su presión de vapor. */
  cavitating: boolean;
  /** Reynolds en el cuello — decide si el flujo es laminar o turbulento. */
  reynolds: number;
  /** Fase del reloj de partículas, para animar el flujo en la escena. */
  flowPhase: number;
  challenges: Record<ChallengeId, ChallengeProgress>;
}

type ChallengeId = "nueve" | "borde" | "laminar";

interface ChallengeProgress {
  done: boolean;
  progress: number;
  /** Segundos seguidos cumpliendo la condición. */
  held: number;
  /** Cómo salió, para mostrarlo una vez logrado. */
  result: string;
}

/**
 * Hay que sostener la condición este tiempo para que cuente. El resultado
 * no depende del tiempo, pero sin esto un reto se lograría "de pasada" al
 * arrastrar un slider por encima del valor justo, sin entender nada.
 */
const HOLD_SECONDS = 1;

/** Reto de continuidad: el cuello a un tercio del radio → 9 veces más rápido. */
const SPEED_RATIO_TARGET = 9;
const SPEED_RATIO_TOLERANCE = 0.03;

/**
 * Reto de Bernoulli: presión absoluta del cuello por debajo de esto, pero
 * sin cavitar. Calibrado sobre la grilla de los sliders: con agua hay unas
 * 10 combinaciones de caudal y cuello que lo logran (más o menos una por
 * cada radio angosto), así que se encuentra ajustando, no de casualidad.
 */
const EDGE_PRESSURE = 30000;

/** Debajo de este Reynolds el flujo es laminar. Con agua es imposible en el
 *  rango de los sliders: hay que darse cuenta de que el fluido importa. */
const LAMINAR_REYNOLDS = 2300;

export interface VenturiEngine extends ExperimentEngine {
  getRuntime: () => VenturiRuntime;
}

/** Radio del tramo ancho, en metros. Fijo: lo que el jugador estrangula es
 *  el cuello, y con los dos radios sueltos el experimento se vuelve un
 *  juego de dos variables acopladas donde no se entiende cuál hizo qué. */
export const PIPE_RADIUS = 0.06;

/** Presión de entrada, Pa (absoluta). Una bomba doméstica típica. */
const INLET_PRESSURE = 300000;

/** Viscosidad cinemática aproximada, m²/s, para el número de Reynolds. */
const KINEMATIC_VISCOSITY: Record<string, number> = {
  agua: 1.0e-6,
  aceite: 4.6e-5,
  aire: 1.5e-5,
};

const area = (radius: number) => Math.PI * radius * radius;

/**
 * Motor del tubo de Venturi.
 *
 * Física, en dos ecuaciones que el experimento quiere que se vean actuando
 * juntas:
 *
 *   Continuidad:  A₁·v₁ = A₂·v₂          (lo que entra, sale)
 *   Bernoulli:    p + ½·ρ·v² + ρ·g·h = constante
 *
 * De ahí sale lo contraintuitivo, que es todo el punto: al angostar el tubo
 * el fluido se ACELERA, y como la suma tiene que mantenerse, la presión BAJA
 * justo donde va más rápido. La intuición de la mayoría dice lo contrario
 * ("si aprieto, la presión sube").
 *
 * Igual que en los experimentos de cálculo, aquí no hay simulación en el
 * tiempo: el resultado depende solo de las variables, así que se recalcula
 * cuando alguna cambia y no 60 veces por segundo. Lo único que avanza por
 * frame es la fase del flujo, que es puramente visual.
 */
export function createVenturiEngine(): VenturiEngine {
  let lastVariables: VariablesState = {};
  let signature = "";

  const runtime: VenturiRuntime = {
    v1: 0,
    v2: 0,
    p1: INLET_PRESSURE,
    p2: INLET_PRESSURE,
    drop: 0,
    cavitating: false,
    reynolds: 0,
    flowPhase: 0,
    challenges: {
      nueve: { done: false, progress: 0, held: 0, result: "" },
      borde: { done: false, progress: 0, held: 0, result: "" },
      laminar: { done: false, progress: 0, held: 0, result: "" },
    },
  };

  /**
   * Avanza un reto: `closeness` (0–1) alimenta la barra mientras no se
   * cumple; si se cumple, cuenta el tiempo sostenido hasta HOLD_SECONDS.
   */
  function track(id: ChallengeId, met: boolean, closeness: number, dt: number, result: string) {
    const c = runtime.challenges[id];
    if (c.done) return;
    if (met) {
      c.held += dt;
      c.progress = Math.min(1, 0.9 + (0.1 * c.held) / HOLD_SECONDS);
      if (c.held >= HOLD_SECONDS) {
        c.done = true;
        c.progress = 1;
        c.result = result;
      }
    } else {
      c.held = 0;
      c.progress = Math.max(0, Math.min(0.85, closeness));
    }
  }

  function updateChallenges(dt: number) {
    const fluid = getFluid(lastVariables.fluido ?? "agua");
    const throat = Number(lastVariables.cuello ?? 0.03);
    // "Agua (20 °C)" → "agua": sin el paréntesis, que en minúsculas queda "°c".
    const name = fluid.label.split(" (")[0].toLowerCase();

    const ratio = runtime.v1 > 0 ? runtime.v2 / runtime.v1 : 1;
    const ratioError = Math.abs(ratio - SPEED_RATIO_TARGET) / SPEED_RATIO_TARGET;
    track(
      "nueve",
      ratioError <= SPEED_RATIO_TOLERANCE,
      1 - ratioError,
      dt,
      `Cuello de ${(throat * 100).toFixed(1)} cm: un tercio del radio, ${ratio.toFixed(1)} veces más rápido.`,
    );

    const liquid = fluid.id !== "aire";
    track(
      "borde",
      liquid && !runtime.cavitating && runtime.p2 < EDGE_PRESSURE,
      liquid && !runtime.cavitating
        ? (INLET_PRESSURE - runtime.p2) / (INLET_PRESSURE - EDGE_PRESSURE)
        : 0,
      dt,
      `${(runtime.p2 / 1000).toFixed(1)} kPa en el cuello con ${name}, sin cavitar.`,
    );

    track(
      "laminar",
      runtime.reynolds < LAMINAR_REYNOLDS,
      runtime.reynolds > 0 ? LAMINAR_REYNOLDS / runtime.reynolds : 0,
      dt,
      `Re = ${Math.round(runtime.reynolds)} con ${name}.`,
    );
  }

  function recompute(variables: VariablesState) {
    const fluid = getFluid(variables.fluido ?? "agua");
    // El caudal se pide en litros por segundo porque es la unidad en la que
    // viene rotulada cualquier bomba; adentro se trabaja en m³/s.
    const flow = Number(variables.caudal ?? 8) / 1000;
    const throatRadius = Number(variables.cuello ?? 0.03);

    const a1 = area(PIPE_RADIUS);
    const a2 = area(Math.max(throatRadius, 0.002));

    const v1 = flow / a1;
    const v2 = flow / a2;

    // Bernoulli entre los dos tramos, a la misma altura: toda la energía que
    // gana en velocidad la paga en presión.
    const p1 = INLET_PRESSURE;
    const p2 = p1 + 0.5 * fluid.rho * (v1 * v1 - v2 * v2);

    const nu = KINEMATIC_VISCOSITY[fluid.id] ?? 1e-6;
    const reynolds = (v2 * 2 * Math.max(throatRadius, 0.002)) / nu;

    runtime.v1 = v1;
    runtime.v2 = v2;
    runtime.p1 = p1;
    runtime.p2 = p2;
    runtime.drop = p1 - p2;
    // El aire no cavita: no hay líquido que pueda hervir.
    runtime.cavitating = fluid.id !== "aire" && p2 < fluid.vapor;
    runtime.reynolds = reynolds;
  }

  return {
    init(variables) {
      lastVariables = variables;
      signature = JSON.stringify(variables);
      recompute(variables);
    },

    update(dt, variables) {
      lastVariables = variables;
      const next = JSON.stringify(variables);
      if (next !== signature) {
        signature = next;
        recompute(variables);
      }

      // Lo único que sí avanza en el tiempo: el reloj con el que la escena
      // mueve las partículas. Se mantiene acotado para que no pierda
      // precisión después de un rato largo abierto.
      runtime.flowPhase = (runtime.flowPhase + dt) % 1000;
      updateChallenges(dt);
    },

    reset() {
      runtime.flowPhase = 0;
      recompute(lastVariables);
    },

    getState(): AIContext {
      const fluid = getFluid(lastVariables.fluido ?? "agua");
      return {
        experimentName: "Tubo de Venturi",
        disciplineName: "Física",
        variables: lastVariables,
        result: {
          velocidad_tubo_ms: Number(runtime.v1.toFixed(2)),
          velocidad_cuello_ms: Number(runtime.v2.toFixed(2)),
          presion_cuello_kpa: Number((runtime.p2 / 1000).toFixed(1)),
          caida_de_presion_kpa: Number((runtime.drop / 1000).toFixed(1)),
          reynolds: Math.round(runtime.reynolds),
          regimen: runtime.reynolds < 2300 ? "laminar" : "turbulento",
          fluido: fluid.label,
          ...(runtime.cavitating ? { alerta: "¡Cavitación!" } : {}),
        },
        conceptTags: [
          "ecuación de continuidad",
          "principio de Bernoulli",
          "presión dinámica",
          "cavitación",
          "número de Reynolds",
        ],
      };
    },

    getChallenges(): ChallengeStatus[] {
      const { nueve, borde, laminar } = runtime.challenges;
      const view = (c: ChallengeProgress, hint: string) => ({
        done: c.done,
        progress: c.progress,
        detail: c.done ? c.result : hint,
      });
      return [
        {
          id: "nueve",
          title: "Nueve veces más rápido",
          ...view(nueve, "Que el fluido vaya 9 veces más rápido en el cuello que en el tubo."),
        },
        {
          id: "borde",
          title: "Al borde de la cavitación",
          ...view(
            borde,
            "Con un líquido, baja la presión del cuello a menos de 30 kPa sin que cavite.",
          ),
        },
        {
          id: "laminar",
          title: "Flujo laminar",
          ...view(laminar, "Que el flujo en el cuello sea laminar (Reynolds menor que 2300)."),
        },
      ];
    },

    resetChallenges() {
      Object.values(runtime.challenges).forEach((c) => {
        c.done = false;
        c.progress = 0;
        c.held = 0;
        c.result = "";
      });
    },

    getRuntime() {
      return runtime;
    },
  };
}
