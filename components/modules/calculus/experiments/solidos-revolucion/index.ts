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
  name: "Tornea la pieza",
  description:
    "Moldea el perfil con los sliders y la curva gira para generar el sólido. El reto: igualar la pieza objetivo.",
  variablesSchema,
  conceptTags: [
    "sólidos de revolución",
    "método de discos",
    "método de capas",
    "integral definida",
    "volumen",
  ],
  briefing: {
    what: "Si tomas una curva y la haces girar alrededor de un eje, barre un sólido. Su volumen se calcula sumando rebanadas: con el método de discos, cada rebanada es un cilindro finito de radio igual a la curva, y su volumen es pi por radio al cuadrado por el espesor. Sumar todas esas rebanadas, con espesor tendiendo a cero, es la integral de pi por erre al cuadrado.",
    how: "Los cinco deslizadores son el radio de la pieza a cinco alturas distintas, de la base a la punta: entre ellos la curva se suaviza sola, como en un torno de verdad. La línea que sube al costado es esa curva, el perfil; el sólido de la izquierda es lo que genera al girar. Con el otro selector cambias cómo se rebana en pantalla: en discos, tajadas horizontales; en capas, tubos concéntricos como los anillos de un tronco.",
    goal: "Iguala la pieza traslúcida de la derecha: tienen que quedarte cerca las dos cosas, el volumen y la silueta. Presta atención a que el radio va al CUADRADO, así que tocar la parte ancha cambia el volumen muchísimo más que tocar la punta. Y fíjate en algo importante: cambiar de discos a capas no cambia el volumen ni un poco, porque son dos formas de cortar la misma pieza.",
  },
  tutorHints:
    "Variables: r1 a r5 son los radios del perfil en metros, de la base (r1) a la punta (r5); pieza es la pieza objetivo (copa, pesa de gimnasio, trompo o jarrón); metodo es discos o capas y solo cambia cómo se dibujan las rebanadas. " +
    "result: volumen_m3 y volumen_objetivo_m3, error_volumen_pct, diferencia_de_silueta_pct, puntaje y mejor_puntaje. La pieza se logra con error de volumen menor a dos por ciento y diferencia de silueta menor a seis por ciento; ahí aparece estado. " +
    "Método de discos: el volumen es pi por la integral del radio al cuadrado a lo largo del eje. Método de capas: la integral de dos pi por radio por altura por el espesor. Dan exactamente el mismo volumen. " +
    "Como el radio va al cuadrado, los radios grandes pesan mucho más en el volumen que los chicos: para corregir el volumen conviene tocar primero la parte ancha. " +
    "Para guiar, compara cada radio con la silueta objetivo y di cuál está más lejos, sin dar los cinco valores de una vez.",
  SceneComponent: LatheScene,
  createEngine: createLatheEngine,
};
