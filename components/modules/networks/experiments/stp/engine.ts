import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * Motor de "Rompe el bucle": bucles de capa 2, tormenta de broadcast, STP
 * (802.1D) y EtherChannel, sobre una topología fija de cuatro switches.
 *
 * El algoritmo de STP, tal como lo hacen los switches:
 * 1. La raíz es el switch con el menor ID de puente: prioridad y, si
 *    empatan, la MAC.
 * 2. Cada switch calcula su costo hacia la raíz por el camino más barato
 *    (4 por enlace de 1 Gbps, 19 por uno de 100 Mbps).
 * 3. Cada switch que no es la raíz elige su puerto raíz: el de menor costo
 *    hacia la raíz; si empatan, el que da al vecino de menor ID, y después
 *    el que llega al puerto de menor número de ese vecino.
 * 4. En cada enlace, el puerto designado es el del extremo con menor costo
 *    a la raíz; si empatan, el del switch de menor ID.
 * 5. Todos los demás puertos quedan bloqueados.
 *
 * El estado de STP (activo o no) y los enlaces caídos viven en el motor y
 * no en variables: se cambian con botones del panel de acciones, que en el
 * visor no pueden tocar variables. Ver la entrega del catálogo v2.
 */

export type SwitchId = "nucleo" | "distribucion" | "acceso1" | "acceso2";

export const SWITCHES: Array<{
  id: SwitchId;
  name: string;
  mac: number;
  short: string;
}> = [
  { id: "nucleo", name: "Núcleo", mac: 4, short: "N" },
  { id: "distribucion", name: "Distribución", mac: 3, short: "D" },
  { id: "acceso1", name: "Acceso 1", mac: 1, short: "A1" },
  { id: "acceso2", name: "Acceso 2", mac: 2, short: "A2" },
];

export interface Link {
  /** 1 a 6, como en las variables pred_enlaceN. */
  n: number;
  a: SwitchId;
  b: SwitchId;
  /** Número de puerto en cada extremo. */
  portA: number;
  portB: number;
  gbps: number;
}

export const LINKS: Link[] = [
  { n: 1, a: "nucleo", b: "distribucion", portA: 1, portB: 1, gbps: 1 },
  { n: 2, a: "nucleo", b: "distribucion", portA: 2, portB: 2, gbps: 1 },
  { n: 3, a: "nucleo", b: "acceso1", portA: 3, portB: 1, gbps: 1 },
  { n: 4, a: "nucleo", b: "acceso2", portA: 4, portB: 1, gbps: 1 },
  { n: 5, a: "distribucion", b: "acceso1", portA: 3, portB: 2, gbps: 0.1 },
  { n: 6, a: "distribucion", b: "acceso2", portA: 4, portB: 2, gbps: 0.1 },
];

export const linkName = (l: Link) =>
  `${SWITCHES.find((s) => s.id === l.a)!.short}–${SWITCHES.find((s) => s.id === l.b)!.short}${l.n <= 2 ? ` (${l.n === 1 ? "a" : "b"})` : ""}`;

/** Costo STP: 4 para 1 Gbps, 19 para 100 Mbps, 3 para el EtherChannel de 2 Gbps. */
export const costOf = (gbps: number) => (gbps >= 2 ? 3 : gbps >= 1 ? 4 : 19);

export type PortRole = "raiz" | "designado" | "bloqueado";

export interface StpResult {
  root: SwitchId;
  cost: Record<SwitchId, number>;
  /** Rol de cada extremo de cada enlace activo: clave `${n}:${switch}`. */
  roles: Record<string, PortRole>;
  /** Enlaces con algún extremo bloqueado. */
  blocked: number[];
}

export const bridgeId = (s: SwitchId, priorities: Record<SwitchId, number>) =>
  priorities[s] * 16 + SWITCHES.find((x) => x.id === s)!.mac;

