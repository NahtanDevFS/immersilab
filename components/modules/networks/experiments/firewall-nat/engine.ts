import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * Motor de "Defiende el borde": listas de control de acceso, inspección de
 * conexiones establecidas y NAT con reenvío de puertos.
 *
 * El rack se evalúa como un router real: de arriba hacia abajo, gana la
 * PRIMERA regla que coincide y, si ninguna coincide, el "bloquear todo lo
 * demás" implícito del final. Por eso el orden importa y por eso "permitir
 * lo necesario" alcanza: todo lo que no se permitió ya queda bloqueado.
 *
 * Todo es determinista: el resultado de cada paquete se calcula al lanzar el
 * tráfico; la animación solo lo va mostrando de a uno.
 */

export const SLOTS = 6;
export const WEB = "192.168.1.20";
export const DB = "192.168.1.30";
export const ADMIN_IP = "200.10.5.7";
export const ATTACKER = "45.33.12.9";
export const PUBLIC_IP = "190.56.20.4";

export type Proto = "TCP" | "ICMP";

export interface Packet {
  id: string;
  label: string;
  src: string;
  dst: string;
  proto: Proto;
  port: number | null;
  legit: boolean;
  /** Respuesta a una conexión que se inició desde adentro. */
  established?: boolean;
  /** A qué equipo de la red interna va (para pintarlo si lo atacan). */
  host: HostId;
}

export type HostId = "web" | "bd" | "pc1" | "pc2" | "pc3" | "admin" | "gerencia";

export const HOSTS: Array<{ id: HostId; name: string; ip: string }> = [
  { id: "web", name: "Servidor web", ip: WEB },
  { id: "bd", name: "Base de datos", ip: DB },
  { id: "pc1", name: "PC 1", ip: "192.168.1.10" },
  { id: "pc2", name: "PC 2", ip: "192.168.1.11" },
  { id: "pc3", name: "PC 3", ip: "192.168.1.12" },
  { id: "gerencia", name: "PC de Gerencia", ip: "192.168.1.40" },
];

export const PACKETS: Record<string, Packet> = {
  "cliente-https": { id: "cliente-https", label: "Cliente visita la web (TCP 443)", src: "181.10.3.22", dst: WEB, proto: "TCP", port: 443, legit: true, host: "web" },
  "cliente-http": { id: "cliente-http", label: "Cliente visita la web (TCP 80)", src: "181.10.3.23", dst: WEB, proto: "TCP", port: 80, legit: true, host: "web" },
  respuesta: { id: "respuesta", label: "Respuesta a un empleado que navega", src: "142.250.1.10", dst: "192.168.1.10", proto: "TCP", port: 51000, legit: true, established: true, host: "pc1" },
  "admin-ssh": { id: "admin-ssh", label: "El administrador entra por SSH (TCP 22)", src: ADMIN_IP, dst: WEB, proto: "TCP", port: 22, legit: true, host: "web" },
  "fuerza-bruta": { id: "fuerza-bruta", label: "Atacante prueba contraseñas por SSH", src: ATTACKER, dst: WEB, proto: "TCP", port: 22, legit: false, host: "web" },
  "ataque-bd": { id: "ataque-bd", label: "Atacante entra a la base de datos (TCP 3306)", src: ATTACKER, dst: DB, proto: "TCP", port: 3306, legit: false, host: "bd" },
  escaneo: { id: "escaneo", label: "Atacante hace ping buscando equipos", src: ATTACKER, dst: "192.168.1.0/24", proto: "ICMP", port: null, legit: false, host: "pc2" },
  ransomware: { id: "ransomware", label: "Atacante intenta entrar a una PC (TCP 445)", src: ATTACKER, dst: "192.168.1.11", proto: "TCP", port: 445, legit: false, host: "pc2" },
};

export interface Card {
  id: string;
  label: string;
  /** Texto corto para la tarjeta en la escena. */
  short: string;
  action: "permitir" | "bloquear";
  matches: (p: Packet) => boolean;
}

