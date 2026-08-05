"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Paso de tiempo fijo para la simulación física, independiente del framerate
// real del navegador. Ver PLAN_DESARROLLO.md — esto evita que los experimentos
// se comporten distinto en dispositivos con distinto rendimiento (ej. un péndulo
// que gana energía de la nada por pasos de integración demasiado grandes).
const FIXED_DELTA = 1 / 60; // 60 pasos de física por segundo
const MAX_STEPS_PER_FRAME = 5; // evita "espiral de la muerte" si el frame tarda demasiado

/**
 * Ejecuta `onFixedUpdate` con un delta de tiempo constante, sin importar
 * cuántos frames por segundo esté logrando el navegador en ese momento.
 *
 * Uso dentro de un componente de React Three Fiber:
 *
 *   useFixedTimestep((fixedDelta) => {
 *     engine.update(fixedDelta, variables);
 *   });
 */
export function useFixedTimestep(onFixedUpdate: (fixedDelta: number) => void) {
  const accumulator = useRef(0);

  useFrame((_, frameDelta) => {
    // Si el frame tardó demasiado (ej. la pestaña estuvo en background),
    // no intentamos "recuperar" todo ese tiempo de golpe.
    const clampedDelta = Math.min(
      frameDelta,
      FIXED_DELTA * MAX_STEPS_PER_FRAME,
    );
    accumulator.current += clampedDelta;

    let steps = 0;
    while (accumulator.current >= FIXED_DELTA && steps < MAX_STEPS_PER_FRAME) {
      onFixedUpdate(FIXED_DELTA);
      accumulator.current -= FIXED_DELTA;
      steps++;
    }
  });
}

export { FIXED_DELTA };
