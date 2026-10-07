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
 * `cancel()` es el barge-in: el estudiante apretó el gatillo mientras el
 * tutor hablaba. Usa el mismo truco de generación que `useNarration` porque
 * `speechSynthesis.cancel()` no siempre descarta lo que estaba encolado.
 */
interface Player {
  queue: string[];
  playing: boolean;
  generation: number;
  setSpeaking: (speaking: boolean) => void;
}

/** Lee la siguiente oración de la cola y se vuelve a llamar al terminarla. */
function playNext(player: Player) {
  const mine = player.generation;
  const sentence = player.queue.shift();
  if (sentence === undefined) {
    player.playing = false;
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

  utterance.onstart = () => {
    if (mine !== player.generation) window.speechSynthesis.cancel();
  };
  const next = () => {
    if (mine === player.generation) playNext(player);
  };
  utterance.onend = next;
  utterance.onerror = next;

  window.speechSynthesis.speak(utterance);
}

export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);
  const player = useRef<Player>({
    queue: [],
    playing: false,
    generation: 0,
    setSpeaking,
  });

  const enqueue = useCallback((sentence: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    player.current.queue.push(sentence);
    if (!player.current.playing) playNext(player.current);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const p = player.current;
    p.generation += 1;
    p.queue = [];
    p.playing = false;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  return { speaking, enqueue, cancel };
}
