import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { TRACK_OPTIONS } from "@/components/modules/calculus/shared/tracks";
import { createDerivativeEngine } from "./engine";
import { DerivativeScene } from "./DerivativeScene";
import { RideControls } from "./RideControls";

const variablesSchema: VariablesSchema = {
  pista: {
    type: "select",
    label: "Pista",
    default: "ondas",
    options: TRACK_OPTIONS,
  },
  amplitud: {
    type: "number",
    label: "Amplitud (A)",
    min: 0.4,
    max: 2,
    step: 0.1,
    default: 1,
  },
  velocidad: {
    type: "number",
    label: "Velocidad del vagón",
    unit: "x/s",
    min: 0.4,
    max: 4,
    step: 0.1,
    default: 1.6,
  },
};

export const derivadaPicoExperiment: ExperimentDefinition = {
  slug: "derivada-pico",
  name: "Frená en el pico",
  description:
    "El vagón recorre la curva y el velocímetro marca f'(x). Frená exactamente donde la pendiente es cero.",
  variablesSchema,
  conceptTags: [
    "derivada",
    "pendiente instantánea",
    "puntos críticos",
    "máximos y mínimos",
  ],
  briefing: {
    what: "La derivada de una función es su pendiente en un punto exacto: qué tan empinada está la curva justo ahí. Donde la curva llega a un pico o a un valle, deja de subir y todavía no baja, así que la pendiente vale cero.",
    how: "El vagón recorre la curva y el número de abajo es la derivada en el punto donde va: positivo si sube, negativo si baja. La recta que gira con el vagón es esa misma pendiente, dibujada.",
    goal: "Frená lo más cerca que puedas de donde la derivada vale cero, mirando el número, no la curva. Al frenar aparecen marcados los picos y los valles, y vas a ver si le pegaste.",
  },
  SceneComponent: DerivativeScene,
  ControlsComponent: RideControls,
  createEngine: createDerivativeEngine,
};
