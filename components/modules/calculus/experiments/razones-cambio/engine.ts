import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * Motor de "Llena el tanque" (razones de cambio relacionadas).
 *
 * Tres situaciones donde dos cantidades están unidas por una ecuación:
 * - cono invertido de 2 m de alto y 1 m de radio arriba: r = h/2, así que
 *   V = πh³/12 y, derivando, dh/dt = 4Q/(πh²);
 * - cilindro de 0.5 m de radio: V = πr²h y dh/dt = Q/(πr²), constante;
 * - escalera de 5 m: x² + y² = L², así que dy/dt = −(x/y)·dx/dt.
 *
 * Lo que se integra es lo que de verdad cambia (el volumen con el caudal, la
 * base con su velocidad) y la otra cantidad se despeja de la ecuación: así
 * la rapidez que se ve en la escena sale del modelo, no de la fórmula que el
 * estudiante tiene que encontrar.
 */

export type Scenario = "cono" | "cilindro" | "escalera";

export const CONE_HEIGHT = 2;
export const CONE_RADIUS = 1;
export const CYLINDER_RADIUS = 0.5;
export const CYLINDER_HEIGHT = 2;
export const LADDER = 5;
/** Dónde arranca la base de la escalera, m. */
export const LADDER_START_X = 0.5;
/** La escalera se detiene antes de quedar acostada (y → 0 hace dy/dt infinito). */
export const LADDER_MAX_X = 4.9;

/** Error relativo máximo para que una predicción cuente como acierto. */
export const HIT_ERROR = 0.05;
/** Cuánto dura en pantalla un intento, s: el tiempo del modelo se acelera para caber. */
const TARGET_WALL_SECONDS = 6;
/** Con cámara lenta, la última décima del camino va cuatro veces más lento. */
const SLOW_FACTOR = 4;

export function getScenario(value: unknown): Scenario {
  return value === "cilindro" || value === "escalera" ? value : "cono";
}

/** Altura del agua en el cono para un volumen dado, m. */
export function coneHeight(volume: number): number {
  return Math.cbrt((12 * volume) / Math.PI);
}

export function coneVolume(h: number): number {
  return (Math.PI * h ** 3) / 12;
}

/** dh/dt en el cono a la altura h, m/s (Q en m³/s). */
export function coneRate(q: number, h: number): number {
  return (4 * q) / (Math.PI * h * h);
}

export function cylinderRate(q: number): number {
  return q / (Math.PI * CYLINDER_RADIUS ** 2);
}

/** dy/dt de la punta de la escalera con la base en x, m/s (negativa: baja). */
export function ladderRate(v: number, x: number): number {
  return -(x / Math.sqrt(LADDER ** 2 - x ** 2)) * v;
}

/** Puntaje: 100 menos el error relativo en %, con signo incluido. */
export function predictionScore(predicted: number, actual: number): number {
  if (actual === 0) return 0;
  const error = Math.abs(predicted - actual) / Math.abs(actual);
  return Math.max(0, Math.round(100 - error * 100));
}

export type Phase = "idle" | "running" | "done";

export interface Attempt {
  scenario: Scenario;
  caudal: number;
  meta: number;
  /** Predicción congelada al empezar, cm/s. */
  predicted: number;
  /** La rapidez real al cruzar la meta, cm/s (null mientras corre). */
  actual: number | null;
  score: number | null;
  hit: boolean;
}

export interface RatesRuntime {
  scenario: Scenario;
  phase: Phase;
  /** Tiempo del modelo, s. */
  time: number;
  /** Tanques: volumen (m³) y altura (m). */
  volume: number;
  height: number;
  /** Escalera: base y punta, m. */
  x: number;
  y: number;
  /** Rapidez de la cantidad que se mide (dh/dt o dy/dt), m/s. */
  rate: number;
  /** El valor meta (altura o x) del intento en curso o del último. */
  goal: number;
  attempt: Attempt | null;
  /** Cuántas veces más rápido que el reloj real corre el modelo. */
  speedup: number;
  /** ¿Ya está en el tramo de cámara lenta? */
  slow: boolean;
}

export interface RatesEngine extends ExperimentEngine {
  start: () => void;
  getRuntime: () => RatesRuntime;
}

/** El enunciado de la situación, para la escena, el visor y el tutor. */
export function situation(variables: VariablesState): string {
  const scenario = getScenario(variables.escenario);
  const q = Number(variables.caudal ?? 10);
  const meta = Number(variables.altura_meta ?? 1);
  if (scenario === "cono") {
    return `Cono de 2 m de alto y 1 m de radio arriba, punta abajo. Entran ${q} L/s. ¿Qué tan rápido sube el agua cuando llega a ${meta.toFixed(1)} m? (cm/s)`;
  }
  if (scenario === "cilindro") {
    return `Cilindro de 0.5 m de radio. Entran ${q} L/s. ¿Qué tan rápido sube el agua cuando llega a ${meta.toFixed(1)} m? (cm/s)`;
  }
  const v = Number(variables.velocidad_base ?? 0.5);
  const x = Number(variables.x_meta ?? 3);
  return `Escalera de 5 m: la base se aleja de la pared a ${v.toFixed(1)} m/s. ¿Qué tan rápido se mueve la punta cuando la base está a ${x.toFixed(1)} m? (cm/s, negativo si baja)`;
}

