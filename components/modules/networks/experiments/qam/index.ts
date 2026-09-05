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
  name: "Recuperá el mensaje",
  description:
    "Elegí la modulación y peleá contra el ruido: más bits por símbolo es más velocidad, pero menos margen de error.",
  variablesSchema,
  conceptTags: [
    "modulación digital",
    "constelación I/Q",
    "relación señal a ruido",
    "tasa de error de bit",
  ],
  briefing: {
    what: "Para mandar datos por el aire, cada grupo de bits se convierte en un punto de un plano: la constelación. El transmisor manda ese punto, el ruido del camino lo corre de lugar, y el receptor se queda con el punto de la constelación que le quedó más cerca. Si el ruido lo corrió más allá de la mitad de camino hacia el vecino, el receptor se equivoca y los bits salen mal.",
    how: "Con el primer selector elegís cuántos bits viajan en cada símbolo: uno en BPSK, dos en QPSK, cuatro en dieciséis QAM, seis en sesenta y cuatro QAM. Con el deslizador movés la relación señal a ruido, o sea qué tan limpio está el canal. Tocá transmitir y mirá caer los símbolos: los verdes llegaron bien, los rojos los decodificó mal el receptor. Abajo aparece el mensaje tal como llegó.",
    goal: "Conseguí la mayor velocidad posible con el mensaje intacto, sin un solo bit errado. Fijate en lo importante: todas las constelaciones se transmiten con la misma potencia, así que meter más puntos los amontona y los deja más cerca unos de otros. Por eso sesenta y cuatro QAM es cuatro veces más rápido que QPSK pero necesita un canal mucho más limpio para no romperse. Esa es la decisión que toma un módem real cada segundo.",
  },
  SceneComponent: QamScene,
  ControlsComponent: QamControls,
  createEngine: createQamEngine,
};