/** Los enlaces que STP ve: sin los caídos, y con EtherChannel los dos N–D como uno solo. */
export function logicalLinks(
  down: Set<number>,
  etherchannel: boolean,
): Array<Link & { members: number[]; cost: number }> {
  const out: Array<Link & { members: number[]; cost: number }> = [];
  const parallel = LINKS.filter((l) => l.n <= 2 && !down.has(l.n));
  if (etherchannel && parallel.length > 0) {
    out.push({
      ...parallel[0],
      members: parallel.map((l) => l.n),
      cost: costOf(parallel.length),
      gbps: parallel.length,
    });
  } else {
    for (const l of parallel)
      out.push({ ...l, members: [l.n], cost: costOf(l.gbps) });
  }
  for (const l of LINKS)
    if (l.n > 2 && !down.has(l.n))
      out.push({ ...l, members: [l.n], cost: costOf(l.gbps) });
  return out;
}

export function computeStp(
  priorities: Record<SwitchId, number>,
  down: Set<number>,
  etherchannel: boolean,
): StpResult {
  const id = (s: SwitchId) => bridgeId(s, priorities);
  const root = [...SWITCHES].sort((x, y) => id(x.id) - id(y.id))[0].id;
  const links = logicalLinks(down, etherchannel);

  // Costo a la raíz: Bellman-Ford alcanza con cuatro nodos.
  const cost = Object.fromEntries(
    SWITCHES.map((s) => [s.id, s.id === root ? 0 : Infinity]),
  ) as Record<SwitchId, number>;
  for (let k = 0; k < SWITCHES.length; k++) {
    for (const l of links) {
      if (cost[l.a] + l.cost < cost[l.b]) cost[l.b] = cost[l.a] + l.cost;
      if (cost[l.b] + l.cost < cost[l.a]) cost[l.a] = cost[l.b] + l.cost;
    }
  }

  const roles: Record<string, PortRole> = {};
  // Puerto raíz de cada switch que no es la raíz.
  for (const s of SWITCHES) {
    if (s.id === root || !Number.isFinite(cost[s.id])) continue;
    const candidates = links
      .filter((l) => l.a === s.id || l.b === s.id)
      .map((l) => {
        const other = l.a === s.id ? l.b : l.a;
        const otherPort = l.a === s.id ? l.portB : l.portA;
        return {
          l,
          total: cost[other] + l.cost,
          otherId: id(other),
          otherPort,
        };
      })
      .sort(
        (x, y) =>
          x.total - y.total ||
          x.otherId - y.otherId ||
          x.otherPort - y.otherPort,
      );
    if (candidates.length) roles[`${candidates[0].l.n}:${s.id}`] = "raiz";
  }
  // Puerto designado de cada enlace; lo que no es raíz ni designado se bloquea.
  for (const l of links) {
    const aWins =
      cost[l.a] < cost[l.b] || (cost[l.a] === cost[l.b] && id(l.a) < id(l.b));
    const designated = aWins ? l.a : l.b;
    const other = aWins ? l.b : l.a;
    roles[`${l.n}:${designated}`] = "designado";
    if (roles[`${l.n}:${other}`] !== "raiz")
      roles[`${l.n}:${other}`] = "bloqueado";
  }
  // Los miembros de un EtherChannel comparten el rol del canal.
  for (const l of links) {
    for (const m of l.members.slice(1)) {
      roles[`${m}:${l.a}`] = roles[`${l.n}:${l.a}`];
      roles[`${m}:${l.b}`] = roles[`${l.n}:${l.b}`];
    }
  }
  const blocked = LINKS.filter(
    (l) =>
      !down.has(l.n) &&
      (roles[`${l.n}:${l.a}`] === "bloqueado" ||
        roles[`${l.n}:${l.b}`] === "bloqueado"),
  ).map((l) => l.n);
  return { root, cost, roles, blocked };
}

/** ¿Los enlaces que reenvían forman un bucle? (más enlaces que los de un árbol). */
export function hasLoop(forwarding: Link[]): boolean {
  const parent = Object.fromEntries(
    SWITCHES.map((s) => [s.id, s.id]),
  ) as Record<SwitchId, SwitchId>;
  const find = (x: SwitchId): SwitchId =>
    parent[x] === x ? x : (parent[x] = find(parent[x]));
  for (const l of forwarding) {
    const ra = find(l.a);
    const rb = find(l.b);
    if (ra === rb) return true;
    parent[ra] = rb;
  }
  return false;
}

