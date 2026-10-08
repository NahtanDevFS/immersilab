import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";

/** Permeabilidad del vacío, T·m/A. */
const MU_0 = 4 * Math.PI * 1e-7;
const GRAVITY = 9.81;

export interface Core {
  id: string;
  label: string;
  /** Permeabilidad relativa: cuántas veces el núcleo refuerza el campo. */
  mu: number;
  /** Campo de saturación, T: por encima de esto el núcleo ya no ayuda. */
  saturation: number;
}

export const CORES: Core[] = [
  { id: "aire", label: "Aire (sin núcleo)", mu: 1, saturation: Infinity },
  { id: "acero", label: "Acero", mu: 300, saturation: 1.4 },
  { id: "hierro", label: "Hierro dulce", mu: 2000, saturation: 1.6 },
];

export function getCore(id: string | number | boolean): Core {
  return CORES.find((c) => c.id === String(id)) ?? CORES[1];
}

export interface ScrapItem {
  id: string;
  name: string;
  material: string;
  /** ¿Lo atrae un imán? Solo hierro, acero, níquel, cobalto. */
  ferromagnetic: boolean;
  /** kg */
  mass: number;
  /** Superficie que toca el polo del imán, m². */
  area: number;
}

/**
 * La chatarra del patio. Dos son metales NO ferromagnéticos (aluminio y
 * cobre): el imán no los levanta con ninguna corriente, y descubrirlo es
 * parte del experimento — "todos los metales se pegan a un imán" es la
 * confusión más común sobre el tema.
 */
export const ITEMS: ScrapItem[] = [
  { id: "lata", name: "Lata de acero", material: "acero", ferromagnetic: true, mass: 0.4, area: 0.006 },
  { id: "olla", name: "Olla de aluminio", material: "aluminio", ferromagnetic: false, mass: 1.5, area: 0.03 },
  { id: "bloque", name: "Bloque de hierro", material: "hierro", ferromagnetic: true, mass: 30, area: 0.04 },
  { id: "tubo", name: "Tubo de cobre", material: "cobre", ferromagnetic: false, mass: 4, area: 0.02 },
  { id: "motor", name: "Motor viejo", material: "hierro", ferromagnetic: true, mass: 80, area: 0.08 },
  { id: "carro", name: "Carro compacto", material: "acero", ferromagnetic: true, mass: 900, area: 0.2 },
];

/** Posición extra de la grúa, después de la chatarra. */
export const CONTAINER = "contenedor";

/** Los que hay que separar en el reto 2 (los ferromagnéticos chicos). */
export const SORT_TARGETS = ["lata", "bloque", "motor"];

/** Superficie del polo del electroimán, m² (un disco de unos 50 cm). */
export const POLE_AREA = 0.2;
/** Largo del recorrido del campo dentro del núcleo, m. */
const CORE_PATH = 1;
/** Separación que queda cuando el objeto ya está pegado al polo, m. */
const CONTACT_GAP = 0.004;
/** Resistencia de la bobina por cada vuelta de alambre, Ω. */
export const OHMS_PER_TURN = 0.01;
/** Potencia que la bobina aguanta de forma continua, W. */
export const RATED_POWER = 1500;
/**
 * Térmica: la bobina se calienta con I²R y se enfría con el aire.
 * Con la potencia nominal se estabiliza en unos 108 °C, por debajo del corte
 * de 120 °C; bastante más que eso (3000 W) corta en unos 4 segundos.
 */
const AMBIENT = 25;
const COOLING = 18; // W por °C de diferencia con el ambiente
const HEAT_CAPACITY = 100; // J/°C
export const CUTOFF_TEMP = 120;
const RESET_TEMP = 60;

/** Cuánto hay que sostener el carro para el reto 3, s. */
export const CAR_HOLD_SECONDS = 10;

/** Velocidad del carro de la grúa, en posiciones por segundo. */
const CRANE_SPEED = 1.6;

