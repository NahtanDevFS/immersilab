"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Header } from "./Header";
import { GyroCamera } from "./GyroCamera";
import { MovementController } from "./MovementController";
import { GamepadStatus } from "./GamepadStatus";
import { OrientationGate } from "./OrientationGate";
import { LabLighting } from "./LabLighting";
import { PostFX } from "./PostFX";
import { LoadingOverlay } from "./LoadingOverlay";
import { useQualityTier } from "./useQualityTier";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { LobbyScene } from "@/components/lobby/LobbyScene";
import styles from "./ExperimentShell.module.css";

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
  const quality = useQualityTier();

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

        <Canvas
          /* "soft" = PCFSoftShadowMap: bordes de sombra suaves. En gama baja
             se cae a PCF normal, que es más barato y más duro. */
          shadows={quality === "high" ? "soft" : true}
          /* Sin este tope, una pantalla de celular con DPR 3 renderiza 9x
             los píxeles de uno con DPR 1 — es la causa número uno de que
             una escena 3D se arrastre en móvil. */
          dpr={[1, quality === "high" ? 2 : 1.5]}
          camera={{
            position: [0, 1.6, 6],
            fov: 55,
            // La sala mide 20 m: no hace falta un far de 1000, y acortarlo
            // gana precisión de profundidad (ver ExperimentShell).
            near: 0.15,
            far: 80,
          }}
        >
          <LabLighting variant="indoor" quality={quality} shadowRadius={13} />

          <Suspense fallback={null}>
            <LobbyScene />
          </Suspense>

          <GyroCamera orientation={orientation} enabled={gyroActive} />
          {gyroActive && <MovementController />}
          {!gyroActive && <OrbitControls target={[0, 1.4, -10]} />}

          <PostFX quality={quality} />
        </Canvas>

        <LoadingOverlay label="ImmersiLab" />
      </div>
    </OrientationGate>
  );
}
