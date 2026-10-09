import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import { createRoutingEngine, findLink, NODES, type RoutingEngine } from "./engine";
import { RoutingScene } from "./RoutingScene";
import { RoutingControls } from "./RoutingControls";

const variablesSchema: VariablesSchema = {
  metrica: {
    type: "select",
    label: "Métrica del protocolo",
    default: "latencia",
    options: [
      { label: "Saltos (como RIP)", value: "saltos" },
      { label: "Latencia (ms)", value: "latencia" },
      { label: "Ancho de banda (como OSPF)", value: "ospf" },
    ],
  },
};

export const enrutamientoExperiment: ExperimentDefinition = {
  slug: "enrutamiento",
  name: "Encuentra el camino",
  description:
    "Eres el router: elige por dónde sale cada paquete y compite contra Dijkstra. Cambia la métrica y mira cómo cambia el mejor camino.",
  variablesSchema,
  conceptTags: [
    "enrutamiento",
    "métricas de enrutamiento",
    "algoritmo de Dijkstra",
    "convergencia",
    "RIP vs OSPF",
  ],
  briefing: {
    what: "Un paquete que va de una punta a otra de una red pasa por varios routers, y en cada uno hay que decidir por qué enlace sale. Esa decisión la toma un protocolo de enrutamiento, y para decidir necesita una métrica: una forma de medir qué tan caro es cada enlace. La métrica que se elija cambia por completo cuál es el mejor camino.",
    how: "Tú eres el router. Toca un router vecino, en la escena o en los botones de abajo, para mandar el paquete por ese enlace. Cada enlace muestra su latencia y su ancho de banda. Arriba eliges la métrica: contar saltos, sumar milisegundos, o el costo por ancho de banda que usa OSPF. Con el otro botón puedes cortar un enlace del mejor camino y ver cómo cambia todo.",
    goal: "Llega al destino con el costo más bajo posible: al llegar se compara tu camino con el que habría elegido Dijkstra. Prueba esto: con la métrica de saltos, el camino más corto pasa por un enlace satelital de doscientos diez milisegundos, así que gana en saltos y pierde mucho en tiempo real. Ese es exactamente el motivo por el que RIP, que solo contaba saltos, quedó obsoleto frente a OSPF.",
  },
  tutorHints:
    "Variables: metrica es saltos (como RIP, cuenta routers), latencia (suma milisegundos) u ospf (costo inversamente proporcional al ancho de banda). Los nodos van de A, el origen, a I, el destino. " +
    "result solo aparece cuando el paquete llega: tu_camino y tu_costo, mejor_camino y mejor_costo (lo que habría elegido Dijkstra), paquetes_entregados y por_el_camino_optimo; estado aparece si igualó el óptimo. " +
    "Dijkstra elige en cada paso el nodo pendiente con menor costo acumulado. RIP solo cuenta saltos y no ve que un enlace satelital es lento; OSPF pondera el ancho de banda. " +
    "En este mapa, con la métrica de saltos el camino más corto pasa por un enlace satelital de unos doscientos diez milisegundos: gana en saltos y pierde en latencia. " +
    "Cortar un enlace obliga a recalcular las rutas: eso es la convergencia. No le reveles el camino óptimo completo antes de que lo intente; guíalo salto por salto.",
  SceneComponent: RoutingScene,
  ControlsComponent: RoutingControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const routing = engine as RoutingEngine;
    const r = routing.getRuntime();
    const label = (id: string) => NODES.find((n) => n.id === id)?.label ?? id;
    const head = r.path[r.path.length - 1];
    const actions: VrAction[] = [
      { id: "camino", label: `${r.path.map(label).join(" → ")} · costo ${r.cost}`, info: true },
    ];
    if (!r.reachable) {
      actions.push({ id: "aislado", label: "El destino quedó aislado: repara algún enlace.", info: true });
    }
    if (r.arrived) {
      actions.push({ id: "otro", label: "Otro paquete", onSelect: () => routing.restart(), primary: true });
    } else {
      r.options.forEach((option) => {
        const found = findLink(head, option);
        actions.push({
          id: `ir-${option}`,
          label: `Ir a ${label(option)}${found ? ` · ${found.link.latency} ms` : ""}`,
          onSelect: () => routing.hop(option),
          primary: true,
        });
      });
      if (r.path.length > 1) {
        actions.push({ id: "reiniciar", label: "Reiniciar paquete", onSelect: () => routing.restart() });
      }
    }
    actions.push({
      id: "cortar-uno",
      label: "Para cortar o reparar uno: míralo en la escena y presiona A (o toca la pantalla).",
      info: true,
    });
    actions.push({
      id: "cortar",
      label: "Cortar un enlace al azar",
      onSelect: () => routing.cutRandom(),
      disabled: !r.reachable,
    });
    if (r.downLinks.length > 0) {
      actions.push({ id: "reparar", label: `Reparar enlaces (${r.downLinks.length})`, onSelect: () => routing.repairAll() });
    }
    return actions;
  },
  createEngine: createRoutingEngine,
};
