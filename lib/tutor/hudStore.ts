"use client";

import { useSyncExternalStore } from "react";

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
}

let state: TutorHudState = { status: "idle", heard: "", reply: "", offline: false };
const listeners = new Set<() => void>();

export function publishTutorHud(next: TutorHudState) {
  if (
    next.status === state.status &&
    next.heard === state.heard &&
    next.reply === state.reply &&
    next.offline === state.offline
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
