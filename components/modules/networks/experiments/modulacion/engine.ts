import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * R1 · Sintoniza la emisora — PLAN_DESARROLLO.md §3.3.
 *
 * Modela una banda de radio con varias emisoras y un receptor. El jugador
 * maneja las dos puntas: la emisora propia (tipo AM/FM, índice de
 * modulación, tono de la moduladora) y el dial del receptor.
 *
 * No se modula de verdad a radiofrecuencia: el navegador no puede, y no hace
 * falta. Lo que se calcula es lo que el receptor recibiría — qué tan dentro
 * del canal está la emisora (`clarity`), si hay sobremodulación, el ancho de
 * banda y el espectro — y con eso se mezcla el audio: tono limpio cuando
 * sintoniza, estática cuando no.
 */

export type RadioBand = "am" | "fm";

export interface Station {
  id: string;
  name: string;
  band: RadioBand;
  /** Portadora: kHz en AM, MHz en FM. */
  carrier: number;
  /** Tono que transmite (Hz). La emisora propia usa el de las variables. */
  tone: number;
  /** ¿Es la emisora que controla el jugador? */
  own: boolean;
}

export const STATIONS: Station[] = [
  { id: "am-610", name: "La Voz 610", band: "am", carrier: 610, tone: 330, own: false },
  { id: "am-umg", name: "Radio UMG", band: "am", carrier: 1040, tone: 0, own: true },
  { id: "am-1350", name: "Onda Sur", band: "am", carrier: 1350, tone: 520, own: false },
  { id: "fm-89", name: "Estéreo 89.7", band: "fm", carrier: 89.7, tone: 392, own: false },
  { id: "fm-umg", name: "UMG FM", band: "fm", carrier: 95.3, tone: 0, own: true },
  { id: "fm-104", name: "Ritmo 104.1", band: "fm", carrier: 104.1, tone: 587, own: false },
];

/** Límites de cada banda comercial, en su unidad (kHz o MHz). */
export const BAND_RANGE: Record<RadioBand, [number, number]> = {
  am: [530, 1700],
  fm: [88, 108],
};

/** Ancho del canal del receptor, en kHz: 10 en AM, 200 en FM. */
export const CHANNEL_KHZ: Record<RadioBand, number> = { am: 10, fm: 200 };

/** Desviación de la emisora vecina que se considera "otra emisora" (para el dibujo y la mezcla). */
const OTHER_INDEX: Record<RadioBand, number> = { am: 0.5, fm: 2 };

const TUNE_HOLD_S = 1.5;
const MOD_HOLD_S = 1;
/** Calidad mínima para considerar sintonizada una emisora. */
const TUNED_CLARITY = 0.85;

export interface ChallengeProgress {
  done: boolean;
  progress: number;
}

export interface ModulationRuntime {
  band: RadioBand;
  /** Frecuencia del dial en la unidad de la banda (kHz o MHz). */
  dial: number;
  /** Emisora más cercana al dial (aunque no esté sintonizada). */
  nearest: Station;
  /** 0–1: qué tanto de la emisora entra limpio en el canal del receptor. */
  clarity: number;
  /** ¿Se sintonizó bien una emisora? */
  tuned: boolean;
  /** Índice de modulación actual (m en AM, β en FM). */
  index: number;
  /** Tono de la moduladora de la emisora propia, en Hz. */
  tone: number;
  /** Ancho de banda de la emisora propia, en kHz. */
  bandwidthKhz: number;
  overmodulated: boolean;
  /** Tiempo de animación, para las ondas. */
  clock: number;
  audioOn: boolean;
  challenges: {
    sintonizar_am: ChallengeProgress;
    modular_100: ChallengeProgress;
    sintonizar_fm: ChallengeProgress;
  };
}

export interface ModulationEngine extends ExperimentEngine {
  startAudio: () => Promise<void>;
  stopAudio: () => void;
  getRuntime: () => ModulationRuntime;
}