/** Profundidad de cada switch desde Acceso 1 (de donde sale el broadcast), por los enlaces que reenvían. */
export function reachFrom(
  start: SwitchId,
  forwarding: Link[],
): Record<SwitchId, number> {
  const depth = Object.fromEntries(
    SWITCHES.map((s) => [s.id, Infinity]),
  ) as Record<SwitchId, number>;
  depth[start] = 0;
  const queue: SwitchId[] = [start];
  while (queue.length) {
    const s = queue.shift()!;
    for (const l of forwarding) {
      const other = l.a === s ? l.b : l.b === s ? l.a : null;
      if (other && depth[other] === Infinity) {
        depth[other] = depth[s] + 1;
        queue.push(other);
      }
    }
  }
  return depth;
}

export type Phase = "idle" | "broadcast" | "storm" | "converging";

/** Cuánto dura la animación de los BPDU o de la reconvergencia, s. */
export const CONVERGE_SECONDS = 3;
export const BROADCAST_SECONDS = 3;

export interface StpRuntime {
  stpOn: boolean;
  down: Set<number>;
  phase: Phase;
  t: number;
  /** Tramas por segundo durante la tormenta. */
  frames: number;
  priorities: Record<SwitchId, number>;
  etherchannel: boolean;
  stp: StpResult;
  /** Los enlaces que reenvían tramas ahora (sin STP, todos los que están arriba). */
  forwarding: Link[];
  /** Último broadcast: a cuántas de las 4 PC... (dos por switch de acceso, y las de los otros). */
  lastBroadcast: { reached: number; total: number; storm: boolean } | null;
  /** Predicción comparada al activar STP. */
  lastPrediction: { predicted: number[]; actual: number[]; ok: boolean } | null;
}

export interface StpEngine extends ExperimentEngine {
  sendBroadcast: () => void;
  toggleStp: () => void;
  powerCycle: () => void;
  toggleLink: (n: number) => void;
  restoreLinks: () => void;
  getRuntime: () => StpRuntime;
}

const prioritiesOf = (v: VariablesState): Record<SwitchId, number> => ({
  nucleo: Number(v.prioridad_nucleo ?? 32768),
  distribucion: Number(v.prioridad_distribucion ?? 32768),
  acceso1: Number(v.prioridad_acceso1 ?? 32768),
  acceso2: Number(v.prioridad_acceso2 ?? 32768),
});

/** Las PC cuelgan de los switches de acceso: dos en cada uno. */
export const PCS_PER_ACCESS = 2;

