"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Cuánto se puede girar la cabeza antes de que los paneles la sigan. */
const FOLLOW_LIMIT = (55 * Math.PI) / 180;

/**
 * Paneles "de cuerpo": acompañan al usuario cuando camina y quedan a sus
 * costados. Si gira mucho (más de 55°), lo siguen hasta quedar en el borde,
 * como cuando uno se da vuelta con la mesa de trabajo enfrente. No siguen el
 * cabeceo: mirar abajo o arriba no los mueve.
 *
 * Anclarlos a la cabeza (que se muevan con cada giro) no sirve para paneles
 * grandes: nunca se podría mirar uno de costado, siempre quedaría en el
 * mismo lugar de la vista. Dejarlos fijos en el mundo tampoco: al caminar
 * quedarían atrás.
 */
export function BodyAnchor({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const euler = useMemo(() => new THREE.Euler(), []);
  const yaw = useRef<number | null>(null);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    euler.setFromQuaternion(camera.quaternion, "YXZ");
    if (yaw.current === null) yaw.current = euler.y;
    const diff = Math.atan2(Math.sin(euler.y - yaw.current), Math.cos(euler.y - yaw.current));
    if (Math.abs(diff) > FOLLOW_LIMIT) {
      yaw.current += diff - Math.sign(diff) * FOLLOW_LIMIT;
    }
    g.rotation.set(0, yaw.current, 0);
  });

  return <group ref={group}>{children}</group>;
}

/**
 * Lo que va pegado a la vista (subtítulos, avisos): se mueve con la cabeza,
 * siempre en el mismo lugar del campo visual. Solo para cosas chicas y
 * pasajeras; un panel grande así marea.
 */
export function HeadAnchor({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
  });

  return <group ref={group}>{children}</group>;
}
