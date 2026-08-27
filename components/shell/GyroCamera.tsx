"use client";

import { useEffect, useRef } from "react";
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
 *
 * IMPORTANTE: los eventos deviceorientation (alpha/beta/gamma) siempre
 * llegan como si el teléfono estuviera en vertical, sin importar cómo lo
 * estés sosteniendo ni cómo se vea la pantalla — es una convención fija
 * del sensor, no algo que se ajuste solo. Como este laboratorio fuerza
 * horizontal (ver OrientationGate), hay que restarle ese giro de 90°
 * leyendo `screen.orientation.angle`; si no, la cámara solo queda derecha
 * sosteniendo el teléfono en vertical (el bug que estábamos viendo).
 */
export function GyroCamera({ orientation, enabled }: Props) {
  const { camera } = useThree();
  const target = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());
  const screenTransform = useRef(
    new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)),
  );
  const screenAngleCorrection = useRef(new THREE.Quaternion());
  const zAxis = useRef(new THREE.Vector3(0, 0, 1));
  const screenAngle = useRef(0);

  // El ángulo de pantalla puede cambiar mientras la app corre (si el
  // usuario gira el teléfono entre las dos orientaciones horizontales),
  // así que se escucha el evento en vez de leerlo una sola vez.
  useEffect(() => {
    const updateAngle = () => {
      screenAngle.current = (screen.orientation?.angle ?? 0) * DEG;
    };
    updateAngle();
    screen.orientation?.addEventListener("change", updateAngle);
    return () => screen.orientation?.removeEventListener("change", updateAngle);
  }, []);

  useFrame(() => {
    if (!enabled) return;

    const { alpha, beta, gamma } = orientation;

    // Orden 'YXZ' es el que corresponde a la convención de DeviceOrientation.
    euler.current.set(beta * DEG, alpha * DEG, -gamma * DEG, "YXZ");
    target.current.setFromEuler(euler.current);

    // Corrige el hecho de que la pantalla mira hacia el usuario, no hacia arriba.
    target.current.multiply(screenTransform.current);

    // Corrige el giro de 90° por sostener el teléfono en horizontal.
    target.current.multiply(
      screenAngleCorrection.current.setFromAxisAngle(
        zAxis.current,
        -screenAngle.current,
      ),
    );

    // Suavizado — evita que la cámara tiemble con el ruido del sensor.
    camera.quaternion.slerp(target.current, 0.15);
  });

  return null;
}