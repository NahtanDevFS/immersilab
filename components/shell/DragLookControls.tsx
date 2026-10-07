"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Radianes por píxel arrastrado. */
const SENSITIVITY = 0.004;
/** Tope para mirar arriba/abajo: pasar de la vertical da vuelta la cámara. */
const MAX_PITCH = (85 * Math.PI) / 180;

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
 */
export function DragLookControls({ target }: Props) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const [tx, ty, tz] = target;

  useEffect(() => {
    camera.lookAt(tx, ty, tz);
    // YXZ: primero el giro horizontal (yaw), después el vertical (pitch),
    // sin inclinación lateral. Es el orden de una cabeza humana.
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    let yaw = euler.y;
    let pitch = euler.x;

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
      // En three, yaw positivo gira a la izquierda y pitch positivo mira
      // arriba; en pantalla, x crece a la derecha e y crece hacia abajo.
      // Por eso los dos se restan.
      yaw -= (event.clientX - lastX) * SENSITIVITY;
      pitch -= (event.clientY - lastY) * SENSITIVITY;
      pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
      lastX = event.clientX;
      lastY = event.clientY;

      euler.set(pitch, yaw, 0, "YXZ");
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

  return null;
}
