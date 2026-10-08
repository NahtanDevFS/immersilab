"use client";

/**
 * Acceso al control físico, sea USB o Bluetooth.
 *
 * La Gamepad API no distingue entre los dos: un control conectado por cable
 * y uno emparejado por Bluetooth aparecen igual en `navigator.getGamepads()`.
 * Lo que sí cambia entre modelos es el **mapeo**:
 *
 * - `mapping === "standard"`: layout garantizado por la especificación
 *   (DualSense, mandos de Xbox, la mayoría de los modernos por USB o BT).
 *   Stick izquierdo en axes[0..1], derecho en axes[2..3].
 * - `mapping === ""`: el navegador no reconoció el modelo. Pasa seguido con
 *   controles USB genéricos y con adaptadores. Los ejes existen pero en
 *   orden arbitrario — el derecho suele estar en [2,3], y en varios
 *   DirectInput en [3,4].
 *
 * Por eso los índices son configurables y `GamepadStatus` muestra el nombre
 * y el mapeo del control: si un USB genérico mueve la cámara con el stick
 * equivocado, se corrige sin recompilar.
 *
 * Control ESP32 del grupo ("ImmersiLab Control", Bluetooth): Chrome lo reporta
 * SIN mapeo estándar y con 6 ejes [X, Y, Z, Rx, Ry, Rz]. Los que usamos son
 * stick izq = axes[0],[1] y stick der = axes[2],[5] (Rx y Ry quedan fijos).
 * Además los ejes pueden llegar en 0..1 con el reposo en 0.5, así que se
 * normalizan a -1..1. Todo eso está en `readEsp32` más abajo.
 *
 * Botones del ESP32 (índices de buttons[]):
 *   0 principal  → acción: clic / agarrar slider, A siguiente en el tutorial
 *   1 secundario → hablarle al tutor (mantener) · B saltar en el tutorial
 *   2 clic stick izquierdo, 3 clic stick derecho → libres por ahora
 *
 * Overrides (quedan guardados en localStorage):
 *   ?stickL=0,1  ?stickR=2,3   índices de los ejes
 *   ?padDebug=1                muestra ejes y botones en vivo en el badge
 *   ?pad=esp32                 fuerza el perfil del control ESP32 (por si
 *                              Chrome no muestra el nombre "ImmersiLab")
 */

const DEADZONE = 0.15;

// Control ESP32: zona muerta un poco más grande, porque los potenciómetros
// baratos oscilan y un bajón de voltaje mueve todos los ejes a la vez.
const ESP32_DEADZONE = 0.2;
const ESP32_AXES = { lx: 0, ly: 1, rx: 2, ry: 5 };

/**
 * Si al probar el ESP32 un stick va al revés (empujás hacia adelante y
 * retrocede), poné en true el eje que corresponda.
 */
const ESP32_INVERT = { lx: true, ly: true, rx: false, ry: false };

export interface PadAxes {
  x: number;
  y: number;
}

export interface PadState {
  id: string;
  mapping: string;
  /** Stick izquierdo — caminar. */
  left: PadAxes;
  /** Stick derecho — cursor / mirar. */
  right: PadAxes;
  /** Botón de acción (índice 0: X en PlayStation, A en Xbox). */
  action: boolean;
  /** Gatillo derecho (índice 7: R2/RT). Reservado para hablarle al tutor. */
  talk: boolean;
  /** Solo para depuración con controles no estándar. */
  rawAxes: readonly number[];
  rawButtons: readonly boolean[];
}

/**
 * Devuelve el control activo, o null si no hay ninguno.
 *
 * Prefiere uno con mapeo estándar: si hay un USB genérico y un DualSense
 * conectados a la vez, conviene usar el que tiene layout garantizado. Entre
 * dos del mismo tipo, gana el primero.
 *
 * `getGamepads()` devuelve huecos (null) y puede dejar entradas de controles
 * ya desconectados, así que no alcanza con tomar el primer elemento no nulo
 * — hay que mirar `connected` también.
 */
export function getActivePad(): Gamepad | null {
  const pads = Array.from(navigator.getGamepads?.() ?? []).filter(
    (p): p is Gamepad => p !== null && p.connected && p.axes.length >= 2,
  );
  if (pads.length === 0) return null;

  return pads.find((p) => p.mapping === "standard") ?? pads[0];
}

/**
 * Lee el estado del control en este instante. Pensado para llamarse dentro
 * de un useFrame o un requestAnimationFrame — devuelve un objeto plano, no
 * estado de React, para no forzar un re-render por frame.
 */
export function readPad(): PadState | null {
  const pad = getActivePad();
  if (!pad) return null;

  if (isEsp32(pad)) return readEsp32(pad);

  const [lx, ly] = stickIndices("stickL", [0, 1]);
  const [rx, ry] = stickIndices("stickR", defaultRightStick(pad));

  return {
    id: pad.id,
    mapping: pad.mapping || "no estándar",
    left: {
      x: deadzone(pad.axes[lx] ?? 0),
      y: deadzone(pad.axes[ly] ?? 0),
    },
    right: {
      x: deadzone(pad.axes[rx] ?? 0),
      y: deadzone(pad.axes[ry] ?? 0),
    },
    action: pad.buttons[0]?.pressed ?? false,
    talk: pad.buttons[7]?.pressed ?? false,
    rawAxes: pad.axes,
    rawButtons: pad.buttons.map((b) => b.pressed),
  };
}

