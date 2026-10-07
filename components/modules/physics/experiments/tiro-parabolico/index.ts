import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createProjectileEngine } from "./engine";
import { ProjectileScene } from "./ProjectileScene";
import { ProjectileControls } from "./ProjectileControls";

const variablesSchema: VariablesSchema = {
  modo: {
    type: "select",
    label: "Modo",
    default: "libre",
    options: [
      { label: "Tiro libre", value: "libre" },
      { label: "Artillería: tres blancos", value: "blancos" },
      { label: "Artillería con viento", value: "viento" },
    ],
  },
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
    "Lanza un proyectil ajustando ángulo, velocidad inicial, gravedad y resistencia del aire, y acierta a tres blancos.",
  variablesSchema,
  conceptTags: ["cinemática", "movimiento parabólico", "gravedad"],
  briefing: {
    what: "Un proyectil lanzado al aire sigue una parábola: avanza en horizontal a velocidad constante mientras la gravedad lo frena y lo trae de vuelta hacia abajo. Los dos movimientos son independientes y pasan al mismo tiempo.",
    how: "Ajusta el ángulo del cañón y la velocidad de salida, y dispara. La gravedad y la resistencia del aire también se pueden cambiar, para ver qué pasa en la Luna o con aire espeso.",
    goal: "Busca con qué ángulo llega más lejos a una misma velocidad: sin aire, el máximo está cerca de los cuarenta y cinco grados. Después cambia el modo a artillería: hay tres blancos a veinte, treinta y dos y cuarenta y cinco metros, y un disparo para cada uno. En el modo con viento, cada ronda sopla distinto y hay que corregir el tiro razonando, no repitiendo el de antes.",
  },
  tutorHints:
    "Las variables son angle (grados), velocity (metros por segundo), gravity (metros por segundo al cuadrado) y drag (coeficiente de resistencia del aire, en uno sobre segundo). " +
    "result solo aparece después de un disparo que ya aterrizó: alcance_m, altura_maxima_m y tiempo_vuelo_s. Si no hay result, invita a disparar. " +
    "Sin resistencia del aire el alcance es v al cuadrado por seno de dos theta, sobre ge, y es máximo a cuarenta y cinco grados; ángulos complementarios, como treinta y sesenta, llegan igual de lejos. " +
    "Con resistencia del aire el ángulo óptimo baja de cuarenta y cinco. " +
    "Confusión típica: creer que el proyectil 'pierde' velocidad horizontal sin aire; sin drag la componente horizontal es constante. " +
    "Modo artillería (variable modo: blancos o viento): tres blancos a 20, 32 y 45 metros del cañón, un disparo por blanco, de cero a cien puntos según cuántos metros erró (pierde ocho por metro); a menos de 1.5 metros es impacto. result trae blanco_actual_m, disparos, puntaje_ronda y, con viento, viento_m_s2 (positivo empuja hacia los blancos). " +
    "El viento es una aceleración horizontal constante: en un vuelo de dos o tres segundos corre la caída unos tres o cuatro metros. A favor hay que tirar más corto, en contra más largo. " +
    "Para ajustar fino conviene dejar la velocidad fija y mover el ángulo, que cambia el alcance de a poco lejos de cuarenta y cinco grados. No le dictes ángulo y velocidad exactos: guíalo con cuánto erró el disparo anterior.",
  // Lejos y de costado: el cañón a la izquierda y el tercer blanco (45 m) a
  // la derecha entran juntos en la vista, y cada disparo se ve completo.
  cameraView: { position: [21, 7, 34], target: [21, 3, 0] },
  SceneComponent: ProjectileScene,
  ControlsComponent: ProjectileControls,
  createEngine: createProjectileEngine,
};