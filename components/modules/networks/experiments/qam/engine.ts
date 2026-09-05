import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export interface Symbol2D {
  i: number;
  q: number;
}

export interface QamRuntime {
  /** Puntos ideales de la constelación (lo que se transmite). */
  ideal: Symbol2D[];
  /** Símbolos recibidos, ya con ruido. Se van llenando durante el envío. */
  received: Symbol2D[];
  /** Índice del símbolo ideal que le tocaba a cada recibido. */
  sent: number[];
  /** A qué símbolo lo decodificó el receptor (vecino más cercano). */
  decoded: number[];
  phase: "listo" | "transmitiendo" | "terminado";
  /** Cuántos símbolos ya se enviaron de la trama. */
  progress: number;
  total: number;
  bitsPerSymbol: number;
  bitErrors: number;
  totalBits: number;
  /** Tasa de error de bit, en %. */
  ber: number;
  /** El mensaje tal como llegó, con los errores metidos adentro. */
  receivedText: string;
  /** Bits por segundo útiles, con la trama a 1 símbolo por tick. */
  throughput: number;
  bestThroughput: number;
}

export interface QamEngine extends ExperimentEngine {
  transmit: () => void;
  getRuntime: () => QamRuntime;
}

/** El mensaje que viaja. Corto a propósito: tiene que caber en la pantalla
 *  del panel y notarse letra por letra cuando el ruido lo rompe. */
const MESSAGE = "HOLA UMG";

/** Símbolos por segundo (baudios) de la simulación. Es el reloj del enlace:
 *  con 4 bits por símbolo, 30 baudios son 120 bits/s. Lento a propósito —
 *  el punto es VER cada símbolo caer en el plano I/Q. */
const SYMBOL_RATE = 30;

export const MODULATIONS = [
  { id: "bpsk", label: "BPSK (1 bit)", bits: 1 },
  { id: "qpsk", label: "QPSK (2 bits)", bits: 2 },
  { id: "qam16", label: "16-QAM (4 bits)", bits: 4 },
  { id: "qam64", label: "64-QAM (6 bits)", bits: 6 },
];

export function getModulation(id: string | number | boolean) {
  return MODULATIONS.find((m) => m.id === String(id)) ?? MODULATIONS[1];
}

/**
 * Los puntos de la constelación, normalizados para que todas las
 * modulaciones tengan la MISMA potencia media.
 *
 * Esa normalización es la clave de todo el experimento: si cada constelación
 * se dibujara con el mismo espaciado, subir de QPSK a 64-QAM saldría gratis
 * y no habría nada que aprender. En un enlace real la potencia del
 * transmisor es fija, así que meter más puntos en el mismo círculo los
 * amontona — y ahí es donde el ruido empieza a hacer que uno se confunda con
 * su vecino.
 */
export function buildConstellation(bits: number): Symbol2D[] {
  if (bits === 1) {
    // BPSK: dos puntos sobre el eje I.
    return [
      { i: -1, q: 0 },
      { i: 1, q: 0 },
    ];
  }

  const side = Math.round(Math.sqrt(2 ** bits));
  const points: Symbol2D[] = [];
  for (let row = 0; row < side; row += 1) {
    for (let col = 0; col < side; col += 1) {
      points.push({ i: 2 * col - (side - 1), q: 2 * row - (side - 1) });
    }
  }

  // Escala para potencia media unitaria: así todas compiten en igualdad.
  const meanPower =
    points.reduce((sum, p) => sum + p.i * p.i + p.q * p.q, 0) / points.length;
  const scale = 1 / Math.sqrt(meanPower);
  return points.map((p) => ({ i: p.i * scale, q: p.q * scale }));
}

/** Dos gaussianas independientes (Box-Muller) — el ruido térmico de un
 *  receptor real es gaussiano en I y en Q por separado. */
