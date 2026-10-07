import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * R6 · Tu voz en el espectro — PLAN_DESARROLLO.md §3.3.
 *
 * El micrófono entra por la Web Audio API y un `AnalyserNode` hace la FFT.
 * Este motor la lee a paso fijo, la reduce a BANDS columnas para dibujar, la
 * guarda en un historial (la cascada) y evalúa los tres retos. No dibuja
 * nada: la escena solo lee `getRuntime()`.
 *
 * Los retos se miden sobre el espectro, no con umbrales absolutos de volumen:
 * cada micrófono (laptop, celular, auriculares) tiene una ganancia distinta y
 * un umbral fijo funcionaría en uno y en otro no.
 */

/** Columnas del espectro que se dibujan. */
export const BANDS = 96;
/** Filas de la cascada: cuántos instantes hacia atrás se ven. */
export const ROWS = 64;
/** Cada cuánto se agrega una fila a la cascada. 20 por segundo: ~3 s visibles. */
const ROW_INTERVAL = 1 / 20;

/** Rango de dB que se mapea a la altura 0–1 del dibujo. */
const DISPLAY_MIN_DB = -100;
const DISPLAY_RANGE_DB = 70;

/** Banda de la telefonía clásica: lo que justifica todo el experimento. */
export const PHONE_BAND: [number, number] = [300, 3400];
/** Frecuencia más baja de la escala logarítmica. */
export const LOG_MIN_HZ = 60;

/** Rango que se analiza para los retos (fuera de esto es ruido de la sala o del micrófono). */
const ANALYSIS_MIN_HZ = 80;
const ANALYSIS_MAX_HZ = 8000;

/** Cuántos dB por encima del ruido de fondo cuenta como "estás sonando". */
const ACTIVE_ABOVE_FLOOR_DB = 12;
/**
 * Nivel absoluto (dB relativos a escala completa) que cuenta como sonido
 * aunque no haya referencia de silencio. Sin esto, si el jugador ya está
 * silbando cuando enciende el micrófono, ese silbido se toma como "ruido de
 * fondo" y no se detecta hasta que haga una pausa.
 */
const ACTIVE_ABSOLUTE_DB = -40;
/** Fracción de la energía en el pico (±2 bins) para considerarlo un tono puro. */
const TONAL_DOMINANCE = 0.45;

const WHISTLE_HOLD_S = 1;
const VOWEL_HOLD_S = 0.8;
/** Cuántos dB tiene que subir la energía aguda al pasar de "u" a "i". */
const VOWEL_RISE_DB = 8;
const BAND_TALK_S = 3;

export type MicState =
  | "apagado"
  | "pidiendo"
  | "escuchando"
  | "sin-permiso"
  | "sin-soporte";

export interface ChallengeProgress {
  done: boolean;
  /** 0–1, para la barrita de progreso. */
  progress: number;
}

export interface SpectrumRuntime {
  mic: MicState;
  /** Espectro actual, una altura 0–1 por columna. */
  bands: Float32Array;
  /** Cascada: ROWS filas de BANDS valores; `head` es la fila más reciente. */
  history: Float32Array;
  head: number;
  /** Bordes en Hz de cada columna (BANDS + 1 valores), según escala y rango. */
  edges: Float32Array;
  peakHz: number;
  /** Altura 0–1 del pico, para ubicar el marcador. */
  peakLevel: number;
  /** ¿Hay sonido claramente por encima del ruido de fondo? */
  active: boolean;
  /** ¿El sonido es un tono casi puro (un solo pico agudo, como un silbido)? */
  tonal: boolean;
  /** % de la energía de tu voz que cae en la banda telefónica (acumulado). */
  phoneBandPct: number;
  /** Etapa del reto de vocales: primero "u", después "i". */
  vowelStage: "u" | "i";
  challenges: {
    silbido: ChallengeProgress;
    vocales: ChallengeProgress;
    banda: ChallengeProgress;
  };
}

export interface SpectrumEngine extends ExperimentEngine {
  /** Pide el micrófono y empieza a escuchar. Debe llamarse desde un clic (gesto del usuario). */
  startMic: () => Promise<void>;
  stopMic: () => void;
  getRuntime: () => SpectrumRuntime;
}

function emptyChallenges(): SpectrumRuntime["challenges"] {
  return {
    silbido: { done: false, progress: 0 },
    vocales: { done: false, progress: 0 },
    banda: { done: false, progress: 0 },
  };
}

