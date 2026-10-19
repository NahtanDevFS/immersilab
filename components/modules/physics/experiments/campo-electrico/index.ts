import type { ExperimentDefinition, ExperimentEngine, VariablesSchema, VrAction } from "@/types/module";
import { actionControls } from "@/components/modules/shared/ActionList";
import { LEVELS } from "./field";
import { END_TEXT, createFieldEngine, type FieldEngine } from "./engine";
import { FieldScene } from "./FieldScene";

const variablesSchema: VariablesSchema = {
  nivel: { type: "select", label: "Nivel", default: "desvia", options: LEVELS.map((l) => ({ label: l.title, value: l.id })) },
  ...Object.fromEntries(
    [1, 2, 3, 4].map((i) => [
      `q${i}`,
      { type: "number" as const, label: `Carga ${i}`, unit: "µC", min: -5, max: 5, step: 1, default: 0, group: "Cargas (niveles 1 y 3)" },
    ]),
  ),
  signo_particula: {
    type: "select",
    label: "Partícula",
    default: "positiva",
    options: [
      { label: "Positiva (+1 µC)", value: "positiva" },
      { label: "Negativa (−1 µC)", value: "negativa" },
    ],
    group: "Lanzador",
  },
  velocidad: { type: "number", label: "Velocidad", unit: "m/s", min: 1, max: 6, step: 0.1, default: 3, group: "Lanzador" },
  angulo: { type: "number", label: "Ángulo (nivel 3)", unit: "°", min: -45, max: 45, step: 1, default: 0, group: "Lanzador" },
  // El plan pedía 0 a 3000 V; con la partícula negativa hace falta el
  // campo al revés, así que el voltaje también puede ser negativo.
  voltaje: { type: "number", label: "Voltaje de las placas (nivel 2)", unit: "V", min: -3000, max: 3000, step: 50, default: 0 },
  sensor_x: { type: "number", label: "Posición del sensor (nivel 4)", unit: "m", min: -1.2, max: 1.2, step: 0.05, default: -1 },
  lineas: { type: "boolean", label: "Mostrar líneas de campo", default: true },
};

function actions(engine: ExperimentEngine): VrAction[] {
  const field = engine as FieldEngine;
  const r = field.getRuntime();
  if (r.level.id === "campo-nulo") {
    return [
      {
        id: "sensor",
        label: `Campo en el sensor: ${Math.round(r.sensorField).toLocaleString("es")} V/m. Muévelo con su variable hasta que se anule.`,
        info: true,
      },
    ];
  }
  const list: VrAction[] = [];
  if (r.lastEnd) list.push({ id: "resultado", label: `Último tiro: ${END_TEXT[r.lastEnd]}`, info: true });
  list.push({ id: "lanzar", label: r.flying ? "En vuelo…" : "Lanzar", onSelect: () => field.launch(), disabled: r.flying, primary: true });
  if (r.trails.length) list.push({ id: "borrar", label: "Borrar las trayectorias", onSelect: () => field.clearTrails() });
  return list;
}

