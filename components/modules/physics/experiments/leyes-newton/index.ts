import type { ExperimentDefinition, ExperimentEngine, VariablesSchema, VrAction } from "@/types/module";
import { actionControls } from "@/components/modules/shared/ActionList";
import { SURFACES, createNewtonEngine, type NewtonEngine } from "./engine";
import { NewtonScene } from "./NewtonScene";

const variablesSchema: VariablesSchema = {
  escenario: {
    type: "select",
    label: "Situación",
    default: "plano",
    options: [
      { label: "Plano inclinado", value: "plano" },
      { label: "Polea", value: "polea" },
    ],
  },
  angulo: { type: "number", label: "Ángulo de la rampa", unit: "°", min: 0, max: 60, step: 0.5, default: 20 },
  masa: { type: "number", label: "Masa de la caja", unit: "kg", min: 1, max: 20, step: 0.5, default: 10 },
  masa_colgante: { type: "number", label: "Pesa que cuelga (polea)", unit: "kg", min: 0.5, max: 20, step: 0.5, default: 3 },
  superficie: {
    type: "select",
    label: "Superficie",
    default: "madera",
    options: SURFACES.map((s) => ({ label: `${s.label} (μs ${s.mus}, μk ${s.muk})`, value: s.id })),
  },
  fuerza: { type: "number", label: "Fuerza aplicada (+ hacia arriba)", unit: "N", min: -150, max: 150, step: 1, default: 0 },
  componentes: { type: "boolean", label: "Mostrar componentes del peso", default: false },
  pred_se_mueve: {
    type: "select",
    label: "¿Se va a mover?",
    default: "no",
    options: [
      { label: "Sí", value: "si" },
      { label: "No", value: "no" },
    ],
    group: "Tu predicción",
  },
  prediccion_a: { type: "number", label: "Aceleración", unit: "m/s²", min: 0, max: 10, step: 0.01, default: 0, group: "Tu predicción" },
};

function actions(engine: ExperimentEngine): VrAction[] {
  const newton = engine as NewtonEngine;
  const r = newton.getRuntime();
  const list: VrAction[] = [];
  const last = r.last;
  if (last && r.phase !== "idle") {
    const f = last.forces;
    list.push({
      id: "resultado",
      label: `${f.moves ? `Se mueve: a = ${f.acceleration.toFixed(2)} m/s²` : "No se mueve"} · predijiste ${last.predictedMoves ? "que sí" : "que no"} ${last.movesRight ? "(bien)" : "(mal)"}${last.aError !== null ? ` · error en a ${(last.aError * 100).toFixed(1)} %` : ""}`,
      info: true,
    });
    list.push({ id: "neta", label: `Fuerza neta: ${Math.abs(f.net).toFixed(1)} N`, info: true });
  }
  list.push({
    id: "soltar",
    label: r.phase === "moving" ? "Moviéndose…" : "Soltar",
    onSelect: () => newton.release(),
    disabled: r.phase === "moving",
    primary: true,
  });
  if (r.phase !== "idle") list.push({ id: "volver", label: "Volver a poner la caja", onSelect: () => newton.reset() });
  return list;
}

