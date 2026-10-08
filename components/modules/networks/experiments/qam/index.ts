import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createQamEngine, MODULATIONS } from "./engine";
import { QamScene } from "./QamScene";
import { QamControls } from "./QamControls";

const variablesSchema: VariablesSchema = {
  modulacion: {
    type: "select",
    label: "Modulación",
    default: "qpsk",
    options: MODULATIONS.map((m) => ({ label: m.label, value: m.id })),
  },
  snr: {
    type: "number",
    label: "Señal / ruido",
    unit: "dB",
    min: 0,
    max: 30,
    step: 0.5,
    default: 18,
  },
};

export const qamExperiment: ExperimentDefinition = {
  slug: "qam",
  name: "Recupera el mensaje",
  description:
    "Elige la modulación y lucha contra el ruido: más bits por símbolo es más velocidad, pero menos margen de error.",
  variablesSchema,
  conceptTags: [
    "modulación digital",
    "constelación I/Q",
    "relación señal a ruido",
    "tasa de error de bit",
  ],
  briefing: {
    what: "Para mandar datos por el aire, cada grupo de bits se convierte en un punto de un plano: la constelación. El transmisor manda ese punto, el ruido del camino lo corre de lugar, y el receptor se queda con el punto de la constelación que le quedó más cerca. Si el ruido lo corrió más allá de la mitad de camino hacia el vecino, el receptor se equivoca y los bits salen mal.",
    how: "Con el primer selector eliges cuántos bits viajan en cada símbolo: uno en BPSK, dos en QPSK, cuatro en dieciséis QAM, seis en sesenta y cuatro QAM. Con el deslizador mueves la relación señal a ruido, o sea qué tan limpio está el canal. Escribe tu propio mensaje junto al botón, o deja HOLA UMG, toca transmitir y mira caer los símbolos: los verdes llegaron bien, los rojos los decodificó mal el receptor. Abajo aparece el mensaje tal como llegó.",
    goal: "Consigue la mayor velocidad posible con el mensaje intacto, sin un solo bit errado. Fíjate en lo importante: todas las constelaciones se transmiten con la misma potencia, así que meter más puntos los amontona y los deja más cerca unos de otros. Por eso sesenta y cuatro QAM es cuatro veces más rápido que QPSK pero necesita un canal mucho más limpio para no romperse. Esa es la decisión que toma un módem real cada segundo.",
  },
  tutorHints:
    "Variables: modulacion es bpsk (1 bit por símbolo), qpsk (2), qam16 (4) o qam64 (6); snr es la relación señal a ruido en decibeles, de cero a treinta. " +
    "Se transmite el texto que escribió el estudiante (HOLA UMG si no escribió nada; para los retos cuenta con ocho caracteres o más), cada letra en ocho bits, a treinta símbolos por segundo, así que la velocidad es treinta por los bits por símbolo. " +
    "result solo aparece al terminar la transmisión: mensaje_enviado y mensaje_recibido, bits_por_simbolo, bits_errados, ber_pct (tasa de error de bit), velocidad_bps y mejor_velocidad_sin_errores_bps. " +
    "Todas las constelaciones usan la misma potencia: más puntos quedan más juntos y el ruido los confunde antes. Por eso cada salto de modulación pide bastante más relación señal a ruido para no tener errores. " +
    "El reto es la mayor velocidad con cero bits errados: sugiere subir la modulación solo cuando el canal está limpio y bajarla cuando aparecen errores, que es lo que hace un módem real.",
  SceneComponent: QamScene,
  ControlsComponent: QamControls,
  createEngine: createQamEngine,
};
