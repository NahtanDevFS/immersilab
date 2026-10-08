"use client";

import { Suspense, useEffect, useState } from "react";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { VrText } from "@/components/vr/VrText";
import {
  GATES,
  levelInputs,
  type Gate,
  type Level,
  type LogicEngine,
  type LogicRuntime,
  type Slot,
  type Source,
} from "./engine";

/** El tablero: de pie, como un pizarrón, frente al jugador. */
const BOARD = { y: 1.5, z: -0.5, w: 3.8, h: 1.7 };
/** Columna de los interruptores, de la salida y de la tabla de verdad. */
const INPUT_X = -1.55;
const OUTPUT_X = 0.95;
const TABLE_X = 1.3;

const CHIP = { w: 0.34, h: 0.22 };
const ON = "#facc15";
const OFF = "#3b4252";
const DEAD = "#7f1d1d";

type XY = [number, number];

/** Dónde va cada zócalo en cada nivel (en el plano del tablero). */
const SLOT_POS: Record<string, Partial<Record<Slot["id"], XY>>> = {
  alarma: { g1: [-0.2, 0.2] },
  porton: { g1: [-0.55, 0.2], g2: [-0.55, -0.42], g3: [0.35, -0.05] },
  jueces: { g1: [-0.75, 0.42], g2: [-0.75, 0], g3: [-0.75, -0.42], g4: [-0.05, 0.22], g5: [0.55, -0.05] },
};

const INPUT_Y: Record<"A" | "B" | "C", number> = { A: 0.42, B: 0, C: -0.42 };

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * Entrenador digital: interruptores a la izquierda, chips en el medio, LED de
 * salida a la derecha y la tabla de verdad al costado. Los cables que llevan
 * un 1 se encienden en amarillo; los que no reciben señal (por un zócalo
 * vacío), en rojo oscuro.
 */
