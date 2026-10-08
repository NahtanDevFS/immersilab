import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { TRACK_OPTIONS } from "@/components/modules/calculus/shared/tracks";
import { createDerivativeEngine, type DerivativeEngine } from "./engine";
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
  name: "Frena en el pico",
  description:
    "El vagón recorre la curva y el velocímetro marca f'(x). Frena exactamente donde la pendiente es cero.",
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
    goal: "Frena lo más cerca que puedas de donde la derivada vale cero, mirando el número, no la curva. Al frenar aparecen marcados los picos y los valles, y vas a ver si acertaste.",
  },
  tutorHints:
    "Variables: pista es la curva (ondas = sen(x) + sen(2x)/2, cubica = x³/9 − x² + 2x, colinas = dos gaussianas), amplitud escala la curva en vertical y velocidad es qué tan rápido avanza el vagón. " +
    "result solo aparece después de frenar: pendiente_al_frenar es f'(x) donde se detuvo, distancia_al_pico es cuánto le faltó o se pasó del punto crítico más cercano, y además vienen puntaje, mejor_puntaje e intentos. Si no hay result, invita a soltar el vagón y frenar. " +
    "Idea central: en un máximo o un mínimo la recta tangente queda horizontal y la derivada vale cero; la señal para frenar es el número cambiando de signo, de positivo a negativo en un pico y de negativo a positivo en un valle. " +
    "Cambiar la amplitud multiplica la derivada por el mismo factor pero no mueve los puntos donde vale cero. " +
    "Confusiones típicas: creer que f'(x) igual a cero significa que la función vale cero, y olvidar que los valles también son puntos críticos. A más velocidad cuesta más frenar a tiempo: sugiere bajarla para practicar.",
  SceneComponent: DerivativeScene,
  ControlsComponent: RideControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const d = engine as DerivativeEngine;
    const r = d.getRuntime();
    if (r.phase === "rodando") {
      return [
        { id: "pendiente", label: `f'(x) = ${r.slope.toFixed(2)}`, info: true },
        { id: "frenar", label: "¡Frenar!", onSelect: () => d.brake(), primary: true },
      ];
    }
    return [
      {
        id: "arrancar",
        label: r.phase === "frenado" ? "Otra vuelta" : "Arrancar",
        onSelect: () => d.start(),
        primary: true,
      },
    ];
  },
  createEngine: createDerivativeEngine,
};
