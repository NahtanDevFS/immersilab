import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/** Voltaje de la batería. */
export const BATTERY_V = 9;

/** Serie comercial E12: los únicos valores que se consiguen en una tienda. */
const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
export const RESISTOR_VALUES: number[] = [
  ...[1, 10, 100, 1000].flatMap((decade) => E12.map((v) => v * decade)),
  100000,
];

/** Potencia que aguanta una resistencia común de protoboard, W. */
export const RESISTOR_MAX_W = 0.25;

export interface LedColor {
  id: string;
  label: string;
  /** Caída de voltaje directa, V. */
  forward: number;
  color: string;
}

export const LED_COLORS: LedColor[] = [
  { id: "rojo", label: "Rojo (1.8 V)", forward: 1.8, color: "#ff3b30" },
  { id: "verde", label: "Verde (2.1 V)", forward: 2.1, color: "#34d399" },
  { id: "azul", label: "Azul (3.0 V)", forward: 3.0, color: "#3b82f6" },
];

/** Corriente con la que un LED común brilla bien, A. */
export const LED_OK_MIN = 0.01;
export const LED_OK_MAX = 0.02;
/** Por encima de esto, se quema. */
export const LED_BURN = 0.03;

/** Objetivo del divisor y su tolerancia. */
export const DIVIDER_TARGET = 3.3;
export const DIVIDER_TOLERANCE = 0.02;

export type Level = "led" | "divisor" | "paralelo";

export const LEVELS: Array<{ id: Level; label: string }> = [
  { id: "led", label: "1 · Enciende un LED" },
  { id: "divisor", label: "2 · Divisor de voltaje" },
  { id: "paralelo", label: "3 · Ramas en paralelo" },
];

export type MeasurePoint = "v_bat" | "v_r1" | "v_r2" | "v_r3" | "v_led" | "i_total" | "i_r2" | "i_r3";

export const MEASURE_POINTS: Array<{ id: MeasurePoint; label: string; unit: "V" | "A" }> = [
  // Para ver que de la batería salen 9 V y que se reparten: sin esto, quien
  // mide 7.2 V en R1 con el LED cree que el sistema está mal.
  { id: "v_bat", label: "Voltaje de la batería", unit: "V" },
  { id: "v_r1", label: "Voltaje en R1", unit: "V" },
  { id: "v_r2", label: "Voltaje en R2", unit: "V" },
  { id: "v_r3", label: "Voltaje en R3", unit: "V" },
  { id: "v_led", label: "Voltaje en el LED", unit: "V" },
  // R1 está en serie con todo el resto en los tres circuitos: la corriente
  // que pasa por R1 ES la total. El nombre dice las dos cosas, porque quien
  // busca "corriente en R1" no la encontraba.
  { id: "i_total", label: "Corriente por R1 (total)", unit: "A" },
  { id: "i_r2", label: "Corriente por R2", unit: "A" },
  { id: "i_r3", label: "Corriente por R3", unit: "A" },
];

/** Qué resistencias existen en cada nivel. */
export const LEVEL_RESISTORS: Record<Level, Array<"r1" | "r2" | "r3">> = {
  led: ["r1"],
  divisor: ["r1", "r2"],
  paralelo: ["r1", "r2", "r3"],
};

/** Colores del código de resistencias, del 0 al 9. */
const BAND_COLORS = [
  "#111111", // negro
  "#7b4a12", // marrón
  "#e0201b", // rojo
  "#f57c00", // naranja
  "#f4d01c", // amarillo
  "#1f9d3a", // verde
  "#1d4ed8", // azul
  "#7c3aed", // violeta
  "#8a8a8a", // gris
  "#f5f5f5", // blanco
];
const BAND_NAMES = ["negro", "marrón", "rojo", "naranja", "amarillo", "verde", "azul", "violeta", "gris", "blanco"];
const GOLD = "#c9a227";

