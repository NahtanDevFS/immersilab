import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * Motor de "Divide la red": subredes con máscara variable (VLSM), VLAN en
 * los switches de acceso y enrutamiento entre VLAN con router-on-a-stick.
 *
 * Subredes: el estudiante elige la máscara de cada departamento y el motor
 * reparte el bloque 192.168.10.0/24 como se hace a mano en VLSM: de la
 * subred más grande a la más chica, una detrás de otra. Como todos los
 * tamaños son potencias de dos y van de mayor a menor, cada subred queda
 * alineada a su tamaño sin dejar huecos.
 *
 * Hosts usables = 2^(32 − prefijo) − 2: se restan la dirección de red y la de
 * broadcast. Es justo lo que se suele olvidar (62 hosts caben en /26; 64 no).
 */

export interface Department {
  id: string;
  name: string;
  vlan: number;
  color: string;
}

export const DEPARTMENTS: Department[] = [
  { id: "ventas", name: "Ventas", vlan: 10, color: "#3b82f6" },
  { id: "soporte", name: "Soporte", vlan: 20, color: "#22c55e" },
  { id: "contabilidad", name: "Contabilidad", vlan: 30, color: "#f59e0b" },
  { id: "gerencia", name: "Gerencia", vlan: 40, color: "#a855f7" },
];

export const VLAN_COLORS: Record<number, string> = Object.fromEntries(DEPARTMENTS.map((d) => [d.vlan, d.color]));

export interface Round {
  id: string;
  title: string;
  /** Hosts que pide cada subred. El enlace al ISP solo existe en la ronda 2. */
  hosts: Record<string, number>;
}

export const ROUNDS: Round[] = [
  { id: "1", title: "1 · Cuatro departamentos", hosts: { ventas: 50, soporte: 25, contabilidad: 12, gerencia: 5 } },
  { id: "2", title: "2 · Ajustada", hosts: { ventas: 100, soporte: 60, contabilidad: 28, gerencia: 10, enlace: 2 } },
];

export function getRound(id: unknown): Round {
  return ROUNDS.find((r) => r.id === String(id)) ?? ROUNDS[0];
}

export const SUBNET_NAMES: Record<string, string> = {
  ventas: "Ventas",
  soporte: "Soporte",
  contabilidad: "Contabilidad",
  gerencia: "Gerencia",
  enlace: "Enlace al ISP",
};

const BASE = [192, 168, 10];

export const usable = (prefix: number) => 2 ** (32 - prefix) - 2;
export const blockSize = (prefix: number) => 2 ** (32 - prefix);
const ip = (offset: number) => (offset > 255 ? "fuera del bloque" : `${BASE.join(".")}.${offset}`);

/** La máscara más chica (prefijo más largo) donde caben `hosts`. */
export function bestPrefix(hosts: number): number {
  let prefix = 30;
  while (usable(prefix) < hosts) prefix--;
  return prefix;
}

export interface SubnetRow {
  id: string;
  name: string;
  hosts: number;
  prefix: number;
  /** Desplazamiento dentro del /24 (la dirección de red es 192.168.10.<offset>). */
  offset: number;
  network: string;
  first: string;
  last: string;
  broadcast: string;
  usable: number;
  waste: number;
  fits: boolean;
  /** Se sale del /24. */
  outside: boolean;
}

export interface Plan {
  rows: SubnetRow[];
  used: number;
  overflow: boolean;
  allFit: boolean;
  optimal: boolean;
}

export function planOf(round: Round, variables: VariablesState): Plan {
  const entries = Object.entries(round.hosts).map(([id, hosts]) => ({
    id,
    hosts,
    prefix: Number(String(variables[`mascara_${id}`] ?? "/24").replace("/", "")),
  }));
  // De la más grande a la más chica; empates en el orden de la ronda.
  const order = [...entries].sort((a, b) => a.prefix - b.prefix);
  let next = 0;
  const rows: SubnetRow[] = order.map((e) => {
    const size = blockSize(e.prefix);
    const offset = next;
    next += size;
    const outside = offset + size > 256;
    const u = usable(e.prefix);
    return {
      id: e.id,
      name: SUBNET_NAMES[e.id],
      hosts: e.hosts,
      prefix: e.prefix,
      offset,
      network: outside ? "fuera del bloque" : `${ip(offset)}/${e.prefix}`,
      first: ip(offset + 1),
      last: ip(offset + size - 2),
      broadcast: ip(offset + size - 1),
      usable: u,
      waste: Math.max(0, u - e.hosts),
      fits: u >= e.hosts,
      outside,
    };
  });
  const overflow = next > 256;
  return {
    rows,
    used: next,
    overflow,
    allFit: rows.every((r) => r.fits) && !overflow,
    optimal: !overflow && entries.every((e) => e.prefix === bestPrefix(e.hosts)),
  };
}