function gaussianPair(): [number, number] {
  const u = Math.max(Math.random(), 1e-9);
  const v = Math.random();
  const mag = Math.sqrt(-2 * Math.log(u));
  return [mag * Math.cos(2 * Math.PI * v), mag * Math.sin(2 * Math.PI * v)];
}

function textToBits(text: string): number[] {
  const bits: number[] = [];
  for (const char of text) {
    const code = char.charCodeAt(0) & 0xff;
    for (let b = 7; b >= 0; b -= 1) bits.push((code >> b) & 1);
  }
  return bits;
}

function bitsToText(bits: number[]): string {
  let out = "";
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let code = 0;
    for (let b = 0; b < 8; b += 1) code = (code << 1) | bits[i + b];
    // Los códigos que no son imprimibles se muestran como "�": es
    // exactamente lo que ve un programa real cuando el enlace le entrega
    // bytes rotos, y comunica el daño mejor que un número de BER.
    out += code >= 32 && code < 127 ? String.fromCharCode(code) : "�";
  }
  return out;
}

/**
 * Motor de "Recuperá el mensaje" (R2).
 *
 * Cadena completa de un enlace digital, en cuatro pasos que el experimento
 * deja ver por separado:
 *
 *   texto → bits → símbolos I/Q → (+ ruido del canal) → decisión → bits → texto
 *
 * El receptor decide por VECINO MÁS CERCANO, que es lo que hace un receptor
 * real: se queda con el punto de la constelación que menos dista de lo que
 * llegó. Por eso, cuando el ruido empuja un símbolo más allá de la mitad de
 * camino hacia su vecino, el bit sale mal — y por eso una constelación
 * apretada (64-QAM) se rompe con mucho menos ruido que una holgada (BPSK).
 */
