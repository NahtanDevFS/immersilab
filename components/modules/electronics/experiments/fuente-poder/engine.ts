import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/** El enchufe: 120 V eficaces a 60 Hz, o sea 169.7 V de pico. */
export const MAINS_RMS = 120;
export const MAINS_PEAK = MAINS_RMS * Math.SQRT2;
export const MAINS_HZ = 60;
/** Espiras del primario del transformador (fijas). */
export const PRIMARY_TURNS = 1000;
/** Caída de un diodo de silicio conduciendo, V. */
export const DIODE_DROP = 0.7;

/** Lo que pide un puerto USB, V. */
export const USB_MIN = 4.75;
export const USB_MAX = 5.25;
/** Rizado máximo para los retos 2 y 3, % del voltaje medio. */
export const RIPPLE_GOAL = 5;
/** Capacitor máximo del reto 3: la mitad de lo que necesita la media onda. */
export const BRIDGE_CAP_LIMIT = 10000;

export const CAPACITORS = [0, 470, 1000, 2200, 4700, 10000, 22000]; // µF
/**
 * Carga mínima para los retos 2 y 3. Con una carga chica el rizado baja tanto
 * que cualquier capacitor alcanza, y la comparación "media onda contra
 * puente con la misma carga" pierde el sentido.
 */
export const CHALLENGE_LOAD = 250; // mA
export const LOADS = [100, 250, 500]; // mA

export type Rectifier = "media" | "puente";
export type Stage = "enchufe" | "secundario" | "rectificado" | "salida";

export const STAGES: Array<{ id: Stage; label: string }> = [
  { id: "enchufe", label: "Enchufe (120 V)" },
  { id: "secundario", label: "Secundario del transformador" },
  { id: "rectificado", label: "Después de los diodos" },
  { id: "salida", label: "Salida (con capacitor)" },
];

/** Una forma de onda para el osciloscopio: tiempos en ms y voltajes. */
export interface Trace {
  t: number[];
  v: number[];
}

export interface SupplyResult {
  secondaryPeak: number;
  /** Pico a la salida del rectificador (sin capacitor). */
  rectifiedPeak: number;
  outAvg: number;
  outMin: number;
  outMax: number;
  /** Rizado pico a pico, V y % del medio. */
  ripple: number;
  ripplePct: number;
  traces: Record<Stage, Trace>;
}

/** Cuántos ciclos se simulan antes de medir (para que el capacitor llegue a régimen). */
const SETTLE_CYCLES = 6;
/** Cuántos ciclos se muestran en el osciloscopio. */
const SHOWN_CYCLES = 2;
const STEPS_PER_CYCLE = 600;

/**
 * Simula la fuente en el tiempo, paso a paso.
 *
 * El capacitor se carga a través de los diodos cuando la onda rectificada lo
 * supera, y entre picos se descarga con la corriente del celular (I = C·dV/dt,
 * o sea dV = I·dt/C). No es la fórmula aproximada del rizado: es la misma
 * cuenta en el tiempo, y de paso da las curvas del osciloscopio.
 */
