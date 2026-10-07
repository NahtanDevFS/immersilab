import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * F4 · El sintonizador — PLAN_DESARROLLO.md §3.1.
 *
 * Tres osciladores (amplitud, frecuencia, fase) se suman y la suma tiene que
 * reproducir una onda objetivo. Es el puente con Redes: la idea de que una
 * señal complicada es una suma de senoidales es la base de Fourier, del
 * espectro (R6) y de la modulación (R1).
 *
 * Las frecuencias están en "ciclos por segundo" de la ventana de tiempo que
 * se dibuja (WINDOW_S). El audio las multiplica por AUDIO_BASE_HZ para que
 * caigan en el rango audible.
 */

/** Ventana de tiempo dibujada y usada para medir el ajuste, en segundos. */
export const WINDOW_S = 2;
/** f = 1 suena a 110 Hz (un La grave). Mantiene las proporciones entre armónicos. */
export const AUDIO_BASE_HZ = 110;
/** Ajuste mínimo para dar por logrado un objetivo. */
export const FIT_GOAL = 0.95;
const HOLD_S = 1;
const SAMPLES = 400;

export interface Component {
  amplitude: number;
  frequency: number;
  /** Fase en grados. */
  phase: number;
}

export interface Target {
  id: string;
  label: string;
  /** Pista corta para la tarjeta del reto. */
  hint: string;
  components: Component[];
}

export const TARGETS: Target[] = [
  {
    id: "simple",
    label: "Una sola onda",
    hint: "Una senoidal: alcanza con un oscilador.",
    components: [{ amplitude: 0.8, frequency: 2, phase: 0 }],
  },
  {
    id: "batido",
    label: "Batido",
    hint: "Dos frecuencias muy cercanas: la envolvente late.",
    components: [
      { amplitude: 0.5, frequency: 4, phase: 0 },
      { amplitude: 0.5, frequency: 5, phase: 0 },
    ],
  },
  {
    id: "cuadrada",
    label: "Onda cuadrada",
    hint: "Armónicos impares: 1, 3, 5… cada uno más chico.",
    // Serie de Fourier de la cuadrada: sen(x) + sen(3x)/3 + sen(5x)/5.
    components: [
      { amplitude: 0.9, frequency: 1, phase: 0 },
      { amplitude: 0.3, frequency: 3, phase: 0 },
      { amplitude: 0.18, frequency: 5, phase: 0 },
    ],
  },
  {
    id: "sierra",
    label: "Onda de sierra",
    hint: "Todos los armónicos: 1, 2, 3… con signos alternados.",
    // Serie de Fourier de la sierra: sen(x) − sen(2x)/2 + sen(3x)/3. El
    // signo menos es una fase de 180°.
    components: [
      { amplitude: 0.9, frequency: 1, phase: 0 },
      { amplitude: 0.45, frequency: 2, phase: 180 },
      { amplitude: 0.3, frequency: 3, phase: 0 },
    ],
  },
];

export function getTarget(id: string | number | boolean): Target {
  return TARGETS.find((t) => t.id === String(id)) ?? TARGETS[0];
}

/** Valor de una suma de senoidales en el instante t (segundos). */
export function sumAt(components: Component[], t: number): number {
  let y = 0;
  for (const c of components) {
    y += c.amplitude * Math.sin(2 * Math.PI * c.frequency * t + (c.phase * Math.PI) / 180);
  }
  return y;
}

/**
 * Ajuste 0–1 entre la suma y el objetivo: 1 − (error RMS / RMS del objetivo).
 * Relativo al objetivo para que el porcentaje signifique lo mismo en una onda
 * chica que en una grande.
 */
export function fitBetween(player: Component[], target: Component[]): number {
  let errorSq = 0;
  let targetSq = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (WINDOW_S * i) / SAMPLES;
    const goal = sumAt(target, t);
    const diff = sumAt(player, t) - goal;
    errorSq += diff * diff;
    targetSq += goal * goal;
  }
  return Math.max(0, 1 - Math.sqrt(errorSq / Math.max(targetSq, 1e-9)));
}

export function playerComponents(variables: VariablesState): Component[] {
  return [1, 2, 3].map((i) => ({
    amplitude: Number(variables[`a${i}`] ?? 0),
    frequency: Number(variables[`f${i}`] ?? 1),
    phase: Number(variables[`p${i}`] ?? 0),
  }));
}

