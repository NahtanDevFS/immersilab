"use client";

import { Suspense, useCallback, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { tourHref } from "@/lib/tour";
import { Canvas } from "@react-three/fiber";
import { Header } from "./Header";
import { GyroCamera } from "./GyroCamera";
import { MovementController } from "./MovementController";
import { DragLookControls } from "./DragLookControls";
import { GamepadStatus } from "./GamepadStatus";
import { OrientationGate } from "./OrientationGate";
import { LabLighting } from "./LabLighting";
import { PostFX } from "./PostFX";
import { StereoView } from "./StereoView";
import { VrButton, VrExit } from "./VrControls";
import { useViewMode } from "@/lib/view/viewMode";
import { LoadingOverlay } from "./LoadingOverlay";
import { LobbyTutorial } from "./LobbyTutorial";
import { TutorialProbe } from "./TutorialProbe";
import {
  getTutorialSeen,
  getTutorialSeenOnServer,
  markTutorialSeen,
  resetTutorial,
  subscribeTutorial,
} from "./tutorialStore";
import tutorialStyles from "./LobbyTutorial.module.css";
import { useQualityTier } from "./useQualityTier";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { LobbyScene } from "@/components/lobby/LobbyScene";
import styles from "./ExperimentShell.module.css";

/**
 * Shell del lobby: la "sala de espera" con una puerta por experimento.
 * Reusa las mismas piezas que ExperimentShell (giroscopio, caminar con
 * gamepad, aviso de horizontal) — solo cambia qué hay adentro del Canvas
 * (LobbyScene en vez de un experimento) y no hay panel de variables ni de
 * resultados ni cursor, porque en el lobby no hay nada que tocar: entras
 * caminando a través de la puerta.
 */
export function LobbyShell() {
  const { orientation, permission, requestPermission, insecure } =
    useDeviceOrientation();
  const gyroActive = permission === "granted";
  const view = useViewMode();
  const vr = view === "vr";
  const quality = useQualityTier();

  // Tutorial de entrada: la primera vez en este dispositivo, o al pedirlo.
  const tutorialSeen = useSyncExternalStore(
    subscribeTutorial,
    getTutorialSeen,
    getTutorialSeenOnServer,
  );
  const [looked, setLooked] = useState(false);
  const [walked, setWalked] = useState(false);
  const onLook = useCallback(() => setLooked(true), []);
  const onWalk = useCallback(() => setWalked(true), []);
  const router = useRouter();
  const reopenTutorial = () => {
    setLooked(false);
    setWalked(false);
    resetTutorial();
  };

  return (
    <OrientationGate>
      <div className={styles.container} data-view={view}>
        <Header
          subtitle="Elige un experimento — camina hacia una puerta"
          showAccount
          actions={
            <VrButton onBeforeEnter={permission === "prompt" ? requestPermission : undefined} />
          }
        />

        {gyroActive && <GamepadStatus />}

        {/* El botón aparece SIEMPRE que el sensor todavía no entregó datos.
            En Android el enganche automático lo pone en "granted" en
            milisegundos, así que casi nunca se llega a ver; en iOS, donde
            hace falta el gesto, es imprescindible. Ocultarlo por "ya aceptó
            antes" dejaba el juego sin giroscopio y sin forma de activarlo. */}
        {permission === "prompt" && (
          <button className={styles.gyroButton} onClick={requestPermission}>
            Activar giroscopio
          </button>
        )}

        {permission === "denied" && (
          <p className={styles.gyroNote}>Permiso de giroscopio denegado.</p>
        )}

        {!tutorialSeen && (
          <LobbyTutorial
            gyroActive={gyroActive}
            looked={looked}
            walked={walked}
            onClose={markTutorialSeen}
          />
        )}
        {tutorialSeen && (
          <div className={tutorialStyles.lobbyActions}>
            <button type="button" className={tutorialStyles.reopen} onClick={reopenTutorial}>
              ¿Cómo me muevo?
            </button>
            {/* Demo corta para mostrar el laboratorio en clase (lib/tour.ts). */}
            <button
              type="button"
              className={tutorialStyles.tour}
              onClick={() => router.push(tourHref(0))}
            >
              Recorrido guiado
            </button>
          </div>
        )}

        {/* Mientras está el tutorial, este aviso repetiría lo mismo. */}
        {permission === "unsupported" && tutorialSeen && (
          <p className={styles.gyroNote}>
            {insecure
              ? // Este caso confunde muchísimo si no se dice: el teléfono
                // TIENE giroscopio, pero el navegador no lo entrega fuera de
                // HTTPS o localhost, y no avisa de ninguna forma.
                "El navegador bloquea el giroscopio fuera de HTTPS — abre el laboratorio por https:// o desde localhost."
              : "Sin giroscopio: WASD o flechas para caminar, arrastra para mirar."}
          </p>
        )}

        <Canvas
          data-vr-keep
          data-vr-scene
          /* Contexto de apilamiento propio (z-index 0): las etiquetas <Html>
             de drei se montan junto al canvas con z-index calculados que
             pueden ser enormes, y se dibujaban ENCIMA de los paneles del
             shell (variables, resultados, retos, avisos). Así quedan todas
             debajo, sin tocar cada etiqueta. */
          style={{ zIndex: 0 }}
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
          {/* Caminar funciona siempre (gamepad o teclado). Mirar: con visor
              lo hace el giroscopio; sin él, arrastrando el mouse o el dedo. */}
          <MovementController />
          {!tutorialSeen && <TutorialProbe onLook={onLook} onWalk={onWalk} />}
          {!gyroActive && <DragLookControls target={[0, 1.4, -10]} />}

          {vr ? <StereoView /> : <PostFX quality={quality} />}
        </Canvas>

        {vr && <VrExit />}

        <LoadingOverlay label="ImmersiLab" />
      </div>
    </OrientationGate>
  );
}