export interface MagnetRuntime {
  /** Posición de la grúa, continua (0 = lata … 6 = contenedor). */
  cranePos: number;
  targetPos: number;
  magnetOn: boolean;
  /** La protección térmica cortó la corriente. */
  tripped: boolean;
  temperature: number;
  power: number;
  /** Campo en la cara del polo frente al objeto, T. */
  field: number;
  /** Fuerza sobre el objeto que está debajo (o colgando), N. */
  force: number;
  /** Peso de ese objeto, N. */
  weight: number;
  carried: string | null;
  /** 0 → apoyado, 1 → arriba: animación de levantar. */
  lift: number;
  /** Dónde está cada objeto. */
  inContainer: string[];
  /** Último aviso para el jugador. */
  message: string;
  carHeld: number;
}

export interface MagnetEngine extends ExperimentEngine {
  toggleMagnet: () => void;
  getRuntime: () => MagnetRuntime;
}

/** Índice de posición (0..6) según la variable "posicion". */
export function positionIndex(id: string | number | boolean): number {
  const i = ITEMS.findIndex((item) => item.id === String(id));
  return i >= 0 ? i : ITEMS.length; // el contenedor
}

/**
 * Campo en la cara del polo con el objeto a una separación `gap`.
 *
 * Circuito magnético: el flujo recorre el núcleo (largo L, permeabilidad μr)
 * y cruza dos veces el aire hasta el objeto. Las "resistencias magnéticas"
 * se suman como en serie: con núcleo de hierro casi toda la oposición está
 * en el aire, y por eso unos centímetros de separación hunden el campo.
 */
export function fieldAt(turns: number, current: number, core: Core, gap: number): number {
  const b = (MU_0 * turns * current) / (CORE_PATH / core.mu + 2 * gap);
  return Math.min(b, core.saturation);
}

/** Fuerza de atracción sobre un objeto, N (presión magnética B²/2μ₀ por el área). */
export function pullForce(item: ScrapItem, field: number): number {
  if (!item.ferromagnetic) return 0;
  return (field * field * Math.min(item.area, POLE_AREA)) / (2 * MU_0);
}

/**
 * Motor de "La grúa electromagnética".
 *
 * Ley de Ampère en un solenoide: la corriente en la bobina crea un campo, y
 * el núcleo ferromagnético lo multiplica. Lo que el jugador descubre:
 * - sin núcleo casi no levanta nada;
 * - la fuerza cae muy rápido con la distancia (va con B², y B con 1/gap);
 * - el aluminio y el cobre no se pegan, con ninguna corriente;
 * - para el mismo campo, más vueltas y menos corriente calientan menos:
 *   P = I²R con R ∝ N, o sea P = (N·I)²·r / N.
 */
