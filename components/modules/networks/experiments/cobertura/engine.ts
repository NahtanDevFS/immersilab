import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";
import {
  ANTENNA_GAIN_DB,
  METERS_PER_UNIT,
  PATH_LOSS_EXPONENT,
  PEAK_HOUR,
  POINTS,
  SENSITIVITY_DBM,
  SITES,
  buildingsBetween,
  fsplDb,
  pathLossDb,
  coverageOf,
  getBand,
  loadOf,
  totalDemandMbps,
  type Antenna,
  type Band,
  type CoverageSummary,
  type LoadSummary,
} from "./propagation";

/**
 * R3 · Cubre el campus — PLAN_DESARROLLO.md §3.3.
 *
 * Como Riemann, no hay simulación en el tiempo: la cobertura y la carga son
 * una función pura de las variables. El motor las recalcula solo cuando
 * cambian y lleva la cuenta de los retos. Los retos se eligieron con una
 * búsqueda exhaustiva sobre el modelo (ver `propagation.ts`) para que todos
 * sean posibles y ninguno trivial.
 */

/** Canales de Wi-Fi en 2.4 GHz que no se solapan entre sí. */
export const CHANNELS = ["1", "6", "11"];
export const MAX_ANTENNAS = 3;
export const DEFAULT_HOUR = 13;

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
  hour: number;
  antennas: Antenna[];
  summary: CoverageSummary;
  load: LoadSummary;
  challenges: {
    campus: ChallengeProgress;
    wifi: ChallengeProgress;
    reutilizar: ChallengeProgress;
    horaPico: ChallengeProgress;
  };
}

export interface CoverageEngine extends ExperimentEngine {
  getRuntime: () => CoverageRuntime;
}

/**
 * Para el tutor: el presupuesto de enlace ya hecho, punto por punto, con la
 * antena que mejor llega. Las fórmulas están en las pistas, pero el modelo
 * de voz no sabía la distancia ni los edificios de cada punto y esquivaba
 * la cuenta.
 */
function coverageNotes(antennas: Antenna[], band: Band, power: number): Record<string, string> {
  const at1m = fsplDb(1 / METERS_PER_UNIT, band.mhz);
  const notes: Record<string, string> = {
    formula_con_los_valores_actuales:
      `potencia recibida = ${power} dBm + ${ANTENNA_GAIN_DB} dB de antenas − pérdida de trayecto − ${band.buildingLossDb} dB por edificio; ` +
      `pérdida de trayecto = ${at1m.toFixed(1)} dB (espacio libre a 1 m en ${band.label}) + 10 · ${PATH_LOSS_EXPONENT} · log₁₀(d en m); ` +
      `por ejemplo a 100 m: ${pathLossDb(100 / METERS_PER_UNIT, band.mhz).toFixed(1)} dB; se cubre con ${SENSITIVITY_DBM} dBm o más`,
  };
  if (antennas.length === 0) return notes;
  notes.cada_punto = POINTS.map((point) => {
    const options = antennas.map((a, index) => {
      const d = Math.hypot(point.x - a.site.x, point.z - a.site.z);
      const walls = buildingsBetween(a.site.x, a.site.z, point.x, point.z);
      const dbm = power + ANTENNA_GAIN_DB - pathLossDb(d, band.mhz) - walls * band.buildingLossDb;
      return { dbm, meters: d * METERS_PER_UNIT, walls, index };
    });
    const b = options.reduce((x, y) => (y.dbm > x.dbm ? y : x));
    return `${point.name}: ${b.dbm.toFixed(1)} dBm (antena ${b.index + 1}, a ${Math.round(b.meters)} m, ${b.walls} edificio${b.walls === 1 ? "" : "s"} en medio)`;
  }).join("; ");
  return notes;
}

