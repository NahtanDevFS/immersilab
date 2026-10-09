/**
 * Dónde dejó el jugador cada panel de la vista VR (arrastrándolo por su
 * barra). Se guarda en este dispositivo, por panel y no por experimento:
 * quien prefiere las variables arriba a la izquierda las quiere ahí en todos.
 *
 * La posición es una dirección alrededor del cuerpo, en grados: `yaw`
 * (positivo hacia la izquierda, 0 al frente) y `pitch` (positivo hacia
 * arriba, 0 a la altura de los ojos).
 */

export interface PanelPlacement {
  yaw: number;
  pitch: number;
}

const KEY = "immersilab.paneles.v1";

let cache: Record<string, PanelPlacement> | null = null;
let resetVersion = 0;

function load(): Record<string, PanelPlacement> {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, PanelPlacement>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function getPanelPlacement(id: string): PanelPlacement | undefined {
  return load()[id];
}

export function savePanelPlacement(id: string, placement: PanelPlacement) {
  const all = { ...load(), [id]: placement };
  cache = all;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Sin almacenamiento: vale hasta recargar.
  }
}

/** Vuelve todos los paneles a su lugar de siempre. */
export function resetPanelPlacements() {
  cache = {};
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada que borrar.
  }
  resetVersion += 1;
}

export function panelResetVersion(): number {
  return resetVersion;
}

/** Quién se está arrastrando ahora: uno a la vez. */
let dragging: string | null = null;

export function getDraggingPanel(): string | null {
  return dragging;
}

export function setDraggingPanel(id: string | null) {
  dragging = id;
}
