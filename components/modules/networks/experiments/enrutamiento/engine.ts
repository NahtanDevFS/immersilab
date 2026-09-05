import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export interface RouterNode {
  id: string;
  label: string;
  /** Posición en la escena (x, z); la altura la pone la escena. */
  position: [number, number];
}

export interface Link {
  from: string;
  to: string;
  /** Latencia del enlace, en ms. Es la métrica que suma el costo. */
  latency: number;
  /** Ancho de banda, en Mbps. Es la métrica de la que sale el costo OSPF. */
  bandwidth: number;
  /** Un enlace caído sigue dibujado, pero no se puede usar. */
  down?: boolean;
}

/**
 * Topología fija: nueve routers entre "Origen" (A) y "Destino" (I).
 *
 * Está armada a mano, no generada al azar, para que tenga las trampas que el
 * experimento quiere enseñar:
 *
 *  - El camino con MENOS SALTOS (A-B-E-I) NO es el más rápido: pasa por un
 *    enlace satelital de 210 ms. Es el error clásico de usar "número de
 *    saltos" como métrica, que es justo lo que hace RIP.
 *  - Hay un camino más largo en saltos pero mucho más rápido por fibra.
 *  - El enlace C-F es el cuello de botella: al caerse, obliga a recalcular,
 *    que es lo que hace un protocolo de enrutamiento cuando converge.
 */
export const NODES: RouterNode[] = [
  { id: "A", label: "Origen", position: [-7, 0] },
  { id: "B", label: "B", position: [-3.5, 3] },
  { id: "C", label: "C", position: [-3.5, -3] },
  { id: "D", label: "D", position: [0, 4.5] },
  { id: "E", label: "E", position: [0, 0.5] },
  { id: "F", label: "F", position: [0, -4] },
  { id: "G", label: "G", position: [3.5, 2.5] },
  { id: "H", label: "H", position: [3.5, -2.5] },
  { id: "I", label: "Destino", position: [7, 0] },
];

export const LINKS: Link[] = [
  { from: "A", to: "B", latency: 12, bandwidth: 100 },
  { from: "A", to: "C", latency: 8, bandwidth: 1000 },
  { from: "B", to: "D", latency: 15, bandwidth: 100 },
  { from: "B", to: "E", latency: 210, bandwidth: 10 }, // enlace satelital
  { from: "C", to: "E", latency: 10, bandwidth: 1000 },
  { from: "C", to: "F", latency: 6, bandwidth: 1000 },
  { from: "D", to: "G", latency: 14, bandwidth: 100 },
  { from: "E", to: "G", latency: 9, bandwidth: 1000 },
  { from: "E", to: "H", latency: 25, bandwidth: 100 },
  { from: "F", to: "H", latency: 7, bandwidth: 1000 },
  { from: "G", to: "I", latency: 11, bandwidth: 1000 },
  { from: "H", to: "I", latency: 9, bandwidth: 1000 },
  { from: "B", to: "I", latency: 240, bandwidth: 10 }, // el "atajo" tramposo
];

export const START = "A";
export const GOAL = "I";

export type RoutingMetric = "saltos" | "latencia" | "ospf";

export interface RoutingRuntime {
  /** Camino que va armando el jugador, empezando en el origen. */
  path: string[];
  /** Vecinos alcanzables desde donde está parado el paquete. */
  options: string[];
  /** Costo acumulado del camino del jugador, en la métrica elegida. */
  cost: number;
  /** El mejor camino posible según la métrica elegida (Dijkstra). */
  bestPath: string[];
  bestCost: number;
  /** Enlaces caídos, por índice en LINKS. */
  downLinks: number[];
  arrived: boolean;
  /** Cuántos paquetes se entregaron y cuántos por el camino óptimo. */
  delivered: number;
  optimal: number;
  /** El paquete se mueve entre nodos: 0 → recién salió, 1 → llegó. */
  hopProgress: number;
}