export const CARDS: Card[] = [
  { id: "web", label: "Permitir web (TCP 80 y 443) hacia el servidor web", short: "Permitir web\nTCP 80/443 → servidor", action: "permitir", matches: (p) => p.proto === "TCP" && p.dst === WEB && (p.port === 80 || p.port === 443) },
  { id: "ssh-admin", label: `Permitir SSH (TCP 22) desde ${ADMIN_IP}`, short: `Permitir SSH\ndesde ${ADMIN_IP}`, action: "permitir", matches: (p) => p.proto === "TCP" && p.port === 22 && p.src === ADMIN_IP },
  { id: "respuestas", label: "Permitir respuestas de conexiones iniciadas desde adentro", short: "Permitir respuestas\n(establecidas)", action: "permitir", matches: (p) => Boolean(p.established) },
  { id: "bloquear-ssh", label: "Bloquear SSH desde cualquier origen", short: "Bloquear SSH\ncualquier origen", action: "bloquear", matches: (p) => p.proto === "TCP" && p.port === 22 },
  { id: "bloquear-bd", label: "Bloquear TCP 3306 (base de datos) desde internet", short: "Bloquear TCP 3306\ndesde internet", action: "bloquear", matches: (p) => p.proto === "TCP" && p.port === 3306 },
  { id: "bloquear-ping", label: "Bloquear ping (ICMP) desde internet", short: "Bloquear ping\ndesde internet", action: "bloquear", matches: (p) => p.proto === "ICMP" },
  { id: "permitir-todo", label: "Permitir todo", short: "Permitir todo", action: "permitir", matches: () => true },
  { id: "bloquear-todo", label: "Bloquear todo", short: "Bloquear todo", action: "bloquear", matches: () => true },
  { id: "permitir-bd", label: "Permitir TCP 3306 desde cualquier origen", short: "Permitir TCP 3306\ncualquier origen", action: "permitir", matches: (p) => p.proto === "TCP" && p.port === 3306 },
  { id: "permitir-ssh", label: "Permitir SSH desde cualquier origen", short: "Permitir SSH\ncualquier origen", action: "permitir", matches: (p) => p.proto === "TCP" && p.port === 22 },
  { id: "permitir-ping", label: "Permitir ping desde cualquier origen", short: "Permitir ping\ncualquier origen", action: "permitir", matches: (p) => p.proto === "ICMP" },
  { id: "bloquear-web", label: "Bloquear TCP 80 hacia el servidor web", short: "Bloquear TCP 80\n→ servidor web", action: "bloquear", matches: (p) => p.proto === "TCP" && p.dst === WEB && p.port === 80 },
];

export function getCard(id: unknown): Card | null {
  return CARDS.find((c) => c.id === id) ?? null;
}

/** Reenvíos de puertos de la ronda 3 (NAT). */
export const NAT_CARDS = [
  { id: "web443", label: "Reenviar 443 al servidor web", short: "Reenviar 443\n→ servidor web", port: 443 as number | null, host: "web" as HostId },
  { id: "gerencia-todo", label: "Reenviar todos los puertos a la PC de Gerencia", short: "Reenviar TODO\n→ PC de Gerencia", port: null, host: "gerencia" as HostId },
  { id: "bd3306", label: "Reenviar 3306 a la base de datos", short: "Reenviar 3306\n→ base de datos", port: 3306, host: "bd" as HostId },
];

export interface Round {
  id: string;
  title: string;
  story: string;
  packets: string[];
}

export const ROUNDS: Round[] = [
  {
    id: "1",
    title: "1 · Protege la base de datos",
    story: "La web tiene que verse y los empleados navegar, pero nadie de afuera debe tocar la base de datos ni escanear la red.",
    packets: ["cliente-https", "cliente-http", "respuesta", "ataque-bd", "escaneo"],
  },
  {
    id: "2",
    title: "2 · El orden importa",
    story: `Ahora el administrador entra por SSH desde ${ADMIN_IP}, y un atacante prueba contraseñas por SSH. El rack se lee de arriba hacia abajo.`,
    packets: ["cliente-https", "cliente-http", "respuesta", "admin-ssh", "fuerza-bruta", "ataque-bd", "escaneo", "ransomware"],
  },
  {
    id: "3",
    title: "3 · NAT",
    story: `La red usa direcciones privadas y sale a internet con una sola IP pública, ${PUBLIC_IP}. Los empleados navegan; luego llega un visitante a la web pública. En esta ronda el rack no se usa: todo lo decide NAT.`,
    packets: [],
  },
];

export function getRound(id: unknown): Round {
  return ROUNDS.find((r) => r.id === String(id)) ?? ROUNDS[0];
}

export type Outcome = "paso" | "caido" | "frenado" | "atacado";

export interface PacketResult {
  id: string;
  label: string;
  legit: boolean;
  host: HostId;
  /** Ranura de la regla que coincidió (0 a 5), o −1 si fue el bloqueo implícito. */
  slot: number;
  allowed: boolean;
  outcome: Outcome;
  /** Ronda 3: la traducción que hizo NAT, si hubo. */
  translation?: string;
}

