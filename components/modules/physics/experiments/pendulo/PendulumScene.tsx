"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { REFERENCE, type PendulumEngine } from "./engine";
import styles from "./PendulumScene.module.css";
import { SceneLabel } from "@/components/vr/SceneLabel";

/*
 * Un bastidor con los dos péndulos colgando lado a lado, a escala real (1
 * unidad = 1 m): el de referencia a la izquierda, el del jugador a la
 * derecha. Lado a lado y no uno detrás del otro porque lo que se compara es
 * el ritmo, y eso se ve de un vistazo solo si los dos están en la misma
 * línea de visión. A la derecha del bastidor, las barras de energía del
 * péndulo del jugador.
 */
const PIVOT_Y = 4.3;
const REF_X = 3.3;
const MINE_X = 6.7;
const FRAME_LEFT = 1.8;
const FRAME_RIGHT = 8.2;

/* Barras bajas a propósito: la esquina superior derecha de la pantalla es del
   panel de resultados, y con 2.6 m de alto quedaban debajo de él. */
const BARS_X = 9.2;
const BARS_Y = 0.3;
const BARS_HEIGHT = 1.4;

const METAL = { color: "#8e9bb0", metalness: 0.85, roughness: 0.3 } as const;

function bobRadius(mass: number) {
  // Radio ∝ ∛masa: así una bola del doble de masa se ve del doble de volumen.
  return 0.05 + 0.1 * Math.cbrt(mass);
}

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function PendulumScene({ engine, variables }: Props) {
  const pendulum = engine as PendulumEngine;

  useFixedTimestep((dt) => {
    pendulum.update(dt, variables);
  });

  const refArm = useRef<THREE.Group>(null);
  const mineArm = useRef<THREE.Group>(null);
  const mineRod = useRef<THREE.Mesh>(null);
  const mineBob = useRef<THREE.Mesh>(null);
  const kineticBar = useRef<THREE.Mesh>(null);
  const potentialBar = useRef<THREE.Mesh>(null);
  const refLabel = useRef<HTMLDivElement>(null);
  const mineLabel = useRef<HTMLDivElement>(null);
  const ratioLabel = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const r = pendulum.getRuntime();

    if (refArm.current) refArm.current.rotation.z = r.reference.theta;
    if (mineArm.current) mineArm.current.rotation.z = r.player.theta;
    if (mineRod.current) {
      mineRod.current.scale.y = r.length;
      mineRod.current.position.y = -r.length / 2;
    }
    if (mineBob.current) {
      mineBob.current.position.y = -r.length;
      mineBob.current.scale.setScalar(bobRadius(r.mass));
    }

    // Barras de energía: crecen desde abajo. Su suma es 1 sin rozamiento.
    const setBar = (mesh: THREE.Mesh | null, value: number) => {
      if (!mesh) return;
      const v = Math.max(0.001, Math.min(1.2, value));
      mesh.scale.y = v;
      mesh.position.y = BARS_Y + (v * BARS_HEIGHT) / 2;
    };
    setBar(kineticBar.current, r.kinetic);
    setBar(potentialBar.current, r.potential);

    const fmt = (periods: number[]) =>
      periods.length ? `${periods[periods.length - 1].toFixed(3)} s` : "—";
    if (refLabel.current) refLabel.current.textContent = `Referencia · T = ${fmt(r.reference.periods)}`;
    if (mineLabel.current) mineLabel.current.textContent = `Tu péndulo · T = ${fmt(r.player.periods)}`;
    if (ratioLabel.current) {
      ratioLabel.current.textContent =
        r.ratio === null
          ? r.phase === "listo"
            ? "Suelta los péndulos para medir"
            : "Midiendo el período…"
          : `Tu período / referencia = ${r.ratio.toFixed(3)}`;
      ratioLabel.current.dataset.synced = String(r.ratio !== null && Math.abs(r.ratio - 1) <= 0.01);
    }
  });

  return (
    <group>
      {/* Bastidor. */}
      {[FRAME_LEFT, FRAME_RIGHT].map((x) => (
        <mesh key={x} position={[x, PIVOT_Y / 2 + 0.05, 0]} castShadow>
          <boxGeometry args={[0.12, PIVOT_Y + 0.1, 0.12]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      <mesh position={[(FRAME_LEFT + FRAME_RIGHT) / 2, PIVOT_Y + 0.08, 0]} castShadow>
        <boxGeometry args={[FRAME_RIGHT - FRAME_LEFT + 0.12, 0.14, 0.14]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {[FRAME_LEFT, FRAME_RIGHT].map((x) => (
        <mesh key={`base${x}`} position={[x, 0.03, 0]} receiveShadow>
          <boxGeometry args={[0.5, 0.06, 1.2]} />
          <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}

      {/* Péndulo de referencia: fijo, gris. */}
      <group position={[REF_X, PIVOT_Y, 0]}>
        <group ref={refArm}>
          <mesh position={[0, -REFERENCE.length / 2, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, REFERENCE.length, 8]} />
            <meshStandardMaterial color="#c0c7d2" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, -REFERENCE.length, 0]} castShadow scale={bobRadius(1)}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
        <SceneLabel position={[0, 0.45, 0]} center>
          <div ref={refLabel} className={styles.label} data-kind="ref" />
        </SceneLabel>
      </group>

      {/* Péndulo del jugador: turquesa, con longitud y masa variables. */}
      <group position={[MINE_X, PIVOT_Y, 0]}>
        <group ref={mineArm}>
          {/* Cilindro de altura 1 escalado a la longitud en cada frame. */}
          <mesh ref={mineRod} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 1, 8]} />
            <meshStandardMaterial color="#c0c7d2" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh ref={mineBob} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial
              color="#2dd4bf"
              emissive="#2dd4bf"
              emissiveIntensity={0.25}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
        </group>
        <SceneLabel position={[0, 0.45, 0]} center>
          <div ref={mineLabel} className={styles.label} data-kind="mine" />
        </SceneLabel>
      </group>

      <SceneLabel position={[(REF_X + MINE_X) / 2, PIVOT_Y + 0.95, 0]} center>
        <div ref={ratioLabel} className={styles.ratio} />
      </SceneLabel>

      {/* Barras de energía del péndulo del jugador. */}
      <mesh position={[BARS_X + 0.3, BARS_Y + BARS_HEIGHT / 2, -0.12]}>
        <boxGeometry args={[1.2, BARS_HEIGHT, 0.05]} />
        <meshStandardMaterial color="#131b2e" transparent opacity={0.85} />
      </mesh>
      <mesh position={[BARS_X + 0.3, BARS_Y + BARS_HEIGHT, -0.05]}>
        <boxGeometry args={[1.2, 0.025, 0.025]} />
        <meshBasicMaterial color={new THREE.Color(2, 2, 2.2)} toneMapped={false} />
      </mesh>
      <mesh ref={kineticBar} position={[BARS_X, BARS_Y, 0]}>
        <boxGeometry args={[0.35, BARS_HEIGHT, 0.2]} />
        <meshBasicMaterial color={new THREE.Color(2.0, 1.25, 0.45)} toneMapped={false} />
      </mesh>
      <mesh ref={potentialBar} position={[BARS_X + 0.6, BARS_Y, 0]}>
        <boxGeometry args={[0.35, BARS_HEIGHT, 0.2]} />
        <meshBasicMaterial color={new THREE.Color(0.3, 2.2, 1.9)} toneMapped={false} />
      </mesh>
      <SceneLabel position={[BARS_X + 0.3, BARS_Y - 0.35, 0]} center>
        <div className={styles.barsLegend}>
          <span className={styles.barsTitle}>Energía (línea = 100 % al soltar)</span>
          <span>
            <span data-k>Cinética</span> · <span data-p>Potencial</span>
          </span>
        </div>
      </SceneLabel>
    </group>
  );
}
