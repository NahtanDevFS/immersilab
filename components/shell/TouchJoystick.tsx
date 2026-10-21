"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getActivePad } from "./gamepad";
import { isTouchDevice } from "@/lib/view/viewMode";
import { JOYSTICK_ATTRIBUTE, setJoystickAxes } from "@/lib/input/touchJoystick";
import styles from "./TouchJoystick.module.css";

function subscribeNever() {
  return () => {};
}

/** Radio útil del joystick, px: empujar el pulgar más allá no suma. */
const RADIUS = 46;
/** Zona muerta: un pulgar apoyado sin querer no camina. */
const DEADZONE = 0.12;

/**
 * Joystick en pantalla para caminar en el celular sin control: abajo a la
 * izquierda y semitransparente, como en los juegos. Empujarlo hasta el borde
 * un momento hace correr (lo decide MovementController, igual que con el
 * stick del control).
 *
 * Solo aparece en pantallas táctiles, fuera del visor y sin control
 * conectado: con el teléfono en el visor nadie toca la pantalla, y con un
 * control ya está el stick izquierdo. Si se conecta uno, desaparece.
 *
 * Cada dedo se sigue por separado: el que empieza acá camina, y con el otro
 * pulgar se tocan los botones de siempre. Mientras se ve, el panel de
 * variables le deja libre la esquina de abajo.
 */
export function TouchJoystick({ enabled }: { enabled: boolean }) {
  // En el servidor no hay pantalla: false, y aparece al hidratar.
  const touch = useSyncExternalStore(subscribeNever, isTouchDevice, () => false);
  const [hasPad, setHasPad] = useState(false);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  // El navegador no avisa de un control hasta que se aprieta un botón, y a
  // veces tampoco al desconectarlo: se mira cada tanto además de los eventos.
  useEffect(() => {
    if (!touch) return;
    const check = () => setHasPad(getActivePad() !== null);
    check();
    const id = window.setInterval(check, 1000);
    window.addEventListener("gamepadconnected", check);
    window.addEventListener("gamepaddisconnected", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("gamepadconnected", check);
      window.removeEventListener("gamepaddisconnected", check);
    };
  }, [touch]);

  const visible = enabled && touch && !hasPad;

  // Al esconderse (o desmontarse) con el pulgar apoyado, que no siga caminando.
  useEffect(() => {
    if (visible) return;
    setJoystickAxes(0, 0);
    pointer.current = null;
  }, [visible]);
  useEffect(() => () => setJoystickAxes(0, 0), []);

  // Avisa que está a la vista: el panel de variables le deja libre la
  // esquina de abajo a la izquierda (VariablesPanel.module.css).
  useEffect(() => {
    if (!visible) return;
    document.documentElement.setAttribute("data-touch-joystick-on", "");
    return () => document.documentElement.removeAttribute("data-touch-joystick-on");
  }, [visible]);

  const move = useCallback((clientX: number, clientY: number) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS;
      dy = (dy / length) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const x = dx / RADIUS;
    const y = dy / RADIUS;
    if (Math.hypot(x, y) < DEADZONE) setJoystickAxes(0, 0);
    else setJoystickAxes(x, y);
  }, []);

  const release = useCallback(() => {
    pointer.current = null;
    setKnob(null);
    setJoystickAxes(0, 0);
  }, []);

  // Mover y soltar se escuchan en toda la ventana, no solo en el círculo: si
  // el pulgar se sale del círculo sigue manejándolo, y soltarlo afuera igual
  // frena (si no, seguía caminando solo). Cada dedo por su identificador.
  useEffect(() => {
    if (!visible) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerId === pointer.current) move(event.clientX, event.clientY);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId === pointer.current) release();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [visible, move, release]);

  if (!visible) return null;

  return (
    <div
      ref={base}
      className={styles.base}
      data-active={knob !== null}
      {...{ [JOYSTICK_ATTRIBUTE]: "" }}
      aria-hidden
      onPointerDown={(event) => {
        if (pointer.current !== null) return;
        pointer.current = event.pointerId;
        event.preventDefault();
        move(event.clientX, event.clientY);
      }}
    >
      <div
        className={styles.knob}
        style={knob ? { transform: `translate(${knob.x}px, ${knob.y}px)` } : undefined}
      />
    </div>
  );
}
