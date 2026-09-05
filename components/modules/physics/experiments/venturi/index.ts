import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createVenturiEngine, FLUIDS } from "./engine";
import { VenturiScene } from "./VenturiScene";

const variablesSchema: VariablesSchema = {
  fluido: {
    type: "select",
    label: "Fluido",
    default: "agua",
    options: FLUIDS.map((f) => ({ label: f.label, value: f.id })),
  },
  caudal: {
    type: "number",
    label: "Caudal",
    unit: "L/s",
    min: 1,
    max: 30,
    step: 0.5,
    default: 8,
  },
  cuello: {
    // El tramo ancho mide 6 cm de radio (PIPE_RADIUS): el tope de 5.5 cm deja
    // siempre algo de estrechamiento, y el piso de 1 cm es donde el agua ya
    // cavita sin remedio — los dos extremos del slider enseñan algo.
    type: "number",
    label: "Radio del cuello",
    unit: "m",
    min: 0.01,
    max: 0.055,
    step: 0.0025,
    default: 0.03,
  },
};

export const venturiExperiment: ExperimentDefinition = {
  slug: "venturi",
  name: "Tubo de Venturi",
  description:
    "Angostá el tubo y mirá lo que nadie espera: el fluido se acelera y la presión CAE justo donde va más rápido.",
  variablesSchema,
  conceptTags: [
    "mecánica de fluidos",
    "ecuación de continuidad",
    "principio de Bernoulli",
    "cavitación",
    "número de Reynolds",
  ],
  briefing: {
    what: "Por un tubo cerrado pasa siempre la misma cantidad de fluido por segundo. Si el tubo se angosta, el fluido no tiene más remedio que ir más rápido; y como la energía total se conserva, lo que gana en velocidad lo paga en presión. Por eso la presión es MENOR justo donde el tubo es más angosto, al revés de lo que dice la intuición.",
    how: "Elegí el fluido, subí o bajá el caudal y, sobre todo, movés el radio del cuello. Las esferas son el fluido: fijate cómo se apretujan y se estiran al pasar por el estrechamiento. Las dos columnas naranjas son manómetros, una antes del cuello y otra encima: su altura es la presión.",
    goal: "Angostá el cuello hasta que la columna de la derecha quede bien por debajo de la otra, sin pasarte: si la presión baja de la presión de vapor del líquido, este hierve en frío, el fluido se pone rojo y eso es cavitación, lo que se come las bombas y las hélices de verdad. Probá con aceite y con aire y mirá cuánto cambia el margen.",
  },
  SceneComponent: VenturiScene,
  createEngine: createVenturiEngine,
};
