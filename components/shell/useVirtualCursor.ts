"use client";

import { useState, useRef, useEffect } from "react";
import { readPad } from "./gamepad";

export interface CursorPosition {
  x: number;
  y: number;
}

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
 * Cursor virtual para usar la interfaz con el control, con el celular en la
 * mano (giroscopio, sin visor): el stick derecho lo mueve y el botón de
 * acción (A en el control ImmersiLab, X en PlayStation) agarra lo que esté
 * debajo — si es un slider, moverlo con el stick ajusta su valor; si es
 * cualquier otro elemento, lo activa como un toque.
 *
 * Solo existe con un control conectado (`active`). Antes la pantalla también
 * hacía de touchpad (arrastrar movía el cursor y un toque hacía clic donde
 * estaba el cursor, no donde se tocaba): era para el visor viejo, sin la
 * vista VR de dos ojos. Con el teléfono en la mano confundía — tocar un botón
 * no lo tocaba —, así que ahora los toques van directo a lo que hay debajo
 * del dedo.
 */
export function useVirtualCursor(enabled: boolean) {
  const [position, setPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const positionRef = useRef(position);
  /** Hay un control conectado: sin él, no hay cursor. */
  const [padPresent, setPadPresent] = useState(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Centra el cursor al activarse. Va en un frame aparte y no directo en el
  // efecto: un setState síncrono ahí provoca un render en cascada.
  useEffect(() => {
    if (!enabled) return;
    const id = requestAnimationFrame(() =>
      setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    );
    return () => cancelAnimationFrame(id);
  }, [enabled]);

  // Entrada por gamepad: stick derecho mueve el cursor, botón X agarra o
  // clickea lo que esté debajo.
  useEffect(() => {
    if (!enabled) return;

    let rafId: number;
    let lastTime: number | null = null;
    let wasXPressed = false;
    let dragTarget: HTMLInputElement | null = null;
    let lastHoveredKey: string | null = null;
    let lastPresent = false;

    const tick = (time: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = lastTime !== null ? (time - lastTime) / 1000 : 0;
      lastTime = time;

      const pad = readPad();
      if (Boolean(pad) !== lastPresent) {
        lastPresent = Boolean(pad);
        setPadPresent(lastPresent);
      }
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

  return { position, active: enabled && padPresent, hoveredKey };
}