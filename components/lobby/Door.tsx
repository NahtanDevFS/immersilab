"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import styles from "./Door.module.css";

/** Distancia (plano XZ) a la que se considera que el jugador "entró". */
const TRIGGER_RADIUS = 2.2;
/** Distancia desde la que el portal empieza a iluminarse al acercarse. */
const GLOW_START_DISTANCE = 7;

const DOOR_WIDTH = 1.8;
const DOOR_HEIGHT = 2.6;

interface Props {
  href: string;
  name: string;
  position: [number, number, number];
}

/**
 * Puerta del lobby. No hace falta tocarla ni clickearla: cada frame se
 * mide la distancia (en el plano del piso) entre la cámara y la puerta, y
 * al cruzar TRIGGER_RADIUS navega al experimento — caminar hacia la puerta
 * es la única acción necesaria. El portal se ilumina progresivamente a
 * medida que el jugador se acerca, como feedback visual.
 */
export function Door({ href, name, position }: Props) {
  const router = useRouter();
  const { camera } = useThree();
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
      materialRef.current.emissiveIntensity = 0.25 + proximity * 1.1;
    }

    if (distance < TRIGGER_RADIUS) {
      triggered.current = true;
      router.push(href);
    }
  });

  const [x, y, z] = position;

  return (
    <group position={[x, y, z]}>
      {/* Marco */}
      <mesh position={[-DOOR_WIDTH / 2 - 0.1, DOOR_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.2, DOOR_HEIGHT + 0.2, 0.2]} />
        <meshStandardMaterial color="#26344e" />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 + 0.1, DOOR_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.2, DOOR_HEIGHT + 0.2, 0.2]} />
        <meshStandardMaterial color="#26344e" />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT + 0.1, 0]}>
        <boxGeometry args={[DOOR_WIDTH + 0.4, 0.2, 0.2]} />
        <meshStandardMaterial color="#26344e" />
      </mesh>

      {/* Superficie del portal — se ilumina al acercarse */}
      <mesh position={[0, DOOR_HEIGHT / 2, 0.05]}>
        <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#0f2f2b"
          emissive="#2dd4bf"
          emissiveIntensity={0.25}
        />
      </mesh>

      <Html position={[0, DOOR_HEIGHT + 0.5, 0]} center>
        <div className={styles.label}>{name}</div>
      </Html>
    </group>
  );
}