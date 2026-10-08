"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Giro acumulado que cuenta como "ya sabe mirar". */
const LOOK_RADIANS = (60 * Math.PI) / 180;
/** Distancia acumulada que cuenta como "ya sabe caminar". */
const WALK_METERS = 2;
/**
 * Al arrancar, el giroscopio lleva la cámara de golpe a donde apunta el
 * celular: ese salto no es el alumno mirando, así que el primer segundo no
 * se cuenta.
 */
const WARMUP_SECONDS = 1;

interface Props {
  onLook: () => void;
  onWalk: () => void;
}

/**
 * Mide, dentro del Canvas, si el alumno ya miró alrededor y ya caminó, para
 * que el tutorial avance cuando lo hace de verdad y no con un botón. Avisa
 * una sola vez por cada cosa; no provoca renders por frame.
 *
 * No importa con qué lo haga (giroscopio, arrastre, stick o teclado): se
 * mide la cámara, que es donde terminan todas las entradas.
 */
export function TutorialProbe({ onLook, onWalk }: Props) {
  const camera = useThree((state) => state.camera);
  const euler = useRef(new THREE.Euler());
  const last = useRef<{ yaw: number; x: number; z: number } | null>(null);
  const progress = useRef({ elapsed: 0, turned: 0, walked: 0, looked: false, moved: false });

  useFrame((_, delta) => {
    const p = progress.current;
    if (p.looked && p.moved) return;

    euler.current.setFromQuaternion(camera.quaternion, "YXZ");
    const now = { yaw: euler.current.y, x: camera.position.x, z: camera.position.z };
    const prev = last.current;
    last.current = now;
    p.elapsed += delta;
    if (!prev || p.elapsed < WARMUP_SECONDS) return;

    const turn = now.yaw - prev.yaw;
    p.turned += Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
    p.walked += Math.hypot(now.x - prev.x, now.z - prev.z);

    if (!p.looked && p.turned > LOOK_RADIANS) {
      p.looked = true;
      onLook();
    }
    if (!p.moved && p.walked > WALK_METERS) {
      p.moved = true;
      onWalk();
    }
  });

  return null;
}
