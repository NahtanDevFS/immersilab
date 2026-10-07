"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ExperimentEngine } from "@/types/module";
import { readPad } from "@/components/shell/gamepad";
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
