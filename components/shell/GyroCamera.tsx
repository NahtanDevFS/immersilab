"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrientationState } from "./useDeviceOrientation";

const DEG = Math.PI / 180;

interface Props {
  orientation: OrientationState;
  enabled: boolean;
}

/**
 * Aplica la orientación física del dispositivo a la cámara.
 * Se suaviza con interpolación para evitar el "jitter" del sensor.
 */
export function GyroCamera({ orientation, enabled }: Props) {
  const { camera } = useThree();
  const target = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());
  const screenTransform = useRef(
    new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)),
  );

  useFrame(() => {
    if (!enabled) return;

    const { alpha, beta, gamma } = orientation;

    // Orden 'YXZ' es el que corresponde a la convención de DeviceOrientation.
    euler.current.set(beta * DEG, alpha * DEG, -gamma * DEG, "YXZ");
    target.current.setFromEuler(euler.current);

    // Corrige el hecho de que la pantalla mira hacia el usuario, no hacia arriba.
    target.current.multiply(screenTransform.current);

    // Suavizado — evita que la cámara tiemble con el ruido del sensor.
    camera.quaternion.slerp(target.current, 0.15);
  });

  return null;
}
