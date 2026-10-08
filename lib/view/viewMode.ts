"use client";

import { useSyncExternalStore } from "react";

/**
 * Vista del laboratorio, como en los videos 360 de YouTube:
 * - "360": una sola imagen en toda la pantalla; se mira moviendo el celular
 *   (o arrastrando, en la compu).
 * - "vr": la pantalla partida en dos, una imagen por ojo, para meter el
 *   celular en el visor.
 *
 * Se recuerda en el dispositivo: si alguien usa el visor, al pasar de un
 * experimento a otro sigue en VR.
 */
export type ViewMode = "360" | "vr";

const KEY = "immersilab.vista.v1";
const listeners = new Set<() => void>();
let memory: ViewMode = "360";

function read(): ViewMode {
  try {
    return window.localStorage.getItem(KEY) === "vr" ? "vr" : "360";
  } catch {
    return memory;
  }
}

export function setViewMode(mode: ViewMode) {
  memory = mode;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // Sin almacenamiento: queda en memoria hasta recargar.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** En el servidor siempre "360": la vista VR aparece al hidratar. */
export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, read, () => "360");
}

/**
 * Entra a la vista VR: pantalla completa y horizontal, como hace YouTube.
 * Tiene que llamarse desde un toque (el navegador solo deja pedir pantalla
 * completa con un gesto). Si el navegador no lo permite (iPhone no deja
 * poner en pantalla completa una página), la vista VR funciona igual.
 */
export async function enterVr() {
  setViewMode("vr");
  try {
    await document.documentElement.requestFullscreen?.();
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    // Sin pantalla completa o sin bloqueo de orientación: sigue igual.
  }
}

export async function exitVr() {
  setViewMode("360");
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // Ya no estaba en pantalla completa.
  }
}
