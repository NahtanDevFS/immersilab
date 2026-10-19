"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { GazeMesh } from "@/components/vr/GazeMesh";
import { VrText } from "@/components/vr/VrText";
import {
  DEPARTMENTS,
  PCS,
  VLAN_COLORS,
  configOf,
  deptOf,
  getRound,
  type VlanEngine,
  type VlanRuntime,
} from "./engine";

/** Altura del piso de cada planta del edificio en corte. */
const FLOOR_Y: Record<1 | 2, number> = { 1: 0, 2: 1.7 };
const PC_X = [-3.0, -2.3, -1.6, -0.9];
const ACCESS_X = 0.1;
const DIST = new THREE.Vector3(1.3, 1.75, 0);
const ROUTER = new THREE.Vector3(1.3, 3.0, 0);
const VLAN_ORDER = [10, 20, 30, 40];

/** Posiciones fijas, calculadas una vez: los cables y el ping las reutilizan. */
const PC_POS: Record<string, THREE.Vector3> = Object.fromEntries(
  PCS.map((pc) => {
    const i = PCS.filter((p) => p.floor === pc.floor).indexOf(pc);
    return [pc.id, new THREE.Vector3(PC_X[i], FLOOR_Y[pc.floor] + 0.75, 0)];
  }),
);
const ACCESS_POS: Record<1 | 2, THREE.Vector3> = {
  1: new THREE.Vector3(ACCESS_X, FLOOR_Y[1] + 1.05, 0),
  2: new THREE.Vector3(ACCESS_X, FLOOR_Y[2] + 1.05, 0),
};
const pcPos = (id: string) => PC_POS[id];
const accessPos = (floor: 1 | 2) => ACCESS_POS[floor];

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
  setVariable?: (key: string, value: number | boolean | string) => void;
}

/**
 * Edificio de dos pisos en corte, con la red jerárquica a la vista: PC y
 * switch de acceso en cada piso, el switch de distribución y el router
 * arriba. Al lado, el pizarrón con la tabla de subredes. Tocar una PC la
 * pasa a la VLAN siguiente (cambia la variable `pcN`).
 */