/**
 * Del dial 0–100 más el ajuste fino (−1 a 1) a la frecuencia de la banda.
 *
 * El ajuste fino existe por la misma razón que en una radio de verdad: en AM
 * el dial recorre 1170 kHz y el canal mide 10. Con un slider de ~200 px, cada
 * píxel del dial grueso son ~6 kHz y sintonizar solo con él era imposible. El
 * fino cubre ±2 canales (±20 kHz en AM, ±400 kHz en FM) con 200 pasos.
 */
export function dialToFrequency(dial: number, band: RadioBand, fine = 0): number {
  const [lo, hi] = BAND_RANGE[band];
  const fineSpanKhz = 2 * CHANNEL_KHZ[band] * fine;
  const fineSpan = band === "fm" ? fineSpanKhz / 1000 : fineSpanKhz;
  return lo + (hi - lo) * (dial / 100) + fineSpan;
}

export function formatFrequency(value: number, band: RadioBand): string {
  return band === "am"
    ? `${Math.round(value)} kHz`
    : `${value.toFixed(1)} MHz`;
}

/** Diferencia entre dos frecuencias de la banda, en kHz. */
function offsetKhz(a: number, b: number, band: RadioBand): number {
  return Math.abs(a - b) * (band === "fm" ? 1000 : 1);
}

/** Función de Bessel de primera especie J_n(x), por su serie. Alcanza para x ≤ 5. */
export function besselJ(n: number, x: number): number {
  let sum = 0;
  let factK = 1;
  for (let k = 0; k < 25; k++) {
    if (k > 0) factK *= k;
    let factKn = 1;
    for (let i = 2; i <= k + n; i++) factKn *= i;
    sum += ((k % 2 === 0 ? 1 : -1) * (x / 2) ** (2 * k + n)) / (factK * factKn);
  }
  return sum;
}

/**
 * Componentes espectrales de una emisora: [frecuencia en kHz relativa a la
 * portadora, amplitud]. AM: portadora y dos bandas laterales de altura m/2.
 * FM: rayas en múltiplos del tono, con alturas |J_n(β)|.
 */
export function spectralLines(
  band: RadioBand,
  index: number,
  toneHz: number,
): Array<[number, number]> {
  const fmKhz = toneHz / 1000;
  if (band === "am") {
    return [
      [-fmKhz, index / 2],
      [0, 1],
      [fmKhz, index / 2],
    ];
  }
  const lines: Array<[number, number]> = [];
  for (let n = -8; n <= 8; n++) {
    const amplitude = Math.abs(besselJ(Math.abs(n), index));
    if (amplitude > 0.01) lines.push([n * fmKhz, amplitude]);
  }
  return lines;
}

/** Ancho de banda en kHz: 2·fm en AM; regla de Carson 2(β+1)·fm en FM. */
export function bandwidthKhz(band: RadioBand, index: number, toneHz: number) {
  const fmKhz = toneHz / 1000;
  return band === "am" ? 2 * fmKhz : 2 * (index + 1) * fmKhz;
}

