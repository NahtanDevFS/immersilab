"use client";

import * as THREE from "three";
import { useTiledPbrTexture } from "../shell/useTiledPbrTexture";
import { Door } from "./Door";
import { lobbyDoors } from "./catalog";

const ROOM_HALF_WIDTH = 10;
const ROOM_HALF_DEPTH = 10;
const ROOM_HEIGHT = 5;

/**
 * Escena 3D del lobby: una sala cerrada (piso, techo, 4 paredes) con
 * texturas PBR reales (Poly Haven, CC0) y una puerta por experimento del
 * catálogo. A diferencia de los experimentos (que usan LabBackground —
 * cielo abierto), este es un espacio cerrado.
 *
 * side={THREE.DoubleSide} en paredes/techo es a propósito: si alguna
 * rotación quedara mal calculada, con una sola cara se vería como un
 * agujero en vez de una pared — con doble cara ese error queda invisible
 * en vez de romper la sala.
 */
export function LobbyScene() {
  // Marble 01 (Poly Haven) es ~1.5m de ancho real → repite ~13 veces en
  // un piso de 20m. Grey Plaster es ~1m de ancho → repite 20x horizontal,
  // 5x vertical en paredes de 20m x 5m.
  const floorTex = useTiledPbrTexture("/textures/floor/marble_01", 13, 13);
  const wallTex = useTiledPbrTexture("/textures/wall/grey_plaster", 20, 5);

  return (
    <group>
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HALF_DEPTH * 2]} />
        <meshStandardMaterial {...floorTex} />
      </mesh>

      {/* Techo — se queda con color plano, no hace falta textura ahí */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_HEIGHT, 0]}>
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HALF_DEPTH * 2]} />
        <meshStandardMaterial color="#0b1220" side={THREE.DoubleSide} />
      </mesh>

      {/* Pared trasera (ahí va la puerta) */}
      <mesh position={[0, ROOM_HEIGHT / 2, -ROOM_HALF_DEPTH]}>
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial {...wallTex} side={THREE.DoubleSide} />
      </mesh>

      {/* Pared frontal */}
      <mesh
        position={[0, ROOM_HEIGHT / 2, ROOM_HALF_DEPTH]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[ROOM_HALF_WIDTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial {...wallTex} side={THREE.DoubleSide} />
      </mesh>

      {/* Pared izquierda */}
      <mesh
        position={[-ROOM_HALF_WIDTH, ROOM_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[ROOM_HALF_DEPTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial {...wallTex} side={THREE.DoubleSide} />
      </mesh>

      {/* Pared derecha */}
      <mesh
        position={[ROOM_HALF_WIDTH, ROOM_HEIGHT / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[ROOM_HALF_DEPTH * 2, ROOM_HEIGHT]} />
        <meshStandardMaterial {...wallTex} side={THREE.DoubleSide} />
      </mesh>

      {lobbyDoors.map((door) => (
        <Door key={door.href} {...door} />
      ))}
    </group>
  );
}