"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const DEADZONE = 0.15;
const SPEED = 4; // metros por segundo, caminando

function applyDeadzone(value: number) {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

/**
 * Movimiento en el plano horizontal usando el stick izquierdo de un gamepad
 * conectado (Gamepad API — funciona con un control emparejado por
 * Bluetooth/USB, como un DualSense de PS5).
 *
 * Es un reemplazo temporal para pruebas: cuando el control físico del grupo
 * (ESP32, Fase 8 del plan) esté listo, se conecta como otra fuente de input
 * con la misma forma { x, y } sin tener que tocar este componente.
 *
 * El movimiento es relativo a hacia dónde mira la cámara (como caminar en
 * un shooter), y se mantiene a la altura del piso aunque mires hacia arriba
 * o abajo — por eso se anula la componente Y de "forward" antes de mover.
 */
export function MovementController() {
  const { camera } = useThree();
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((p) => p !== null);
    if (!pad) return;

    // Mapeo "standard" de la Gamepad API: axes[0]/[1] son el stick
    // izquierdo (horizontal/vertical). axes[1] negativo = stick hacia
    // arriba = adelante.
    const moveX = applyDeadzone(pad.axes[0] ?? 0);
    const moveY = applyDeadzone(pad.axes[1] ?? 0);
    if (moveX === 0 && moveY === 0) return;

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();

    right.current.crossVectors(forward.current, camera.up).normalize();

    const step = SPEED * delta;
    camera.position.addScaledVector(forward.current, -moveY * step);
    camera.position.addScaledVector(right.current, moveX * step);
  });

  return null;
}