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
  // Uno es el comienzo exacto del otro: la misma frase creciendo, aunque sea
  // de una letra. Android arranca así las frases que empiezan con una
  // palabra corta ("y" → "y las" → "y las fórmulas"); con el mínimo de 3
  // letras de abajo, cada paso se sumaba como frase nueva y salía "y y y".
  if (common === shorter) return true;
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
  /** Hay una grabación en curso (puede abarcar varios reconocedores). */
  const active = useRef(false);
  /** Ya arrancó de verdad el reconocedor actual (llegó `onstart`). */
  const started = useRef(false);
  /** Se soltó el botón (o venció el tope): al cerrar, se manda. */
  const wantStop = useRef(false);
  const maxTimer = useRef<number | null>(null);
  /** Lo dicho en los reconocedores anteriores de esta misma grabación. */
  const committed = useRef("");
  const finalText = useRef("");
  /** Todo lo reconocido, también lo que todavía no es final. */
  const allText = useRef("");
  /** Reinicios seguidos sin oír nada: corta un bucle si el motor falla. */
  const emptyRestarts = useRef(0);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  /** El reconocedor que sigue, para abrirlo desde el `onend` del anterior. */
  const spawnNext = useRef<() => boolean>(() => false);

  const join = (a: string, b: string) => `${a} ${b}`.trim().slice(0, TUTOR_LIMITS.transcriptChars);

  /**
   * Un reconocedor. Puede haber varios en una misma grabación: Chrome en
   * Android ignora `continuous` y se cierra solo con la primera pausa, aunque
   * el botón siga apretado — y eso mandaba la pregunta a medias mientras el
   * estudiante pensaba. Si se cierra sin que se haya soltado el botón, se
   * abre otro al instante y lo dicho se va sumando; la pregunta sale recién
   * al soltar (o al vencer el tope).
   */
  const spawn = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;
    const rec = new Ctor();
    // es-GT existe en Chrome; si el motor no lo tiene, cae a español genérico.
    rec.lang = "es-GT";
    // Continuo: en escritorio, una pausa para pensar no corta la grabación.
    rec.continuous = true;
    rec.interimResults = true;
    finalText.current = "";
    allText.current = "";

    rec.onresult = (event) => {
      const { final, all } = joinResults(event.results);
      finalText.current = final;
      allText.current = all;
      emptyRestarts.current = 0;
      setTranscript(join(committed.current, all));
    };
    rec.onerror = (event) => {
      // "no-speech" y "aborted" son normales (una pausa, soltó sin hablar,
      // barge-in): no cortan la grabación.
      if (event.error === "no-speech" || event.error === "aborted") return;
      // Los demás sí: reintentar no los arregla.
      wantStop.current = true;
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
      if (wantStop.current) rec.stop();
    };
    rec.onend = () => {
      recognition.current = null;
      started.current = false;
      // Android a veces cierra sin marcar como final lo último que oyó: en
      // ese caso vale lo que se mostró en pantalla.
      committed.current = join(committed.current, finalText.current || allText.current);
      finalText.current = "";
      allText.current = "";
      if (!active.current) return;
      if (!wantStop.current && emptyRestarts.current < 20) {
        emptyRestarts.current++;
        if (spawnNext.current()) return;
      }
      active.current = false;
      if (maxTimer.current !== null) window.clearTimeout(maxTimer.current);
      maxTimer.current = null;
      setListening(false);
      onFinalRef.current(committed.current);
    };

    recognition.current = rec;
    started.current = false;
    try {
      rec.start();
      return true;
    } catch {
      // start() tira si ya hay otro reconocimiento en curso.
      recognition.current = null;
      return false;
    }
  }, []);

  useEffect(() => {
    spawnNext.current = spawn;
  }, [spawn]);

  const stop = useCallback(() => {
    if (!active.current) return;
    wantStop.current = true;
    const rec = recognition.current;
    // Si todavía no arrancó, lo para `onstart`.
    if (rec && started.current) rec.stop();
  }, []);

  const start = useCallback(() => {
    if (!getRecognitionCtor() || active.current) return;
    active.current = true;
    wantStop.current = false;
    committed.current = "";
    emptyRestarts.current = 0;
    setTranscript("");
    setError(null);
    if (!spawn()) {
      active.current = false;
      return;
    }
    setListening(true);
    maxTimer.current = window.setTimeout(stop, MAX_LISTEN_MS);
  }, [spawn, stop]);

  /** Deja de escuchar SIN enviar lo dicho (el "Cancelar" de la vista VR). */
  const cancel = useCallback(() => {
    if (maxTimer.current !== null) window.clearTimeout(maxTimer.current);
    maxTimer.current = null;
    const rec = recognition.current;
    recognition.current = null;
    active.current = false;
    started.current = false;
    wantStop.current = true;
    committed.current = "";
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