export function VlanScene({ engine, variables, setVariable }: Props) {
  const vlanEngine = engine as VlanEngine;
  useFixedTimestep((dt) => vlanEngine.update(dt, variables));

  const [runtime, setRuntime] = useState<VlanRuntime>(() => ({ ...vlanEngine.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...vlanEngine.getRuntime() }), 120);
    return () => window.clearInterval(id);
  }, [vlanEngine]);

  const config = configOf(variables);
  const round = getRound(variables.ronda);
  const cycle = (id: string) => {
    const now = Number(variables[id] ?? 10);
    const next = VLAN_ORDER[(VLAN_ORDER.indexOf(now) + 1) % VLAN_ORDER.length];
    setVariable?.(id, String(next));
  };

  return (
    <group>
      {/* El edificio: losas y una pared del fondo. */}
      {[1, 2].map((f) => (
        <mesh key={f} position={[-1.3, FLOOR_Y[f as 1 | 2] + 0.03, 0]} receiveShadow>
          <boxGeometry args={[4.4, 0.06, 1.6]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[-1.3, 1.7, -0.8]} receiveShadow>
        <boxGeometry args={[4.4, 3.4, 0.06]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
      </mesh>

      {/* Cables: PC → acceso, acceso → distribución (el troncal), distribución → router. */}
      {PCS.map((p) => (
        <Cable key={p.id} from={pcPos(p.id)} to={accessPos(p.floor)} color={VLAN_COLORS[config.vlans[p.id]] ?? "#64748b"} />
      ))}
      {([1, 2] as const).map((f) => (
        <Cable key={f} from={accessPos(f)} to={DIST} color={config.trunk ? "#f97316" : "#64748b"} thick={config.trunk} />
      ))}
      <Cable from={DIST} to={ROUTER} color={config.subinterfaces ? "#f97316" : "#64748b"} thick={config.subinterfaces} />

      {PCS.map((p) => {
        const vlan = config.vlans[p.id];
        const dept = deptOf(p.dept);
        const pos = pcPos(p.id);
        return (
          <group key={p.id} position={pos}>
            <mesh position={[0, -0.4, 0]}>
              <boxGeometry args={[0.5, 0.06, 0.5]} />
              <meshStandardMaterial color="#78350f" roughness={0.8} />
            </mesh>
            <GazeMesh
              onGazeSelect={() => cycle(p.id)}
              onClick={(e) => {
                if (e.delta > 6) return;
                e.stopPropagation();
                cycle(p.id);
              }}
            >
              <boxGeometry args={[0.42, 0.3, 0.06]} />
              <meshStandardMaterial color={VLAN_COLORS[vlan] ?? "#334155"} emissive={VLAN_COLORS[vlan] ?? "#000"} emissiveIntensity={0.35} />
            </GazeMesh>
            <Suspense fallback={null}>
              <VrText position={[0, 0.3, 0.05]} anchorX="center" fontSize={0.075}>
                {p.id.toUpperCase()}
              </VrText>
              <VrText position={[0, 0.02, 0.04]} anchorX="center" fontSize={0.065}>
                {`VLAN ${vlan}`}
              </VrText>
              <VrText position={[0, -0.25, 0.3]} anchorX="center" fontSize={0.06} color={dept.color}>
                {dept.name}
              </VrText>
            </Suspense>
          </group>
        );
      })}

      {([1, 2] as const).map((f) => (
        <Device key={f} position={accessPos(f)} color="#0f766e" label={`Switch de acceso · piso ${f}`} />
      ))}
      <Device position={DIST} color="#1d4ed8" label="Switch de distribución" />
      <Device position={ROUTER} color="#7c2d12" label={config.subinterfaces ? "Router · subinterfaces .10 .20 .30 .40" : "Router"} />

      {/* Carteles de las capas de la red jerárquica. */}
      <Suspense fallback={null}>
        <VrText position={[-3.4, 3.55, -0.75]} fontSize={0.13} color="#0f172a">
          {"Acceso"}
        </VrText>
        <VrText position={[1.85, 1.75, 0]} fontSize={0.11}>
          {"Distribución"}
        </VrText>
        <VrText position={[1.85, 3.0, 0]} fontSize={0.11}>
          {"Núcleo / router"}
        </VrText>
        <VrText position={[0.4, 0.6, 0.4]} fontSize={0.075} color={config.trunk ? "#fdba74" : "#93a1be"}>
          {config.trunk ? "troncal (802.1Q)" : "enlace de acceso"}
        </VrText>
      </Suspense>

      <PingPacket vlanEngine={vlanEngine} />
      <SubnetBoard runtime={runtime} roundTitle={round.title} />
    </group>
  );
}

function Device({ position, color, label }: { position: THREE.Vector3; color: string; label: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.14, 0.4]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[0, 0.17, 0]} anchorX="center" fontSize={0.06}>
          {label}
        </VrText>
      </Suspense>
    </group>
  );
}

function Cable({ from, to, color, thick = false }: { from: THREE.Vector3; to: THREE.Vector3; color: string; thick?: boolean }) {
  const { mid, length, quaternion } = useMemo(() => {
    const dir = to.clone().sub(from);
    return {
      mid: from.clone().add(to).multiplyScalar(0.5),
      length: dir.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    };
  }, [from, to]);
  return (
    <mesh position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[thick ? 0.03 : 0.015, thick ? 0.03 : 0.015, length, 6]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/** El ping en viaje: de la PC origen, por los switches (y el router si hace falta), a la destino. */
function PingPacket({ vlanEngine }: { vlanEngine: VlanEngine }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const r = vlanEngine.getRuntime();
    const ping = r.results && r.current >= 0 ? r.results[r.current] : null;
    m.visible = Boolean(ping);
    if (!ping) return;
    const a = PCS.find((p) => p.id === ping.from)!;
    const b = PCS.find((p) => p.id === ping.to)!;
    // El recorrido: si no llega, se corta a la mitad del camino.
    const path = [pcPos(a.id), accessPos(a.floor)];
    if (ping.viaRouter || ping.crossesSwitch) path.push(DIST);
    if (ping.viaRouter) path.push(ROUTER, DIST);
    if (ping.crossesSwitch || ping.viaRouter) path.push(accessPos(b.floor));
    path.push(pcPos(b.id));
    const reach = ping.ok ? 1 : 0.45;
    const t = Math.min(r.t, reach) * (path.length - 1);
    const k = Math.min(path.length - 2, Math.floor(t));
    m.position.lerpVectors(path[k], path[k + 1], t - k);
    material.current?.color.set(ping.ok ? "#4ade80" : r.t > reach ? "#ef4444" : "#facc15");
  });

  return (
    <mesh ref={mesh} visible={false}>
      <boxGeometry args={[0.14, 0.14, 0.14]} />
      <meshBasicMaterial ref={material} color="#facc15" toneMapped={false} />
    </mesh>
  );
}

/** El pizarrón con la tabla de subredes y, abajo, el resultado de los pings. */
function SubnetBoard({ runtime, roundTitle }: { runtime: VlanRuntime; roundTitle: string }) {
  const plan = runtime.config.plan;
  const rowH = 0.22;
  return (
    <group position={[3.6, 1.9, 0.2]} rotation={[0, -0.45, 0]}>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[3.0, 2.9]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[-1.42, 1.3, 0]} fontSize={0.1} color="#0f172a">
          {`Bloque 192.168.10.0/24 · ${roundTitle}`}
        </VrText>
        <VrText position={[-1.42, 1.12, 0]} fontSize={0.075} color={plan.overflow ? "#b91c1c" : "#1e3a8a"}>
          {`${plan.used} de 256 direcciones usadas${plan.overflow ? " · ¡se sale del bloque!" : ""}`}
        </VrText>
        <VrText position={[-1.42, 0.94, 0]} fontSize={0.06} color="#475569">
          {"Depto · pide · máscara · red · usables · sobran"}
        </VrText>
        {plan.rows.map((r, i) => {
          const bad = !r.fits || r.outside;
          return (
            <group key={r.id} position={[0, 0.74 - i * rowH * 1.6, 0]}>
              <mesh position={[0, -0.08, -0.01]}>
                <planeGeometry args={[2.9, rowH * 1.5]} />
                <meshBasicMaterial color={bad ? "#fecaca" : i % 2 ? "#e2e8f0" : "#f1f5f9"} />
              </mesh>
              <VrText position={[-1.42, 0, 0]} fontSize={0.072} color={bad ? "#991b1b" : "#0f172a"}>
                {`${r.name} · ${r.hosts} · /${r.prefix} · ${r.network} · ${r.usable} · ${r.fits ? r.waste : "no alcanza"}`}
              </VrText>
              <VrText position={[-1.42, -0.15, 0]} fontSize={0.058} color="#475569">
                {r.outside ? "fuera del bloque" : `${r.first} a ${r.last} · broadcast ${r.broadcast}`}
              </VrText>
            </group>
          );
        })}
        {runtime.results && (
          <VrText position={[-1.42, -1.05, 0]} anchorY="top" fontSize={0.06} maxWidth={2.85} color="#0f172a">
            {runtime.results.map((r) => `${r.from.toUpperCase()}→${r.to.toUpperCase()}: ${r.why}`).join("\n")}
          </VrText>
        )}
      </Suspense>
      {/* Leyenda de colores de VLAN */}
      {DEPARTMENTS.map((d, i) => (
        <mesh key={d.id} position={[-1.3 + i * 0.75, -1.55, 0]}>
          <planeGeometry args={[0.16, 0.1]} />
          <meshBasicMaterial color={d.color} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        {DEPARTMENTS.map((d, i) => (
          <VrText key={d.id} position={[-1.18 + i * 0.75, -1.55, 0]} fontSize={0.055} color="#0f172a">
            {`${d.vlan} ${d.name}`}
          </VrText>
        ))}
      </Suspense>
    </group>
  );
}
