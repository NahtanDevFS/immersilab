"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import styles from "./Door.module.css";

/** Distancia (plano XZ) a la que se considera que el jugador "entró". */
const TRIGGER_RADIUS = 2.2;
/** Distancia desde la que el portal empieza a iluminarse al acercarse. */
const GLOW_START_DISTANCE = 7;

const DOOR_WIDTH = 1.8;
const DOOR_HEIGHT = 2.6;

// Ajustables a ojo una vez que se vea el modelo real en pantalla — el
// tamaño y la orientación exactos del .glb de Kenney no se pueden saber
// sin abrirlo primero, así que estos valores son un punto de partida.
const MODEL_SCALE = 2.7;
const MODEL_ROTATION_Y = 0;
const MODEL_OFFSET_X = 0.65; // corrige que el pivot del modelo no esté centrado

useGLTF.preload("/models/doorway-front.glb");

interface Props {
  href: string;
  name: string;
  position: [number, number, number];
}

/**
 * Puerta del lobby. No hace falta tocarla ni clickearla: cada frame se
 * mide la distancia (en el plano del piso) entre la cámara y la puerta, y
 * al cruzar TRIGGER_RADIUS navega al experimento — caminar hacia la puerta
 * es la única acción necesaria.
 *
 * El modelo 3D es "Doorway Front" de Kenney (CC0, poly.pizza). Encima se
 * superpone un plano semitransparente que se ilumina progresivamente al
 * acercarse — es la única señal de "esto es interactivo", ya que no hay
 * botón ni cursor involucrados.
 */
export function Door({ href, name, position }: Props) {
  const router = useRouter();
  const { camera } = useThree();
  const { scene } = useGLTF("/models/doorway-front.glb");
  // Clonado por instancia: si el mismo modelo se usa en más de una puerta,
  // reusar el objeto original haría que solo se vea en un lugar a la vez.
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
      materialRef.current.emissiveIntensity = 0.15 + proximity * 0.9;
    }

    if (distance < TRIGGER_RADIUS) {
      triggered.current = true;
      router.push(href);
    }
  });

  const [x, y, z] = position;

  return (
    <group position={[x, y, z]}>
      <primitive
        object={model}
        position={[MODEL_OFFSET_X, 0, 0]}
        scale={MODEL_SCALE}
        rotation={[0, MODEL_ROTATION_Y, 0]}
      />

      {/* Brillo del portal — semitransparente para que el modelo de la
          puerta se siga viendo debajo. */}
      <mesh position={[0, DOOR_HEIGHT / 2, 0.03]}>
        <planeGeometry args={[DOOR_WIDTH * 0.85, DOOR_HEIGHT * 0.85]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#0f2f2b"
          emissive="#2dd4bf"
          emissiveIntensity={0.15}
          transparent
          opacity={0.55}
        />
      </mesh>

      <Html position={[0, DOOR_HEIGHT + 0.5, 0]} center>
        <div className={styles.label}>{name}</div>
      </Html>
    </group>
  );
}