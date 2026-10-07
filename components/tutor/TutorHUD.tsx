"use client";

import type { SpeechInputError } from "./useSpeechInput";
import styles from "./TutorHUD.module.css";

export type TutorStatus = "idle" | "listening" | "thinking" | "speaking";

const STATUS_LABEL: Record<TutorStatus, string> = {
  idle: "Mantén presionado para preguntar · R2",
  listening: "Te escucho…",
  thinking: "Pensando…",
  speaking: "Hablando · R2 para cortar",
};

const ERROR_LABEL: Record<Exclude<SpeechInputError, null>, string> = {
  "not-allowed": "Permite el micrófono para hablarle al tutor.",
  network: "El reconocimiento de voz necesita internet.",
  other: "No te entendí, prueba otra vez.",
};

interface Props {
  status: TutorStatus;
  heard: string;
  reply: string;
  supported: boolean;
  inputError: SpeechInputError;
  offline: boolean;
  onPress: () => void;
  onRelease: () => void;
  onToggle: () => void;
}

/**
 * Anillo de estado + subtítulos del tutor — PLAN_DESARROLLO.md §4.4.
 *
 * En un visor, sin retroalimentación visual el usuario no sabe si el sistema
 * lo oyó: el anillo cambia de color en cada estado (gris inactivo, azul
 * escuchando, ámbar pensando, teal hablando). Los subtítulos sirven para
 * salones ruidosos y para que el jurado siga la conversación.
 *
 * Va abajo al centro y angosto: fuera del 15% exterior de la pantalla, que
 * en un visor queda fuera del campo visual cómodo.
 */
export function TutorHUD({
  status,
  heard,
  reply,
  supported,
  inputError,
  offline,
  onPress,
  onRelease,
  onToggle,
}: Props) {
  const note = !supported
    ? "Este navegador no reconoce voz: abre el laboratorio en Chrome."
    : inputError
      ? ERROR_LABEL[inputError]
      : null;

  return (
    <div className={styles.hud} data-status={status}>
      {(heard || reply) && (
        <div className={styles.subtitles} aria-live="polite">
          {heard && (
            <p className={styles.heard}>
              <span className={styles.speaker}>Tú</span> {heard}
            </p>
          )}
          {reply && (
            <p className={styles.reply} data-offline={offline}>
              <span className={styles.speaker}>Tutor</span> {reply}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.talk}
        disabled={!supported}
        aria-pressed={status === "listening"}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          // Captura: si el dedo se desliza fuera del botón, soltar igual corta.
          event.currentTarget.setPointerCapture(event.pointerId);
          onPress();
        }}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onClick={(event) => {
          // detail === 0: click sin puntero real (cursor virtual del visor o
          // teclado). No hay "mantener" posible, así que alterna.
          if (event.detail === 0) onToggle();
        }}
      >
        <span className={styles.ring} aria-hidden />
        <span className={styles.label}>{STATUS_LABEL[status]}</span>
      </button>

      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
