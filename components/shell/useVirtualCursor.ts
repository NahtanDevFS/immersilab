"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface CursorPosition {
  x: number;
  y: number;
}

/** Distancia máxima (px) y tiempo (ms) para considerar un gesto como "tap". */
const TAP_MAX_DISTANCE = 10;
const TAP_MAX_DURATION = 300;

/** Multiplicador de sensibilidad del trackpad. */
const SENSITIVITY = 1.6;

/**
 * Convierte la pantalla táctil en un trackpad: arrastrar mueve un cursor
 * virtual (movimiento relativo, no absoluto), y un toque corto sin arrastre
 * cuenta como click sobre el elemento que esté bajo el cursor.
 */
export function useVirtualCursor(enabled: boolean) {
  const [position, setPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  const lastTouch = useRef<CursorPosition | null>(null);
  const gestureStart = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  // Centra el cursor al activarse.
  useEffect(() => {
    if (enabled) {
      setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [enabled]);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      lastTouch.current = { x: touch.clientX, y: touch.clientY };
      gestureStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !lastTouch.current) return;
      e.preventDefault(); // evita el scroll de la página mientras se usa el trackpad

      const touch = e.touches[0];
      const deltaX = (touch.clientX - lastTouch.current.x) * SENSITIVITY;
      const deltaY = (touch.clientY - lastTouch.current.y) * SENSITIVITY;

      setPosition((prev) => ({
        x: Math.max(0, Math.min(window.innerWidth, prev.x + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight, prev.y + deltaY)),
      }));

      lastTouch.current = { x: touch.clientX, y: touch.clientY };
    },
    [enabled],
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !gestureStart.current) return;

    const { x, y, time } = gestureStart.current;
    const lastPos = lastTouch.current;
    const distance = lastPos ? Math.hypot(lastPos.x - x, lastPos.y - y) : 0;
    const duration = Date.now() - time;

    // Gesto corto y sin desplazamiento = click en la posición del cursor.
    if (distance < TAP_MAX_DISTANCE && duration < TAP_MAX_DURATION) {
      setPosition((current) => {
        const target = document.elementFromPoint(current.x, current.y);
        if (target instanceof HTMLElement) {
          target.click();
        }
        return current;
      });
    }

    lastTouch.current = null;
    gestureStart.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { position, active: enabled };
}
