import type { ExperimentDefinition, VariableDefinition, VariablesSchema } from "@/types/module";
import { createWavesEngine, TARGETS } from "./engine";
import { WavesScene } from "./WavesScene";
import { WavesControls } from "./WavesControls";

/** Los tres osciladores tienen los mismos controles; se generan para que no se desincronicen. */
function oscillator(i: number, defaults: { a: number; f: number }): VariablesSchema {
  const amplitude: VariableDefinition = {
    type: "number",
    label: `Amplitud ${i}`,
    min: 0,
    max: 1,
    step: 0.01,
    default: defaults.a,
  };
  const frequency: VariableDefinition = {
    type: "number",
    label: `Frecuencia ${i}`,
    unit: "Hz",
    min: 0,
    max: 8,
    // Paso fino a propósito: con dos frecuencias casi iguales (4 y 4.05) se
    // oye el batido en el audio.
    step: 0.05,
    default: defaults.f,
  };
  const phase: VariableDefinition = {
    type: "number",
    label: `Fase ${i}`,
    unit: "°",
    min: 0,
    max: 360,
    step: 5,
    default: 0,
  };
  return { [`a${i}`]: amplitude, [`f${i}`]: frequency, [`p${i}`]: phase };
}

const variablesSchema: VariablesSchema = {
  objetivo: {
    type: "select",
    label: "Onda objetivo",
    default: "simple",
    options: TARGETS.map((t) => ({ label: t.label, value: t.id })),
  },
  ...oscillator(1, { a: 0.5, f: 1 }),
  ...oscillator(2, { a: 0, f: 2 }),
  ...oscillator(3, { a: 0, f: 3 }),
};

export const ondasExperiment: ExperimentDefinition = {
  slug: "ondas",
  name: "El sintonizador",
  description:
    "Suma tres ondas senoidales hasta reproducir una onda objetivo: batidos, ondas cuadradas y de sierra salen de sumar senoidales.",
  variablesSchema,
  conceptTags: [
    "superposición",
    "interferencia",
    "batido",
    "series de Fourier",
    "armónicos",
  ],
  briefing: {
    what: "Cuando dos ondas pasan por el mismo lugar, se suman punto a punto: eso es la superposición. Donde coinciden crestas, se refuerzan; donde una cresta cae sobre un valle, se cancelan. Y al revés también vale: cualquier señal periódica, por complicada que sea, se puede armar sumando ondas senoidales. Esa idea, la de Fourier, es la base de todas las telecomunicaciones.",
    how: "Arriba ves tus tres osciladores por separado y abajo su suma, la línea brillante, encima de la onda objetivo, la banda blanca. Cada oscilador tiene amplitud, frecuencia y fase. Elige un objetivo y mueve los controles hasta que la línea quede dentro de la banda. Con el botón de sonido escuchas la suma.",
    goal: "Lleva el medidor de ajuste por encima del noventa y cinco por ciento en los cuatro objetivos. El batido sale de dos frecuencias cercanas; la cuadrada y la de sierra, de una frecuencia base y sus múltiplos, cada uno más chico. Prueba también, con el sonido encendido, dos frecuencias casi iguales: vas a oír cómo el volumen sube y baja.",
  },
  tutorHints:
    "Variables: objetivo (simple, batido, cuadrada, sierra) y tres osciladores con a1 a a3 (amplitud de cero a uno), f1 a f3 (frecuencia en hercios de la ventana, de cero a ocho; el audio la multiplica por ciento diez) y p1 a p3 (fase en grados). " +
    "result: objetivo, ajuste_pct (uno menos el error cuadrático medio relativo al objetivo), logrado y objetivos_logrados. La meta es noventa y cinco por ciento sostenido un segundo. " +
    "Los objetivos son: una sola onda (amplitud cero coma ocho, frecuencia dos); batido (dos ondas de amplitud cero coma cinco en cuatro y cinco hercios, que producen una envolvente de un hercio, la diferencia); cuadrada (frecuencias uno, tres y cinco con amplitudes cero coma nueve, cero coma tres y cero coma dieciocho, que es la serie de Fourier de la cuadrada con amplitudes uno sobre ene); sierra (frecuencias uno, dos y tres con amplitudes cero coma nueve, cero coma cuarenta y cinco y cero coma tres, y el segundo armónico con fase de ciento ochenta grados, que equivale a un signo menos). " +
    "No dictes los valores de una vez: guía primero con la idea (cuántas componentes, qué relación tienen las frecuencias, cómo decrecen las amplitudes) y da números solo si el estudiante está trabado. " +
    "La fase importa: una componente en contrafase resta en vez de sumar. La frecuencia del batido es la diferencia entre las dos frecuencias.",
  SceneComponent: WavesScene,
  ControlsComponent: WavesControls,
  createEngine: createWavesEngine,
};
