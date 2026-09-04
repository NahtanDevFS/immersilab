"use client";

import { useEffect, useSyncExternalStore } from "react";

export type QualityTier = "high" | "low";

const STORAGE_KEY = "immersilab:quality";

/**
 * Decide si el dispositivo aguanta post-proceso y sombras de 2048 px, o si
 * hay que bajar todo.
 *
 * El objetivo del proyecto es un celular gama media dentro de un visor, así
 * que el diseño NUNCA debe depender del bloom: en "low" se apaga el
 * EffectComposer y los materiales emisivos siguen viéndose brillantes por su
 * propio color, solo que sin derramar halo. La escena se ve distinta, no
 * rota.
 *
 * Se puede forzar para probar, sin recompilar:
 *   ?q=low   /  ?q=high     (queda guardado en localStorage)
 */
export function useQualityTier(): QualityTier {
  const tier = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Persistir el override de la URL es un efecto secundario, no parte de
  // leer el valor — por eso va acá y no en getSnapshot, que tiene que ser
  // puro (React lo llama en cada render).
  useEffect(() => {
    const forced = readUrlOverride();
    if (forced) localStorage.setItem(STORAGE_KEY, forced);
  }, []);

  return tier;
}

/**
 * El tier se resuelve una sola vez por carga y no cambia después, así que no
 * hay nada a lo que suscribirse. useSyncExternalStore igual exige la
 * función.
 */
function subscribe() {
  return () => {};
}

// React llama a getSnapshot en cada render y compara con Object.is, así que
// tiene que devolver siempre exactamente el mismo valor. Se cachea a nivel
// de módulo en vez de recalcular.
let cached: QualityTier | null = null;

function getSnapshot(): QualityTier {
  if (cached === null) cached = resolve();
  return cached;
}

/**
 * En el servidor no hay dispositivo que medir. Se asume "low": es mejor que
 * el primer frame salga liviano y suba, a que salga pesado y trabe.
 */
function getServerSnapshot(): QualityTier {
  return "low";
}

function readUrlOverride(): QualityTier | null {
  const q = new URLSearchParams(window.location.search).get("q");
  return q === "low" || q === "high" ? q : null;
}

function resolve(): QualityTier {
  const forced = readUrlOverride();
  if (forced) return forced;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "low" || saved === "high") return saved;

  const cores = navigator.hardwareConcurrency ?? 4;

  // `pointer: coarse` = se maneja con el dedo, no con mouse. Es la señal más
  // confiable de "es un celular/tablet" que existe hoy: no depende del user
  // agent, que los navegadores llevan años falsificando.
  const isTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  // `deviceMemory` solo existe en Chromium — que es justo donde corre el
  // dispositivo objetivo. Si no está, se ignora.
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory <= 4) return "low";

  if (isTouch && cores <= 6) return "low";
  if (cores <= 2) return "low";

  return "high";
}
