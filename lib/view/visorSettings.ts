"use client";

import { useSyncExternalStore } from "react";

/**
 * Ajuste del visor: depende de cada visor y de cada celular, así que se
 * calibra a mano (Ajustar el visor) y se guarda en este dispositivo.
 *
 * - `lensSeparation`: distancia entre los centros de los lentes, en píxeles
 *   CSS. Cada ojo se dibuja centrado en su lente, no en el centro de su
 *   mitad de pantalla: en un celular de 15 cm esos centros quedan a ~75 mm y
 *   los lentes a ~63 mm, y la diferencia obliga a los ojos a separarse hacia
 *   afuera, que es lo que se siente como visión doble.
 * - `distortion`: cuánto se pre-deforma la imagen (efecto de barril) para
 *   compensar el efecto de cojín de los lentes, que estira y desenfoca la
 *   periferia.
 * - `zoom`: tamaño de la imagen dentro de cada lente.
 */
export interface VisorSettings {
  lensSeparation: number;
  distortion: number;
  zoom: number;
}

/** Un píxel CSS mide unos 0.17 mm en la mayoría de los celulares. */
export const MM_PER_CSS_PX = 0.17;

export const VISOR_DEFAULTS: VisorSettings = {
  // ~63 mm, la separación más común entre los lentes de un visor genérico.
  lensSeparation: Math.round(63 / MM_PER_CSS_PX),
  distortion: 0.22,
  zoom: 1,
};

export const VISOR_LIMITS = {
  lensSeparation: { min: 280, max: 480, step: 4 },
  distortion: { min: 0, max: 0.6, step: 0.04 },
  zoom: { min: 0.7, max: 1.4, step: 0.05 },
} as const;

const KEY = "immersilab.visor.v1";

let settings: VisorSettings | null = null;
const listeners = new Set<() => void>();

function load(): VisorSettings {
  if (settings) return settings;
  try {
    const raw = window.localStorage.getItem(KEY);
    settings = raw ? { ...VISOR_DEFAULTS, ...(JSON.parse(raw) as Partial<VisorSettings>) } : VISOR_DEFAULTS;
  } catch {
    settings = VISOR_DEFAULTS;
  }
  return settings;
}

/** Para el cuadro a cuadro del dibujo: sin React. */
export function getVisorSettings(): VisorSettings {
  return load();
}

export function setVisorSettings(patch: Partial<VisorSettings>) {
  const next = { ...load(), ...patch };
  (Object.keys(VISOR_LIMITS) as Array<keyof VisorSettings>).forEach((key) => {
    const { min, max, step } = VISOR_LIMITS[key];
    next[key] = Number((Math.round(Math.min(max, Math.max(min, next[key])) / step) * step).toFixed(4));
  });
  settings = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento: vale hasta recargar.
  }
  listeners.forEach((listener) => listener());
}

export function resetVisorSettings() {
  settings = VISOR_DEFAULTS;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada que borrar.
  }
  listeners.forEach((listener) => listener());
}

export function useVisorSettings(): VisorSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    () => VISOR_DEFAULTS,
  );
}

/*
 * ¿Está abierto el ajuste del visor? Lo abren los botones de los paneles y
 * lo dibuja StereoView (la cuadrícula) y el panel de ajuste.
 */
let calibrating = false;
const calibratingListeners = new Set<() => void>();

export function setCalibrating(next: boolean) {
  calibrating = next;
  calibratingListeners.forEach((listener) => listener());
}

export function useCalibrating(): boolean {
  return useSyncExternalStore(
    (listener) => {
      calibratingListeners.add(listener);
      return () => calibratingListeners.delete(listener);
    },
    () => calibrating,
    () => false,
  );
}
