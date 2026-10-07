import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";
import { getFunction } from "@/components/modules/calculus/shared/functions";

export type RiemannMethod = "izquierda" | "derecha" | "punto-medio" | "trapecio";

export interface RiemannBar {
  /** Borde izquierdo del bloque, en coordenadas de la función. */
  x0: number;
  x1: number;
  /** Altura del bloque. En trapecio son las dos alturas de los extremos. */
  yLeft: number;
  yRight: number;
}

export interface RiemannRuntime {
  bars: RiemannBar[];
  /** Muestreo fino de la curva, para dibujarla. */
  curve: Array<{ x: number; y: number }>;
  approx: number;
  exact: number;
  /** Error relativo en %, siempre positivo. */
  errorPct: number;
  /** Techo de |f| en el intervalo — lo usa la escena para escalar en Y. */
  maxY: number;
  /** Mejor marca de la sesión: menos bloques con error < 1%. */
  bestBlocks: number | null;
}

export interface RiemannEngine extends ExperimentEngine {
  getRuntime: () => RiemannRuntime;
}

const CURVE_SAMPLES = 240;
/**
 * Bloques que cuentan como "pocos" para el reto. Con la parábola en [0, 6]
 * el trapecio necesita 7 para bajar del 1 % y el punto medio 5: con 6 o menos
 * hay que haber descubierto que el método importa.
 */
const FEW_BLOCKS = 6;

/**
 * Motor de la suma de Riemann.
 *
 * A diferencia de los motores de física, aquí NO hay simulación en el tiempo:
 * el resultado depende solo de las variables. Por eso `update` recalcula
 * únicamente cuando alguna variable cambió (se compara una firma de texto) y
 * no 60 veces por segundo — con n=200 y el muestreo de la curva, recalcular
 * en cada tick tiraba el framerate sin cambiar un pixel.
 *
 * El valor "exacto" NO es otra suma más fina: se usa la primitiva analítica
 * F de cada función (`shared/functions.ts`). Comparar una aproximación contra
 * otra aproximación deja al alumno sin referencia real de cuánto se está
 * equivocando, que es el punto entero del experimento.
 */
