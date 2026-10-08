/**
 * ¿Ya se vio el tutorial de entrada en este dispositivo? Vive en
 * localStorage y se lee con useSyncExternalStore, así el lobby lo sabe en el
 * primer render del cliente sin un setState en un efecto.
 *
 * Es por dispositivo y no por cuenta a propósito: lo que se enseña (cómo
 * mirar, cómo caminar) depende del aparato, no de quién lo usa.
 */

const KEY = "immersilab.tutorial.v1";
const listeners = new Set<() => void>();
/** Respaldo si localStorage no está disponible. */
let memory = false;

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "visto";
  } catch {
    // Navegación privada o almacenamiento bloqueado: se muestra, y se
    // recuerda en memoria hasta recargar.
    return memory;
  }
}

function write(seen: boolean) {
  memory = seen;
  try {
    if (seen) window.localStorage.setItem(KEY, "visto");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Ver read().
  }
  listeners.forEach((listener) => listener());
}

export function subscribeTutorial(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getTutorialSeen = read;

/** En el servidor no se muestra: el overlay aparece al hidratar. */
export const getTutorialSeenOnServer = () => true;

export const markTutorialSeen = () => write(true);
export const resetTutorial = () => write(false);
