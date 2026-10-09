import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import {
  CAPACITORS,
  createSupplyEngine,
  LOADS,
  PRIMARY_TURNS,
  STAGES,
  type SupplyEngine,
} from "./engine";
import { SupplyScene } from "./SupplyScene";
import { SupplyControls } from "./SupplyControls";

const variablesSchema: VariablesSchema = {
  espiras: {
    type: "number",
    label: `Espiras del secundario (primario: ${PRIMARY_TURNS})`,
    min: 10,
    max: 200,
    step: 1,
    default: 60,
  },
  rectificador: {
    type: "select",
    label: "Rectificador",
    default: "media",
    options: [
      { label: "Media onda (1 diodo)", value: "media" },
      { label: "Puente de diodos (4)", value: "puente" },
    ],
  },
  capacitor: {
    type: "select",
    label: "Capacitor de filtro",
    default: "470",
    options: CAPACITORS.map((c) => ({
      label: c === 0 ? "Sin capacitor" : `${c.toLocaleString("es")} µF`,
      value: String(c),
    })),
  },
  carga: {
    type: "select",
    label: "Corriente que pide el celular",
    default: "250",
    options: LOADS.map((l) => ({ label: `${l} mA`, value: String(l) })),
  },
  osciloscopio: {
    type: "select",
    label: "Osciloscopio en",
    default: "salida",
    options: STAGES.map((s) => ({ label: s.label, value: s.id })),
  },
};

export const fuentePoderExperiment: ExperimentDefinition = {
  slug: "fuente-poder",
  name: "La fuente de poder",
  description:
    "Convierte los 120 V de alterna del enchufe en 5 V de continua para un cargador USB: transformador, rectificador y capacitor, mirando cada etapa en el osciloscopio.",
  variablesSchema,
  cameraView: { position: [0, 2.4, 3.2], target: [0, 1.3, -0.3] },
  whiteboard: {
    title: "La fuente de poder",
    formulas: [
      "Pico del enchufe: 120 V · √2 ≈ 169.7 V",
      "Transformador: V2 = V1 · N2 / N1",
      "Después de un diodo: V_pico − 0.7 V",
      "Después del puente: V_pico − 1.4 V",
      "Rizado ≈ I / (f · C)",
      "f = 60 Hz con media onda, 120 Hz con el puente",
      "USB: entre 4.75 V y 5.25 V",
    ],
    // A la izquierda de la mesa, girado hacia el jugador.
    position: [-3.1, 1.5, -0.4],
    rotationY: 0.6,
    width: 2.1,
  },
  conceptTags: [
    "transformador",
    "diodo",
    "rectificador",
    "puente de diodos",
    "capacitor de filtro",
    "rizado",
  ],
  briefing: {
    what: "El enchufe entrega corriente alterna: 120 voltios que suben y bajan sesenta veces por segundo. Un celular necesita 5 voltios de continua, siempre iguales. Una fuente lo logra en tres pasos: el transformador baja el voltaje, los diodos dejan pasar la corriente en un solo sentido, y un capacitor rellena los huecos entre un pico y el siguiente.",
    how: "Elige las espiras del secundario (el primario tiene mil), el tipo de rectificador, el capacitor y cuánta corriente pide el celular. Con el osciloscopio puedes mirar la onda en cada etapa: en el enchufe, después del transformador, después de los diodos y a la salida.",
    goal: "Primero carga el celular: que la salida promedie cinco voltios y nunca baje de 4.4. Después baja el rizado a menos del cinco por ciento con un solo diodo. Por último logra lo mismo con el puente de diodos y la mitad de capacitor: mira en el osciloscopio por qué alcanza.",
  },
  tutorHints:
    "Variables: espiras del secundario (el primario tiene 1000), rectificador (media onda con un diodo o puente con cuatro), capacitor en microfaradios (0 es sin capacitor), carga (100, 250 o 500 miliamperios que pide el celular) y osciloscopio (en qué etapa se mira la onda). " +
    "result: pico_del_enchufe_V (169.7, porque 120 voltios eficaces por raíz de dos), relacion_transformador, pico_secundario_V, pico_despues_de_los_diodos_V, salida_promedio_V, salida_minima_V, salida_maxima_V, rizado_V, rizado_pct, celular y osciloscopio_en. " +
    "El transformador divide el voltaje por la relación de espiras. Cada diodo conduciendo se lleva 0.7 voltios: la media onda pierde 0.7 y el puente 1.4, pero el puente aprovecha los dos medios ciclos. " +
    "El capacitor se carga en los picos y se descarga con la corriente del celular: el rizado es aproximadamente la corriente sobre la frecuencia de los picos por la capacidad, con 60 picos por segundo en media onda y 120 en el puente. Por eso el puente necesita la mitad de capacitor para el mismo rizado. " +
    "Respuestas: con 250 miliamperios, media onda con unas 34 espiras y 22 mil microfaradios; puente con unas 38 espiras y 10 mil. El celular carga si la salida promedia entre 4.75 y 5.25 voltios y no baja de 4.4. No des la respuesta directa: guía con preguntas.",
  SceneComponent: SupplyScene,
  ControlsComponent: SupplyControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const r = (engine as SupplyEngine).getRuntime();
    const phone =
      r.phone === "carga" ? "El celular está cargando" : r.phone === "sobrevoltaje" ? "¡Sobrevoltaje! Se dañaría" : "El celular no carga";
    const actions: VrAction[] = [
      { id: "salida", label: `Salida: ${r.result.outAvg.toFixed(2)} V · rizado ${r.result.ripplePct.toFixed(1)} %`, info: true },
      { id: "celular", label: phone, info: true },
    ];
    return actions;
  },
  createEngine: createSupplyEngine,
};
