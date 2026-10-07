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

  const history = useRef<TutorTurn[]>([]);
  const inFlight = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /** Corta la respuesta en curso (barge-in). No guarda el turno a medias. */
  const abort = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setPending(false);
  }, []);

  const ask = useCallback(
    async (transcript: string) => {
      abort();
      const controller = new AbortController();
      inFlight.current = controller;

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
          for (const sentence of buffer.push(chunk)) onSentence(sentence);
        }
        const rest = buffer.flush();
        if (rest) onSentence(rest);

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
        setFailed(true);
        // Si alcanzó a decir algo, se deja; si no, el mensaje sin conexión.
        if (!text.trim()) {
          const line =
            error instanceof TutorHttpError && error.status === 429
              ? RATE_LIMITED_LINE
              : OFFLINE_LINE;
          setReply(line);
          onSentence(line);
        }
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setPending(false);
        }
      }
    },
    [abort],
  );

  useEffect(() => () => inFlight.current?.abort(), []);

  return { ask, abort, pending, reply, failed };
}
