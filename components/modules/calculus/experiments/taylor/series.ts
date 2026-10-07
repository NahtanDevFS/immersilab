/**
 * Matemática de C4 · Series de Taylor, sin nada de React ni three.
 *
 * Catálogo propio y no el compartido de cálculo (`shared/functions.ts`): lo
 * que este experimento necesita de cada función es la fórmula de su n-ésimo
 * coeficiente de Taylor y su radio de convergencia, y esas cuatro funciones
 * están elegidas por eso: dos convergen en toda la recta (sen, exp) y dos
 * tienen un radio finito (ln(1+x), 1/(1−x)), que es la lección central.
 */

export interface SeriesFunction {
  id: string;
  label: string;
  /** Cómo se escribe, para el panel y para el tutor. */
  expression: string;
  f: (x: number) => number;
  /** Coeficiente n-ésimo alrededor de a: f⁽ⁿ⁾(a) / n!. */
  coefficient: (n: number, a: number) => number;
  /** Radio de convergencia de la serie centrada en a (Infinity si converge siempre). */
  radius: (a: number) => number;
  /** Centros permitidos (dentro del dominio, lejos de la singularidad). */
  centerRange: [number, number];
  /** Ventana de x que se dibuja. */
  window: [number, number];
  /** Rango de y que se dibuja; lo que se sale se corta. */
  yRange: [number, number];
  /** Intervalo que hay que cubrir en el reto. */
  target: [number, number];
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export const SERIES_FUNCTIONS: SeriesFunction[] = [
  {
    id: "seno",
    label: "sen(x)",
    expression: "sin(x)",
    f: Math.sin,
    // Las derivadas del seno ciclan: sen, cos, −sen, −cos.
    coefficient: (n, a) => Math.sin(a + (n * Math.PI) / 2) / factorial(n),
    radius: () => Infinity,
    centerRange: [-3, 3],
    window: [-2 * Math.PI, 2 * Math.PI],
    yRange: [-2, 2],
    target: [-Math.PI, Math.PI],
  },
  {
    id: "exponencial",
    label: "eˣ",
    expression: "exp(x)",
    f: Math.exp,
    coefficient: (n, a) => Math.exp(a) / factorial(n),
    radius: () => Infinity,
    centerRange: [-2, 3],
    window: [-2, 3.5],
    yRange: [-2, 24],
    target: [0, 3],
  },
  {
    id: "logaritmo",
    label: "ln(1 + x)",
    expression: "ln(1 + x)",
    f: (x) => Math.log(1 + x),
    coefficient: (n, a) =>
      n === 0
        ? Math.log(1 + a)
        : ((n % 2 === 1 ? 1 : -1) / n) / (1 + a) ** n,
    // La singularidad está en x = −1: el radio es la distancia del centro a ella.
    radius: (a) => 1 + a,
    centerRange: [-0.8, 2],
    window: [-0.95, 3],
    yRange: [-3, 2],
    target: [0, 2.5],
  },
  {
    id: "geometrica",
    label: "1 / (1 − x)",
    expression: "1/(1 - x)",
    f: (x) => 1 / (1 - x),
    coefficient: (n, a) => 1 / (1 - a) ** (n + 1),
    // La singularidad está en x = 1.
    radius: (a) => 1 - a,
    centerRange: [-2, 0.8],
    window: [-3, 0.9],
    yRange: [-1, 10],
    target: [-2, 0],
  },
];

export function getSeriesFunction(id: string | number | boolean): SeriesFunction {
  return SERIES_FUNCTIONS.find((fn) => fn.id === String(id)) ?? SERIES_FUNCTIONS[0];
}

export const SERIES_OPTIONS = SERIES_FUNCTIONS.map((fn) => ({
  label: fn.label,
  value: fn.id,
}));

/** Error máximo aceptado para considerar que el polinomio "ya vale" en un punto. */
export const TOLERANCE = 0.05;
export const MAX_DEGREE = 12;
/** Paso del slider del centro: el mínimo posible se busca sobre esta misma grilla. */
export const CENTER_STEP = 0.1;

/** El centro que se usa de verdad: el pedido, acotado al rango válido de la función. */
export function effectiveCenter(fn: SeriesFunction, requested: number): number {
  const [lo, hi] = fn.centerRange;
  return Math.min(hi, Math.max(lo, requested));
}

export function taylorCoefficients(fn: SeriesFunction, a: number, degree: number): number[] {
  return Array.from({ length: degree + 1 }, (_, n) => fn.coefficient(n, a));
}

/** Evalúa Σ cₙ (x − a)ⁿ con Horner. */
export function evalTaylor(coefficients: number[], a: number, x: number): number {
  const h = x - a;
  let sum = 0;
  for (let n = coefficients.length - 1; n >= 0; n--) sum = sum * h + coefficients[n];
  return sum;
}

export interface Coverage {
  /** ¿El error es menor que la tolerancia en todo el intervalo objetivo? */
  covered: boolean;
  /** Fracción 0–1 del intervalo objetivo donde ya vale. */
  fraction: number;
  /** Error máximo dentro del intervalo objetivo. */
  maxError: number;
}

const SAMPLES = 200;

export function coverage(fn: SeriesFunction, a: number, degree: number): Coverage {
  const coefficients = taylorCoefficients(fn, a, degree);
  const [lo, hi] = fn.target;
  let inside = 0;
  let maxError = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = lo + ((hi - lo) * i) / SAMPLES;
    const error = Math.abs(evalTaylor(coefficients, a, x) - fn.f(x));
    if (error < TOLERANCE) inside++;
    if (error > maxError || !Number.isFinite(error)) maxError = error;
  }
  return {
    covered: inside === SAMPLES + 1,
    fraction: inside / (SAMPLES + 1),
    maxError,
  };
}

/**
 * El menor grado con el que se puede cubrir el objetivo, probando todos los
 * centros que permite el slider. Es la vara contra la que se compara al
 * jugador: "lo lograste con grado 9, el mínimo es 7".
 */
export function minimalDegree(fn: SeriesFunction): { degree: number; center: number } {
  const [lo, hi] = fn.centerRange;
  for (let degree = 0; degree <= MAX_DEGREE; degree++) {
    for (let c = Math.round(lo / CENTER_STEP); c <= Math.round(hi / CENTER_STEP); c++) {
      const center = Number((c * CENTER_STEP).toFixed(2));
      if (coverage(fn, center, degree).covered) return { degree, center };
    }
  }
  return { degree: Infinity, center: NaN };
}
