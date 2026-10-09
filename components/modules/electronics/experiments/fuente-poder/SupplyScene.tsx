"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { VrText } from "@/components/vr/VrText";
import { PRIMARY_TURNS, STAGES, type Stage, type SupplyEngine, type SupplyRuntime } from "./engine";

/** Altura de la mesa: la de un escritorio. */
const TABLE_Y = 0.72;
/** Dónde está cada etapa sobre la mesa (x). */
const X = { enchufe: -1.75, transformador: -1.0, diodos: -0.2, capacitor: 0.45, celular: 1.15 };
/** El osciloscopio, atrás y elevado, mirando al jugador. */
const SCOPE = { x: 0, y: 2.0, z: -0.8, w: 1.5, h: 0.95 };
const SCREEN = { w: 1.3, h: 0.7 };

type Vec = [number, number, number];

/** Escala del osciloscopio: un número "redondo" que contenga la curva. */
function niceScale(max: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200];
  return steps.find((s) => s >= max) ?? 200;
}

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * La fuente desarmada sobre una mesa, de izquierda a derecha como corre la
 * energía: enchufe → transformador → diodos → capacitor → celular. Atrás, el
 * osciloscopio dibuja la onda en la etapa elegida y una punta de prueba va a
 * esa etapa.
 */
export function SupplyScene({ engine, variables }: Props) {
  const supply = engine as SupplyEngine;
  useFixedTimestep((dt) => supply.update(dt, variables));

  // El resultado cambia solo cuando cambian las variables: se lee unas veces
  // por segundo para redibujar la curva y los textos.
  const [runtime, setRuntime] = useState<SupplyRuntime>(() => ({ ...supply.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = supply.getRuntime();
      setRuntime((prev) =>
        prev.result === next.result && prev.stage === next.stage && prev.phone === next.phone
          ? prev
          : { ...next },
      );
    }, 150);
    return () => window.clearInterval(id);
  }, [supply]);

  const turns = Number(variables.espiras ?? 60);
  const capacitor = Number(variables.capacitor ?? 470);
  const bridge = variables.rectificador === "puente";
  const stageX: Record<Stage, number> = {
    enchufe: X.enchufe,
    secundario: X.transformador + 0.25,
    rectificado: X.diodos,
    salida: X.capacitor,
  };

  return (
    <group>
      <Table />

      {/* Cables entre etapas: la energía corre de izquierda a derecha. */}
      <Wire points={[[X.enchufe + 0.15, TABLE_Y + 0.05, 0], [X.transformador - 0.3, TABLE_Y + 0.05, 0]]} color="#1c1f26" />
      <Wire points={[[X.transformador + 0.3, TABLE_Y + 0.05, 0], [X.diodos - 0.2, TABLE_Y + 0.05, 0]]} color="#b87333" />
      <Wire points={[[X.diodos + 0.2, TABLE_Y + 0.05, 0], [X.capacitor - 0.12, TABLE_Y + 0.05, 0]]} color="#e0201b" />
      <Wire points={[[X.capacitor + 0.12, TABLE_Y + 0.05, 0], [X.celular - 0.2, TABLE_Y + 0.05, 0]]} color="#e0201b" />

      <Outlet />
      <Transformer turns={turns} />
      <Diodes bridge={bridge} />
      {capacitor > 0 && <Capacitor microfarads={capacitor} />}
      <Phone state={runtime.phone} />

      <Oscilloscope runtime={runtime} />
      {/* Punta de prueba del osciloscopio a la etapa que se mira. */}
      <Wire
        points={[
          [SCOPE.x + SCOPE.w / 2 - 0.1, SCOPE.y - SCOPE.h / 2, SCOPE.z + 0.06],
          [(SCOPE.x + stageX[runtime.stage]) / 2, TABLE_Y + 0.35, -0.3],
          [stageX[runtime.stage], TABLE_Y + 0.12, 0.02],
        ]}
        color="#2dd4bf"
        radius={0.008}
      />

      <Suspense fallback={null}>
        <VrText position={[X.enchufe, TABLE_Y + 0.55, 0]} anchorX="center" fontSize={0.06} color="#ffffff" outlineWidth={0.006} outlineColor="#0b1220">
          Enchufe
        </VrText>
        <VrText position={[X.transformador, TABLE_Y + 0.62, 0]} anchorX="center" fontSize={0.06} color="#ffffff" outlineWidth={0.006} outlineColor="#0b1220">
          Transformador
        </VrText>
        <VrText position={[X.transformador, TABLE_Y + 0.54, 0]} anchorX="center" fontSize={0.04} color="#fbbf24" outlineWidth={0.006} outlineColor="#0b1220">
          {`${PRIMARY_TURNS} : ${turns} espiras`}
        </VrText>
        <VrText position={[X.diodos, TABLE_Y + 0.4, 0]} anchorX="center" fontSize={0.06} color="#ffffff" outlineWidth={0.006} outlineColor="#0b1220">
          {bridge ? "Puente de diodos" : "Un diodo"}
        </VrText>
        <VrText position={[X.capacitor, TABLE_Y + 0.62, 0]} anchorX="center" fontSize={0.06} color="#ffffff" outlineWidth={0.006} outlineColor="#0b1220">
          {capacitor > 0 ? `${capacitor.toLocaleString("es")} µF` : "Sin capacitor"}
        </VrText>
        <VrText position={[X.celular, TABLE_Y + 0.62, 0]} anchorX="center" fontSize={0.06} color="#ffffff" outlineWidth={0.006} outlineColor="#0b1220">
          {`Celular · ${Number(variables.carga ?? 250)} mA`}
        </VrText>
      </Suspense>
    </group>
  );
}

