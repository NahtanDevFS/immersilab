import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createPendulumEngine, type PendulumEngine } from "./engine";
import { PendulumScene } from "./PendulumScene";
import { PendulumControls } from "./PendulumControls";

const variablesSchema: VariablesSchema = {
  longitud: {
    type: "number",
    label: "Longitud",
    unit: "m",
    min: 0.2,
    max: 3,
    step: 0.01,
    default: 1.2,
  },
  masa: {
    type: "number",
    label: "Masa",
    unit: "kg",
    min: 0.1,
    max: 5,
    step: 0.1,
    default: 1,
  },
  angulo: {
    type: "number",
    label: "Ángulo de suelta",
    unit: "°",
    min: 5,
    max: 60,
    step: 1,
    default: 15,
  },
  amortiguamiento: {
    type: "number",
    label: "Amortiguamiento",
    unit: "1/s",
    min: 0,
    max: 0.5,
    step: 0.01,
    default: 0,
  },
  gravedad: {
    type: "select",
    label: "Gravedad",
    default: "tierra",
    options: [
      { label: "Tierra (9.81 m/s²)", value: "tierra" },
      { label: "Marte (3.71 m/s²)", value: "marte" },
      { label: "Luna (1.62 m/s²)", value: "luna" },
    ],
  },
};

export const penduloExperiment: ExperimentDefinition = {
  slug: "pendulo",
  name: "Sincroniza los relojes",
  description:
    "Ajusta tu péndulo hasta que oscile al mismo ritmo que el de referencia, y descubre de qué depende (y de qué no) su período.",
  variablesSchema,
  conceptTags: [
    "péndulo simple",
    "período",
    "conservación de la energía",
    "oscilaciones",
    "amortiguamiento",
  ],
  briefing: {
    what: "Un péndulo tarda siempre lo mismo en ir y volver: ese tiempo es su período, y por eso sirvió durante siglos para medir el tiempo en los relojes. Mientras oscila, su energía pasa de potencial, arriba, a cinética, abajo, y de vuelta.",
    how: "El péndulo gris es la referencia y el turquesa es el tuyo. Cambia su longitud, su masa o el ángulo desde el que lo sueltas, y presiona soltar: arriba ves el período de cada uno medido en vivo. Las barras de la derecha muestran la energía cinética y la potencial de tu péndulo.",
    goal: "Haz que tu péndulo marque el mismo ritmo que la referencia. Después, sin soltarlo de nuevo, cambia su masa y mira si se desincroniza. Por último, logra que tarde exactamente el doble: vas a necesitar bastante más que el doble de longitud.",
  },
  tutorHints:
    "Variables: longitud en metros (la referencia mide 0.7 m y se suelta a 15 grados), masa en kilogramos, angulo de suelta en grados, amortiguamiento (rozamiento, solo afecta al péndulo del estudiante) y gravedad (tierra, marte o luna, para los dos péndulos). " +
    "result: estado (listo u oscilando), periodo_referencia_medido_s, tu_periodo_medido_s, tu_periodo_teorico_pequenas_oscilaciones_s, relacion_de_periodos, energia_cinetica_pct y energia_potencial_pct (relativas a la energía al soltar) y el estado de los tres retos. Si está en reposo, invita a soltar. " +
    "El período de pequeñas oscilaciones es dos pi por la raíz de ele sobre ge: depende de la longitud y la gravedad, no de la masa ni de la amplitud. La masa se simplifica en la ecuación del movimiento: es el resultado contraintuitivo que el reto dos quiere mostrar. " +
    "Como el período va con la raíz de la longitud, para el doble de período hace falta cuatro veces la longitud; con el doble de longitud el período solo crece raíz de dos, uno coma cuarenta y uno veces. " +
    "La simulación usa la ecuación completa con seno, así que a ángulos grandes el período medido es mayor que la fórmula: a sesenta grados, cerca de siete por ciento más. Si el estudiante soltó a un ángulo distinto de quince grados y no logra sincronizar con 0.7 metros, esa es la razón. " +
    "Cambiar la gravedad afecta a los dos péndulos por igual, así que no rompe la sincronía. Con amortiguamiento la energía total baja y la amplitud se achica, pero el período casi no cambia.",
  SceneComponent: PendulumScene,
  ControlsComponent: PendulumControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const p = engine as PendulumEngine;
    const swinging = p.getRuntime().phase === "oscilando";
    return [
      {
        id: "soltar",
        label: swinging ? "Detener" : "Soltar los péndulos",
        onSelect: () => (swinging ? p.stop() : p.release()),
        primary: !swinging,
      },
    ];
  },
  createEngine: createPendulumEngine,
};