export function createCoverageEngine(): CoverageEngine {
  let lastVariables: VariablesState = {};
  let lastKey = "";

  const emptySummary = coverageOf([], getBand("2400"), 20);
  const runtime: CoverageRuntime = {
    band: getBand("2400"),
    power: 20,
    hour: DEFAULT_HOUR,
    antennas: [],
    summary: emptySummary,
    load: loadOf([], getBand("2400"), emptySummary.perPoint, DEFAULT_HOUR),
    challenges: {
      campus: { done: false, progress: 0 },
      wifi: { done: false, progress: 0 },
      reutilizar: { done: false, progress: 0 },
      horaPico: { done: false, progress: 0 },
    },
  };

  function recompute(variables: VariablesState) {
    const key = JSON.stringify(variables);
    if (key === lastKey) return;
    lastKey = key;

    runtime.band = getBand(variables.banda ?? "2400");
    runtime.power = Number(variables.potencia ?? 20);
    runtime.hour = Math.round(Number(variables.hora ?? DEFAULT_HOUR));
    runtime.antennas = antennasFrom(variables);
    runtime.summary = coverageOf(runtime.antennas, runtime.band, runtime.power);
    runtime.load = loadOf(runtime.antennas, runtime.band, runtime.summary.perPoint, runtime.hour);

    const fraction = runtime.summary.covered / runtime.summary.total;
    const all = fraction === 1;
    const isWifi = runtime.band.id === "2400";
    const channelsUsed = new Set(runtime.antennas.map((a) => a.channel)).size;
    const reuses = runtime.antennas.length === 3 && channelsUsed === 2;

    const { campus, wifi, reutilizar, horaPico } = runtime.challenges;
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
    // La hora pico se mide en la hora pico: aguantar a las tres de la mañana
    // no prueba nada. Cuenta solo lo que está cubierto y sin saturar.
    if (!horaPico.done && runtime.hour === PEAK_HOUR) {
      const fine = runtime.summary.perPoint.filter((r, i) => r.covered && !runtime.load.saturated[i]).length;
      horaPico.progress = Math.max(horaPico.progress, fine / runtime.summary.total);
      horaPico.done = fine === runtime.summary.total;
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
      this.resetChallenges!();
    },

    resetChallenges() {
      for (const challenge of Object.values(runtime.challenges)) {
        challenge.done = false;
        challenge.progress = 0;
      }
      lastKey = "";
      recompute(lastVariables);
    },

    getChallenges(): ChallengeStatus[] {
      const { campus, wifi, reutilizar, horaPico } = runtime.challenges;
      return [
        {
          id: "campus",
          title: "Cubre el campus",
          detail: `Los ${runtime.summary.total} puntos con buena señal, en cualquier banda.`,
          ...campus,
        },
        {
          id: "wifi",
          title: "Wi-Fi en 2.4 GHz",
          detail: "Lo mismo en la banda de Wi-Fi: los muros atenúan más.",
          ...wifi,
        },
        {
          id: "reutilizar",
          title: "Reutiliza canales",
          detail: "Tres antenas en 2.4 GHz con solo dos canales distintos.",
          ...reutilizar,
        },
        {
          id: "hora-pico",
          title: "Aguanta la hora pico",
          detail:
            runtime.hour === PEAK_HOUR || horaPico.done
              ? "En la hora de más demanda: todo con buena señal, sin interferencia y sin antenas saturadas."
              : "Busca en la curva de consumo la hora de más demanda y pon la hora ahí.",
          ...horaPico,
        },
      ];
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // La curva de consumo del campus a lo largo del día, para la mini gráfica.
      return Array.from({ length: 24 }, (_, h) => ({ x: h, y: Math.round(totalDemandMbps(h)) }));
    },

    getState(): AIContext {
      const { summary, antennas, band, power, load, hour } = runtime;
      const names = (filter: (i: number) => boolean) =>
        POINTS.filter((_, i) => filter(i)).map((p) => p.name).join(", ") || "ninguno";
      const { campus, wifi, reutilizar, horaPico } = runtime.challenges;
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
          hora: `${hour}:00`,
          hora_pico: `${PEAK_HOUR}:00`,
          demanda_total_mbps: Math.round(load.totalMbps),
          capacidad_por_antena_mbps: band.capacityMbps,
          carga_por_antena:
            antennas
              .map((a, i) => `antena ${i + 1} en ${a.site.name}: ${Math.round(load.perAntenna[i])} de ${band.capacityMbps} Mbps`)
              .join("; ") || "sin antenas",
          puntos_saturados: names((i) => load.saturated[i]),
          reto_campus: campus.done ? "logrado" : "pendiente",
          reto_wifi_2_4: wifi.done ? "logrado" : "pendiente",
          reto_reutilizar_canales: reutilizar.done ? "logrado" : "pendiente",
          reto_hora_pico: horaPico.done ? "logrado" : "pendiente",
        },
        tutorNotes: coverageNotes(antennas, band, power),
        conceptTags: [
          "pérdida de trayecto",
          "presupuesto de enlace",
          "atenuación por obstáculos",
          "interferencia cocanal",
          "reutilización de frecuencias",
          "capacidad y demanda",
        ],
      };
    },
  };
}
