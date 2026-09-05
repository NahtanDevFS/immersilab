import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createProjectileEngine } from "./engine";
import { ProjectileScene } from "./ProjectileScene";
import { ProjectileControls } from "./ProjectileControls";

const variablesSchema: VariablesSchema = {
  angle: {
    type: "number",
    label: "Ángulo",
    unit: "°",
    min: 0,
    max: 90,
    step: 1,
    default: 45,
  },
  velocity: {
    type: "number",
    label: "Velocidad inicial",
    unit: "m/s",
    min: 1,
    max: 50,
    step: 1,
    default: 20,
  },
  gravity: {
    type: "number",
    label: "Gravedad",
    unit: "m/s²",
    min: 1,
    max: 25,
    step: 0.1,
    default: 9.81,
  },
    drag: {
    type: "number",
    label: "Resistencia del aire",
    unit: "1/s",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
  },
};

export const tiroParabolicoExperiment: ExperimentDefinition = {
  slug: "tiro-parabolico",
  name: "Tiro parabólico",
  description:
    "Lanza un proyectil ajustando ángulo, velocidad inicial, gravedad y resistencia del aire.",  variablesSchema,
  conceptTags: ["cinemática", "movimiento parabólico", "gravedad"],
  briefing: {
    what: "Un proyectil lanzado al aire sigue una parábola: avanza en horizontal a velocidad constante mientras la gravedad lo frena y lo trae de vuelta hacia abajo. Los dos movimientos son independientes y pasan al mismo tiempo.",
    how: "Ajustá el ángulo del cañón y la velocidad de salida, y disparalo. La gravedad y la resistencia del aire también se pueden cambiar, para ver qué pasa en la Luna o con aire espeso.",
    goal: "Buscá con qué ángulo llega más lejos a una misma velocidad. Sin resistencia del aire el máximo está cerca de los cuarenta y cinco grados; probá si con aire sigue siendo así.",
  },
  SceneComponent: ProjectileScene,
  ControlsComponent: ProjectileControls,
  createEngine: createProjectileEngine,
};