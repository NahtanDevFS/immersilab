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
    how: "Ajusta el ángulo del cañón y la velocidad de salida, y dispara. La gravedad y la resistencia del aire también se pueden cambiar, para ver qué pasa en la Luna o con aire espeso.",
    goal: "Busca con qué ángulo llega más lejos a una misma velocidad. Sin resistencia del aire el máximo está cerca de los cuarenta y cinco grados; prueba si con aire sigue siendo así.",
  },
  tutorHints:
    "Las variables son angle (grados), velocity (metros por segundo), gravity (metros por segundo al cuadrado) y drag (coeficiente de resistencia del aire, en uno sobre segundo). " +
    "result solo aparece después de un disparo que ya aterrizó: alcance_m, altura_maxima_m y tiempo_vuelo_s. Si no hay result, invita a disparar. " +
    "Sin resistencia del aire el alcance es v al cuadrado por seno de dos theta, sobre ge, y es máximo a cuarenta y cinco grados; ángulos complementarios, como treinta y sesenta, llegan igual de lejos. " +
    "Con resistencia del aire el ángulo óptimo baja de cuarenta y cinco. " +
    "Confusión típica: creer que el proyectil 'pierde' velocidad horizontal sin aire; sin drag la componente horizontal es constante.",
  SceneComponent: ProjectileScene,
  ControlsComponent: ProjectileControls,
  createEngine: createProjectileEngine,
};