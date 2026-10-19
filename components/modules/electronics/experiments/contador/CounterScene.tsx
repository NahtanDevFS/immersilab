"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { VrText } from "@/components/vr/VrText";
import { HEX, configOf, type CounterEngine, type CounterRuntime } from "./engine";

const TABLE_Y = 0.9;
const CHIP_X = [-1.05, -0.45, 0.15, 0.75];
const ON = "#facc15";
const OFF = "#334155";

/*
 * El diagrama de tiempos se dibuja en un <canvas> 2D que se usa de textura:
 * así las líneas salen gruesas (WebGL dibuja líneas de un píxel) y se leen
 * en el visor. Las funciones que lo tocan están fuera del componente porque
 * mutan el canvas y su textura, como en el pizarrón.
 */
const SCOPE_W = 1024;
const SCOPE_H = 520;
const CHANNELS = ["Reloj", "Q0", "Q1", "Q2", "Q3"];
const CHANNEL_COLORS = ["#f59e0b", "#2dd4bf", "#60a5fa", "#c084fc", "#f472b6"];

function drawScope(ctx: CanvasRenderingContext2D, texture: THREE.CanvasTexture, r: CounterRuntime) {
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, SCOPE_W, SCOPE_H);
  const left = 120;
  const right = SCOPE_W - 20;
  const rowH = (SCOPE_H - 40) / CHANNELS.length;
  // Ventana: un período entero de Q3 sin reinicio (16 del reloj), con topes.
  const windowSeconds = r.config.manual ? 12 : Math.min(32, Math.max(2, 16 / r.config.frequency));
  const t1 = r.time;
  const t0 = t1 - windowSeconds;
  const x = (t: number) => left + ((t - t0) / windowSeconds) * (right - left);

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2;
  for (let k = 0; k <= 8; k++) {
    const gx = left + (k / 8) * (right - left);
    ctx.beginPath();
    ctx.moveTo(gx, 20);
    ctx.lineTo(gx, SCOPE_H - 20);
    ctx.stroke();
  }

  CHANNELS.forEach((name, channel) => {
    const top = 20 + channel * rowH + rowH * 0.2;
    const bottom = 20 + (channel + 1) * rowH - rowH * 0.2;
    ctx.fillStyle = CHANNEL_COLORS[channel];
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 14, (top + bottom) / 2);

    // Nivel al empezar la ventana: el último flanco anterior a t0.
    const edges = r.edges.filter((e) => e.channel === channel);
    let level = false;
    for (const e of edges) if (e.t <= t0) level = e.level;
    ctx.strokeStyle = CHANNEL_COLORS[channel];
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let px = left;
    ctx.moveTo(px, level ? top : bottom);
    for (const e of edges) {
      if (e.t <= t0) continue;
      const ex = x(e.t);
      ctx.lineTo(ex, level ? top : bottom);
      level = e.level;
      ctx.lineTo(ex, level ? top : bottom);
      px = ex;
    }
    ctx.lineTo(right, level ? top : bottom);
    ctx.stroke();
  });

  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText(`${windowSeconds.toFixed(windowSeconds < 10 ? 1 : 0)} s en pantalla`, right - 230, SCOPE_H - 12);
  texture.needsUpdate = true;
}

/**
 * Segmentos del display: a, b, c, d, e, f, g, como posición y tamaño en un
 * dígito de 0.3 × 0.5. Los que se encienden para cada valor de 0 a F.
 */
const SEGMENTS: Array<{ pos: [number, number]; size: [number, number] }> = [
  { pos: [0, 0.22], size: [0.2, 0.04] },
  { pos: [0.11, 0.11], size: [0.04, 0.2] },
  { pos: [0.11, -0.11], size: [0.04, 0.2] },
  { pos: [0, -0.22], size: [0.2, 0.04] },
  { pos: [-0.11, -0.11], size: [0.04, 0.2] },
  { pos: [-0.11, 0.11], size: [0.04, 0.2] },
  { pos: [0, 0], size: [0.2, 0.04] },
];
const DIGITS: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc",
  "8": "abcdefg", "9": "abcdfg", A: "abcefg", b: "cdefg", C: "adef", d: "bcdeg", E: "adefg", F: "aefg",
};

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * La mesa del contador: generador de reloj, cuatro flip-flops T en fila,
 * decodificador y display, la NAND de reinicio adelante y la pantalla con el
 * diagrama de tiempos atrás.
 */
