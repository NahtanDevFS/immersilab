import { lobbyDoors } from "./catalog";
import { CORRIDOR_BACK_Z } from "./corridor";

/**
 * Dónde aparece el jugador al volver al lobby: en el centro del pasillo, a la
 * altura de la puerta por la que entró al último experimento. El pasillo es
 * largo y, si siempre se arrancaba en la punta, ir a la puerta de al lado
 * obligaba a recorrerlo entero otra vez.
 *
 * Se guarda en sessionStorage: dura lo que dura la pestaña, así que una
 * visita nueva arranca de nuevo en la entrada.
 */
const KEY = "immersilab:lobby-return";

/** Dónde se arranca si no se viene de ninguna puerta. */
export const LOBBY_START_Z = CORRIDOR_BACK_Z - 2;

export function saveReturnDoor(href: string) {
  try {
    sessionStorage.setItem(KEY, href);
  } catch {
    // Sin almacenamiento (modo privado estricto): se arranca en la entrada.
  }
}

/** La z donde aparecer. En el centro del pasillo (x = 0) la puerta queda a
 *  1.8 m, fuera de su radio de entrada: no se vuelve a entrar sin querer. */
export function readReturnZ(): number {
  try {
    const href = typeof window !== "undefined" ? sessionStorage.getItem(KEY) : null;
    const door = href ? lobbyDoors.find((d) => d.href === href) : undefined;
    return door ? door.position[2] : LOBBY_START_Z;
  } catch {
    return LOBBY_START_Z;
  }
}
