import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";
import {
  SERIES_FUNCTIONS,
  TOLERANCE,
  coverage,
  effectiveCenter,
  getSeriesFunction,
  minimalDegree,
  taylorCoefficients,
  type Coverage,
  type SeriesFunction,
} from "./series";

/**
 * C4 · ¿Cuántos términos? — PLAN_DESARROLLO.md §3.2.
 *
 * Como Riemann, no hay simulación en el tiempo: el estado es una función
 * pura de las variables (función, grado, centro). El motor solo recalcula
 * cuando cambian, guarda el mejor grado logrado por función y lo compara con
 * el mínimo posible.
 */

export interface SeriesChallenge {
  done: boolean;
  /** Menor grado con el que el jugador cubrió el objetivo. */
  bestDegree: number | null;
  /** Menor grado posible (probando todos los centros del slider). */
  minDegree: number;
}

export interface TaylorRuntime {
  fn: SeriesFunction;
  /** Centro realmente usado (el pedido, acotado al dominio). */
  center: number;
  degree: number;
  coefficients: number[];
  coverage: Coverage;
  radius: number;
  challenges: Record<string, SeriesChallenge>;
}

export interface TaylorEngine extends ExperimentEngine {
  getRuntime: () => TaylorRuntime;
}

export function createTaylorEngine(): TaylorEngine {
  let lastVariables: VariablesState = {};
  let lastKey = "";

  // El mínimo de cada función se calcula una sola vez: es una búsqueda sobre
  // todos los centros y grados, cara para hacerla en cada frame.
  const challenges: Record<string, SeriesChallenge> = Object.fromEntries(
    SERIES_FUNCTIONS.map((fn) => [
      fn.id,
      { done: false, bestDegree: null, minDegree: minimalDegree(fn).degree },
    ]),
  );

  const first = SERIES_FUNCTIONS[0];
  const runtime: TaylorRuntime = {
    fn: first,
    center: 0,
    degree: 1,
    coefficients: taylorCoefficients(first, 0, 1),
    coverage: coverage(first, 0, 1),
    radius: first.radius(0),
    challenges,
  };

  function recompute(variables: VariablesState) {
    const fn = getSeriesFunction(variables.funcion ?? "seno");
    const degree = Math.round(Number(variables.grado ?? 1));
    const center = effectiveCenter(fn, Number(variables.centro ?? 0));
    const key = `${fn.id}|${degree}|${center}`;
    if (key === lastKey) return;
    lastKey = key;

    runtime.fn = fn;
    runtime.degree = degree;
    runtime.center = center;
    runtime.coefficients = taylorCoefficients(fn, center, degree);
    runtime.coverage = coverage(fn, center, degree);
    runtime.radius = fn.radius(center);

    const challenge = challenges[fn.id];
    if (runtime.coverage.covered) {
      challenge.done = true;
      if (challenge.bestDegree === null || degree < challenge.bestDegree) {
        challenge.bestDegree = degree;
      }
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      recompute(variables);
    },

    update(_dt, variables) {
      lastVariables = variables;
      recompute(variables);
    },

    reset() {
      this.resetChallenges!();
    },

    resetChallenges() {
      for (const challenge of Object.values(challenges)) {
        challenge.done = false;
        challenge.bestDegree = null;
      }
      lastKey = "";
      recompute(lastVariables);
    },

    getChallenges(): ChallengeStatus[] {
      // Un reto por función: cubrir su objetivo con el menor grado posible.
      // "Logrado" es llegar al mínimo; cubrirlo con más grado deja la barra
      // casi llena y dice que se puede mejorar, sin decir con qué centro.
      return SERIES_FUNCTIONS.map((fn) => {
        const challenge = challenges[fn.id];
        const active = runtime.fn.id === fn.id;
        const perfect =
          challenge.bestDegree !== null && challenge.bestDegree <= challenge.minDegree;
        const [lo, hi] = fn.target;
        return {
          id: fn.id,
          title: fn.label,
          detail: perfect
            ? `Grado ${challenge.bestDegree}: ¡el mínimo posible!`
            : challenge.done
              ? `Grado ${challenge.bestDegree}. Se puede con ${challenge.minDegree}: prueba otro centro.`
              : active
                ? `Cubierto: ${Math.round(runtime.coverage.fraction * 100)} % de [${lo.toFixed(2)}, ${hi.toFixed(2)}].`
                : `Cubre [${lo.toFixed(2)}, ${hi.toFixed(2)}] con el menor grado.`,
          done: perfect,
          progress: perfect
            ? 1
            : challenge.done
              ? 0.75
              : active
                ? runtime.coverage.fraction * 0.7
                : 0,
        };
      });
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // El error |P(x) − f(x)| a lo largo del intervalo objetivo, para la
      // mini gráfica: muestra dónde se rompe la aproximación.
      const [lo, hi] = runtime.fn.target;
      return Array.from({ length: 61 }, (_, i) => {
        const x = lo + ((hi - lo) * i) / 60;
        let p = 0;
        for (let n = runtime.coefficients.length - 1; n >= 0; n--) {
          p = p * (x - runtime.center) + runtime.coefficients[n];
        }
        return { x: Number(x.toFixed(2)), y: Math.min(1, Math.abs(p - runtime.fn.f(x))) };
      });
    },

    getState(): AIContext {
      const { fn, center, degree, coverage: cov, radius } = runtime;
      const challenge = challenges[fn.id];
      const [lo, hi] = fn.target;
      return {
        experimentName: "¿Cuántos términos?",
        disciplineName: "Cálculo",
        variables: lastVariables,
        result: {
          funcion: fn.expression,
          centro_usado: center,
          grado: degree,
          intervalo_objetivo: `[${lo.toFixed(2)}, ${hi.toFixed(2)}]`,
          tolerancia: TOLERANCE,
          cubierto: cov.covered ? "sí" : "no",
          porcentaje_cubierto: Math.round(cov.fraction * 100),
          error_maximo: Number.isFinite(cov.maxError)
            ? Number(cov.maxError.toFixed(4))
            : "infinito",
          radio_de_convergencia: Number.isFinite(radius)
            ? Number(radius.toFixed(2))
            : "infinito",
          ...(challenge.bestDegree !== null
            ? {
                mejor_grado_logrado: challenge.bestDegree,
                // Sí/no y no el número: el tutor puede animar a mejorar sin
                // regalar la respuesta.
                se_puede_con_menos_grado:
                  challenge.bestDegree > challenge.minDegree ? "sí" : "no",
              }
            : {}),
        },
        conceptTags: [
          "series de Taylor",
          "aproximación polinómica",
          "radio de convergencia",
          "error de truncamiento",
        ],
      };
    },
  };
}
