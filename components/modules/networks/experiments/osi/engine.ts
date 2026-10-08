import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

export interface LayerStep {
  /** Nombre de la capa en el modelo OSI. */
  osi: string;
  /** Capa equivalente en el modelo TCP/IP. */
  tcpip: string;
  /**
   * Protocolos reales de esta capa: cualquiera vale al bajar. Antes había uno
   * solo por capa y la etiqueta lo mostraba, así que bastaba con leerla.
   */
  protocols: string[];
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
    protocols: ["HTTP", "DNS", "SMTP", "FTP"],
    pdu: "Datos",
    why: "El programa arma el mensaje: aquí vive el GET que pide una página.",
    color: "#2dd4bf",
  },
  {
    osi: "6 · Presentación",
    tcpip: "Aplicación",
    protocols: ["TLS", "ASCII", "JPEG"],
    pdu: "Datos",
    why: "Cifra y da formato. En Internet real la hace TLS, no una capa aparte.",
    color: "#4ec9c0",
  },
  {
    osi: "5 · Sesión",
    tcpip: "Aplicación",
    protocols: ["NetBIOS", "RPC", "SOCKS"],
    pdu: "Datos",
    why: "Abre y cierra la conversación. TCP/IP no le da una capa propia.",
    color: "#6cbfd4",
  },
  {
    osi: "4 · Transporte",
    tcpip: "Transporte",
    protocols: ["TCP", "UDP"],
    pdu: "Segmento",
    why: "Puertos, orden y retransmisión: que llegue todo y en orden.",
    color: "#7aa7e8",
  },
  {
    osi: "3 · Red",
    tcpip: "Internet",
    protocols: ["IPv4", "IPv6"],
    pdu: "Paquete",
    why: "La dirección IP de destino: por dónde ruta el paquete entre redes.",
    color: "#a48ae8",
  },
  {
    osi: "2 · Enlace",
    tcpip: "Acceso al medio",
    protocols: ["Ethernet", "Wi-Fi", "PPP"],
    pdu: "Trama",
    why: "La MAC del siguiente salto y el control de errores del cable.",
    color: "#d98ac4",
  },
  {
    osi: "1 · Física",
    tcpip: "Acceso al medio",
    protocols: ["Cable UTP", "Fibra óptica", "Radio"],
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
    protocols: ["HTTP", "DNS", "SMTP", "FTP"],
    pdu: "Datos",
    why: "Una sola capa junta lo que OSI parte en aplicación, presentación y sesión.",
    color: "#2dd4bf",
  },
  OSI_STACK[3],
  OSI_STACK[4],
  {
    osi: "2-1 · Enlace + Física",
    tcpip: "Acceso al medio",
    protocols: ["Ethernet", "Wi-Fi", "PPP"],
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
  /** Por qué estuvo mal, en una línea. */
  errorNote: string | null;
  /** Lo que el jugador puso en cada capa al bajar (por índice de la pila). */
  chosen: Array<string | null>;
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

/** Baraja. Se llama al pasar de capa, nunca en el render: las opciones no
 *  cambian entre frames. */
function shuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Motor de "Arma el paquete" (R5).
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
  /** Modelos en los que se entregó el mensaje sin un solo error. */
  const cleanModels = new Set<string>();
  let stack: LayerStep[] = OSI_STACK;

  const runtime: OsiRuntime = {
    stack,
    phase: "bajando",
    depth: 0,
    options: [],
    correct: 0,
    mistakes: 0,
    lastError: null,
    errorNote: null,
    chosen: [],
    travel: 0,
  };

  function currentIndex(): number {
    return runtime.phase === "bajando"
      ? runtime.depth
      : stack.length - 1 - runtime.depth;
  }

  function layerName(step: LayerStep): string {
    return String(lastVariables.modelo ?? "osi") === "tcpip" ? step.tcpip : step.osi;
  }

  /**
   * Tres opciones, todas protocolos reales.
   *
   * Bajando: uno de esta capa (cualquiera de los suyos) y dos de otras capas.
   * El error que hay que poder cometer es "UDP en la capa de red", que es el
   * malentendido de verdad; con opciones absurdas se acierta por descarte.
   *
   * Subiendo: lo que el emisor puso en esta capa, OTRO protocolo de la misma
   * capa y uno de otra. El receptor no elige qué protocolo usar: lee el que
   * llegó. Si abajo se puso UDP, sacar TCP es un error aunque sea de la
   * misma capa.
   */
  function refreshOptions() {
    const index = currentIndex();
    const step = stack[index];
    if (!step) {
      runtime.options = [];
      return;
    }

    const otherLayers = stack.filter((_, i) => i !== index);
    let correct: string;
    const distractors: string[] = [];

    if (runtime.phase === "bajando") {
      correct = pick(step.protocols);
      shuffle(otherLayers)
        .slice(0, 2)
        .forEach((layer) => distractors.push(pick(layer.protocols)));
    } else {
      correct = runtime.chosen[index] ?? step.protocols[0];
      const siblings = step.protocols.filter((p) => p !== correct);
      if (siblings.length > 0) distractors.push(pick(siblings));
      for (const layer of shuffle(otherLayers)) {
        if (distractors.length >= 2) break;
        distractors.push(pick(layer.protocols));
      }
    }

    runtime.options = shuffle([correct, ...distractors]);
  }

  /**
   * Un intento nuevo, con los contadores en cero. Antes los errores se
   * arrastraban de un mensaje al siguiente (y de OSI a TCP/IP): con un solo
   * error en cualquier intento, los retos "sin errores" quedaban imposibles
   * hasta recargar la página.
   */
  function restart() {
    runtime.stack = stack;
    runtime.phase = "bajando";
    runtime.depth = 0;
    runtime.travel = 0;
    runtime.lastError = null;
    runtime.errorNote = null;
    runtime.chosen = stack.map(() => null);
    runtime.correct = 0;
    runtime.mistakes = 0;
    refreshOptions();
  }

  /** La explicación del error, según qué se eligió y dónde. */
  function explain(header: string, index: number): string {
    const step = stack[index];
    const owner = stack.find((s) => s.protocols.includes(header));
    if (runtime.phase === "subiendo" && owner === step) {
      return `${header} es de esta capa, pero no es lo que puso el emisor: llegó ${runtime.chosen[index]}. El receptor lee la cabecera que vino, no elige otra.`;
    }
    const where = owner ? `${header} es de ${layerName(owner)}` : `${header} no va aquí`;
    return `${where}. Esta capa (${layerName(step)}): ${step.why.charAt(0).toLowerCase()}${step.why.slice(1)}`;
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
        experimentName: "Arma el paquete",
        disciplineName: "Redes",
        variables: lastVariables,
        result:
          runtime.phase === "entregado"
            ? {
                capas_correctas: runtime.correct,
                de_un_total_de: total,
                errores: runtime.mistakes,
                cabeceras: runtime.chosen.filter(Boolean).join(" + "),
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

      const index = currentIndex();
      const step = stack[index];
      if (!step) return;
      const valid =
        runtime.phase === "bajando"
          ? step.protocols.includes(header)
          : header === runtime.chosen[index];

      if (!valid) {
        runtime.mistakes += 1;
        runtime.lastError = header;
        runtime.errorNote = explain(header, index);
        return;
      }

      if (runtime.phase === "bajando") runtime.chosen[index] = header;
      runtime.lastError = null;
      runtime.errorNote = null;
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
        if (runtime.mistakes === 0) cleanModels.add(String(lastVariables.modelo ?? "osi"));
        return;
      }

      refreshOptions();
    },

    restart,

    resetChallenges() {
      cleanModels.clear();
    },

    getChallenges(): ChallengeStatus[] {
      return [
        {
          id: "osi",
          title: "Sin errores en OSI",
          detail: "Encapsula y desencapsula las siete capas sin equivocarte.",
          done: cleanModels.has("osi"),
          progress: cleanModels.has("osi") ? 1 : 0,
        },
        {
          id: "tcpip",
          title: "Sin errores en TCP/IP",
          detail: "Lo mismo con las cuatro capas de TCP/IP.",
          done: cleanModels.has("tcpip"),
          progress: cleanModels.has("tcpip") ? 1 : 0,
        },
      ];
    },

    getRuntime() {
      return runtime;
    },
  };
}
