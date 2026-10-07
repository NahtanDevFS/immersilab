"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import {
  STATIONS,
  CHANNEL_KHZ,
  bandwidthKhz,
  formatFrequency,
  spectralLines,
  type ModulationEngine,
} from "./engine";
import styles from "./ModulationScene.module.css";

/*
 * Tres zonas, para que cada idea tenga su lugar:
 *  - Al fondo a la izquierda, las tres ondas apiladas: moduladora, portadora
 *    y modulada. Es el dominio del tiempo.
 *  - Al fondo a la derecha, el espectro de TU emisora: portadora y bandas
 *    laterales. Es el dominio de la frecuencia, y donde se ve el precio de
 *    FM: más rayas, más ancho de banda. Tiempo y frecuencia lado a lado.
 *  - Al frente, sobre el piso, el dial: las emisoras cercanas y el filtro del
 *    receptor (la caja ámbar). Sintonizar es meter la emisora en la caja.
 *
 * Todo cabe entre x = 0 y x = 11 para verse completo desde la cámara con la
 * que se entra (mira a 5, 1, 0); las esquinas de la pantalla quedan para los
 * paneles del shell.
 */
const WAVE_POINTS = 400;
const WAVE_X0 = 0;
const WAVE_SPAN = 6.2;
/** Ciclos de portadora a lo ancho del panel de ondas. */
const CARRIER_CYCLES = 16;
const WAVE_Z = -1.2;
const WAVE_ROWS = { moduladora: 3.7, portadora: 2.5, modulada: 1.2 };
const WAVE_AMP = 0.42;

const DIAL_Z = 2.2;
/** Medio ancho de la vista del dial, en kHz. */
const DIAL_WINDOW_KHZ = { am: 20, fm: 400 };

const ZOOM_X = 8.7;
const ZOOM_Y = 1.0;
const ZOOM_Z = -1.2;
const ZOOM_WIDTH = 3.4;
const ZOOM_HEIGHT = 2.6;
/** Medio ancho del panel de espectro propio, en kHz. Fijo por banda para que se note cuando el ancho crece. */
const ZOOM_WINDOW_KHZ = { am: 4, fm: 16 };
const MAX_LINES = 17;

const OWN_COLOR = new THREE.Color(0.25, 2.2, 1.9);
const OTHER_COLOR = new THREE.Color(0.55, 0.62, 0.78);

