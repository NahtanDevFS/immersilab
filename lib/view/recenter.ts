/**
 * Centrar la vista con giroscopio.
 *
 * El giroscopio da el rumbo de la brújula: sin corregirlo, el jugador
 * aparecía mirando hacia donde quedara "su norte" en la escena, a veces de
 * espaldas al experimento (solo árboles). GyroCamera corrige ese rumbo al
 * entrar para quedar de frente al experimento, y otra vez cada vez que se
 * pide (botón "Centrar la vista" o clic del stick izquierdo).
 *
 * Al centrar, los paneles (BodyAnchor) se acomodan de inmediato al nuevo
 * frente: si no, quedaban donde estaba el frente anterior.
 */

let requested = 0;
let alignment = { version: 0, yaw: 0 };

/** Pide volver a centrar la vista hacia el experimento. */
export function requestRecenter() {
  requested += 1;
  uiPitch = 0;
}

export function recenterRequests(): number {
  return requested;
}

/** GyroCamera avisa hacia dónde quedó el frente después de centrar. */
export function publishAlignment(yaw: number) {
  alignment = { version: alignment.version + 1, yaw };
}

export function currentAlignment(): { version: number; yaw: number } {
  return alignment;
}

/*
 * Altura de la interfaz en la vista VR (grados). Con el stick derecho hacia
 * arriba o abajo se sube o se baja todo lo que acompaña al cuerpo (paneles,
 * tarjetas), como agacharse o elevarse: así se llega a la parte de abajo de
 * un cuadro alto sin torcer el cuello. Centrar la vista la vuelve a 0.
 */
let uiPitch = 0;
export const UI_PITCH_LIMIT = 45;

export function getUiPitch(): number {
  return uiPitch;
}

export function nudgeUiPitch(degrees: number) {
  uiPitch = Math.max(-UI_PITCH_LIMIT, Math.min(UI_PITCH_LIMIT, uiPitch + degrees));
}