export function createQamEngine(): QamEngine {
  let lastVariables: VariablesState = {};
  let bitsQueue: number[] = [];
  let clock = 0;
  let noiseSigma = 0;

  const runtime: QamRuntime = {
    ideal: buildConstellation(2),
    received: [],
    sent: [],
    decoded: [],
    phase: "listo",
    progress: 0,
    total: 0,
    bitsPerSymbol: 2,
    bitErrors: 0,
    totalBits: 0,
    ber: 0,
    receivedText: "",
    throughput: 0,
    bestThroughput: 0,
  };

  /** σ del ruido para una SNR dada, con potencia de señal 1 por símbolo.
   *  Se reparte entre las dos componentes: N₀/2 en I y N₀/2 en Q. */
  function sigmaForSnr(snrDb: number): number {
    const snr = 10 ** (snrDb / 10);
    return Math.sqrt(1 / (2 * snr));
  }

  function prepare(variables: VariablesState) {
    const mod = getModulation(variables.modulacion ?? "qpsk");
    runtime.ideal = buildConstellation(mod.bits);
    runtime.bitsPerSymbol = mod.bits;

    const bits = textToBits(MESSAGE);
    // Relleno hasta completar un símbolo entero: un enlace real nunca manda
    // medio símbolo.
    while (bits.length % mod.bits !== 0) bits.push(0);

    bitsQueue = bits;
    runtime.total = bits.length / mod.bits;
    runtime.totalBits = bits.length;
  }

  function reset() {
    runtime.received = [];
    runtime.sent = [];
    runtime.decoded = [];
    runtime.progress = 0;
    runtime.bitErrors = 0;
    runtime.ber = 0;
    runtime.receivedText = "";
    runtime.throughput = 0;
    runtime.phase = "listo";
    clock = 0;
  }

  /** Manda el símbolo número `index` por el canal y lo decodifica. */
  function sendSymbol(index: number) {
    const bits = runtime.bitsPerSymbol;
    const slice = bitsQueue.slice(index * bits, (index + 1) * bits);
    const symbolIndex = slice.reduce((acc, bit) => (acc << 1) | bit, 0);
    const point = runtime.ideal[symbolIndex] ?? runtime.ideal[0];

    const [n1, n2] = gaussianPair();
    const received = {
      i: point.i + n1 * noiseSigma,
      q: point.q + n2 * noiseSigma,
    };

    // Decisión: el punto ideal más cercano.
    let best = 0;
    let bestDistance = Infinity;
    runtime.ideal.forEach((candidate, i) => {
      const d =
        (candidate.i - received.i) ** 2 + (candidate.q - received.q) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });

    runtime.received.push(received);
    runtime.sent.push(symbolIndex);
    runtime.decoded.push(best);

    // Errores de BIT, no de símbolo: confundir dos puntos vecinos suele
    // arruinar un solo bit, y confundir dos lejanos, varios. Contarlos por
    // separado es lo que hace que el número se parezca al BER real.
    for (let b = 0; b < bits; b += 1) {
      const sentBit = (symbolIndex >> (bits - 1 - b)) & 1;
      const gotBit = (best >> (bits - 1 - b)) & 1;
      if (sentBit !== gotBit) runtime.bitErrors += 1;
    }
  }

  function finish() {
    runtime.phase = "terminado";

    const bits: number[] = [];
    runtime.decoded.forEach((symbol) => {
      for (let b = runtime.bitsPerSymbol - 1; b >= 0; b -= 1) {
        bits.push((symbol >> b) & 1);
      }
    });

    runtime.receivedText = bitsToText(bits);
    runtime.ber = (runtime.bitErrors / runtime.totalBits) * 100;
    // Solo cuenta como récord un enlace que entregó el mensaje INTACTO: la
    // velocidad de un enlace que corrompe los datos no sirve de nada, y ese
    // es el compromiso que el experimento quiere enseñar.
    runtime.throughput = SYMBOL_RATE * runtime.bitsPerSymbol;
    if (runtime.bitErrors === 0 && runtime.throughput > runtime.bestThroughput) {
      runtime.bestThroughput = runtime.throughput;
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      noiseSigma = sigmaForSnr(Number(variables.snr ?? 20));
      prepare(variables);
      reset();
    },

    update(dt, variables) {
      // Cambiar la modulación a mitad de una transmisión dejaría símbolos de
      // dos constelaciones distintas en la misma nube, así que se rearma.
      if (
        variables.modulacion !== lastVariables.modulacion ||
        variables.snr !== lastVariables.snr
      ) {
        lastVariables = variables;
        noiseSigma = sigmaForSnr(Number(variables.snr ?? 20));
        prepare(variables);
        reset();
        return;
      }
      lastVariables = variables;

      if (runtime.phase !== "transmitiendo") return;

      clock += dt;
      const target = Math.min(
        runtime.total,
        Math.floor(clock * SYMBOL_RATE),
      );
      while (runtime.progress < target) {
        sendSymbol(runtime.progress);
        runtime.progress += 1;
      }

      if (runtime.progress >= runtime.total) finish();
    },

    reset() {
      reset();
    },

    getState(): AIContext {
      const mod = getModulation(lastVariables.modulacion ?? "qpsk");
      return {
        experimentName: "Recuperá el mensaje",
        disciplineName: "Redes",
        variables: lastVariables,
        result:
          runtime.phase === "terminado"
            ? {
                mensaje_enviado: MESSAGE,
                mensaje_recibido: runtime.receivedText,
                bits_por_simbolo: mod.bits,
                bits_errados: runtime.bitErrors,
                ber_pct: Number(runtime.ber.toFixed(2)),
                velocidad_bps: runtime.throughput,
                mejor_velocidad_sin_errores_bps: runtime.bestThroughput,
              }
            : undefined,
        conceptTags: [
          "modulación digital",
          "constelación I/Q",
          "relación señal a ruido",
          "tasa de error de bit",
        ],
      };
    },

    transmit() {
      if (runtime.phase === "transmitiendo") return;
      prepare(lastVariables);
      reset();
      runtime.phase = "transmitiendo";
    },

    getRuntime() {
      return runtime;
    },
  };
}
