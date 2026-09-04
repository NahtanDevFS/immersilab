"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import styles from "./Door.module.css";

const TRIGGER_RADIUS = 2.2;
const GLOW_START_DISTANCE = 7;

const DOOR_WIDTH = 1.8;
const DOOR_HEIGHT = 2.6;

const MODEL_SCALE = 2.7;
const MODEL_ROTATION_Y = 0;
const MODEL_OFFSET_X = 0.65;

useGLTF.preload("/models/doorway-front.glb");

interface Props {
  href: string;
  name: string;
  position: [number, number, number];
  rotationY?: number;
}

export function Door({ href, name, position, rotationY = 0 }: Props) {
  const router = useRouter();
  const { camera } = useThree();
  const { scene } = useGLTF("/models/doorway-front.glb");
  const model = useMemo(() => scene.clone(), [scene]);

  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const triggered = useRef(false);
  const doorPos = useRef(new THREE.Vector3(...position));

  useFrame(() => {
    if (triggered.current) return;

    const dx = camera.position.x - doorPos.current.x;
    const dz = camera.position.z - doorPos.current.z;
    const distance = Math.hypot(dx, dz);

    if (materialRef.current) {
      const proximity = 1 - Math.min(1, distance / GLOW_START_DISTANCE);
      // Rango 0.5 → 3.0 en vez de 0.15 → 1.05. Con toneMapped={false} en el
      // material, todo lo que supera 1 cruza el umbral del bloom: acercarse
      // a la puerta no le cambia el color, la hace irradiar de verdad.
      materialRef.current.emissiveIntensity = 0.5 + proximity * 2.5;
    }

    if (distance < TRIGGER_RADIUS) {
      triggered.current = true;
      router.push(href);
    }
  });

  const [x, y, z] = position;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <primitive
        object={model}
        position={[MODEL_OFFSET_X, 0, 0]}
        scale={MODEL_SCALE}
        rotation={[0, MODEL_ROTATION_Y, 0]}
      />

      <mesh position={[0, DOOR_HEIGHT / 2, 0.03]}>
        <planeGeometry args={[DOOR_WIDTH * 0.85, DOOR_HEIGHT * 0.85]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#0f2f2b"
          emissive="#2dd4bf"
          emissiveIntensity={0.5}
          toneMapped={false}
          transparent
          opacity={0.6}
        />
      </mesh>

      <Html position={[0, DOOR_HEIGHT + 0.5, 0]} center>
        <div className={styles.label}>{name}</div>
      </Html>
    </group>
  );
}