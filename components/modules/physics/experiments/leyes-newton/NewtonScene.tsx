"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { SceneLabel } from "@/components/vr/SceneLabel";
import { RAMP_LENGTH, configOf, forcesOf, type Forces, type NewtonEngine, type NewtonRuntime } from "./engine";
import styles from "./NewtonScene.module.css";

/** Pie de la rampa (donde está la bisagra). */
const PIVOT = new THREE.Vector3(-2, 0.3, 0);
const RAMP_THICK = 0.12;
const BOX = 0.5;
/** Mesa de la polea. */
const TABLE_TOP = 1.0;
const TABLE_LEFT = -2.2;
const TABLE_W = 3.2;
const PULLEY = new THREE.Vector3(TABLE_LEFT + TABLE_W + 0.1, TABLE_TOP + 0.12, 0);

/** Direcciones fijas: una sola instancia, para que las flechas no recalculen su giro. */
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const LEFT = new THREE.Vector3(-1, 0, 0);

/** Largo de flecha por newton: 1 m cada 50 N, con tope para que no se salga. */
const arrowLength = (newtons: number) => Math.min(3.2, Math.max(0.18, Math.abs(newtons) / 50));

const COLORS = {
  weight: "#60a5fa",
  normal: "#34d399",
  friction: "#f87171",
  applied: "#facc15",
  tension: "#c084fc",
  component: "#93c5fd",
};

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * Plano inclinado o mesa con polea, con el diagrama de cuerpo libre sobre la
 * caja: cada fuerza es una flecha de su color, con su valor. Las flechas
 * salen del centro de la caja y viajan con ella.
 */
export function NewtonScene({ engine, variables }: Props) {
  const newton = engine as NewtonEngine;
  useFixedTimestep((dt) => newton.update(dt, variables));

  const [runtime, setRuntime] = useState<NewtonRuntime>(() => ({ ...newton.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...newton.getRuntime() }), 120);
    return () => window.clearInterval(id);
  }, [newton]);

  // En reposo las fuerzas siguen a las variables al instante, sin esperar al motor.
  const forces = runtime.phase === "idle" ? forcesOf(configOf(variables)) : runtime.forces;
  const config = runtime.phase === "idle" ? configOf(variables) : runtime.config;
  const showComponents = Boolean(variables.componentes);

  return config.scenario === "plano" ? (
    <Incline newton={newton} angleDeg={config.angleDeg} mass={config.m} forces={forces} showComponents={showComponents} />
  ) : (
    <Pulley newton={newton} m1={config.m} m2={config.m2} forces={forces} />
  );
}

function Incline({
  newton, angleDeg, mass, forces, showComponents,
}: { newton: NewtonEngine; angleDeg: number; mass: number; forces: Forces; showComponents: boolean }) {
  const theta = (angleDeg * Math.PI) / 180;
  const up = useMemo(() => new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0), [theta]);
  const out = useMemo(() => new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0), [theta]);
  const box = useRef<THREE.Group>(null);
  const size = BOX * (0.8 + mass / 50);

  useFrame(() => {
    const g = box.current;
    if (!g) return;
    const s = newton.getRuntime().s;
    g.position.copy(PIVOT).addScaledVector(up, s).addScaledVector(out, RAMP_THICK / 2 + size / 2);
  });

  const down = useMemo(() => up.clone().negate(), [up]);
  const into = useMemo(() => out.clone().negate(), [out]);

  return (
    <group>
      {/* Rampa con su bisagra y un soporte, y el piso. */}
      <group position={PIVOT} rotation={[0, 0, theta]}>
        <mesh position={[RAMP_LENGTH / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[RAMP_LENGTH, RAMP_THICK, 1.1]} />
          <meshStandardMaterial color="#a16207" roughness={0.75} />
        </mesh>
      </group>
      <mesh position={[PIVOT.x + (RAMP_LENGTH * Math.cos(theta)) / 2, PIVOT.y / 2, 0]} receiveShadow>
        <boxGeometry args={[RAMP_LENGTH * Math.cos(theta) + 0.4, PIVOT.y, 1.3]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
      {angleDeg > 0.5 && (
        <mesh position={[PIVOT.x + RAMP_LENGTH * Math.cos(theta) - 0.05, PIVOT.y + (RAMP_LENGTH * Math.sin(theta)) / 2 - 0.05, 0]}>
          <boxGeometry args={[0.1, Math.max(0.01, RAMP_LENGTH * Math.sin(theta) - 0.1), 0.6]} />
          <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.5} />
        </mesh>
      )}
      <SceneLabel position={[PIVOT.x + 1.1, PIVOT.y + 0.15, 0.7]} center>
        <div className={styles.angle}>{`θ = ${angleDeg}°`}</div>
      </SceneLabel>

      <group ref={box}>
        <mesh rotation={[0, 0, theta]} castShadow>
          <boxGeometry args={[size, size, size]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.55} />
        </mesh>
        <Arrow dir={DOWN} newtons={forces.weight} color={COLORS.weight} label="mg" />
        <Arrow dir={out} newtons={forces.normal} color={COLORS.normal} label="N" />
        {Math.abs(forces.friction) > 0.05 && (
          <Arrow dir={forces.friction > 0 ? down : up} newtons={forces.friction} color={COLORS.friction} label={forces.moves ? "fk" : "fs"} />
        )}
        {Math.abs(forces.applied) > 0.05 && (
          <Arrow dir={forces.applied > 0 ? up : down} newtons={forces.applied} color={COLORS.applied} label="F" />
        )}
        {showComponents && (
          <>
            <Arrow dir={down} newtons={forces.weightAlong} color={COLORS.component} label="mg·sen θ" dashed />
            <Arrow dir={into} newtons={forces.weightPerp} color={COLORS.component} label="mg·cos θ" dashed />
          </>
        )}
      </group>
    </group>
  );
}

