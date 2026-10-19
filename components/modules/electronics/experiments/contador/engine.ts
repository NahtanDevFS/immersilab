import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * Motor de "El contador": contador asíncrono (de rizado) de cuatro bits con
 * flip-flops T (J = K = 1) activos en el flanco de bajada.
 *
 * El primer flip-flop toma el reloj del generador. Cada uno de los otros
 * toma su reloj de Q o de Q̄ del anterior: con Q, el siguiente cambia cuando
 * el anterior pasa de 1 a 0, y la cuenta sube; con Q̄, cambia cuando el
 * anterior pasa de 0 a 1, y la cuenta baja. Los cambios se propagan en
 * cadena dentro del mismo instante, como el rizado de un contador real.
 *
 * Reinicio asíncrono: una NAND mira las salidas elegidas. Cuando todas valen
 * 1, el contador se carga con `valor_carga`. Antes de eso el display alcanza
 * a mostrar el estado prohibido un instante (el 10 en un contador de década):
 * se guarda como un destello para que se vea el estado transitorio.
 *
 * Cada flip-flop divide la frecuencia entre dos, con Q o con Q̄: sin
 * reinicio, Q3 va a f/16.
 */

export const BITS = 4;
/** Cuánto dura el destello del estado transitorio, s. */
export const FLASH_SECONDS = 0.3;
/** Cuánto queda en alto el reloj con un pulso manual, s. */
const MANUAL_PULSE = 0.15;
/** Cuánto historial de flancos se guarda, s. */
const HISTORY_SECONDS = 40;

/** Lo que muestra el display hexadecimal para 10 a 15. */
export const HEX = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "b", "C", "d", "E", "F"];

export interface CounterConfig {
  manual: boolean;
  frequency: number;
  /** Fuente del reloj de los flip-flops 1, 2 y 3: true = Q̄ del anterior. */
  fromQbar: [boolean, boolean, boolean];
  /** Qué salidas entran a la NAND de reinicio. */
  resetInputs: [boolean, boolean, boolean, boolean];
  load: number;
}

export function configOf(variables: VariablesState): CounterConfig {
  return {
    manual: variables.reloj !== "automatico",
    frequency: Number(variables.frecuencia ?? 1),
    fromQbar: [variables.clk_ff2 === "qn", variables.clk_ff3 === "qn", variables.clk_ff4 === "qn"],
    resetInputs: [Boolean(variables.rst_q0), Boolean(variables.rst_q1), Boolean(variables.rst_q2), Boolean(variables.rst_q3)],
    load: Math.round(Number(variables.valor_carga ?? 0)),
  };
}

const configKey = (c: CounterConfig) =>
  `${c.manual}|${c.frequency}|${c.fromQbar.join()}|${c.resetInputs.join()}|${c.load}`;

/** Un cambio de nivel en un canal del diagrama de tiempos. 0 = reloj, 1 a 4 = Q0 a Q3. */
export interface Edge {
  t: number;
  channel: number;
  level: boolean;
}

export interface CounterRuntime {
  q: boolean[];
  clock: boolean;
  /** Tiempo del motor, s (el diagrama de tiempos lo usa de eje). */
  time: number;
  running: boolean;
  value: number;
  /** El estado prohibido que se alcanzó a ver, mientras dura el destello. */
  flash: number | null;
  edges: Edge[];
  /** Frecuencia medida de Q3 (entre dos subidas seguidas), Hz. */
  measuredQ3: number | null;
  /** Predicción con la que se comparó la última medición. */
  lastCheck: { predicted: number; measured: number; ok: boolean } | null;
  config: CounterConfig;
}

export interface CounterEngine extends ExperimentEngine {
  pulse: () => void;
  toggleRun: () => void;
  clear: () => void;
  getRuntime: () => CounterRuntime;
}

const valueOf = (q: boolean[]) => q.reduce((sum, bit, i) => sum + (bit ? 1 << i : 0), 0);

/** ¿La secuencia de valores termina en `pattern`? */
function endsWith(history: number[], pattern: number[]) {
  if (history.length < pattern.length) return false;
  const tail = history.slice(-pattern.length);
  return tail.every((v, i) => v === pattern[i]);
}

const range = (from: number, to: number) => {
  const out: number[] = [];
  const step = from <= to ? 1 : -1;
  for (let v = from; v !== to + step; v += step) out.push(v);
  return out;
};