/** Las cuatro bandas de una resistencia: dos dígitos, multiplicador y tolerancia (oro, 5 %). */
export function colorBands(ohms: number): { colors: string[]; names: string[] } {
  const exponent = Math.floor(Math.log10(ohms)) - 1;
  const digits = Math.round(ohms / 10 ** exponent);
  const d1 = Math.floor(digits / 10);
  const d2 = digits % 10;
  return {
    colors: [BAND_COLORS[d1], BAND_COLORS[d2], BAND_COLORS[exponent], GOLD],
    names: [BAND_NAMES[d1], BAND_NAMES[d2], BAND_NAMES[exponent], "dorado"],
  };
}

export function formatOhms(ohms: number): string {
  if (ohms >= 1000) return `${Number((ohms / 1000).toFixed(2))} kΩ`;
  return `${ohms} Ω`;
}

export function getLed(id: string | number | boolean): LedColor {
  return LED_COLORS.find((l) => l.id === String(id)) ?? LED_COLORS[0];
}

/** El circuito resuelto: corrientes, voltajes y potencias. */
export interface Solution {
  total: number;
  i2: number;
  i3: number;
  vR1: number;
  vR2: number;
  vR3: number;
  vLed: number;
  power: Record<"r1" | "r2" | "r3", number>;
}

/**
 * Resuelve el circuito del nivel con la ley de Ohm y las de Kirchhoff. Un
 * componente quemado queda abierto: por esa rama no pasa corriente.
 */
export function solve(
  level: Level,
  r: Record<"r1" | "r2" | "r3", number>,
  led: LedColor,
  burned: { led: boolean; r1: boolean; r2: boolean; r3: boolean },
): Solution {
  const zero: Solution = {
    total: 0, i2: 0, i3: 0, vR1: 0, vR2: 0, vR3: 0, vLed: 0,
    power: { r1: 0, r2: 0, r3: 0 },
  };

  if (level === "led") {
    if (burned.led || burned.r1) {
      // Circuito abierto: no hay corriente, y el LED abierto "ve" toda la batería.
      return { ...zero, vLed: burned.led && !burned.r1 ? BATTERY_V : 0 };
    }
    // El LED fija su caída: el resto queda sobre la resistencia.
    const total = BATTERY_V > led.forward ? (BATTERY_V - led.forward) / r.r1 : 0;
    return {
      ...zero,
      total,
      vR1: total * r.r1,
      vLed: total > 0 ? led.forward : BATTERY_V,
      power: { r1: total * total * r.r1, r2: 0, r3: 0 },
    };
  }

  if (level === "divisor") {
    if (burned.r1 || burned.r2) return zero;
    const total = BATTERY_V / (r.r1 + r.r2);
    return {
      ...zero,
      total,
      i2: total,
      vR1: total * r.r1,
      vR2: total * r.r2,
      power: { r1: total * total * r.r1, r2: total * total * r.r2, r3: 0 },
    };
  }

  // Paralelo: R1 en serie con (R2 ∥ R3). Una rama quemada queda abierta.
  if (burned.r1) return zero;
  const g2 = burned.r2 ? 0 : 1 / r.r2;
  const g3 = burned.r3 ? 0 : 1 / r.r3;
  if (g2 + g3 === 0) return zero;
  const rp = 1 / (g2 + g3);
  const total = BATTERY_V / (r.r1 + rp);
  const vp = total * rp;
  const i2 = vp * g2;
  const i3 = vp * g3;
  return {
    total,
    i2,
    i3,
    vR1: total * r.r1,
    vR2: vp,
    vR3: vp,
    vLed: 0,
    power: { r1: total * total * r.r1, r2: i2 * i2 * r.r2, r3: i3 * i3 * r.r3 },
  };
}

/** Lo que muestra el multímetro en un punto, o null si ese punto no existe en el nivel. */
export function reading(level: Level, point: MeasurePoint, s: Solution): number | null {
  const has = (k: "r1" | "r2" | "r3") => LEVEL_RESISTORS[level].includes(k);
  switch (point) {
    case "v_bat":
      return BATTERY_V;
    case "v_r1":
      return s.vR1;
    case "v_r2":
      return has("r2") ? s.vR2 : null;
    case "v_r3":
      return has("r3") ? s.vR3 : null;
    case "v_led":
      return level === "led" ? s.vLed : null;
    case "i_total":
      return s.total;
    case "i_r2":
      return has("r2") ? s.i2 : null;
    case "i_r3":
      return has("r3") ? s.i3 : null;
  }
}

