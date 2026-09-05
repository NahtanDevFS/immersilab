"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { getStack, type OsiEngine } from "./engine";
import styles from "./OsiScene.module.css";

/*
 * Dos torres, una por host: el emisor a la izquierda y el receptor a la
 * derecha, unidas por el cable de abajo. El paquete BAJA por una, cruza y
 * SUBE por la otra.
 *
 * Esa forma no es decorativa: la encapsulación se dibuja en todos los libros
 * como una pila, y el error de entenderla como "una lista de nombres" viene
 * justamente de no ver nunca el mensaje moverse por ella. Acá el movimiento
 * es el contenido.
 */
const TOWER_X = 5.5;
const LAYER_HEIGHT = 0.75;
const BASE_Y = 0.6;
const PLATE_SIZE: [number, number, number] = [2.6, 0.12, 2.2];

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function OsiScene({ engine, variables }: Props) {
  const osi = engine as OsiEngine;

  const packetRef = useRef<THREE.Group>(null);
  const shellRefs = useRef<Array<THREE.Mesh | null>>([]);
  const plateRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFixedTimestep((dt) => {
    osi.update(dt, variables);
  });

  useFrame(() => {
    const runtime = osi.getRuntime();
    const stack = runtime.stack;
    const topY = BASE_Y + stack.length * LAYER_HEIGHT;

    // Dónde está el paquete ahora mismo.
    if (packetRef.current) {
      if (runtime.phase === "bajando") {
        packetRef.current.position.set(
          -TOWER_X,
          topY - runtime.depth * LAYER_HEIGHT,
          0,
        );
      } else if (runtime.phase === "viajando") {
        // Cruza el cable de abajo, de una torre a la otra.
        packetRef.current.position.set(
          THREE.MathUtils.lerp(-TOWER_X, TOWER_X, runtime.travel),
          BASE_Y - 0.15,
          0,
        );
      } else {
        packetRef.current.position.set(
          TOWER_X,
          BASE_Y + runtime.depth * LAYER_HEIGHT,
          0,
        );
      }
    }

    // Los cascarones: uno por capa aplicada. El mensaje se ve literalmente
    // envuelto, y al desencapsular se van sacando de afuera hacia adentro —
    // que es el orden real y el que casi nadie recuerda.
    const applied =
      runtime.phase === "bajando"
        ? runtime.depth
        : runtime.phase === "viajando"
          ? stack.length
          : stack.length - runtime.depth;

    shellRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.visible = i < applied;
      const scale = 0.32 + i * 0.13;
      mesh.scale.setScalar(scale);
    });

    // La capa en la que está trabajando el jugador se enciende, en la torre
    // que corresponda.
    plateRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const layerIndex = i % stack.length;
      const isSender = i < stack.length;

      const activeIndex =
        runtime.phase === "bajando"
          ? runtime.depth
          : runtime.phase === "subiendo"
            ? stack.length - 1 - runtime.depth
            : -1;

      const active =
        layerIndex === activeIndex &&
        ((runtime.phase === "bajando" && isSender) ||
          (runtime.phase === "subiendo" && !isSender));

      material.emissiveIntensity = active ? 1.2 : 0.12;
    });
  });

  const stack = getStack(variables.modelo ?? "osi");
  const model = String(variables.modelo ?? "osi");

  return (
    <group>
      {/* Las dos torres. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * TOWER_X, 0, 0]}>
          {stack.map((step, i) => {
            const index = side < 0 ? i : stack.length + i;
            return (
              <group key={step.osi} position={[0, BASE_Y + i * LAYER_HEIGHT, 0]}>
                <mesh
                  ref={(mesh) => {
                    plateRefs.current[index] = mesh;
                  }}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={PLATE_SIZE} />
                  <meshStandardMaterial
                    color={step.color}
                    emissive={step.color}
                    emissiveIntensity={0.12}
                    metalness={0.3}
                    roughness={0.5}
                  />
                </mesh>

                {/* La etiqueta va del lado de afuera de cada torre para no
                    taparse con el paquete, que viaja por el centro. */}
                <Html position={[side * 1.7, 0.12, 0]} center>
                  <div className={styles.layer}>
                    <span className={styles.osi}>
                      {model === "osi" ? step.osi : step.tcpip}
                    </span>
                    <span className={styles.header}>+{step.header}</span>
                    <span className={styles.pdu}>{step.pdu}</span>
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Etiqueta de host. */}
          <Html position={[0, BASE_Y + stack.length * LAYER_HEIGHT + 0.6, 0]} center>
            <div className={styles.host}>
              {side < 0 ? "Emisor" : "Receptor"}
            </div>
          </Html>
        </group>
      ))}

      {/* El cable entre los dos hosts. */}
      <mesh position={[0, BASE_Y - 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, TOWER_X * 2, 10]} />
        <meshStandardMaterial color="#39404d" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* El mensaje, envuelto en tantos cascarones como capas lleve. */}
      <group ref={packetRef}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#fff4e2"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>

        {stack.map((step, i) => (
          <mesh
            key={step.osi}
            ref={(mesh) => {
              shellRefs.current[i] = mesh;
            }}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={step.color}
              emissive={step.color}
              emissiveIntensity={0.35}
              transparent
              opacity={0.28}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
