import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createModulationEngine, type ModulationEngine } from "./engine";
import { ModulationScene } from "./ModulationScene";
import { ModulationControls } from "./ModulationControls";

const variablesSchema: VariablesSchema = {
  tipo: {
    type: "select",
    label: "Tipo de modulación",
    default: "am",
    options: [
      { label: "AM (530–1700 kHz)", value: "am" },
      { label: "FM (88–108 MHz)", value: "fm" },
    ],
  },
  dial: {
    type: "number",
    label: "Dial del receptor",
    unit: "%",
    min: 0,
    max: 100,
    step: 0.1,
    default: 20,
  },
  ajuste_fino: {
    type: "number",
    label: "Ajuste fino (±2 canales)",
    min: -1,
    max: 1,
    step: 0.01,
    default: 0,
  },
  indice: {
    type: "number",
    label: "Índice de modulación (m o β)",
    min: 0,
    max: 3,
    step: 0.05,
    default: 0.5,
  },
  tono: {
    type: "number",
    label: "Tono de la moduladora",
    unit: "Hz",
    min: 200,
    max: 3000,
    step: 10,
    default: 440,
  },
};

export const modulacionExperiment: ExperimentDefinition = {
  slug: "modulacion",
  name: "Sintoniza la emisora",
  description:
    "Modula tu propia emisora en AM o FM y sintonízala con el receptor: fuera del canal hay estática, dentro se aclara el audio.",
  variablesSchema,
  conceptTags: [
    "modulación AM",
    "modulación FM",
    "índice de modulación",
    "ancho de banda",
    "bandas laterales",
  ],
  briefing: {
    what: "Para transmitir un sonido por radio se lo monta sobre una onda de frecuencia mucho más alta, la portadora. En AM el sonido cambia la amplitud de la portadora; en FM cambia su frecuencia. Cada emisora ocupa un pedazo del espectro alrededor de su portadora, y el receptor tiene un filtro que deja pasar solo ese pedazo.",
    how: "El dial mueve el filtro del receptor por la banda y el ajuste fino lo afina: cuando una emisora cae dentro de la caja ámbar, el audio se aclara. El índice y el tono controlan tu propia emisora: mira cómo cambian las tres ondas del fondo y el espectro del panel derecho. Enciende la radio para escucharla.",
    goal: "Sintoniza Radio UMG en AM, súbele el índice hasta el cien por ciento sin pasarte, porque por encima la envolvente se corta y el audio se distorsiona, y después búscala en FM. Fíjate en el panel derecho: FM ocupa mucho más ancho de banda que AM, y eso es lo que paga a cambio de rechazar mejor el ruido.",
  },
  tutorHints:
    "Variables: tipo es am o fm; dial va de cero a cien por ciento de la banda (AM de 530 a 1700 kilohercios, FM de 88 a 108 megahercios) y ajuste_fino corre la sintonía hasta dos canales a cada lado; si el estudiante no logra sintonizar, sugiérele acercarse con el dial y terminar con el ajuste fino; indice es m en AM o beta en FM; tono es la frecuencia de la moduladora en hercios. " +
    "result: frecuencia_del_dial, emisora_mas_cercana, calidad_pct (cuánto entra la emisora en el filtro), sintonizada, ancho_de_banda_khz de la emisora propia, canal_del_receptor_khz (10 en AM, 200 en FM), alerta si hay sobremodulación y el estado de los tres retos. " +
    "Las emisoras propias son Radio UMG en 1040 kilohercios (AM) y UMG FM en 95.3 megahercios; las demás son La Voz 610, Onda Sur 1350, Estéreo 89.7 y Ritmo 104.1. Si pregunta dónde está, guíalo con el porcentaje del dial en vez de darle el número exacto. " +
    "AM: la señal es uno más m por la moduladora, por la portadora; el espectro tiene la portadora y dos bandas laterales de altura m sobre dos, y el ancho de banda es dos veces el tono. Con m mayor que uno hay sobremodulación: la envolvente cruza cero, se corta y el audio se distorsiona. " +
    "FM: la fase se desvía beta por la moduladora; el espectro tiene muchas rayas separadas por el tono, con alturas dadas por las funciones de Bessel, y el ancho de banda por la regla de Carson es dos por beta más uno, por el tono. Más beta da más inmunidad al ruido a cambio de más ancho de banda. " +
    "Confusión típica: creer que FM cambia la amplitud, o que el índice de FM tiene límite de cien por ciento como AM.",
  SceneComponent: ModulationScene,
  ControlsComponent: ModulationControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const m = engine as ModulationEngine;
    const on = m.getRuntime().audioOn;
    return [
      {
        id: "radio",
        label: on ? "Apagar radio" : "Encender radio",
        onSelect: () => (on ? m.stopAudio() : void m.startAudio()),
        primary: !on,
      },
    ];
  },
  createEngine: createModulationEngine,
};