export interface RoutingEngine extends ExperimentEngine {
  /** Manda el paquete al vecino elegido. */
  hop: (nodeId: string) => void;
  /** Devuelve el paquete al origen sin tocar el marcador. */
  restart: () => void;
  /** Tira abajo un enlace al azar (o lo levanta) para forzar a reconverger. */
  toggleFailure: () => void;
  getRuntime: () => RoutingRuntime;
}

/**
 * Costo de un enlace según la métrica.
 *
 * Las tres son métricas REALES y dan caminos distintos, que es el punto del
 * experimento:
 *  - saltos: lo que usa RIP. Cada enlace vale 1, sea fibra o satélite.
 *  - latencia: el retardo de verdad, en ms.
 *  - ospf: costo de referencia / ancho de banda, que es como OSPF calcula el
 *    suyo. Premia los enlaces gordos aunque sean lentos.
 */
function linkCost(link: Link, metric: RoutingMetric): number {
  if (metric === "saltos") return 1;
  if (metric === "latencia") return link.latency;
  return Math.max(1, Math.round(1000 / link.bandwidth));
}

function neighbours(nodeId: string, downLinks: number[]): string[] {
  return LINKS.flatMap((link, index) => {
    if (downLinks.includes(index)) return [];
    if (link.from === nodeId) return [link.to];
    if (link.to === nodeId) return [link.from];
    return [];
  });
}

export function findLink(a: string, b: string): { link: Link; index: number } | null {
  const index = LINKS.findIndex(
    (l) => (l.from === a && l.to === b) || (l.from === b && l.to === a),
  );
  return index === -1 ? null : { link: LINKS[index], index };
}

/**
 * Dijkstra: el camino de costo mínimo. Es contra esto que se compara el
 * jugador, y es —literalmente— el algoritmo que corre OSPF adentro.
 */
export function shortestPath(
  metric: RoutingMetric,
  downLinks: number[],
): { path: string[]; cost: number } {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const pending = new Set(NODES.map((n) => n.id));

  NODES.forEach((n) => dist.set(n.id, Infinity));
  dist.set(START, 0);

  while (pending.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    pending.forEach((id) => {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        current = id;
      }
    });

    if (current === null || best === Infinity) break;
    const node: string = current;
    pending.delete(node);
    if (node === GOAL) break;

    neighbours(node, downLinks).forEach((next) => {
      if (!pending.has(next)) return;
      const found = findLink(node, next);
      if (!found) return;
      const alt = (dist.get(node) ?? Infinity) + linkCost(found.link, metric);
      if (alt < (dist.get(next) ?? Infinity)) {
        dist.set(next, alt);
        prev.set(next, node);
      }
    });
  }

  const path: string[] = [];
  let cursor: string | undefined = GOAL;
  while (cursor) {
    path.unshift(cursor);
    cursor = prev.get(cursor);
  }

  return {
    path: path[0] === START ? path : [],
    cost: dist.get(GOAL) ?? Infinity,
  };
}

/** Cuánto tarda el paquete en recorrer un salto, en segundos. */
const HOP_TIME = 0.45;

/**
 * Motor de "Encontrá el camino" (R4).
 *
 * A diferencia del resto de los experimentos, acá el jugador no mueve
 * sliders: TOMA DECISIONES. En cada router elige por qué enlace sale el
 * paquete, y recién al llegar al destino se compara su camino con el que
 * habría elegido Dijkstra con esa misma métrica.
 *
 * Esa comparación es la lección entera: con "saltos" el camino corto pasa
 * por el satélite y tarda una eternidad; con "latencia" el mismo grafo da un
 * camino más largo pero mucho más rápido. Es exactamente por qué RIP quedó
 * obsoleto frente a OSPF.
 */
