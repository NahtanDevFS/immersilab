"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ExperimentEngine } from "@/types/module";
import { readPad } from "@/components/shell/gamepad";
import { onChallengeCompleted, type ChallengeCompletedEvent } from "@/lib/tutor/events";
import { useSpeechInput } from "./useSpeechInput";
import { useSpeechOutput } from "./useSpeechOutput";
import { useTutorSession } from "./useTutorSession";
import { TutorHUD, type TutorStatus } from "./TutorHUD";

interface Props {
  engine: ExperimentEngine;
  /** `ExperimentDefinition.tutorHints`. */
  hints?: string;
}

/**
 * Orquestador del tutor por voz — PLAN_DESARROLLO.md §4.
 *
 * hablar (STT) → engine.getState() → /api/tutor (streaming) → TTS por oración
 *
 * Tres formas de hablarle, para cubrir cada situación de uso:
 * - **Gatillo R2 del gamepad**, mantenido: el caso del visor.
 * - **Botón en pantalla, mantenido** con mouse o dedo: escritorio.
 * - **Toque corto del cursor virtual** sobre el botón: alterna grabar/parar,
 *   porque el cursor del modo visor solo sabe hacer click, no mantener.
 *
 * Apretar mientras el tutor habla lo corta en seco (barge-in): sin esto, una
 * respuesta larga se vuelve una cárcel.
 */
/**
 * Lo que se le pide al tutor cuando el alumno logra un reto. Va como un turno
 * más de la conversación: así, si después el alumno pregunta "¿y cómo lo
 * hice?", el tutor tiene el contexto.
 */
function challengePrompt(event: ChallengeCompletedEvent): string {
  const detail =
    event.detail && !/^¡?logrado!?$/i.test(event.detail.trim())
      ? ` (${event.detail.trim()})`
      : "";
  return (
    `[Reto logrado] El estudiante acaba de lograr el reto «${event.title}»${detail}. ` +
    "Felicítalo en una oración corta y, en otra, explica con los valores actuales " +
    "del experimento por qué funcionó. No le hagas preguntas."
  ).slice(0, 580);
}

export function VoiceTutor({ engine, hints }: Props) {
  const output = useSpeechOutput();

  const session = useTutorSession({
    getContext: () => engine.getState(),
    hints,
    onSentence: output.enqueue,
  });

  const { ask } = session;
  const handleFinal = useCallback(
    (text: string) => {
      if (text) void ask(text);
    },
    [ask],
  );
  const input = useSpeechInput(handleFinal);

  const press = useCallback(() => {
    if (!input.supported || input.listening) return;
    output.cancel();
    session.abort();
    input.start();
  }, [input, output, session]);

  const release = useCallback(() => {
    input.stop();
  }, [input]);

  const toggle = useCallback(() => {
    if (input.listening) release();
    else press();
  }, [input.listening, press, release]);

  // El loop del gamepad lee siempre la última versión de press/release.
  const controls = useRef({ press, release });
  useEffect(() => {
    controls.current = { press, release };
  }, [press, release]);

  useEffect(() => {
    let rafId = 0;
    let wasPressed = false;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const talk = readPad()?.talk ?? false;
      if (talk && !wasPressed) controls.current.press();
      if (!talk && wasPressed) controls.current.release();
      wasPressed = talk;
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const status: TutorStatus = input.listening
    ? "listening"
    : output.speaking
      ? "speaking"
      : session.pending
        ? "thinking"
        : "idle";

  // Reto logrado: el tutor lo festeja y explica por qué funcionó (Fase C).
  // Primero una frase fija, al instante y sin red; después Gemini agrega una
  // o dos oraciones con los valores reales del experimento (el AIContext
  // viaja solo con cada pregunta).
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    return onChallengeCompleted((event) => {
      // No se interrumpe: si el alumno está hablando con el tutor, si el
      // tutor está respondiendo, o si se está leyendo la explicación, queda
      // solo el aviso visual y el sonido del HUD.
      const voiceBusy =
        typeof window !== "undefined" && window.speechSynthesis?.speaking;
      if (statusRef.current !== "idle" || voiceBusy) return;
      output.enqueue("¡Reto logrado!");
      void ask(challengePrompt(event), { quiet: true });
    });
  }, [ask, output]);

  return (
    <TutorHUD
      status={status}
      heard={input.transcript}
      reply={session.reply}
      supported={input.supported}
      inputError={input.error}
      offline={session.failed}
      onPress={press}
      onRelease={release}
      onToggle={toggle}
    />
  );
}
