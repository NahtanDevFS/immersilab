"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import styles from "./Scene.module.css";

/**
 * Escena base del shell: cámara, luces y suelo.
 * Punto de partida — aquí se irá conectando el control por
 * giroscopio/joystick y los módulos de cada disciplina.
 */
export function Scene() {
  return (
    <div className={styles.container}>
      <Canvas camera={{ position: [4, 3, 6], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />

        {/* Suelo provisional — se reemplaza por assets del ambiente más adelante */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#e5e5e5" />
        </mesh>

        {/* Cubo de referencia — confirma que el pipeline de render funciona */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#2E74B5" />
        </mesh>

        {/* Control de cámara temporal con mouse; se reemplaza/complementa
            con giroscopio en móvil más adelante. */}
        <OrbitControls />
      </Canvas>
    </div>
  );
}