export function createMagnetEngine(): MagnetEngine {
  let lastVariables: VariablesState = {};
  let liftedCan = false;
  let carDone = false;
  let triedNonMagnetic = false;

  const runtime: MagnetRuntime = {
    cranePos: 0,
    targetPos: 0,
    magnetOn: false,
    tripped: false,
    temperature: AMBIENT,
    power: 0,
    field: 0,
    force: 0,
    weight: 0,
    carried: null,
    lift: 0,
    inContainer: [],
    message: "",
    carHeld: 0,
  };

  function settings(variables: VariablesState) {
    return {
      current: Number(variables.corriente ?? 5),
      turns: Number(variables.vueltas ?? 200),
      core: getCore(variables.nucleo ?? "acero"),
      gap: Number(variables.separacion ?? 10) / 100,
    };
  }

  /**
   * El objeto que está en el suelo debajo de la grúa, solo si la grúa ya
   * llegó a donde se la mandó: al pasar por encima de otros en el camino, con
   * el imán encendido, no los va levantando.
   */
  function itemBelow(): ScrapItem | null {
    if (Math.abs(runtime.cranePos - runtime.targetPos) > 0.02) return null;
    const index = runtime.targetPos;
    const item = ITEMS[index];
    if (!item || runtime.inContainer.includes(item.id) || runtime.carried === item.id) return null;
    return item;
  }

  function drop() {
    const id = runtime.carried;
    if (!id) return;
    const overContainer = Math.abs(runtime.cranePos - ITEMS.length) < 0.05;
    if (overContainer && !runtime.inContainer.includes(id)) runtime.inContainer.push(id);
    runtime.carried = null;
    runtime.carHeld = 0;
    runtime.message = overContainer
      ? `${ITEMS.find((i) => i.id === id)?.name} quedó en el contenedor.`
      : `${ITEMS.find((i) => i.id === id)?.name} se soltó y volvió a su lugar.`;
  }

  return {
    init(variables) {
      lastVariables = variables;
      runtime.targetPos = positionIndex(variables.posicion ?? "lata");
      runtime.cranePos = runtime.targetPos;
    },

    update(dt, variables) {
      lastVariables = variables;
      const { current, turns, core, gap } = settings(variables);

      // --- La grúa se desplaza hacia la posición elegida.
      runtime.targetPos = positionIndex(variables.posicion ?? "lata");
      const delta = runtime.targetPos - runtime.cranePos;
      const step = Math.sign(delta) * Math.min(Math.abs(delta), CRANE_SPEED * dt);
      runtime.cranePos += step;

      // --- Calor de la bobina.
      runtime.power =
        runtime.magnetOn && !runtime.tripped ? current * current * turns * OHMS_PER_TURN : 0;
      runtime.temperature +=
        ((runtime.power - COOLING * (runtime.temperature - AMBIENT)) * dt) / HEAT_CAPACITY;
      if (!runtime.tripped && runtime.temperature >= CUTOFF_TEMP) {
        runtime.tripped = true;
        runtime.magnetOn = false;
        drop();
        runtime.message = `¡Protección térmica! La bobina llegó a ${CUTOFF_TEMP} °C y se cortó la corriente.`;
      }
      if (runtime.tripped && runtime.temperature <= RESET_TEMP) {
        runtime.tripped = false;
        runtime.message = "La bobina se enfrió: ya se puede volver a encender.";
      }

      // --- Fuerza sobre lo que está debajo o colgando. Se lee DESPUÉS de la
      // térmica: si acaba de cortar, en este mismo cuadro ya no hay imán (si
      // no, volvía a levantar el carro que la protección acababa de soltar).
      const energized = runtime.magnetOn && !runtime.tripped;
      const carriedItem = ITEMS.find((i) => i.id === runtime.carried) ?? null;
      const target = carriedItem ?? itemBelow();
      const effectiveGap = carriedItem ? CONTACT_GAP : gap;
      runtime.field = energized ? fieldAt(turns, current, core, effectiveGap) : 0;
      runtime.force = target ? pullForce(target, runtime.field) : 0;
      runtime.weight = target ? target.mass * GRAVITY : 0;

      if (carriedItem) {
        // Ya pegado: si la fuerza no alcanza (o se apagó), se cae.
        if (!energized || runtime.force < runtime.weight) drop();
      } else if (energized && target) {
        if (!target.ferromagnetic) {
          triedNonMagnetic = true;
          runtime.message = `${target.name}: el ${target.material} no es ferromagnético, el imán no lo atrae.`;
        } else if (runtime.force > runtime.weight) {
          runtime.carried = target.id;
          runtime.lift = 0;
          runtime.message = `¡Levantaste ${target.name.toLowerCase()}!`;
          if (target.id === "lata") liftedCan = true;
        } else {
          runtime.message = `No alcanza: ${Math.round(runtime.force)} N de fuerza contra ${Math.round(runtime.weight)} N de peso.`;
        }
      }

      // --- Animación de subir.
      runtime.lift = runtime.carried ? Math.min(1, runtime.lift + dt * 0.8) : 0;

      // --- Reto del carro: sostenerlo dentro de la potencia nominal.
      if (runtime.carried === "carro" && runtime.power <= RATED_POWER) {
        runtime.carHeld += dt;
        if (runtime.carHeld >= CAR_HOLD_SECONDS) carDone = true;
      } else {
        runtime.carHeld = 0;
      }
    },

    reset() {
      runtime.magnetOn = false;
      runtime.carried = null;
      runtime.lift = 0;
      runtime.inContainer = [];
      runtime.carHeld = 0;
      runtime.message = "";
    },

    resetChallenges() {
      liftedCan = false;
      carDone = false;
      triedNonMagnetic = false;
    },

    toggleMagnet() {
      if (runtime.tripped) {
        runtime.message = "La protección térmica está activa: espera a que la bobina se enfríe.";
        return;
      }
      runtime.magnetOn = !runtime.magnetOn;
      if (!runtime.magnetOn) {
        drop();
        if (!runtime.message.includes("contenedor") && !runtime.message.includes("volvió")) {
          runtime.message = "Imán apagado.";
        }
      }
    },

    getRuntime() {
      return runtime;
    },

    getChallenges(): ChallengeStatus[] {
      const sorted = SORT_TARGETS.filter((id) => runtime.inContainer.includes(id)).length;
      return [
        {
          id: "lata",
          title: "Levanta la lata",
          detail: "Ajusta corriente, vueltas, núcleo y separación hasta que el imán la levante.",
          done: liftedCan,
          progress: liftedCan ? 1 : 0,
        },
        {
          id: "separa",
          title: "Separa la chatarra",
          detail: `Lleva al contenedor todo lo que el imán puede levantar, salvo el carro: ${sorted} de ${SORT_TARGETS.length}.${triedNonMagnetic ? " (Ya viste que no todo metal se pega.)" : ""}`,
          done: sorted >= SORT_TARGETS.length,
          progress: sorted / SORT_TARGETS.length,
        },
        {
          id: "carro",
          title: "Levanta el carro sin recalentar",
          detail: `Sostén el carro ${CAR_HOLD_SECONDS} s sin pasar de ${RATED_POWER} W en la bobina.${runtime.carried === "carro" ? ` Llevas ${runtime.carHeld.toFixed(1)} s.` : ""}`,
          done: carDone,
          progress: carDone ? 1 : Math.min(0.95, runtime.carHeld / CAR_HOLD_SECONDS),
        },
      ];
    },

    getState(): AIContext {
      const { current, turns, core } = settings(lastVariables);
      const below = ITEMS.find((i) => i.id === runtime.carried) ?? itemBelow();
      return {
        experimentName: "La grúa electromagnética",
        disciplineName: "Física",
        variables: lastVariables,
        result: {
          iman: runtime.tripped ? "cortado por temperatura" : runtime.magnetOn ? "encendido" : "apagado",
          campo_en_el_polo_T: Number(runtime.field.toFixed(3)),
          fuerza_magnetica_N: Math.round(runtime.force),
          ...(below ? { objeto: below.name, peso_N: Math.round(runtime.weight) } : {}),
          cargando: ITEMS.find((i) => i.id === runtime.carried)?.name ?? "nada",
          resistencia_bobina_ohm: Number((turns * OHMS_PER_TURN).toFixed(2)),
          potencia_W: Math.round(runtime.magnetOn ? current * current * turns * OHMS_PER_TURN : 0),
          temperatura_C: Math.round(runtime.temperature),
          nucleo: core.label,
          en_el_contenedor: runtime.inContainer
            .map((id) => ITEMS.find((i) => i.id === id)?.name)
            .join(", ") || "nada",
          ...(runtime.message ? { aviso: runtime.message } : {}),
        },
        conceptTags: [
          "electroimán",
          "ley de Ampère",
          "solenoide",
          "permeabilidad magnética",
          "materiales ferromagnéticos",
          "efecto Joule",
        ],
      };
    },
  };
}