export function createStpEngine(): StpEngine {
  let lastVariables: VariablesState = {};
  const done = {
    tormenta: false,
    raiz: false,
    prediccion: false,
    "se-recupera": false,
    etherchannel: false,
  };
  /** Raíces con las que ya se hizo el primer intento de predicción. */
  const triedRoots = new Set<SwitchId>();

  const runtime: StpRuntime = {
    stpOn: false,
    down: new Set(),
    phase: "idle",
    t: 0,
    frames: 0,
    priorities: prioritiesOf({}),
    etherchannel: false,
    stp: computeStp(prioritiesOf({}), new Set(), false),
    forwarding: LINKS,
    lastBroadcast: null,
    lastPrediction: null,
  };

  /** Raíz y bloqueados con los que STP convergió por última vez ("" con STP apagado). */
  let convergedRoot: SwitchId | null = null;
  let convergedBlocked = "";

  /**
   * Compara la predicción con lo que bloquea STP. Solo cuenta para el reto
   * si es el primer intento con esa raíz (`firstTry`); si no, solo actualiza
   * el "coincide / no coincide" del panel.
   */
  function checkPrediction(firstTry: boolean) {
    const predicted = LINKS.filter((l) =>
      Boolean(lastVariables[`pred_enlace${l.n}`]),
    ).map((l) => l.n);
    const actual = runtime.stp.blocked;
    const ok =
      predicted.length === actual.length &&
      predicted.every((n) => actual.includes(n));
    runtime.lastPrediction = { predicted, actual, ok };
    if (firstTry && !triedRoots.has(runtime.stp.root)) {
      triedRoots.add(runtime.stp.root);
      if (ok) done.prediccion = true;
    }
  }

  function recompute() {
    runtime.priorities = prioritiesOf(lastVariables);
    runtime.etherchannel = Boolean(lastVariables.etherchannel);
    runtime.stp = computeStp(
      runtime.priorities,
      runtime.down,
      runtime.etherchannel,
    );
    const up = LINKS.filter((l) => !runtime.down.has(l.n));
    runtime.forwarding = runtime.stpOn
      ? up.filter((l) => !runtime.stp.blocked.includes(l.n))
      : up;
    if (!runtime.stpOn) {
      convergedRoot = null;
      convergedBlocked = "";
      return;
    }
    // Cualquier cambio del árbol (activar STP, otra prioridad, EtherChannel,
    // un enlace cortado) hace reconverger. Antes solo pasaba con los botones:
    // al cambiar una prioridad con STP activo la raíz cambiaba sin avisar y la
    // predicción no se comparaba hasta apagar y volver a activar STP.
    const blocked = runtime.stp.blocked.join(",");
    const rootChanged = runtime.stp.root !== convergedRoot;
    if (rootChanged || blocked !== convergedBlocked) {
      convergedRoot = runtime.stp.root;
      convergedBlocked = blocked;
      if (runtime.phase !== "storm") {
        runtime.phase = "converging";
        runtime.t = 0;
      }
      if (rootChanged) checkPrediction(true);
    } else if (runtime.down.size === 0) {
      // Marcar o desmarcar la predicción con STP activo se refleja enseguida.
      checkPrediction(false);
    }
    if (runtime.stp.root === "nucleo") done.raiz = true;
    if (
      runtime.etherchannel &&
      !runtime.stp.blocked.includes(1) &&
      !runtime.stp.blocked.includes(2) &&
      !runtime.down.has(1) &&
      !runtime.down.has(2)
    ) {
      done.etherchannel = true;
    }
  }

  /** Sin STP, un bucle activo convierte cualquier broadcast en tormenta. */
  function loopNow() {
    // Con EtherChannel los dos enlaces N–D son uno solo: no forman bucle entre sí.
    const links = runtime.etherchannel
      ? runtime.forwarding.filter(
          (l, i, all) => !(l.n === 2 && all.some((x) => x.n === 1)),
        )
      : runtime.forwarding;
    return hasLoop(links);
  }

  return {
    init(variables) {
      lastVariables = variables;
      recompute();
    },

    update(dt, variables) {
      lastVariables = variables;
      recompute();
      if (runtime.phase === "idle") return;
      runtime.t += dt;
      if (runtime.phase === "storm") {
        // Cada switch reenvía cada copia por todos sus puertos: crece sin parar.
        runtime.frames = Math.min(
          5_000_000,
          Math.round(20 * 2 ** (runtime.t * 3)),
        );
        if (runtime.t > 1.2) done.tormenta = true;
        return;
      }
      const limit =
        runtime.phase === "converging" ? CONVERGE_SECONDS : BROADCAST_SECONDS;
      if (runtime.t >= limit) {
        runtime.phase = "idle";
        runtime.t = 0;
      }
    },

    sendBroadcast() {
      if (runtime.phase === "storm" || runtime.phase === "converging") return;
      recompute();
      if (loopNow()) {
        runtime.phase = "storm";
        runtime.t = 0;
        runtime.frames = 20;
        runtime.lastBroadcast = { reached: 0, total: 4, storm: true };
        return;
      }
      const depth = reachFrom("acceso1", runtime.forwarding);
      const reached =
        (["acceso1", "acceso2"] as const).filter((s) =>
          Number.isFinite(depth[s]),
        ).length * PCS_PER_ACCESS;
      runtime.lastBroadcast = { reached, total: 4, storm: false };
      runtime.phase = "broadcast";
      runtime.t = 0;
      if (runtime.stpOn && runtime.down.size > 0 && reached === 4)
        done["se-recupera"] = true;
    },

    toggleStp() {
      if (runtime.phase === "storm") return;
      runtime.stpOn = !runtime.stpOn;
      // Al activarlo, recompute() arranca la convergencia y compara la predicción.
      recompute();
    },

    powerCycle() {
      runtime.phase = "idle";
      runtime.t = 0;
      runtime.frames = 0;
    },

    toggleLink(n) {
      if (runtime.down.has(n)) runtime.down.delete(n);
      else runtime.down.add(n);
      recompute();
      if (runtime.stpOn && runtime.phase !== "storm") {
        runtime.phase = "converging";
        runtime.t = 0;
      }
    },

    restoreLinks() {
      runtime.down.clear();
      recompute();
      if (runtime.stpOn && runtime.phase !== "storm") {
        runtime.phase = "converging";
        runtime.t = 0;
      }
    },

    reset() {
      this.powerCycle();
    },

    resetChallenges() {
      for (const id of Object.keys(done) as Array<keyof typeof done>)
        done[id] = false;
      triedRoots.clear();
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      return runtime.phase === "storm"
        ? Array.from({ length: 20 }, (_, i) => ({
            x: i,
            y: Math.min(5_000_000, 20 * 2 ** (((runtime.t * i) / 19) * 3)),
          }))
        : [];
    },

    getChallenges(): ChallengeStatus[] {
      const c = (
        id: keyof typeof done,
        title: string,
        detail: string,
      ): ChallengeStatus => ({
        id,
        title,
        detail,
        done: done[id],
        progress: done[id] ? 1 : 0,
      });
      return [
        c(
          "tormenta",
          "Provoca una tormenta",
          "Sin STP, manda un broadcast y mira caer la red.",
        ),
        c(
          "raiz",
          "Elige bien la raíz",
          "Con STP activo, que el Núcleo quede como puente raíz.",
        ),
        c(
          "prediccion",
          "Piensa como STP",
          "Marca qué enlaces se bloquean y acierta al activar STP, en el primer intento con esa raíz.",
        ),
        c(
          "se-recupera",
          "La red se recupera",
          "Con STP activo, corta un enlace y comprueba que el broadcast llega a las 4 PC.",
        ),
        c(
          "etherchannel",
          "Todo el ancho de banda",
          "Con EtherChannel y STP, ningún enlace Núcleo–Distribución bloqueado.",
        ),
      ];
    },

    getState(): AIContext {
      const { stp, priorities } = runtime;
      const name = (s: SwitchId) => SWITCHES.find((x) => x.id === s)!.name;
      const roleText = LINKS.filter((l) => !runtime.down.has(l.n))
        .map(
          (l) =>
            `enlace ${l.n} ${linkName(l)}: ${name(l.a)} ${stp.roles[`${l.n}:${l.a}`] ?? "?"}, ${name(l.b)} ${stp.roles[`${l.n}:${l.b}`] ?? "?"}`,
        )
        .join("; ");
      return {
        experimentName: "Rompe el bucle",
        disciplineName: "Redes",
        variables: lastVariables,
        result: {
          stp: runtime.stpOn ? "activo" : "apagado",
          estado:
            runtime.phase === "storm"
              ? `tormenta de broadcast, ${runtime.frames} tramas por segundo`
              : runtime.phase === "converging"
                ? "STP convergiendo"
                : runtime.phase === "broadcast"
                  ? "broadcast en curso"
                  : "en reposo",
          ids_de_puente: SWITCHES.map(
            (s) =>
              `${s.name} ${priorities[s.id]}:${String(s.mac).padStart(2, "0")}`,
          ).join(", "),
          puente_raiz: name(stp.root),
          costo_a_la_raiz: SWITCHES.map(
            (s) =>
              `${s.name} ${Number.isFinite(stp.cost[s.id]) ? stp.cost[s.id] : "sin camino"}`,
          ).join(", "),
          ...(runtime.stpOn
            ? {
                roles: roleText,
                enlaces_bloqueados: stp.blocked.join(", ") || "ninguno",
              }
            : {}),
          enlaces_caidos: [...runtime.down].join(", ") || "ninguno",
          etherchannel: runtime.etherchannel
            ? "sí (N–D como un enlace de 2 Gbps)"
            : "no",
          ...(runtime.lastBroadcast
            ? {
                ultimo_broadcast: runtime.lastBroadcast.storm
                  ? "tormenta"
                  : `llegó a ${runtime.lastBroadcast.reached} de 4 PC`,
              }
            : {}),
          ...(runtime.lastPrediction
            ? {
                prediccion: `marcaste ${runtime.lastPrediction.predicted.join(", ") || "ninguno"}; ${runtime.lastPrediction.ok ? "coincide" : "no coincide"}`,
              }
            : {}),
        },
        conceptTags: [
          "bucle de capa 2",
          "tormenta de broadcast",
          "STP",
          "puente raíz",
          "puerto raíz",
          "puerto designado",
          "EtherChannel",
        ],
      };
    },
  };
}
