import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export type Gate = "vacio" | "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR";

export const GATES: Array<{ id: Gate; label: string; chip: string }> = [
  { id: "vacio", label: "— (vacío)", chip: "" },
  { id: "AND", label: "AND (7408)", chip: "7408" },
  { id: "OR", label: "OR (7432)", chip: "7432" },
  { id: "NOT", label: "NOT (7404)", chip: "7404" },
  { id: "NAND", label: "NAND (7400)", chip: "7400" },
  { id: "NOR", label: "NOR (7402)", chip: "7402" },
  { id: "XOR", label: "XOR (7486)", chip: "7486" },
];

/** Lo que entra a un zócalo: un interruptor o la salida de otro zócalo. */
export type Source = "A" | "B" | "C" | "g1" | "g2" | "g3" | "g4";

export interface Slot {
  id: "g1" | "g2" | "g3" | "g4" | "g5";
  /** Una o dos entradas. Con una, la misma señal entra por las dos patas. */
  inputs: [Source] | [Source, Source];
}

export interface Level {
  id: string;
  title: string;
  /** El problema, en palabras. */
  story: string;
  /** Qué representa cada interruptor. */
  inputNames: Partial<Record<"A" | "B" | "C", string>>;
  slots: Slot[];
  /** El zócalo cuya salida es la del circuito. */
  output: Slot["id"];
  outputName: string;
  /** Lo que se pide, como función de las entradas. */
  expected: (a: boolean, b: boolean, c: boolean) => boolean;
  formula: string;
}

export const LEVELS: Level[] = [
  {
    id: "alarma",
    title: "1 · La alarma",
    story: "La alarma suena si la puerta está abierta Y el sistema está armado.",
    inputNames: { A: "Puerta abierta", B: "Sistema armado" },
    slots: [{ id: "g1", inputs: ["A", "B"] }],
    output: "g1",
    outputName: "Alarma",
    expected: (a, b) => a && b,
    formula: "Y = A · B",
  },
  {
    id: "porton",
    title: "2 · El portón",
    story:
      "El portón se abre con el botón de adentro O con el control remoto, SALVO que esté bloqueado.",
    inputNames: { A: "Botón de adentro", B: "Control remoto", C: "Bloqueado" },
    slots: [
      { id: "g1", inputs: ["A", "B"] },
      { id: "g2", inputs: ["C"] },
      { id: "g3", inputs: ["g1", "g2"] },
    ],
    output: "g3",
    outputName: "Abrir portón",
    expected: (a, b, c) => (a || b) && !c,
    formula: "Y = (A + B) · C̄",
  },
  {
    id: "jueces",
    title: "3 · Los tres jueces",
    story: "La luz verde se enciende si AL MENOS DOS de los tres jueces aprueban.",
    inputNames: { A: "Juez 1", B: "Juez 2", C: "Juez 3" },
    slots: [
      { id: "g1", inputs: ["A", "B"] },
      { id: "g2", inputs: ["A", "C"] },
      { id: "g3", inputs: ["B", "C"] },
      { id: "g4", inputs: ["g1", "g2"] },
      { id: "g5", inputs: ["g4", "g3"] },
    ],
    output: "g5",
    outputName: "Luz verde",
    expected: (a, b, c) => (a && b) || (a && c) || (b && c),
    formula: "Y = A·B + A·C + B·C",
  },
];

export function getLevel(id: string | number | boolean): Level {
  return LEVELS.find((l) => l.id === String(id)) ?? LEVELS[0];
}

/** Las entradas que usa un nivel (A y B, o A, B y C). */
export function levelInputs(level: Level): Array<"A" | "B" | "C"> {
  return (["A", "B", "C"] as const).filter((k) => level.inputNames[k] !== undefined);
}

function apply(gate: Gate, x: boolean, y: boolean): boolean | null {
  switch (gate) {
    case "AND":
      return x && y;
    case "OR":
      return x || y;
    case "NOT":
      return !x; // en un zócalo de dos entradas, usa solo la primera
    case "NAND":
      return !(x && y);
    case "NOR":
      return !(x || y);
    case "XOR":
      return x !== y;
    case "vacio":
      return null;
  }
}

/** El valor de cada cable del circuito. null: no llega señal (un zócalo vacío). */
export type Signals = Record<string, boolean | null>;

