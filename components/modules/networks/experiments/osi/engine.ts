import type {
  AIContext,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export interface LayerStep {
  /** Nombre de la capa en el modelo OSI. */
  osi: string;
  /** Capa equivalente en el modelo TCP/IP. */
  tcpip: string;
  /** La cabecera que se agrega al bajar por esta capa. */
  header: string;
  /** Cómo se llama la unidad de datos cuando sale de esta capa. */
  pdu: string;
  /** Una línea de por qué existe esta capa. */
  why: string;
  color: string;
}

/**
 * Las pilas, como pasos de encapsulación de arriba hacia abajo.
 *
 * Se modelan como PASOS y no como capas sueltas porque lo que el experimento
 * enseña no es la lista de nombres —que se memoriza en cinco minutos y se
 * olvida en diez— sino que cada capa AGREGA algo concreto al mensaje y que
 * ese algo tiene un motivo. Por eso cada paso lleva su cabecera, cómo pasa a
 * llamarse el paquete después de agregarla, y para qué sirve.
 *
 * Sesión y Presentación no llevan cabecera propia en una pila real de
 * Internet: van marcadas como tales, porque descubrir eso es justamente uno
 * de los puntos en que OSI y TCP/IP no se corresponden uno a uno.
 */
export const OSI_STACK: LayerStep[] = [
  {
    osi: "7 · Aplicación",
    tcpip: "Aplicación",
    header: "HTTP",
    pdu: "Datos",
    why: "El programa arma el mensaje: acá vive el GET que pide una página.",
    color: "#2dd4bf",
  },
  {
    osi: "6 · Presentación",
    tcpip: "Aplicación",
    header: "TLS",
    pdu: "Datos",
    why: "Cifra y da formato. En Internet real la hace TLS, no una capa aparte.",
    color: "#4ec9c0",
  },
  {
    osi: "5 · Sesión",
    tcpip: "Aplicación",
    header: "Sesión",
    pdu: "Datos",
    why: "Abre y cierra la conversación. TCP/IP no le da una capa propia.",
    color: "#6cbfd4",
  },
  {
    osi: "4 · Transporte",
    tcpip: "Transporte",
    header: "TCP",
    pdu: "Segmento",
    why: "Puertos, orden y retransmisión: que llegue todo y en orden.",
    color: "#7aa7e8",
  },
  {
    osi: "3 · Red",
    tcpip: "Internet",
    header: "IP",
    pdu: "Paquete",
    why: "La dirección IP de destino: por dónde ruta el paquete entre redes.",
    color: "#a48ae8",
  },
  {
    osi: "2 · Enlace",
    tcpip: "Acceso al medio",
    header: "Ethernet",
    pdu: "Trama",
    why: "La MAC del siguiente salto y el control de errores del cable.",
    color: "#d98ac4",
  },
  {
    osi: "1 · Física",
    tcpip: "Acceso al medio",
    header: "Bits",
    pdu: "Bits",
    why: "Voltajes, luz o radio: el mensaje se vuelve señal en el medio.",
    color: "#f2a65a",
  },
];

/** La pila TCP/IP: las mismas ideas en cuatro capas en vez de siete. */
export const TCPIP_STACK: LayerStep[] = [
  {
    osi: "7-6-5 · Aplicación",
    tcpip: "Aplicación",
    header: "HTTP",
    pdu: "Datos",
    why: "Una sola capa junta lo que OSI parte en aplicación, presentación y sesión.",
    color: "#2dd4bf",
  },
  OSI_STACK[3],
  OSI_STACK[4],
  {
    osi: "2-1 · Enlace + Física",
    tcpip: "Acceso al medio",
    header: "Ethernet",
    pdu: "Trama",
    why: "TCP/IP no separa el cable de la trama: para él es una sola capa.",
    color: "#d98ac4",
  },
];

export type ModelId = "osi" | "tcpip";

export function getStack(id: string | number | boolean): LayerStep[] {
  return String(id) === "tcpip" ? TCPIP_STACK : OSI_STACK;
}

export type OsiPhase = "bajando" | "viajando" | "subiendo" | "entregado";

export interface OsiRuntime {
  stack: LayerStep[];
  phase: OsiPhase;
  /** Cuántas capas ya se aplicaron (bajando) o se sacaron (subiendo). */
  depth: number;
  /** Las opciones que se le ofrecen al jugador ahora, desordenadas. */
  options: string[];
  correct: number;
  mistakes: number;
  /** Última cabecera equivocada, para poder explicarla. */
  lastError: string | null;
  /** Progreso del viaje por el cable, 0 → 1. */
  travel: number;
}

export interface OsiEngine extends ExperimentEngine {
  /** Aplica (o saca) la cabecera elegida. */
  choose: (header: string) => void;
  restart: () => void;
  getRuntime: () => OsiRuntime;
}

/** Cuánto tarda el paquete en cruzar el cable, en segundos. */
const TRAVEL_TIME = 1.4;

/** Baraja estable por índice: no usa Math.random en el render, así que la
 *  lista de opciones no baila entre frames. */
function shuffle<T>(items: T[], seed: number): T[] {
  return items
    .map((item, i) => ({ item, key: Math.sin(seed + i * 12.9898) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

/**
 * Motor de "Armá el paquete" (R5).
 *
 * El juego es la encapsulación completa, ida y vuelta: bajando por la pila
 * del emisor hay que elegir qué cabecera agrega cada capa, y subiendo por la
 * del receptor, cuál se saca. El orden importa y no es arbitrario — una
 * cabecera IP puesta antes que la de TCP describe un paquete que ningún
 * router del mundo sabría leer.
 *
 * Que el mismo mensaje se pueda armar en la pila OSI de siete capas o en la
 * de TCP/IP de cuatro, y que las cabeceras REALES sean casi las mismas, es lo
 * que muestra que OSI es un modelo de referencia y TCP/IP es lo que
 * efectivamente corre en la red.
 */
export function createOsiEngine(): OsiEngine {
  let lastVariables: VariablesState = {};
  let stack: LayerStep[] = OSI_STACK;
  let seed = 1;

  const runtime: OsiRuntime = {
    stack,
    phase: "bajando",
    depth: 0,
    options: [],
    correct: 0,
    mistakes: 0,
    lastError: null,
    travel: 0,
  };

  /**
   * Tres opciones: la correcta y dos distractoras tomadas de la MISMA pila.
   *
   * Las distractoras son otras cabeceras reales y no inventadas: el error que
   * hay que poder cometer es "TCP antes que IP", que es el malentendido de
   * verdad. Con opciones absurdas se acierta por descarte sin entender nada.
   */
  function refreshOptions() {
    const index =
      runtime.phase === "bajando"
        ? runtime.depth
        : stack.length - 1 - runtime.depth;

    const correct = stack[index]?.header;
    if (!correct) {
      runtime.options = [];
      return;
    }

    const others = stack
      .map((step) => step.header)
      .filter((header) => header !== correct);

    seed += 1;
    const distractors = shuffle(others, seed).slice(0, 2);
    runtime.options = shuffle([correct, ...distractors], seed + 7);
  }

  function restart() {
    runtime.stack = stack;
    runtime.phase = "bajando";
    runtime.depth = 0;
    runtime.travel = 0;
    runtime.lastError = null;
    refreshOptions();
  }

  return {
    init(variables) {
      lastVariables = variables;
      stack = getStack(variables.modelo ?? "osi");
      runtime.correct = 0;
      runtime.mistakes = 0;
      restart();
    },

    update(dt, variables) {
      const nextStack = getStack(variables.modelo ?? "osi");
      if (nextStack !== stack) {
        stack = nextStack;
        restart();
      }
      lastVariables = variables;

      if (runtime.phase === "viajando") {
        runtime.travel += dt / TRAVEL_TIME;
        if (runtime.travel >= 1) {
          runtime.travel = 1;
          runtime.phase = "subiendo";
          runtime.depth = 0;
          refreshOptions();
        }
      }
    },

    reset() {
      runtime.correct = 0;
      runtime.mistakes = 0;
      restart();
    },

    getState(): AIContext {
      const total = stack.length * 2;
      return {
        experimentName: "Armá el paquete",
        disciplineName: "Redes",
        variables: lastVariables,
        result:
          runtime.phase === "entregado"
            ? {
                capas_correctas: runtime.correct,
                de_un_total_de: total,
                errores: runtime.mistakes,
                modelo: String(lastVariables.modelo ?? "osi"),
                ...(runtime.mistakes === 0
                  ? { estado: "¡Mensaje entregado sin un solo error!" }
                  : {}),
              }
            : undefined,
        conceptTags: [
          "modelo OSI",
          "modelo TCP/IP",
          "encapsulación",
          "cabeceras de protocolo",
          "PDU",
        ],
      };
    },

    choose(header) {
      if (runtime.phase === "viajando" || runtime.phase === "entregado") return;

      const index =
        runtime.phase === "bajando"
          ? runtime.depth
          : stack.length - 1 - runtime.depth;
      const expected = stack[index]?.header;

      if (header !== expected) {
        runtime.mistakes += 1;
        runtime.lastError = header;
        return;
      }

      runtime.lastError = null;
      runtime.correct += 1;
      runtime.depth += 1;

      if (runtime.depth >= stack.length) {
        if (runtime.phase === "bajando") {
          // Ya está todo encapsulado: el paquete cruza el cable y del otro
          // lado hay que hacer el camino inverso, sacando cabeceras.
          runtime.phase = "viajando";
          runtime.travel = 0;
          runtime.options = [];
          return;
        }
        runtime.phase = "entregado";
        runtime.options = [];
        return;
      }

      refreshOptions();
    },

    restart,

    getRuntime() {
      return runtime;
    },
  };
}