/** Las ocho PC: en qué piso (switch de acceso) están y de qué departamento son. */
export const PCS: Array<{ id: string; floor: 1 | 2; dept: string }> = [
  { id: "pc1", floor: 1, dept: "ventas" },
  { id: "pc2", floor: 1, dept: "soporte" },
  { id: "pc3", floor: 1, dept: "contabilidad" },
  { id: "pc4", floor: 1, dept: "ventas" },
  { id: "pc5", floor: 2, dept: "gerencia" },
  { id: "pc6", floor: 2, dept: "soporte" },
  { id: "pc7", floor: 2, dept: "ventas" },
  { id: "pc8", floor: 2, dept: "contabilidad" },
];

export const deptOf = (id: string) => DEPARTMENTS.find((d) => d.id === id)!;

/** Las cuatro pruebas de "Probar con ping": un caso de cada fila de la tabla del plan. */
export const PINGS: Array<{ from: string; to: string; kind: string }> = [
  { from: "pc1", to: "pc4", kind: "misma VLAN, mismo switch" },
  { from: "pc1", to: "pc7", kind: "misma VLAN, otro switch" },
  { from: "pc1", to: "pc2", kind: "otra VLAN, mismo switch" },
  { from: "pc3", to: "pc5", kind: "otra VLAN, otro switch" },
];

export interface PingResult {
  from: string;
  to: string;
  kind: string;
  ok: boolean;
  why: string;
  /** Pasa por el router (enrutamiento entre VLAN). */
  viaRouter: boolean;
  crossesSwitch: boolean;
}

export interface NetConfig {
  vlans: Record<string, number>;
  trunk: boolean;
  subinterfaces: boolean;
  plan: Plan;
}

export function configOf(variables: VariablesState): NetConfig {
  const round = getRound(variables.ronda);
  return {
    vlans: Object.fromEntries(PCS.map((p) => [p.id, Number(variables[p.id] ?? 10)])),
    trunk: Boolean(variables.troncal),
    subinterfaces: Boolean(variables.subinterfaces),
    plan: planOf(round, variables),
  };
}

export function ping(c: NetConfig, from: string, to: string, kind: string): PingResult {
  const a = PCS.find((p) => p.id === from)!;
  const b = PCS.find((p) => p.id === to)!;
  const va = c.vlans[from];
  const vb = c.vlans[to];
  const crossesSwitch = a.floor !== b.floor;
  const base = { from, to, kind, crossesSwitch };
  const wrong = [a, b].filter((p) => c.vlans[p.id] !== deptOf(p.dept).vlan);
  if (wrong.length) {
    return { ...base, ok: false, viaRouter: false, why: `error de configuración: ${wrong.map((p) => p.id.toUpperCase()).join(" y ")} en una VLAN que no es la de su departamento` };
  }
  if (va === vb) {
    if (!crossesSwitch) return { ...base, ok: true, viaRouter: false, why: "llega: misma VLAN en el mismo switch" };
    return c.trunk
      ? { ...base, ok: true, viaRouter: false, why: "llega: el enlace troncal lleva la VLAN al otro switch" }
      : { ...base, ok: false, viaRouter: false, why: "no llega: sin troncal, el enlace entre switches solo lleva una VLAN" };
  }
  // Otra VLAN: tiene que subir a la puerta de enlace (el router) y volver.
  const gwA = c.plan.rows.find((r) => r.id === a.dept);
  const gwB = c.plan.rows.find((r) => r.id === b.dept);
  if (!c.trunk) return { ...base, ok: false, viaRouter: false, why: "no llega: sin troncal, el router no recibe las dos VLAN" };
  if (!c.subinterfaces) return { ...base, ok: false, viaRouter: false, why: "no llega: VLAN distintas no se ven sin un router con una subinterfaz por VLAN" };
  if (!gwA || !gwB || gwA.outside || gwB.outside) {
    return { ...base, ok: false, viaRouter: true, why: "no llega: alguna subred se sale del bloque y su puerta de enlace no existe" };
  }
  return { ...base, ok: true, viaRouter: true, why: `llega por el router: puertas de enlace ${gwA.first} y ${gwB.first}` };
}

/** Segundos que tarda cada ping en la animación. */
export const PING_SECONDS = 1.8;

export interface VlanRuntime {
  results: PingResult[] | null;
  /** Ping que se está animando (−1 sin animación) y su avance. */
  current: number;
  t: number;
  config: NetConfig;
  round: Round;
}