export function simulate(
  secondaryTurns: number,
  rectifier: Rectifier,
  capacitorUf: number,
  loadMa: number,
): SupplyResult {
  const secondaryPeak = (MAINS_PEAK * secondaryTurns) / PRIMARY_TURNS;
  const drop = rectifier === "puente" ? 2 * DIODE_DROP : DIODE_DROP;
  const rectifiedPeak = Math.max(0, secondaryPeak - drop);
  const capacitance = capacitorUf * 1e-6;
  const load = loadMa / 1000;

  const period = 1 / MAINS_HZ;
  const dt = period / STEPS_PER_CYCLE;
  const totalSteps = (SETTLE_CYCLES + SHOWN_CYCLES) * STEPS_PER_CYCLE;
  const shownFrom = SETTLE_CYCLES * STEPS_PER_CYCLE;

  const rectify = (v: number) =>
    rectifier === "puente" ? Math.max(0, Math.abs(v) - drop) : Math.max(0, v - drop);

  const traces: Record<Stage, Trace> = {
    enchufe: { t: [], v: [] },
    secundario: { t: [], v: [] },
    rectificado: { t: [], v: [] },
    salida: { t: [], v: [] },
  };

  let out = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < totalSteps; k++) {
    const time = k * dt;
    const phase = Math.sin(2 * Math.PI * MAINS_HZ * time);
    const mains = MAINS_PEAK * phase;
    const secondary = secondaryPeak * phase;
    const rectified = rectify(secondary);

    if (capacitance > 0) {
      // El capacitor pierde carga por la carga; si la onda lo supera, los
      // diodos conducen y lo vuelven a cargar hasta ese valor.
      out = Math.max(rectified, out - (load * dt) / capacitance);
      out = Math.max(0, out);
    } else {
      out = rectified;
    }

    if (k >= shownFrom) {
      const ms = (time - shownFrom * dt) * 1000;
      // Se guarda uno de cada 4 puntos: 300 por curva alcanzan para dibujar.
      if (k % 4 === 0) {
        traces.enchufe.t.push(ms);
        traces.enchufe.v.push(mains);
        traces.secundario.t.push(ms);
        traces.secundario.v.push(secondary);
        traces.rectificado.t.push(ms);
        traces.rectificado.v.push(rectified);
        traces.salida.t.push(ms);
        traces.salida.v.push(out);
      }
      sum += out;
      min = Math.min(min, out);
      max = Math.max(max, out);
    }
  }

  const outAvg = sum / (SHOWN_CYCLES * STEPS_PER_CYCLE);
  const ripple = max - min;
  return {
    secondaryPeak,
    rectifiedPeak,
    outAvg,
    outMin: min,
    outMax: max,
    ripple,
    ripplePct: outAvg > 0 ? (ripple / outAvg) * 100 : 0,
    traces,
  };
}

export type PhoneState = "carga" | "no-carga" | "sobrevoltaje";

/** Lo que haría el celular con esa salida. */
export function phoneState(r: SupplyResult): PhoneState {
  if (r.outMax > 6) return "sobrevoltaje";
  if (r.outAvg >= USB_MIN && r.outAvg <= USB_MAX && r.outMin >= 4.4) return "carga";
  return "no-carga";
}

export interface SupplyRuntime {
  result: SupplyResult;
  load: number;
  stage: Stage;
  phone: PhoneState;
  rectifier: Rectifier;
  capacitor: number;
}

export interface SupplyEngine extends ExperimentEngine {
  getRuntime: () => SupplyRuntime;
}

const HOLD = 1;

/**
 * Motor de "La fuente de poder": de 120 V de alterna a 5 V de continua.
 *
 * Lo que se aprende:
 * - el transformador baja el voltaje en la proporción de las espiras;
 * - los diodos dejan pasar la corriente en un solo sentido (y se llevan
 *   0.7 V cada uno);
 * - el capacitor rellena los huecos entre picos, y el rizado que queda depende
 *   de la corriente que pide la carga y del tamaño del capacitor;
 * - el puente de diodos aprovecha los dos medios ciclos: los huecos son la
 *   mitad de largos, así que alcanza con la mitad de capacitor.
 */
