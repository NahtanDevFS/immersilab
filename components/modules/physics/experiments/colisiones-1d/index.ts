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
    "Dos carritos chocan en línea recta — ajusta masa, velocidad y qué tan elástico es el choque.",
  variablesSchema,
  conceptTags: [
    "conservación del momento",
    "coeficiente de restitución",
    "energía cinética",
  ],
  briefing: {
    what: "Cuando dos cuerpos chocan, la cantidad de movimiento total (masa por velocidad, sumando los dos) es la misma antes y después. La energía, en cambio, se puede perder en el golpe.",
    how: "Dale masa y velocidad a cada carrito y suéltalos. El coeficiente de restitución es qué tan rebotón es el choque: en uno rebotan como bolas de billar, en cero quedan pegados.",
    goal: "Comprueba que la cantidad de movimiento total no cambia, pongas el coeficiente que pongas, y mira cómo la energía sí baja apenas el choque deja de ser perfectamente elástico.",
  },
  tutorHints:
    "Variables: mass1 y mass2 en kilogramos, velocity1 y velocity2 en metros por segundo (negativo significa que se mueve hacia la izquierda) y restitution, el coeficiente de restitución entre cero y uno. " +
    "result solo aparece después del choque: velocidad_1_final_ms, velocidad_2_final_ms y energia_perdida_pct. " +
    "La cantidad de movimiento total, masa uno por velocidad uno más masa dos por velocidad dos, es igual antes y después del choque para cualquier coeficiente. " +
    "Con coeficiente uno el choque es elástico y no se pierde energía cinética; con cero quedan pegados y se mueven juntos a la velocidad del centro de masa. Con masas iguales y choque elástico intercambian velocidades. " +
    "Confusión típica: creer que si se pierde energía también se pierde cantidad de movimiento. Cuida los signos de las velocidades.",
  SceneComponent: CollisionScene,
  ControlsComponent: CollisionControls,
  createEngine: createCollisionEngine,
};