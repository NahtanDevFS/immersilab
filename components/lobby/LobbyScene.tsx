"use client";

import * as THREE from "three";
import { Door } from "./Door";
import { lobbyDoors } from "./catalog";

const ROOM_HALF_WIDTH = 10;
const ROOM_HALF_DEPTH = 10;
const ROOM_HEIGHT = 5;

/**
 * Escena 3D del lobby: una sala cerrada (piso, techo, 4 paredes) con una
 * puerta por experimento del catálogo. A diferencia de los experimentos
 * (que usan LabBackground — cielo abierto), este es un espacio cerrado.
 *
 * side={THREE.DoubleSide} en paredes/techo es a propósito: si alguna
 * rotación quedara mal calculada, con una sola cara se vería como un
 * agujero en vez de una pared — con doble cara ese error queda invisible
 * en vez de romper la sala.
 */
export function LobbyScene() {
  return (
    <group>
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HALF_DEPTH * 2]} />
        <meshStandardMaterial color="#131b2e" />
      </mesh>

      {/* Techo */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_HEIGHT, 0]}>
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HALF_DEPTH * 2]} />
        <meshStandardMaterial color="#0b1220" side={THREE.DoubleSide} />
      </mesh>

      {/* Pared trasera (ahí va la puerta) */}
      <mesh position={[0, ROOM_HEIGHT / 2, -ROOM_HALF_DEPTH]}>
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#1a2540" side={THREE.DoubleSide} />
      </mesh>

      {/* Pared frontal */}
      <mesh
        position={[0, ROOM_HEIGHT / 2, ROOM_HALF_DEPTH]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#1a2540" side={THREE.DoubleSide} />
      </mesh>

      {/* Pared izquierda */}
      <mesh
        position={[-ROOM_HALF_WIDTH, ROOM_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[ROOM_HALF_DEPTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#1a2540" side={THREE.DoubleSide} />
      </mesh>

      {/* Pared derecha */}
      <mesh
        position={[ROOM_HALF_WIDTH, ROOM_HEIGHT / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[ROOM_HALF_DEPTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#1a2540" side={THREE.DoubleSide} />
      </mesh>

      {lobbyDoors.map((door) => (
        <Door key={door.href} {...door} />
      ))}
    </group>
  );
}