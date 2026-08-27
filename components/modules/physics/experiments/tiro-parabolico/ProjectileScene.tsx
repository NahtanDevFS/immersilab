"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import type { ProjectileEngine } from "./engine";

const DEG = Math.PI / 180;
const MAX_TRAIL_POINTS = 300;

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function ProjectileScene({ engine, variables }: Props) {
  const projectile = engine as ProjectileEngine;

  const ballRef = useRef<THREE.Mesh>(null);
  const cannonRef = useRef<THREE.Group>(null);
  const trailGeometryRef = useRef<THREE.BufferGeometry>(null);

  const trailPositions = useMemo(
    () => new Float32Array(MAX_TRAIL_POINTS * 3),
    [],
  );

  // Avanza la física un paso fijo (1/60s) por tick, desacoplado del framerate.
  useFixedTimestep((dt) => {
    projectile.update(dt, variables);
  });

  // Lee el estado del motor cada frame y actualiza lo visual.
  useFrame(() => {
    const runtime = projectile.getRuntime();

    if (ballRef.current) {
      ballRef.current.position.set(
        runtime.position.x,
        runtime.position.y + 0.15,
        0,
      );
    }

    if (cannonRef.current) {
      const angle = Number(variables.angle ?? 45) * DEG;
      cannonRef.current.rotation.z = angle;
    }

    if (trailGeometryRef.current) {
      const points = runtime.trail.slice(-MAX_TRAIL_POINTS);
      points.forEach((p, i) => {
        trailPositions[i * 3] = p.x;
        trailPositions[i * 3 + 1] = p.y + 0.15;
        trailPositions[i * 3 + 2] = 0;
      });
      trailGeometryRef.current.setDrawRange(0, points.length);
      const attr = trailGeometryRef.current.attributes
        .position as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Cañón: pivotea en el origen, la barra se dibuja desplazada en X
          para que la punta gire alrededor de la base al cambiar el ángulo. */}
      <group ref={cannonRef} position={[0, 0.2, 0]}>
        <mesh position={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[1, 0.15, 0.15]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      </group>

      {/* Proyectil */}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#e24b4a" />
      </mesh>

      {/* Trayectoria */}
      <line>
        <bufferGeometry ref={trailGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
            count={MAX_TRAIL_POINTS}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f2a65a" />
      </line>
    </group>
  );
}