/**
 * Cómo se reparten los 9 V de la batería (ley de voltajes de Kirchhoff) y,
 * en paralelo, cómo se reparte la corriente. Se escribe sobre la mesa: sin
 * esto, medir 7.2 V en R1 con el LED parecía un error, porque nadie veía
 * adónde iban los otros 1.8 V.
 */
export function balanceLines(level: Level, s: Solution): string[] {
  const v = (x: number) => `${x.toFixed(2)} V`;
  const ma = (x: number) => `${(x * 1000).toFixed(2)} mA`;
  if (s.total === 0) return ["Circuito abierto: no circula corriente (¿algo quemado?)"];
  if (level === "led") return [`${BATTERY_V} V = ${v(s.vR1)} en R1 + ${v(s.vLed)} en el LED`];
  if (level === "divisor") return [`${BATTERY_V} V = ${v(s.vR1)} en R1 + ${v(s.vR2)} en R2`];
  return [
    `${BATTERY_V} V = ${v(s.vR1)} en R1 + ${v(s.vR2)} en R2 y R3 (en paralelo tienen el mismo voltaje)`,
    `I total ${ma(s.total)} = ${ma(s.i2)} por R2 + ${ma(s.i3)} por R3`,
  ];
}

/** Texto del multímetro: con unidad y prefijo, como en uno de verdad. */
export function formatReading(value: number | null, unit: "V" | "A"): string {
  if (value === null) return "---";
  if (unit === "A") {
    const ma = value * 1000;
    return ma < 1 ? `${(ma * 1000).toFixed(0)} µA` : `${ma.toFixed(ma < 10 ? 2 : 1)} mA`;
  }
  return `${value.toFixed(2)} V`;
}

export interface ProtoboardRuntime {
  level: Level;
  solution: Solution;
  burned: { led: boolean; r1: boolean; r2: boolean; r3: boolean };
  /** El punto que mide el multímetro y lo que marca. */
  point: MeasurePoint;
  display: string;
  /** Mediciones de corriente hechas en el nivel 3 (para Kirchhoff). */
  measured: Partial<Record<"i_total" | "i_r2" | "i_r3", number>>;
  message: string;
}

export interface ProtoboardEngine extends ExperimentEngine {
  /** Cambia los componentes quemados por nuevos. */
  replaceBurned: () => void;
  getRuntime: () => ProtoboardRuntime;
}

/** Cuánto hay que sostener un resultado para que cuente, s. */
const HOLD = 1;
/** Cuánto tiene que quedarse el multímetro en un punto para que cuente como medido, s. */
const MEASURE_HOLD = 0.5;

/**
 * Motor de "Arma el circuito".
 *
 * Tres circuitos en una protoboard, resueltos con la ley de Ohm y las de
 * Kirchhoff. Lo que se aprende jugando:
 * - el LED necesita una resistencia en serie: sin ella, o con una chica, se
 *   quema; con una grande, casi no brilla;
 * - un divisor de voltaje con valores COMERCIALES (no cualquier número existe)
 *   y cuidando que las resistencias no se quemen (P = I²R ≤ ¼ W);
 * - en paralelo, las corrientes de las ramas suman la total: se comprueba
 *   midiendo, como en el laboratorio.
 */
