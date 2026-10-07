"use client";

/**
 * Teclado como fuente de movimiento, para jugar desde la computadora.
 *
 * WASD o flechas para caminar, Shift para correr. Devuelve los ejes con la
 * misma forma que el stick izquierdo del gamepad ({ x, y }, y negativo =
 * adelante), así `MovementController` los suma sin distinguir de dónde
 * vienen.
 *
 * Se guarda por `code` (posición física) y no por `key`: en un teclado
 * AZERTY o con Bloq Mayús, `key` cambia; la tecla física de la W no.
 */

const pressed = new Set<string>();
let listeners = 0;

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const MOVEMENT = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT]);
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * ¿Esta tecla le pertenece al elemento con foco y no al movimiento?
 *
 * Escribir en un campo de texto nunca camina. En un slider o un select, las
 * flechas ya ajustan el valor — si además caminaran, mover un slider con el
 * teclado te sacaría de la escena; WASD en cambio sí camina, porque un
 * slider no las usa.
 */
function belongsToFocusedField(event: KeyboardEvent): boolean {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  if (target instanceof HTMLSelectElement) return ARROWS.has(event.code);
  if (target instanceof HTMLInputElement) {
    return target.type === "range" ? ARROWS.has(event.code) : true;
  }
  return false;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (belongsToFocusedField(event)) return;
  pressed.add(event.code);
  // Que las flechas no scrolleen la página mientras caminas.
  if (MOVEMENT.has(event.code)) event.preventDefault();
}

function onKeyUp(event: KeyboardEvent) {
  pressed.delete(event.code);
}

/** Al cambiar de pestaña no llega el keyup: sin esto, el jugador sigue caminando solo. */
function releaseAll() {
  pressed.clear();
}

/** Empieza a escuchar el teclado. Devuelve la función que deja de escuchar. */
export function attachKeyboard(): () => void {
  if (listeners === 0) {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
  }
  listeners += 1;

  return () => {
    listeners -= 1;
    if (listeners === 0) {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    }
  };
}

const isDown = (codes: string[]) => codes.some((code) => pressed.has(code));

/** Ejes de movimiento del teclado, normalizados (en diagonal no se camina más rápido). */
export function readKeyboard(): { x: number; y: number; run: boolean } {
  let x = (isDown(RIGHT) ? 1 : 0) - (isDown(LEFT) ? 1 : 0);
  let y = (isDown(BACK) ? 1 : 0) - (isDown(FORWARD) ? 1 : 0);
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return {
    x,
    y,
    run: pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
  };
}
