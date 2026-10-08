"use client";

import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { RAIL_HALF, type CollisionEngine } from "./engine";
import styles from "./CollisionScene.module.css";

const RAIL_LENGTH = RAIL_HALF * 2;
const RAIL_HEIGHT = 0.1;
const CART_DEPTH = 0.4;
/**
 * La escena se corre a x = 5: la cámara del shell entra mirando ahí, y con
 * el riel centrado en 0 el carrito izquierdo arrancaba en el borde de la
 * pantalla. Es solo visual: el motor sigue trabajando alrededor de 0.
 */
const CENTER_X = 5;

const fmt = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function CollisionScene({ engine, variables }: Props) {
  const collision = engine as CollisionEngine;
  const cart1Ref = useRef<THREE.Mesh>(null);
  const cart2Ref = useRef<THREE.Mesh>(null);
  const label1Ref = useRef<THREE.Group>(null);
  const label2Ref = useRef<THREE.Group>(null);
  const text1Ref = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLDivElement>(null);

  useFixedTimestep((dt) => {
    collision.update(dt, variables);
  });

  useFrame(() => {
    const runtime = collision.getRuntime();
    const m1 = Number(variables.mass1 ?? 1);
    const m2 = Number(variables.mass2 ?? 1);

    if (cart1Ref.current) {
      const w1 = 0.6 + m1 * 0.2;
      const h1 = 0.3 + m1 * 0.1;
      cart1Ref.current.position.set(runtime.pos1, RAIL_HEIGHT + h1 / 2, 0);
      cart1Ref.current.scale.set(w1, h1, CART_DEPTH);
    }
    if (cart2Ref.current) {
      const w2 = 0.6 + m2 * 0.2;
      const h2 = 0.3 + m2 * 0.1;
      cart2Ref.current.position.set(runtime.pos2, RAIL_HEIGHT + h2 / 2, 0);
      cart2Ref.current.scale.set(w2, h2, CART_DEPTH);
    }

    // F2: sobre cada carrito, la velocidad real después del choque contra
    // la que predijo el alumno. Se escribe directo en el DOM: cambia cada
    // frame y no vale la pena un re-render de React por eso.
    const prediction = runtime.prediction;
    const show = runtime.phase === "collided" && prediction?.actual != null;
    [
      [label1Ref.current, text1Ref.current, runtime.pos1, m1, "v1"],
      [label2Ref.current, text2Ref.current, runtime.pos2, m2, "v2"],
    ].forEach(([group, text, x, m, key]) => {
      const g = group as THREE.Group | null;
      const t = text as HTMLDivElement | null;
      if (!g || !t) return;
      g.visible = show;
      g.position.set(x as number, RAIL_HEIGHT + 0.3 + (m as number) * 0.1 + 0.55, 0);
      if (show && prediction?.actual) {
        const k = key as "v1" | "v2";
        t.textContent = `Real ${fmt(prediction.actual[k])} · Tú ${fmt(prediction.predicted[k])} m/s`;
      }
    });
  });

  return (
    <group position={[CENTER_X, 0, 0]}>
      <group ref={label1Ref} visible={false}>
        <Html center>
          <div ref={text1Ref} className={styles.label} />
        </Html>
      </group>
      <group ref={label2Ref} visible={false}>
        <Html center>
          <div ref={text2Ref} className={styles.label} />
        </Html>
      </group>

      {/* Riel: aluminio anodizado. metalness alto + roughness bajo hace que
          refleje el cielo a lo largo de los 16 m, y ese reflejo continuo es
          lo que lee como "riel" en vez de como una barra pintada. */}
      <mesh position={[0, RAIL_HEIGHT / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[RAIL_LENGTH, RAIL_HEIGHT, 0.3]} />
        <meshStandardMaterial
          color="#8e9bb0"
          metalness={0.85}
          roughness={0.22}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Durmientes: sin ellos el riel flota sobre el pasto y ademas no hay
          nada que marque la escala de distancia al mirar a lo largo. */}
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.25, 0.06, 0.7]} />
          <meshStandardMaterial color="#2b3140" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}

      {/* Topes en las puntas: frenan al carrito que llega (ver el motor). */}
      {[-RAIL_HALF - 0.1, RAIL_HALF + 0.1].map((x) => (
        <mesh key={x} position={[x, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.7, 0.8]} />
          <meshStandardMaterial color="#e24b4a" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}

      {/* Carritos: plastico ABS. Mate y poco metalico, para que contrasten
          contra el riel espejado en vez de confundirse con el. */}
      <mesh ref={cart1Ref} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2dd4bf" metalness={0.05} roughness={0.5} />
      </mesh>

      <mesh ref={cart2Ref} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f2a65a" metalness={0.05} roughness={0.5} />
      </mesh>
    </group>
  );
}