"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { VariablesPanel } from "./VariablesPanel";
import { GyroCamera } from "./GyroCamera";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { useVariables } from "@/lib/modules/useVariables";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import type { VariablesSchema } from "@/types/module";
import { VirtualCursor } from "./VirtualCursor";
import { useVirtualCursor } from "./useVirtualCursor";
import {
  createProjectileEngine,
  type ProjectilePhase,
} from "@/components/modules/physics/experiments/tiro-parabolico/engine";
import styles from "./Scene.module.css";

// Variables del experimento "Tiro parabólico" (catálogo, sección 5 del plan).
const projectileSchema: VariablesSchema = {
  angle: {
    type: "number",
    label: "Ángulo",
    unit: "°",
    min: 0,
    max: 90,
    step: 1,
    default: 45,
  },
  velocity: {
    type: "number",
    label: "Velocidad inicial",
    unit: "m/s",
    min: 1,
    max: 50,
    step: 1,
    default: 20,
  },
  gravity: {
    type: "number",
    label: "Gravedad",
    unit: "m/s²",
    min: 1,
    max: 25,
    step: 0.1,
    default: 9.81,
  },
};

const MAX_TRAIL_POINTS = 300;
const DEG = Math.PI / 180;

interface Result {
  alcance_m: number;
  altura_maxima_m: number;
  tiempo_vuelo_s: number;
}

export function Scene() {
  const { values, setValue } = useVariables(projectileSchema);
  const { orientation, permission, requestPermission } = useDeviceOrientation();

  const gyroActive = permission === "granted";
  const { position: cursorPos } = useVirtualCursor(gyroActive);

  // Una sola instancia del motor durante toda la vida del componente.
  const engine = useMemo(() => createProjectileEngine(), []);

  useEffect(() => {
    engine.init(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estado de UI (para mostrar/ocultar el botón y el resultado).
  // No es la fuente de verdad de la física — solo refleja lo que hace el motor.
  const [phase, setPhase] = useState<ProjectilePhase>("idle");
  const [result, setResult] = useState<Result | null>(null);

  const handleFire = () => {
    engine.fire();
    setPhase("flying");
    setResult(null);
  };

  const handleReset = () => {
    engine.reset();
    setPhase("idle");
    setResult(null);
  };

  return (
    <div className={styles.container}>
      <VariablesPanel
        title="Variables"
        schema={projectileSchema}
        values={values}
        onChange={setValue}
      />

      <div className={styles.actions}>
        <button
          className={styles.fireButton}
          onClick={handleFire}
          disabled={phase === "flying"}
        >
          {phase === "landed" ? "Lanzar de nuevo" : "Lanzar"}
        </button>
        {phase !== "idle" && (
          <button className={styles.resetButton} onClick={handleReset}>
            Reiniciar
          </button>
        )}
      </div>

      {result && (
        <div className={styles.result}>
          <div>
            Alcance: <strong>{result.alcance_m} m</strong>
          </div>
          <div>
            Altura máxima: <strong>{result.altura_maxima_m} m</strong>
          </div>
          <div>
            Tiempo de vuelo: <strong>{result.tiempo_vuelo_s} s</strong>
          </div>
        </div>
      )}

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
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 10, 6]} intensity={1.2} castShadow />

        <ProjectileVisuals
          engine={engine}
          variables={values}
          onLanded={(r) => {
            setPhase("landed");
            setResult(r);
          }}
        />

        <GyroCamera orientation={orientation} enabled={gyroActive} />
        {!gyroActive && <OrbitControls target={[5, 1, 0]} />}
      </Canvas>
      <VirtualCursor position={cursorPos} visible={gyroActive} />
    </div>
  );
}

// Todo lo que va DENTRO del <Canvas>: geometría, materiales, y el loop de
// física (useFixedTimestep necesita estar dentro del Canvas de R3F).
function ProjectileVisuals({
  engine,
  variables,
  onLanded,
}: {
  engine: ReturnType<typeof createProjectileEngine>;
  variables: Record<string, number | boolean | string>;
  onLanded: (result: Result) => void;
}) {
  const ballRef = useRef<THREE.Mesh>(null);
  const cannonRef = useRef<THREE.Group>(null);
  const trailGeometryRef = useRef<THREE.BufferGeometry>(null);
  const wasFlyingRef = useRef(false);

  const trailPositions = useMemo(
    () => new Float32Array(MAX_TRAIL_POINTS * 3),
    [],
  );

  // Avanza la física un paso fijo (1/60s) por tick, desacoplado del framerate.
  useFixedTimestep((dt) => {
    engine.update(dt, variables);
  });

  // Lee el estado del motor cada frame y actualiza lo visual.
  useFrame(() => {
    const runtime = engine.getRuntime();

    if (ballRef.current) {
      ballRef.current.position.set(
        runtime.position.x,
        runtime.position.y + 0.15,
        0,
      );
    }

    if (cannonRef.current) {
      const angle = Number(variables.angle ?? 45) * DEG;
      cannonRef.current.rotation.z = angle;
    }

    if (trailGeometryRef.current) {
      const points = runtime.trail.slice(-MAX_TRAIL_POINTS);
      points.forEach((p, i) => {
        trailPositions[i * 3] = p.x;
        trailPositions[i * 3 + 1] = p.y + 0.15;
        trailPositions[i * 3 + 2] = 0;
      });
      trailGeometryRef.current.setDrawRange(0, points.length);
      const attr = trailGeometryRef.current.attributes
        .position as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }

    // Detecta la transición flying -> landed para avisarle a la UI de React.
    if (wasFlyingRef.current && runtime.phase === "landed") {
      onLanded({
        alcance_m: Number(runtime.range.toFixed(2)),
        altura_maxima_m: Number(runtime.maxHeight.toFixed(2)),
        tiempo_vuelo_s: Number(runtime.flightTime.toFixed(2)),
      });
    }
    wasFlyingRef.current = runtime.phase === "flying";
  });

  return (
    <group>
      {/* Suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 30]} />
        <meshStandardMaterial color="#e5e5e5" />
      </mesh>

      {/* Cañón: pivotea en el origen, la barra se dibuja desplazada en X
          para que la punta gire alrededor de la base al cambiar el ángulo. */}
      <group ref={cannonRef} position={[0, 0.2, 0]}>
        <mesh position={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[1, 0.15, 0.15]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      </group>

      {/* Proyectil */}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#c92a2a" />
      </mesh>

      {/* Trayectoria */}
      <line>
        <bufferGeometry ref={trailGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
            count={MAX_TRAIL_POINTS}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#c92a2a" />
      </line>
    </group>
  );
}