function Pulley({ newton, m1, m2, forces }: { newton: NewtonEngine; m1: number; m2: number; forces: Forces }) {
  const box = useRef<THREE.Group>(null);
  const weight = useRef<THREE.Group>(null);
  const ropeTable = useRef<THREE.Mesh>(null);
  const ropeHang = useRef<THREE.Mesh>(null);
  const size1 = BOX * (0.8 + m1 / 50);
  const size2 = 0.25 + m2 / 60;
  const startX = TABLE_LEFT + 0.5;

  useFrame(() => {
    const s = newton.getRuntime().s;
    const boxX = startX + s;
    const hangY = PULLEY.y - 0.7 - s;
    if (box.current) box.current.position.set(boxX, TABLE_TOP + size1 / 2, 0);
    if (weight.current) weight.current.position.set(PULLEY.x + 0.12, hangY, 0);
    // Las cuerdas: una caja delgada de largo 1, escalada.
    const tableLength = PULLEY.x - (boxX + size1 / 2);
    if (ropeTable.current) {
      ropeTable.current.scale.set(tableLength, 1, 1);
      ropeTable.current.position.set(boxX + size1 / 2 + tableLength / 2, PULLEY.y + 0.12, 0);
    }
    const hangLength = PULLEY.y - (hangY + size2 / 2);
    if (ropeHang.current) {
      ropeHang.current.scale.set(1, hangLength, 1);
      ropeHang.current.position.set(PULLEY.x + 0.12, hangY + size2 / 2 + hangLength / 2, 0);
    }
  });

  return (
    <group>
      {/* Mesa */}
      <mesh position={[TABLE_LEFT + TABLE_W / 2, TABLE_TOP - 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE_W, 0.1, 1.1]} />
        <meshStandardMaterial color="#a16207" roughness={0.75} />
      </mesh>
      {[TABLE_LEFT + 0.15, TABLE_LEFT + TABLE_W - 0.15].map((x) => (
        <mesh key={x} position={[x, (TABLE_TOP - 0.1) / 2, 0]}>
          <boxGeometry args={[0.1, TABLE_TOP - 0.1, 0.9]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      {/* Polea */}
      <mesh position={PULLEY} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 24]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh ref={ropeTable}>
        <boxGeometry args={[1, 0.015, 0.015]} />
        <meshBasicMaterial color="#e2e8f0" />
      </mesh>
      <mesh ref={ropeHang}>
        <boxGeometry args={[0.015, 1, 0.015]} />
        <meshBasicMaterial color="#e2e8f0" />
      </mesh>

      <group ref={box}>
        <mesh castShadow>
          <boxGeometry args={[size1, size1, size1]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.55} />
        </mesh>
        <Arrow dir={DOWN} newtons={forces.weight} color={COLORS.weight} label="m₁g" />
        <Arrow dir={UP} newtons={forces.normal} color={COLORS.normal} label="N" />
        <Arrow dir={RIGHT} newtons={forces.tension} color={COLORS.tension} label="T" />
        {Math.abs(forces.friction) > 0.05 && (
          <Arrow dir={LEFT} newtons={forces.friction} color={COLORS.friction} label={forces.moves ? "fk" : "fs"} />
        )}
      </group>
      <group ref={weight}>
        <mesh castShadow>
          <cylinderGeometry args={[size2 / 2, size2 / 2, size2, 20]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
        </mesh>
        <Arrow dir={DOWN} newtons={forces.driving} color={COLORS.weight} label="m₂g" />
        <Arrow dir={UP} newtons={forces.tension} color={COLORS.tension} label="T" offset={0.12} />
      </group>
    </group>
  );
}

/**
 * Flecha de fuerza desde el centro del objeto. El largo es proporcional a la
 * fuerza, y la punta lleva el nombre y el valor en newtons.
 */
function Arrow({
  dir, newtons, color, label, dashed = false, offset = 0,
}: { dir: THREE.Vector3; newtons: number; color: string; label: string; dashed?: boolean; offset?: number }) {
  const length = arrowLength(newtons);
  const head = Math.min(0.2, length * 0.4);
  const shaft = length - head;
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    [dir],
  );
  const tip = dir.clone().normalize().multiplyScalar(length + 0.18);
  const radius = dashed ? 0.022 : 0.035;
  const segments = dashed ? Math.max(2, Math.round(shaft / 0.16)) : 1;
  return (
    <group position={[offset, 0, 0]}>
      <group quaternion={quaternion}>
        {Array.from({ length: segments }, (_, i) => {
          const piece = shaft / segments;
          const visible = dashed ? piece * 0.6 : piece;
          return (
            <mesh key={i} position={[0, piece * i + visible / 2, 0]}>
              <cylinderGeometry args={[radius, radius, visible, 8]} />
              <meshBasicMaterial color={color} toneMapped={false} transparent={dashed} opacity={dashed ? 0.85 : 1} />
            </mesh>
          );
        })}
        <mesh position={[0, shaft + head / 2, 0]}>
          <coneGeometry args={[radius * 2.6, head, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <SceneLabel position={[tip.x, tip.y, tip.z]} center>
        <div className={styles.force} style={{ color }}>
          {`${label} ${Math.abs(newtons).toFixed(1)} N`}
        </div>
      </SceneLabel>
    </group>
  );
}
