"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TUTOR_LIMITS } from "@/lib/tutor/protocol";

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
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

/**
 * Tope de una grabación. Es continua (una pausa para pensar no la corta), así
 * que si el "soltar" se pierde, sin esto quedaría escuchando para siempre.
 */
const MAX_LISTEN_MS = 30000;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Arma el texto de todos los resultados, desde cero en cada evento.
 *
 * Chrome en Android, en modo continuo, no entrega pedazos nuevos sino el
 * texto ACUMULADO: "hola", "hola cómo", "hola cómo estás", cada uno como un
 * resultado final aparte. Sumándolos (como hace Chrome de escritorio, donde
 * cada resultado sí es un pedazo nuevo) cada palabra salía repetida muchas
 * veces, y la pregunta se inflaba hasta que el servidor la rechazaba.
 *
 * Aquí, si un resultado arranca casi igual que el anterior (Android corrige
 * palabras al ir acumulando: "ola" y después "hola cómo"), es la misma frase
 * creciendo y se queda la versión más larga. Si arranca distinto, es una
 * frase nueva y se suma: sirve igual en los dos navegadores.
 */
function joinResults(results: SpeechRecognitionResultList): { final: string; all: string } {
  const parts: Array<{ text: string; final: boolean }> = [];
  for (let i = 0; i < results.length; i++) {
    const text = results[i][0].transcript.trim();
    if (!text) continue;
    const last = parts[parts.length - 1];
    if (last && sameSentence(last.text, text)) {
      const longer = text.length >= last.text.length ? text : last.text;
      parts[parts.length - 1] = { text: longer, final: last.final || results[i].isFinal };
    } else {
      parts.push({ text, final: results[i].isFinal });
    }
  }
  const clamp = (t: string) => t.slice(0, TUTOR_LIMITS.transcriptChars).trim();
  return {
    final: clamp(parts.filter((p) => p.final).map((p) => p.text).join(" ")),
    all: clamp(parts.map((p) => p.text).join(" ")),
  };
}

/** ¿`b` es la misma frase que `a`, más larga o corregida? Comparten casi
 *  todo el comienzo del más corto. */
function sameSentence(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const shorter = Math.min(x.length, y.length);
  let common = 0;
  while (common < shorter && x[common] === y[common]) common++;
  // Una corrección en la primera letra ("ola" → "hola") corre todo un lugar.
  if (common === 0 && (x.slice(1) === y.slice(0, x.length - 1) || y.slice(1, x.length + 1) === x)) return true;
  return common >= Math.max(3, shorter * 0.6);
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
  /** Ya arrancó de verdad (llegó `onstart`). */
  const started = useRef(false);
  /** Se pidió parar antes de que arrancara: se para apenas arranque. */
  const stopPending = useRef(false);
  const maxTimer = useRef<number | null>(null);
  const finalText = useRef("");
  /** Todo lo reconocido, también lo que todavía no es final. */
  const allText = useRef("");
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
    // Continuo: mientras B esté apretado, una pausa para pensar no
    // corta la grabación.
    rec.continuous = true;
    rec.interimResults = true;

    finalText.current = "";
    allText.current = "";
    setTranscript("");
    setError(null);

    rec.onresult = (event) => {
      const { final, all } = joinResults(event.results);
      finalText.current = final;
      allText.current = all;
      setTranscript(all);
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
    rec.onstart = () => {
      started.current = true;
      // Chrome ignora stop() si llega antes de este evento: un clic corto, o
      // el cartel de permiso del micrófono tapando el "soltar". Sin esto la
      // grabación seguía sola y el botón no la podía apagar.
      if (stopPending.current) rec.stop();
    };
    rec.onend = () => {
      recognition.current = null;
      started.current = false;
      stopPending.current = false;
      if (maxTimer.current !== null) window.clearTimeout(maxTimer.current);
      maxTimer.current = null;
      setListening(false);
      // Android a veces cierra sin marcar como final lo último que oyó: en
      // ese caso vale lo que se mostró en pantalla.
      onFinalRef.current(finalText.current || allText.current);
    };

    recognition.current = rec;
    started.current = false;
    stopPending.current = false;
    try {
      rec.start();
      setListening(true);
      maxTimer.current = window.setTimeout(() => recognition.current?.stop(), MAX_LISTEN_MS);
    } catch {
      // start() tira si ya hay otro reconocimiento en curso.
      recognition.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recognition.current;
    if (!rec) return;
    if (started.current) rec.stop();
    else stopPending.current = true;
  }, []);

  /** Deja de escuchar SIN enviar lo dicho (el "Cancelar" de la vista VR). */
  const cancel = useCallback(() => {
    if (maxTimer.current !== null) window.clearTimeout(maxTimer.current);
    maxTimer.current = null;
    const rec = recognition.current;
    recognition.current = null;
    started.current = false;
    stopPending.current = false;
    finalText.current = "";
    allText.current = "";
    setTranscript("");
    setListening(false);
    if (!rec) return;
    rec.onend = null;
    rec.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (maxTimer.current !== null) window.clearTimeout(maxTimer.current);
      const rec = recognition.current;
      if (!rec) return;
      rec.onend = null;
      rec.abort();
    };
  }, []);

  return { supported, listening, transcript, error, start, stop, cancel };
}
