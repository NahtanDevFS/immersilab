import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { FUNCTION_OPTIONS } from "@/components/modules/calculus/shared/functions";
import { createRiemannEngine } from "./engine";
import { RiemannScene } from "./RiemannScene";

const variablesSchema: VariablesSchema = {
  funcion: {
    type: "select",
    label: "Función",
    default: "parabola",
    options: FUNCTION_OPTIONS,
  },
  metodo: {
    type: "select",
    label: "Método",
    default: "izquierda",
    options: [
      { label: "Extremo izquierdo", value: "izquierda" },
      { label: "Extremo derecho", value: "derecha" },
      { label: "Punto medio", value: "punto-medio" },
      { label: "Trapecio", value: "trapecio" },
    ],
  },
  n: {
    type: "number",
    label: "Bloques (n)",
    min: 1,
    max: 200,
    step: 1,
    default: 8,
  },
  // El intervalo se recorta al dominio de cada función dentro del motor, así
  // que estos límites son los del dominio más ancho del catálogo.
  a: { type: "number", label: "Desde (a)", min: 0, max: 8, step: 0.25, default: 0 },
  b: { type: "number", label: "Hasta (b)", min: 0.5, max: 9, step: 0.25, default: 6 },
};

export const sumaRiemannExperiment: ExperimentDefinition = {
  slug: "suma-riemann",
  name: "Suma de Riemann",
  description:
    "Llená el área bajo la curva con bloques. El reto: bajar del 1% de error con la MENOR cantidad de bloques posible.",
  variablesSchema,
  conceptTags: [
    "integral definida",
    "suma de Riemann",
    "convergencia",
    "error de aproximación",
  ],
  briefing: {
    what: "La integral de una función es el área que queda entre su curva y el eje horizontal. Cuando esa área no tiene una figura conocida, se la aproxima llenándola con bloques rectangulares: eso es una suma de Riemann.",
    how: "Elegí una función y un intervalo. El deslizador de bloques parte ese intervalo en pedazos: mientras más bloques, más fino el escalonado y más se parece la suma al área real. El método decide con qué altura se dibuja cada bloque.",
    goal: "Bajá el error a menos del uno por ciento usando la menor cantidad de bloques que puedas. Fijate que con el método del trapecio se llega con muchos menos bloques que con el del extremo izquierdo: esa es la idea de convergencia.",
  },
  SceneComponent: RiemannScene,
  createEngine: createRiemannEngine,
};
