"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { GazeMesh } from "@/components/vr/GazeMesh";
import { VrText } from "@/components/vr/VrText";
import {
  CARDS,
  HOSTS,
  NAT_CARDS,
  OUTCOME_TEXT,
  PUBLIC_IP,
  SLOTS,
  getRound,
  rackOf,
  type FirewallEngine,
  type FirewallRuntime,
  type HostId,
  type Outcome,
  type PacketResult,
} from "./engine";

const CLOUD = new THREE.Vector3(-3.6, 1.7, 0);
const RACK_X = -0.3;
const RACK_TOP = 2.75;
const SLOT_H = 0.3;
const slotY = (i: number) => RACK_TOP - 0.25 - i * SLOT_H;
const DENY_Y = slotY(SLOTS) - 0.04;
const HOST_X = 3.2;
const hostZ = (i: number) => -1.5 + i * 0.6;

const OUTCOME_COLOR: Record<Outcome, string> = {
  paso: "#34d399",
  caido: "#fb923c",
  frenado: "#34d399",
  atacado: "#ef4444",
};

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
  setVariable?: (key: string, value: number | boolean | string) => void;
}

/**
 * Internet a la izquierda, el router con su rack de reglas en el medio y la
 * red interna a la derecha. Abajo, el mazo de tarjetas. Tocar una tarjeta
 * del mazo la pone en la primera ranura libre; tocar una del rack la saca.
 * Todo eso solo cambia variables: el panel, el tutor y el visor ven lo mismo.
 */
