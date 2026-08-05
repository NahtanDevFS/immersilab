"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { VariablesPanel } from "./VariablesPanel";
import { GyroCamera } from "./GyroCamera";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { useVariables } from "@/lib/modules/useVariables";
import type { VariablesSchema } from "@/types/module";
import { VirtualCursor } from "./VirtualCursor";
import { useVirtualCursor } from "./useVirtualCursor";
import styles from "./Scene.module.css";

const demoSchema: VariablesSchema = {
  size: {
    type: "number",
    label: "Tamaño del cubo",
    min: 0.2,
    max: 3,
    step: 0.1,
    default: 1,
  },
  height: {
    type: "number",
    label: "Altura",
    unit: "m",
    min: 0.5,
    max: 5,
    step: 0.1,
    default: 0.5,
  },
  wireframe: { type: "boolean", label: "Modo wireframe", default: false },
};

export function Scene() {
  const { values, setValue } = useVariables(demoSchema);
  const { orientation, permission, requestPermission } = useDeviceOrientation();

  const size = Number(values.size);
  const height = Number(values.height);
  const wireframe = Boolean(values.wireframe);
  const gyroActive = permission === "granted";
  const { position: cursorPos } = useVirtualCursor(gyroActive);

  return (
    <div className={styles.container}>
      <VariablesPanel
        title="Variables"
        schema={demoSchema}
        values={values}
        onChange={setValue}
      />

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

      <Canvas camera={{ position: [4, 3, 6], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#e5e5e5" />
        </mesh>

        <mesh position={[0, height, 0]} castShadow>
          <boxGeometry args={[size, size, size]} />
          <meshStandardMaterial color="#2E74B5" wireframe={wireframe} />
        </mesh>

        <GyroCamera orientation={orientation} enabled={gyroActive} />
        {!gyroActive && <OrbitControls />}
      </Canvas>
      <VirtualCursor position={cursorPos} visible={gyroActive} />
    </div>
  );
}
