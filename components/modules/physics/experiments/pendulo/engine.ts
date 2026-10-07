import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/**
 * F3 · Sincroniza los relojes — PLAN_DESARROLLO.md §3.1.
 *
 * Dos péndulos: uno de referencia, fijo, y el del jugador. Se integra la
 * ecuación completa θ'' = −(g/L)·sen θ − b·θ' con RK4, no la versión lineal:
 * así el período que se MIDE (entre cruces por cero) muestra que la fórmula
 * T = 2π√(L/g) es una aproximación que se aleja con ángulos grandes.
 *
 * La masa no entra en la ecuación del movimiento —se simplifica— y ese es
 * justamente el punto del reto 2. Sí entra en la energía, que se dibuja.
 */

export const GRAVITY: Record<string, number> = {
  tierra: 9.81,
  luna: 1.62,
  marte: 3.71,
};

export const REFERENCE = { length: 0.7, angle: 15 };

/** Diferencia relativa de período aceptada para "sincronizados". */
const SYNC_TOLERANCE = 0.01;
const DOUBLE_TOLERANCE = 0.02;
/** Cuántos períodos seguidos tienen que cumplir la condición. */
const PERIODS_NEEDED = 3;
const MASS_SPREAD_KG = 2;

export interface PendulumState {
  /** Ángulo en radianes (0 = vertical). */
  theta: number;
  omega: number;
  /** Instante del último cruce por cero hacia la derecha. */
  lastCrossing: number | null;
  /** Últimos períodos medidos, el más reciente al final. */
  periods: number[];
}

export interface ChallengeProgress {
  done: boolean;
  progress: number;
}

export interface PendulumRuntime {
  phase: "listo" | "oscilando";
  time: number;
  reference: PendulumState;
  player: PendulumState;
  length: number;
  mass: number;
  gravity: number;
  /** Energías del péndulo del jugador, relativas a la energía inicial (0–1). */
  kinetic: number;
  potential: number;
  /** Período teórico de pequeñas oscilaciones, para comparar con el medido. */
  theoryReference: number;
  theoryPlayer: number;
  /** Tu período medido / período de referencia medido (null hasta medir). */
  ratio: number | null;
  challenges: {
    sincronizar: ChallengeProgress;
    masa: ChallengeProgress;
    doble: ChallengeProgress;
  };
}

export interface PendulumEngine extends ExperimentEngine {
  release: () => void;
  stop: () => void;
  getRuntime: () => PendulumRuntime;
}

function freshPendulum(angleDeg: number): PendulumState {
  return { theta: (angleDeg * Math.PI) / 180, omega: 0, lastCrossing: null, periods: [] };
}