export const leyesNewtonExperiment: ExperimentDefinition = {
  slug: "leyes-newton",
  name: "Leyes de Newton",
  description:
    "Una caja en una rampa o tirada por una pesa con una polea: dibuja las fuerzas, predice si se mueve y con qué aceleración.",
  variablesSchema,
  cameraView: { position: [0.2, 2.3, 6.4], target: [0, 1.3, 0] },
  conceptTags: ["segunda ley de Newton", "fricción estática", "fricción cinética", "diagrama de cuerpo libre", "plano inclinado", "tensión"],
  briefing: {
    what: "La segunda ley de Newton dice que la suma de todas las fuerzas sobre un cuerpo es igual a su masa por su aceleración. Para sumarlas hay que dibujarlas: eso es el diagrama de cuerpo libre. La fricción tiene truco: mientras la caja está quieta, la fricción estática vale lo justo para frenarla, hasta un máximo; si eso no alcanza, la caja resbala y la fricción pasa a ser cinética, un poco menor.",
    how: "Elige la situación, el ángulo de la rampa, la masa, la superficie y, si quieres, una fuerza que empuje a lo largo de la rampa. Sobre la caja aparecen las flechas de cada fuerza con su valor. Antes de soltar, di si crees que se va a mover y con qué aceleración. Después aprieta soltar y compara.",
    goal: "Acierta tres veces seguidas si la caja se mueve, con al menos una que se quede quieta. Predice la aceleración de una caja que resbala y la de la polea, con un error menor al cinco por ciento. Encuentra el ángulo crítico, donde la caja empieza a resbalar sola, y la fuerza mínima para subirla por la rampa.",
  },
  tutorHints:
    "Variables: escenario (plano o polea), angulo de la rampa en grados (0 a 60), masa de la caja en kilogramos, masa_colgante de la pesa en la polea, superficie (madera: mu estático 0.5 y cinético 0.3; acero: 0.74 y 0.57; caucho sobre concreto: 1.0 y 0.8; hielo: 0.1 y 0.03), fuerza aplicada a lo largo de la rampa en newtons (positiva hacia arriba), componentes (muestra mg seno y mg coseno), pred_se_mueve y prediccion_a (las predicciones, se congelan al soltar). " +
    "result: peso_n, normal_n, peso_a_lo_largo_n y peso_contra_la_rampa_n, fuerza_aplicada_n, friccion_estatica_maxima_n, tension_n en la polea, y después de soltar si se movió, la aceleración, la fricción, la fuerza neta, la predicción y el error. " +
    "Modelo con g igual a 9.81. Plano: N es mg coseno de theta; lo que empuja hacia abajo es mg seno de theta menos F. Si eso no supera mu estático por N, la caja queda quieta y la fricción estática vale exactamente lo que empuja. Si lo supera, resbala, la fricción cinética mu cinético por N se opone al movimiento y a es la fuerza neta entre la masa. Polea: se mueve si m2 g supera mu estático por m1 g; entonces a es (m2 g menos mu cinético m1 g) entre (m1 más m2) y T es m2 por (g menos a). " +
    "Valores: madera, 30 grados, 10 kg, sin fuerza: 49.05 N hacia abajo contra 42.48 N de fricción estática máxima, se mueve con 2.36 m/s². Ángulo crítico: tangente de theta igual a mu estático, 26.57 grados en madera, 36.5 en acero, 45 en caucho, 5.71 en hielo. Fuerza mínima para subirla: mg seno de theta más mu estático mg coseno de theta. Polea con 5 kg en la mesa, 3 kg colgando y madera: 29.43 N contra 24.53 N, a de 1.84 m/s². " +
    "Retos: se-mueve (tres predicciones seguidas en situaciones distintas, al menos una quieta), aceleracion (error menor al cinco por ciento en el plano), angulo-critico (sin fuerza, quieta a menos de un grado del crítico y que resbale al subir un grado), empuja (subirla con no más de 2 N de sobra), polea. " +
    "Confusiones típicas: creer que la normal siempre vale mg (en la rampa vale mg coseno de theta); creer que la fricción estática siempre vale mu estático por N (es la necesaria, hasta ese tope); olvidar que al empujar hacia arriba la fricción cambia de sentido; en la polea, olvidar que se aceleran las dos masas. " +
    "Pide primero que dibuje o nombre las fuerzas del diagrama. No des la aceleración ni el ángulo: guía con preguntas sobre qué fuerzas actúan y cuál gana.",
  whiteboard: {
    title: "Leyes de Newton",
    formulas: [
      "ΣF = m · a",
      "Rampa: N = mg · cos θ",
      "Empuja hacia abajo: mg · sen θ − F",
      "Quieta si no supera f_s ≤ μs · N",
      "Resbala: f_k = μk · N",
      "Polea: a = (m₂g − μk·m₁g)/(m₁ + m₂)",
      "T = m₂ (g − a)",
    ],
    position: [3.3, 1.6, -0.6],
    rotationY: -0.7,
    width: 2.1,
  },
  SceneComponent: NewtonScene,
  ControlsComponent: actionControls(actions),
  vrActions: actions,
  createEngine: createNewtonEngine,
};