export function outcomeOf(legit: boolean, allowed: boolean): Outcome {
  if (legit) return allowed ? "paso" : "caido";
  return allowed ? "atacado" : "frenado";
}

/** Evalúa un paquete contra el rack: la primera regla que coincide decide. */
export function evaluate(rack: Array<Card | null>, packet: Packet): { slot: number; allowed: boolean } {
  for (let i = 0; i < rack.length; i++) {
    const card = rack[i];
    if (card && card.matches(packet)) return { slot: i, allowed: card.action === "permitir" };
  }
  return { slot: -1, allowed: false };
}

/** Tráfico de la ronda de NAT: tres salidas, un visitante y dos sondeos de atacantes. */
export function natTraffic(forward: string): PacketResult[] {
  const results: PacketResult[] = [];
  ["pc1", "pc2", "pc3"].forEach((host, i) => {
    const ip = HOSTS.find((h) => h.id === host)!.ip;
    results.push({
      id: `salida-${i + 1}`,
      label: `${HOSTS.find((h) => h.id === host)!.name} navega`,
      legit: true,
      host: host as HostId,
      slot: -2,
      allowed: true,
      outcome: "paso",
      translation: `${ip}:${51000 + i} → ${PUBLIC_IP}:${40001 + i}`,
    });
  });
  const rule = NAT_CARDS.find((c) => c.id === forward) ?? null;
  // Lo que llega de afuera a la IP pública: sin reenvío, NAT no sabe a quién
  // dárselo y lo descarta.
  const inbound: Array<{ id: string; label: string; port: number; legit: boolean; wants: HostId }> = [
    { id: "visitante-web", label: `Visitante abre https://${PUBLIC_IP} (443)`, port: 443, legit: true, wants: "web" },
    { id: "ataque-bd", label: "Atacante prueba el puerto 3306", port: 3306, legit: false, wants: "bd" },
    { id: "ransomware", label: "Atacante prueba el puerto 445", port: 445, legit: false, wants: "pc2" },
  ];
  for (const p of inbound) {
    const to = rule && (rule.port === null || rule.port === p.port) ? rule.host : null;
    // El visitante solo "pasa" si llega al servidor web; si NAT lo manda a
    // otro equipo, ese equipo queda expuesto y la web sigue sin verse.
    const reached = to !== null;
    const outcome: Outcome = p.legit
      ? to === p.wants ? "paso" : "caido"
      : reached ? "atacado" : "frenado";
    results.push({
      id: p.id,
      label: p.label,
      legit: p.legit,
      host: to ?? p.wants,
      slot: -2,
      allowed: reached,
      outcome,
      translation: reached ? `${PUBLIC_IP}:${p.port} → ${HOSTS.find((h) => h.id === to)!.ip}:${p.port}` : undefined,
    });
  }
  return results;
}

export function rackOf(variables: VariablesState): Array<Card | null> {
  return Array.from({ length: SLOTS }, (_, i) => getCard(variables[`regla${i + 1}`]));
}

/** Segundos que tarda cada paquete en recorrer la escena. */
export const PACKET_SECONDS = 1.6;

export interface Launch {
  round: Round;
  results: PacketResult[];
  rulesUsed: number;
  passed: number;
  legitTotal: number;
  stopped: number;
  attacksTotal: number;
  clean: boolean;
}

export interface FirewallRuntime {
  round: Round;
  launch: Launch | null;
  /** Paquete que se está animando (−1 sin animación) y su avance de 0 a 1. */
  current: number;
  t: number;
  /** ¿Ya se mostraron todos los paquetes del último lanzamiento? */
  finished: boolean;
}

export interface FirewallEngine extends ExperimentEngine {
  launchTraffic: () => void;
  getRuntime: () => FirewallRuntime;
}

