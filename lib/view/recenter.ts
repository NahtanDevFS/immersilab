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
