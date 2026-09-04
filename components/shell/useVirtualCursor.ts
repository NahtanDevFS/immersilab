"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { readPad } from "./gamepad";

export interface CursorPosition {
  x: number;
  y: number;
}

/** Distancia máxima (px) y tiempo (ms) para considerar un gesto como "tap". */
const TAP_MAX_DISTANCE = 10;
const TAP_MAX_DURATION = 300;

/** Multiplicador de sensibilidad del trackpad táctil. */
const SENSITIVITY = 1.6;

/** Velocidad del cursor cuando lo mueve el stick derecho. */
const CURSOR_SPEED = 900; // px/segundo con el stick a fondo

/**
 * Fuerza el valor de un <input type="range"> controlado por React y avisa
 * al framework — asignar `.value` directo no dispara el onChange de React,
 * porque React trackea el valor por fuera del DOM. Este es el workaround
 * estándar: usar el setter nativo y despachar el evento "input" a mano.
 */
function setNativeSliderValue(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Convierte la pantalla táctil en un trackpad: arrastrar mueve un cursor
 * virtual (movimiento relativo, no absoluto), y un toque corto sin arrastre
 * cuenta como click sobre el elemento que esté bajo el cursor.
 *
 * También acepta el gamepad como segunda fuente de entrada, sobre el mismo
 * cursor: el stick derecho lo mueve, y el botón X (índice 0, layout
 * "standard") agarra lo que esté debajo — si es un slider, arrastrarlo con
 * el stick ajusta su valor (esto resuelve el pendiente de Fase 1: los
 * sliders no eran arrastrables con el cursor virtual); si es cualquier
 * otro elemento clickeable, X lo activa directo, como un tap.
 */
export function useVirtualCursor(enabled: boolean) {
  const [position, setPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const positionRef = useRef(position);
  const lastTouch = useRef<CursorPosition | null>(null);
  const gestureStart = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

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

  // Entrada por gamepad: stick derecho mueve el cursor, botón X agarra o
  // clickea lo que esté debajo.
  useEffect(() => {
    if (!enabled) return;

    let rafId: number;
    let lastTime: number | null = null;
    let wasXPressed = false;
    let dragTarget: HTMLInputElement | null = null;
    let lastHoveredKey: string | null = null;

    const tick = (time: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = lastTime !== null ? (time - lastTime) / 1000 : 0;
      lastTime = time;

      const pad = readPad();
      if (!pad) return;

      const mx = pad.right.x;
      const my = pad.right.y;

      if (mx !== 0 || my !== 0) {
        setPosition((prev) => ({
          x: Math.max(
            0,
            Math.min(window.innerWidth, prev.x + mx * CURSOR_SPEED * dt),
          ),
          y: Math.max(
            0,
            Math.min(window.innerHeight, prev.y + my * CURSOR_SPEED * dt),
          ),
        }));
      }

      const cur = positionRef.current;
      const under = document.elementFromPoint(cur.x, cur.y);

      // Resalta el slider bajo el cursor, para ver qué se va a agarrar
      // antes incluso de apretar X.
      const key =
        under instanceof HTMLInputElement && under.type === "range"
          ? under.id
          : null;
      if (key !== lastHoveredKey) {
        lastHoveredKey = key;
        setHoveredKey(key);
      }

      const xPressed = pad.action;

      if (xPressed && !wasXPressed) {
        // Botón recién presionado: agarra el slider, o clickea directo
        // cualquier otro elemento (como un tap).
        if (under instanceof HTMLInputElement && under.type === "range") {
          dragTarget = under;
        } else {
          dragTarget = null;
          if (under instanceof HTMLElement) under.click();
        }
      }

      if (xPressed && dragTarget) {
        const rect = dragTarget.getBoundingClientRect();
        const min = parseFloat(dragTarget.min || "0");
        const max = parseFloat(dragTarget.max || "100");
        const step = parseFloat(dragTarget.step || "1") || 1;
        const proportion = Math.min(
          1,
          Math.max(0, (cur.x - rect.left) / rect.width),
        );
        let value = min + proportion * (max - min);
        value = Math.round(value / step) * step;
        value = Math.min(max, Math.max(min, value));
        setNativeSliderValue(dragTarget, Number(value.toFixed(4)));
      }

      if (!xPressed) {
        dragTarget = null;
      }
      wasXPressed = xPressed;
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return { position, active: enabled, hoveredKey };
}