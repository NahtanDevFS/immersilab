import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";
import {
  CONTROL_POINTS,
  getTargetPiece,
  silhouetteError,
  volumeOfRevolution,
} from "@/components/modules/calculus/shared/profiles";

export type LatheMethod = "discos" | "capas";

export interface LatheRuntime {
  /** Los cinco radios que el jugador está torneando. */
  radii: number[];
  /** Los de la pieza a igualar. */
  target: number[];
  volume: number;
  targetVolume: number;
  /** Error de volumen, en % (con signo: positivo = te pasaste). */
  volumeErrorPct: number;
  /** Qué tan distinta es la silueta, en %. */
  shapeErrorPct: number;
  /** Puntaje 0–100 combinando las dos cosas. */
  score: number;
  bestScore: number;
  /** Ángulo del torno, para que la pieza gire mientras se la mira. */
  spin: number;
}

export interface LatheEngine extends ExperimentEngine {
  getRuntime: () => LatheRuntime;
}

/** Vuelta y media por segundo es demasiado; esto es un torno mirándose, no
 *  una centrifugadora. */
const SPIN_SPEED = 0.35;

/** Tolerancias del reto: por debajo de esto, la pieza se da por lograda. */
const VOLUME_TOLERANCE = 2; // %
const SHAPE_TOLERANCE = 6; // %

function readRadii(variables: VariablesState): number[] {
  return Array.from({ length: CONTROL_POINTS }, (_, i) =>
    Number(variables[`r${i + 1}`] ?? 0.5),
  );
}

/**
 * Motor de "Torneá la pieza" (C3).
 *
 * No hay simulación en el tiempo: el volumen depende solo de los radios, así
 * que se recalcula al cambiar una variable y no 60 veces por segundo. Lo
 * único que avanza por frame es el giro del torno, que es visual.
 *
 * El puntaje combina las dos medidas —volumen y silueta— porque cada una
 * sola se puede engañar: se puede clavar el volumen con una forma que no se
 * parece en nada, y se puede tener una silueta parecida pero escalada. Que
 * las dos cuenten es lo que obliga a mirar la integral y la forma juntas.
 */
export function createLatheEngine(): LatheEngine {
  let lastVariables: VariablesState = {};
  let signature = "";

  const runtime: LatheRuntime = {
    radii: Array.from({ length: CONTROL_POINTS }, () => 0.5),
    target: [],
    volume: 0,
    targetVolume: 0,
    volumeErrorPct: 0,
    shapeErrorPct: 0,
    score: 0,
    bestScore: 0,
    spin: 0,
  };

  function recompute(variables: VariablesState) {
    const piece = getTargetPiece(variables.pieza ?? "copa");
    const radii = readRadii(variables);

    const volume = volumeOfRevolution(radii);
    const targetVolume = volumeOfRevolution(piece.radii);

    const volumeErrorPct = ((volume - targetVolume) / targetVolume) * 100;
    const shapeErrorPct = silhouetteError(radii, piece.radii);

    // Cae suave con cada error, sin escalones: acercarse un poco más siempre
    // suma algo, que es lo que hace que valga la pena seguir ajustando.
    const score = Math.round(
      100 *
        Math.exp(-Math.abs(volumeErrorPct) / 12) *
        Math.exp(-shapeErrorPct / 14),
    );

    runtime.radii = radii;
    runtime.target = piece.radii;
    runtime.volume = volume;
    runtime.targetVolume = targetVolume;
    runtime.volumeErrorPct = volumeErrorPct;
    runtime.shapeErrorPct = shapeErrorPct;
    runtime.score = score;
    if (score > runtime.bestScore) runtime.bestScore = score;
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

      runtime.spin = (runtime.spin + dt * SPIN_SPEED) % (Math.PI * 2);
    },

    reset() {
      runtime.bestScore = 0;
      recompute(lastVariables);
    },

    getState(): AIContext {
      const piece = getTargetPiece(lastVariables.pieza ?? "copa");
      const lograda =
        Math.abs(runtime.volumeErrorPct) < VOLUME_TOLERANCE &&
        runtime.shapeErrorPct < SHAPE_TOLERANCE;

      return {
        experimentName: "Torneá la pieza",
        disciplineName: "Cálculo",
        variables: lastVariables,
        result: {
          volumen_m3: Number(runtime.volume.toFixed(3)),
          volumen_objetivo_m3: Number(runtime.targetVolume.toFixed(3)),
          error_volumen_pct: Number(runtime.volumeErrorPct.toFixed(2)),
          diferencia_de_silueta_pct: Number(runtime.shapeErrorPct.toFixed(2)),
          puntaje: runtime.score,
          mejor_puntaje: runtime.bestScore,
          pieza: piece.label,
          ...(lograda ? { estado: "¡Pieza lograda!" } : {}),
        },
        conceptTags: [
          "sólidos de revolución",
          "método de discos",
          "método de capas",
          "integral definida",
          "volumen",
        ],
      };
    },

    getRuntime() {
      return runtime;
    },
  };
}
