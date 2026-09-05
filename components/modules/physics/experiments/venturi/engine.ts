import type {
  AIContext,
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
}

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
 * Igual que en los experimentos de cálculo, acá no hay simulación en el
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
  };

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

    getRuntime() {
      return runtime;
    },
  };
}
