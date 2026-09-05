"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import type { QamEngine } from "./engine";

/*
 * El plano I/Q se dibuja de pie, como una pantalla de analizador vectorial:
 * el jugador queda parado frente a él. Tirarlo sobre el piso se probó y se
 * lee peor — la nube de puntos se ve en escorzo y deja de notarse cuándo un
 * símbolo cruzó la frontera hacia el vecino, que es lo único que importa acá.
 */
const PLANE_SCALE = 2.4;
const PLANE_Y = 2.1;
const MAX_POINTS = 600;

const IDEAL_COLOR = new THREE.Color(0.4, 2.6, 2.2);
const AXIS_COLOR = new THREE.Color(0.9, 0.95, 1.1);

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function QamScene({ engine, variables }: Props) {
  const qam = engine as QamEngine;

  const cloudRef = useRef<THREE.InstancedMesh>(null);
  const idealRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFixedTimestep((dt) => {
    qam.update(dt, variables);
  });

  useFrame(() => {
    const runtime = qam.getRuntime();

    // Puntos ideales: dónde DEBERÍA caer cada símbolo. Son la referencia
    // contra la que se lee todo lo demás.
    if (idealRef.current) {
      runtime.ideal.forEach((point, i) => {
        if (i >= MAX_POINTS) return;
        dummy.position.set(
          point.i * PLANE_SCALE,
          PLANE_Y + point.q * PLANE_SCALE,
          0,
        );
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        idealRef.current!.setMatrixAt(i, dummy.matrix);
      });
      idealRef.current.count = Math.min(runtime.ideal.length, MAX_POINTS);
      idealRef.current.instanceMatrix.needsUpdate = true;
    }

    // La nube recibida. Cada punto se pinta según si el receptor lo decodificó
    // bien o mal: en verde el que cayó del lado correcto de la frontera, en
    // rojo el que el ruido empujó al territorio del vecino. Ver los rojos
    // aparecer justo cuando la nube empieza a solaparse es, en una imagen,
    // toda la relación entre SNR, densidad de constelación y errores.
    if (cloudRef.current) {
      const points = runtime.received.slice(-MAX_POINTS);
      const offset = runtime.received.length - points.length;

      points.forEach((point, i) => {
        dummy.position.set(
          point.i * PLANE_SCALE,
          PLANE_Y + point.q * PLANE_SCALE,
          0.02,
        );
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        cloudRef.current!.setMatrixAt(i, dummy.matrix);

        const index = offset + i;
        const wrong = runtime.decoded[index] !== runtime.sent[index];
        color.set(wrong ? "#e24b4a" : "#7cf5c8");
        cloudRef.current!.setColorAt(i, color);
      });

      cloudRef.current.count = points.length;
      cloudRef.current.instanceMatrix.needsUpdate = true;
      if (cloudRef.current.instanceColor) {
        cloudRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Ejes I y Q. */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                -PLANE_SCALE * 1.6, PLANE_Y, 0,
                PLANE_SCALE * 1.6, PLANE_Y, 0,
              ]),
              3,
            ]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color={AXIS_COLOR} toneMapped={false} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                0, PLANE_Y - PLANE_SCALE * 1.6, 0,
                0, PLANE_Y + PLANE_SCALE * 1.6, 0,
              ]),
              3,
            ]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color={AXIS_COLOR} toneMapped={false} />
      </line>

      {/* Panel de fondo: le da a la nube un plano sobre el que leerse. Sin
          él, los puntos flotan contra el pasto y no se distingue el borde
          del diagrama. */}
      <mesh position={[0, PLANE_Y, -0.05]}>
        <planeGeometry args={[PLANE_SCALE * 3.4, PLANE_SCALE * 3.4]} />
        <meshStandardMaterial
          color="#0b1220"
          transparent
          opacity={0.55}
          roughness={0.9}
        />
      </mesh>

      {/* Símbolos ideales. */}
      <instancedMesh ref={idealRef} args={[undefined, undefined, MAX_POINTS]}>
        <ringGeometry args={[0.07, 0.1, 16]} />
        <meshStandardMaterial
          color={IDEAL_COLOR}
          emissive={IDEAL_COLOR}
          emissiveIntensity={1}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Símbolos recibidos. */}
      <instancedMesh ref={cloudRef} args={[undefined, undefined, MAX_POINTS]}>
        <circleGeometry args={[0.045, 10]} />
        <meshStandardMaterial
          vertexColors
          emissive="#ffffff"
          emissiveIntensity={0.35}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Antena del receptor: da contexto físico al diagrama, que si no es
          un gráfico flotando en un campo. */}
      <group position={[-4.2, 0, 0.5]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.09, 2.8, 10]} />
          <meshStandardMaterial color="#8e9bb0" metalness={0.85} roughness={0.3} />
        </mesh>
        {[2.2, 2.5, 2.8].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 1.1 - i * 0.25, 8]} />
            <meshStandardMaterial color="#8e9bb0" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