export function evaluate(
  level: Level,
  gates: Partial<Record<Slot["id"], Gate>>,
  inputs: { A: boolean; B: boolean; C: boolean },
): Signals {
  const signals: Signals = { A: inputs.A, B: inputs.B, C: inputs.C };
  for (const slot of level.slots) {
    const x = signals[slot.inputs[0]];
    const y = signals[slot.inputs[1] ?? slot.inputs[0]];
    signals[slot.id] = x === null || y === null ? null : apply(gates[slot.id] ?? "vacio", x, y);
  }
  return signals;
}

export interface TruthRow {
  inputs: { A: boolean; B: boolean; C: boolean };
  expected: boolean;
  /** null mientras esa fila no se probó. */
  actual: boolean | null;
}

export function truthTable(level: Level): TruthRow[] {
  const names = levelInputs(level);
  const rows: TruthRow[] = [];
  for (let n = 0; n < 2 ** names.length; n++) {
    const value = (k: "A" | "B" | "C") => {
      const i = names.indexOf(k);
      return i >= 0 ? Boolean((n >> (names.length - 1 - i)) & 1) : false;
    };
    const inputs = { A: value("A"), B: value("B"), C: value("C") };
    rows.push({ inputs, expected: level.expected(inputs.A, inputs.B, inputs.C), actual: null });
  }
  return rows;
}

export interface LogicRuntime {
  level: Level;
  /** Señales del circuito con lo que marcan los interruptores (o la prueba). */
  signals: Signals;
  rows: TruthRow[];
  /** -1 sin prueba en curso; si no, la fila que se está probando. */
  testingRow: number;
  /** Resultado de la última prueba completa. */
  lastTest: "ok" | "falla" | null;
  attempts: Record<string, number>;
  message: string;
}

export interface LogicEngine extends ExperimentEngine {
  /** Recorre todas las filas de la tabla de verdad. */
  runTest: () => void;
  getRuntime: () => LogicRuntime;
}

/** Cuánto se muestra cada fila durante la prueba, s. */
const ROW_SECONDS = 0.55;

/**
 * Motor de "Arma la lógica".
 *
 * Cada nivel es un circuito ya cableado con zócalos vacíos: el jugador elige
 * qué compuerta va en cada uno. No hay una única respuesta: se compara la
 * tabla de verdad COMPLETA contra lo pedido, así que cualquier circuito
 * equivalente vale (los tres jueces salen con AND y OR, o solo con NAND).
 *
 * En un zócalo de una entrada, la señal entra por las dos patas, como cuando
 * se usa una compuerta NAND de inversor en un circuito real.
 */
