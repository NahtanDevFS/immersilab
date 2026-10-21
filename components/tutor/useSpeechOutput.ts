"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chooseVoice } from "@/lib/narration/useNarration";

/**
 * Salida de voz del tutor (TTS) con cola por oración — PLAN_DESARROLLO.md §4.4.
 *
 * A diferencia de `useNarration`, que recibe un guion completo, aquí las
 * oraciones llegan de a una mientras el modelo todavía está escribiendo:
 * `enqueue` se llama varias veces y la voz va leyendo sin cortes.
 *
 * `cancel()` es el barge-in: el estudiante apretó B mientras el
 * tutor hablaba. Usa el mismo truco de generación que `useNarration` porque
 * `speechSynthesis.cancel()` no siempre descarta lo que estaba encolado.
 *
 * Tres resguardos contra fallas de Chrome que dejaban la respuesta a medias
 * (el texto completo en la conversación, pero la voz callada a mitad):
 * - Una frase de más de ~15 s con las voces de Google se corta sola y sin
 *   `onend`: las oraciones largas se parten en las comas (`speakableChunks`).
 * - Si nadie guarda la frase en curso, el navegador la descarta y tampoco
 *   llega `onend`: queda guardada en `player.current`.
 * - Si igual la voz se calla sin avisar, un vigilante pasa a la siguiente.
 */
interface Player {
  queue: string[];
  playing: boolean;
  generation: number;
  setSpeaking: (speaking: boolean) => void;
  /** La frase que se está diciendo: guardarla evita que Chrome la descarte. */
  current: SpeechSynthesisUtterance | null;
  watchdog: number | null;
}

/** Hasta dónde se deja una frase entera: unos 10 s de voz. */
const MAX_CHUNK = 150;

/**
 * Parte una oración larga en pedazos que se puedan decir de una vez, en las
 * comas, punto y coma o dos puntos (ahí la voz igual hace una pausa). Si no
 * hay dónde, corta en el último espacio.
 */
export function speakableChunks(sentence: string): string[] {
  const chunks: string[] = [];
  let rest = sentence.trim();
  while (rest.length > MAX_CHUNK) {
    const head = rest.slice(0, MAX_CHUNK);
    let cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(": "));
    if (cut < MAX_CHUNK / 3) cut = head.lastIndexOf(" ");
    if (cut <= 0) break;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function clearWatchdog(player: Player) {
  if (player.watchdog !== null) window.clearTimeout(player.watchdog);
  player.watchdog = null;
}

/** Lee la siguiente oración de la cola y se vuelve a llamar al terminarla. */
function playNext(player: Player) {
  clearWatchdog(player);
  const mine = player.generation;
  const sentence = player.queue.shift();
  if (sentence === undefined) {
    player.playing = false;
    player.current = null;
    player.setSpeaking(false);
    return;
  }

  player.playing = true;
  player.setSpeaking(true);

  const utterance = new SpeechSynthesisUtterance(sentence);
  const voice = chooseVoice();
  utterance.lang = voice?.lang ?? "es-MX";
  if (voice) utterance.voice = voice;
  // Un pelo más rápido que la explicación: es conversación, no lectura.
  utterance.rate = 1.02;
  utterance.pitch = 1.05;

  let started = false;
  utterance.onstart = () => {
    started = true;
    if (mine !== player.generation) window.speechSynthesis.cancel();
  };
  let done = false;
  const next = () => {
    if (done) return;
    done = true;
    if (mine === player.generation) playNext(player);
  };
  utterance.onend = next;
  utterance.onerror = next;

  player.current = utterance;
  window.speechSynthesis.speak(utterance);

  // Vigilante: cada segundo mira si la voz sigue hablando. Si ya arrancó
  // (llegó onstart) y la encuentra callada dos veces seguidas sin que haya
  // llegado onend, se cortó sola: sigue con la próxima. Si nunca arranca,
  // espera lo que debería durar la frase (unos 14 caracteres por segundo,
  // con margen). Antes esperaba siempre la duración entera: con una frase
  // cortada quedaban hasta 20 s de silencio.
  const deadline = performance.now() + 2500 + (sentence.length / 14) * 1000 * 1.6;
  let silentChecks = 0;
  const check = () => {
    if (done || mine !== player.generation) return;
    const talking = window.speechSynthesis.speaking && !window.speechSynthesis.paused;
    silentChecks = talking ? 0 : silentChecks + 1;
    if ((started && silentChecks >= 2) || (!started && performance.now() > deadline)) {
      next();
      return;
    }
    player.watchdog = window.setTimeout(check, 1000);
  };
  player.watchdog = window.setTimeout(check, 1000);
}

export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);
  const player = useRef<Player>({
    queue: [],
    playing: false,
    generation: 0,
    setSpeaking,
    current: null,
    watchdog: null,
  });

  const enqueue = useCallback((sentence: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    player.current.queue.push(...speakableChunks(sentence));
    if (!player.current.playing) playNext(player.current);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const p = player.current;
    p.generation += 1;
    p.queue = [];
    p.playing = false;
    p.current = null;
    clearWatchdog(p);
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  return { speaking, enqueue, cancel };
}
