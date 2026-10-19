"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { GazeMesh } from "@/components/vr/GazeMesh";
import { VrText } from "@/components/vr/VrText";
import { SceneLabel } from "@/components/vr/SceneLabel";
import {
  LINKS,
  SWITCHES,
  linkName,
  reachFrom,
  type Link,
  type PortRole,
  type StpEngine,
  type StpRuntime,
  type SwitchId,
} from "./engine";
import styles from "./StpScene.module.css";

const POS: Record<SwitchId, THREE.Vector3> = {
  nucleo: new THREE.Vector3(-0.9, 2.6, -0.6),
  distribucion: new THREE.Vector3(1.9, 2.6, -0.6),
  acceso1: new THREE.Vector3(-1.7, 1.15, 0.5),
  acceso2: new THREE.Vector3(1.1, 1.15, 0.5),
};
/** Los dos enlaces paralelos N–D van uno arriba del otro. */
const LIFT: Record<number, number> = { 1: 0.12, 2: -0.12 };

const ROLE_COLOR: Record<PortRole, string> = { raiz: "#22c55e", designado: "#3b82f6", bloqueado: "#f97316" };

/** Extremos de un enlace en la escena (con la separación de los paralelos). */
function ends(l: Link): [THREE.Vector3, THREE.Vector3] {
  const lift = new THREE.Vector3(0, LIFT[l.n] ?? 0, 0);
  return [POS[l.a].clone().add(lift), POS[l.b].clone().add(lift)];
}
const ENDS: Record<number, [THREE.Vector3, THREE.Vector3]> = Object.fromEntries(LINKS.map((l) => [l.n, ends(l)]));

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
  setVariable?: (key: string, value: number | boolean | string) => void;
}

/**
 * Cuatro switches sobre bastidores, unidos por cables. Cada extremo de un
 * enlace tiene su LED de rol (verde raíz, azul designado, naranja
 * bloqueado) y las tramas son cubitos que viajan por los cables.
 *
 * Tocar un enlace hace dos cosas distintas según el momento: con STP
 * apagado marca la predicción (¿se bloquea?); con STP activo lo corta.
 */
export function StpScene({ engine, variables, setVariable }: Props) {
  const stp = engine as StpEngine;
  useFixedTimestep((dt) => stp.update(dt, variables));

  const [runtime, setRuntime] = useState<StpRuntime>(() => ({ ...stp.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...stp.getRuntime(), down: new Set(stp.getRuntime().down) }), 120);
    return () => window.clearInterval(id);
  }, [stp]);

  const touchLink = (n: number) => {
    if (stp.getRuntime().stpOn) stp.toggleLink(n);
    else setVariable?.(`pred_enlace${n}`, !variables[`pred_enlace${n}`]);
  };
  const storm = runtime.phase === "storm";
  const forwardingSet = new Set(runtime.forwarding.map((l) => l.n));

  return (
    <group>
      {SWITCHES.map((s) => (
        <group key={s.id} position={POS[s.id]}>
          {/* Bastidor */}
          <mesh position={[0, -POS[s.id].y / 2 - 0.05, -0.1]}>
            <boxGeometry args={[0.7, POS[s.id].y - 0.1, 0.5]} />
            <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.6} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[0.8, 0.18, 0.5]} />
            <meshStandardMaterial color={runtime.stp.root === s.id && runtime.stpOn ? "#854d0e" : "#334155"} metalness={0.3} roughness={0.5} />
          </mesh>
          <Suspense fallback={null}>
            <VrText position={[0, 0.25, 0.26]} anchorX="center" fontSize={0.09}>
              {`${s.name}${runtime.stp.root === s.id && runtime.stpOn ? " · RAÍZ" : ""}`}
            </VrText>
            <VrText position={[0, 0.0, 0.26]} anchorX="center" fontSize={0.06} color="#cbd5e1">
              {`${runtime.priorities[s.id]} · MAC :0${s.mac}`}
            </VrText>
          </Suspense>
        </group>
      ))}

      {/* PC: dos por switch de acceso. Se encienden si les llegó el último broadcast. */}
      {(["acceso1", "acceso2"] as const).map((s) =>
        [-0.35, 0.35].map((dx) => {
          const lit =
            runtime.phase === "broadcast" &&
            Number.isFinite(reachFrom("acceso1", runtime.forwarding)[s]);
          return (
            <group key={`${s}${dx}`} position={[POS[s].x + dx, 0.45, POS[s].z + 0.7]}>
              <mesh>
                <boxGeometry args={[0.32, 0.24, 0.05]} />
                <meshStandardMaterial color={lit ? "#22c55e" : "#1e293b"} emissive="#22c55e" emissiveIntensity={lit ? 0.8 : 0} />
              </mesh>
            </group>
          );
        }),
      )}

      {LINKS.map((l) => {
        const down = runtime.down.has(l.n);
        const blocked = runtime.stpOn && runtime.stp.blocked.includes(l.n);
        const predicted = Boolean(variables[`pred_enlace${l.n}`]);
        const color = down ? "#3f3f46" : storm && forwardingSet.has(l.n) ? "#ef4444" : blocked ? "#78350f" : l.gbps >= 1 ? "#94a3b8" : "#64748b";
        const [a, b] = ENDS[l.n];
        return (
          <group key={l.n}>
            <Cable
              from={a}
              to={b}
              color={color}
              radius={l.gbps >= 1 ? (runtime.etherchannel && l.n <= 2 ? 0.05 : 0.035) : 0.02}
              onSelect={() => touchLink(l.n)}
            />
            {runtime.stpOn && !down &&
              ([[l.a, a, b], [l.b, b, a]] as const).map(([sw, from, to]) => {
                const role = runtime.stp.roles[`${l.n}:${sw}`];
                const led = from.clone().lerp(to, 0.5 / from.distanceTo(to));
                return role ? (
                  <mesh key={sw} position={led}>
                    <sphereGeometry args={[0.07, 14, 10]} />
                    <meshBasicMaterial color={ROLE_COLOR[role]} toneMapped={false} />
                  </mesh>
                ) : null;
              })}
            <SceneLabel position={a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.22, 0))} center>
              <div className={styles.link} data-down={down || undefined}>
                {`${l.n} · ${linkName(l)} · ${l.gbps >= 1 ? "1 Gbps" : "100 Mbps"}`}
                {down ? " · caído" : !runtime.stpOn && predicted ? " · ¿se bloquea? sí" : ""}
              </div>
            </SceneLabel>
          </group>
        );
      })}

      <Frames stp={stp} />

      <SceneLabel position={[0.5, 3.6, -0.6]} center>
        <div className={styles.status} data-storm={storm || undefined}>
          {storm
            ? `Tormenta de broadcast: la red está caída · ${runtime.frames.toLocaleString("es")} tramas/s`
            : runtime.phase === "converging"
              ? "STP convergiendo… (el STP clásico tarda de 30 a 50 s; aquí se acelera)"
              : runtime.stpOn
                ? `STP activo · raíz: ${SWITCHES.find((s) => s.id === runtime.stp.root)!.name}${runtime.etherchannel ? " · EtherChannel N–D: 2 Gbps" : ""}`
                : "STP apagado"}
        </div>
      </SceneLabel>
    </group>
  );
}

