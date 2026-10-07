"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import {
  BANDS,
  ROWS,
  PHONE_BAND,
  frequencyToUnit,
  type SpectrumEngine,
} from "./engine";
import styles from "./SpectrumScene.module.css";

/*
 * La cascada se apoya en el piso y se aleja del jugador: la fila de adelante
 * es el instante actual y cada fila hacia el fondo es un poco más vieja. Así
 * el tiempo se lee como profundidad y la frecuencia de izquierda a derecha,
 * igual que en un analizador de espectro de verdad, pero caminable.
 *
 * Ocupa de x = 0 a x = 10 para quedar centrada en el punto al que mira la
 * cámara del shell al entrar (5, 1, 0).
 */
const X_START = 0;
const X_SPAN = 10;
const Z_FRONT = 1.5;
const Z_DEPTH = 7;
const BASE_Y = 0.05;
const HEIGHT = 2.6;

const LOG_TICKS = [100, 300, 1000, 2000, 3400, 5000, 8000];
const LINEAR_TICKS = [500, 1000, 2000, 3000, 3400, 4000, 6000, 8000];

/** Altura → color, de azul noche a teal, ámbar y blanco. Los valores
 *  mayores a 1 hacen que los picos brillen con el bloom del shell. */
const STOPS: Array<[number, [number, number, number]]> = [
  [0, [0.03, 0.06, 0.14]],
  [0.35, [0.12, 0.75, 0.68]],
  [0.7, [0.95, 0.6, 0.25]],
  [1, [2.2, 1.7, 1.1]],
];

function heatColor(level: number, out: [number, number, number]) {
  for (let s = 1; s < STOPS.length; s++) {
    const [t1, c1] = STOPS[s];
    if (level <= t1 || s === STOPS.length - 1) {
      const [t0, c0] = STOPS[s - 1];
      const k = Math.min(1, Math.max(0, (level - t0) / (t1 - t0)));
      out[0] = c0[0] + (c1[0] - c0[0]) * k;
      out[1] = c0[1] + (c1[1] - c0[1]) * k;
      out[2] = c0[2] + (c1[2] - c0[2]) * k;
      return;
    }
  }
}