export function createFirewallEngine(): FirewallEngine {
  let lastVariables: VariablesState = {};
  const done = { "base-protegida": false, orden: false, minimo: false, nat: false };
  let lastSummary = "";

  const runtime: FirewallRuntime = { round: ROUNDS[0], launch: null, current: -1, t: 0, finished: false };

  function score(l: Launch) {
    if (!l.clean) return;
    if (l.round.id === "1") done["base-protegida"] = true;
    if (l.round.id === "2") {
      done.orden = true;
      if (l.rulesUsed <= 3) done.minimo = true;
    }
    if (l.round.id === "3") done.nat = true;
  }

  return {
    init(variables) {
      lastVariables = variables;
      runtime.round = getRound(variables.ronda);
    },

    update(dt, variables) {
      lastVariables = variables;
      const round = getRound(variables.ronda);
      if (round.id !== runtime.round.id) {
        runtime.round = round;
        runtime.launch = null;
        runtime.current = -1;
        runtime.finished = false;
      }
      if (runtime.current < 0 || !runtime.launch) return;
      runtime.t += dt / PACKET_SECONDS;
      if (runtime.t >= 1) {
        runtime.t = 0;
        runtime.current += 1;
        if (runtime.current >= runtime.launch.results.length) {
          runtime.current = -1;
          runtime.finished = true;
          // Los retos cuentan al terminar de mostrarse, no al apretar el botón.
          score(runtime.launch);
        }
      }
    },

    launchTraffic() {
      if (runtime.current >= 0) return;
      const round = getRound(lastVariables.ronda);
      const rack = rackOf(lastVariables);
      const results =
        round.id === "3"
          ? natTraffic(String(lastVariables.nat_reenvio ?? "ninguno"))
          : round.packets.map((id) => {
              const p = PACKETS[id];
              const { slot, allowed } = evaluate(rack, p);
              return { id, label: p.label, legit: p.legit, host: p.host, slot, allowed, outcome: outcomeOf(p.legit, allowed) };
            });
      const legit = results.filter((r) => r.legit);
      const attacks = results.filter((r) => !r.legit);
      const launch: Launch = {
        round,
        results,
        rulesUsed: rack.filter(Boolean).length,
        passed: legit.filter((r) => r.outcome === "paso").length,
        legitTotal: legit.length,
        stopped: attacks.filter((r) => r.outcome === "frenado").length,
        attacksTotal: attacks.length,
        clean: results.every((r) => r.outcome === "paso" || r.outcome === "frenado"),
      };
      runtime.round = round;
      runtime.launch = launch;
      runtime.current = 0;
      runtime.t = 0;
      runtime.finished = false;
      lastSummary = summaryOf(launch);
    },

    reset() {
      runtime.launch = null;
      runtime.current = -1;
      runtime.finished = false;
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
        c("base-protegida", "Protege la base de datos", "Ronda 1 sin ataques que pasen ni servicio caído."),
        c("orden", "El orden importa", "Ronda 2 sin ataques que pasen ni servicio caído."),
        c("minimo", "Con lo justo", "Ronda 2 limpia con 3 reglas o menos."),
        c("nat", "Abre solo lo necesario", "Ronda 3: la web visible desde afuera y nada más expuesto."),
      ];
    },

    getState(): AIContext {
      const rack = rackOf(lastVariables);
      const l = runtime.launch;
      const result: Record<string, number | string> = {
        ronda: runtime.round.title,
        situacion: runtime.round.story,
        rack:
          runtime.round.id === "3"
            ? "no se usa en esta ronda"
            : rack.map((c, i) => `${i + 1}: ${c ? `${c.action} · ${c.label}` : "vacía"}`).join("; ") + "; al final: bloquear todo lo demás (implícito)",
      };
      if (runtime.round.id === "3") {
        result.reenvio_nat = NAT_CARDS.find((c) => c.id === lastVariables.nat_reenvio)?.label ?? "ninguno";
      }
      if (l) {
        result.ultimo_lanzamiento = lastSummary;
        result.detalle = l.results
          .map((r) => `${r.label}: ${OUTCOME_TEXT[r.outcome]}${r.slot >= 0 ? ` (regla ${r.slot + 1})` : r.slot === -1 ? " (bloqueo implícito)" : ""}`)
          .join("; ");
      }
      return {
        experimentName: "Defiende el borde",
        disciplineName: "Redes",
        variables: lastVariables,
        result,
        conceptTags: ["firewall", "listas de control de acceso", "deny implícito", "inspección de estado", "NAT", "PAT", "reenvío de puertos"],
      };
    },
  };
}

export const OUTCOME_TEXT: Record<Outcome, string> = {
  paso: "pasó",
  caido: "servicio caído",
  frenado: "ataque frenado",
  atacado: "te atacaron",
};

export function summaryOf(l: Launch): string {
  return `${l.passed} de ${l.legitTotal} legítimos pasaron · ${l.stopped} de ${l.attacksTotal} ataques frenados${l.round.id === "3" ? "" : ` · ${l.rulesUsed} regla${l.rulesUsed === 1 ? "" : "s"}`}`;
}
