import type {
  ExperimentDefinition,
  ExperimentEngine,
  VariablesSchema,
  VrAction,
} from "@/types/module";
import { actionControls } from "@/components/modules/shared/ActionList";
import {
  LINKS,
  SWITCHES,
  createStpEngine,
  linkName,
  type StpEngine,
} from "./engine";
import { StpScene } from "./StpScene";

const priorityOptions = Array.from({ length: 16 }, (_, k) => ({
  label: String(k * 4096),
  value: String(k * 4096),
}));

const variablesSchema: VariablesSchema = {
  ...Object.fromEntries(
    SWITCHES.map((s) => [
      `prioridad_${s.id}`,
      {
        type: "select" as const,
        label: `Prioridad ${s.name}`,
        default: "32768",
        options: priorityOptions,
        group: "Prioridades (ID de puente)",
      },
    ]),
  ),
  etherchannel: {
    type: "boolean",
    label: "EtherChannel en Núcleo–Distribución",
    default: false,
  },
  ...Object.fromEntries(
    LINKS.map((l) => [
      `pred_enlace${l.n}`,
      {
        type: "boolean" as const,
        label: `Enlace ${l.n} · ${linkName(l)}`,
        default: false,
        group: "Tu predicción: ¿se bloquea?",
      },
    ]),
  ),
};

function actions(engine: ExperimentEngine): VrAction[] {
  const stp = engine as StpEngine;
  const r = stp.getRuntime();
  const root = SWITCHES.find((s) => s.id === r.stp.root)!.name;
  const list: VrAction[] = [
    {
      id: "estado",
      label: r.stpOn
        ? `Raíz: ${root} · bloqueados: ${r.stp.blocked.join(", ") || "ninguno"}${r.down.size ? ` · caídos: ${[...r.down].join(", ")}` : ""}`
        : `STP apagado · raíz si lo activas: ${root}`,
      info: true,
    },
  ];
  if (r.lastBroadcast && r.phase !== "storm") {
    list.push({
      id: "broadcast",
      label: `Último broadcast: llegó a ${r.lastBroadcast.reached} de 4 PC`,
      info: true,
    });
  }
  if (r.lastPrediction) {
    list.push({
      id: "prediccion",
      label: `Tu predicción: ${r.lastPrediction.predicted.join(", ") || "ninguno"} · STP: ${r.lastPrediction.actual.join(", ") || "ninguno"} ${r.lastPrediction.ok ? "(coincide)" : "(no coincide)"}`,
      info: true,
    });
  }
  if (r.predictionSpent) {
    list.push({
      id: "intento",
      label:
        "Ya usaste el primer intento con esta raíz: para que la predicción vuelva a contar, pulsa «Empezar de nuevo».",
      info: true,
    });
  }
  list.push({
    id: "broadcast-btn",
    label:
      r.phase === "converging"
        ? "Esperando a que STP converja…"
        : "Enviar un broadcast",
    onSelect: () => stp.sendBroadcast(),
    disabled: r.phase === "storm" || r.phase === "converging",
    primary: true,
  });
  list.push({
    id: "stp",
    label: r.stpOn ? "Apagar STP" : "Activar STP",
    onSelect: () => stp.toggleStp(),
    disabled: r.phase === "storm",
  });
  if (r.phase === "storm")
    list.push({
      id: "apagar",
      label: "Apagar los switches",
      onSelect: () => stp.powerCycle(),
      primary: true,
    });
  if (r.down.size)
    list.push({
      id: "restaurar",
      label: "Restaurar los enlaces",
      onSelect: () => stp.restoreLinks(),
    });
  if (r.stpOn || r.down.size || r.lastPrediction || r.lastBroadcast) {
    list.push({
      id: "reiniciar",
      label: "Empezar de nuevo",
      onSelect: () => stp.restart(),
    });
  }
  return list;
}

