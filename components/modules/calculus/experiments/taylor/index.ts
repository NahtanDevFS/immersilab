import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createTaylorEngine } from "./engine";
import { TaylorScene } from "./TaylorScene";
import { MAX_DEGREE, CENTER_STEP, SERIES_OPTIONS } from "./series";

const variablesSchema: VariablesSchema = {
  funcion: {
    type: "select",
    label: "Función",
    default: "seno",
    options: SERIES_OPTIONS,
  },
  grado: {
    type: "number",
    label: "Grado del polinomio",
    min: 0,
    max: MAX_DEGREE,
    step: 1,
    default: 1,
  },
  centro: {
    type: "number",
    label: "Centro (a)",
    min: -3,
    max: 3,
    step: CENTER_STEP,
    default: 0,
  },
};

export const taylorExperiment: ExperimentDefinition = {
  slug: "taylor",
  name: "¿Cuántos términos?",
  description:
    "Aproxima una función con un polinomio de Taylor: cada término lo pega más a la curva, pero solo cerca del centro.",
  variablesSchema,
  conceptTags: [
    "series de Taylor",
    "aproximación polinómica",
    "radio de convergencia",
    "error de truncamiento",
  ],
  briefing: {
    what: "Una serie de Taylor reemplaza una función complicada por un polinomio que se le parece cerca de un punto, el centro. Cada término que se agrega copia una derivada más de la función en ese punto, así que el polinomio se le pega cada vez más. Es lo que hacen las calculadoras para obtener un seno o una exponencial.",
    how: "La curva verde es la función real y la naranja es el polinomio. Sube el grado para agregar términos y mueve el centro para cambiar dónde se pega. En el piso, la franja se pone verde donde el error ya es menor que cinco centésimas; la barra violeta marca el radio de convergencia, cuando existe.",
    goal: "Cada función tiene un intervalo objetivo marcado con dos postes: cúbrelo entero, con la franja verde de punta a punta, usando el menor grado posible. Mover el centro ahorra términos. Y fíjate en el logaritmo y en uno sobre uno menos x: centradas en cero no alcanzan su objetivo con ningún grado, porque más allá del radio de convergencia la serie se dispara.",
  },
  tutorHints:
    "Variables: funcion es seno, exponencial, logaritmo (ln de uno más x) o geometrica (uno sobre uno menos x); grado es el grado del polinomio de Taylor, de cero a doce; centro es el punto a alrededor del cual se desarrolla la serie (se acota al dominio de cada función, y centro_usado en result dice el valor real). " +
    "result: funcion, centro_usado, grado, intervalo_objetivo, tolerancia (cinco centésimas), cubierto, porcentaje_cubierto, error_maximo en el intervalo, radio_de_convergencia y, si ya lo logró, mejor_grado_logrado. " +
    "El polinomio de Taylor es la suma de la derivada enésima en a sobre ene factorial, por x menos a a la ene. El error crece al alejarse del centro, por eso conviene centrar la serie cerca del medio del intervalo objetivo. " +
    "Seno y exponencial convergen en toda la recta: con suficientes términos cualquier intervalo se cubre. Logaritmo de uno más x tiene una singularidad en menos uno y uno sobre uno menos x en uno: su radio de convergencia es la distancia del centro a esa singularidad, y fuera de él la serie diverge sin importar el grado. Centradas en cero, no pueden cubrir su objetivo. " +
    "Hay un grado mínimo con el que se logra cada reto; no lo reveles ni digas el centro exacto: guía con preguntas sobre dónde está el centro respecto del intervalo y del radio.",
  SceneComponent: TaylorScene,
  createEngine: createTaylorEngine,
};
