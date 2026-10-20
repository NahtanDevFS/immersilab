"use client";

import { useEffect, useRef, useState } from "react";
import type { SpeechInputError } from "./useSpeechInput";
import type { ChatMessage } from "./useTutorSession";
import { setChatOpen, useChatOpen } from "@/lib/tutor/chatPreference";
import { splitFormulas } from "@/lib/tutor/formula";
import styles from "./TutorHUD.module.css";

export type TutorStatus = "idle" | "listening" | "thinking" | "speaking";

const STATUS_LABEL: Record<TutorStatus, string> = {
  idle: "Mantén presionado para preguntar · botón B",
  listening: "Te escucho… · toca para terminar",
  thinking: "Pensando…",
  speaking: "Hablando · B para cortar",
};

const CANCEL_LABEL: Record<Exclude<TutorStatus, "idle">, string> = {
  listening: "Cancelar la pregunta",
  thinking: "Cancelar la respuesta",
  speaking: "Callar al tutor",
};

export const ERROR_LABEL: Record<Exclude<SpeechInputError, null>, string> = {
  "not-allowed": "Permite el micrófono para hablarle al tutor.",
  network: "El reconocimiento de voz necesita internet.",
  other: "No te entendí, prueba otra vez.",
};

/**
 * Cuánto quedan los subtítulos en pantalla después de que el tutor termina
 * (con la conversación minimizada). Lo suficiente para releer la última
 * frase; quedarse para siempre tapaba la escena justo en el centro.
 */
const SUBTITLE_LINGER_MS = 8000;

/**
 * Un toque más corto que esto es un clic, no "mantener": deja escuchando
 * hasta el próximo toque. Antes un clic corto mandaba "parar" enseguida y,
 * si llegaba antes de que el micrófono arrancara, quedaba escuchando solo.
 */
const TAP_MS = 350;

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
  /** Descarta lo dicho, corta la respuesta y calla la voz. */
  onCancel: () => void;
  /** La conversación entera, para la ventana desplegable. */
  log: ChatMessage[];
}

/**
 * Anillo de estado + conversación con el tutor — PLAN_DESARROLLO.md §4.4.
 *
 * En un visor, sin retroalimentación visual el usuario no sabe si el sistema
 * lo oyó: el anillo cambia de color en cada estado (gris inactivo, azul
 * escuchando, ámbar pensando, teal hablando).
 *
 * La conversación es una ventana desplegable, como un chat, pero por voz:
 * - Abierta: todo lo que se preguntó y se respondió en este experimento,
 *   con lo que se está diciendo ahora al final.
 * - Minimizada: una pastilla con la cantidad de mensajes y, mientras el
 *   tutor responde, los subtítulos de esa respuesta (se van solos).
 * Antes solo había subtítulos: al cerrarlos o al pasar unos segundos, lo que
 * había dicho el tutor no se podía volver a leer.
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
  onCancel,
  log,
}: Props) {
  const open = useChatOpen();

  // Subtítulos (solo con la conversación minimizada): se ocultan solos un
  // rato después de terminar, o con la ✕. Se recuerda QUÉ texto se ocultó:
  // una pregunta nueva trae texto nuevo y vuelve a mostrarse sola.
  const shown = heard || reply ? `${heard}\u0000${reply}` : "";
  const [hidden, setHidden] = useState("");
  const subtitlesVisible = !open && shown !== "" && shown !== hidden;

  useEffect(() => {
    if (!subtitlesVisible || status !== "idle") return;
    const id = window.setTimeout(() => setHidden(shown), SUBTITLE_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [subtitlesVisible, status, shown]);

  // Mantener: escucha mientras está apretado. Toque corto: alterna. Si ya
  // estaba escuchando, apretar es para terminar (y el soltar no hace nada más).
  const pressedAt = useRef(0);
  const pressStopped = useRef(false);

  const note = !supported
    ? "Este navegador no reconoce voz: abre el laboratorio en Chrome."
    : inputError
      ? ERROR_LABEL[inputError]
      : null;

  return (
    <div className={styles.hud} data-status={status} data-open={open}>
      {open ? (
        <Conversation log={log} heard={status === "listening" ? heard : ""} onMinimize={() => setChatOpen(false)} />
      ) : (
        <>
          {subtitlesVisible && (
            <div className={styles.subtitles} aria-live="polite">
              <button
                type="button"
                className={styles.close}
                onClick={() => setHidden(shown)}
                aria-label="Ocultar los subtítulos"
              >
                ✕
              </button>
              {heard && (
                <p className={styles.heard}>
                  <span className={styles.speaker}>Tú</span> {heard}
                </p>
              )}
              {reply && (
                <p className={styles.reply} data-offline={offline}>
                  <span className={styles.speaker}>Tutor</span> <ReplyText text={reply} />
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.talk}
          disabled={!supported}
          aria-pressed={status === "listening"}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            // Captura: si el dedo se desliza fuera del botón, soltar igual corta.
            event.currentTarget.setPointerCapture(event.pointerId);
            pressedAt.current = Date.now();
            pressStopped.current = status === "listening";
            if (pressStopped.current) onRelease();
            else onPress();
          }}
          onPointerUp={() => {
            if (pressStopped.current) return;
            // Toque corto: sigue escuchando hasta el próximo toque.
            if (Date.now() - pressedAt.current < TAP_MS) return;
            onRelease();
          }}
          onPointerCancel={() => {
            if (!pressStopped.current) onRelease();
          }}
          onClick={(event) => {
            // detail === 0: click sin puntero real (cursor virtual del visor o
            // teclado). No hay "mantener" posible, así que alterna.
            if (event.detail === 0) onToggle();
          }}
        >
          <span className={styles.ring} aria-hidden />
          <span className={styles.label}>{STATUS_LABEL[status]}</span>
        </button>

        {/* Solo mientras el tutor está en algo. Con el botón de hablar
            mantenido con el mouse no se puede tocar: para eso está Escape. */}
        {status !== "idle" && (
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            aria-label={CANCEL_LABEL[status]}
            title={`${CANCEL_LABEL[status]} (Esc)`}
          >
            ✕
          </button>
        )}

        {!open && (
          <button
            type="button"
            className={styles.chatToggle}
            onClick={() => setChatOpen(true)}
            aria-label="Ver la conversación con el tutor"
          >
            Conversación{log.length > 0 ? ` (${countTurns(log)})` : ""}
          </button>
        )}
      </div>

      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}

