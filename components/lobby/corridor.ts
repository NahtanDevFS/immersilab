/**
 * Medidas del pasillo del lobby.
 *
 * Están en su propio archivo porque las usan tres piezas que si no se
 * desincronizan: la escena (paredes, techo, luminarias), el catálogo (dónde
 * cae cada puerta) y los colisionadores (contra qué choca el jugador).
 *
 * El pasillo reemplazó a la sala cuadrada de 20×20. Una sala grande con las
 * puertas repartidas en las paredes obliga a girar sobre uno mismo para ver
 * qué hay, y en un visor barato eso marea. Un pasillo tiene una dirección
 * obvia: se camina hacia adelante y las puertas van apareciendo a los lados.
 */

/** Ancho total del pasillo. 3.6 m es angosto para que las dos paredes entren
 *  en el campo visual a la vez, que es lo que da la sensación de corredor. */
export const CORRIDOR_WIDTH = 3.6;
export const CORRIDOR_HALF_W = CORRIDOR_WIDTH / 2;
export const CORRIDOR_HEIGHT = 3.1;

/** Z de la primera puerta y separación entre pares. La cámara arranca en
 *  z=+6 mirando hacia -Z, así que las puertas van hacia el fondo. */
export const FIRST_DOOR_Z = 1.5;
export const DOOR_SPACING = 5;

/** Hasta dónde llega el pasillo por detrás del jugador. */
export const CORRIDOR_BACK_Z = 8;

export const DOOR_WIDTH = 1.05;
export const DOOR_HEIGHT = 2.25;

/**
 * Dónde va la puerta número `index`: se alternan izquierda y derecha, como en
 * un pasillo real, y cada par avanza `DOOR_SPACING` hacia el fondo.
 *
 * Al derivarlo del índice, agregar un experimento al catálogo le da su lugar
 * sin tener que elegir coordenadas a mano ni revisar que no pise otra puerta.
 */
export function doorPlacement(index: number): {
  position: [number, number, number];
  rotationY: number;
} {
  const side = index % 2 === 0 ? -1 : 1; // par → izquierda, impar → derecha
  const pair = Math.floor(index / 2);
  const z = FIRST_DOOR_Z - pair * DOOR_SPACING;

  return {
    // Un pelo por dentro de la pared, para que la hoja no z-pelee con ella.
    position: [side * (CORRIDOR_HALF_W - 0.02), 0, z],
    // Las puertas miran hacia el centro del pasillo.
    rotationY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
  };
}

/** Fondo del pasillo, calculado desde la última puerta. */
export function corridorEndZ(doorCount: number): number {
  const pairs = Math.max(1, Math.ceil(doorCount / 2));
  return FIRST_DOOR_Z - (pairs - 1) * DOOR_SPACING - 5;
}
