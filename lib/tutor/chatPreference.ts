"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿La conversación con el tutor está desplegada o minimizada? Vale para la
 * ventana de la PC y para el panel de la vista VR, y se recuerda en este
 * dispositivo: quien la prefiere abierta no tiene que abrirla en cada
 * experimento.
 */
const KEY = "immersilab.chat.abierto";

let open: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (open !== null) return open;
  try {
    open = window.localStorage.getItem(KEY) === "1";
  } catch {
    open = false;
  }
  return open;
}

export function setChatOpen(next: boolean) {
  open = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Sin almacenamiento: vale hasta recargar.
  }
  listeners.forEach((listener) => listener());
}

export function useChatOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => false,
  );
}