export function FirewallScene({ engine, variables, setVariable }: Props) {
  const firewall = engine as FirewallEngine;
  useFixedTimestep((dt) => firewall.update(dt, variables));

  const [runtime, setRuntime] = useState<FirewallRuntime>(() => ({ ...firewall.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...firewall.getRuntime() }), 100);
    return () => window.clearInterval(id);
  }, [firewall]);

  const round = getRound(variables.ronda);
  const nat = round.id === "3";
  const rack = rackOf(variables);

  const placeCard = (cardId: string) => {
    if (!setVariable) return;
    const at = rack.findIndex((c) => c?.id === cardId);
    if (at >= 0) {
      setVariable(`regla${at + 1}`, "vacia");
      return;
    }
    const free = rack.findIndex((c) => c === null);
    if (free >= 0) setVariable(`regla${free + 1}`, cardId);
  };

  // Lo ya mostrado del último lanzamiento: los paquetes que terminaron su viaje.
  const launch = runtime.launch;
  const shown = launch ? (runtime.finished ? launch.results.length : Math.max(0, runtime.current)) : 0;
  const revealed = launch ? launch.results.slice(0, shown) : [];
  const attacked = new Set<HostId>(revealed.filter((r) => r.outcome === "atacado").map((r) => r.host));
  const active = launch && runtime.current >= 0 ? launch.results[runtime.current] : null;

  return (
    <group>
      {/* Internet */}
      <group position={CLOUD}>
        {[[0, 0, 0, 0.55], [0.5, 0.15, 0.1, 0.4], [-0.5, 0.1, -0.1, 0.42], [0.1, 0.42, 0, 0.38]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 20, 14]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
          </mesh>
        ))}
        <Suspense fallback={null}>
          <VrText position={[0, -0.75, 0]} anchorX="center" fontSize={0.14}>
            {"Internet"}
          </VrText>
        </Suspense>
      </group>

      {/* Router con el rack (o, en la ronda de NAT, la tabla de traducción) */}
      <group position={[RACK_X, 0, 0]}>
        <mesh position={[0, (RACK_TOP + 0.1) / 2, -0.12]} castShadow>
          <boxGeometry args={[1.5, RACK_TOP + 0.1, 0.2]} />
          <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.5} />
        </mesh>
        <Suspense fallback={null}>
          <VrText position={[0, RACK_TOP + 0.18, 0]} anchorX="center" fontSize={0.12}>
            {nat ? `Router · NAT (${PUBLIC_IP})` : "Router · reglas"}
          </VrText>
        </Suspense>
        {nat ? (
          <NatBoard variables={variables} revealed={revealed} />
        ) : (
          <>
            {rack.map((card, i) => {
              const lit = active && active.slot === i && runtime.t > 0.3;
              return (
                <group key={i} position={[0, slotY(i), 0]}>
                  <GazeMesh
                    onGazeSelect={() => card && setVariable?.(`regla${i + 1}`, "vacia")}
                    onClick={(e) => {
                      if (e.delta > 6) return;
                      e.stopPropagation();
                      if (card) setVariable?.(`regla${i + 1}`, "vacia");
                    }}
                  >
                    <boxGeometry args={[1.36, SLOT_H - 0.04, 0.04]} />
                    <meshStandardMaterial
                      color={lit ? (card?.action === "permitir" ? "#065f46" : "#7f1d1d") : card ? (card.action === "permitir" ? "#134e4a" : "#4c1d1d") : "#0f172a"}
                      emissive={lit ? "#ffffff" : "#000000"}
                      emissiveIntensity={lit ? 0.15 : 0}
                    />
                  </GazeMesh>
                  <Suspense fallback={null}>
                    <VrText position={[-0.64, 0, 0.03]} fontSize={0.075} color="#93a1be">
                      {String(i + 1)}
                    </VrText>
                    <VrText position={[-0.52, 0, 0.03]} fontSize={0.058} maxWidth={1.15} color={card ? "#ffffff" : "#64748b"}>
                      {card ? card.short.replace("\n", " · ") : "vacía"}
                    </VrText>
                  </Suspense>
                </group>
              );
            })}
            <group position={[0, DENY_Y, 0]}>
              <mesh>
                <boxGeometry args={[1.36, SLOT_H - 0.04, 0.04]} />
                <meshStandardMaterial
                  color={active && active.slot === -1 && runtime.t > 0.3 ? "#b91c1c" : "#450a0a"}
                />
              </mesh>
              <Suspense fallback={null}>
                <VrText position={[0, 0, 0.03]} anchorX="center" fontSize={0.065}>
                  {"Bloquear todo lo demás (implícito)"}
                </VrText>
              </Suspense>
            </group>
          </>
        )}
      </group>

      {/* Red interna */}
      {HOSTS.map((h, i) => (
        <group key={h.id} position={[HOST_X, 0, hostZ(i)]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.1, 0.9, 0.1]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[0.5, h.id === "web" || h.id === "bd" ? 0.5 : 0.32, 0.36]} />
            <meshStandardMaterial
              color={attacked.has(h.id) ? "#dc2626" : h.id === "web" || h.id === "bd" ? "#334155" : "#1e3a8a"}
              emissive={attacked.has(h.id) ? "#dc2626" : "#000000"}
              emissiveIntensity={attacked.has(h.id) ? 0.6 : 0}
            />
          </mesh>
          <Suspense fallback={null}>
            <VrText position={[-0.3, 1.42, 0]} rotation={[0, -Math.PI / 2, 0]} anchorX="center" fontSize={0.075}>
              {h.name}
            </VrText>
            <VrText position={[-0.3, 1.32, 0]} rotation={[0, -Math.PI / 2, 0]} anchorX="center" fontSize={0.055} color="#93a1be">
              {attacked.has(h.id) ? "¡Te atacaron!" : h.ip}
            </VrText>
          </Suspense>
        </group>
      ))}

      <PacketCube firewall={firewall} />
      <ResultFeed runtime={runtime} />

      {/* El mazo */}
      <group position={[0.2, 0.5, 1.7]} rotation={[-0.9, 0, 0]}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[4.1, nat ? 0.6 : 1.0, 0.04]} />
          <meshStandardMaterial color="#3f2a14" roughness={0.8} />
        </mesh>
        {nat
          ? NAT_CARDS.map((card, i) => {
              const chosen = variables.nat_reenvio === card.id;
              return (
                <DeckCard
                  key={card.id}
                  position={[-1.3 + i * 1.3, 0, 0]}
                  text={card.short}
                  color={chosen ? "#a16207" : "#1e293b"}
                  onSelect={() => setVariable?.("nat_reenvio", chosen ? "ninguno" : card.id)}
                />
              );
            })
          : CARDS.map((card, i) => {
              const used = rack.some((c) => c?.id === card.id);
              const col = i % 6;
              const row = Math.floor(i / 6);
              return (
                <DeckCard
                  key={card.id}
                  position={[-1.7 + col * 0.68, 0.22 - row * 0.44, 0]}
                  text={card.short}
                  color={used ? "#0b1220" : card.action === "permitir" ? "#134e4a" : "#4c1d1d"}
                  dim={used}
                  onSelect={() => placeCard(card.id)}
                />
              );
            })}
      </group>
    </group>
  );
}

function DeckCard({
  position, text, color, dim = false, onSelect,
}: { position: [number, number, number]; text: string; color: string; dim?: boolean; onSelect: () => void }) {
  return (
    <group position={position}>
      <GazeMesh
        onGazeSelect={onSelect}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          onSelect();
        }}
      >
        <boxGeometry args={[0.62, 0.38, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </GazeMesh>
      <Suspense fallback={null}>
        <VrText position={[0, 0, 0.015]} anchorX="center" textAlign="center" fontSize={0.05} maxWidth={0.58} color={dim ? "#475569" : "#ffffff"}>
          {text}
        </VrText>
      </Suspense>
    </group>
  );
}

