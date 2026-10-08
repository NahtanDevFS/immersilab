import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createSpectrumEngine, type SpectrumEngine } from "./engine";
import { SpectrumScene } from "./SpectrumScene";
import { SpectrumControls } from "./SpectrumControls";

const variablesSchema: VariablesSchema = {
  escala: {
    type: "select",
    label: "Escala de frecuencia",
    default: "logaritmica",
    options: [
      { label: "Logarítmica (como el oído)", value: "logaritmica" },
      { label: "Lineal (como un analizador)", value: "lineal" },
    ],
  },
  frecuencia_max: {
    type: "number",
    label: "Frecuencia máxima",
    unit: "Hz",
    min: 2000,
    max: 8000,
    step: 500,
    default: 4000,
  },
  sensibilidad: {
    type: "number",
    label: "Sensibilidad",
    unit: "dB",
    min: -20,
    max: 30,
    step: 1,
    default: 0,
  },
  marcar_banda: {
    type: "boolean",
    label: "Marcar banda telefónica",
    default: true,
  },
};

export const espectroExperiment: ExperimentDefinition = {
  slug: "espectro",
  name: "Tu voz en el espectro",
  description:
    "Habla, silba o canta y mira tu voz convertida en frecuencias, en una cascada 3D que avanza con el tiempo.",
  variablesSchema,
  conceptTags: [
    "dominio de la frecuencia",
    "transformada de Fourier",
    "espectro de la voz",
    "formantes",
    "ancho de banda telefónico",
  ],
  briefing: {
    what: "Cualquier sonido, incluida tu voz, es una suma de ondas de distintas frecuencias. La transformada de Fourier separa esas frecuencias y muestra cuánta energía hay en cada una: eso es el espectro. Las comunicaciones trabajan casi siempre en este dominio, porque lo que se reparte entre usuarios es justamente el espectro.",
    how: "Enciende el micrófono y emite sonidos. De izquierda a derecha están las frecuencias, de graves a agudas; la altura y el color son la energía; y hacia el fondo se ve lo que sonó en los últimos segundos. El marcador blanco sigue la frecuencia más fuerte. Si tu micrófono es débil, sube la sensibilidad.",
    goal: "Completa los tres retos: silba hasta dejar un solo pico, cambia de la vocal u a la vocal i y mira cómo aparece energía aguda, y habla tres segundos para medir cuánto de tu voz cabe en la banda telefónica de 300 a 3400 hercios. Por eso la voz se entiende por teléfono aunque se le corte todo lo demás.",
  },
  tutorHints:
    "Variables: escala es logaritmica o lineal (solo cambia el dibujo), frecuencia_max es el borde derecho del eje en hercios, sensibilidad sube o baja la altura del dibujo en decibeles y marcar_banda muestra la banda telefónica. " +
    "result: si el micrófono está apagado solo trae microfono con su estado; encendido trae frecuencia_pico_hz, sonando, tono_puro, voz_en_banda_telefonica_pct (después de hablar un poco) y el estado de los tres retos: reto_silbido, reto_vocales (con la etapa u o i) y reto_banda_telefonica. Si el micrófono está apagado, invita a encenderlo. " +
    "Un silbido es casi una senoidal pura: un solo pico, típicamente entre mil y tres mil hercios. La voz tiene una frecuencia fundamental (unos cien a doscientos cincuenta hercios) y sus armónicos, que son múltiplos enteros de ella. " +
    "Los formantes son las resonancias de la boca y la garganta: la u tiene el segundo formante cerca de ochocientos hercios y la i cerca de dos mil trescientos; por eso al decir i aparece energía aguda. " +
    "La telefonía clásica transmite solo de trescientos a tres mil cuatrocientos hercios: ahí está casi toda la inteligibilidad de la voz, y un canal de cuatro kilohercios muestreado a ocho mil muestras por segundo, por el teorema de Nyquist, da los sesenta y cuatro kilobits por segundo de una llamada digital. " +
    "Si el estudiante no ve nada, sugiere subir la sensibilidad o acercarse al micrófono.",
  SceneComponent: SpectrumScene,
  ControlsComponent: SpectrumControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const s = engine as SpectrumEngine;
    const listening = s.getRuntime().mic === "escuchando";
    return [
      {
        id: "microfono",
        label: listening ? "Apagar micrófono" : "Encender micrófono",
        onSelect: () => (listening ? s.stopMic() : void s.startMic()),
        primary: !listening,
      },
    ];
  },
  createEngine: createSpectrumEngine,
};
