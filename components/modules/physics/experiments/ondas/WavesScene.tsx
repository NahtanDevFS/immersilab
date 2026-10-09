"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { FIT_GOAL, WINDOW_S, sumAt, type WavesEngine } from "./engine";
import styles from "./WavesScene.module.css";
import { SceneLabel } from "@/components/vr/SceneLabel";

/*
 * Un solo panel de pie, como un osciloscopio grande:
 *  - Arriba, las tres componentes por separado, chicas, cada una de su color.
 *  - Abajo y grande, la suma (línea brillante) encima del objetivo (banda
 *    blanca translúcida). Calzar la línea dentro de la banda es el juego.
 *  - A la derecha, el medidor de ajuste con la marca de la meta.
 * Ocupa de x = 1 a x = 9.8 y no más: este experimento tiene diez controles,
 * el panel de variables ocupa todo el borde izquierdo de la pantalla, y con
 * un panel de 10 m los números de las filas y la leyenda quedaban debajo.
 */
const POINTS = 360;
const X0 = 1;
const SPAN = 7.6;
const Z = -1.2;
const ROWS = [3.95, 3.35, 2.75];
const ROW_SCALE = 0.24;
const SUM_Y = 1.3;
const SUM_SCALE = 0.42;
const BAND_HALF = 0.06;
/** Velocidad a la que se desplazan las ondas (segundos de señal por segundo real). */
const SCROLL = 0.25;

const COMPONENT_COLORS = [
  new THREE.Color(2.0, 1.25, 0.45),
  new THREE.Color(1.3, 0.75, 2.3),
  new THREE.Color(2.2, 0.6, 1.1),
];
const SUM_COLOR = new THREE.Color(0.3, 2.4, 2.1);

const GAUGE_X = 9.5;
const GAUGE_Y = 0.4;
const GAUGE_HEIGHT = 2.6;

