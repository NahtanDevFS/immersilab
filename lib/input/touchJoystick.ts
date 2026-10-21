/**
 * Joystick en pantalla, para caminar en el celular sin control
 * (components/shell/TouchJoystick.tsx).
 *
 * Devuelve los ejes con la misma forma que el stick izquierdo del gamepad
 * ({ x, y }, y negativo = adelante), así `MovementController` lo suma como
 * una fuente más, igual que el teclado.
 */

let axes = { x: 0, y: 0 };

export function setJoystickAxes(x: number, y: number) {
  axes = { x, y };
}

export function readJoystick(): { x: number; y: number } {
  return axes;
}

/** Marca de los elementos del joystick: el cursor virtual ignora los toques que empiezan ahí. */
export const JOYSTICK_ATTRIBUTE = "data-touch-joystick";

export function startsOnJoystick(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${JOYSTICK_ATTRIBUTE}]`) !== null;
}
