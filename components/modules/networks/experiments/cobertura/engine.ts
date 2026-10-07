import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";
import {
  POINTS,
  SITES,
  coverageOf,
  getBand,
  type Antenna,
  type Band,
  type CoverageSummary,
} from "./propagation";

/**
 * R3 · Cubre el campus — PLAN_DESARROLLO.md §3.3.
 *
 * Como Riemann o Taylor, no hay simulación en el tiempo: la cobertura es una
 * función pura de las variables. El motor la recalcula solo cuando cambian y
 * lleva la cuenta de los retos. Los retos se eligieron con una búsqueda
 * exhaustiva sobre el modelo (ver `propagation.ts`) para que los tres sean
 * posibles y ninguno trivial.
 */

/** Canales de Wi-Fi en 2.4 GHz que no se solapan entre sí. */
export const CHANNELS = ["1", "6", "11"];
export const MAX_ANTENNAS = 3;

export function antennasFrom(variables: VariablesState): Antenna[] {
  const antennas: Antenna[] = [];
  for (let i = 1; i <= MAX_ANTENNAS; i++) {
    const site = SITES.find((s) => s.id === String(variables[`antena${i}`] ?? "ninguna"));
    if (site) antennas.push({ site, channel: Number(variables[`canal${i}`] ?? CHANNELS[i - 1]) });
  }
  return antennas;
}

export interface ChallengeProgress {
  done: boolean;
  progress: number;
}

export interface CoverageRuntime {
  band: Band;
  power: number;
  antennas: Antenna[];
  summary: CoverageSummary;
  challenges: {
    campus: ChallengeProgress;
    wifi: ChallengeProgress;
    reutilizar: ChallengeProgress;
  };
}

export interface CoverageEngine extends ExperimentEngine {
  getRuntime: () => CoverageRuntime;
}

export function createCoverageEngine(): CoverageEngine {
  let lastVariables: VariablesState = {};
  let lastKey = "";

  const runtime: CoverageRuntime = {
    band: getBand("2400"),
    power: 20,
    antennas: [],
    summary: coverageOf([], getBand("2400"), 20),
    challenges: {
      campus: { done: false, progress: 0 },
      wifi: { done: false, progress: 0 },
      reutilizar: { done: false, progress: 0 },
    },
  };

  function recompute(variables: VariablesState) {
    const key = JSON.stringify(variables);
    if (key === lastKey) return;
    lastKey = key;

    runtime.band = getBand(variables.banda ?? "2400");
    runtime.power = Number(variables.potencia ?? 20);
    runtime.antennas = antennasFrom(variables);
    runtime.summary = coverageOf(runtime.antennas, runtime.band, runtime.power);

    const fraction = runtime.summary.covered / runtime.summary.total;
    const all = fraction === 1;
    const isWifi = runtime.band.id === "2400";
    const channelsUsed = new Set(runtime.antennas.map((a) => a.channel)).size;
    const reuses = runtime.antennas.length === 3 && channelsUsed === 2;

    const { campus, wifi, reutilizar } = runtime.challenges;
    // El progreso muestra la mejor fracción lograda en las condiciones de
    // cada reto: así la barra avanza mientras se acomodan las antenas.
    if (!campus.done) {
      campus.progress = Math.max(campus.progress, fraction);
      campus.done = all;
    }
    if (!wifi.done && isWifi) {
      wifi.progress = Math.max(wifi.progress, fraction);
      wifi.done = all;
    }
    if (!reutilizar.done && isWifi && reuses) {
      reutilizar.progress = Math.max(reutilizar.progress, fraction);
      reutilizar.done = all;
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      recompute(variables);
    },

    update(_dt, variables) {
      lastVariables = variables;
      recompute(variables);
    },

    reset() {
      for (const challenge of Object.values(runtime.challenges)) {
        challenge.done = false;
        challenge.progress = 0;
      }
      lastKey = "";
      recompute(lastVariables);
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // Señal en cada punto de medición, para la mini gráfica.
      return runtime.summary.perPoint.map((r, i) => ({
        x: i + 1,
        y: Number.isFinite(r.bestDbm) ? Math.max(-110, r.bestDbm) : -110,
      }));
    },

    getState(): AIContext {
      const { summary, antennas, band, power } = runtime;
      const names = (filter: (i: number) => boolean) =>
        POINTS.filter((_, i) => filter(i)).map((p) => p.name).join(", ") || "ninguno";
      const { campus, wifi, reutilizar } = runtime.challenges;
      return {
        experimentName: "Cubre el campus",
        disciplineName: "Redes",
        variables: lastVariables,
        result: {
          banda: band.label,
          potencia_dbm: power,
          antenas:
            antennas.map((a) => `${a.site.name} (canal ${a.channel})`).join(", ") ||
            "ninguna",
          puntos_cubiertos: `${summary.covered} de ${summary.total}`,
          sin_senal_suficiente: names(
            (i) => !summary.perPoint[i].covered && !summary.perPoint[i].interfered,
          ),
          con_interferencia: names((i) => summary.perPoint[i].interfered),
          reto_campus: campus.done ? "logrado" : "pendiente",
          reto_wifi_2_4: wifi.done ? "logrado" : "pendiente",
          reto_reutilizar_canales: reutilizar.done ? "logrado" : "pendiente",
        },
        conceptTags: [
          "pérdida de trayecto",
          "presupuesto de enlace",
          "atenuación por obstáculos",
          "interferencia cocanal",
          "reutilización de frecuencias",
        ],
      };
    },
  };
}
