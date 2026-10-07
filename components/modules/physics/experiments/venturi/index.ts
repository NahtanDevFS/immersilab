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
    "Angosta el tubo y mira lo que nadie espera: el fluido se acelera y la presión CAE justo donde va más rápido.",
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
    how: "Elige el fluido, sube o baja el caudal y, sobre todo, mueve el radio del cuello. Las esferas son el fluido: fíjate cómo se apretujan y se estiran al pasar por el estrechamiento. Las dos columnas naranjas son manómetros, una antes del cuello y otra encima: su altura es la presión.",
    goal: "Angosta el cuello hasta que la columna de la derecha quede bien por debajo de la otra, sin pasarte: si la presión baja de la presión de vapor del líquido, este hierve en frío, el fluido se pone rojo y eso es cavitación, lo que se come las bombas y las hélices de verdad. Prueba con aceite y con aire y mira cuánto cambia el margen.",
  },
  tutorHints:
    "Variables: fluido (agua, aceite liviano o aire), caudal en litros por segundo y cuello, el radio del estrechamiento en metros; el tubo principal mide seis centímetros de radio. " +
    "result: velocidad_tubo_ms y velocidad_cuello_ms, presion_cuello_kpa, caida_de_presion_kpa, reynolds y regimen (laminar o turbulento), fluido, y alerta cuando hay cavitación. " +
    "Continuidad: el área por la velocidad es constante, así que la velocidad crece con uno sobre el radio al cuadrado: con la mitad del radio el fluido va cuatro veces más rápido. " +
    "Bernoulli: la presión más un medio de la densidad por la velocidad al cuadrado se conserva, así que donde va más rápido la presión baja. " +
    "La cavitación ocurre cuando la presión cae por debajo de la presión de vapor y el líquido hierve en frío; el aire es un gas y no cavita. Confusión típica: creer que en el angostamiento la presión sube.",
  SceneComponent: VenturiScene,
  createEngine: createVenturiEngine,
};
