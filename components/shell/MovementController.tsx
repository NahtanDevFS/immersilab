"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { readPad } from "./gamepad";
import { resolveCollisions } from "@/lib/collision/colliders";

const SPEED = 4; // metros por segundo, caminando

/** Radio del jugador para colisionar. Es el "cuerpo" que no atraviesa las
 *  paredes; 0.35 m es hombro a hombro y deja pasar por un vano de 1 m. */
const PLAYER_RADIUS = 0.35;

/**
 * Movimiento en el plano horizontal usando el stick izquierdo del control.
 *
 * Funciona igual por USB y por Bluetooth: la Gamepad API no los distingue.
 * La deteccion del control y la resolucion de que eje es cual vive en
 * ./gamepad.ts, que ademas maneja los controles USB genericos que el
 * navegador reporta con mapeo no estandar.
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
    const pad = readPad();
    if (!pad) return;

    // Eje Y negativo = stick hacia arriba = caminar hacia adelante.
    const moveX = pad.left.x;
    const moveY = pad.left.y;
    if (moveX === 0 && moveY === 0) return;

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();

    right.current.crossVectors(forward.current, camera.up).normalize();

    const step = SPEED * delta;
    camera.position.addScaledVector(forward.current, -moveY * step);
    camera.position.addScaledVector(right.current, moveX * step);

    // Se mueve primero y se corrige después ("mover y resolver"): es más
    // simple que predecir el choque y, con pasos de ~7 cm por frame contra
    // paredes de 20 cm de espesor, no hay forma de atravesarlas de un salto.
    resolveCollisions(camera.position, PLAYER_RADIUS);
  });

  return null;
}