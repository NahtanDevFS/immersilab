"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { currentAlignment } from "@/lib/view/recenter";

/** Cuánto se puede girar la cabeza antes de que los paneles la sigan. */
const FOLLOW_LIMIT = (55 * Math.PI) / 180;

/*
 * La interfaz del visor se dibuja ENCIMA de la escena: sin esto, un panel a
 * 1.3 m atravesaba la pared o el suelo que estuviera más cerca y quedaba
 * cortado. Es lo que hacen casi todas las apps de realidad virtual con sus
 * menús (la mira ya funcionaba así).
 *
 * - Sin prueba de profundidad: ni la escena la tapa ni ella tapa a la escena
 *   en el buffer de profundidad.
 * - Todo en la pasada de transparentes, que va después de la escena, y con
 *   un orden fijo: el del árbol (el fondo de un panel se declara antes que
 *   su texto, así que el texto queda encima). Lo pegado a la vista va
 *   después que los paneles; la mira, después de todo.
 * - Se repasa cada pocos cuadros: el texto 3D arma su material de a poco y
 *   lo vuelve a armar si cambia el texto.
 */
const BODY_LAYER = 2000;
const HEAD_LAYER = 50000;
const RELAYER_EVERY = 3; // cuadros

function overlayMaterial(material: THREE.Material) {
  if (material.userData.vrOverlay) return;
  material.userData.vrOverlay = true;
  material.depthTest = false;
  material.depthWrite = false;
  material.transparent = true;
  material.needsUpdate = true;
}

/** Pone todo lo que cuelga de `root` encima de la escena, en el orden del árbol. */
function layerAsOverlay(root: THREE.Object3D, base: number) {
  let order = base;
  root.traverse((object) => {
    const withMaterial = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    if (!withMaterial.material) return;
    object.renderOrder = order++;
    const materials = Array.isArray(withMaterial.material) ? withMaterial.material : [withMaterial.material];
    materials.forEach(overlayMaterial);
  });
}

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
  const frames = useRef(0);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    if (frames.current++ % RELAYER_EVERY === 0) layerAsOverlay(g, BODY_LAYER);
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
    g.rotation.set(0, yaw.current, 0, "YXZ");
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
  const frames = useRef(0);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    if (frames.current++ % RELAYER_EVERY === 0) layerAsOverlay(g, HEAD_LAYER);
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group}>
      <group scale={HEAD_NEAR}>{children}</group>
    </group>
  );
}
