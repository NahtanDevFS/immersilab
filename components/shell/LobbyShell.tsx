"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Header } from "./Header";
import { GyroCamera } from "./GyroCamera";
import { MovementController } from "./MovementController";
import { GamepadStatus } from "./GamepadStatus";
import { OrientationGate } from "./OrientationGate";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { LobbyScene } from "@/components/lobby/LobbyScene";
import styles from "./ExperimentShell.module.css";
import { Suspense } from "react";



/**
 * Shell del lobby: la "sala de espera" con una puerta por experimento.
 * Reusa las mismas piezas que ExperimentShell (giroscopio, caminar con
 * gamepad, aviso de horizontal) — solo cambia qué hay adentro del Canvas
 * (LobbyScene en vez de un experimento) y no hay panel de variables ni de
 * resultados ni cursor, porque en el lobby no hay nada que tocar: entrás
 * caminando a través de la puerta.
 */
export function LobbyShell() {
  const { orientation, permission, requestPermission } = useDeviceOrientation();
  const gyroActive = permission === "granted";

  return (
    <OrientationGate>
      <div className={styles.container}>
        <Header subtitle="Elegí un experimento — caminá hacia una puerta" />

        {gyroActive && <GamepadStatus />}

        {permission === "prompt" && (
          <button className={styles.gyroButton} onClick={requestPermission}>
            Activar giroscopio
          </button>
        )}

        {permission === "denied" && (
          <p className={styles.gyroNote}>Permiso de giroscopio denegado.</p>
        )}

        {permission === "unsupported" && (
          <p className={styles.gyroNote}>
            Sin giroscopio disponible — usa el mouse para mover la cámara.
          </p>
        )}

        <Canvas shadows camera={{ position: [0, 1.6, 6], fov: 55 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[0, 4.5, 0]} intensity={0.6} />

                    <Suspense fallback={null}>
            <LobbyScene />
          </Suspense> 

          <GyroCamera orientation={orientation} enabled={gyroActive} />
          {gyroActive && <MovementController />}
          {!gyroActive && <OrbitControls target={[0, 1.4, -10]} />}
        </Canvas>
      </div>
    </OrientationGate>
  );
}