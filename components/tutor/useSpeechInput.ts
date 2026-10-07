"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Entrada de voz (STT) sobre la Web Speech API — PLAN_DESARROLLO.md §4.2.
 *
 * Push-to-talk: `start()` al apretar, `stop()` al soltar. El texto final se
 * entrega por `onFinal` recién cuando el reconocedor cierra (`onend`), porque
 * las últimas palabras suelen llegar DESPUÉS de llamar a `stop()`.
 *
 * Privacidad (para la tesis): en Chrome de escritorio el audio se manda a
 * servidores de Google para transcribirlo; en Android se reconoce en el
 * dispositivo.
 *
 * Todo queda detrás de este hook: si la calidad no alcanza, se cambia la
 * implementación (p. ej. Whisper en el servidor) sin tocar el resto.
 */

// lib.dom de TypeScript no declara el constructor; esto es lo mínimo que se usa.
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function subscribeNever() {
  return () => {};
}

export type SpeechInputError = "not-allowed" | "network" | "other" | null;

export function useSpeechInput(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(
    subscribeNever,
    () => getRecognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<SpeechInputError>(null);

  const recognition = useRef<RecognitionLike | null>(null);
  const finalText = useRef("");
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognition.current) return;

    const rec = new Ctor();
    // es-GT existe en Chrome; si el motor no lo tiene, cae a español genérico.
    rec.lang = "es-GT";
    // Continuo: mientras el gatillo esté apretado, una pausa para pensar no
    // corta la grabación.
    rec.continuous = true;
    rec.interimResults = true;

    finalText.current = "";
    setTranscript("");
    setError(null);

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript((finalText.current + interim).trim());
    };
    rec.onerror = (event) => {
      // "no-speech" y "aborted" son normales (soltó sin hablar, barge-in).
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "not-allowed"
          : event.error === "network"
            ? "network"
            : "other",
      );
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
      onFinalRef.current(finalText.current.trim());
    };

    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() tira si ya hay otro reconocimiento en curso.
      recognition.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognition.current;
      if (!rec) return;
      rec.onend = null;
      rec.abort();
    };
  }, []);

  return { supported, listening, transcript, error, start, stop };
}
