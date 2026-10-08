/**
 * Canal de eventos entre el HUD de retos y el tutor por voz.
 *
 * Son componentes hermanos dentro del shell y ninguno debería conocer al
 * otro: el HUD avisa que se logró un reto y el tutor decide si lo comenta.
 * Un emisor mínimo alcanza; no hace falta estado global.
 */

export interface ChallengeCompletedEvent {
  experimentSlug: string;
  challengeId: string;
  title: string;
  /** Instrucción o resultado del reto, tal como lo muestra el HUD. */
  detail: string;
}

type Listener = (event: ChallengeCompletedEvent) => void;

const listeners = new Set<Listener>();

export function onChallengeCompleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitChallengeCompleted(event: ChallengeCompletedEvent): void {
  listeners.forEach((listener) => listener(event));
}
