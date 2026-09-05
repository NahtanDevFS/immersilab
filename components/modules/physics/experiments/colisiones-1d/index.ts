import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createCollisionEngine } from "./engine";
import { CollisionScene } from "./CollisionScene";
import { CollisionControls } from "./CollisionControls";

const variablesSchema: VariablesSchema = {
  mass1: {
    type: "number",
    label: "Masa 1",
    unit: "kg",
    min: 0.5,
    max: 10,
    step: 0.5,
    default: 2,
  },
  velocity1: {
    type: "number",
    label: "Velocidad 1",
    unit: "m/s",
    min: -10,
    max: 10,
    step: 0.5,
    default: 5,
  },
  mass2: {
    type: "number",
    label: "Masa 2",
    unit: "kg",
    min: 0.5,
    max: 10,
    step: 0.5,
    default: 3,
  },
  velocity2: {
    type: "number",
    label: "Velocidad 2",
    unit: "m/s",
    min: -10,
    max: 10,
    step: 0.5,
    default: -3,
  },
  restitution: {
    type: "number",
    label: "Coef. de restitución",
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
  },
};

export const colisiones1DExperiment: ExperimentDefinition = {
  slug: "colisiones-1d",
  name: "Colisiones 1D",
  description:
    "Dos carritos chocan en línea recta — ajustá masa, velocidad y qué tan elástico es el choque.",
  variablesSchema,
  conceptTags: [
    "conservación del momento",
    "coeficiente de restitución",
    "energía cinética",
  ],
  briefing: {
    what: "Cuando dos cuerpos chocan, la cantidad de movimiento total (masa por velocidad, sumando los dos) es la misma antes y después. La energía, en cambio, se puede perder en el golpe.",
    how: "Dale masa y velocidad a cada carrito y soltalos. El coeficiente de restitución es qué tan rebotón es el choque: en uno rebotan como bolas de billar, en cero quedan pegados.",
    goal: "Comprobá que la cantidad de movimiento total no cambia, pongas el coeficiente que pongas, y mirá cómo la energía sí baja apenas el choque deja de ser perfectamente elástico.",
  },
  SceneComponent: CollisionScene,
  ControlsComponent: CollisionControls,
  createEngine: createCollisionEngine,
};