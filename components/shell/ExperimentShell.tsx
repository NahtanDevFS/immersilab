"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Header } from "./Header";
import { LabBackground } from "./LabBackground";
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

                <Canvas shadows camera={{ position: [8, 5, 10], fov: 50 }}>
          {/* La luz ambiente principal ahora la aporta el HDRI de
              LabBackground — esta directional solo queda para que el
              cañón/proyectil tiren sombra sobre el pasto. */}
          <directionalLight position={[10, 15, 8]} intensity={0.6} castShadow />

           <Suspense fallback={null}>
            <LabBackground />
          </Suspense>
          <SceneComponent engine={engine} variables={values} />

          <GyroCamera orientation={orientation} enabled={gyroActive} />
          {gyroActive && <MovementController />}
          {!gyroActive && <OrbitControls target={[5, 1, 0]} />}
        </Canvas>
        <VirtualCursor position={cursorPos} visible={gyroActive} />
      </div>
    </OrientationGate>
  );
}