import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import { createCollisionEngine, type CollisionEngine } from "./engine";
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
  // F2 · Predice el resultado: se anotan ANTES de soltar.
  pred_v1: {
    type: "number",
    label: "Tu predicción: v₁ final",
    unit: "m/s",
    min: -10,
    max: 10,
    step: 0.1,
    default: 0,
  },
  pred_v2: {
    type: "number",
    label: "Tu predicción: v₂ final",
    unit: "m/s",
    min: -10,
    max: 10,
    step: 0.1,
    default: 0,
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
    goal: "Antes de soltar, anota en los dos últimos controles a qué velocidad crees que va a salir cada carrito: al chocar se compara con lo que pasó y te da un puntaje. Acierta un choque elástico, uno plástico y uno a medias con masas distintas. La pista: la cantidad de movimiento total no cambia nunca, la energía solo se conserva si el choque es perfectamente elástico.",
  },
  tutorHints:
    "Variables: mass1 y mass2 en kilogramos, velocity1 y velocity2 en metros por segundo (negativo significa que se mueve hacia la izquierda) y restitution, el coeficiente de restitución entre cero y uno. " +
    "result solo aparece después del choque: velocidad_1_final_ms, velocidad_2_final_ms y energia_perdida_pct. " +
    "La cantidad de movimiento total, masa uno por velocidad uno más masa dos por velocidad dos, es igual antes y después del choque para cualquier coeficiente. " +
    "Con coeficiente uno el choque es elástico y no se pierde energía cinética; con cero quedan pegados y se mueven juntos a la velocidad del centro de masa. Con masas iguales y choque elástico intercambian velocidades. " +
    "Confusión típica: creer que si se pierde energía también se pierde cantidad de movimiento. Cuida los signos de las velocidades. " +
    "Juego de predicción: pred_v1 y pred_v2 son las velocidades finales que el estudiante predice; se congelan al soltar. El puntaje es cien menos el error total, relativo a la suma de las rapideces iniciales; noventa o más cuenta para los retos (elástico con restitución uno, plástico con cero, y a medias entre 0.2 y 0.8 con masas que difieran en un kilogramo o más). " +
    "Fórmulas: v uno final es ((m1 menos e por m2) por v1 más (1 más e) por m2 por v2) sobre (m1 más m2), y v dos final es lo mismo intercambiando los índices. En el plástico ambos salen a (m1 v1 más m2 v2) sobre (m1 más m2). " +
    "No le des los números de su predicción: guíalo a plantear la conservación de la cantidad de movimiento y, si es elástico, la de la energía o la velocidad relativa que se invierte.",
  SceneComponent: CollisionScene,
  ControlsComponent: CollisionControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const c = engine as CollisionEngine;
    const r = c.getRuntime();
    const actions: VrAction[] = [];
    if (r.prediction?.score != null) {
      actions.push({ id: "puntaje", label: `Tu predicción: ${r.prediction.score} pts`, info: true });
    }
    actions.push({
      id: "soltar",
      label: r.phase === "collided" ? "Soltar de nuevo" : "Soltar",
      onSelect: () => c.start(),
      disabled: r.phase === "moving",
      primary: true,
    });
    if (r.phase !== "idle") actions.push({ id: "reiniciar", label: "Reiniciar", onSelect: () => c.reset() });
    return actions;
  },
  createEngine: createCollisionEngine,
};