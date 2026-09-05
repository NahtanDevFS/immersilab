import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import {
  CONTROL_POINTS,
  PIECE_OPTIONS,
} from "@/components/modules/calculus/shared/profiles";
import { createLatheEngine } from "./engine";
import { LatheScene } from "./LatheScene";

/** Los cinco radios, de la base a la punta. Se generan en vez de escribirse a
 *  mano para que el esquema y `CONTROL_POINTS` no se puedan desincronizar. */
const radiusFields = Object.fromEntries(
  Array.from({ length: CONTROL_POINTS }, (_, i) => [
    `r${i + 1}`,
    {
      type: "number" as const,
      label: `Radio ${i + 1}${i === 0 ? " (base)" : i === CONTROL_POINTS - 1 ? " (punta)" : ""}`,
      unit: "m",
      min: 0.05,
      max: 1.1,
      step: 0.01,
      default: 0.5,
    },
  ]),
);

const variablesSchema: VariablesSchema = {
  pieza: {
    type: "select",
    label: "Pieza a igualar",
    default: "copa",
    options: PIECE_OPTIONS,
  },
  metodo: {
    type: "select",
    label: "Cómo rebanarla",
    default: "discos",
    options: [
      { label: "Discos", value: "discos" },
      { label: "Capas (cascarones)", value: "capas" },
    ],
  },
  ...radiusFields,
};

export const solidosRevolucionExperiment: ExperimentDefinition = {
  slug: "solidos-revolucion",
  name: "Torneá la pieza",
  description:
    "Moldeá el perfil con los sliders y la curva gira para generar el sólido. El reto: igualar la pieza objetivo.",
  variablesSchema,
  conceptTags: [
    "sólidos de revolución",
    "método de discos",
    "método de capas",
    "integral definida",
    "volumen",
  ],
  briefing: {
    what: "Si tomás una curva y la hacés girar alrededor de un eje, barre un sólido. Su volumen se calcula sumando rebanadas: con el método de discos, cada rebanada es un cilindro finito de radio igual a la curva, y su volumen es pi por radio al cuadrado por el espesor. Sumar todas esas rebanadas, con espesor tendiendo a cero, es la integral de pi por erre al cuadrado.",
    how: "Los cinco deslizadores son el radio de la pieza a cinco alturas distintas, de la base a la punta: entre ellos la curva se suaviza sola, como en un torno de verdad. La línea que sube al costado es esa curva, el perfil; el sólido de la izquierda es lo que genera al girar. Con el otro selector cambiás cómo se la rebana en pantalla: en discos, tajadas horizontales; en capas, tubos concéntricos como los anillos de un tronco.",
    goal: "Igualá la pieza traslúcida de la derecha: te tienen que quedar cerca las dos cosas, el volumen y la silueta. Prestá atención a que el radio va al CUADRADO, así que tocar la parte ancha cambia el volumen muchísimo más que tocar la punta. Y fijate en algo importante: cambiar de discos a capas no cambia el volumen ni un poco, porque son dos formas de cortar la misma pieza.",
  },
  SceneComponent: LatheScene,
  createEngine: createLatheEngine,
};
