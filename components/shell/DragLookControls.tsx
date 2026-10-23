"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isDrawing } from "@/lib/view/drawing";
import { useViewMode } from "@/lib/view/viewMode";
import { readPad } from "./gamepad";

/** Radianes por píxel arrastrado. */
const SENSITIVITY = 0.004;
/** Tope para mirar arriba/abajo: pasar de la vertical da vuelta la cámara. */
const MAX_PITCH = (85 * Math.PI) / 180;
/** Giro con el stick derecho a fondo, radianes por segundo (~115°/s). */
const STICK_TURN_SPEED = 2;

interface Props {
  /** Punto al que mira la cámara al arrancar. */
  target: [number, number, number];
}

/**
 * Mirar alrededor arrastrando con el mouse (o el dedo), sin giroscopio.
 *
 * Es la cámara de primera persona del modo computadora: se combina con
 * `MovementController` (WASD/flechas) para caminar. Reemplaza a
 * `OrbitControls`, que giraba alrededor de un punto fijo y no dejaba
 * caminar — en el lobby eso hacía imposible llegar a una puerta.
 *
 * Por qué arrastrar y no capturar el mouse (pointer lock): con el mouse
 * capturado los paneles de variables y los botones quedan inaccesibles
 * hasta apretar Esc. Arrastrando, un clic suelto sigue siendo un clic.
 *
 * La vista sigue al mouse: arrastrar a la derecha mira a la derecha y
 * arrastrar hacia arriba mira hacia arriba, como girar la cabeza. (Se probó
 * al revés, "agarrando el mundo" como Street View, y se sentía invertido.)
 *
 * Con un control, el stick derecho a los lados también gira, como en
 * cualquier juego con mando: antes en la compu se caminaba con el control
 * pero para girar había que ir al mouse. Arriba y abajo queda para subir y
 * bajar la cámara (MovementController); gana el eje que más se empuja, así
 * un movimiento no arrastra al otro. Solo fuera de la vista VR: ahí el stick
 * a los lados cambia la variable que se mira, y se gira con la cabeza.
 *
 * Este componente solo se monta SIN giroscopio (la compu, o un celular que
 * no lo entrega): con el celular en la mano o en el visor no existe, y nada
 * de esto lo toca.
 */
export function DragLookControls({ target }: Props) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const vr = useViewMode() === "vr";
  const [tx, ty, tz] = target;
  // Lo comparten el arrastre (eventos) y el stick (cada cuadro): así uno
  // sigue donde lo dejó el otro.
  const look = useRef({ yaw: 0, pitch: 0, euler: new THREE.Euler(0, 0, 0, "YXZ") });

  useEffect(() => {
    camera.lookAt(tx, ty, tz);
    // YXZ: primero el giro horizontal (yaw), después el vertical (pitch),
    // sin inclinación lateral. Es el orden de una cabeza humana.
    const state = look.current;
    const euler = state.euler.setFromQuaternion(camera.quaternion, "YXZ");
    state.yaw = euler.y;
    state.pitch = euler.x;

    let dragging: number | null = null;
    let lastX = 0;
    let lastY = 0;

    // Sin esto, en un celular sin giroscopio arrastrar el dedo scrollea la
    // página en vez de girar la vista.
    canvas.style.setProperty("touch-action", "none");
    canvas.style.setProperty("cursor", "grab");

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.setProperty("cursor", "grabbing");
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== dragging) return;
      // Dibujando en un pizarrón: el arrastre es para el trazo, no para mirar.
      if (isDrawing()) {
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }
      // En three, yaw positivo gira a la izquierda y pitch positivo mira
      // arriba; en pantalla, x crece a la derecha e y crece hacia abajo.
      // Por eso los dos se restan.
      state.yaw -= (event.clientX - lastX) * SENSITIVITY;
      state.pitch -= (event.clientY - lastY) * SENSITIVITY;
      state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch));
      lastX = event.clientX;
      lastY = event.clientY;

      euler.set(state.pitch, state.yaw, 0, "YXZ");
      camera.quaternion.setFromEuler(euler);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== dragging) return;
      dragging = null;
      canvas.style.setProperty("cursor", "grab");
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.style.removeProperty("touch-action");
      canvas.style.removeProperty("cursor");
    };
  }, [camera, canvas, tx, ty, tz]);

  useFrame((_, delta) => {
    if (vr) return;
    const pad = readPad();
    if (!pad) return;
    const { x, y } = pad.right;
    // Solo si se empuja más hacia los lados que hacia arriba o abajo (eso
    // sube y baja la cámara). Al cuadrado: con poco empuje gira lento.
    if (x === 0 || Math.abs(x) <= Math.abs(y)) return;
    const state = look.current;
    state.yaw -= x * Math.abs(x) * STICK_TURN_SPEED * delta;
    state.euler.set(state.pitch, state.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(state.euler);
  });

  return null;
}
