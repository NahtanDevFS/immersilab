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
 * Overrides (quedan guardados en localStorage):
 *   ?stickL=0,1  ?stickR=2,3   índices de los ejes
 *   ?padDebug=1                muestra ejes y botones en vivo en el badge
 */

const DEADZONE = 0.15;

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
