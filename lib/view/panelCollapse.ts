"use client";

import { useSyncExternalStore } from "react";

/**
 * Qué paneles de la pantalla (fuera del visor) están minimizados. Queda
 * guardado en el aparato: si en el celular se minimiza el de resultados,
 * sigue así al entrar a otro experimento, que es justo donde estorba.
 */

const KEY = "immersilab:paneles-minimizados";
const listeners = new Set<() => void>();
let memory: Record<string, boolean> = {};
let loaded = false;

function load(): Record<string, boolean> {
  if (loaded) return memory;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as Record<string, boolean>;
  } catch {
    // Sin almacenamiento (modo privado estricto): solo en memoria.
  }
  return memory;
}

export function setPanelCollapsed(id: string, collapsed: boolean) {
  memory = { ...load(), [id]: collapsed };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Queda en memoria hasta recargar.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ¿El panel `id` está minimizado? En el servidor, siempre abierto. */
export function usePanelCollapsed(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(load()[id]),
    () => false,
  );
}
