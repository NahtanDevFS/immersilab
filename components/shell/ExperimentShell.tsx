"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { Header } from "./Header";
import { LabBackground } from "./LabBackground";
import { LabLighting } from "./LabLighting";
import { PostFX } from "./PostFX";
import { LoadingOverlay } from "./LoadingOverlay";
import { useQualityTier } from "./useQualityTier";
import { VariablesPanel } from "./VariablesPanel";
import { ResultPanel } from "./ResultPanel";
import { GyroCamera } from "./GyroCamera";
import { MovementController } from "./MovementController";
import { GamepadStatus } from "./GamepadStatus";
import { OrientationGate } from "./OrientationGate";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { useVariables } from "@/lib/modules/useVariables";
import { VirtualCursor } from "./VirtualCursor";
import { useVirtualCursor } from "./useVirtualCursor";
import type { ExperimentDefinition } from "@/types/module";
import styles from "./ExperimentShell.module.css";

interface Props {
  experiment: ExperimentDefinition;
  disciplineName: string;
  moduleName: string;
}

/**
 * Shell genérico del laboratorio: es la pieza que le da a TODOS los
 * experimentos el mismo diseño (fondo, header con logo, panel de variables,
 * panel de resultados, cámara). No conoce ninguna disciplina — recibe la
 * definición del experimento como prop.
 *
 * Para agregar un experimento nuevo (colisiones, péndulo, etc.) no hay que
 * tocar este archivo: solo crear su ExperimentDefinition y usarla acá.
 */
export function ExperimentShell({
  experiment,
  disciplineName,
  moduleName,
}: Props) {
  const { values, setValue } = useVariables(experiment.variablesSchema);
  const { orientation, permission, requestPermission } = useDeviceOrientation();
  const quality = useQualityTier();

  const gyroActive = permission === "granted";
  // hoveredKey: qué slider está bajo el cursor ahora mismo (con dedo o con
  // el stick derecho del gamepad) — se usa para resaltarlo en el panel.
  const { position: cursorPos, hoveredKey } = useVirtualCursor(gyroActive);

  // Una única instancia del motor durante toda la vida del componente.
  const engine = useMemo(() => experiment.createEngine(), [experiment]);

  useEffect(() => {
    engine.init(values);
    // Solo se corre al montar: re-inicializar en cada cambio de variable
    // borraría el estado en curso del experimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const { SceneComponent, ControlsComponent } = experiment;

  return (
    <OrientationGate>
      <div className={styles.container}>
        <Header
          subtitle={`${disciplineName} / ${moduleName} / ${experiment.name}`}
          showBackLink
        />

        <VariablesPanel
          title="Variables"
          schema={experiment.variablesSchema}
          values={values}
          onChange={setValue}
          selectedKey={hoveredKey ?? undefined}
        />

        <ResultPanel engine={engine} />

        {ControlsComponent && <ControlsComponent engine={engine} />}

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
          shadows={quality === "high" ? "soft" : true}
          dpr={[1, quality === "high" ? 2 : 1.5]}
          camera={{
            position: [8, 5, 10],
            fov: 50,
            // near alto y far ajustado al tamaño real de la escena: es lo
            // que quita el parpadeo entre caras coplanares del cañón.
            // Subir `near` de 0.1 a 0.5 multiplica por 5 la precisión de
            // profundidad útil, y no se pierde nada porque la cámara nunca
            // se acerca tanto a un objeto.
            near: 0.5,
            far: 400,
          }}
        >
          {/* El ambiente lo aporta el HDRI de LabBackground; LabLighting
              agrega la luz principal en ángulo (la única con castShadow) y
              un contraluz que despega los props del pasto. */}
          <LabLighting variant="outdoor" quality={quality} shadowRadius={18} />

          <Suspense fallback={null}>
            <LabBackground quality={quality} />
          </Suspense>
          <SceneComponent engine={engine} variables={values} />

          {/* Sombra de contacto: sin esto los objetos se ven "flotando"
              sobre el pasto aunque tengan sombra proyectada. Es la mejora
              más barata que hay para asentar algo en el suelo. */}
          <ContactShadows
            position={[5, 0.01, 0]}
            scale={26}
            blur={2.4}
            opacity={0.5}
            far={9}
            resolution={quality === "high" ? 512 : 256}
          />

          <GyroCamera orientation={orientation} enabled={gyroActive} />
          {gyroActive && <MovementController />}
          {!gyroActive && <OrbitControls target={[5, 1, 0]} />}

          <PostFX quality={quality} />
        </Canvas>
        <VirtualCursor position={cursorPos} visible={gyroActive} />

        <LoadingOverlay label={experiment.name} />
      </div>
    </OrientationGate>
  );
}