export function createProtoboardEngine(): ProtoboardEngine {
  let lastVariables: VariablesState = {};
  const done = { led: false, divisor: false, kirchhoff: false };
  const held = { led: 0, divisor: 0 };
  let measureTimer = 0;
  let measuredPoint: MeasurePoint | null = null;
  /** Valores de las resistencias con que se hicieron las mediciones. */
  let measuredWith = "";

  const runtime: ProtoboardRuntime = {
    level: "led",
    solution: solve("led", { r1: 1000, r2: 1000, r3: 2200 }, LED_COLORS[0], {
      led: false, r1: false, r2: false, r3: false,
    }),
    burned: { led: false, r1: false, r2: false, r3: false },
    point: "i_total",
    display: "",
    measured: {},
    message: "",
  };

  function read(variables: VariablesState) {
    const level = (LEVELS.find((l) => l.id === variables.nivel)?.id ?? "led") as Level;
    if (level !== runtime.level) {
      runtime.level = level;
      runtime.measured = {};
      runtime.message = "";
    }
    const r = {
      r1: Number(variables.r1 ?? 1000),
      r2: Number(variables.r2 ?? 1000),
      r3: Number(variables.r3 ?? 2200),
    };
    const led = getLed(variables.led ?? "rojo");
    // Si cambian las resistencias, lo medido antes ya no vale.
    const signature = `${r.r1}/${r.r2}/${r.r3}`;
    if (signature !== measuredWith) {
      measuredWith = signature;
      runtime.measured = {};
    }
    runtime.point = (MEASURE_POINTS.find((p) => p.id === variables.medir)?.id ?? "i_total") as MeasurePoint;
    return { level, r, led };
  }

  return {
    init(variables) {
      lastVariables = variables;
      const { level, r, led } = read(variables);
      runtime.solution = solve(level, r, led, runtime.burned);
    },

    update(dt, variables) {
      lastVariables = variables;
      const { level, r, led } = read(variables);
      let s = solve(level, r, led, runtime.burned);

      // Lo que se quema, se quema: queda abierto hasta cambiarlo.
      const burnedNow: string[] = [];
      if (level === "led" && !runtime.burned.led && s.total > LED_BURN) {
        runtime.burned.led = true;
        burnedNow.push(`el LED (pasaban ${(s.total * 1000).toFixed(0)} mA)`);
      }
      for (const k of LEVEL_RESISTORS[level]) {
        if (!runtime.burned[k] && s.power[k] > RESISTOR_MAX_W) {
          runtime.burned[k] = true;
          burnedNow.push(`${k.toUpperCase()} (disipaba ${s.power[k].toFixed(2)} W, aguanta ${RESISTOR_MAX_W} W)`);
        }
      }
      if (burnedNow.length > 0) {
        runtime.message =
          burnedNow.length > 1
            ? `¡Se quemaron ${burnedNow.join(" y ")}! Cámbialos para seguir.`
            : `¡Se quemó ${burnedNow[0]}! Cámbialo para seguir.`;
        s = solve(level, r, led, runtime.burned);
      }
      runtime.solution = s;

      // Multímetro.
      const unit = MEASURE_POINTS.find((p) => p.id === runtime.point)?.unit ?? "V";
      const value = reading(level, runtime.point, s);
      runtime.display = formatReading(value, unit);

      // Reto 1: el LED entre 10 y 20 mA.
      const ledOk = level === "led" && !runtime.burned.led && s.total >= LED_OK_MIN && s.total <= LED_OK_MAX;
      held.led = ledOk ? held.led + dt : 0;
      if (held.led >= HOLD) done.led = true;

      // Reto 2: 3.3 V en R2 (±2 %) sin quemar nada.
      const dividerOk =
        level === "divisor" &&
        !runtime.burned.r1 &&
        !runtime.burned.r2 &&
        Math.abs(s.vR2 - DIVIDER_TARGET) <= DIVIDER_TARGET * DIVIDER_TOLERANCE;
      held.divisor = dividerOk ? held.divisor + dt : 0;
      if (held.divisor >= HOLD) done.divisor = true;

      // Reto 3: medir las tres corrientes del paralelo (con ramas distintas).
      if (level === "paralelo" && (runtime.point === "i_total" || runtime.point === "i_r2" || runtime.point === "i_r3")) {
        if (measuredPoint !== runtime.point) {
          measuredPoint = runtime.point;
          measureTimer = 0;
        }
        measureTimer += dt;
        if (measureTimer >= MEASURE_HOLD && value !== null) runtime.measured[runtime.point] = value;
      } else {
        measuredPoint = null;
      }
      const { i_total, i_r2, i_r3 } = runtime.measured;
      if (
        level === "paralelo" &&
        r.r2 !== r.r3 &&
        i_total !== undefined && i_r2 !== undefined && i_r3 !== undefined &&
        i_r2 > 0 && i_r3 > 0 &&
        Math.abs(i_total - (i_r2 + i_r3)) < 1e-6
      ) {
        done.kirchhoff = true;
      }
    },

    reset() {
      runtime.measured = {};
      runtime.message = "";
    },

    resetChallenges() {
      done.led = false;
      done.divisor = false;
      done.kirchhoff = false;
    },

    replaceBurned() {
      runtime.burned = { led: false, r1: false, r2: false, r3: false };
      runtime.message = "Componentes nuevos. Revisa los valores antes de volver a conectar.";
    },

    getRuntime() {
      return runtime;
    },

    getChallenges(): ChallengeStatus[] {
      const m = runtime.measured;
      const count = [m.i_total, m.i_r2, m.i_r3].filter((v) => v !== undefined).length;
      return [
        {
          id: "led",
          title: "Enciende el LED sin quemarlo",
          detail: `Elige la resistencia para que pasen entre ${LED_OK_MIN * 1000} y ${LED_OK_MAX * 1000} mA.`,
          done: done.led,
          progress: done.led ? 1 : Math.min(0.9, held.led / HOLD),
        },
        {
          id: "divisor",
          title: "Saca 3.3 V de 9 V",
          detail: `Con dos resistencias comerciales, ${DIVIDER_TARGET} V en R2 (±${DIVIDER_TOLERANCE * 100} %) sin quemar ninguna.`,
          done: done.divisor,
          progress: done.divisor ? 1 : Math.min(0.9, held.divisor / HOLD),
        },
        {
          id: "kirchhoff",
          title: "Comprueba Kirchhoff",
          detail: `Con R2 y R3 distintas, mide la corriente total y la de cada rama: ${count} de 3.`,
          done: done.kirchhoff,
          progress: done.kirchhoff ? 1 : count / 3,
        },
      ];
    },

    getState(): AIContext {
      const s = runtime.solution;
      const level = runtime.level;
      const has = (k: "r1" | "r2" | "r3") => LEVEL_RESISTORS[level].includes(k);
      const ma = (a: number) => Number((a * 1000).toFixed(2));
      return {
        experimentName: "Arma el circuito",
        disciplineName: "Electrónica",
        variables: lastVariables,
        result: {
          nivel: LEVELS.find((l) => l.id === level)?.label ?? level,
          bateria_V: BATTERY_V,
          corriente_total_mA: ma(s.total),
          voltaje_R1_V: Number(s.vR1.toFixed(3)),
          ...(has("r2") ? { voltaje_R2_V: Number(s.vR2.toFixed(3)), corriente_R2_mA: ma(s.i2) } : {}),
          ...(has("r3") ? { voltaje_R3_V: Number(s.vR3.toFixed(3)), corriente_R3_mA: ma(s.i3) } : {}),
          ...(level === "led" ? { voltaje_LED_V: Number(s.vLed.toFixed(2)) } : {}),
          potencia_R1_W: Number(s.power.r1.toFixed(3)),
          ...(has("r2") ? { potencia_R2_W: Number(s.power.r2.toFixed(3)) } : {}),
          ...(has("r3") ? { potencia_R3_W: Number(s.power.r3.toFixed(3)) } : {}),
          multimetro: `${MEASURE_POINTS.find((p) => p.id === runtime.point)?.label}: ${runtime.display}`,
          quemados:
            Object.entries(runtime.burned)
              .filter(([, v]) => v)
              .map(([k]) => k.toUpperCase())
              .join(", ") || "ninguno",
          ...(runtime.message ? { aviso: runtime.message } : {}),
        },
        conceptTags: [
          "ley de Ohm",
          "leyes de Kirchhoff",
          "divisor de voltaje",
          "resistencias en serie y paralelo",
          "potencia disipada",
          "LED",
        ],
      };
    },
  };
}
