"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { VrText } from "@/components/vr/VrText";
import {
  CONE_HEIGHT,
  CONE_RADIUS,
  CYLINDER_HEIGHT,
  CYLINDER_RADIUS,
  LADDER,
  getScenario,
  situation,
  type RatesEngine,
  type RatesRuntime,
} from "./engine";

/** El fondo del tanque queda sobre un pedestal, a esta altura. */
const BASE_Y = 0.35;
/** La pared de la escalera, en x. */
const WALL_X = -1.8;
const WATER = "#38bdf8";

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * El tanque (cono o cilindro) con su llave, la regla y la marca de la meta;
 * o la pared con la escalera que resbala. El agua y la escalera se mueven en
 * cada cuadro leyendo el motor; los textos se redibujan unas veces por
 * segundo.
 */
export function RatesScene({ engine, variables }: Props) {
  const rates = engine as RatesEngine;
  useFixedTimestep((dt) => rates.update(dt, variables));

  const [runtime, setRuntime] = useState<RatesRuntime>(() => ({ ...rates.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...rates.getRuntime() }), 100);
    return () => window.clearInterval(id);
  }, [rates]);

  const scenario = getScenario(variables.escenario);
  const meta = Number(variables.altura_meta ?? 1);

  return (
    <group>
      {scenario === "escalera" ? (
        <LadderRig rates={rates} xMeta={Number(variables.x_meta ?? 3)} />
      ) : (
        <TankRig rates={rates} cone={scenario === "cono"} meta={meta} running={runtime.phase === "running"} />
      )}
      <Speedometer runtime={runtime} />
      <InfoBoard runtime={runtime} text={situation(variables)} />
    </group>
  );
}