function makeLine(color: THREE.Color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, toneMapped: false }));
}

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function WavesScene({ engine, variables }: Props) {
  const waves = engine as WavesEngine;

  useFixedTimestep((dt) => {
    waves.update(dt, variables);
  });

  // Objetos de three armados una vez y montados con <primitive>; se mutan por
  // refs (el compilador de React no permite mutar lo que devuelve un hook).
  const lines = useMemo(
    () => ({
      components: COMPONENT_COLORS.map(makeLine),
      sum: makeLine(SUM_COLOR),
    }),
    [],
  );
  const band = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POINTS * 2 * 3), 3));
    const indices: number[] = [];
    for (let i = 0; i < POINTS - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(indices);
    return geo;
  }, []);

  const componentRefs = useRef<Array<THREE.Line | null>>([]);
  const sumRef = useRef<THREE.Line>(null);
  const bandRef = useRef<THREE.Mesh>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  const fillMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const fitLabelRef = useRef<HTMLDivElement>(null);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const r = waves.getRuntime();
    const offset = r.clock * SCROLL;
    const timeAt = (i: number) => (WINDOW_S * i) / (POINTS - 1) + offset;
    const xAt = (i: number) => X0 + (SPAN * i) / (POINTS - 1);

    r.components.forEach((component, k) => {
      const line = componentRefs.current[k];
      if (!line) return;
      const attr = line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < POINTS; i++) {
        attr.setXYZ(i, xAt(i), ROWS[k] + sumAt([component], timeAt(i)) * ROW_SCALE, Z);
      }
      attr.needsUpdate = true;
    });

    if (sumRef.current) {
      const attr = sumRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < POINTS; i++) {
        attr.setXYZ(i, xAt(i), SUM_Y + sumAt(r.components, timeAt(i)) * SUM_SCALE, Z + 0.02);
      }
      attr.needsUpdate = true;
    }

    if (bandRef.current) {
      const attr = bandRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < POINTS; i++) {
        const y = SUM_Y + sumAt(r.target.components, timeAt(i)) * SUM_SCALE;
        attr.setXYZ(i * 2, xAt(i), y - BAND_HALF, Z);
        attr.setXYZ(i * 2 + 1, xAt(i), y + BAND_HALF, Z);
      }
      attr.needsUpdate = true;
    }

    // Medidor: crece desde abajo y pasa de rojo a ámbar a verde.
    if (fillRef.current && fillMaterialRef.current) {
      const h = Math.max(0.001, r.fit) * GAUGE_HEIGHT;
      fillRef.current.scale.y = Math.max(0.001, r.fit);
      fillRef.current.position.y = GAUGE_Y + h / 2;
      if (r.fit >= FIT_GOAL) color.setRGB(0.3, 2.2, 1.2);
      else if (r.fit >= 0.7) color.setRGB(2.0, 1.3, 0.4);
      else color.setRGB(1.8, 0.35, 0.3);
      fillMaterialRef.current.color.copy(color);
    }
    if (fitLabelRef.current) {
      fitLabelRef.current.textContent = `Ajuste ${Math.round(r.fit * 100)} %`;
    }
  });

  return (
    <group>
      <mesh position={[X0 + SPAN / 2, 2.35, Z - 0.05]}>
        <planeGeometry args={[SPAN + 0.6, 4.5]} />
        <meshStandardMaterial color="#0b1220" transparent opacity={0.65} roughness={0.9} />
      </mesh>

      {lines.components.map((line, k) => (
        <primitive
          key={k}
          ref={(object: THREE.Line | null) => {
            componentRefs.current[k] = object;
          }}
          object={line}
        />
      ))}
      {ROWS.map((y, k) => (
        <SceneLabel key={k} position={[X0 - 0.35, y, Z]} center>
          <div className={styles.rowLabel} data-row={k}>
            {k + 1}
          </div>
        </SceneLabel>
      ))}

      {/* Separador entre las componentes y la suma. */}
      <mesh position={[X0 + SPAN / 2, 2.4, Z]}>
        <boxGeometry args={[SPAN, 0.01, 0.01]} />
        <meshBasicMaterial color="#26344e" />
      </mesh>

      <mesh ref={bandRef} geometry={band}>
        <meshBasicMaterial
          color={new THREE.Color(1.6, 1.6, 1.8)}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <primitive ref={sumRef} object={lines.sum} />
      <SceneLabel position={[X0 + 0.7, SUM_Y + 1.0, Z]} center>
        <div className={styles.sumLabel}>
          <span data-sum>Tu suma</span>
          <span data-target>Objetivo</span>
        </div>
      </SceneLabel>

      {/* Medidor de ajuste. */}
      <mesh position={[GAUGE_X, GAUGE_Y + GAUGE_HEIGHT / 2, Z]}>
        <boxGeometry args={[0.5, GAUGE_HEIGHT, 0.3]} />
        <meshStandardMaterial color="#131b2e" transparent opacity={0.85} />
      </mesh>
      <mesh ref={fillRef} position={[GAUGE_X, GAUGE_Y, Z + 0.05]}>
        <boxGeometry args={[0.36, GAUGE_HEIGHT, 0.3]} />
        <meshBasicMaterial ref={fillMaterialRef} toneMapped={false} />
      </mesh>
      <mesh position={[GAUGE_X, GAUGE_Y + GAUGE_HEIGHT * FIT_GOAL, Z + 0.22]}>
        <boxGeometry args={[0.7, 0.03, 0.03]} />
        <meshBasicMaterial color={new THREE.Color(2, 2, 2.2)} toneMapped={false} />
      </mesh>
      <SceneLabel position={[GAUGE_X, GAUGE_Y - 0.35, Z]} center>
        <div ref={fitLabelRef} className={styles.fit} />
      </SceneLabel>
      <SceneLabel position={[GAUGE_X + 0.75, GAUGE_Y + GAUGE_HEIGHT * FIT_GOAL, Z]} center>
        <div className={styles.goal}>meta {Math.round(FIT_GOAL * 100)} %</div>
      </SceneLabel>
    </group>
  );
}