export const stpExperiment: ExperimentDefinition = {
  slug: "stp",
  name: "Rompe el bucle",
  description:
    "Cuatro switches con enlaces redundantes: provoca una tormenta de broadcast, activa STP y predice qué enlaces bloquea, corta enlaces y agrupa dos con EtherChannel.",
  variablesSchema,
  cameraView: { position: [0.2, 2.8, 7.6], target: [0.1, 1.7, 0] },
  conceptTags: [
    "bucle de capa 2",
    "tormenta de broadcast",
    "STP",
    "puente raíz",
    "puerto raíz",
    "puerto designado",
    "EtherChannel",
  ],
  briefing: {
    what: "Para que una red no se caiga si se corta un cable, se ponen enlaces de más. Pero en capa dos eso crea bucles: un broadcast da vueltas para siempre, se multiplica en cada switch y tumba la red. El protocolo STP lo evita: elige un switch raíz y bloquea los puertos justos para que quede un árbol sin bucles, y si un enlace se cae, desbloquea otro.",
    how: "Primero, con STP apagado, envía un broadcast y mira qué pasa; para pararlo, apaga los switches. Después elige las prioridades para que el Núcleo sea la raíz, marca en tu predicción qué enlaces crees que se van a bloquear y activa STP. Los puertos se pintan: verde es raíz, azul designado y naranja bloqueado. Con STP activo, toca un enlace para cortarlo.",
    goal: "Provoca una tormenta, haz que el Núcleo sea la raíz y acierta los enlaces bloqueados la primera vez. Corta un enlace y comprueba que el broadcast sigue llegando a las cuatro PC. Por último, agrupa los dos enlaces entre Núcleo y Distribución con EtherChannel y aprovecha todo el ancho de banda.",
  },
  tutorHints:
    "Variables: prioridad_nucleo, prioridad_distribucion, prioridad_acceso1 y prioridad_acceso2 (de 0 a 61440, en múltiplos de 4096), etherchannel y pred_enlace1 a pred_enlace6 (la predicción de si cada enlace se bloquea). STP activo y los enlaces caídos se manejan con botones y se ven en result. " +
    "Topología: Núcleo MAC terminada en 04, Distribución 03, Acceso 1 01, Acceso 2 02, todos con prioridad 32768 al empezar. Enlaces: 1 y 2 son dos enlaces paralelos Núcleo–Distribución de 1 Gbps; 3 Núcleo–Acceso 1 y 4 Núcleo–Acceso 2 de 1 Gbps; 5 Distribución–Acceso 1 y 6 Distribución–Acceso 2 de 100 Mbps. Costos: 4 para 1 Gbps, 19 para 100 Mbps, 3 para el EtherChannel de 2 Gbps. " +
    "result: estado, puente_raiz, costo_a_la_raiz, enlaces_bloqueados, enlaces_caidos, ultimo_broadcast y prediccion. tutorNotes: stp (activo o apagado), ids_de_puente, roles de cada extremo y etherchannel. " +
    "Algoritmo: la raíz es el menor ID de puente (prioridad y luego MAC); con todo por defecto gana Acceso 1 por la MAC más baja, que es una mala raíz. Cada switch elige como puerto raíz el de menor costo hacia la raíz, y en empate el que da al vecino de menor ID y luego al puerto de menor número. En cada enlace es designado el extremo con menor costo a la raíz, y en empate el de menor ID. Lo demás se bloquea. Con el Núcleo como raíz se bloquean el enlace 2 (lado de Distribución) y el lado de Distribución en los enlaces 5 y 6, porque Acceso 1 y Acceso 2 tienen el mismo costo que Distribución pero menor ID. " +
    "Sin STP los enlaces 1 y 2 ya forman un bucle, así que cualquier broadcast es tormenta. Con EtherChannel los dos enlaces paralelos cuentan como uno de 2 Gbps y ninguno se bloquea. " +
    "Confusión típica: creer que STP bloquea el enlace más lento; bloquea según el costo hacia la raíz y el ID del switch, y un mismo enlace tiene un lado designado y otro bloqueado. Para hacer raíz al Núcleo basta bajar su prioridad, por ejemplo a 4096. No des la lista de enlaces bloqueados: pregunta cuál es el costo de cada switch a la raíz y quién gana en cada enlace.",
  whiteboard: {
    title: "Rompe el bucle",
    formulas: [
      "ID de puente = prioridad + MAC",
      "Raíz = menor ID",
      "Costo: 1 Gbps = 4 · 100 Mbps = 19",
      "Puerto raíz: menor costo a la raíz",
      "Designado: menor costo; empate, menor ID",
      "El resto: bloqueado",
    ],
    terms: [
      { symbol: "Prioridad", meaning: "número que eliges en cada switch: el menor tiene ventaja" },
      { symbol: "MAC", meaning: "dirección única del switch: desempata si la prioridad es igual" },
      { symbol: "Raíz", meaning: "el switch central del árbol: todos buscan el camino más corto hacia él" },
      { symbol: "Costo", meaning: "suma de los costos de los enlaces hasta la raíz: más rápido, más barato" },
      { symbol: "Puerto raíz", meaning: "el puerto de cada switch que va hacia la raíz" },
      { symbol: "Designado", meaning: "el extremo de un enlace que reenvía tráfico" },
      { symbol: "EtherChannel", meaning: "dos enlaces juntos que cuentan como uno solo, más rápido" },
    ],
    position: [-3.4, 1.7, 0.2],
    rotationY: 0.8,
    width: 2.1,
  },
  SceneComponent: StpScene,
  ControlsComponent: actionControls(actions),
  vrActions: (engine) => [
    ...actions(engine),
    {
      id: "ayuda",
      label: (engine as StpEngine).getRuntime().stpOn
        ? "Toca un enlace para cortarlo o volver a conectarlo."
        : "Toca un enlace para marcar si crees que se bloquea.",
      info: true,
    },
  ],
  createEngine: createStpEngine,
};