export const campoElectricoExperiment: ExperimentDefinition = {
  slug: "campo-electrico",
  name: "Guía la carga",
  description:
    "Dentro de una cámara de vacío, coloca cargas y voltajes para guiar una partícula cargada hasta el aro, y encuentra el punto donde el campo se anula.",
  variablesSchema,
  cameraView: { position: [0.2, 4.6, 3.3], target: [0.2, 1.2, -0.6] },
  conceptTags: ["ley de Coulomb", "campo eléctrico", "líneas de campo", "movimiento de una carga en un campo", "placas paralelas"],
  briefing: {
    what: "Las cargas eléctricas se atraen si tienen signo distinto y se repelen si tienen el mismo, con una fuerza que baja con el cuadrado de la distancia. El campo eléctrico dice qué fuerza sentiría una carga en cada punto: las líneas de campo salen de las positivas y entran en las negativas. Estás dentro de una cámara de vacío que cae libremente, así que la gravedad no cuenta: solo empuja la electricidad.",
    how: "Elige el nivel. En los pedestales hay cuatro esferas: dales carga, positiva en rojo o negativa en azul, y lanza la partícula. Puedes cambiar su signo y su velocidad, y en el tercer nivel también el ángulo. Entre las placas del segundo nivel el campo es parejo y lo controla el voltaje. Las trayectorias quedan dibujadas para comparar tiros.",
    goal: "Pasa por el aro en los tres primeros niveles: primero desviando la partícula, después entre las placas con los dos signos de partícula, y por último rodeando el muro con al menos dos cargas. En el cuarto, mueve el sensor hasta el punto donde el campo de las dos cargas se anula y déjalo ahí un segundo.",
  },
  tutorHints:
    "Variables: nivel (desvia, placas, obstaculo, campo-nulo), q1 a q4 en microcoulombs (de menos 5 a 5, en los pedestales de x menos 1.5 y 1.5, z 1.6 y menos 1.6), signo_particula, velocidad (1 a 6 metros por segundo), angulo (solo nivel 3, de menos 45 a 45 grados), voltaje de las placas (de menos 3000 a 3000 voltios, solo nivel 2), sensor_x (nivel 4) y lineas. " +
    "result: nivel, cargas_uc, campo_entre_placas_v_m, estado (en vuelo o cómo terminó el tiro), duracion_del_tiro_s; en el nivel 4, sensor_x_m y campo_en_el_sensor_v_m. " +
    "Modelo en unidades reales: la partícula tiene 1 gramo y más o menos 1 microcoulomb, k es 9 por 10 a la 9. Una carga de 5 microcoulombs a 1 metro hace 0.045 newtons, una aceleración de 45 metros por segundo al cuadrado. Lanzador en x menos 4.6. Nivel 1: el aro está en x 4.2, z 1.8, fuera de la línea recta; alcanza con una carga, por ejemplo una negativa arriba atrae a la positiva. Nivel 2: placas de 2 metros de largo separadas 1 metro; E es V sobre d, y con V positivo la placa de abajo es la positiva y empuja a la partícula positiva hacia arriba (hacia z positivo). La desviación es como un tiro parabólico con fuerza eléctrica; con 1000 voltios E es 1000 voltios por metro y a es 1 metro por segundo al cuadrado. Con la partícula negativa hay que invertir el voltaje. Nivel 3: un muro en x 0 entre z menos 1.1 y 1.1, y el aro detrás en x 4.2; hacen falta al menos dos cargas. Nivel 4: más 4 y más 1 microcoulombs separadas 3 metros; el campo se anula donde k por 4 sobre x al cuadrado iguala k por 1 sobre (3 menos x) al cuadrado, a 2 metros de la de 4, en x igual a 0.5. " +
    "Confusiones típicas: creer que la partícula sigue las líneas de campo (no las sigue: la línea marca la dirección de la fuerza, no la de la velocidad); olvidar que una partícula negativa se desvía al revés; pensar que el campo nulo está en el medio. No des las cargas ni el voltaje: pregunta hacia dónde tiene que empujar la fuerza y qué signo de carga lo logra.",
  whiteboard: {
    title: "Guía la carga",
    formulas: [
      "F = k · q₁ · q₂ / r²",
      "k = 9 × 10⁹ N·m²/C²",
      "E = F / q",
      "Placas: E = V / d",
      "a = q · E / m",
      "Campo nulo: q₁/x² = q₂/(d − x)²",
    ],
    position: [-3.2, 1.7, -2.8],
    rotationY: 0.6,
    width: 2.1,
  },
  SceneComponent: FieldScene,
  ControlsComponent: actionControls(actions),
  vrActions: (engine) => {
    const field = engine as FieldEngine;
    const list = actions(engine);
    if (field.getRuntime().level.id !== "campo-nulo") {
      list.push({ id: "lineas", label: "Las líneas de campo se prenden y apagan con su variable.", info: true });
    }
    return list;
  },
  createEngine: createFieldEngine,
};
