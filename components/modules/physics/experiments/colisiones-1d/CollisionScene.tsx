"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import type { CollisionEngine } from "./engine";

const RAIL_LENGTH = 16;
const RAIL_HEIGHT = 0.1;
const CART_DEPTH = 0.4;

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function CollisionScene({ engine, variables }: Props) {
  const collision = engine as CollisionEngine;
  const cart1Ref = useRef<THREE.Mesh>(null);
  const cart2Ref = useRef<THREE.Mesh>(null);

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
  });

  return (
    <group>
      <mesh position={[0, RAIL_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[RAIL_LENGTH, RAIL_HEIGHT, 0.3]} />
        <meshStandardMaterial color="#26344e" />
      </mesh>

      <mesh ref={cart1Ref} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2dd4bf" />
      </mesh>

      <mesh ref={cart2Ref} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f2a65a" />
      </mesh>
    </group>
  );
}