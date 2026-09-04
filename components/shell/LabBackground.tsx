"use client";

import { Environment } from "@react-three/drei";
import { useTiledPbrTexture } from "./useTiledPbrTexture";

const MOUNTAIN_COLOR = "#1c2740";
// Tono cálido para que combine con el horizonte del HDRI (antes era un
// azul frío, pensado para el <Sky> procedural que ya no usamos) — ajustable
// a ojo una vez que se vea el HDRI real, no hay forma de saber el tono
// exacto del horizonte sin probarlo.
const FOG_COLOR = "#c9a888";

interface MountainProps {
  position: [number, number, number];
  radius: number;
  height: number;
}

function Mountain({ position, radius, height }: MountainProps) {
  return (
    <mesh position={position}>
      {/* 8 caras en vez de 4: con 4 se veía literalmente como una
          pirámide de base cuadrada — con más caras se lee como una
          silueta de montaña, no como una figura geométrica. */}
      <coneGeometry args={[radius, height, 8]} />
      <meshBasicMaterial color={MOUNTAIN_COLOR} fog />
    </mesh>
  );
}

/**
 * Fondo visual compartido por todos los experimentos: cielo real (HDRI de
 * Poly Haven, CC0) con niebla, pasto real y una silueta de montañas de
 * referencia.
 *
 * El HDRI reemplaza al <Sky> procedural que había antes: además de verse
 * mejor, drei lo usa automáticamente también como iluminación ambiente de
 * toda la escena (reflejos y tono de luz más realistas), no solo como
 * fondo visual.
 *
 * Las montañas se quedan con color plano a propósito: están tapadas por
 * la niebla y son de fondo — texturarlas de más no se notaría y no vale
 * el peso extra de descarga.
 *
 * Debe renderizarse DENTRO de un <Canvas> de React Three Fiber, antes del
 * SceneComponent de cada experimento (para que quede detrás).
 */
export function LabBackground() {
  // Leafy Grass (Poly Haven) es ~2m de ancho real → repite 75 veces en un
  // piso de 150m.
  const groundTex = useTiledPbrTexture("/textures/grass/leafy_grass", 75, 75);

  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 25, 90]} />

      <Environment
        files="/textures/sky/qwantani_dusk_2_puresky.hdr"
        background
        environmentIntensity={0.2}
      />

      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial {...groundTex} />
      </mesh>

      {/* Montañas: siluetas simples y lejanas, solo como referencia visual
          — no reciben sombra ni luz, se funden con la niebla. */}
      <Mountain position={[-30, 6, -40]} radius={14} height={16} />
      <Mountain position={[-8, 5, -55]} radius={12} height={13} />
      <Mountain position={[20, 7, -45]} radius={16} height={18} />
      <Mountain position={[45, 5, -35]} radius={11} height={12} />
    </>
  );
}