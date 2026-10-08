import type { AIContext } from "@/types/module";

/**
 * Contrato entre el cliente (VoiceTutor) y `POST /api/tutor`.
 *
 * El historial viaja SOLO como texto y es append-only: cada turno de usuario
 * se guarda exactamente como se mandó (con el estado del experimento
 * incluido) y cada respuesta tal cual llegó. Así el prefijo de la
 * conversación es byte a byte idéntico entre preguntas, que es lo que hace
 * funcionar el caché de prompts.
 */
export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TutorRequest {
  /** Lo que dijo el estudiante, ya transcrito. */
  transcript: string;
  /** Estado actual del experimento (`engine.getState()`). */
  context: AIContext;
  /** Turnos anteriores de esta sesión, en orden. */
  history: TutorTurn[];
  /** Pistas propias del experimento (`ExperimentDefinition.tutorHints`). */
  hints?: string;
}

/** Arma el mensaje de usuario. Lo usan el cliente (para el historial) y el servidor. */
export function formatUserTurn(transcript: string, context: AIContext): string {
  return (
    `[Estado del experimento]\n${JSON.stringify(context)}\n\n` +
    `[Pregunta del estudiante]\n${transcript}`
  );
}

/** Límites duros del endpoint: es público y cada request cuesta plata. */
export const TUTOR_LIMITS = {
  transcriptChars: 600,
  hintsChars: 2000,
  /** Estado del experimento + panel. El más grande (Ondas) ronda 1500. */
  contextChars: 6000,
  historyTurns: 20,
  turnChars: 4000,
} as const;