export function createRatesEngine(): RatesEngine {
  let lastVariables: VariablesState = {};
  let series: Array<{ x: number; y: number }> = [];
  let sampleEvery = 0.1;

  const runtime: RatesRuntime = {
    scenario: "cono",
    phase: "idle",
    time: 0,
    volume: 0,
    height: 0,
    x: LADDER_START_X,
    y: Math.sqrt(LADDER ** 2 - LADDER_START_X ** 2),
    rate: 0,
    goal: 1,
    attempt: null,
    speedup: 1,
    slow: false,
  };

  // Retos.
  let coneHit = false;
  let cylinderHit = false;
  let ladderHit = false;
  let doubleHit = false;
  /** El último acierto en el cono (para "el doble de alto"); null si el último intento falló. */
  let lastConeHit: { caudal: number; meta: number } | null = null;
  let bestScore = 0;

  function scenarioOf(variables: VariablesState) {
    return getScenario(variables.escenario);
  }

  /** Vuelve al punto de partida del escenario actual (tanque vacío, escalera parada). */
  function rest() {
    runtime.phase = "idle";
    runtime.time = 0;
    runtime.volume = 0;
    runtime.height = 0;
    runtime.x = LADDER_START_X;
    runtime.y = Math.sqrt(LADDER ** 2 - LADDER_START_X ** 2);
    runtime.rate = 0;
    runtime.slow = false;
    series = [];
  }

  function updateRate(caudal: number, v: number) {
    const q = caudal / 1000;
    if (runtime.scenario === "cono") runtime.rate = runtime.height > 0.01 ? coneRate(q, runtime.height) : 0;
    else if (runtime.scenario === "cilindro") runtime.rate = cylinderRate(q);
    else runtime.rate = ladderRate(v, runtime.x);
  }

  function finish() {
    const a = runtime.attempt;
    if (!a) return;
    runtime.phase = "done";
    const actual = runtime.rate * 100;
    a.actual = actual;
    a.score = predictionScore(a.predicted, actual);
    a.hit = Math.abs(a.predicted - actual) <= HIT_ERROR * Math.abs(actual);
    bestScore = Math.max(bestScore, a.score);

    if (a.scenario === "cono") {
      if (a.hit && a.meta >= 1 - 1e-9) coneHit = true;
      if (a.hit) {
        if (lastConeHit && Math.abs(lastConeHit.caudal - a.caudal) < 1e-9) {
          const ratio = a.meta / lastConeHit.meta;
          if (Math.abs(ratio - 2) < 1e-6 || Math.abs(ratio - 0.5) < 1e-6) doubleHit = true;
        }
        lastConeHit = { caudal: a.caudal, meta: a.meta };
      } else {
        lastConeHit = null;
      }
    } else if (a.scenario === "cilindro") {
      if (a.hit) cylinderHit = true;
    } else if (a.hit && a.actual < 0) {
      ladderHit = true;
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      runtime.scenario = scenarioOf(variables);
      rest();
    },

    update(dt, variables) {
      lastVariables = variables;
      const scenario = scenarioOf(variables);
      if (scenario !== runtime.scenario) {
        runtime.scenario = scenario;
        rest();
      }
      const caudal = Number(variables.caudal ?? 10);
      const v = Number(variables.velocidad_base ?? 0.5);

      if (runtime.phase !== "running" || !runtime.attempt) {
        // Quieto: el velocímetro muestra lo que marcaría ahora mismo.
        if (runtime.phase === "idle") runtime.rate = 0;
        return;
      }

      const a = runtime.attempt;
      // Cámara lenta en la última décima del camino hacia la meta.
      const progress =
        a.scenario === "escalera"
          ? (runtime.x - LADDER_START_X) / (a.meta - LADDER_START_X)
          : runtime.height / a.meta;
      runtime.slow = Boolean(variables.camara_lenta) && progress > 0.9;
      const step = dt * runtime.speedup * (runtime.slow ? 1 / SLOW_FACTOR : 1);
      runtime.time += step;

      if (a.scenario === "escalera") {
        runtime.x = Math.min(a.meta, runtime.x + v * step);
        runtime.y = Math.sqrt(LADDER ** 2 - runtime.x ** 2);
        if (runtime.x >= a.meta) runtime.time = (a.meta - LADDER_START_X) / v;
      } else {
        const q = caudal / 1000;
        const goalVolume =
          a.scenario === "cono" ? coneVolume(a.meta) : Math.PI * CYLINDER_RADIUS ** 2 * a.meta;
        runtime.volume = Math.min(goalVolume, runtime.volume + q * step);
        runtime.height =
          a.scenario === "cono"
            ? coneHeight(runtime.volume)
            : runtime.volume / (Math.PI * CYLINDER_RADIUS ** 2);
        // Al cruzar, se fija en la meta exacta: la rapidez real es la del
        // instante en que la altura vale la meta, no la del paso siguiente.
        if (runtime.volume >= goalVolume) {
          runtime.height = a.meta;
          runtime.time = goalVolume / q;
        }
      }
      updateRate(caudal, v);

      const measured = a.scenario === "escalera" ? runtime.y : runtime.height;
      if (series.length === 0 || runtime.time - series[series.length - 1].x >= sampleEvery) {
        series.push({ x: runtime.time, y: measured });
      }

      const reached = a.scenario === "escalera" ? runtime.x >= a.meta : runtime.height >= a.meta;
      if (reached) {
        series.push({ x: runtime.time, y: measured });
        finish();
      }
    },

    start() {
      if (runtime.phase === "running") return;
      const variables = lastVariables;
      runtime.scenario = scenarioOf(variables);
      rest();
      const caudal = Number(variables.caudal ?? 10);
      const meta =
        runtime.scenario === "escalera"
          ? Math.min(LADDER_MAX_X, Number(variables.x_meta ?? 3))
          : Number(variables.altura_meta ?? 1);
      runtime.goal = meta;
      // La predicción se congela al empezar: cambiarla a mitad no cuenta.
      runtime.attempt = {
        scenario: runtime.scenario,
        caudal,
        meta,
        predicted: Number(variables.prediccion ?? 0),
        actual: null,
        score: null,
        hit: false,
      };
      // Cuánto tardaría en tiempo real, para acelerar el reloj y que cualquier
      // intento quepa en unos segundos de pantalla.
      const q = caudal / 1000;
      const v = Number(variables.velocidad_base ?? 0.5);
      const modelSeconds =
        runtime.scenario === "cono"
          ? coneVolume(meta) / q
          : runtime.scenario === "cilindro"
            ? (Math.PI * CYLINDER_RADIUS ** 2 * meta) / q
            : (meta - LADDER_START_X) / v;
      runtime.speedup = Math.max(1, modelSeconds / TARGET_WALL_SECONDS);
      sampleEvery = modelSeconds / 60;
      runtime.phase = "running";
    },

    reset() {
      rest();
    },

    resetChallenges() {
      coneHit = false;
      cylinderHit = false;
      ladderHit = false;
      doubleHit = false;
      lastConeHit = null;
      bestScore = 0;
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      return series;
    },

    getChallenges(): ChallengeStatus[] {
      return [
        {
          id: "cono",
          title: "El cono que se llena",
          detail: "Acierta la rapidez de subida en el cono, con la meta en 1 m o más.",
          done: coneHit,
          progress: coneHit ? 1 : 0,
        },
        {
          id: "cilindro",
          title: "¿Y si es un cilindro?",
          detail: "Acierta en el cilindro. ¿Cambia la rapidez con la altura?",
          done: cylinderHit,
          progress: cylinderHit ? 1 : 0,
        },
        {
          id: "escalera",
          title: "La escalera que resbala",
          detail: "Acierta la rapidez de la punta, con signo: baja, así que es negativa.",
          done: ladderHit,
          progress: ladderHit ? 1 : 0,
        },
        {
          id: "doble-altura",
          title: "El doble de alto",
          detail: doubleHit
            ? "Al doble de altura, la rapidez baja a la cuarta parte."
            : lastConeHit
              ? `Acertaste en ${lastConeHit.meta.toFixed(1)} m. Ahora acierta con el mismo caudal y la meta al doble o a la mitad.`
              : "En el cono, acierta dos veces seguidas con el mismo caudal y una meta al doble de la otra.",
          done: doubleHit,
          progress: doubleHit ? 1 : lastConeHit ? 0.5 : 0,
        },
      ];
    },

    getState(): AIContext {
      const a = runtime.attempt;
      const tank = runtime.scenario !== "escalera";
      const result: Record<string, number | string> = {
        escenario: runtime.scenario,
        situacion: situation(lastVariables),
        estado: runtime.phase === "idle" ? "sin empezar" : runtime.phase === "running" ? "en curso" : "llegó a la meta",
        tiempo_s: Number(runtime.time.toFixed(1)),
      };
      if (tank) {
        result.altura_m = Number(runtime.height.toFixed(3));
        result.volumen_l = Number((runtime.volume * 1000).toFixed(1));
      } else {
        result.base_x_m = Number(runtime.x.toFixed(2));
        result.punta_y_m = Number(runtime.y.toFixed(2));
      }
      if (a) {
        result.prediccion_cm_s = a.predicted;
        if (a.actual !== null && a.score !== null) {
          result.rapidez_real_cm_s = Number(a.actual.toFixed(2));
          result.puntaje = a.score;
          result.acierto = a.hit ? "sí" : "no";
        }
      }
      result.mejor_puntaje = bestScore;
      return {
        experimentName: "Llena el tanque",
        disciplineName: "Cálculo",
        variables: lastVariables,
        result,
        conceptTags: ["razones de cambio relacionadas", "regla de la cadena", "derivación implícita"],
      };
    },
  };
}