export function createModulationEngine(): ModulationEngine {
  let lastVariables: VariablesState = {};

  let context: AudioContext | null = null;
  let toneOsc: OscillatorNode | null = null;
  let toneGain: GainNode | null = null;
  let shaper: WaveShaperNode | null = null;
  let noiseGain: GainNode | null = null;
  let master: GainNode | null = null;
  let noiseSource: AudioBufferSourceNode | null = null;
  let shaperAmount = -1;

  let tuneAmHeld = 0;
  let modHeld = 0;
  let tuneFmHeld = 0;

  const runtime: ModulationRuntime = {
    band: "am",
    dial: 530,
    nearest: STATIONS[0],
    clarity: 0,
    tuned: false,
    index: 0.5,
    tone: 440,
    bandwidthKhz: 0.88,
    overmodulated: false,
    clock: 0,
    audioOn: false,
    challenges: {
      sintonizar_am: { done: false, progress: 0 },
      modular_100: { done: false, progress: 0 },
      sintonizar_fm: { done: false, progress: 0 },
    },
  };

  /** Curva de saturación: es lo que se oye cuando la envolvente AM se corta. */
  function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(1024);
    const k = amount * 60;
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function readVariables(variables: VariablesState) {
    runtime.band = variables.tipo === "fm" ? "fm" : "am";
    runtime.dial = dialToFrequency(
      Number(variables.dial ?? 50),
      runtime.band,
      Number(variables.ajuste_fino ?? 0),
    );
    runtime.index = Number(variables.indice ?? 0.5);
    runtime.tone = Number(variables.tono ?? 440);
  }

  function evaluate() {
    const { band, dial } = runtime;
    const stations = STATIONS.filter((s) => s.band === band);
    runtime.nearest = stations.reduce((best, s) =>
      offsetKhz(s.carrier, dial, band) < offsetKhz(best.carrier, dial, band) ? s : best,
    );

    // Calidad: 1 con la portadora centrada en el canal, 0 a medio canal de
    // distancia. Curva de techo plano (1 − x²): cerca del centro perdona,
    // como el filtro de un receptor real, y cae rápido hacia el borde.
    // "Sintonizada" (≥ 0.85) queda a menos de ~0.39 medio canal: ±1.9 kHz en
    // AM, ±39 kHz en FM.
    const halfChannel = CHANNEL_KHZ[band] / 2;
    const offset = offsetKhz(runtime.nearest.carrier, dial, band);
    runtime.clarity = Math.max(0, 1 - (offset / halfChannel) ** 2);
    runtime.tuned = runtime.clarity >= TUNED_CLARITY;

    runtime.bandwidthKhz = bandwidthKhz(band, runtime.index, runtime.tone);
    runtime.overmodulated = band === "am" && runtime.index > 1;
  }

  function updateChallenges(dt: number) {
    const own = runtime.nearest.own && runtime.tuned;
    const { sintonizar_am, modular_100, sintonizar_fm } = runtime.challenges;

    const hold = (held: number, ok: boolean) =>
      ok ? held + dt : Math.max(0, held - dt);

    if (!sintonizar_am.done) {
      tuneAmHeld = hold(tuneAmHeld, own && runtime.band === "am");
      sintonizar_am.progress = Math.min(1, tuneAmHeld / TUNE_HOLD_S);
      sintonizar_am.done = tuneAmHeld >= TUNE_HOLD_S;
    }
    if (!modular_100.done) {
      const ok =
        own && runtime.band === "am" && runtime.index >= 0.9 && runtime.index <= 1;
      modHeld = hold(modHeld, ok);
      modular_100.progress = Math.min(1, modHeld / MOD_HOLD_S);
      modular_100.done = modHeld >= MOD_HOLD_S;
    }
    if (!sintonizar_fm.done) {
      tuneFmHeld = hold(tuneFmHeld, own && runtime.band === "fm");
      sintonizar_fm.progress = Math.min(1, tuneFmHeld / TUNE_HOLD_S);
      sintonizar_fm.done = tuneFmHeld >= TUNE_HOLD_S;
    }
  }

  function updateAudio() {
    if (!context || !toneOsc || !toneGain || !noiseGain || !master || !shaper) return;
    const now = context.currentTime;
    const station = runtime.nearest;
    const tone = station.own ? runtime.tone : station.tone;
    toneOsc.frequency.setTargetAtTime(tone, now, 0.02);

    // FM rechaza mejor el ruido que AM, y más cuanto mayor el índice: es la
    // ganancia que se paga con ancho de banda.
    const noiseFactor =
      runtime.band === "fm"
        ? 1 / (1 + (station.own ? runtime.index : OTHER_INDEX.fm))
        : 1;
    const signal = runtime.clarity;
    const noise = (1 - runtime.clarity) * 0.5 + 0.04 * noiseFactor;

    toneGain.gain.setTargetAtTime(signal * 0.35, now, 0.03);
    noiseGain.gain.setTargetAtTime(noise * noiseFactor, now, 0.03);

    const overdrive =
      station.own && runtime.overmodulated ? Math.min(1, runtime.index - 1) : 0;
    const rounded = Math.round(overdrive * 20) / 20;
    if (rounded !== shaperAmount) {
      shaperAmount = rounded;
      shaper.curve = distortionCurve(rounded);
    }

    // Ducking: mientras habla el tutor (o la explicación), la radio baja al
    // 20 % para que se le entienda.
    const speaking =
      typeof window !== "undefined" && window.speechSynthesis?.speaking;
    master.gain.setTargetAtTime(speaking ? 0.2 : 1, now, 0.1);
  }

  return {
    init(variables) {
      lastVariables = variables;
      readVariables(variables);
      evaluate();
    },

    update(dt, variables) {
      lastVariables = variables;
      readVariables(variables);
      evaluate();
      updateChallenges(dt);
      runtime.clock += dt;
      if (runtime.audioOn) updateAudio();
    },

    reset() {
      tuneAmHeld = 0;
      modHeld = 0;
      tuneFmHeld = 0;
      for (const challenge of Object.values(runtime.challenges)) {
        challenge.done = false;
        challenge.progress = 0;
      }
    },

    async startAudio() {
      if (runtime.audioOn) return;
      context = new AudioContext();
      await context.resume();

      master = context.createGain();
      master.connect(context.destination);

      // Señal: el tono de la moduladora, ya "demodulado", pasando por la
      // saturación que simula la sobremodulación.
      toneOsc = context.createOscillator();
      toneOsc.type = "sine";
      shaper = context.createWaveShaper();
      shaper.curve = distortionCurve(0);
      shaperAmount = 0;
      toneGain = context.createGain();
      toneGain.gain.value = 0;
      toneOsc.connect(shaper).connect(toneGain).connect(master);
      toneOsc.start();

      // Estática: ruido blanco filtrado a la banda de audio de una radio.
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noiseSource = context.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      const bandpass = context.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 1800;
      bandpass.Q.value = 0.6;
      noiseGain = context.createGain();
      noiseGain.gain.value = 0;
      noiseSource.connect(bandpass).connect(noiseGain).connect(master);
      noiseSource.start();

      runtime.audioOn = true;
      updateAudio();
    },

    stopAudio() {
      noiseSource?.stop();
      toneOsc?.stop();
      void context?.close();
      context = null;
      toneOsc = null;
      toneGain = null;
      shaper = null;
      noiseGain = null;
      master = null;
      noiseSource = null;
      runtime.audioOn = false;
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // La señal modulada de la emisora propia, para la mini gráfica.
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const mod = Math.sin(2 * Math.PI * 3 * t);
        const y =
          runtime.band === "am"
            ? (1 + runtime.index * mod) * Math.sin(2 * Math.PI * 30 * t)
            : Math.sin(2 * Math.PI * 30 * t + runtime.index * 4 * Math.sin(2 * Math.PI * 3 * t));
        points.push({ x: i, y });
      }
      return points;
    },

    getState(): AIContext {
      const { sintonizar_am, modular_100, sintonizar_fm } = runtime.challenges;
      return {
        experimentName: "Sintoniza la emisora",
        disciplineName: "Redes",
        variables: lastVariables,
        result: {
          frecuencia_del_dial: formatFrequency(runtime.dial, runtime.band),
          emisora_mas_cercana: `${runtime.nearest.name} (${formatFrequency(runtime.nearest.carrier, runtime.band)})`,
          calidad_pct: Math.round(runtime.clarity * 100),
          sintonizada: runtime.tuned ? "sí" : "no",
          ancho_de_banda_khz: Number(runtime.bandwidthKhz.toFixed(2)),
          canal_del_receptor_khz: CHANNEL_KHZ[runtime.band],
          ...(runtime.overmodulated ? { alerta: "¡Sobremodulación!" } : {}),
          reto_sintonizar_am: sintonizar_am.done ? "logrado" : "pendiente",
          reto_modular_100: modular_100.done ? "logrado" : "pendiente",
          reto_sintonizar_fm: sintonizar_fm.done ? "logrado" : "pendiente",
        },
        conceptTags: [
          "modulación AM",
          "modulación FM",
          "índice de modulación",
          "ancho de banda",
          "bandas laterales",
        ],
      };
    },
  };
}