export function createRiemannEngine(): RiemannEngine {
  let lastVariables: VariablesState = {};
  /** Logros: aparte de `bestBlocks`, que `reset()` borra. */
  let underOnePct = false;
  let fewBlocks = false;
  let lowestError = Infinity;
  const functionsDone = new Set<string>();
  let signature = "";

  const runtime: RiemannRuntime = {
    bars: [],
    curve: [],
    approx: 0,
    exact: 0,
    errorPct: 0,
    maxY: 1,
    bestBlocks: null,
  };

  function recompute(variables: VariablesState) {
    const fn = getFunction(variables.funcion ?? "parabola");
    const method = String(variables.metodo ?? "izquierda") as RiemannMethod;
    const n = Math.max(1, Math.round(Number(variables.n ?? 8)));

    // El intervalo se recorta al dominio de la función: con √x, por ejemplo,
    // pedir x<0 no tiene sentido y ensuciaría la gráfica con NaN.
    const [dMin, dMax] = fn.domain;
    const a = Math.min(Math.max(Number(variables.a ?? dMin), dMin), dMax);
    const b = Math.min(Math.max(Number(variables.b ?? dMax), dMin), dMax);
    const width = b - a;

    const bars: RiemannBar[] = [];
    let approx = 0;

    if (width > 0) {
      const dx = width / n;
      for (let i = 0; i < n; i += 1) {
        const x0 = a + i * dx;
        const x1 = x0 + dx;
        const yLeft = fn.f(x0);
        const yRight = fn.f(x1);
        const yMid = fn.f((x0 + x1) / 2);

        // Altura con la que cada método tapa el trozo. El trapecio usa las
        // dos puntas (por eso converge como O(dx²) y los demás como O(dx),
        // que es lo que el experimento quiere que se vea al mover el slider);
        // los otros tres son rectángulos, con las dos alturas iguales.
        const [hLeft, hRight] =
          method === "izquierda"
            ? [yLeft, yLeft]
            : method === "derecha"
              ? [yRight, yRight]
              : method === "punto-medio"
                ? [yMid, yMid]
                : [yLeft, yRight];

        const area = ((hLeft + hRight) / 2) * dx;

        approx += area;
        bars.push({ x0, x1, yLeft: hLeft, yRight: hRight });
      }
    }

    const exact = fn.F(b) - fn.F(a);
    const errorPct = exact === 0 ? 0 : Math.abs((approx - exact) / exact) * 100;

    const curve: Array<{ x: number; y: number }> = [];
    let maxY = 0;
    for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
      const x = a + (width * i) / CURVE_SAMPLES;
      const y = fn.f(x);
      curve.push({ x, y });
      if (y > maxY) maxY = y;
    }

    runtime.bars = bars;
    runtime.curve = curve;
    runtime.approx = approx;
    runtime.exact = exact;
    runtime.errorPct = errorPct;
    runtime.maxY = Math.max(maxY, 0.5);

    // El reto del experimento es llegar a <1% de error con la MENOR cantidad
    // de bloques, así que la marca solo se actualiza cuando además baja n.
    if (errorPct < 1 && (runtime.bestBlocks === null || n < runtime.bestBlocks)) {
      runtime.bestBlocks = n;
    }
    lowestError = Math.min(lowestError, errorPct);
    if (errorPct < 1) {
      underOnePct = true;
      functionsDone.add(String(variables.funcion ?? "parabola"));
      if (n <= FEW_BLOCKS) fewBlocks = true;
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      signature = JSON.stringify(variables);
      recompute(variables);
    },

    update(_dt, variables) {
      lastVariables = variables;
      const next = JSON.stringify(variables);
      if (next === signature) return;
      signature = next;
      recompute(variables);
    },

    reset() {
      runtime.bestBlocks = null;
      recompute(lastVariables);
    },

    getState(): AIContext {
      const fn = getFunction(lastVariables.funcion ?? "parabola");
      return {
        experimentName: "Suma de Riemann",
        disciplineName: "Cálculo",
        variables: lastVariables,
        result: {
          aproximacion: Number(runtime.approx.toFixed(4)),
          valor_exacto: Number(runtime.exact.toFixed(4)),
          error_pct: Number(runtime.errorPct.toFixed(3)),
          bloques: runtime.bars.length,
          ...(runtime.bestBlocks !== null
            ? { record_bloques_bajo_1pct: runtime.bestBlocks }
            : {}),
          funcion: fn.expression,
        },
        conceptTags: [
          "integral definida",
          "suma de Riemann",
          "convergencia",
          "error de aproximación",
        ],
      };
    },

    getSeries() {
      return runtime.curve;
    },

    resetChallenges() {
      underOnePct = false;
      fewBlocks = false;
      lowestError = Infinity;
      functionsDone.clear();
    },

    getChallenges(): ChallengeStatus[] {
      // Progreso en escala logarítmica del error: de 100 % a 1 % la barra va
      // de 0 a 1, y cada décima de error que se gana se nota igual.
      const toward = Number.isFinite(lowestError)
        ? Math.min(1, Math.max(0, 1 - Math.log10(Math.max(lowestError, 1)) / 2))
        : 0;
      return [
        {
          id: "uno",
          title: "Menos de 1 % de error",
          detail: "Agrega bloques o cambia de método hasta bajar del 1 %.",
          done: underOnePct,
          progress: toward,
        },
        {
          id: "pocos",
          title: `Con ${FEW_BLOCKS} bloques o menos`,
          detail: "Menos del 1 % con muy pocos bloques: el método importa.",
          done: fewBlocks,
          progress: fewBlocks ? 1 : underOnePct ? 0.5 : 0,
        },
        {
          id: "funciones",
          title: "En las cuatro funciones",
          detail: `Menos del 1 % en cada función: ${functionsDone.size} de 4.`,
          done: functionsDone.size >= 4,
          progress: functionsDone.size / 4,
        },
      ];
    },

    getRuntime() {
      return runtime;
    },
  };
}
