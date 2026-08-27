"use client";

import { Sky } from "@react-three/drei";

// Colores tomados de los tokens de diseño (ver app/globals.css), en formato
// que Three.js acepta directamente.
const GROUND_COLOR = "#3a4a5e";
const MOUNTAIN_COLOR = "#1c2740";
const FOG_COLOR = "#16233a";

interface MountainProps {
  position: [number, number, number];
  radius: number;
  height: number;
}

function Mountain({ position, radius, height }: MountainProps) {
  return (
    <mesh position={position}>
      <coneGeometry args={[radius, height, 4]} />
      <meshBasicMaterial color={MOUNTAIN_COLOR} fog />
    </mesh>
  );
}

/**
 * Fondo visual compartido por todos los experimentos: cielo con niebla y
 * una silueta de montañas de referencia, en vez del piso gris plano
 * original. Es liviano a propósito (sin props/modelos externos) — el
 * ambiente con assets reales (Poly Pizza/Poly Haven) es la Fase 7 del plan.
 *
 * Debe renderizarse DENTRO de un <Canvas> de React Three Fiber, antes del
 * SceneComponent de cada experimento (para que quede detrás).
 */
export function LabBackground() {
  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 25, 90]} />

      <Sky
        distance={450000}
        sunPosition={[-6, 0.6, -10]}
        turbidity={6}
        rayleigh={2.5}
        mieCoefficient={0.01}
        mieDirectionalG={0.9}
      />

      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color={GROUND_COLOR} />
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