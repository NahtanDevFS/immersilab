"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { VrText } from "@/components/vr/VrText";
import {
  colorBands,
  formatOhms,
  getLed,
  LED_OK_MAX,
  MEASURE_POINTS,
  type Level,
  type MeasurePoint,
  type ProtoboardEngine,
} from "./engine";

/*
 * Todo se dibuja a escala de maqueta: la protoboard mide 2.4 m en vez de
 * 16 cm. A tamaño real no se distinguirían las bandas de una resistencia, ni
 * desde la compu ni (sobre todo) con el visor puesto.
 */
const TABLE_Y = 0.85;
const BOARD_W = 2.4;
const BOARD_D = 0.9;
const TOP = TABLE_Y + 0.07; // superficie de la protoboard
const RAIL_PLUS_Z = -0.36;
const RAIL_MINUS_Z = 0.36;

type Vec = [number, number, number];

/** Dónde va cada cosa en cada circuito (x, z sobre la protoboard). */
interface Layout {
  r1: [Vec, Vec];
  r2?: [Vec, Vec];
  r3?: [Vec, Vec];
  led?: [Vec, Vec];
  /** Cables: listas de puntos. */
  wires: Array<{ points: Vec[]; color: string }>;
}

const at = (x: number, z: number): Vec => [x, TOP, z];

const LAYOUTS: Record<Level, Layout> = {
  led: {
    r1: [at(-0.6, -0.05), at(-0.1, -0.05)],
    led: [at(0.1, -0.05), at(0.45, -0.05)],
    wires: [
      { points: [at(-0.8, RAIL_PLUS_Z), at(-0.8, -0.05), at(-0.6, -0.05)], color: "#e0201b" },
      { points: [at(-0.1, -0.05), at(0.1, -0.05)], color: "#f4d01c" },
      { points: [at(0.45, -0.05), at(0.7, -0.05), at(0.7, RAIL_MINUS_Z)], color: "#1c1f26" },
    ],
  },
  divisor: {
    r1: [at(-0.6, -0.05), at(-0.1, -0.05)],
    r2: [at(0.15, -0.05), at(0.65, -0.05)],
    wires: [
      { points: [at(-0.8, RAIL_PLUS_Z), at(-0.8, -0.05), at(-0.6, -0.05)], color: "#e0201b" },
      { points: [at(-0.1, -0.05), at(0.15, -0.05)], color: "#f4d01c" },
      { points: [at(0.65, -0.05), at(0.85, -0.05), at(0.85, RAIL_MINUS_Z)], color: "#1c1f26" },
    ],
  },
  paralelo: {
    r1: [at(-0.7, 0), at(-0.2, 0)],
    r2: [at(0.1, -0.18), at(0.6, -0.18)],
    r3: [at(0.1, 0.18), at(0.6, 0.18)],
    wires: [
      { points: [at(-0.9, RAIL_PLUS_Z), at(-0.9, 0), at(-0.7, 0)], color: "#e0201b" },
      { points: [at(-0.2, 0), at(-0.05, 0), at(-0.05, -0.18), at(0.1, -0.18)], color: "#f4d01c" },
      { points: [at(-0.05, 0), at(-0.05, 0.18), at(0.1, 0.18)], color: "#f4d01c" },
      { points: [at(0.6, -0.18), at(0.8, -0.18), at(0.8, 0.18)], color: "#1c1f26" },
      { points: [at(0.6, 0.18), at(0.8, 0.18), at(0.8, RAIL_MINUS_Z)], color: "#1c1f26" },
    ],
  },
};

/** Los dos extremos donde se apoyan las puntas del multímetro. */
function probeTargets(layout: Layout, point: MeasurePoint): [Vec, Vec] | null {
  switch (point) {
    case "v_r1":
    case "i_total":
      return layout.r1;
    case "v_r2":
    case "i_r2":
      return layout.r2 ?? null;
    case "v_r3":
    case "i_r3":
      return layout.r3 ?? null;
    case "v_led":
      return layout.led ?? null;
  }
}

const MULTIMETER: Vec = [1.45, TABLE_Y + 0.2, 0.2];
const BURNED_LED = new THREE.Color("#222222");

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * La protoboard con su circuito, la batería y el multímetro.
 *
 * Cada resistencia lleva sus bandas de colores de verdad (para practicar el
 * código) y su valor escrito encima. El LED brilla según la corriente y se
 * apaga negro si se quema; una resistencia quemada se ve carbonizada.
 */