function deadzone(value: number) {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

// ---------------------------------------------------------------------------
// Control ESP32 del grupo
// ---------------------------------------------------------------------------

const espPads = new Set<string>();

/**
 * Reconoce el control ESP32. Chrome no siempre muestra el nombre que le
 * pusimos en el firmware, así que además del nombre se usa su "firma": sin
 * mapeo estándar, 6 ejes, y en reposo los ejes 0, 1, 2 y 5 valen ~0.5 mientras
 * que el 3 y el 4 valen 0. Un control genérico en reposo no se ve así.
 * Una vez reconocido se recuerda, aunque después muevan los sticks.
 */
function isEsp32(pad: Gamepad): boolean {
  if (pad.mapping === "standard") return false;
  if (readOverride("pad") === "esp32") return true;
  if (pad.id.toLowerCase().includes("immersilab")) return true;

  const key = `${pad.index}:${pad.id}`;
  if (espPads.has(key)) return true;

  if (pad.axes.length === 6) {
    const near = (v: number, target: number) => Math.abs(v - target) < 0.12;
    const [a0, a1, a2, a3, a4, a5] = pad.axes;
    if (
      near(a0, 0.5) &&
      near(a1, 0.5) &&
      near(a2, 0.5) &&
      near(a5, 0.5) &&
      near(a3, 0) &&
      near(a4, 0)
    ) {
      espPads.add(key);
      return true;
    }
  }
  return false;
}

type AxisRange = "unit" | "signed";
const rangeByPad = new Map<string, AxisRange>();

/**
 * Averigua si el control reporta los ejes en 0..1 (reposo ≈ 0.5) o en -1..1
 * (reposo ≈ 0). Se decide una sola vez, mirando el stick izquierdo quieto.
 * Devuelve null si todavía no se puede saber (por ejemplo, si justo lo
 * estaban moviendo al conectar) — mientras tanto los sticks valen 0.
 */
function esp32Range(pad: Gamepad): AxisRange | null {
  const key = `${pad.index}:${pad.id}`;
  const known = rangeByPad.get(key);
  if (known) return known;

  const x = pad.axes[ESP32_AXES.lx] ?? 0;
  const y = pad.axes[ESP32_AXES.ly] ?? 0;
  const near = (v: number, target: number) => Math.abs(v - target) < 0.12;

  let range: AxisRange | null = null;
  if (near(x, 0.5) && near(y, 0.5)) range = "unit";
  else if (near(x, 0) && near(y, 0)) range = "signed";

  if (range) rangeByPad.set(key, range);
  return range;
}

/** Quita la zona muerta y re-escala para que arranque suave desde 0. */
function esp32Deadzone(value: number): number {
  const abs = Math.abs(value);
  if (abs < ESP32_DEADZONE) return 0;
  return Math.sign(value) * Math.min(1, (abs - ESP32_DEADZONE) / (1 - ESP32_DEADZONE));
}

function readEsp32(pad: Gamepad): PadState {
  const range = esp32Range(pad);

  const axis = (index: number, invert: boolean) => {
    if (!range) return 0;
    const raw = pad.axes[index] ?? 0;
    const normalized = range === "unit" ? raw * 2 - 1 : raw;
    return esp32Deadzone(invert ? -normalized : normalized);
  };

  return {
    id: pad.id,
    mapping: "ESP32",
    left: {
      x: axis(ESP32_AXES.lx, ESP32_INVERT.lx),
      y: axis(ESP32_AXES.ly, ESP32_INVERT.ly),
    },
    right: {
      x: axis(ESP32_AXES.rx, ESP32_INVERT.rx),
      y: axis(ESP32_AXES.ry, ESP32_INVERT.ry),
    },
    action: pad.buttons[0]?.pressed ?? false,
    // El ESP32 solo tiene 4 botones (no existe el índice 7 del R2), así que
    // hablarle al tutor es el botón secundario, mantenido.
    talk: pad.buttons[1]?.pressed ?? false,
    rawAxes: pad.axes,
    rawButtons: pad.buttons.map((b) => b.pressed),
  };
}

/**
 * En los controles de mapeo estándar el stick derecho está en [2,3] por
 * especificación. En los que el navegador no reconoce, [2,3] sigue siendo lo
 * más común, pero varios DirectInput con 6 ejes lo ponen en [3,4] — se
 * asume eso como mejor apuesta, y si falla se corrige con ?stickR=.
 */
function defaultRightStick(pad: Gamepad): [number, number] {
  if (pad.mapping === "standard") return [2, 3];
  return pad.axes.length >= 6 ? [3, 4] : [2, 3];
}

function stickIndices(
  key: "stickL" | "stickR",
  fallback: [number, number],
): [number, number] {
  const raw = readOverride(key);
  if (!raw) return fallback;

  const parts = raw.split(",").map((n) => Number.parseInt(n, 10));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return fallback;
  return [parts[0], parts[1]];
}

function readOverride(key: string): string | null {
  if (typeof window === "undefined") return null;

  const fromUrl = new URLSearchParams(window.location.search).get(key);
  if (fromUrl) {
    localStorage.setItem(`immersilab:${key}`, fromUrl);
    return fromUrl;
  }
  return localStorage.getItem(`immersilab:${key}`);
}

export function isPadDebugEnabled(): boolean {
  return readOverride("padDebug") === "1";
}