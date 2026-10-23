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
 * Hay dos versiones del firmware (firmware/control_immersilab):
 *   v1: 4 botones, ejes 0..32767. Android estricto (Motorola, Poco/HyperOS)
 *       se conecta pero descarta todo; solo Samsung y la compu lo leen.
 *   v2: mando estándar: 16 botones (clics de los sticks en el 14 y el 15),
 *       ejes -32767..32767 y una cruceta. En la compu llega SIN mapeo
 *       estándar (clics en buttons[13] y [14]); en Android, el sistema lo
 *       traduce a un mando estándar (mapping "standard", sticks en
 *       axes[0..3], clics en buttons[10] y [11]). Algunos Android lo dejan
 *       sin mapeo estándar pero con solo 4 ejes: los sticks también van en
 *       axes[0..3] (medido con el modo diagnóstico, 2026-10-20).
 * `readEsp32` devuelve siempre los botones en el mismo orden (principal,
 * secundario, clic izq, clic der), así el resto de la app no distingue.
 *
 * Botones del ESP32 (índices de buttons[]):
 *   0 principal  → acción: clic / agarrar slider, A siguiente en el tutorial
 *   1 secundario → hablarle al tutor (mantener) · B saltar en el tutorial
 *                  B + A (A apretado con B mantenido) → cancelar la pregunta
 *   Stick izquierdo a fondo ~0.5 s → correr (MovementController).
 *   Stick derecho arriba/abajo, en la vista VR o en la compu → subir o bajar
 *                            la cámara (MovementController).
 *   2 clic stick izquierdo → centrar la vista hacia el experimento
 *                            (X / cuadrado en un control estándar)
 *   3 clic stick derecho   → en el celular, fuera del visor: entrar al visor.
 *                            Dentro del visor: mostrar u ocultar los paneles
 *                            (es el mismo índice que la Y de un control
 *                            estándar, así funciona igual en los dos)
 *
 * Overrides (quedan guardados en localStorage):
 *   ?stickL=0,1  ?stickR=2,3   índices de los ejes
 *   ?padDebug=1                muestra ejes y botones en vivo en el badge
 *   ?pad=esp32                 fuerza el perfil del control ESP32 (por si
 *                              Chrome no muestra el nombre "ImmersiLab")
 */

/**
 * Versión de cómo se lee el control. El modo diagnóstico la manda con cada
 * lectura: así se ve si el celular ya tiene el último arreglo o sigue con la
 * página vieja en memoria. Subirla cada vez que cambia la lectura de ejes.
 */
export const PAD_READER_VERSION = "ESP32 reconocido en la compu por e502/bbab (2026-10-22)";

const DEADZONE = 0.15;

// Control ESP32: zona muerta un poco más grande, porque los potenciómetros
// baratos oscilan y un bajón de voltaje mueve todos los ejes a la vez.
const ESP32_DEADZONE = 0.2;
const ESP32_AXES = { lx: 0, ly: 1, rx: 2, ry: 5 };

/**
 * Si al probar el ESP32 un stick va al revés (empujas hacia adelante y
 * retrocede), pon en true el eje que corresponda.
 *
 * Los dos sticks están montados igual en la placa, así que se invierten los
 * dos igual. El derecho estaba sin invertir: en el visor, el stick a la
 * derecha bajaba el valor de la variable y a la izquierda lo subía.
 */
const ESP32_INVERT = { lx: true, ly: true, rx: true, ry: true };

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
  /**
   * Hablarle al tutor: B en el control ImmersiLab, gatillo derecho (índice 7:
   * R2/RT) en uno estándar.
   */
  talk: boolean;
  /**
   * A apretado mientras se mantiene `talk`: cancelar la pregunta. Mientras
   * dura, `action` se informa en false (ver `applyTalkCancel`).
   */
  cancelTalk: boolean;
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
  return applyTalkCancel(isEsp32(pad) ? readEsp32(pad) : readStandard(pad));
}

// ---------------------------------------------------------------------------
// Cancelar la pregunta al tutor: B + A
// ---------------------------------------------------------------------------

/** Cuántos tutores montados pidieron el combo (fuera de un experimento, no aplica). */
let talkCancelUsers = 0;
let cancelPrevAction = false;
let cancelLatched = false;

/**
 * Activa el combo B + A mientras haya un tutor montado. Devuelve la función
 * para desactivarlo.
 */
export function enableTalkCancel(): () => void {
  talkCancelUsers++;
  return () => {
    talkCancelUsers--;
    cancelLatched = false;
  };
}

/**
 * A es el "tocar" del cursor y de la mirilla del visor. Si se aprieta
 * MIENTRAS se mantiene B, es "cancelar la pregunta" y nadie más debe verlo:
 * si no, además de cancelar, tocaría lo que quedó bajo el cursor. Por eso se
 * filtra acá, que es por donde pasan todos los que leen A.
 *
 * - Cuenta solo un A que arranca con B ya apretado. Si A ya estaba apretado
 *   (agrandando un panel) y después se aprieta B, A sigue siendo A.
 * - El A del combo queda tapado hasta que se suelta, aunque B se suelte
 *   antes: si no, soltar B primero lo convertía en un toque.
 *
 * Se llama varias veces por frame (cada componente lee el control): solo
 * cambia de estado en los flancos de A, así que da lo mismo cuántas.
 */