/** Un paso de RK4 de θ'' = −(g/L)·sen θ − b·θ'. */
function step(p: PendulumState, g: number, length: number, damping: number, dt: number) {
  const accel = (theta: number, omega: number) =>
    -(g / length) * Math.sin(theta) - damping * omega;
  const k1t = p.omega;
  const k1w = accel(p.theta, p.omega);
  const k2t = p.omega + (dt / 2) * k1w;
  const k2w = accel(p.theta + (dt / 2) * k1t, p.omega + (dt / 2) * k1w);
  const k3t = p.omega + (dt / 2) * k2w;
  const k3w = accel(p.theta + (dt / 2) * k2t, p.omega + (dt / 2) * k2w);
  const k4t = p.omega + dt * k3w;
  const k4w = accel(p.theta + dt * k3t, p.omega + dt * k3w);
  p.theta += (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
  p.omega += (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
}

/** Registra un cruce por cero de izquierda a derecha, interpolado dentro del paso. */
function detectCrossing(p: PendulumState, previousTheta: number, time: number, dt: number) {
  if (previousTheta < 0 && p.theta >= 0) {
    const fraction = -previousTheta / (p.theta - previousTheta);
    const crossing = time - dt + fraction * dt;
    if (p.lastCrossing !== null) {
      p.periods.push(crossing - p.lastCrossing);
      if (p.periods.length > 6) p.periods.shift();
    }
    p.lastCrossing = crossing;
  }
}

export function smallAnglePeriod(length: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(length / g);
}

export function createPendulumEngine(): PendulumEngine {
  let lastVariables: VariablesState = {};
  /** Ángulo (rad) desde el que se soltó el péndulo del jugador. */
  let releaseAngle = (15 * Math.PI) / 180;
  /** Masas con las que estuvo sincronizado, para el reto 2. */
  let syncedMassMin = Infinity;
  let syncedMassMax = -Infinity;
  /** Cuántos períodos del jugador llevan cumpliendo cada condición. */
  let syncStreak = 0;
  let doubleStreak = 0;

  const runtime: PendulumRuntime = {
    phase: "listo",
    time: 0,
    reference: freshPendulum(REFERENCE.angle),
    player: freshPendulum(15),
    length: 1,
    mass: 1,
    gravity: GRAVITY.tierra,
    kinetic: 0,
    potential: 1,
    theoryReference: smallAnglePeriod(REFERENCE.length, GRAVITY.tierra),
    theoryPlayer: smallAnglePeriod(1, GRAVITY.tierra),
    ratio: null,
    challenges: {
      sincronizar: { done: false, progress: 0 },
      masa: { done: false, progress: 0 },
      doble: { done: false, progress: 0 },
    },
  };

  function read(variables: VariablesState) {
    runtime.length = Number(variables.longitud ?? 1);
    runtime.mass = Number(variables.masa ?? 1);
    runtime.gravity = GRAVITY[String(variables.gravedad ?? "tierra")] ?? GRAVITY.tierra;
    runtime.theoryReference = smallAnglePeriod(REFERENCE.length, runtime.gravity);
    runtime.theoryPlayer = smallAnglePeriod(runtime.length, runtime.gravity);
  }

  function energies() {
    const { player, mass, length, gravity } = runtime;
    const kinetic = 0.5 * mass * (length * player.omega) ** 2;
    const potential = mass * gravity * length * (1 - Math.cos(player.theta));
    return { kinetic, potential };
  }

  /**
   * La energía "100 %": la que tendría al soltarlo, con los parámetros de
   * AHORA. No se guarda la del instante de la suelta: si el alumno cambia la
   * longitud con el péndulo en movimiento (o la suelta llega antes que el
   * nuevo valor del slider), la referencia vieja daba barras imposibles,
   * como 90 % de cinética más 146 % de potencial.
   */
  function releaseEnergy() {
    const { mass, length, gravity } = runtime;
    return Math.max(mass * gravity * length * (1 - Math.cos(releaseAngle)), 1e-9);
  }

  function placeAtRest() {
    const angle = Number(lastVariables.angulo ?? 15);
    releaseAngle = (angle * Math.PI) / 180;
    runtime.reference = freshPendulum(REFERENCE.angle);
    runtime.player = freshPendulum(angle);
    runtime.time = 0;
    runtime.ratio = null;
    syncStreak = 0;
    doubleStreak = 0;
    runtime.kinetic = 0;
    runtime.potential = 1;
  }

  /** Se llama una vez por cada período nuevo del jugador, no en cada paso. */
  function evaluateChallenges() {
    const ref = runtime.reference.periods;
    const mine = runtime.player.periods;
    if (ref.length === 0 || mine.length === 0) return;

    const refPeriod = ref[ref.length - 1];
    const myPeriod = mine[mine.length - 1];
    runtime.ratio = myPeriod / refPeriod;

    const synced = Math.abs(runtime.ratio - 1) <= SYNC_TOLERANCE;
    const doubled = Math.abs(runtime.ratio - 2) <= 2 * DOUBLE_TOLERANCE;
    syncStreak = synced ? syncStreak + 1 : 0;
    doubleStreak = doubled ? doubleStreak + 1 : 0;

    const { sincronizar, masa, doble } = runtime.challenges;
    if (!sincronizar.done) {
      sincronizar.progress = Math.min(1, syncStreak / PERIODS_NEEDED);
      sincronizar.done = syncStreak >= PERIODS_NEEDED;
    }
    if (synced) {
      syncedMassMin = Math.min(syncedMassMin, runtime.mass);
      syncedMassMax = Math.max(syncedMassMax, runtime.mass);
    }
    if (!masa.done) {
      const spread = Math.max(0, syncedMassMax - syncedMassMin);
      masa.progress = Math.min(1, spread / MASS_SPREAD_KG);
      masa.done = sincronizar.done && spread >= MASS_SPREAD_KG;
    }
    if (!doble.done) {
      doble.progress = Math.min(1, doubleStreak / PERIODS_NEEDED);
      doble.done = doubleStreak >= PERIODS_NEEDED;
    }
  }

  return {
    init(variables) {
      lastVariables = variables;
      read(variables);
      placeAtRest();
    },

    update(dt, variables) {
      // Longitud, gravedad o ángulo cambiados con el péndulo en movimiento:
      // se vuelve a soltar desde el ángulo inicial, como en un laboratorio
      // real (se detiene, se ajusta, se suelta). Cambiar la longitud en
      // pleno vuelo conservando la velocidad angular inventaba energía.
      // La masa NO reinicia: el reto 2 es justamente cambiarla en vuelo y
      // ver que no pasa nada.
      const restart =
        variables.longitud !== lastVariables.longitud ||
        variables.gravedad !== lastVariables.gravedad ||
        variables.angulo !== lastVariables.angulo;
      lastVariables = variables;
      read(variables);

      if (runtime.phase === "listo") {
        // Quieto: el péndulo sigue al ángulo de suelta mientras se ajusta.
        if (restart) placeAtRest();
        return;
      }
      if (restart) placeAtRest();

      const damping = Number(variables.amortiguamiento ?? 0);
      const prevRef = runtime.reference.theta;
      const prevMine = runtime.player.theta;
      runtime.time += dt;
      // La referencia no tiene amortiguamiento: es el reloj patrón.
      step(runtime.reference, runtime.gravity, REFERENCE.length, 0, dt);
      step(runtime.player, runtime.gravity, runtime.length, damping, dt);
      detectCrossing(runtime.reference, prevRef, runtime.time, dt);
      const crossingBefore = runtime.player.lastCrossing;
      detectCrossing(runtime.player, prevMine, runtime.time, dt);
      if (runtime.player.lastCrossing !== crossingBefore) evaluateChallenges();

      const { kinetic, potential } = energies();
      // Relativas a la energía con la que se soltó: con amortiguamiento la
      // suma baja de 1 y se ve cuánto se perdió.
      const reference = releaseEnergy();
      runtime.kinetic = kinetic / reference;
      runtime.potential = potential / reference;
    },

    reset() {
      runtime.phase = "listo";
      this.resetChallenges!();
      placeAtRest();
    },

    // Solo los retos: el péndulo sigue oscilando si estaba oscilando.
    resetChallenges() {
      syncedMassMin = Infinity;
      syncedMassMax = -Infinity;
      syncStreak = 0;
      doubleStreak = 0;
      for (const challenge of Object.values(runtime.challenges)) {
        challenge.done = false;
        challenge.progress = 0;
      }
    },

    getChallenges(): ChallengeStatus[] {
      const { sincronizar, masa, doble } = runtime.challenges;
      return [
        {
          id: "sincronizar",
          title: "Sincroniza los relojes",
          detail: "Que tu péndulo tenga el mismo período que la referencia (±1 %).",
          ...sincronizar,
        },
        {
          id: "masa",
          title: "¿Y la masa?",
          detail: sincronizar.done
            ? "Sin soltar de nuevo, cambia la masa en 2 kg o más. ¿Se desincroniza?"
            : "Primero sincroniza; después cambia la masa.",
          ...masa,
        },
        {
          id: "doble",
          title: "El doble de lento",
          detail: "Que tu período sea exactamente el doble. ¿Cuánto hay que alargarlo?",
          ...doble,
        },
      ];
    },

    release() {
      placeAtRest();
      runtime.phase = "oscilando";
    },

    stop() {
      runtime.phase = "listo";
      placeAtRest();
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // Los períodos medidos de tu péndulo: tienen que quedar planos al sincronizar.
      return runtime.player.periods.map((period, i) => ({ x: i + 1, y: period }));
    },

    getState(): AIContext {
      const ref = runtime.reference.periods;
      const mine = runtime.player.periods;
      const { sincronizar, masa, doble } = runtime.challenges;
      return {
        experimentName: "Sincroniza los relojes",
        disciplineName: "Física",
        variables: lastVariables,
        result: {
          estado: runtime.phase,
          longitud_referencia_m: REFERENCE.length,
          periodo_referencia_medido_s: ref.length ? Number(ref[ref.length - 1].toFixed(3)) : "sin medir",
          tu_periodo_medido_s: mine.length ? Number(mine[mine.length - 1].toFixed(3)) : "sin medir",
          tu_periodo_teorico_pequenas_oscilaciones_s: Number(runtime.theoryPlayer.toFixed(3)),
          ...(runtime.ratio !== null ? { relacion_de_periodos: Number(runtime.ratio.toFixed(3)) } : {}),
          energia_cinetica_pct: Math.round(runtime.kinetic * 100),
          energia_potencial_pct: Math.round(runtime.potential * 100),
          reto_sincronizar: sincronizar.done ? "logrado" : "pendiente",
          reto_masa: masa.done ? "logrado" : "pendiente",
          reto_doble_periodo: doble.done ? "logrado" : "pendiente",
        },
        conceptTags: [
          "péndulo simple",
          "período",
          "conservación de la energía",
          "oscilaciones",
          "amortiguamiento",
        ],
      };
    },
  };
}