/**
 * Una respuesta del tutor, con cada fórmula ([[...]], ver lib/tutor/formula.ts)
 * en su propio renglón para que se pueda leer.
 */
function ReplyText({ text }: { text: string }) {
  return (
    <>
      {splitFormulas(text).map((part, i) =>
        part.kind === "formula" ? (
          <span key={i} className={styles.formula}>
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

/** Cuántas preguntas y respuestas hay (sin contar los avisos de retos). */
function countTurns(log: ChatMessage[]): number {
  return log.filter((m) => m.role !== "event").length;
}

const STATE_NOTE: Partial<Record<NonNullable<ChatMessage["state"]>, string>> = {
  interrupted: " (cortado)",
};

/** La ventana de la conversación, abierta. Se mantiene abajo de todo al llegar texto nuevo. */
function Conversation({
  log,
  heard,
  onMinimize,
}: {
  log: ChatMessage[];
  /** Lo que se está diciendo ahora (mientras escucha), como un mensaje más. */
  heard: string;
  onMinimize: () => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const last = log[log.length - 1];

  // Abajo de todo cuando llega algo nuevo (o crece la respuesta en curso).
  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [log.length, last?.text, heard]);

  return (
    <section className={styles.chat} aria-label="Conversación con el tutor">
      <header className={styles.chatHeader}>
        <span className={styles.chatTitle}>Conversación con el tutor</span>
        <button type="button" className={styles.minimize} onClick={onMinimize}>
          Minimizar
        </button>
      </header>
      <ol className={styles.chatList} ref={list} aria-live="polite">
        {log.length === 0 && !heard && (
          <li className={styles.chatEmpty}>
            Todavía no le has preguntado nada. Mantén presionado este botón (o B en el control), pregunta en voz alta
            y suelta: la conversación queda aquí.
          </li>
        )}
        {log.map((m) =>
          m.role === "event" ? (
            <li key={m.id} className={styles.chatEvent}>
              {m.text}
            </li>
          ) : (
            <li key={m.id} className={styles.chatMessage} data-role={m.role} data-state={m.state}>
              <span className={styles.speaker}>{m.role === "user" ? "Tú" : "Tutor"}</span>
              {m.role === "tutor" && m.text ? <ReplyText text={m.text} /> : m.text || (m.state === "streaming" ? "…" : "")}
              {m.state ? STATE_NOTE[m.state] : null}
            </li>
          ),
        )}
        {heard && (
          <li className={styles.chatMessage} data-role="user" data-state="streaming">
            <span className={styles.speaker}>Tú</span>
            {heard}
          </li>
        )}
      </ol>
    </section>
  );
}