/** Bordes de las columnas: lineal (como un analizador de laboratorio) o logarítmica (como oye el oído). */
export function bandEdges(scale: string, maxHz: number): Float32Array {
  const edges = new Float32Array(BANDS + 1);
  for (let i = 0; i <= BANDS; i++) {
    const t = i / BANDS;
    edges[i] =
      scale === "logaritmica"
        ? LOG_MIN_HZ * (maxHz / LOG_MIN_HZ) ** t
        : maxHz * t;
  }
  return edges;
}

/** Posición 0–1 de una frecuencia sobre el eje, con la misma escala que `bandEdges`. */
export function frequencyToUnit(hz: number, scale: string, maxHz: number): number {
  if (scale === "logaritmica") {
    if (hz <= LOG_MIN_HZ) return 0;
    return Math.min(1, Math.log(hz / LOG_MIN_HZ) / Math.log(maxHz / LOG_MIN_HZ));
  }
  return Math.min(1, Math.max(0, hz / maxHz));
}

export function createSpectrumEngine(): SpectrumEngine {
  let lastVariables: VariablesState = {};

  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let spectrumDb: Float32Array<ArrayBuffer> | null = null;
  let power: Float32Array | null = null;

  let rowClock = 0;
  /** Ruido de fondo estimado, en dB relativos. Baja rápido y sube lento. */
  let noiseFloorDb = Infinity;

  // Estado interno de los retos.
  let whistleHeld = 0;
  let vowelHeld = 0;
  let vowelBaselineDb = 0;
  let talkTime = 0;
  let energyInBand = 0;
  let energyTotal = 0;

  const runtime: SpectrumRuntime = {
    mic: "apagado",
    bands: new Float32Array(BANDS),
    history: new Float32Array(ROWS * BANDS),
    head: 0,
    edges: bandEdges("logaritmica", 4000),
    peakHz: 0,
    peakLevel: 0,
    active: false,
    tonal: false,
    phoneBandPct: 0,
    vowelStage: "u",
    challenges: emptyChallenges(),
  };

  function resetChallenges() {
    whistleHeld = 0;
    vowelHeld = 0;
    vowelBaselineDb = 0;
    talkTime = 0;
    energyInBand = 0;
    energyTotal = 0;
    runtime.phoneBandPct = 0;
    runtime.vowelStage = "u";
    runtime.challenges = emptyChallenges();
  }

  /** Energía (potencia lineal) entre dos frecuencias. */
  function energyBetween(loHz: number, hiHz: number, binHz: number): number {
    if (!power) return 0;
    const lo = Math.max(0, Math.floor(loHz / binHz));
    const hi = Math.min(power.length - 1, Math.ceil(hiHz / binHz));
    let sum = 0;
    for (let i = lo; i <= hi; i++) sum += power[i];
    return sum;
  }

  function analyse(dt: number) {
    if (!analyser || !spectrumDb || !power || !context) return;
    analyser.getFloatFrequencyData(spectrumDb);

    const binHz = context.sampleRate / analyser.fftSize;
    for (let i = 0; i < spectrumDb.length; i++) {
      // -Infinity llega cuando un bin está en silencio absoluto.
      const db = Number.isFinite(spectrumDb[i]) ? spectrumDb[i] : -160;
      power[i] = 10 ** (db / 10);
    }

    // --- Columnas para dibujar --------------------------------------------
    const scale = String(lastVariables.escala ?? "logaritmica");
    const maxHz = Number(lastVariables.frecuencia_max ?? 4000);
    const sensitivity = Number(lastVariables.sensibilidad ?? 0);
    runtime.edges = bandEdges(scale, maxHz);

    for (let b = 0; b < BANDS; b++) {
      const lo = Math.floor(runtime.edges[b] / binHz);
      // Al menos un bin por columna: en la escala log, las columnas graves
      // son más angostas que un bin y quedarían vacías.
      const hi = Math.max(lo, Math.floor(runtime.edges[b + 1] / binHz));
      let maxDb = -160;
      for (let i = lo; i <= hi && i < spectrumDb.length; i++) {
        const db = Number.isFinite(spectrumDb[i]) ? spectrumDb[i] : -160;
        if (db > maxDb) maxDb = db;
      }
      const level = (maxDb - DISPLAY_MIN_DB + sensitivity) / DISPLAY_RANGE_DB;
      runtime.bands[b] = Math.min(1, Math.max(0, level));
    }

    // --- Medidas para los retos --------------------------------------------
    const loBin = Math.floor(ANALYSIS_MIN_HZ / binHz);
    const hiBin = Math.min(power.length - 1, Math.ceil(ANALYSIS_MAX_HZ / binHz));
    let total = 0;
    let peakBin = loBin;
    for (let i = loBin; i <= hiBin; i++) {
      total += power[i];
      if (power[i] > power[peakBin]) peakBin = i;
    }

    const levelDb = 10 * Math.log10(total + 1e-20);
    // Ruido de fondo: sigue al nivel enseguida si baja, y sube muy despacio
    // (3 dB por segundo), así hablar no lo arrastra hacia arriba.
    if (levelDb < noiseFloorDb) noiseFloorDb = levelDb;
    else noiseFloorDb += Math.min(levelDb - noiseFloorDb, 3 * dt);
    runtime.active =
      levelDb > noiseFloorDb + ACTIVE_ABOVE_FLOOR_DB ||
      levelDb > ACTIVE_ABSOLUTE_DB;

    let peakEnergy = 0;
    for (let i = peakBin - 2; i <= peakBin + 2; i++) {
      if (i >= 0 && i < power.length) peakEnergy += power[i];
    }
    runtime.peakHz = peakBin * binHz;
    const singlePeak = runtime.active && peakEnergy / total > TONAL_DOMINANCE;
    const peakColumn = runtime.edges.findIndex((edge) => edge > runtime.peakHz);
    runtime.peakLevel =
      peakColumn > 0 ? runtime.bands[Math.min(BANDS - 1, peakColumn - 1)] : 0;

    const { silbido, vocales, banda } = runtime.challenges;

    // Un solo pico AGUDO es un silbido (un tono puro). Un solo pico grave, en
    // cambio, suele ser voz: una "u" sostenida concentra casi toda su energía
    // en un armónico cerca de 300 Hz. Por eso la voz se distingue del silbido
    // por la frecuencia, no solo por la pureza.
    runtime.tonal =
      singlePeak && runtime.peakHz > 500 && runtime.peakHz < 4500;
    const isWhistle = runtime.tonal;

    // Reto 1 — silbido: un solo pico, sostenido.
    if (!silbido.done) {
      whistleHeld = isWhistle ? whistleHeld + dt : Math.max(0, whistleHeld - dt);
      silbido.progress = Math.min(1, whistleHeld / WHISTLE_HOLD_S);
      silbido.done = whistleHeld >= WHISTLE_HOLD_S;
    }

    // Reto 2 — vocales: la "i" tiene el segundo formante alto (~2300 Hz) y la
    // "u" no (~800 Hz). Se mide la energía aguda RELATIVA a la grave, y se
    // compara la "i" contra la "u" del mismo jugador: así no depende del
    // micrófono ni de la voz de cada uno.
    if (!vocales.done && runtime.active && !isWhistle) {
      const high = energyBetween(1800, 3200, binHz);
      const low = energyBetween(200, 1000, binHz);
      const tiltDb = 10 * Math.log10((high + 1e-20) / (low + 1e-20));

      if (runtime.vowelStage === "u") {
        vowelHeld += dt;
        // Promedio móvil de la "u" mientras la sostiene.
        vowelBaselineDb += (tiltDb - vowelBaselineDb) * Math.min(1, dt * 4);
        vocales.progress = 0.5 * Math.min(1, vowelHeld / VOWEL_HOLD_S);
        if (vowelHeld >= VOWEL_HOLD_S) {
          runtime.vowelStage = "i";
          vowelHeld = 0;
        }
      } else {
        const risen = tiltDb > vowelBaselineDb + VOWEL_RISE_DB;
        vowelHeld = risen ? vowelHeld + dt : Math.max(0, vowelHeld - dt);
        vocales.progress = 0.5 + 0.5 * Math.min(1, vowelHeld / VOWEL_HOLD_S);
        vocales.done = vowelHeld >= VOWEL_HOLD_S;
      }
    } else if (!vocales.done && runtime.vowelStage === "u" && !runtime.active) {
      // Si se calla antes de completar la "u", se empieza de nuevo.
      vowelHeld = Math.max(0, vowelHeld - dt);
      vocales.progress = 0.5 * Math.min(1, vowelHeld / VOWEL_HOLD_S);
    }

    // Reto 3 — banda telefónica: cuánta de tu voz cabe entre 300 y 3400 Hz.
    if (runtime.active && !isWhistle) {
      talkTime += dt;
      energyInBand += energyBetween(PHONE_BAND[0], PHONE_BAND[1], binHz);
      energyTotal += total;
      runtime.phoneBandPct = (100 * energyInBand) / (energyTotal + 1e-20);
      banda.progress = Math.min(1, talkTime / BAND_TALK_S);
      banda.done = talkTime >= BAND_TALK_S;
    }

    // --- Cascada -------------------------------------------------------------
    rowClock += dt;
    if (rowClock >= ROW_INTERVAL) {
      rowClock -= ROW_INTERVAL;
      runtime.head = (runtime.head + 1) % ROWS;
      runtime.history.set(runtime.bands, runtime.head * BANDS);
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      runtime.edges = bandEdges(
        String(variables.escala ?? "logaritmica"),
        Number(variables.frecuencia_max ?? 4000),
      );
    },

    update(dt, variables) {
      lastVariables = variables;
      if (runtime.mic === "escuchando") analyse(dt);
    },

    reset() {
      resetChallenges();
      runtime.history.fill(0);
      runtime.bands.fill(0);
    },

    async startMic() {
      if (runtime.mic === "escuchando" || runtime.mic === "pidiendo") return;
      // Sin contexto seguro (HTTPS o localhost) el navegador ni expone la API.
      if (!navigator.mediaDevices?.getUserMedia) {
        runtime.mic = "sin-soporte";
        return;
      }

      runtime.mic = "pidiendo";
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Todo el procesamiento de voz apagado: la supresión de ruido trata
          // un silbido como ruido y lo borra, y el control automático de
          // ganancia aplana justamente lo que se quiere ver.
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        runtime.mic = "sin-permiso";
        return;
      }

      context = new AudioContext();
      await context.resume();
      analyser = context.createAnalyser();
      // 4096 puntos a 48 kHz: bins de ~12 Hz, suficiente para separar los
      // armónicos de una voz grave.
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.55;
      // El analizador NO se conecta a los parlantes: si sonara, el micrófono
      // se escucharía a sí mismo y acoplaría.
      context.createMediaStreamSource(stream).connect(analyser);
      spectrumDb = new Float32Array(analyser.frequencyBinCount);
      power = new Float32Array(analyser.frequencyBinCount);
      noiseFloorDb = Infinity;
      runtime.mic = "escuchando";
    },

    stopMic() {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      stream = null;
      context = null;
      analyser = null;
      runtime.mic = "apagado";
      runtime.active = false;
      runtime.tonal = false;
      runtime.bands.fill(0);
    },

    resetChallenges,

    getChallenges(): ChallengeStatus[] {
      const { silbido, vocales, banda } = runtime.challenges;
      return [
        {
          id: "silbido",
          title: "Silba",
          detail: silbido.done
            ? "Un solo pico: eso es un tono puro."
            : "Un tono puro deja un solo pico.",
          ...silbido,
        },
        {
          id: "vocales",
          title: vocales.done
            ? "De «u» a «i»"
            : runtime.vowelStage === "u"
              ? "Di «uuu»…"
              : "…y ahora «iii»",
          detail: vocales.done
            ? "La «i» sube el segundo formante a ~2300 Hz."
            : runtime.vowelStage === "u"
              ? "Sostén la u un segundo."
              : "Mira cómo aparece energía arriba de 2 kHz.",
          ...vocales,
        },
        {
          id: "banda",
          title: "Habla 3 segundos",
          detail:
            banda.progress > 0
              ? `${runtime.phoneBandPct.toFixed(0)} % de tu voz cabe en la banda telefónica.`
              : "¿Cuánto de tu voz cabe en 300–3400 Hz?",
          ...banda,
        },
      ];
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // El espectro actual, para la mini gráfica del panel de resultados.
      return Array.from(runtime.bands, (level, b) => ({
        x: Math.round((runtime.edges[b] + runtime.edges[b + 1]) / 2),
        y: level,
      }));
    },

    getState(): AIContext {
      const { silbido, vocales, banda } = runtime.challenges;
      const listening = runtime.mic === "escuchando";
      return {
        experimentName: "Tu voz en el espectro",
        disciplineName: "Redes",
        variables: lastVariables,
        result: listening
          ? {
              microfono: "encendido",
              frecuencia_pico_hz: Math.round(runtime.peakHz),
              sonando: runtime.active ? "sí" : "no",
              tono_puro: runtime.tonal ? "sí" : "no",
              ...(banda.progress > 0
                ? { voz_en_banda_telefonica_pct: Number(runtime.phoneBandPct.toFixed(1)) }
                : {}),
              reto_silbido: silbido.done ? "logrado" : "pendiente",
              reto_vocales: vocales.done
                ? "logrado"
                : `pendiente, etapa ${runtime.vowelStage}`,
              reto_banda_telefonica: banda.done ? "logrado" : "pendiente",
            }
          : { microfono: runtime.mic },
        conceptTags: [
          "dominio de la frecuencia",
          "transformada de Fourier",
          "espectro de la voz",
          "formantes",
          "ancho de banda telefónico",
        ],
      };
    },
  };
}
