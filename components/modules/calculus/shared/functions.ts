/**
 * Catálogo de funciones que comparten los experimentos de cálculo.
 *
 * Son funciones cerradas y no expresiones que el alumno escribe: un parser de
 * expresiones sería la mitad del trabajo del módulo y no enseña cálculo. Con
 * cuatro familias alcanza para mostrar todo lo que los experimentos quieren
 * mostrar (curvatura, cambio de signo de la derivada, crecimiento rápido).
 *
 * Cada entrada trae también su primitiva analítica (`F`): sirve para poder
 * comparar la suma de Riemann contra el valor exacto de verdad, no contra
 * otra aproximación numérica más fina. Es justo la comparación que el
 * experimento C2 quiere que el alumno mire.
 */
export interface MathFunction {
  id: string;
  label: string;
  /** Cómo se escribe, para mostrarla en el panel y pasarla al tutor. */
  expression: string;
  f: (x: number) => number;
  /** Primitiva: F'(x) = f(x). La constante de integración es irrelevante. */
  F: (x: number) => number;
  /** Derivada analítica, para los experimentos que la necesiten (C1). */
  df: (x: number) => number;
  /** Dominio donde la función está definida y se ve bien. */
  domain: [number, number];
}

export const FUNCTIONS: MathFunction[] = [
  {
    id: "parabola",
    label: "f(x) = x²/4 + 1",
    expression: "x^2/4 + 1",
    f: (x) => (x * x) / 4 + 1,
    F: (x) => (x * x * x) / 12 + x,
    df: (x) => x / 2,
    domain: [0, 8],
  },
  {
    id: "seno",
    label: "f(x) = 2 + sen(x)",
    expression: "2 + sin(x)",
    // Desplazada 2 hacia arriba para que no cruce el cero: con área negativa
    // los bloques de Riemann quedarían por debajo del eje y el experimento
    // pasaría a ser sobre área con signo, que es otro tema.
    f: (x) => 2 + Math.sin(x),
    F: (x) => 2 * x - Math.cos(x),
    df: (x) => Math.cos(x),
    domain: [0, 2 * Math.PI],
  },
  {
    id: "raiz",
    label: "f(x) = 1 + √x",
    expression: "1 + sqrt(x)",
    f: (x) => 1 + Math.sqrt(Math.max(x, 0)),
    F: (x) => x + (2 / 3) * Math.pow(Math.max(x, 0), 1.5),
    // En x=0 la derivada diverge; se acota para que nada explote en pantalla.
    df: (x) => (x <= 0.001 ? 15 : 0.5 / Math.sqrt(x)),
    domain: [0, 9],
  },
  {
    id: "exponencial",
    label: "f(x) = e^(x/3)",
    expression: "exp(x/3)",
    f: (x) => Math.exp(x / 3),
    F: (x) => 3 * Math.exp(x / 3),
    df: (x) => Math.exp(x / 3) / 3,
    domain: [0, 6],
  },
];

export function getFunction(id: string | number | boolean): MathFunction {
  return FUNCTIONS.find((fn) => fn.id === String(id)) ?? FUNCTIONS[0];
}

/** Opciones listas para un `VariableDefinition` de tipo select. */
export const FUNCTION_OPTIONS = FUNCTIONS.map((fn) => ({
  label: fn.label,
  value: fn.id,
}));