export function createLogicEngine(): LogicEngine {
  let lastVariables: VariablesState = {};
  let elapsed = 0;
  const solved = new Set<string>();
  let firstTry = false;

  const runtime: LogicRuntime = {
    level: LEVELS[0],
    signals: {},
    rows: truthTable(LEVELS[0]),
    testingRow: -1,
    lastTest: null,
    attempts: {},
    message: "",
  };

  function gatesOf(variables: VariablesState): Partial<Record<Slot["id"], Gate>> {
    const out: Partial<Record<Slot["id"], Gate>> = {};
    for (const id of ["g1", "g2", "g3", "g4", "g5"] as const) {
      out[id] = (GATES.find((g) => g.id === variables[id])?.id ?? "vacio") as Gate;
    }
    return out;
  }

  /** Firma del circuito: si cambia a mitad de una prueba, la prueba se cancela. */
  let circuit = "";

  function read(variables: VariablesState) {
    const level = getLevel(variables.nivel ?? "alarma");
    const gates = gatesOf(variables);
    const nextCircuit = `${level.id}|${level.slots.map((s) => gates[s.id]).join(",")}`;
    if (nextCircuit !== circuit) {
      circuit = nextCircuit;
      runtime.level = level;
      runtime.rows = truthTable(level);
      runtime.testingRow = -1;
      runtime.lastTest = null;
    }
    return { level, gates };
  }

  return {
    init(variables) {
      lastVariables = variables;
      const { level, gates } = read(variables);
      runtime.signals = evaluate(level, gates, {
        A: Boolean(variables.A),
        B: Boolean(variables.B),
        C: Boolean(variables.C),
      });
    },

    update(dt, variables) {
      lastVariables = variables;
      const { level, gates } = read(variables);

      if (runtime.testingRow >= 0) {
        // Prueba en curso: el circuito muestra la fila que se está probando.
        const row = runtime.rows[runtime.testingRow];
        runtime.signals = evaluate(level, gates, row.inputs);
        elapsed += dt;
        if (elapsed >= ROW_SECONDS) {
          row.actual = runtime.signals[level.output] ?? false;
          elapsed = 0;
          runtime.testingRow += 1;
          if (runtime.testingRow >= runtime.rows.length) {
            runtime.testingRow = -1;
            const ok = runtime.rows.every((r) => r.actual === r.expected);
            runtime.lastTest = ok ? "ok" : "falla";
            runtime.attempts[level.id] = (runtime.attempts[level.id] ?? 0) + 1;
            const wrong = runtime.rows.filter((r) => r.actual !== r.expected).length;
            if (ok) {
              solved.add(level.id);
              if (level.id === "jueces" && runtime.attempts[level.id] === 1) firstTry = true;
              runtime.message = "¡La tabla de verdad completa coincide!";
            } else {
              runtime.message = `${wrong} de ${runtime.rows.length} filas no coinciden. Revisa las que están en rojo.`;
            }
          }
        }
        return;
      }

      // Sin prueba: el circuito sigue a los interruptores.
      runtime.signals = evaluate(level, gates, {
        A: Boolean(variables.A),
        B: Boolean(variables.B),
        C: Boolean(variables.C),
      });
    },

    runTest() {
      if (runtime.testingRow >= 0) return;
      const empty = runtime.level.slots.some((s) => (lastVariables[s.id] ?? "vacio") === "vacio");
      if (empty) {
        runtime.message = "Hay zócalos vacíos: pon una compuerta en cada uno antes de probar.";
        return;
      }
      runtime.rows = truthTable(runtime.level);
      runtime.testingRow = 0;
      runtime.lastTest = null;
      runtime.message = "Probando todas las combinaciones…";
      elapsed = 0;
    },

    reset() {
      runtime.testingRow = -1;
      runtime.rows = truthTable(runtime.level);
      runtime.message = "";
    },

    resetChallenges() {
      solved.clear();
      firstTry = false;
      runtime.attempts = {};
    },

    getRuntime() {
      return runtime;
    },

    getChallenges(): ChallengeStatus[] {
      const attempts = runtime.attempts.jueces ?? 0;
      return [
        ...LEVELS.map((level) => ({
          id: level.id,
          title: level.title.replace(/^\d · /, ""),
          detail: `${level.formula}. Prueba la tabla de verdad completa.`,
          done: solved.has(level.id),
          progress: solved.has(level.id) ? 1 : 0,
        })),
        {
          id: "primer-intento",
          title: "Sin probar a ciegas",
          detail:
            attempts > 0 && !firstTry
              ? "Ya fallaste una prueba en los tres jueces: para este reto había que acertar a la primera."
              : "Resuelve los tres jueces acertando en la primera prueba: piénsalo antes de probar.",
          done: firstTry,
          progress: firstTry ? 1 : 0,
        },
      ];
    },

    getState(): AIContext {
      const level = runtime.level;
      const gates = gatesOf(lastVariables);
      return {
        experimentName: "Arma la lógica",
        disciplineName: "Electrónica",
        variables: lastVariables,
        result: {
          nivel: level.title,
          problema: level.story,
          se_pide: level.formula,
          entradas: levelInputs(level)
            .map((k) => `${k} = ${level.inputNames[k]}`)
            .join("; "),
          zocalos: level.slots
            .map((s) => `${s.id} (${s.inputs.join(", ")}) = ${gates[s.id]}`)
            .join("; "),
          salida_ahora: runtime.signals[level.output] === null ? "sin señal" : runtime.signals[level.output] ? 1 : 0,
          ...(runtime.lastTest
            ? {
                ultima_prueba: runtime.lastTest === "ok" ? "coincide" : "no coincide",
                filas_que_fallan: runtime.rows
                  .filter((r) => r.actual !== r.expected)
                  .map((r) => levelInputs(level).map((k) => `${k}=${r.inputs[k] ? 1 : 0}`).join(" "))
                  .join("; ") || "ninguna",
              }
            : {}),
          intentos_en_este_nivel: runtime.attempts[level.id] ?? 0,
        },
        conceptTags: [
          "compuertas lógicas",
          "álgebra de Boole",
          "tabla de verdad",
          "circuitos combinacionales",
        ],
      };
    },
  };
}
