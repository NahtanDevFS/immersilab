"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Emplazamiento del cañón: un parapeto de sacos de arena alrededor de un
 * piso de tierra.
 *
 * El cañón está hundido para que el pivote del tubo quede al ras del suelo
 * (de ahí sale el disparo, ver engine.ts). El pasto tapa la cureña y las
 * ruedas; los sacos esconden el borde donde el suelo corta el cañón y hacen
 * que se lea como una posición de tiro, no como un cañón enterrado.
 *
 * El parapeto deja libre el frente (hacia +X): por ahí sale el tubo en los
 * ángulos bajos.
 */

/** Radio del parapeto, medido desde el pivote, m. */
const RADIUS = 2.7;
/** Hilera de sacos: largo de cada uno sobre el arco y alto de cada capa, m. */
const BAG_LENGTH = 0.62;
const BAG_HEIGHT = 0.19;
const LAYERS = 3;
/** Medio ancho de la abertura del frente, rad. */
const OPENING = (40 * Math.PI) / 180;

const BAG_COLORS = ["#a8956b", "#9c8a62", "#b29f74", "#968459"];

function bagGeometry(): THREE.BufferGeometry {
  // Una cápsula acostada y aplastada se parece bastante a un saco relleno.
  const geometry = new THREE.CapsuleGeometry(0.15, BAG_LENGTH - 0.3, 4, 10);
  geometry.rotateZ(Math.PI / 2);
  geometry.scale(1, (BAG_HEIGHT / 0.3) * 1.08, 1.15);
  return geometry;
}

/** Dónde va cada saco: anillo abierto al frente, capas trabadas como ladrillos. */
function bagPlacements(): Array<{ position: THREE.Vector3; angle: number; color: THREE.Color }> {
  const placements: Array<{ position: THREE.Vector3; angle: number; color: THREE.Color }> = [];
  const span = 2 * Math.PI - 2 * OPENING;
  for (let layer = 0; layer < LAYERS; layer++) {
    // Cada capa un poco más adentro: el parapeto queda en talud.
    const radius = RADIUS - layer * 0.08;
    const count = Math.floor((span * radius) / BAG_LENGTH);
    const step = span / count;
    // Una capa sí y otra no corrida medio saco, como se apilan de verdad.
    const offset = layer % 2 === 0 ? 0.5 : 1;
    for (let i = 0; i < count - (layer % 2); i++) {
      const a = OPENING + (i + offset) * step;
      placements.push({
        position: new THREE.Vector3(Math.cos(a) * radius, BAG_HEIGHT * (layer + 0.5), Math.sin(a) * radius),
        angle: a,
        color: new THREE.Color(BAG_COLORS[(i * 7 + layer * 3) % BAG_COLORS.length]),
      });
    }
  }
  return placements;
}

export function Trench() {
  const geometry = useMemo(() => bagGeometry(), []);
  const placements = useMemo(() => bagPlacements(), []);
  const bags = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = bags.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3(1, 1, 1);
    placements.forEach((p, i) => {
      // El largo del saco sigue el arco (tangente al círculo).
      rotation.setFromAxisAngle(up, -p.angle + Math.PI / 2);
      matrix.compose(p.position, rotation, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, p.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [placements]);

  return (
    <group>
      {/* Piso de tierra apisonada dentro del parapeto. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <circleGeometry args={[RADIUS + 0.2, 48]} />
        <meshStandardMaterial color="#6f5d44" roughness={1} />
      </mesh>
      <instancedMesh ref={bags} args={[geometry, undefined, placements.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.95} metalness={0} />
      </instancedMesh>
    </group>
  );
}
