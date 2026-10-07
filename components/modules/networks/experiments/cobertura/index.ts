import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createCoverageEngine, CHANNELS, MAX_ANTENNAS } from "./engine";
import { BANDS, SITES } from "./propagation";
import { CoverageScene } from "./CoverageScene";
import { CoverageControls } from "./CoverageControls";

const siteOptions = [
  { label: "Sin antena", value: "ninguna" },
  ...SITES.map((s) => ({ label: s.name, value: s.id })),
];
const channelOptions = CHANNELS.map((c) => ({ label: `Canal ${c}`, value: c }));

/** Cada antena tiene sitio y canal; se generan para que no se desincronicen. */
const antennaFields: VariablesSchema = Object.fromEntries(
  Array.from({ length: MAX_ANTENNAS }, (_, k) => {
    const i = k + 1;
    return [
      [`antena${i}`, {
        type: "select" as const,
        label: `Antena ${i}`,
        default: i === 1 ? "s2" : "ninguna",
        options: siteOptions,
      }],
      [`canal${i}`, {
        type: "select" as const,
        label: `Canal de la antena ${i}`,
        default: CHANNELS[k],
        options: channelOptions,
      }],
    ];
  }).flat(),
);

const variablesSchema: VariablesSchema = {
  banda: {
    type: "select",
    label: "Banda",
    default: "2400",
    options: BANDS.map((b) => ({ label: b.label, value: b.id })),
  },
  potencia: {
    type: "number",
    label: "Potencia de transmisión",
    unit: "dBm",
    min: 10,
    max: 30,
    step: 1,
    default: 20,
  },
  ...antennaFields,
};

export const coberturaExperiment: ExperimentDefinition = {
  slug: "cobertura",
  name: "Cubre el campus",
  description:
    "Coloca hasta tres antenas en el campus, elige banda, potencia y canales, y mira el mapa de cobertura cambiar en vivo.",
  variablesSchema,
  conceptTags: [
    "pérdida de trayecto",
    "presupuesto de enlace",
    "atenuación por obstáculos",
    "interferencia cocanal",
    "reutilización de frecuencias",
  ],
  briefing: {
    what: "Una señal de radio se debilita con la distancia y cada vez que atraviesa un edificio. Diseñar una red inalámbrica es decidir dónde poner las antenas, con qué potencia y en qué frecuencia, para que la señal llegue con fuerza a todos lados. Y si dos antenas usan el mismo canal, donde se solapan se interfieren.",
    how: "En el panel eliges la banda, la potencia y, para cada una de las tres antenas, en qué poste va y en qué canal. El piso se pinta con la señal: verde es buena, rojo no alcanza y magenta es interferencia. Las columnas marcan los doce puntos que hay que cubrir, con su señal en dBm.",
    goal: "Cubre los doce puntos. Después hazlo en la banda de Wi-Fi, 2.4 gigahercios, donde los muros pesan más. Por último, cubre todo con tres antenas usando solo dos canales: las dos que comparten canal tienen que quedar lejos una de la otra. Así funcionan las redes celulares, reutilizando las mismas frecuencias en celdas lejanas.",
  },
  tutorHints:
    "Variables: banda (900, 2400 o 5000 megahercios), potencia de transmisión en dBm (10 a 30) y, para cada una de tres antenas, antena1 a antena3 (el poste, de s1 a s7, o ninguna) y canal1 a canal3 (1, 6 u 11). " +
    "result: banda, potencia_dbm, antenas, puntos_cubiertos, sin_senal_suficiente, con_interferencia y el estado de los tres retos. " +
    "Modelo: potencia recibida es la potencia transmitida más cuatro dB de ganancia de antenas, menos la pérdida de trayecto y menos una pérdida por cada edificio atravesado (8 dB en 900 megahercios, 12 en 2.4 gigahercios, 18 en 5 gigahercios). La pérdida de trayecto es la de espacio libre a un metro, que crece con veinte por el logaritmo de la frecuencia, más diez por dos coma cuatro por el logaritmo de la distancia (modelo log-distancia con exponente 2.4). Un punto se cubre con al menos menos setenta y ocho dBm y una relación señal a interferencia de seis dB. " +
    "Lecciones: más frecuencia, más pérdida y peor penetración de muros; 900 megahercios cubre todo con una antena bien ubicada, 2.4 gigahercios necesita al menos dos, y 5 gigahercios no alcanza con tres (por eso el Wi-Fi de 5 gigahercios usa muchos más puntos de acceso). Todas las antenas en el mismo canal nunca funcionan: se interfieren. Con tres antenas y dos canales, las dos que repiten canal deben quedar en extremos opuestos. " +
    "Subir 6 dB de potencia equivale a cuadruplicarla. No des la combinación exacta de postes: guía preguntando qué puntos fallan y por qué (distancia, muros o interferencia).",
  SceneComponent: CoverageScene,
  ControlsComponent: CoverageControls,
  createEngine: createCoverageEngine,
};