function applyTalkCancel(state: PadState): PadState {
  if (talkCancelUsers === 0) return state;
  const a = state.action;
  if (a && !cancelPrevAction && state.talk) cancelLatched = true;
  if (!a) cancelLatched = false;
  cancelPrevAction = a;
  return cancelLatched ? { ...state, action: false, cancelTalk: true } : state;
}

function readStandard(pad: Gamepad): PadState {
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
    // B mantenido (como en el control ImmersiLab, que es lo que dice la
    // ayuda) o el gatillo derecho (R2 / RT / ZR).
    talk: (pad.buttons[1]?.pressed ?? false) || (pad.buttons[7]?.pressed ?? false),
    cancelTalk: false,
    rawAxes: pad.axes,
    rawButtons: standardButtons(pad),
  };
}

/**
 * Los botones de un mando estándar, con los clics de los sticks sumados a
 * los botones que hacen lo mismo en el control ImmersiLab: el clic del
 * izquierdo (10) también centra la vista (X, índice 2) y el del derecho (11)
 * también muestra u oculta los paneles (Y, índice 3). Así la ayuda en
 * pantalla vale para cualquier mando. Probado con un mando Pro de Switch en
 * iPhone (iOS respeta las letras de Nintendo: A=0, B=1, X=2, Y=3).
 */
function standardButtons(pad: Gamepad): boolean[] {
  const buttons = pad.buttons.map((b) => b.pressed);
  if (pad.mapping !== "standard") return buttons;
  buttons[2] = buttons[2] || (buttons[10] ?? false);
  buttons[3] = buttons[3] || (buttons[11] ?? false);
  return buttons;
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
  // Por nombre, antes que por mapeo: en Android el firmware v2 llega como
  // mando estándar y hay que reconocerlo igual.
  const id = pad.id.toLowerCase();
  if (id.includes("immersilab")) return true;
  if (pad.mapping === "standard") return false;
  // En la compu (Windows) Chrome no muestra el nombre: llega como "Unknown
  // Gamepad (Vendor: e502 Product: bbab)", los códigos que pone la librería
  // BLE del firmware. Sin esto se leía como un control genérico: sin la
  // inversión de ejes (el stick izquierdo iba al revés) y con el derecho en
  // axes[3] y [4], que no se mueven (el firmware lo manda en Z y Rz, que en
  // la compu son axes[2] y [5]). Medido con el modo diagnóstico, 2026-10-22.
  if (id.includes("vendor: e502") && id.includes("product: bbab")) return true;
  if (readOverride("pad") === "esp32") return true;

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
function esp32Range(pad: Gamepad, axes: typeof ESP32_AXES): AxisRange | null {
  const key = `${pad.index}:${pad.id}`;
  const known = rangeByPad.get(key);
  if (known) return known;

  const x = pad.axes[axes.lx] ?? 0;
  const y = pad.axes[axes.ly] ?? 0;
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

/** Ejes del firmware v2 en Android (traducido a mando estándar). */
const ESP32_STANDARD_AXES = { lx: 0, ly: 1, rx: 2, ry: 3 };

function readEsp32(pad: Gamepad): PadState {
  const standard = pad.mapping === "standard";
  // Con 4 ejes no hay Rz (axes[5]): el stick derecho va en axes[2] y [3]. Sin
  // esto, en esos celulares su eje vertical valía siempre 0 y el stick
  // derecho no subía ni bajaba la cámara.
  const axes = standard || pad.axes.length < 6 ? ESP32_STANDARD_AXES : ESP32_AXES;
  const range = esp32Range(pad, axes);

  const axis = (index: number, invert: boolean) => {
    if (!range) return 0;
    const raw = pad.axes[index] ?? 0;
    const normalized = range === "unit" ? raw * 2 - 1 : raw;
    return esp32Deadzone(invert ? -normalized : normalized);
  };

  // Botones en orden fijo: principal, secundario, clic izq, clic der.
  const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
  const [clickLeft, clickRight] = standard
    ? [pressed(10), pressed(11)] // v2 en Android
    : pad.buttons.length >= 15
      ? [pressed(13), pressed(14)] // v2 en la compu
      : [pressed(2), pressed(3)]; // v1
  const buttons = [pressed(0), pressed(1), clickLeft, clickRight];

  return {
    id: pad.id,
    mapping: "ESP32",
    left: {
      x: axis(axes.lx, ESP32_INVERT.lx),
      y: axis(axes.ly, ESP32_INVERT.ly),
    },
    right: {
      x: axis(axes.rx, ESP32_INVERT.rx),
      y: axis(axes.ry, ESP32_INVERT.ry),
    },
    action: buttons[0],
    // El ESP32 no tiene R2 (índice 7), así que hablarle al tutor es el botón
    // secundario, mantenido.
    talk: buttons[1],
    cancelTalk: false,
    rawAxes: pad.axes,
    rawButtons: buttons,
  };
}

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