export interface VlanEngine extends ExperimentEngine {
  runPings: () => void;
  getRuntime: () => VlanRuntime;
}

export function createVlanEngine(): VlanEngine {
  let lastVariables: VariablesState = {};
  const done = { "sin-desperdicio": false, ajustada: false, vlan: false, "entre-vlan": false };
  const runtime: VlanRuntime = { results: null, current: -1, t: 0, config: configOf({}), round: ROUNDS[0] };

  function refresh(variables: VariablesState) {
    runtime.round = getRound(variables.ronda);
    runtime.config = configOf(variables);
    const plan = runtime.config.plan;
    if (runtime.round.id === "1" && plan.optimal) done["sin-desperdicio"] = true;
    if (runtime.round.id === "2" && plan.allFit) done.ajustada = true;
  }

  function scorePings(results: PingResult[], c: NetConfig) {
    const allRight = PCS.every((p) => c.vlans[p.id] === deptOf(p.dept).vlan);
    if (!allRight) return;
    const inter = results.filter((r) => r.kind.startsWith("otra VLAN"));
    // "Cada quien en su VLAN": bien asignadas y la prueba muestra que sin
    // router las VLAN no se ven entre sí.
    if (!c.subinterfaces && inter.every((r) => !r.ok)) done.vlan = true;
    if (c.trunk && c.subinterfaces && inter.every((r) => r.ok)) done["entre-vlan"] = true;
  }

  return {
    init(variables) {
      lastVariables = variables;
      refresh(variables);
    },

    update(dt, variables) {
      lastVariables = variables;
      refresh(variables);
      if (runtime.current < 0 || !runtime.results) return;
      runtime.t += dt / PING_SECONDS;
      if (runtime.t >= 1) {
        runtime.t = 0;
        runtime.current += 1;
        if (runtime.current >= runtime.results.length) runtime.current = -1;
      }
    },

    runPings() {
      if (runtime.current >= 0) return;
      const c = configOf(lastVariables);
      const results = PINGS.map((p) => ping(c, p.from, p.to, p.kind));
      runtime.results = results;
      runtime.current = 0;
      runtime.t = 0;
      scorePings(results, c);
    },

    reset() {
      runtime.results = null;
      runtime.current = -1;
    },

    resetChallenges() {
      for (const id of Object.keys(done) as Array<keyof typeof done>) done[id] = false;
    },

    getRuntime() {
      return runtime;
    },

    getChallenges(): ChallengeStatus[] {
      const c = (id: keyof typeof done, title: string, detail: string): ChallengeStatus => ({
        id, title, detail, done: done[id], progress: done[id] ? 1 : 0,
      });
      return [
        c("sin-desperdicio", "Sin desperdiciar", "Ronda 1 con la máscara justa para cada departamento."),
        c("ajustada", "Que todo quepa", "Ronda 2: todas las subredes con lugar suficiente y dentro del /24."),
        c("vlan", "Cada quien en su VLAN", "Las 8 PC en la VLAN de su departamento, y un ping que muestre que sin router las VLAN no se ven."),
        c("entre-vlan", "Que se hablen", "Ping entre VLAN distintas que llegue, con enlace troncal y subinterfaces."),
      ];
    },

    getState(): AIContext {
      const { config, round } = runtime;
      const plan = config.plan;
      const result: Record<string, number | string> = {
        ronda: round.title,
        pedido: Object.entries(round.hosts).map(([id, h]) => `${SUBNET_NAMES[id]} ${h} hosts`).join(", "),
        tabla: plan.rows
          .map((r) => `${r.name} /${r.prefix} ${r.outside ? "fuera" : r.network.split("/")[0]} (${r.fits ? `sobran ${r.waste}` : "no alcanza"})`)
          .join("; "),
        direcciones_usadas: `${plan.used} de 256`,
        se_sale_del_bloque: plan.overflow ? "sí" : "no",
        puertos: PCS.map((p) => `${p.id.toUpperCase()} ${config.vlans[p.id]}`).join(", "),
        enlace_troncal: config.trunk ? "sí" : "no",
        subinterfaces_en_el_router: config.subinterfaces ? "sí" : "no",
      };
      if (runtime.results) {
        result.ultima_prueba = runtime.results.map((r) => `${r.from.toUpperCase()} a ${r.to.toUpperCase()} (${r.kind}): ${r.why}`).join("; ");
      }
      return {
        experimentName: "Divide la red",
        disciplineName: "Redes",
        variables: lastVariables,
        result,
        conceptTags: ["subredes", "VLSM", "máscara de subred", "VLAN", "enlace troncal", "router-on-a-stick", "red jerárquica"],
      };
    },
  };
}