export function CounterScene({ engine, variables }: Props) {
  const counter = engine as CounterEngine;
  useFixedTimestep((dt) => counter.update(dt, variables));

  const [runtime, setRuntime] = useState<CounterRuntime>(() => ({ ...counter.getRuntime(), q: [...counter.getRuntime().q] }));
  const scope = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = SCOPE_W;
    canvas.height = SCOPE_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { ctx: canvas.getContext("2d"), texture };
  }, []);
  useEffect(() => () => scope.texture.dispose(), [scope]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = counter.getRuntime();
      setRuntime({ ...r, q: [...r.q] });
      if (scope.ctx) drawScope(scope.ctx, scope.texture, r);
    }, 100);
    return () => window.clearInterval(id);
  }, [counter, scope]);

  const config = configOf(variables);
  const shown = runtime.flash ?? runtime.value;
  const nandInputs = config.resetInputs.map((s, i) => (s ? `Q${i}` : "")).filter(Boolean);

  return (
    <group>
      {/* Mesa */}
      <mesh position={[0.2, TABLE_Y - 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.08, 1.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      {[-1.9, 2.3].map((x) => (
        <mesh key={x} position={[x, (TABLE_Y - 0.08) / 2, 0]}>
          <boxGeometry args={[0.08, TABLE_Y - 0.08, 1.2]} />
          <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Generador de reloj */}
      <group position={[-1.7, TABLE_Y + 0.15, 0]}>
        <mesh>
          <boxGeometry args={[0.4, 0.3, 0.35]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <Led on={runtime.clock} color={ON} position={[0, 0.2, 0.05]} />
        <Suspense fallback={null}>
          <VrText position={[0, 0.05, 0.18]} anchorX="center" fontSize={0.055}>
            {"Reloj"}
          </VrText>
          <VrText position={[0, -0.06, 0.18]} anchorX="center" fontSize={0.045} color="#93a1be">
            {config.manual ? "manual" : `${config.frequency} Hz${runtime.running ? "" : " (detenido)"}`}
          </VrText>
        </Suspense>
      </group>

      {/* Pistas de reloj entre etapas, encendidas con el nivel de la señal que llevan. */}
      {CHIP_X.map((x, i) => {
        const from = i === 0 ? -1.5 : CHIP_X[i - 1] + 0.2;
        const signal = i === 0 ? runtime.clock : config.fromQbar[i - 1] ? !runtime.q[i - 1] : runtime.q[i - 1];
        return (
          <mesh key={i} position={[(from + x - 0.2) / 2, TABLE_Y + 0.006, 0.1]}>
            <boxGeometry args={[x - 0.2 - from, 0.01, 0.03]} />
            <meshBasicMaterial color={signal ? ON : OFF} toneMapped={false} />
          </mesh>
        );
      })}

      {CHIP_X.map((x, i) => (
        <FlipFlop
          key={i}
          index={i}
          x={x}
          q={runtime.q[i]}
          source={i === 0 ? "reloj" : `${config.fromQbar[i - 1] ? "/Q" : "Q"}${i - 1}`}
        />
      ))}

      {/* Decodificador y display */}
      <group position={[1.4, TABLE_Y + 0.08, 0]}>
        <mesh>
          <boxGeometry args={[0.36, 0.14, 0.3]} />
          <meshStandardMaterial color="#111827" roughness={0.5} />
        </mesh>
        <Suspense fallback={null}>
          <VrText position={[0, 0.1, 0.05]} rotation={[-Math.PI / 2, 0, 0]} anchorX="center" fontSize={0.045}>
            {"BCD → 7 seg"}
          </VrText>
        </Suspense>
      </group>
      <group position={[2.0, TABLE_Y + 0.4, 0]}>
        <mesh>
          <boxGeometry args={[0.42, 0.66, 0.06]} />
          <meshStandardMaterial color="#0b0f14" roughness={0.4} />
        </mesh>
        <SevenSegment char={HEX[shown]} flash={runtime.flash !== null} />
        <Suspense fallback={null}>
          <VrText position={[0, -0.42, 0.04]} anchorX="center" fontSize={0.05}>
            {`${[3, 2, 1, 0].map((i) => (runtime.q[i] ? 1 : 0)).join("")} = ${runtime.value}`}
          </VrText>
        </Suspense>
      </group>

      {/* NAND de reinicio */}
      <group position={[0.2, TABLE_Y + 0.08, 0.45]}>
        <mesh>
          <boxGeometry args={[0.6, 0.14, 0.22]} />
          <meshStandardMaterial color={nandInputs.length ? "#312e81" : "#1f2937"} roughness={0.5} />
        </mesh>
        <Led on={runtime.flash !== null} color="#ef4444" position={[0.36, 0, 0]} />
        <Suspense fallback={null}>
          <VrText position={[0, 0.1, 0.06]} rotation={[-Math.PI / 2, 0, 0]} anchorX="center" fontSize={0.045}>
            {nandInputs.length ? `NAND: ${nandInputs.join(" · ")} → carga ${config.load}` : "NAND: sin entradas"}
          </VrText>
        </Suspense>
      </group>

      {/* Pantalla del diagrama de tiempos */}
      <group position={[0.2, 2.05, -0.75]}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[2.9, 1.55, 0.05]} />
          <meshStandardMaterial color="#111827" roughness={0.5} />
        </mesh>
        <mesh>
          <planeGeometry args={[2.75, 2.75 * (SCOPE_H / SCOPE_W)]} />
          <meshBasicMaterial map={scope.texture} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.95, -0.03]}>
          <boxGeometry args={[0.08, 0.5, 0.08]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </group>
    </group>
  );
}

function Led({ on, color, position }: { on: boolean; color: string; position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.035, 14, 10]} />
      <meshStandardMaterial color={on ? color : "#1f2937"} emissive={color} emissiveIntensity={on ? 2.2 : 0} toneMapped={false} />
    </mesh>
  );
}

