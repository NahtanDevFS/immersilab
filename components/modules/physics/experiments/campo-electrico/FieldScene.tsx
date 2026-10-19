"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { SceneLabel } from "@/components/vr/SceneLabel";
import {
  BOUNDS,
  LAUNCHER,
  NULL_CHARGES,
  NULL_X,
  fieldLines,
  getLevel,
  sphereRadius,
  type Charge,
} from "./field";
import { chargesOf, type FieldEngine, type FieldRuntime } from "./engine";
import styles from "./FieldScene.module.css";

/** El plano del movimiento, a la altura de los ojos. */
const PLANE_Y = 1.4;
const POSITIVE = "#ef4444";
const NEGATIVE = "#3b82f6";

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * La cámara de vacío: el estudiante está adentro y las líneas de campo
 * pasan a su alrededor, a la altura de los ojos. Pedestales con esferas
 * cargadas (rojas positivas, azules negativas), el lanzador, el aro, y las
 * trayectorias de los tiros.
 */
export function FieldScene({ engine, variables }: Props) {
  const field = engine as FieldEngine;
  useFixedTimestep((dt) => field.update(dt, variables));

  const [runtime, setRuntime] = useState<FieldRuntime>(() => ({ ...field.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...field.getRuntime() }), 120);
    return () => window.clearInterval(id);
  }, [field]);

  const level = getLevel(variables.nivel);
  const charges = useMemo(
    () => (level.id === "campo-nulo" ? NULL_CHARGES : level.charges ? chargesOf(variables) : []),
    // Solo las cargas y el nivel: así las líneas no se recalculan al mover otra variable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level.id, variables.q1, variables.q2, variables.q3, variables.q4],
  );
  const showLines = Boolean(variables.lineas);

  // Líneas de campo: lo más pesado de la escena, se calculan solo cuando
  // cambian las cargas, en una sola geometría de segmentos.
  const lines = useMemo(() => {
    const positions: number[] = [];
    for (const line of fieldLines(charges)) {
      for (let i = 1; i < line.length; i++) {
        positions.push(line[i - 1][0], PLANE_Y, line[i - 1][1], line[i][0], PLANE_Y, line[i][1]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#e2e8f0", transparent: true, opacity: 0.55 }));
  }, [charges]);
  useEffect(() => () => {
    lines.geometry.dispose();
    (lines.material as THREE.Material).dispose();
  }, [lines]);

  const angle = level.aim ? (Number(variables.angulo ?? 0) * Math.PI) / 180 : 0;
  const voltage = Number(variables.voltaje ?? 0);

  return (
    <group>
      {/* La cámara de vacío: piso y paredes de vidrio. */}
      <mesh position={[(BOUNDS.xMin + BOUNDS.xMax) / 2, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BOUNDS.xMax - BOUNDS.xMin, BOUNDS.zMax - BOUNDS.zMin]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      <mesh position={[(BOUNDS.xMin + BOUNDS.xMax) / 2, 1.6, 0]}>
        <boxGeometry args={[BOUNDS.xMax - BOUNDS.xMin, 3.2, BOUNDS.zMax - BOUNDS.zMin]} />
        <meshStandardMaterial color="#bae6fd" transparent opacity={0.07} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {showLines && <primitive object={lines} />}

      {charges.map((c, i) => (
        <ChargeOnPedestal key={i} charge={c} label={level.id === "campo-nulo" ? `${c.q > 0 ? "+" : ""}${c.q} µC` : `q${i + 1} ${c.q > 0 ? "+" : ""}${c.q} µC`} />
      ))}

      {level.id === "campo-nulo" && <Sensor x={Number(variables.sensor_x ?? -1)} field={runtime.sensorField} />}

      {level.id !== "campo-nulo" && (
        <group position={[LAUNCHER.x, PLANE_Y, LAUNCHER.z]} rotation={[0, -angle, 0]}>
          <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.09, 0.12, 0.6, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.2, -PLANE_Y / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.08, PLANE_Y, 10]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      )}

      {level.ring && (
        <mesh position={[level.ring.x, PLANE_Y, level.ring.z]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[level.ring.r, 0.035, 10, 40]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={runtime.lastEnd === "aro" ? 1.5 : 0.3} toneMapped={false} />
        </mesh>
      )}

      {level.wall && (
        <mesh position={[level.wall.x, PLANE_Y, (level.wall.zMin + level.wall.zMax) / 2]} castShadow>
          <boxGeometry args={[0.15, 2.2, level.wall.zMax - level.wall.zMin]} />
          <meshStandardMaterial color="#78716c" roughness={0.9} />
        </mesh>
      )}

      {level.plates && (
        <group>
          {[-1, 1].map((side) => {
            // La placa de abajo (z < 0) es la positiva cuando V > 0.
            const positive = side < 0 ? voltage > 0 : voltage < 0;
            return (
              <group key={side}>
                <mesh position={[(level.plates!.x0 + level.plates!.x1) / 2, PLANE_Y, (side * level.plates!.d) / 2 + side * 0.03]}>
                  <boxGeometry args={[level.plates!.x1 - level.plates!.x0, 0.6, 0.04]} />
                  <meshStandardMaterial color={voltage === 0 ? "#94a3b8" : positive ? POSITIVE : NEGATIVE} metalness={0.6} roughness={0.3} />
                </mesh>
                <SceneLabel position={[0, PLANE_Y + 0.45, (side * level.plates!.d) / 2]} center>
                  <div className={styles.label}>{voltage === 0 ? "0 V" : positive ? `+${Math.abs(voltage)} V` : "0 V (−)"}</div>
                </SceneLabel>
              </group>
            );
          })}
          <SceneLabel position={[0, PLANE_Y + 0.75, 0]} center>
            <div className={styles.label}>{`E = V/d = ${Math.abs(voltage) / level.plates.d} V/m`}</div>
          </SceneLabel>
        </group>
      )}

      <Trails runtime={runtime} />
      <Flight field={field} shot={runtime.shot} />
    </group>
  );
}

function ChargeOnPedestal({ charge, label }: { charge: Charge; label: string }) {
  const color = charge.q > 0 ? POSITIVE : charge.q < 0 ? NEGATIVE : "#475569";
  return (
    <group position={[charge.x, 0, charge.z]}>
      <mesh position={[0, PLANE_Y / 2 - 0.1, 0]}>
        <cylinderGeometry args={[0.06, 0.14, PLANE_Y - 0.2, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, PLANE_Y, 0]}>
        <sphereGeometry args={[charge.q === 0 ? 0.08 : sphereRadius(charge.q), 24, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={charge.q === 0 ? 0 : 0.5} roughness={0.3} />
      </mesh>
      <SceneLabel position={[0, PLANE_Y + 0.42, 0]} center>
        <div className={styles.label} style={{ color: charge.q === 0 ? undefined : color }}>
          {label}
        </div>
      </SceneLabel>
    </group>
  );
}

function Sensor({ x, field }: { x: number; field: number }) {
  const close = Math.abs(x - NULL_X) < 0.05;
  return (
    <group position={[x, PLANE_Y, 0]}>
      <mesh>
        <octahedronGeometry args={[0.1]} />
        <meshStandardMaterial color={close ? "#22c55e" : "#facc15"} emissive={close ? "#22c55e" : "#facc15"} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, -PLANE_Y / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, PLANE_Y, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <SceneLabel position={[0, 0.4, 0]} center>
        <div className={styles.label}>{`Sensor · E = ${Math.round(field).toLocaleString("es")} V/m`}</div>
      </SceneLabel>
    </group>
  );
}

/** Trayectorias anteriores: tenues, para comparar un tiro con el siguiente. */
function Trails({ runtime }: { runtime: FieldRuntime }) {
  const objects = useMemo(
    () =>
      runtime.trails.map((trail) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(trail.map((p) => new THREE.Vector3(p.x, PLANE_Y, p.z)));
        return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.5 }));
      }),
    [runtime.trails],
  );
  useEffect(
    () => () =>
      objects.forEach((o) => {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }),
    [objects],
  );
  return (
    <>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  );
}

/**
 * El tiro en curso: su línea se arma una vez por tiro (no por cuadro) y se
 * va descubriendo con `drawRange` mientras la esferita avanza.
 */
function Flight({ field, shot }: { field: FieldEngine; shot: FieldRuntime["shot"] }) {
  const particle = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const line = useMemo(
    () =>
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints((shot?.points ?? []).map((p) => new THREE.Vector3(p.x, PLANE_Y, p.z))),
        new THREE.LineBasicMaterial({ color: "#fde047" }),
      ),
    [shot],
  );
  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }, [line]);

  useFrame(() => {
    const r = field.getRuntime();
    const p = particle.current;
    const l = lineRef.current;
    if (!l) return;
    // El estado de React llega unas veces por segundo: si el motor ya tiene
    // otro tiro, se espera a que llegue su línea.
    if (!shot || !p || r.shot !== shot) {
      if (p) p.visible = false;
      l.visible = false;
      return;
    }
    const t = r.flying ? r.shotTime : shot.duration;
    let i = 0;
    while (i < shot.points.length - 1 && shot.points[i + 1].t <= t) i++;
    l.visible = true;
    l.geometry.setDrawRange(0, i + 1);
    p.visible = r.flying;
    p.position.set(shot.points[i].x, PLANE_Y, shot.points[i].z);
  });

  return (
    <>
      <primitive ref={lineRef} object={line} />
      <mesh ref={particle} visible={false}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
    </>
  );
}