function makeLine(color: THREE.Color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(WAVE_POINTS * 3), 3),
  );
  return new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color, toneMapped: false }),
  );
}

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function ModulationScene({ engine, variables }: Props) {
  const radio = engine as ModulationEngine;
  const band = variables.tipo === "fm" ? "fm" : "am";

  useFixedTimestep((dt) => {
    radio.update(dt, variables);
  });

  // Las líneas se arman como objetos de three y se montan con <primitive>
  // (la etiqueta <line> de JSX choca con la de SVG en TypeScript), y se
  // modifican a través de refs: el compilador de React no permite mutar lo
  // que devuelve un hook.
  const waves = useMemo(
    () => ({
      moduladora: makeLine(new THREE.Color(1.6, 1.1, 0.5)),
      portadora: makeLine(new THREE.Color(0.7, 0.8, 1.2)),
      modulada: makeLine(new THREE.Color(0.3, 2.3, 2.0)),
    }),
    [],
  );
  const modRef = useRef<THREE.Line>(null);
  const carrierRef = useRef<THREE.Line>(null);
  const modulatedRef = useRef<THREE.Line>(null);

  const stationRefs = useRef<Array<THREE.Mesh | null>>([]);
  const zoomRef = useRef<THREE.InstancedMesh>(null);
  const carsonRef = useRef<THREE.Mesh>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const r = radio.getRuntime();
    const t = r.clock;
    const modCycles = 1.5 + r.tone / 1000;

    // --- Ondas en el tiempo -------------------------------------------------
    const lines: Array<[THREE.Line | null, number, (u: number) => number]> = [
      [modRef.current, WAVE_ROWS.moduladora, (u) => Math.sin(2 * Math.PI * (modCycles * u - 0.5 * t))],
      [carrierRef.current, WAVE_ROWS.portadora, (u) => Math.sin(2 * Math.PI * (CARRIER_CYCLES * u - 3 * t))],
      [
        modulatedRef.current,
        WAVE_ROWS.modulada,
        (u) => {
          const m = Math.sin(2 * Math.PI * (modCycles * u - 0.5 * t));
          const phase = 2 * Math.PI * (CARRIER_CYCLES * u - 3 * t);
          return r.band === "am"
            ? ((1 + r.index * m) * Math.sin(phase)) / 2
            : Math.sin(phase + r.index * m);
        },
      ],
    ];
    for (const [line, y, fn] of lines) {
      if (!line) continue;
      const attr = line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < WAVE_POINTS; i++) {
        const u = i / (WAVE_POINTS - 1);
        attr.setXYZ(i, WAVE_X0 + u * WAVE_SPAN, y + fn(u) * WAVE_AMP, WAVE_Z);
      }
      attr.needsUpdate = true;
    }

    // --- Dial: emisoras alrededor de la frecuencia sintonizada -------------
    const windowKhz = DIAL_WINDOW_KHZ[r.band];
    const toUnits = r.band === "fm" ? 1000 : 1;
    STATIONS.forEach((station, i) => {
      const mesh = stationRefs.current[i];
      if (!mesh) return;
      const rel = (station.carrier - r.dial) * toUnits;
      const visible = station.band === r.band && Math.abs(rel) < windowKhz;
      mesh.visible = visible;
      if (!visible) return;
      const index = station.own ? r.index : r.band === "am" ? 0.5 : 2;
      const tone = station.own ? r.tone : station.tone;
      // El ancho dibujado es el ancho de banda real de la emisora, con un
      // mínimo para que en FM (donde el canal es enorme) se siga viendo.
      const widthKhz = Math.max(bandwidthKhz(r.band, index, tone), windowKhz * 0.02);
      mesh.position.set(5 + (rel / windowKhz) * 5, 0.6, DIAL_Z);
      mesh.scale.set((widthKhz / windowKhz) * 5, 1, 1);
    });

    // --- Espectro de la emisora propia -------------------------------------
    if (zoomRef.current) {
      const zoomWindow = ZOOM_WINDOW_KHZ[r.band];
      const spectral = spectralLines(r.band, r.index, r.tone).filter(
        ([f]) => Math.abs(f) <= zoomWindow,
      );
      spectral.slice(0, MAX_LINES).forEach(([f, amplitude], i) => {
        const height = Math.max(0.02, amplitude * ZOOM_HEIGHT * 0.6);
        dummy.position.set(
          ZOOM_X + (f / zoomWindow) * (ZOOM_WIDTH / 2),
          ZOOM_Y + height / 2,
          ZOOM_Z,
        );
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        zoomRef.current!.setMatrixAt(i, dummy.matrix);
      });
      zoomRef.current.count = Math.min(spectral.length, MAX_LINES);
      zoomRef.current.instanceMatrix.needsUpdate = true;

      if (carsonRef.current) {
        const bwFraction = Math.min(1, r.bandwidthKhz / (2 * zoomWindow));
        carsonRef.current.scale.set(Math.max(0.01, bwFraction * ZOOM_WIDTH), 1, 1);
      }
    }

    // --- Pantalla de la radio ----------------------------------------------
    if (displayRef.current) {
      const bars = "▮".repeat(Math.round(r.clarity * 5)).padEnd(5, "▯");
      displayRef.current.textContent =
        `${formatFrequency(r.dial, r.band)}  ${bars}\n` +
        (r.tuned ? r.nearest.name : "· · · estática · · ·");
    }
  });

  return (
    <group>
      <primitive ref={modRef} object={waves.moduladora} />
      <primitive ref={carrierRef} object={waves.portadora} />
      <primitive ref={modulatedRef} object={waves.modulada} />

      {/* Panel detrás de las ondas: sin él las líneas se pierden contra los árboles. */}
      <mesh position={[WAVE_X0 + WAVE_SPAN / 2, 2.45, WAVE_Z - 0.05]}>
        <planeGeometry args={[WAVE_SPAN + 0.6, 3.6]} />
        <meshStandardMaterial color="#0b1220" transparent opacity={0.6} roughness={0.9} />
      </mesh>
      <Html position={[WAVE_X0 - 0.4, WAVE_ROWS.moduladora, WAVE_Z]} center>
        <div className={styles.waveLabel}>Moduladora (tu tono)</div>
      </Html>
      <Html position={[WAVE_X0 - 0.4, WAVE_ROWS.portadora, WAVE_Z]} center>
        <div className={styles.waveLabel}>Portadora</div>
      </Html>
      <Html position={[WAVE_X0 - 0.4, WAVE_ROWS.modulada, WAVE_Z]} center>
        <div className={styles.waveLabel} data-accent>
          Señal {band === "am" ? "AM" : "FM"}
        </div>
      </Html>

      {/* Dial: base, emisoras y filtro del receptor. */}
      <mesh position={[5, 0.03, DIAL_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10.6, 1.8]} />
        <meshStandardMaterial color="#0b1220" roughness={0.9} />
      </mesh>
      {STATIONS.map((station, i) => (
        <mesh
          key={station.id}
          ref={(mesh) => {
            stationRefs.current[i] = mesh;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1.1, 0.5]} />
          <meshBasicMaterial
            color={station.own ? OWN_COLOR : OTHER_COLOR}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[5, 0.75, DIAL_Z]}>
        <boxGeometry
          args={[(CHANNEL_KHZ[band] / DIAL_WINDOW_KHZ[band]) * 5, 1.5, 0.9]}
        />
        <meshBasicMaterial
          color={new THREE.Color(1.6, 1.0, 0.4)}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Html position={[5, 1.8, DIAL_Z]} center>
        <div className={styles.filterLabel}>
          Filtro del receptor · {CHANNEL_KHZ[band]} kHz
        </div>
      </Html>
      <Html position={[0.2, 0.05, DIAL_Z + 1.1]} center>
        <div className={styles.axisNote}>
          −{band === "am" ? "20 kHz" : "400 kHz"}
        </div>
      </Html>
      <Html position={[9.8, 0.05, DIAL_Z + 1.1]} center>
        <div className={styles.axisNote}>
          +{band === "am" ? "20 kHz" : "400 kHz"}
        </div>
      </Html>

      {/* Espectro de la emisora propia. */}
      <group>
        <mesh position={[ZOOM_X, ZOOM_Y + ZOOM_HEIGHT / 2 - 0.1, ZOOM_Z - 0.05]}>
          <planeGeometry args={[ZOOM_WIDTH + 0.5, ZOOM_HEIGHT + 0.8]} />
          <meshStandardMaterial color="#0b1220" transparent opacity={0.65} />
        </mesh>
        <instancedMesh ref={zoomRef} args={[undefined, undefined, MAX_LINES]}>
          <boxGeometry args={[0.06, 1, 0.06]} />
          <meshBasicMaterial color={OWN_COLOR} toneMapped={false} />
        </instancedMesh>
        <mesh ref={carsonRef} position={[ZOOM_X, ZOOM_Y - 0.08, ZOOM_Z]}>
          <boxGeometry args={[1, 0.05, 0.05]} />
          <meshBasicMaterial color={new THREE.Color(1.8, 1.1, 0.4)} toneMapped={false} />
        </mesh>
        {/* Título y fórmula DEBAJO de las rayas: arriba quedaban tapados por
            el panel de resultados del shell, que vive en esa esquina. */}
        <Html position={[ZOOM_X, ZOOM_Y - 0.42, ZOOM_Z]} center>
          <div className={styles.zoomTitle}>
            Espectro de tu emisora · ±{ZOOM_WINDOW_KHZ[band]} kHz
          </div>
        </Html>
        <Html position={[ZOOM_X, ZOOM_Y - 0.8, ZOOM_Z]} center>
          <div className={styles.filterLabel}>
            {band === "am"
              ? "Ancho de banda = 2 × tono"
              : "Ancho de banda (Carson) = 2 × (β + 1) × tono"}
          </div>
        </Html>
      </group>

      {/* La radio: el receptor del que sale el audio. A la derecha del
          dial, donde ningún panel del shell la tapa al entrar. */}
      <group position={[10.3, 0, 0.9]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[1.3, 0.75, 0.5]} />
          <meshStandardMaterial color="#6b4f3a" roughness={0.6} />
        </mesh>
        <mesh position={[-0.28, 0.9, 0.26]}>
          <circleGeometry args={[0.24, 24]} />
          <meshStandardMaterial color="#1f2937" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.27, 0]} castShadow>
          <boxGeometry args={[0.9, 0.54, 0.4]} />
          <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.45, 1.6, -0.1]} rotation={[0, 0, -0.35]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 1.1, 6]} />
          <meshStandardMaterial color="#c0c7d2" metalness={0.9} roughness={0.25} />
        </mesh>
        <Html position={[0.25, 0.92, 0.27]} center>
          <div ref={displayRef} className={styles.display} />
        </Html>
      </group>
    </group>
  );
}