function FlipFlop({ index, x, q, source }: { index: number; x: number; q: boolean; source: string }) {
  return (
    <group position={[x, TABLE_Y + 0.07, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.12, 0.34]} />
        <meshStandardMaterial color="#111111" roughness={0.5} />
      </mesh>
      {[-0.14, -0.05, 0.05, 0.14].map((px) =>
        [-1, 1].map((s) => (
          <mesh key={`${px}${s}`} position={[px, -0.04, s * 0.18]}>
            <boxGeometry args={[0.025, 0.05, 0.03]} />
            <meshStandardMaterial color="#c7ccd4" metalness={0.8} roughness={0.3} />
          </mesh>
        )),
      )}
      <Led on={q} color="#22c55e" position={[0.12, 0.1, -0.08]} />
      <Suspense fallback={null}>
        <VrText position={[-0.17, 0.065, 0.02]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.05}>
          {`FF${index} · T`}
        </VrText>
        <VrText position={[0, 0.3, 0]} anchorX="center" fontSize={0.075} color={q ? "#4ade80" : "#93a1be"}>
          {`Q${index} = ${q ? 1 : 0}`}
        </VrText>
        <VrText position={[0, 0.19, 0]} anchorX="center" fontSize={0.04} color="#93a1be">
          {`reloj ← ${source}`}
        </VrText>
      </Suspense>
    </group>
  );
}

function SevenSegment({ char, flash }: { char: string; flash: boolean }) {
  const lit = DIGITS[char] ?? "";
  const color = flash ? "#f97316" : "#ef4444";
  return (
    <group position={[0, 0.02, 0.035]} scale={1.25}>
      {SEGMENTS.map((seg, i) => {
        const on = lit.includes("abcdefg"[i]);
        return (
          <mesh key={i} position={[seg.pos[0], seg.pos[1], 0]}>
            <planeGeometry args={seg.size} />
            <meshBasicMaterial color={on ? color : "#2a0b0b"} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