/** En la ronda de NAT: el reenvío elegido y la tabla de traducción llenándose. */
function NatBoard({ variables, revealed }: { variables: VariablesState; revealed: PacketResult[] }) {
  const forward = NAT_CARDS.find((c) => c.id === variables.nat_reenvio);
  const rows = revealed.filter((r) => r.translation);
  return (
    <group position={[0, 1.6, 0]}>
      <mesh>
        <planeGeometry args={[1.42, 2.1]} />
        <meshBasicMaterial color="#020617" />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[-0.66, 0.92, 0.01]} fontSize={0.06} maxWidth={1.3} color="#facc15">
          {`Reenvío: ${forward ? forward.label : "ninguno"}`}
        </VrText>
        <VrText position={[-0.66, 0.74, 0.01]} fontSize={0.055} color="#93a1be">
          {"Tabla de traducción"}
        </VrText>
        {rows.map((r, i) => (
          <VrText key={r.id} position={[-0.66, 0.58 - i * 0.16, 0.01]} fontSize={0.05} maxWidth={1.32}>
            {r.translation!}
          </VrText>
        ))}
      </Suspense>
    </group>
  );
}

/** El paquete en viaje: de internet al rack, baja hasta la regla y sigue o rebota. */
function PacketCube({ firewall }: { firewall: FirewallEngine }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  // Vectores de trabajo: se reutilizan en cada cuadro.
  const v = useMemo(
    () => ({ host: new THREE.Vector3(), top: new THREE.Vector3(), check: new THREE.Vector3(), away: new THREE.Vector3() }),
    [],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    // Se lee el avance directo del motor: el estado de React llega 10 veces por segundo.
    const r = firewall.getRuntime();
    const launch = r.launch;
    const live = launch && r.current >= 0 ? launch.results[r.current] : null;
    m.visible = Boolean(live);
    if (!live || !launch) return;
    const t = r.t;
    const nat = launch.round.id === "3";
    const outbound = live.id.startsWith("salida");
    const y = nat ? 1.6 : live.slot >= 0 ? slotY(live.slot) : DENY_Y;
    v.host.set(HOST_X - 0.3, 1.05, hostZ(HOSTS.findIndex((h) => h.id === live.host)));
    v.top.set(RACK_X - 0.85, RACK_TOP, 0.15);
    v.check.set(RACK_X - 0.85, y, 0.15);
    v.away.set(-1.6, y, 0.4);
    const p = m.position;
    if (outbound) {
      // Sale de la PC hacia internet, pasando por el router.
      if (t < 0.5) p.lerpVectors(v.host, v.check, t / 0.5);
      else p.lerpVectors(v.check, CLOUD, (t - 0.5) / 0.5);
    } else if (t < 0.35) p.lerpVectors(CLOUD, v.top, t / 0.35);
    else if (t < 0.6) p.lerpVectors(v.top, v.check, (t - 0.35) / 0.25);
    else if (live.allowed) p.lerpVectors(v.check, v.host, (t - 0.6) / 0.4);
    else p.lerpVectors(v.check, v.away, (t - 0.6) / 0.4);
    if (material.current) {
      material.current.color.set(t < 0.6 ? (live.legit ? "#38bdf8" : "#f43f5e") : OUTCOME_COLOR[live.outcome]);
    }
  });

  return (
    <mesh ref={mesh} visible={false}>
      <boxGeometry args={[0.18, 0.18, 0.18]} />
      <meshBasicMaterial ref={material} color="#38bdf8" toneMapped={false} />
    </mesh>
  );
}

/** Lo que pasó con cada paquete, a medida que llegan; al final, el resumen. */
function ResultFeed({ runtime }: { runtime: FirewallRuntime }) {
  const launch = runtime.launch;
  if (!launch) return null;
  const shown = runtime.finished ? launch.results.length : Math.max(0, runtime.current);
  const live = runtime.current >= 0 ? launch.results[runtime.current] : null;
  return (
    <group position={[-3.6, 3.1, -0.6]} rotation={[0, 0.35, 0]}>
      <mesh position={[0, -0.75, -0.01]}>
        <planeGeometry args={[2.6, 1.75]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.88} />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[-1.22, 0, 0]} fontSize={0.07} maxWidth={2.45} color="#facc15">
          {live ? `→ ${live.label}` : "Tráfico de la ronda"}
        </VrText>
        {launch.results.slice(0, shown).map((r, i) => (
          <VrText key={r.id} position={[-1.22, -0.16 - i * 0.14, 0]} fontSize={0.058} maxWidth={2.45} color={OUTCOME_COLOR[r.outcome]}>
            {`${r.label}: ${OUTCOME_TEXT[r.outcome]}`}
          </VrText>
        ))}
      </Suspense>
    </group>
  );
}
