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
};

export const tiroParabolicoExperiment: ExperimentDefinition = {
  slug: "tiro-parabolico",
  name: "Tiro parabólico",
  description:
    "Lanza un proyectil ajustando ángulo, velocidad inicial y gravedad.",
  variablesSchema,
  conceptTags: ["cinemática", "movimiento parabólico", "gravedad"],
  SceneComponent: ProjectileScene,
  ControlsComponent: ProjectileControls,
  createEngine: createProjectileEngine,
};