export function createSupplyEngine(): SupplyEngine {
  let lastVariables: VariablesState = {};
  let signature = "";
  const done = { usb: false, media: false, puente: false };
  const held = { usb: 0, media: 0, puente: 0 };

  const runtime: SupplyRuntime = {
    result: simulate(60, "media", 470, 250),
    load: 250,
    stage: "salida",
    phone: "no-carga",
    rectifier: "media",
    capacitor: 470,
  };

  function read(variables: VariablesState) {
    const turns = Number(variables.espiras ?? 60);
    const rectifier: Rectifier = variables.rectificador === "puente" ? "puente" : "media";
    const capacitor = Number(variables.capacitor ?? 470);
    const load = Number(variables.carga ?? 250);
    runtime.stage = (STAGES.find((s) => s.id === variables.osciloscopio)?.id ?? "salida") as Stage;
    const next = `${turns}/${rectifier}/${capacitor}/${load}`;
    if (next !== signature) {
      signature = next;
      runtime.result = simulate(turns, rectifier, capacitor, load);
      runtime.phone = phoneState(runtime.result);
      runtime.rectifier = rectifier;
      runtime.capacitor = capacitor;
      runtime.load = load;
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      read(variables);
    },

    update(dt, variables) {
      lastVariables = variables;
      read(variables);
      const r = runtime.result;
      const usbOk = r.outAvg >= USB_MIN && r.outAvg <= USB_MAX;
      // Reto 1: que el celular cargue de verdad (promedio de 5 V y sin bajar
      // de 4.4 V). Solo el promedio se podía cumplir sin capacitor, con la
      // onda cayendo a cero en cada ciclo, y así ningún celular carga.
      const charging = runtime.phone === "carga";
      const smooth = usbOk && r.ripplePct < RIPPLE_GOAL && runtime.load >= CHALLENGE_LOAD;

      held.usb = charging ? held.usb + dt : 0;
      held.media = smooth && runtime.rectifier === "media" ? held.media + dt : 0;
      held.puente =
        smooth && runtime.rectifier === "puente" && runtime.capacitor <= BRIDGE_CAP_LIMIT
          ? held.puente + dt
          : 0;
      if (held.usb >= HOLD) done.usb = true;
      if (held.media >= HOLD) done.media = true;
      if (held.puente >= HOLD) done.puente = true;
    },

    reset() {},

    resetChallenges() {
      done.usb = false;
      done.media = false;
      done.puente = false;
    },

    getRuntime() {
      return runtime;
    },

    getChallenges(): ChallengeStatus[] {
      const r = runtime.result;
      return [
        {
          id: "usb",
          title: "Carga el celular",
          detail: `Que la salida promedie entre ${USB_MIN} y ${USB_MAX} V y nunca baje de 4.4 V. Ahora: ${r.outAvg.toFixed(2)} V, mínimo ${r.outMin.toFixed(2)} V.`,
          done: done.usb,
          progress: done.usb ? 1 : Math.min(0.9, held.usb / HOLD),
        },
        {
          id: "media-onda",
          title: "Rizado menor al 5 % con media onda",
          detail: `Con un solo diodo y el celular pidiendo ${CHALLENGE_LOAD} mA o más: 5 V y menos de ${RIPPLE_GOAL} % de rizado. Ahora: ${r.ripplePct.toFixed(1)} %.`,
          done: done.media,
          progress: done.media ? 1 : Math.min(0.9, held.media / HOLD),
        },
        {
          id: "puente",
          title: "Lo mismo con la mitad de capacitor",
          detail: `Con el puente de diodos, ${BRIDGE_CAP_LIMIT.toLocaleString("es")} µF o menos y ${CHALLENGE_LOAD} mA o más: 5 V y menos de ${RIPPLE_GOAL} % de rizado.`,
          done: done.puente,
          progress: done.puente ? 1 : Math.min(0.9, held.puente / HOLD),
        },
      ];
    },

    getState(): AIContext {
      const r = runtime.result;
      return {
        experimentName: "La fuente de poder",
        disciplineName: "Electrónica",
        variables: lastVariables,
        result: {
          pico_del_enchufe_V: Number(MAINS_PEAK.toFixed(1)),
          relacion_transformador: `${PRIMARY_TURNS}:${Number(lastVariables.espiras ?? 60)}`,
          pico_secundario_V: Number(r.secondaryPeak.toFixed(2)),
          pico_despues_de_los_diodos_V: Number(r.rectifiedPeak.toFixed(2)),
          salida_promedio_V: Number(r.outAvg.toFixed(2)),
          salida_minima_V: Number(r.outMin.toFixed(2)),
          salida_maxima_V: Number(r.outMax.toFixed(2)),
          rizado_V: Number(r.ripple.toFixed(3)),
          rizado_pct: Number(r.ripplePct.toFixed(1)),
          celular:
            runtime.phone === "carga"
              ? "cargando"
              : runtime.phone === "sobrevoltaje"
                ? "sobrevoltaje: se dañaría"
                : "no carga",
          osciloscopio_en: STAGES.find((s) => s.id === runtime.stage)?.label ?? runtime.stage,
        },
        conceptTags: [
          "transformador",
          "diodo",
          "rectificador de media onda",
          "puente de diodos",
          "capacitor de filtro",
          "rizado",
        ],
      };
    },
  };
}