export function createRoutingEngine(): RoutingEngine {
  let lastVariables: VariablesState = {};
  let metric: RoutingMetric = "latencia";

  const runtime: RoutingRuntime = {
    path: [START],
    options: [],
    cost: 0,
    bestPath: [],
    bestCost: 0,
    downLinks: [],
    arrived: false,
    delivered: 0,
    optimal: 0,
    hopProgress: 1,
  };

  function refreshOptions() {
    const current = runtime.path[runtime.path.length - 1];
    // No se ofrece volver por donde vino: un paquete que rebota entre dos
    // routers es un bucle de enrutamiento, y acá sería solo una forma de
    // inflar el costo sin aprender nada.
    const previous = runtime.path[runtime.path.length - 2];
    runtime.options = neighbours(current, runtime.downLinks).filter(
      (id) => id !== previous,
    );
  }

  function recomputeBest() {
    const best = shortestPath(metric, runtime.downLinks);
    runtime.bestPath = best.path;
    runtime.bestCost = best.cost;
  }

  function restart() {
    runtime.path = [START];
    runtime.cost = 0;
    runtime.arrived = false;
    runtime.hopProgress = 1;
    refreshOptions();
  }

  return {
    init(variables) {
      lastVariables = variables;
      metric = String(variables.metrica ?? "latencia") as RoutingMetric;
      recomputeBest();
      restart();
    },

    update(dt, variables) {
      const nextMetric = String(
        variables.metrica ?? "latencia",
      ) as RoutingMetric;
      if (nextMetric !== metric) {
        metric = nextMetric;
        recomputeBest();
        // El camino ya recorrido se conserva, pero su costo cambia de
        // unidad: recalcularlo evita mezclar milisegundos con saltos.
        let cost = 0;
        for (let i = 1; i < runtime.path.length; i += 1) {
          const found = findLink(runtime.path[i - 1], runtime.path[i]);
          if (found) cost += linkCost(found.link, metric);
        }
        runtime.cost = cost;
      }
      lastVariables = variables;

      // Animación del paquete entre routers.
      if (runtime.hopProgress < 1) {
        runtime.hopProgress = Math.min(1, runtime.hopProgress + dt / HOP_TIME);
      }
    },

    reset() {
      runtime.downLinks = [];
      runtime.delivered = 0;
      runtime.optimal = 0;
      recomputeBest();
      restart();
    },

    getState(): AIContext {
      return {
        experimentName: "Encontrá el camino",
        disciplineName: "Redes",
        variables: lastVariables,
        result: runtime.arrived
          ? {
              tu_camino: runtime.path.join(" → "),
              tu_costo: runtime.cost,
              mejor_camino: runtime.bestPath.join(" → "),
              mejor_costo: runtime.bestCost,
              metrica: metric,
              paquetes_entregados: runtime.delivered,
              por_el_camino_optimo: runtime.optimal,
              ...(runtime.cost === runtime.bestCost
                ? { estado: "¡Camino óptimo!" }
                : {}),
            }
          : undefined,
        conceptTags: [
          "enrutamiento",
          "métricas de enrutamiento",
          "algoritmo de Dijkstra",
          "convergencia",
          "RIP vs OSPF",
        ],
      };
    },

    hop(nodeId) {
      if (runtime.arrived) return;
      if (!runtime.options.includes(nodeId)) return;

      const current = runtime.path[runtime.path.length - 1];
      const found = findLink(current, nodeId);
      if (!found) return;

      runtime.path.push(nodeId);
      runtime.cost += linkCost(found.link, metric);
      runtime.hopProgress = 0;
      refreshOptions();

      if (nodeId === GOAL) {
        runtime.arrived = true;
        runtime.delivered += 1;
        if (runtime.cost === runtime.bestCost) runtime.optimal += 1;
      }
    },

    restart,

    toggleFailure() {
      if (runtime.downLinks.length > 0) {
        runtime.downLinks = [];
      } else {
        // Se cae un enlace del camino ÓPTIMO actual: tirar uno cualquiera casi
        // siempre no cambia nada, y entonces no se ve la reconvergencia, que
        // es lo que este botón tiene que enseñar.
        const best = runtime.bestPath;
        const candidates: number[] = [];
        for (let i = 1; i < best.length; i += 1) {
          const found = findLink(best[i - 1], best[i]);
          if (found) candidates.push(found.index);
        }
        if (candidates.length > 0) {
          runtime.downLinks = [
            candidates[Math.floor(Math.random() * candidates.length)],
          ];
        }
      }

      recomputeBest();
      restart();
    },

    getRuntime() {
      return runtime;
    },
  };
}