/* ------------------------------------------------------------------------ */

function Table() {
  return (
    <group>
      <mesh position={[0, TABLE_Y - 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.06, 1.3]} />
        <meshStandardMaterial color="#6b4f35" roughness={0.75} />
      </mesh>
      {[-2.05, 2.05].map((x) =>
        [-0.55, 0.55].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (TABLE_Y - 0.06) / 2, z]} castShadow>
            <boxGeometry args={[0.08, TABLE_Y - 0.06, 0.08]} />
            <meshStandardMaterial color="#3a3f48" metalness={0.5} roughness={0.5} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Outlet() {
  return (
    <group position={[X.enchufe, TABLE_Y, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.3, 0.4, 0.12]} />
        <meshStandardMaterial color="#e8e6df" roughness={0.6} />
      </mesh>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.24, 0.061]}>
          <planeGeometry args={[0.025, 0.07]} />
          <meshBasicMaterial color="#1c1f26" />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <VrText position={[0, 0.1, 0.062]} anchorX="center" fontSize={0.045} color="#b91c1c">
          120 V ~
        </VrText>
      </Suspense>
    </group>
  );
}

/** Núcleo de hierro con dos bobinas: el secundario crece con sus espiras. */
function Transformer({ turns }: { turns: number }) {
  const secondary = 0.08 + 0.32 * Math.min(1, turns / 200);
  return (
    <group position={[X.transformador, TABLE_Y, 0]}>
      {/* Núcleo: un marco de hierro laminado. */}
      {[
        { p: [0, 0.05, 0], s: [0.7, 0.08, 0.2] },
        { p: [0, 0.47, 0], s: [0.7, 0.08, 0.2] },
        { p: [-0.31, 0.26, 0], s: [0.08, 0.4, 0.2] },
        { p: [0.31, 0.26, 0], s: [0.08, 0.4, 0.2] },
      ].map((bar, k) => (
        <mesh key={k} position={bar.p as Vec} castShadow>
          <boxGeometry args={bar.s as Vec} />
          <meshStandardMaterial color="#5a6170" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
      {/* Primario (izquierda, fijo) y secundario (derecha, según espiras). */}
      <mesh position={[-0.31, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.34, 20]} />
        <meshStandardMaterial color="#b87333" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0.31, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, secondary, 20]} />
        <meshStandardMaterial color="#d08a4a" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** Diodos: cilindros negros con la banda plateada del cátodo. */
function Diodes({ bridge }: { bridge: boolean }) {
  const positions: Array<{ p: Vec; r: number }> = bridge
    ? [
        { p: [-0.09, 0.12, -0.09], r: Math.PI / 4 },
        { p: [0.09, 0.12, -0.09], r: -Math.PI / 4 },
        { p: [-0.09, 0.12, 0.09], r: -Math.PI / 4 },
        { p: [0.09, 0.12, 0.09], r: Math.PI / 4 },
      ]
    : [{ p: [0, 0.12, 0], r: 0 }];
  return (
    <group position={[X.diodos, TABLE_Y, 0]}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[0.4, 0.03, 0.4]} />
        <meshStandardMaterial color="#1f6f43" roughness={0.6} />
      </mesh>
      {positions.map(({ p, r }, k) => (
        <group key={k} position={p} rotation={[0, r, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.14, 14]} />
            <meshStandardMaterial color="#141414" roughness={0.5} />
          </mesh>
          <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.031, 0.031, 0.02, 14]} />
            <meshStandardMaterial color="#c7ccd4" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Capacitor electrolítico: más capacidad, más grande. */
function Capacitor({ microfarads }: { microfarads: number }) {
  const scale = 0.6 + 0.9 * Math.cbrt(microfarads / 22000);
  const height = 0.3 * scale;
  return (
    <group position={[X.capacitor, TABLE_Y, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09 * scale, 0.09 * scale, height, 24]} />
        <meshStandardMaterial color="#1e40af" metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[0, height + 0.002, 0]}>
        <cylinderGeometry args={[0.09 * scale, 0.09 * scale, 0.004, 24]} />
        <meshStandardMaterial color="#c7ccd4" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** El celular: la pantalla dice si carga. */
function Phone({ state }: { state: SupplyRuntime["phone"] }) {
  const color = state === "carga" ? "#34d399" : state === "sobrevoltaje" ? "#ef4444" : "#475569";
  const label = state === "carga" ? "Cargando" : state === "sobrevoltaje" ? "¡Sobrevoltaje!" : "No carga";
  return (
    <group position={[X.celular, TABLE_Y + 0.02, 0]} rotation={[-Math.PI / 2 + 0.5, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.32, 0.6, 0.04]} />
        <meshStandardMaterial color="#111827" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <planeGeometry args={[0.28, 0.54]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[0, 0, 0.023]} anchorX="center" fontSize={0.045} color="#0b1220">
          {label}
        </VrText>
      </Suspense>
    </group>
  );
}

/**
 * Osciloscopio: grilla, la curva de la etapa elegida y la escala. La curva
 * es una THREE.Line (con <primitive>: la etiqueta <line> de JSX choca con la
 * de SVG en los tipos).
 */
function Oscilloscope({ runtime }: { runtime: SupplyRuntime }) {
  const trace = runtime.result.traces[runtime.stage];
  const peak = Math.max(...trace.v.map((v) => Math.abs(v)), 0.1);
  const scale = niceScale(peak);
  // La salida y lo rectificado son siempre positivos: se usa media pantalla
  // para arriba y la curva se ve el doble de grande.
  const positiveOnly = runtime.stage === "rectificado" || runtime.stage === "salida";

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({ color: "#facc15", toneMapped: false });
    return new THREE.Line(geometry, material);
  }, []);

  useEffect(() => {
    const tMax = trace.t[trace.t.length - 1] || 1;
    const positions = new Float32Array(trace.t.length * 3);
    trace.t.forEach((t, i) => {
      const x = (t / tMax - 0.5) * SCREEN.w * 0.96;
      const yNorm = positiveOnly ? trace.v[i] / scale - 0.5 : trace.v[i] / scale / 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = THREE.MathUtils.clamp(yNorm, -0.5, 0.5) * SCREEN.h * 0.94;
      positions[i * 3 + 2] = 0.003;
    });
    line.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    line.geometry.computeBoundingSphere();
  }, [line, trace, scale, positiveOnly]);

  const label = STAGES.find((s) => s.id === runtime.stage)?.label ?? "";
  const r = runtime.result;

  return (
    <group position={[SCOPE.x, SCOPE.y, SCOPE.z]} rotation={[-0.15, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[SCOPE.w, SCOPE.h, 0.3]} />
        <meshStandardMaterial color="#2a2f3a" metalness={0.4} roughness={0.5} />
      </mesh>
      <group position={[0, 0.05, 0.151]}>
        <mesh>
          <planeGeometry args={[SCREEN.w, SCREEN.h]} />
          <meshBasicMaterial color="#05140d" />
        </mesh>
        {/* Grilla: 10 divisiones horizontales y 8 verticales. */}
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={`v${i}`} position={[(i / 10 - 0.5) * SCREEN.w, 0, 0.001]}>
            <planeGeometry args={[0.003, SCREEN.h]} />
            <meshBasicMaterial color="#14532d" />
          </mesh>
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={`h${i}`} position={[0, (i / 8 - 0.5) * SCREEN.h, 0.001]}>
            <planeGeometry args={[SCREEN.w, i === 4 && !positiveOnly ? 0.006 : 0.003]} />
            <meshBasicMaterial color={i === 4 && !positiveOnly ? "#22c55e" : "#14532d"} />
          </mesh>
        ))}
        <primitive object={line} />
      </group>
      <Suspense fallback={null}>
        <VrText position={[-SCREEN.w / 2, SCOPE.h / 2 - 0.05, 0.152]} fontSize={0.045} color="#e7ecf5">
          {`Osciloscopio · ${label}`}
        </VrText>
        <VrText position={[-SCREEN.w / 2, -SCOPE.h / 2 + 0.05, 0.152]} fontSize={0.035} color="#93a1be">
          {`${positiveOnly ? `0 a ${scale}` : `±${scale}`} V en pantalla · 2 ciclos (33 ms)`}
        </VrText>
        {runtime.stage === "salida" ? (
          <VrText position={[SCREEN.w / 2, -SCOPE.h / 2 + 0.05, 0.152]} anchorX="right" fontSize={0.035} color="#facc15">
            {`prom. ${r.outAvg.toFixed(2)} V · rizado ${r.ripple.toFixed(2)} V (${r.ripplePct.toFixed(1)} %)`}
          </VrText>
        ) : null}
      </Suspense>
    </group>
  );
}

function Wire({ points, color, radius = 0.012 }: { points: Vec[]; color: string; radius?: number }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.5);
    return new THREE.TubeGeometry(curve, 40, radius, 8, false);
  }, [points, radius]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}