const PATTERNS = {
  "cuenta-atras": range(15, 0),
  decada: [...range(0, 9), 0],
  reloj: [...range(0, 5), 0],
  temporizador: [...range(9, 0), ...range(9, 0), 9],
};

export function createCounterEngine(): CounterEngine {
  let lastVariables: VariablesState = {};
  let lastKey = "";
  let phase = 0;
  let manualHigh = 0;
  let flashLeft = 0;
  /** Subidas de Q3, para medir su frecuencia. */
  let q3Rises: number[] = [];
  /** Valores estables que mostró el display, en orden. */
  let history: number[] = [0];

  const done = { divisor: false, "cuenta-atras": false, decada: false, temporizador: false, reloj: false };

  const runtime: CounterRuntime = {
    q: [false, false, false, false],
    clock: false,
    time: 0,
    running: true,
    value: 0,
    flash: null,
    edges: [],
    measuredQ3: null,
    lastCheck: null,
    config: configOf({}),
  };

  function record(channel: number, level: boolean) {
    runtime.edges.push({ t: runtime.time, channel, level });
  }

  function setBit(i: number, level: boolean) {
    if (runtime.q[i] === level) return;
    runtime.q[i] = level;
    record(i + 1, level);
    if (i === BITS - 1 && level) {
      q3Rises.push(runtime.time);
      if (q3Rises.length > 3) q3Rises.shift();
      measureQ3();
    }
  }

  function measureQ3() {
    if (q3Rises.length < 2 || runtime.config.manual) return;
    const period = q3Rises[q3Rises.length - 1] - q3Rises[q3Rises.length - 2];
    if (period <= 0) return;
    runtime.measuredQ3 = 1 / period;
    const predicted = Number(lastVariables.pred_frecuencia_q3 ?? 0);
    const ok = Math.abs(predicted - runtime.measuredQ3) <= 0.05 * runtime.measuredQ3;
    runtime.lastCheck = { predicted, measured: runtime.measuredQ3, ok };
    if (ok && Math.abs(runtime.config.frequency - 1) > 1e-9) done.divisor = true;
  }

  /** Un flanco de bajada en el reloj del flip-flop `i`: cambia y propaga el rizado. */
  function clockFF(i: number) {
    if (i >= BITS) return;
    const before = runtime.q[i];
    setBit(i, !before);
    if (i + 1 >= BITS) return;
    // El siguiente toma su reloj de Q (baja cuando Q pasa de 1 a 0) o de Q̄
    // (baja cuando Q pasa de 0 a 1).
    const fallingQ = before && !runtime.q[i];
    const fallingQbar = !before && runtime.q[i];
    const fromQbar = runtime.config.fromQbar[i];
    if (fromQbar ? fallingQbar : fallingQ) clockFF(i + 1);
  }

  function afterRipple() {
    const { resetInputs, load } = runtime.config;
    const used = resetInputs.some(Boolean);
    const value = valueOf(runtime.q);
    if (used && resetInputs.every((sel, i) => !sel || runtime.q[i])) {
      // La NAND baja: carga asíncrona. Lo que se alcanzó a ver queda como destello.
      runtime.flash = value;
      flashLeft = FLASH_SECONDS;
      for (let i = 0; i < BITS; i++) setBit(i, Boolean((load >> i) & 1));
    }
    runtime.value = valueOf(runtime.q);
    history.push(runtime.value);
    if (history.length > 60) history = history.slice(-40);
    for (const id of ["cuenta-atras", "decada", "reloj", "temporizador"] as const) {
      if (endsWith(history, PATTERNS[id])) done[id] = true;
    }
  }

  function fallingEdge() {
    clockFF(0);
    afterRipple();
  }

  function setClock(level: boolean) {
    if (runtime.clock === level) return;
    runtime.clock = level;
    record(0, level);
    if (!level) fallingEdge();
  }

  function applyConfig(variables: VariablesState) {
    const config = configOf(variables);
    const key = configKey(config);
    if (key === lastKey) return;
    lastKey = key;
    runtime.config = config;
    // Con otra configuración, la medición de Q3 vale de nuevo desde cero.
    q3Rises = [];
    runtime.measuredQ3 = null;
  }

  return {
    init(variables) {
      lastVariables = variables;
      applyConfig(variables);
    },

    update(dt, variables) {
      lastVariables = variables;
      applyConfig(variables);
      runtime.time += dt;

      if (flashLeft > 0) {
        flashLeft -= dt;
        if (flashLeft <= 0) runtime.flash = null;
      }

      const { manual, frequency } = runtime.config;
      if (manual) {
        if (manualHigh > 0) {
          manualHigh -= dt;
          if (manualHigh <= 0) setClock(false);
        }
      } else if (runtime.running) {
        // Reloj cuadrado: en alto la primera mitad de cada período.
        phase = (phase + dt * frequency) % 1;
        setClock(phase < 0.5);
      } else {
        setClock(false);
      }

      const cutoff = runtime.time - HISTORY_SECONDS;
      if (runtime.edges.length > 0 && runtime.edges[0].t < cutoff) {
        runtime.edges = runtime.edges.filter((e) => e.t >= cutoff);
      }
    },

    pulse() {
      if (!runtime.config.manual || manualHigh > 0) return;
      setClock(true);
      manualHigh = MANUAL_PULSE;
    },

    toggleRun() {
      runtime.running = !runtime.running;
    },

    clear() {
      for (let i = 0; i < BITS; i++) setBit(i, false);
      runtime.value = 0;
      runtime.flash = null;
      // Poner en cero corta la secuencia: una vuelta tiene que salir contando.
      history = [0];
    },

    reset() {
      this.clear();
    },

    resetChallenges() {
      for (const id of Object.keys(done) as Array<keyof typeof done>) done[id] = false;
      history = [runtime.value];
      runtime.lastCheck = null;
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // La cuenta a lo largo del tiempo, a partir de los flancos guardados.
      const points: Array<{ x: number; y: number }> = [];
      const q = [false, false, false, false];
      for (const e of runtime.edges) {
        if (e.channel === 0) continue;
        q[e.channel - 1] = e.level;
        points.push({ x: e.t, y: valueOf(q) });
      }
      return points.slice(-80);
    },

    getChallenges(): ChallengeStatus[] {
      const c = (id: keyof typeof done, title: string, detail: string): ChallengeStatus => ({
        id,
        title,
        detail,
        done: done[id],
        progress: done[id] ? 1 : 0,
      });
      return [
        c("divisor", "Divide la frecuencia", "Con un reloj distinto de 1 Hz en automático, predice la frecuencia de Q3 con error menor al 5 %."),
        c("cuenta-atras", "Cuenta hacia atrás", "Que el display recorra una vuelta completa de F (15) a 0."),
        c("decada", "Solo hasta 9", "Una vuelta completa de 0 a 9 que vuelva a 0, sin mostrar letras (el destello no cuenta)."),
        c("temporizador", "El temporizador", "Que cuente de 9 a 0 y vuelva a 9, dos veces seguidas."),
        c("reloj", "Las decenas del reloj", "Una vuelta completa de 0 a 5 que vuelva a 0, como las decenas de los minutos."),
      ];
    },

    getState(): AIContext {
      const { config, q } = runtime;
      const sources = config.fromQbar.map((qbar, i) => `FF${i + 1} desde ${qbar ? "Q̄" : "Q"}${i}`).join(", ");
      const resetBits = config.resetInputs.map((s, i) => (s ? `Q${i}` : "")).filter(Boolean);
      return {
        experimentName: "El contador",
        disciplineName: "Electrónica",
        variables: lastVariables,
        result: {
          reloj: config.manual ? "manual" : `automático, ${config.frequency} Hz${runtime.running ? "" : " (detenido)"}`,
          relojes_de_los_flip_flops: sources,
          sentido: config.fromQbar.every((x) => !x)
            ? "ascendente"
            : config.fromQbar.every(Boolean)
              ? "descendente"
              : "mixto",
          reinicio: resetBits.length
            ? `NAND con ${resetBits.join(" y ")}, carga ${config.load}`
            : "sin reinicio",
          cuenta_binaria: [3, 2, 1, 0].map((i) => (q[i] ? 1 : 0)).join(""),
          cuenta_decimal: runtime.value,
          display: HEX[runtime.value],
          ...(runtime.measuredQ3 !== null ? { frecuencia_q3_medida_hz: Number(runtime.measuredQ3.toFixed(4)) } : {}),
          ...(runtime.lastCheck
            ? {
                prediccion_q3_hz: runtime.lastCheck.predicted,
                prediccion_acertada: runtime.lastCheck.ok ? "sí" : "no",
              }
            : {}),
        },
        conceptTags: ["flip-flop T", "contador asíncrono", "divisor de frecuencia", "contador de módulo N", "decodificador de siete segmentos"],
      };
    },
  };
}