function Cable({
  from, to, color, radius, onSelect,
}: { from: THREE.Vector3; to: THREE.Vector3; color: string; radius: number; onSelect: () => void }) {
  const { mid, length, quaternion } = useMemo(() => {
    const dir = to.clone().sub(from);
    return {
      mid: from.clone().add(to).multiplyScalar(0.5),
      length: dir.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    };
  }, [from, to]);
  return (
    <group position={mid} quaternion={quaternion}>
      <mesh>
        <cylinderGeometry args={[radius, radius, length, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Blanco más grueso que el cable, para tocarlo con la mira sin puntería fina. */}
      <GazeMesh
        onGazeSelect={onSelect}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          onSelect();
        }}
      >
        <cylinderGeometry args={[0.12, 0.12, length * 0.7, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </GazeMesh>
    </group>
  );
}

/** Cubitos de las tramas: una ola desde Acceso 1 en el broadcast, y por todos lados en la tormenta. */
function Frames({ stp }: { stp: StpEngine }) {
  const COUNT = 18;
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const r = stp.getRuntime();
    const cubes = g.children as THREE.Mesh[];
    cubes.forEach((c) => (c.visible = false));
    if (r.phase === "storm") {
      // Tres tramas por enlace, en fases distintas, que no paran de ir y venir.
      let k = 0;
      for (const l of r.forwarding) {
        for (let j = 0; j < 3 && k < COUNT; j++, k++) {
          const [a, b] = ENDS[l.n];
          const phase = (r.t * 1.6 + j / 3 + l.n * 0.17) % 2;
          cubes[k].position.lerpVectors(a, b, phase < 1 ? phase : 2 - phase);
          cubes[k].visible = true;
        }
      }
      return;
    }
    if (r.phase !== "broadcast") return;
    const depth = reachFrom("acceso1", r.forwarding);
    const wave = r.t * 1.4;
    let k = 0;
    for (const l of r.forwarding) {
      const [from, to] = depth[l.a] <= depth[l.b] ? [l.a, l.b] : [l.b, l.a];
      if (depth[to] !== depth[from] + 1 || k >= COUNT) continue;
      const s = wave - depth[from];
      if (s < 0 || s > 1) continue;
      const [a, b] = ENDS[l.n];
      cubes[k].position.lerpVectors(from === l.a ? a : b, from === l.a ? b : a, s);
      cubes[k].visible = true;
      k++;
    }
  });

  return (
    <group ref={group}>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh key={i} visible={false}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#fde047" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
