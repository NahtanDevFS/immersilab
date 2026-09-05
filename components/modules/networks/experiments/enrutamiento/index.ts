import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createRoutingEngine } from "./engine";
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
  name: "Encontrá el camino",
  description:
    "Sos el router: elegí por dónde sale cada paquete y competí contra Dijkstra. Cambiá la métrica y mirá cómo cambia el mejor camino.",
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
    how: "Vos sos el router. Tocá un router vecino, en la escena o en los botones de abajo, para mandar el paquete por ese enlace. Cada enlace muestra su latencia y su ancho de banda. Arriba elegís la métrica: contar saltos, sumar milisegundos, o el costo por ancho de banda que usa OSPF. Con el otro botón podés cortar un enlace del mejor camino y ver cómo cambia todo.",
    goal: "Llegá al destino con el costo más bajo posible: al llegar se compara tu camino con el que habría elegido Dijkstra. Probá esto: con la métrica de saltos, el camino más corto pasa por un enlace satelital de doscientos diez milisegundos, así que gana en saltos y pierde feo en tiempo real. Ese es exactamente el motivo por el que RIP, que solo contaba saltos, quedó obsoleto frente a OSPF.",
  },
  SceneComponent: RoutingScene,
  ControlsComponent: RoutingControls,
  createEngine: createRoutingEngine,
};