export interface WavesRuntime {
  target: Target;
  components: Component[];
  fit: number;
  /** Tiempo de animación: las ondas se desplazan para que se vean vivas. */
  clock: number;
  audioOn: boolean;
  challenges: Record<string, { done: boolean; progress: number }>;
}

export interface WavesEngine extends ExperimentEngine {
  startAudio: () => Promise<void>;
  stopAudio: () => void;
  getRuntime: () => WavesRuntime;
}

export function createWavesEngine(): WavesEngine {
  let lastVariables: VariablesState = {};
  const held: Record<string, number> = {};

  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let voices: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

  const runtime: WavesRuntime = {
    target: TARGETS[0],
    components: playerComponents({}),
    fit: 0,
    clock: 0,
    audioOn: false,
    challenges: Object.fromEntries(
      TARGETS.map((t) => [t.id, { done: false, progress: 0 }]),
    ),
  };

  function read(variables: VariablesState) {
    runtime.target = getTarget(variables.objetivo ?? "simple");
    runtime.components = playerComponents(variables);
    runtime.fit = fitBetween(runtime.components, runtime.target.components);
  }

  function updateAudio() {
    if (!context || !master) return;
    const now = context.currentTime;
    runtime.components.forEach((c, i) => {
      const voice = voices[i];
      if (!voice) return;
      voice.osc.frequency.setTargetAtTime(Math.max(1, c.frequency * AUDIO_BASE_HZ), now, 0.02);
      // Dividido por 3: con los tres osciladores a tope, la suma no satura.
      voice.gain.gain.setTargetAtTime(c.amplitude / 3, now, 0.02);
    });
    // Ducking: mientras habla el tutor o la explicación, el sonido baja.
    const speaking = typeof window !== "undefined" && window.speechSynthesis?.speaking;
    master.gain.setTargetAtTime(speaking ? 0.06 : 0.3, now, 0.1);
  }

  return {
    init(variables) {
      lastVariables = variables;
      read(variables);
    },

    update(dt, variables) {
      lastVariables = variables;
      read(variables);
      runtime.clock += dt;

      const id = runtime.target.id;
      const challenge = runtime.challenges[id];
      if (!challenge.done) {
        const ok = runtime.fit >= FIT_GOAL;
        held[id] = ok ? (held[id] ?? 0) + dt : Math.max(0, (held[id] ?? 0) - dt);
        challenge.progress = Math.min(1, held[id] / HOLD_S);
        challenge.done = held[id] >= HOLD_S;
      }

      if (runtime.audioOn) updateAudio();
    },

    reset() {
      for (const key of Object.keys(runtime.challenges)) {
        runtime.challenges[key] = { done: false, progress: 0 };
        held[key] = 0;
      }
    },

    async startAudio() {
      if (runtime.audioOn) return;
      context = new AudioContext();
      await context.resume();
      master = context.createGain();
      master.gain.value = 0.3;
      master.connect(context.destination);
      voices = runtime.components.map(() => {
        const osc = context!.createOscillator();
        const gain = context!.createGain();
        gain.gain.value = 0;
        osc.connect(gain).connect(master!);
        osc.start();
        return { osc, gain };
      });
      runtime.audioOn = true;
      updateAudio();
    },

    stopAudio() {
      voices.forEach((v) => v.osc.stop());
      void context?.close();
      voices = [];
      context = null;
      master = null;
      runtime.audioOn = false;
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // La diferencia entre tu suma y el objetivo: plana cuando ya calza.
      return Array.from({ length: 101 }, (_, i) => {
        const t = (WINDOW_S * i) / 100;
        return {
          x: Number(t.toFixed(2)),
          y: sumAt(runtime.components, t) - sumAt(runtime.target.components, t),
        };
      });
    },

    getState(): AIContext {
      const done = Object.entries(runtime.challenges)
        .filter(([, c]) => c.done)
        .map(([id]) => getTarget(id).label);
      return {
        experimentName: "El sintonizador",
        disciplineName: "Física",
        variables: lastVariables,
        result: {
          objetivo: runtime.target.label,
          ajuste_pct: Math.round(runtime.fit * 100),
          logrado: runtime.challenges[runtime.target.id].done ? "sí" : "no",
          objetivos_logrados: done.length ? done.join(", ") : "ninguno",
          audio: runtime.audioOn ? "encendido" : "apagado",
        },
        conceptTags: [
          "superposición",
          "interferencia",
          "batido",
          "series de Fourier",
          "armónicos",
        ],
      };
    },
  };
}