export function LogicScene({ engine, variables }: Props) {
  const logic = engine as LogicEngine;
  useFixedTimestep((dt) => logic.update(dt, variables));

  // Las señales cambian con los interruptores y durante la prueba: se leen
  // unas veces por segundo para redibujar cables, LEDs y la tabla.
  const [runtime, setRuntime] = useState<LogicRuntime>(() => ({ ...logic.getRuntime() }));
  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...logic.getRuntime(), rows: [...logic.getRuntime().rows] }), 90);
    return () => window.clearInterval(id);
  }, [logic]);

  const level = runtime.level;
  const positions = SLOT_POS[level.id] ?? {};
  const signals = runtime.signals;
  const gateOf = (id: Slot["id"]) => (GATES.find((g) => g.id === variables[id])?.id ?? "vacio") as Gate;

  /** Dónde sale la señal de una fuente (pata de salida). */
  const outPin = (source: Source | Slot["id"]): XY => {
    if (source === "A" || source === "B" || source === "C") return [INPUT_X + 0.18, INPUT_Y[source]];
    const p = positions[source as Slot["id"]] ?? [0, 0];
    return [p[0] + CHIP.w / 2, p[1]];
  };

  return (
    <group position={[0, BOARD.y, BOARD.z]}>
      {/* Tablero y su soporte. */}
      <mesh position={[0, 0, -0.03]} castShadow receiveShadow>
        <boxGeometry args={[BOARD.w, BOARD.h, 0.05]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      {[-BOARD.w / 2 + 0.2, BOARD.w / 2 - 0.2].map((x) => (
        <mesh key={x} position={[x, -BOARD.y / 2 - BOARD.h / 4, -0.06]} castShadow>
          <boxGeometry args={[0.08, BOARD.y - BOARD.h / 2 + 0.2, 0.08]} />
          <meshStandardMaterial color="#3a3f48" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Cables: de cada fuente a cada entrada de zócalo, y del último a la salida. */}
      {level.slots.map((slot) => {
        const p = positions[slot.id] ?? [0, 0];
        const ins: XY[] =
          slot.inputs.length === 1
            ? [[p[0] - CHIP.w / 2, p[1] + 0.05], [p[0] - CHIP.w / 2, p[1] - 0.05]]
            : [[p[0] - CHIP.w / 2, p[1] + 0.05], [p[0] - CHIP.w / 2, p[1] - 0.05]];
        const sources = slot.inputs.length === 1 ? [slot.inputs[0], slot.inputs[0]] : slot.inputs;
        return sources.map((source, k) => (
          <Trace key={`${slot.id}-${k}`} from={outPin(source)} to={ins[k]} value={signals[source] ?? null} />
        ));
      })}
      <Trace
        from={outPin(level.output)}
        to={[OUTPUT_X - 0.09, 0]}
        value={signals[level.output] ?? null}
      />

      {/* Interruptores con su LED. */}
      {levelInputs(level).map((k) => (
        <Switch key={k} name={k} label={level.inputNames[k] ?? k} y={INPUT_Y[k]} on={Boolean(signals[k])} />
      ))}

      {/* Chips en los zócalos. */}
      {level.slots.map((slot) => (
        <Chip key={slot.id} slot={slot} at={positions[slot.id] ?? [0, 0]} gate={gateOf(slot.id)} value={signals[slot.id] ?? null} />
      ))}

      <OutputLed label={level.outputName} value={signals[level.output] ?? null} />
      <TruthTable level={level} runtime={runtime} />

      <Suspense fallback={null}>
        <VrText position={[-BOARD.w / 2 + 0.12, BOARD.h / 2 - 0.1, 0.002]} fontSize={0.075}>
          {level.title}
        </VrText>
        <VrText position={[-BOARD.w / 2 + 0.12, BOARD.h / 2 - 0.2, 0.002]} fontSize={0.045} maxWidth={2.3} color="#93a1be">
          {`${level.story}   ${level.formula}`}
        </VrText>
      </Suspense>
    </group>
  );
}

/** Cable en el tablero, en escuadra (horizontal, vertical, horizontal). */
function Trace({ from, to, value }: { from: XY; to: XY; value: boolean | null }) {
  const midX = (from[0] + to[0]) / 2;
  const color = value === null ? DEAD : value ? ON : OFF;
  const segments: Array<[XY, XY]> = [
    [from, [midX, from[1]]],
    [[midX, from[1]], [midX, to[1]]],
    [[midX, to[1]], to],
  ];
  return (
    <>
      {segments.map(([a, b], k) => {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 1e-4) return null;
        const horizontal = Math.abs(b[1] - a[1]) < 1e-6;
        return (
          <mesh key={k} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.004]}>
            <planeGeometry args={horizontal ? [length + 0.012, 0.012] : [0.012, length + 0.012]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

function Switch({ name, label, y, on }: { name: string; label: string; y: number; on: boolean }) {
  return (
    <group position={[INPUT_X, y, 0]}>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.12, 0.2, 0.04]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
      </mesh>
      <mesh position={[0, on ? 0.05 : -0.05, 0.05]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0.15, 0, 0.02]}>
        <sphereGeometry args={[0.035, 16, 12]} />
        <meshStandardMaterial color={on ? "#ef4444" : "#3f1d1d"} emissive="#ef4444" emissiveIntensity={on ? 2 : 0} toneMapped={false} />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[-0.1, 0.06, 0.002]} anchorX="right" fontSize={0.06}>
          {name}
        </VrText>
        <VrText position={[-0.1, -0.03, 0.002]} anchorX="right" fontSize={0.032} maxWidth={0.42} textAlign="right" color="#93a1be">
          {`${label} · ${on ? 1 : 0}`}
        </VrText>
      </Suspense>
    </group>
  );
}

function Chip({ slot, at, gate, value }: { slot: Slot; at: XY; gate: Gate; value: boolean | null }) {
  const info = GATES.find((g) => g.id === gate);
  const empty = gate === "vacio";
  return (
    <group position={[at[0], at[1], 0]}>
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[CHIP.w, CHIP.h, empty ? 0.01 : 0.05]} />
        <meshStandardMaterial color={empty ? "#334155" : "#111111"} roughness={0.5} />
      </mesh>
      {/* Patas */}
      {!empty &&
        [-0.12, -0.04, 0.04, 0.12].map((x) =>
          [-1, 1].map((s) => (
            <mesh key={`${x}${s}`} position={[x, s * (CHIP.h / 2 + 0.015), 0.02]}>
              <boxGeometry args={[0.02, 0.03, 0.01]} />
              <meshStandardMaterial color="#c7ccd4" metalness={0.8} roughness={0.3} />
            </mesh>
          )),
        )}
      <Suspense fallback={null}>
        <VrText position={[0, 0.03, 0.052]} anchorX="center" fontSize={0.06} color={empty ? "#93a1be" : "#f8fafc"}>
          {empty ? "?" : gate}
        </VrText>
        <VrText position={[0, -0.06, 0.052]} anchorX="center" fontSize={0.03} color="#94a3b8">
          {empty ? `zócalo ${slot.id.slice(1)}` : `${info?.chip} · zócalo ${slot.id.slice(1)}`}
        </VrText>
      </Suspense>
      {/* Punto de salida: muestra el valor que sale del chip. */}
      <mesh position={[CHIP.w / 2 + 0.01, 0, 0.03]}>
        <circleGeometry args={[0.018, 12]} />
        <meshBasicMaterial color={value === null ? DEAD : value ? ON : OFF} toneMapped={false} />
      </mesh>
    </group>
  );
}

function OutputLed({ label, value }: { label: string; value: boolean | null }) {
  return (
    <group position={[OUTPUT_X, 0, 0]}>
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.09, 24, 16]} />
        <meshStandardMaterial
          color={value ? "#22c55e" : "#14321f"}
          emissive="#22c55e"
          emissiveIntensity={value ? 2.5 : 0}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 0, 0.25]} color="#22c55e" intensity={value ? 1.2 : 0} distance={1.5} />
      <Suspense fallback={null}>
        <VrText position={[0, -0.16, 0.002]} anchorX="center" fontSize={0.045} maxWidth={0.5} textAlign="center">
          {`${label}: ${value === null ? "sin señal" : value ? 1 : 0}`}
        </VrText>
      </Suspense>
    </group>
  );
}