export function ProtoboardScene({ engine, variables }: Props) {
  const board = engine as ProtoboardEngine;
  useFixedTimestep((dt) => board.update(dt, variables));

  const level = (String(variables.nivel ?? "led") as Level) in LAYOUTS
    ? (String(variables.nivel ?? "led") as Level)
    : "led";
  const layout = LAYOUTS[level];
  const point = String(variables.medir ?? "i_total") as MeasurePoint;
  const probes = probeTargets(layout, point);
  const led = getLed(variables.led ?? "rojo");

  return (
    <group>
      <Table />
      <Breadboard />
      <Battery />

      <Resistor id="r1" ends={layout.r1} ohms={Number(variables.r1 ?? 1000)} engine={board} />
      {layout.r2 && <Resistor id="r2" ends={layout.r2} ohms={Number(variables.r2 ?? 1000)} engine={board} />}
      {layout.r3 && <Resistor id="r3" ends={layout.r3} ohms={Number(variables.r3 ?? 2200)} engine={board} />}
      {layout.led && <Led ends={layout.led} color={led.color} engine={board} />}

      {layout.wires.map((wire, k) => (
        <Wire key={`${level}-${k}`} points={wire.points} color={wire.color} />
      ))}

      <Multimeter engine={board} label={MEASURE_POINTS.find((p) => p.id === point)?.label ?? ""} />
      {probes && (
        <>
          <Wire points={[[MULTIMETER[0] - 0.05, MULTIMETER[1] - 0.12, MULTIMETER[2] + 0.12], lift(probes[0])]} color="#e0201b" radius={0.008} sag />
          <Wire points={[[MULTIMETER[0] + 0.05, MULTIMETER[1] - 0.12, MULTIMETER[2] + 0.12], lift(probes[1])]} color="#1c1f26" radius={0.008} sag />
        </>
      )}

      <Suspense fallback={null}>
        <VrText position={[-BOARD_W / 2, TOP + 0.02, -BOARD_D / 2 - 0.08]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.07} color="#93a1be">
          {level === "led"
            ? "Nivel 1 · R1 en serie con el LED"
            : level === "divisor"
              ? "Nivel 2 · Divisor de voltaje: la salida es el voltaje en R2"
              : "Nivel 3 · R1 en serie con R2 y R3 en paralelo"}
        </VrText>
      </Suspense>
    </group>
  );
}

function lift([x, y, z]: Vec): Vec {
  return [x, y + 0.06, z];
}

/* ------------------------------------------------------------------------ */