function TankRig({ rates, cone, meta, running }: { rates: RatesEngine; cone: boolean; meta: number; running: boolean }) {
  const water = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const mesh = water.current;
    if (!mesh) return;
    const h = Math.max(0.0001, rates.getRuntime().height);
    // Una geometría de altura 1 que se escala: no se rearma nada por cuadro.
    if (cone) mesh.scale.set((h / CONE_HEIGHT) * CONE_RADIUS, h, (h / CONE_HEIGHT) * CONE_RADIUS);
    else mesh.scale.set(1, h, 1);
    mesh.position.y = BASE_Y + h / 2;
  });

  const height = cone ? CONE_HEIGHT : CYLINDER_HEIGHT;
  const metaRadius = cone ? (meta / CONE_HEIGHT) * CONE_RADIUS : CYLINDER_RADIUS;

  return (
    <group>
      {/* Pedestal */}
      <mesh position={[0, BASE_Y / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.7, BASE_Y, 24]} />
        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Vidrio */}
      <mesh position={[0, BASE_Y + height / 2, 0]} rotation={cone ? [Math.PI, 0, 0] : [0, 0, 0]}>
        {cone ? (
          <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 40, 1, true]} />
        ) : (
          <cylinderGeometry args={[CYLINDER_RADIUS, CYLINDER_RADIUS, CYLINDER_HEIGHT, 40, 1, true]} />
        )}
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Agua: altura 1 y escala en y. El cono va con la punta abajo. */}
      <mesh ref={water} rotation={cone ? [Math.PI, 0, 0] : [0, 0, 0]}>
        {cone ? <coneGeometry args={[1, 1, 40]} /> : <cylinderGeometry args={[CYLINDER_RADIUS * 0.98, CYLINDER_RADIUS * 0.98, 1, 40]} />}
        <meshStandardMaterial color={WATER} transparent opacity={0.75} roughness={0.15} />
      </mesh>

      {/* Marca de la meta: un aro rojo a la altura pedida. */}
      <mesh position={[0, BASE_Y + meta, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[metaRadius + 0.02, 0.018, 8, 48]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>

      {/* Llave arriba, con el chorro mientras corre. */}
      <group position={[0, BASE_Y + height + 0.35, 0]}>
        <mesh position={[-0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.8, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0.05, -0.08, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.16, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.25} />
        </mesh>
        {running && (
          <mesh position={[0.05, -(height + 0.35) / 2 - 0.08, 0]}>
            <cylinderGeometry args={[0.025, 0.025, height + 0.35, 8]} />
            <meshStandardMaterial color={WATER} transparent opacity={0.6} />
          </mesh>
        )}
      </group>

      <Ruler x={(cone ? CONE_RADIUS : CYLINDER_RADIUS) + 0.25} meta={meta} />
    </group>
  );
}

/** Regla vertical junto al tanque, de 0 a 2 m cada 20 cm. */
function Ruler({ x, meta }: { x: number; meta: number }) {
  const ticks = Array.from({ length: 11 }, (_, i) => i * 0.2);
  return (
    <group position={[x, BASE_Y, 0.2]}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.08, 2.04, 0.02]} />
        <meshStandardMaterial color="#facc15" roughness={0.6} />
      </mesh>
      {ticks.map((t) => (
        <mesh key={t} position={[-0.02, t, 0.012]}>
          <boxGeometry args={[0.05, 0.008, 0.004]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
      ))}
      <mesh position={[0, meta, 0.015]}>
        <boxGeometry args={[0.16, 0.02, 0.006]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
      <Suspense fallback={null}>
        {ticks.filter((_, i) => i % 2 === 0).map((t) => (
          <VrText key={t} position={[0.07, t, 0.012]} fontSize={0.06}>
            {`${t.toFixed(1)} m`}
          </VrText>
        ))}
        <VrText position={[0.1, meta + 0.07, 0.015]} fontSize={0.07} color="#f87171">
          {`meta ${meta.toFixed(1)} m`}
        </VrText>
      </Suspense>
    </group>
  );
}

function LadderRig({ rates, xMeta }: { rates: RatesEngine; xMeta: number }) {
  const ladder = useRef<THREE.Group>(null);
  const baseArrow = useRef<THREE.Group>(null);
  const tipArrow = useRef<THREE.Group>(null);

  useFrame(() => {
    const r = rates.getRuntime();
    const g = ladder.current;
    if (g) {
      // La escalera va de (pared + x, 0) a (pared, y): un giro alrededor de z.
      g.position.set(WALL_X + r.x, 0, 0);
      g.rotation.z = Math.PI - Math.atan2(r.y, r.x);
    }
    const running = r.phase !== "idle";
    if (baseArrow.current) {
      baseArrow.current.visible = running;
      baseArrow.current.position.set(WALL_X + r.x + 0.15, 0.25, 0.45);
    }
    if (tipArrow.current) {
      tipArrow.current.visible = running && Math.abs(r.rate) > 1e-4;
      tipArrow.current.position.set(WALL_X + 0.35, r.y, 0.45);
      // Largo proporcional a la rapidez de la punta (1 m por cada m/s).
      tipArrow.current.scale.set(1, Math.min(3, Math.abs(r.rate)) + 0.001, 1);
    }
  });

  return (
    <group>
      {/* Pared y piso */}
      <mesh position={[WALL_X - 0.1, 2.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 5.5, 2.4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
      </mesh>
      <mesh position={[WALL_X + 2.8, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.6, 2.4]} />
        <meshStandardMaterial color="#64748b" roughness={0.95} />
      </mesh>

      {/* Marca de la x meta en el piso */}
      <mesh position={[WALL_X + xMeta, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.05, 2.2]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>

      {/* La escalera: dos largueros y peldaños, con el origen en la base. */}
      <group ref={ladder}>
        {[-0.25, 0.25].map((z) => (
          <mesh key={z} position={[LADDER / 2, 0, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <boxGeometry args={[0.08, LADDER, 0.06]} />
            <meshStandardMaterial color="#b45309" roughness={0.7} />
          </mesh>
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} position={[0.3 + i * 0.34, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
            <meshStandardMaterial color="#92400e" roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* Flecha de la base: hacia afuera, largo fijo (la velocidad es constante). */}
      <group ref={baseArrow} rotation={[0, 0, -Math.PI / 2]}>
        <Arrow color="#22c55e" />
      </group>
      {/* Flecha de la punta: hacia abajo, crece con la rapidez. */}
      <group ref={tipArrow} rotation={[0, 0, Math.PI]}>
        <Arrow color="#f97316" />
      </group>

      <Suspense fallback={null}>
        <VrText position={[WALL_X + xMeta + 0.08, 0.15, 1.15]} fontSize={0.12} color="#f87171">
          {`x meta ${xMeta.toFixed(1)} m`}
        </VrText>
        <VrText position={[WALL_X + 0.15, 5.3, 1.05]} fontSize={0.12}>
          {"L = 5 m"}
        </VrText>
      </Suspense>
    </group>
  );
}

/** Flecha de 1 m hacia +y desde el origen. Se escala en y para el largo. */
function Arrow({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <coneGeometry args={[0.1, 0.2, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * El velocímetro: cuántos cm/s sube el agua (o baja la punta) ahora mismo.
 * La aguja llega hasta 5 cm/s en los tanques y 200 cm/s en la escalera.
 */
function Speedometer({ runtime }: { runtime: RatesRuntime }) {
  const ladder = runtime.scenario === "escalera";
  const full = ladder ? 200 : 5;
  const cms = runtime.rate * 100;
  const fraction = Math.min(1, Math.abs(cms) / full);
  const angle = Math.PI / 2 - fraction * Math.PI; // de izquierda a derecha
  return (
    <group position={ladder ? [3.4, 3.3, -0.4] : [2.5, 1.4, 0]} rotation={[0, -0.35, 0]}>
      <mesh>
        <boxGeometry args={[1.2, 0.95, 0.05]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.12, 0.03]}>
        <ringGeometry args={[0.36, 0.42, 32, 1, 0, Math.PI]} />
        <meshBasicMaterial color="#334155" />
      </mesh>
      <mesh position={[0, -0.12, 0.035]} rotation={[0, 0, angle]}>
        <boxGeometry args={[0.025, 0.4, 0.01]} />
        <meshBasicMaterial color="#f59e0b" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.12, 0.04]}>
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color="#f59e0b" toneMapped={false} />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[0, 0.36, 0.03]} anchorX="center" fontSize={0.07} color="#93a1be">
          {ladder ? "Rapidez de la punta" : "Rapidez de subida"}
        </VrText>
        <VrText position={[0, -0.33, 0.03]} anchorX="center" fontSize={0.11}>
          {`${cms.toFixed(2)} cm/s`}
        </VrText>
        <VrText position={[-0.39, -0.17, 0.03]} anchorX="center" fontSize={0.045} color="#93a1be">
          {"0"}
        </VrText>
        <VrText position={[0.39, -0.17, 0.03]} anchorX="center" fontSize={0.045} color="#93a1be">
          {String(full)}
        </VrText>
        {runtime.slow && (
          <VrText position={[0, 0.25, 0.03]} anchorX="center" fontSize={0.05} color="#facc15">
            {"cámara lenta"}
          </VrText>
        )}
      </Suspense>
    </group>
  );
}

/** El enunciado y, al llegar a la meta, la rapidez real contra la predicción. */
function InfoBoard({ runtime, text }: { runtime: RatesRuntime; text: string }) {
  const a = runtime.attempt;
  const done = runtime.phase === "done" && a && a.actual !== null;
  const ladder = runtime.scenario === "escalera";
  return (
    <group position={ladder ? [0.9, 4.95, -0.8] : [0, 3.55, -0.4]}>
      <mesh>
        <planeGeometry args={[2.8, 1.5]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.9} />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[-1.3, 0.62, 0.01]} anchorY="top" fontSize={0.11} maxWidth={2.6}>
          {text}
        </VrText>
        <VrText position={[-1.3, -0.3, 0.01]} fontSize={0.11} maxWidth={2.6} color={done ? (a.hit ? "#34d399" : "#f87171") : "#93a1be"}>
          {done
            ? `Real: ${a.actual!.toFixed(2)} cm/s · Tú: ${a.predicted.toFixed(2)} cm/s`
            : runtime.phase === "running"
              ? `Tu predicción: ${a?.predicted.toFixed(2)} cm/s`
              : "Pon tu predicción y empieza."}
        </VrText>
        {done && (
          <VrText position={[-1.3, -0.55, 0.01]} fontSize={0.11} color={a.hit ? "#34d399" : "#f87171"}>
            {`${a.score} pts · ${a.hit ? "¡acierto!" : "error mayor al 5 %"}`}
          </VrText>
        )}
      </Suspense>
    </group>
  );
}