/** La tabla de verdad: lo que se pide y lo que dio cada fila al probar. */
function TruthTable({ level, runtime }: { level: Level; runtime: LogicRuntime }) {
  const inputs = levelInputs(level);
  const rowH = 0.13;
  const top = (runtime.rows.length * rowH) / 2;
  return (
    <group position={[TABLE_X, 0, 0]}>
      <mesh position={[0.25, 0, 0.002]}>
        <planeGeometry args={[0.6, runtime.rows.length * rowH + 0.22]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <Suspense fallback={null}>
        <VrText position={[0, top + 0.05, 0.006]} fontSize={0.04} color="#93a1be">
          {`${inputs.join(" ")}  pide  da`}
        </VrText>
        {runtime.rows.map((row, i) => {
          const testing = runtime.testingRow === i;
          const tested = row.actual !== null;
          const good = tested && row.actual === row.expected;
          const y = top - (i + 0.6) * rowH;
          return (
            <group key={i} position={[0, y, 0]}>
              <mesh position={[0.25, 0, 0.004]}>
                <planeGeometry args={[0.56, rowH - 0.015]} />
                <meshBasicMaterial
                  color={testing ? "#854d0e" : !tested ? "#1e293b" : good ? "#14532d" : "#7f1d1d"}
                />
              </mesh>
              <VrText position={[0, 0, 0.006]} fontSize={0.045} color="#e7ecf5">
                {`${inputs.map((k) => (row.inputs[k] ? 1 : 0)).join(" ")}    ${row.expected ? 1 : 0}     ${tested ? (row.actual ? 1 : 0) : "·"}`}
              </VrText>
            </group>
          );
        })}
      </Suspense>
    </group>
  );
}