function Table() {
  return (
    <group>
      <mesh position={[0, TABLE_Y - 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 0.06, 1.6]} />
        <meshStandardMaterial color="#6b4f35" roughness={0.75} />
      </mesh>
      {[-1.85, 1.85].map((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (TABLE_Y - 0.06) / 2, z]} castShadow>
            <boxGeometry args={[0.08, TABLE_Y - 0.06, 0.08]} />
            <meshStandardMaterial color="#3a3f48" metalness={0.5} roughness={0.5} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Protoboard: tablero blanco, rieles de alimentación y la grilla de agujeros. */
function Breadboard() {
  const holes = useMemo(() => {
    const list: Vec[] = [];
    for (let x = -1.1; x <= 1.1001; x += 0.05) {
      for (const z of [-0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
        list.push([x, TOP + 0.001, z]);
      }
      for (const z of [RAIL_PLUS_Z - 0.03, RAIL_PLUS_Z + 0.03, RAIL_MINUS_Z - 0.03, RAIL_MINUS_Z + 0.03]) {
        list.push([x, TOP + 0.001, z]);
      }
    }
    return list;
  }, []);

  const holesRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = holesRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    holes.forEach((p, i) => {
      dummy.position.set(...p);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [holes]);

  return (
    <group>
      <mesh position={[0, TOP - 0.035, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_W, 0.07, BOARD_D]} />
        <meshStandardMaterial color="#f1f0ea" roughness={0.6} />
      </mesh>
      {/* Rieles: rojo (+9 V) arriba y azul (tierra) abajo. */}
      {[
        { z: RAIL_PLUS_Z - 0.06, color: "#e0201b" },
        { z: RAIL_MINUS_Z + 0.06, color: "#1d4ed8" },
      ].map((rail) => (
        <mesh key={rail.z} position={[0, TOP + 0.002, rail.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[BOARD_W - 0.1, 0.012]} />
          <meshBasicMaterial color={rail.color} />
        </mesh>
      ))}
      {/* frustumCulled={false}: ver el comentario en QamScene. */}
      <instancedMesh ref={holesRef} frustumCulled={false} args={[undefined, undefined, holes.length]}>
        <planeGeometry args={[0.018, 0.018]} />
        <meshBasicMaterial color="#3a3a3a" />
      </instancedMesh>
      <Suspense fallback={null}>
        <VrText position={[BOARD_W / 2 - 0.05, TOP + 0.003, RAIL_PLUS_Z - 0.06]} rotation={[-Math.PI / 2, 0, 0]} anchorX="right" fontSize={0.05} color="#e0201b">
          + 9 V
        </VrText>
        <VrText position={[BOARD_W / 2 - 0.05, TOP + 0.003, RAIL_MINUS_Z + 0.06]} rotation={[-Math.PI / 2, 0, 0]} anchorX="right" fontSize={0.05} color="#1d4ed8">
          − tierra
        </VrText>
      </Suspense>
    </group>
  );
}

function Battery() {
  return (
    <group position={[-1.65, TABLE_Y, -0.1]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.26, 0.4, 0.14]} />
        <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.27, 0.071]}>
        <planeGeometry args={[0.22, 0.12]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[0, 0.27, 0.073]} anchorX="center" fontSize={0.07} color="#111827">
          9 V
        </VrText>
      </Suspense>
      {/* Bornes y cables a los rieles. */}
      <Wire points={[[-0.05, 0.42, 0], [-0.05, 0.55, 0], [0.6, 0.2, -0.26], [0.85, TOP - TABLE_Y, -0.26]]} color="#e0201b" />
      <Wire points={[[0.05, 0.42, 0], [0.05, 0.5, 0], [0.6, 0.15, 0.46], [0.85, TOP - TABLE_Y, 0.46]]} color="#1c1f26" />
    </group>
  );
}

/** Una resistencia horizontal entre dos agujeros, con sus bandas y sus patas. */
function Resistor({
  id,
  ends,
  ohms,
  engine,
}: {
  id: "r1" | "r2" | "r3";
  ends: [Vec, Vec];
  ohms: number;
  engine: ProtoboardEngine;
}) {
  const bodyRef = useRef<THREE.MeshStandardMaterial>(null);
  const [a, b] = ends;
  const mid: Vec = [(a[0] + b[0]) / 2, TOP + 0.07, (a[2] + b[2]) / 2];
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const angle = Math.atan2(b[2] - a[2], b[0] - a[0]);
  const bands = colorBands(ohms);

  useFrame(() => {
    const material = bodyRef.current;
    if (!material) return;
    material.color.set(engine.getRuntime().burned[id] ? "#2b2420" : "#d9c08f");
  });

  return (
    <group>
      <group position={mid} rotation={[0, -angle, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, length * 0.5, 20]} />
          <meshStandardMaterial ref={bodyRef} color="#d9c08f" roughness={0.6} />
        </mesh>
        {bands.colors.map((color, k) => (
          <mesh key={k} position={[-length * 0.17 + k * length * 0.09 + (k === 3 ? length * 0.05 : 0), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.047, 0.047, 0.022, 20]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={k === 3 ? 0.7 : 0} />
          </mesh>
        ))}
        {/* Patas */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, length, 6]} />
          <meshStandardMaterial color="#b8bcc4" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
      {[a, b].map((p, k) => (
        <mesh key={k} position={[p[0], TOP + 0.035, p[2]]}>
          <cylinderGeometry args={[0.006, 0.006, 0.07, 6]} />
          <meshStandardMaterial color="#b8bcc4" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <VrText position={[mid[0], TOP + 0.2, mid[2]]} anchorX="center" fontSize={0.06}>
          {`${id.toUpperCase()} · ${formatOhms(ohms)}`}
        </VrText>
        <VrText position={[mid[0], TOP + 0.14, mid[2]]} anchorX="center" fontSize={0.035} color="#93a1be">
          {bands.names.join(" · ")}
        </VrText>
      </Suspense>
    </group>
  );
}

/** LED: cápsula de color que brilla según la corriente. */
function Led({ ends, color, engine }: { ends: [Vec, Vec]; color: string; engine: ProtoboardEngine }) {
  const domeRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const base = useMemo(() => new THREE.Color(color), [color]);
  const [a, b] = ends;
  const mid: Vec = [(a[0] + b[0]) / 2, TOP, (a[2] + b[2]) / 2];

  useFrame(() => {
    const r = engine.getRuntime();
    const glow = r.burned.led ? 0 : Math.min(1.6, r.solution.total / LED_OK_MAX);
    const dome = domeRef.current;
    if (dome) {
      dome.color.copy(r.burned.led ? BURNED_LED : base);
      dome.emissive.copy(base);
      dome.emissiveIntensity = glow * 2.2;
    }
    if (lightRef.current) lightRef.current.intensity = glow * 1.5;
  });

  return (
    <group>
      <group position={[mid[0], mid[1] + 0.16, mid[2]]}>
        <mesh>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 24]} />
          <meshStandardMaterial ref={domeRef} color={color} transparent opacity={0.92} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.9} />
        </mesh>
        <pointLight ref={lightRef} color={color} distance={1.2} intensity={0} />
      </group>
      {/* Patas: el ánodo (+) es la más larga. */}
      <Wire points={[[a[0], TOP, a[2]], [mid[0] - 0.03, TOP + 0.1, mid[2]]]} color="#b8bcc4" radius={0.006} />
      <Wire points={[[b[0], TOP, b[2]], [mid[0] + 0.03, TOP + 0.1, mid[2]]]} color="#b8bcc4" radius={0.006} />
      <Suspense fallback={null}>
        <VrText position={[mid[0], TOP + 0.38, mid[2]]} anchorX="center" fontSize={0.06}>
          LED
        </VrText>
      </Suspense>
    </group>
  );
}

/** Cable: tubo por los puntos dados, un poco elevado sobre la protoboard. */
function Wire({
  points,
  color,
  radius = 0.012,
  sag = false,
}: {
  points: Vec[];
  color: string;
  radius?: number;
  sag?: boolean;
}) {
  const geometry = useMemo(() => {
    const vectors = points.map(([x, y, z]) => new THREE.Vector3(x, y + (sag ? 0 : 0.012), z));
    if (sag && vectors.length === 2) {
      // Las puntas del multímetro cuelgan en curva, no en línea recta.
      const [p, q] = vectors;
      const middle = p.clone().lerp(q, 0.5);
      middle.y = Math.min(p.y, q.y) - 0.05;
      vectors.splice(1, 0, middle);
    }
    const curve = new THREE.CatmullRomCurve3(vectors, false, "catmullrom", sag ? 0.5 : 0.05);
    return new THREE.TubeGeometry(curve, 48, radius, 8, false);
  }, [points, radius, sag]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}

/** Multímetro sobre la mesa, con la pantalla de frente al jugador. */
function Multimeter({ engine, label }: { engine: ProtoboardEngine; label: string }) {
  // La pantalla se lee unas veces por segundo, como un multímetro de verdad:
  // un texto 3D que cambia 60 veces por segundo además ni se alcanza a leer.
  const [display, setDisplay] = useState(() => engine.getRuntime().display);
  useEffect(() => {
    const id = window.setInterval(() => setDisplay(engine.getRuntime().display), 200);
    return () => window.clearInterval(id);
  }, [engine]);

  return (
    <group position={MULTIMETER} rotation={[-0.35, -0.35, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.62, 0.12]} />
        <meshStandardMaterial color="#f2b705" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.14, 0.061]}>
        <planeGeometry args={[0.34, 0.16]} />
        <meshBasicMaterial color="#9fb59b" />
      </mesh>
      <mesh position={[0, -0.1, 0.065]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 24]} />
        <meshStandardMaterial color="#1f2328" />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[0, 0.14, 0.064]} anchorX="center" fontSize={0.07} color="#1b2a1b">
          {display || "---"}
        </VrText>
        <VrText position={[0, 0.36, 0.064]} anchorX="center" fontSize={0.03} maxWidth={0.4} textAlign="center" color="#1f2328">
          {label}
        </VrText>
      </Suspense>
    </group>
  );
}