function formatHz(hz: number) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz` : `${hz} Hz`;
}

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function SpectrumScene({ engine, variables }: Props) {
  const spectrum = engine as SpectrumEngine;
  const scale = String(variables.escala ?? "logaritmica");
  const maxHz = Number(variables.frecuencia_max ?? 4000);
  const showPhoneBand = variables.marcar_banda !== false;

  useFixedTimestep((dt) => {
    spectrum.update(dt, variables);
  });

  // Una sola malla de BANDS × ROWS vértices para toda la cascada: un draw
  // call, y se actualizan alturas y colores en el lugar cada frame.
  const geometry = useMemo(() => {
    const positions = new Float32Array(BANDS * ROWS * 3);
    const colors = new Float32Array(BANDS * ROWS * 3);
    for (let r = 0; r < ROWS; r++) {
      for (let b = 0; b < BANDS; b++) {
        const v = (r * BANDS + b) * 3;
        positions[v] = X_START + (b / (BANDS - 1)) * X_SPAN;
        positions[v + 1] = BASE_Y;
        positions[v + 2] = Z_FRONT - (r / (ROWS - 1)) * Z_DEPTH;
      }
    }
    const indices: number[] = [];
    for (let r = 0; r < ROWS - 1; r++) {
      for (let b = 0; b < BANDS - 1; b++) {
        const a = r * BANDS + b;
        const c = a + BANDS;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }, []);

  // Se arma como objeto de three y se monta con <primitive>: la etiqueta
  // <line> de JSX choca con la de SVG en los tipos de TypeScript.
  const frontLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(BANDS * 3), 3),
    );
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(2.4, 2.4, 2.6),
      toneMapped: false,
    });
    return new THREE.Line(geo, material);
  }, []);

  // La geometría se modifica a través de los refs de la malla y la línea, no
  // de las variables de useMemo: el compilador de React no permite mutar un
  // valor que salió de un hook después del render.
  const surfaceRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const peakRef = useRef<THREE.Group>(null);
  const peakLabelRef = useRef<HTMLDivElement>(null);
  const rgb = useMemo<[number, number, number]>(() => [0, 0, 0], []);

  useFrame(() => {
    const runtime = spectrum.getRuntime();
    const surface = surfaceRef.current;
    const lineObject = lineRef.current;
    if (!surface || !lineObject) return;
    const positions = surface.geometry.attributes.position as THREE.BufferAttribute;
    const colors = surface.geometry.attributes.color as THREE.BufferAttribute;

    for (let r = 0; r < ROWS; r++) {
      // Fila r = r instantes atrás desde la más reciente (head).
      const source = ((runtime.head - r + ROWS) % ROWS) * BANDS;
      // Las filas viejas se apagan: el ojo va solo a lo que está pasando ahora.
      const fade = 1 - (r / ROWS) * 0.75;
      for (let b = 0; b < BANDS; b++) {
        const level = r === 0 ? runtime.bands[b] : runtime.history[source + b];
        const i = r * BANDS + b;
        positions.setY(i, BASE_Y + level * HEIGHT);
        heatColor(level, rgb);
        colors.setXYZ(i, rgb[0] * fade, rgb[1] * fade, rgb[2] * fade);
      }
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;

    const line = lineObject.geometry.attributes.position as THREE.BufferAttribute;
    for (let b = 0; b < BANDS; b++) {
      line.setXYZ(
        b,
        X_START + (b / (BANDS - 1)) * X_SPAN,
        BASE_Y + runtime.bands[b] * HEIGHT + 0.02,
        Z_FRONT + 0.01,
      );
    }
    line.needsUpdate = true;

    // Marcador del pico: sigue a la frecuencia dominante mientras suene algo.
    if (peakRef.current) {
      peakRef.current.visible = runtime.active;
      if (runtime.active) {
        const x = X_START + frequencyToUnit(runtime.peakHz, scale, maxHz) * X_SPAN;
        peakRef.current.position.set(x, BASE_Y + runtime.peakLevel * HEIGHT, Z_FRONT);
        if (peakLabelRef.current) {
          peakLabelRef.current.textContent = `${Math.round(runtime.peakHz)} Hz${runtime.tonal ? " · tono puro" : ""}`;
        }
      }
    }
  });

  const ticks = (scale === "logaritmica" ? LOG_TICKS : LINEAR_TICKS).filter(
    (hz) => hz <= maxHz,
  );
  const bandX = PHONE_BAND.map(
    (hz) => X_START + frequencyToUnit(hz, scale, maxHz) * X_SPAN,
  );
  const bandVisible = showPhoneBand && PHONE_BAND[0] < maxHz;
  const bandEndX = Math.min(bandX[1], X_START + X_SPAN);

  return (
    <group>
      <mesh ref={surfaceRef} geometry={geometry}>
        {/* Básico y no estándar: la cascada ES el dato, y no tiene que
            oscurecerse por la luz del sol ni por las sombras. */}
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      <primitive ref={lineRef} object={frontLine} />

      {/* Base oscura bajo la cascada: sin ella, los valles bajos se pierden
          contra el pasto. */}
      <mesh
        position={[X_START + X_SPAN / 2, 0.02, Z_FRONT - Z_DEPTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[X_SPAN + 0.6, Z_DEPTH + 0.6]} />
        <meshStandardMaterial color="#0b1220" roughness={0.9} />
      </mesh>

      {/* Banda telefónica: dos paredes translúcidas que la encierran. */}
      {bandVisible && (
        <group>
          {[bandX[0], bandEndX].map((x, i) => (
            <mesh key={i} position={[x, HEIGHT / 2 + BASE_Y, Z_FRONT - Z_DEPTH / 2]}>
              <boxGeometry args={[0.03, HEIGHT, Z_DEPTH]} />
              <meshBasicMaterial
                color={new THREE.Color(1.6, 1.0, 0.4)}
                transparent
                opacity={0.22}
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
          ))}
          <Html
            position={[(bandX[0] + bandEndX) / 2, HEIGHT + 0.45, Z_FRONT - Z_DEPTH / 2]}
            center
          >
            <div className={styles.bandLabel}>Banda telefónica · 300–3400 Hz</div>
          </Html>
        </group>
      )}

      {/* Eje de frecuencia, al pie de la fila actual. */}
      {ticks.map((hz) => (
        <Html
          key={hz}
          position={[X_START + frequencyToUnit(hz, scale, maxHz) * X_SPAN, 0.05, Z_FRONT + 0.45]}
          center
        >
          <div className={styles.tick}>{formatHz(hz)}</div>
        </Html>
      ))}
      <Html position={[X_START - 0.6, 0.05, Z_FRONT - Z_DEPTH]} center>
        <div className={styles.axisNote}>← hace 3 s</div>
      </Html>

      <group ref={peakRef} visible={false}>
        <mesh position={[0, 0.12, 0]}>
          <coneGeometry args={[0.1, 0.22, 12]} />
          <meshBasicMaterial color={new THREE.Color(2.4, 2.4, 2.6)} toneMapped={false} />
        </mesh>
        <Html position={[0, 0.5, 0]} center>
          <div ref={peakLabelRef} className={styles.peakLabel} />
        </Html>
      </group>

      {/* Micrófono de pie, adelante a la izquierda: el origen de todo lo que
          se ve. Sin él, la cascada es un gráfico flotando en un campo. */}
      <group position={[-1.4, 0, Z_FRONT + 0.8]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 0.04, 20]} />
          <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 1.6, 10]} />
          <meshStandardMaterial color="#8e9bb0" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.7, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.18, 6, 14]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
