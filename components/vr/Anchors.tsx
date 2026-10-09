"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { currentAlignment } from "@/lib/view/recenter";

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
export function BodyAnchor({
  children,
  followLimit = FOLLOW_LIMIT,
}: {
  children: ReactNode;
  /** Cuánto se puede girar la cabeza antes de que lo sigan, en radianes. */
  followLimit?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const euler = useMemo(() => new THREE.Euler(), []);
  const yaw = useRef<number | null>(null);
  const alignmentSeen = useRef(currentAlignment().version);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    euler.setFromQuaternion(camera.quaternion, "YXZ");
    if (yaw.current === null) yaw.current = euler.y;
    // Se centró la vista (lib/view/recenter.ts): los paneles van al nuevo
    // frente de una vez, sin esperar a que la cámara termine de girar.
    const alignment = currentAlignment();
    if (alignment.version !== alignmentSeen.current) {
      alignmentSeen.current = alignment.version;
      yaw.current = alignment.yaw;
    }
    const diff = Math.atan2(Math.sin(euler.y - yaw.current), Math.cos(euler.y - yaw.current));
    if (Math.abs(diff) > followLimit) {
      yaw.current += diff - Math.sign(diff) * followLimit;
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
/**
 * Lo pegado a la vista se diseña a 1.6 m, pero se dibuja a 1 m (misma
 * escala aparente): así queda DELANTE de los paneles (a 1.3 m). A 1.6 m,
 * mirando un panel, el panel tapaba el "Te escucho…" y los subtítulos del
 * tutor, y parecía que el botón de preguntar no hacía nada.
 */
const HEAD_NEAR = 1 / 1.6;

export function HeadAnchor({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group}>
      <group scale={HEAD_NEAR}>{children}</group>
    </group>
  );
}
