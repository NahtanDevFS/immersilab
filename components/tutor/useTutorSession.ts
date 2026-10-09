"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AIContext } from "@/types/module";
import { SentenceBuffer } from "@/lib/tutor/sentence-buffer";
import { formatUserTurn, type TutorTurn } from "@/lib/tutor/protocol";

/** Lo que se dice si no hay red o el servidor falla: en una defensa, un fallo no puede ser silencioso. */
const OFFLINE_LINE =
  "No me puedo conectar en este momento. Revisa la conexión a internet y vuelve a preguntarme.";

/** Respuesta 429 del endpoint: no es un fallo de red, así que no hay que decir que revise el internet. */
const RATE_LIMITED_LINE =
  "Me hiciste muchas preguntas seguidas. Espera un momento y vuelve a preguntarme.";

/**
 * Un mensaje de la conversación, para mostrarla (la ventana de chat de la
 * PC y el panel de la vista VR). Es aparte del historial que se le manda a
 * Gemini: ese lleva el contexto del experimento en cada turno y no es para
 * leerlo.
 */
export interface ChatMessage {
  id: number;
  /** "event": algo que no dijo nadie (p. ej. "Reto logrado"). */
  role: "user" | "tutor" | "event";
  text: string;
  /** Solo para el tutor: si sigue llegando, si se cortó o si falló. */
  state?: "streaming" | "done" | "interrupted" | "error";
}

let nextMessageId = 1;

class TutorHttpError extends Error {
  constructor(readonly status: number) {
    super(`tutor respondió ${status}`);
  }
}

/**
 * Una conversación con el tutor: historial, request en streaming y corte en
 * oraciones para el TTS.
 *
 * El historial vive en un ref y muere con el componente: cambiar de
 * experimento remonta el shell, así que el tutor arranca con memoria nueva y
 * no arrastra el tiro parabólico a una charla sobre QAM.
 */
export function useTutorSession(options: {
  getContext: () => AIContext;
  hints?: string;
  /** Recibe cada oración completa, en orden, apenas se cierra. */
  onSentence: (sentence: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState("");
  const [failed, setFailed] = useState(false);
  const [log, setLog] = useState<ChatMessage[]>([]);

  const history = useRef<TutorTurn[]>([]);
  const inFlight = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /** La respuesta que se está mostrando ahora, para marcarla si se corta. */
  const streamingId = useRef<number | null>(null);

  /** Corta la respuesta en curso (barge-in). No guarda el turno a medias. */
  const abort = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setPending(false);
    const id = streamingId.current;
    streamingId.current = null;
    if (id !== null) {
      // En la conversación queda lo que alcanzó a decir, marcado como cortado.
      setLog((log) =>
        log
          .filter((m) => m.id !== id || m.text.trim() !== "")
          .map((m) => (m.id === id ? { ...m, state: "interrupted" as const } : m)),
      );
    }
  }, []);

  /**
   * Manda una pregunta al tutor y va hablando la respuesta.
   *
   * `quiet`: para lo que el tutor dice por su cuenta (felicitar un reto), no
   * para preguntas del alumno. Si falla, no dice "no me puedo conectar" ni
   * marca error: nadie preguntó nada, y un aviso de error justo después de
   * festejar un logro arruina el momento.
   */
  const ask = useCallback(
    async (transcript: string, opts?: { quiet?: boolean; event?: string }) => {
      abort();
      const controller = new AbortController();
      inFlight.current = controller;

      // En la conversación: la pregunta tal como se dijo (o, si la pregunta
      // la armó el laboratorio, una línea que diga qué pasó) y la respuesta,
      // que se va llenando mientras llega.
      const replyId = nextMessageId++;
      streamingId.current = replyId;
      setLog((log) => [
        ...log,
        ...(opts?.quiet
          ? opts.event
            ? [{ id: nextMessageId++, role: "event" as const, text: opts.event }]
            : []
          : [{ id: nextMessageId++, role: "user" as const, text: transcript }]),
        { id: replyId, role: "tutor", text: "", state: "streaming" },
      ]);
      const updateReply = (patch: Partial<ChatMessage>) =>
        setLog((log) => log.map((m) => (m.id === replyId ? { ...m, ...patch } : m)));

      const { getContext, hints, onSentence } = optionsRef.current;
      const context = getContext();
      const buffer = new SentenceBuffer();
      let text = "";

      setPending(true);
      setFailed(false);
      setReply("");

      try {
        const response = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            context,
            history: history.current,
            hints,
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new TutorHttpError(response.status);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          text += chunk;
          setReply(text);
          updateReply({ text });
          for (const sentence of buffer.push(chunk)) onSentence(sentence);
        }
        const rest = buffer.flush();
        if (rest) onSentence(rest);
        updateReply({ state: "done" });

        // Se guarda exactamente lo que se mandó y lo que llegó: el prefijo
        // queda idéntico en la próxima pregunta y el caché lo aprovecha.
        if (text.trim()) {
          history.current.push(
            { role: "user", content: formatUserTurn(transcript, context) },
            { role: "assistant", content: text },
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        // Manejado: se avisa por voz. warn y no error para no disparar el
        // overlay de Next en desarrollo.
        console.warn("[tutor]", error);
        if (opts?.quiet) {
          setLog((log) => log.filter((m) => m.id !== replyId || m.text.trim() !== ""));
          return;
        }
        setFailed(true);
        // Si alcanzó a decir algo, se deja; si no, el mensaje sin conexión.
        if (!text.trim()) {
          const line =
            error instanceof TutorHttpError && error.status === 429
              ? RATE_LIMITED_LINE
              : OFFLINE_LINE;
          setReply(line);
          onSentence(line);
          updateReply({ text: line, state: "error" });
        } else {
          updateReply({ state: "interrupted" });
        }
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setPending(false);
        }
        if (streamingId.current === replyId) streamingId.current = null;
      }
    },
    [abort],
  );

  useEffect(() => () => inFlight.current?.abort(), []);

  return { ask, abort, pending, reply, failed, log };
}
