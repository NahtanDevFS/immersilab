import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import { createCoverageEngine, CHANNELS, DEFAULT_HOUR, MAX_ANTENNAS, type CoverageEngine } from "./engine";
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
  hora: {
    type: "number",
    label: "Hora del día",
    unit: "h",
    min: 0,
    max: 23,
    step: 1,
    default: DEFAULT_HOUR,
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
    "capacidad y demanda",
  ],
  briefing: {
    what: "Una señal de radio se debilita con la distancia y cada vez que atraviesa un edificio. Diseñar una red inalámbrica es decidir dónde poner las antenas, con qué potencia y en qué frecuencia, para que la señal llegue con fuerza a todos lados. Y si dos antenas usan el mismo canal, donde se solapan se interfieren.",
    how: "En el panel eliges la banda, la potencia y, para cada una de las tres antenas, en qué poste va y en qué canal. El piso se pinta con la señal: verde es buena, rojo no alcanza y magenta es interferencia. Las columnas marcan los doce puntos que hay que cubrir, con su señal en dBm. Con la hora del día cambia cuánta gente se conecta en cada lugar, y sobre cada antena una barra muestra cuánto de su capacidad está usando.",
    goal: "Cubre los doce puntos. Después hazlo en la banda de Wi-Fi, 2.4 gigahercios, donde los muros pesan más. Luego cubre todo con tres antenas usando solo dos canales: las dos que comparten canal tienen que quedar lejos una de la otra, como en las redes celulares. El último reto es aguantar la hora pico: cada antena reparte una capacidad fija entre los puntos que atiende, y si se pasa, sus puntos se ponen naranjas. Busca en la curva de consumo la hora de más demanda y diseña para esa hora.",
  },
  tutorHints:
    "Variables: banda (900, 2400 o 5000 megahercios), potencia de transmisión en dBm (10 a 30) y, para cada una de tres antenas, antena1 a antena3 (el poste, de s1 a s7, o ninguna) y canal1 a canal3 (1, 6 u 11). " +
    "result: puntos_cubiertos, con_interferencia, puntos_saturados, hora_pico, demanda_total_mbps, capacidad_por_antena_mbps y carga_por_antena. tutorNotes: banda, potencia_dbm, antenas, sin_senal_suficiente, hora y el estado de los retos. " +
    "Modelo: potencia recibida es la potencia transmitida más cuatro dB de ganancia de antenas, menos la pérdida de trayecto y menos una pérdida por cada edificio atravesado (8 dB en 900 megahercios, 12 en 2.4 gigahercios, 18 en 5 gigahercios). La pérdida de trayecto es la de espacio libre a un metro, que crece con veinte por el logaritmo de la frecuencia, más diez por dos coma cuatro por el logaritmo de la distancia (modelo log-distancia con exponente 2.4). Un punto se cubre con al menos menos setenta y ocho dBm y una relación señal a interferencia de seis dB. " +
    "Lecciones: más frecuencia, más pérdida y peor penetración de muros; 900 megahercios cubre todo con una antena bien ubicada, 2.4 gigahercios necesita al menos dos, y 5 gigahercios no alcanza con tres (por eso el Wi-Fi de 5 gigahercios usa muchos más puntos de acceso). Todas las antenas en el mismo canal nunca funcionan: se interfieren. Con tres antenas y dos canales, las dos que repiten canal deben quedar en extremos opuestos. " +
    "Subir 6 dB de potencia equivale a cuadruplicarla. " +
    "Demanda: la variable hora va de 0 a 23. Cada punto tiene usuarios y un perfil horario (aulas de 8 a 11 y de 14 a 17, cafetería y plaza al mediodía, parqueo y entrada al llegar y al salir, biblioteca pareja). Cada usuario consume 0.45 Mbps. La hora pico es a las 12, con unos 320 Mbps en todo el campus; la curva de consumo es la mini gráfica. " +
    "Cada punto se conecta a la antena que mejor oye y le suma su demanda. Capacidad por antena: 50 Mbps en 900 megahercios, 150 en 2.4 gigahercios y 600 en 5 gigahercios. Si la carga de una antena pasa su capacidad, todos sus puntos quedan saturados (naranja). " +
    "result agrega hora, hora_pico, demanda_total_mbps, capacidad_por_antena_mbps, carga_por_antena, puntos_saturados y reto_hora_pico. " +
    "Lecciones de la demanda: en 900 megahercios tres antenas suman 150 Mbps y nunca aguantan los 320 de la hora pico aunque cubran todo; en 2.4 gigahercios dos antenas suman 300 y tampoco alcanzan; hacen falta tres antenas bien repartidas, en canales distintos y con potencia alta, para que ninguna cargue con demasiados puntos. Cubrir no es lo mismo que aguantar la carga. " +
    "No des la combinación exacta de postes: guía preguntando qué puntos fallan y por qué (distancia, muros, interferencia o una antena saturada).",
  SceneComponent: CoverageScene,
  ControlsComponent: CoverageControls,
  // En el visor no hay botones propios: la leyenda del piso, la carga de
  // cada antena y el aviso de interferencia, como en CoverageControls.
  vrActions: (engine) => {
    const { summary, load, antennas, band, hour } = (engine as CoverageEngine).getRuntime();
    const actions: VrAction[] = [
      {
        id: "leyenda",
        label: "Piso: verde = buena señal · rojo = no alcanza · magenta = interferencia · naranja = antena saturada",
        info: true,
      },
      {
        id: "carga",
        label:
          antennas.length === 0
            ? `${hour}:00 · demanda ${Math.round(load.totalMbps)} Mbps · sin antenas`
            : `${hour}:00 · ` +
              antennas
                .map((_, i) => `A${i + 1}: ${Math.round(load.perAntenna[i])} de ${band.capacityMbps} Mbps`)
                .join(" · "),
        info: true,
      },
    ];
    if (summary.interfered > 0) {
      actions.push({
        id: "interferencia",
        label: `${summary.interfered} punto${summary.interfered > 1 ? "s" : ""} con interferencia: dos antenas en el mismo canal se pisan donde se solapan.`,
        info: true,
      });
    }
    return actions;
  },
  createEngine: createCoverageEngine,
};
