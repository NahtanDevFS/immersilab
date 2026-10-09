"use client";

import { useSyncExternalStore } from "react";
import type { ChatMessage } from "@/components/tutor/useTutorSession";

/**
 * Estado del tutor que tiene que verse dentro de la escena en la vista VR
 * (estado y subtítulos). El tutor vive fuera del Canvas, en HTML; los
 * subtítulos 3D, dentro. Este canal los une sin que ninguno conozca al otro.
 */
export interface TutorHudState {
  status: "idle" | "listening" | "thinking" | "speaking";
  heard: string;
  reply: string;
  offline: boolean;
  /** Aviso del micrófono (sin permiso, sin internet, no entendió). */
  note: string | null;
}

let state: TutorHudState = { status: "idle", heard: "", reply: "", offline: false, note: null };
const listeners = new Set<() => void>();

export function publishTutorHud(next: TutorHudState) {
  if (
    next.status === state.status &&
    next.heard === state.heard &&
    next.reply === state.reply &&
    next.offline === state.offline &&
    next.note === state.note
  ) {
    return;
  }
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTutorHud(): TutorHudState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/*
 * Manejar al tutor desde los botones 3D (vista VR): preguntar, enviar,
 * cancelar. El tutor registra sus funciones; los botones solo las llaman.
 */
interface TutorCommands {
  /** Empieza a escuchar o, si ya escucha, envía la pregunta. */
  toggle: () => void;
  /** Descarta lo que se estaba diciendo, corta la respuesta y calla la voz. */
  cancel: () => void;
}

let commands: TutorCommands | null = null;

export function setTutorCommands(next: TutorCommands): () => void {
  commands = next;
  return () => {
    if (commands === next) commands = null;
  };
}

export function toggleTutor() {
  commands?.toggle();
}

/** Cancela la pregunta o la respuesta, y oculta los subtítulos. */
export function cancelTutor() {
  commands?.cancel();
  hideTutorSubtitles();
}

/*
 * Ocultar los subtítulos 3D a mano (como la ✕ de los subtítulos HTML). Es
 * un contador: cada pedido cambia el número y los subtítulos que se veían
 * quedan ocultos hasta que llegue texto nuevo.
 */
let dismissed = 0;
const dismissListeners = new Set<() => void>();

export function hideTutorSubtitles() {
  dismissed += 1;
  dismissListeners.forEach((listener) => listener());
}

export function useSubtitlesDismissed(): number {
  return useSyncExternalStore(
    (listener) => {
      dismissListeners.add(listener);
      return () => dismissListeners.delete(listener);
    },
    () => dismissed,
    () => 0,
  );
}

/* ¿Se ven ahora los subtítulos 3D? Para mostrar el botón de ocultarlos. */
let subtitlesShown = false;
const shownListeners = new Set<() => void>();

export function setSubtitlesShown(shown: boolean) {
  if (shown === subtitlesShown) return;
  subtitlesShown = shown;
  shownListeners.forEach((listener) => listener());
}

export function useSubtitlesShown(): boolean {
  return useSyncExternalStore(
    (listener) => {
      shownListeners.add(listener);
      return () => shownListeners.delete(listener);
    },
    () => subtitlesShown,
    () => false,
  );
}

/* La conversación con el tutor, para el panel de la vista VR. */
let log: readonly ChatMessage[] = [];
const logListeners = new Set<() => void>();

export function publishTutorLog(next: readonly ChatMessage[]) {
  if (next === log) return;
  log = next;
  logListeners.forEach((listener) => listener());
}

export function useTutorLog(): readonly ChatMessage[] {
  return useSyncExternalStore(
    (listener) => {
      logListeners.add(listener);
      return () => logListeners.delete(listener);
    },
    () => log,
    () => EMPTY_LOG,
  );
}

const EMPTY_LOG: readonly ChatMessage[] = [];
