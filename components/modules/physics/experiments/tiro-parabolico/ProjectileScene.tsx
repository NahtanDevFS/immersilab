"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { useCollider } from "@/lib/collision/useCollider";
import { Html } from "@react-three/drei";
import {
  BULLSEYE_RADIUS,
  TARGETS_X,
  type ProjectileEngine,
  type ProjectileMode,
  type RoundState,
} from "./engine";
import styles from "./ProjectileScene.module.css";
import {
  CannonBarrel,
  CannonCarriage,
  MODEL_MIN_Y,
  MUZZLE_DISTANCE,
  REST_TILT,
  SCALE,
  TRUNNION_Y,
  TRUNNION_Z,
} from "./Cannon";

const DEG = Math.PI / 180;
const MAX_TRAIL_POINTS = 300;

// Componentes por encima de 1: es la unica forma de que un lineBasicMaterial
// (que no tiene emissiveIntensity) supere el umbral de luminancia del bloom.
const TRAIL_COLOR = new THREE.Color(2.4, 1.5, 0.7);

// Posicion del canon. Con el punto de lanzamiento ya atado a la boca, esto
// solo decide donde queda la pieza en el campo: elegido para que la boca a
// 45 grados caiga cerca del origen.
const CANNON_X = -1.2;

// Posicion del munon (el pivote del tubo) en el mundo, derivada de la
// jerarquia de grupos de abajo. Se calcula una vez porque no depende del
// angulo: lo unico que gira alrededor de este punto es el tubo.
const PIVOT_X = CANNON_X + TRUNNION_Z * SCALE;
const PIVOT_Y = (TRUNNION_Y - MODEL_MIN_Y) * SCALE;

/** Largo del munon a la boca, ya en metros. */
const BARREL_REACH = MUZZLE_DISTANCE * SCALE;

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function ProjectileScene({ engine, variables }: Props) {
  const projectile = engine as ProjectileEngine;

  const ballRef = useRef<THREE.Mesh>(null);
  const cannonRef = useRef<THREE.Group>(null);
  const trailGeometryRef = useRef<THREE.BufferGeometry>(null);

  // El cañón como obstáculo: sin esto se le puede caminar a través, que es
  // lo que más delata que la escena es un decorado. Las medidas son las de
  // la cureña (~2.5 m de largo por 1.4 de ancho, ya escalada), no las del
  // tubo, que queda por encima de la cabeza.
  useCollider({
    center: [CANNON_X + 0.4, 0.9, 0],
    size: [2.6, 1.8, 1.4],
  });

  const trailPositions = useMemo(
    () => new Float32Array(MAX_TRAIL_POINTS * 3),
    [],
  );

  // Avanza la física un paso fijo (1/60s) por tick, desacoplado del framerate.
  useFixedTimestep((dt) => {
    projectile.update(dt, variables);
  });

  // Lee el estado del motor cada frame y actualiza lo visual.
  useFrame(() => {
    const runtime = projectile.getRuntime();

    if (ballRef.current) {
      // El motor ya trabaja en coordenadas del mundo desde que la escena le
      // fija la boca como punto de lanzamiento: no hace falta desplazarlo.
      ballRef.current.position.set(runtime.position.x, runtime.position.y, 0);
      // En reposo la bala está CARGADA, o sea dentro del ánima: el punto de
      // lanzamiento es la boca, así que dejarla visible ahí la mostraba
      // asomada en la punta como si estuviera a medio salir. Se oculta hasta
      // que el disparo empieza (y se deja visible al aterrizar, que es el
      // resultado que el alumno tiene que poder mirar).
      ballRef.current.visible = runtime.phase !== "idle";
    }

    const angle = Number(variables.angle ?? 45) * DEG;

    if (cannonRef.current) {
      // REST_TILT - angulo, no angulo a secas: el tubo ya viene 19 grados
      // levantado dentro del archivo, y la rotacion en X del modelo baja la
      // boca. Con angulo=0 queda horizontal; con 45, a 45 de verdad.
      cannonRef.current.rotation.x = REST_TILT - angle;
    }

    // La boca se mueve al elevar el tubo, y es de ahi de donde tiene que
    // salir el proyectil — no del origen del mundo.
    projectile.setLaunch(
      PIVOT_X + Math.cos(angle) * BARREL_REACH,
      PIVOT_Y + Math.sin(angle) * BARREL_REACH,
    );

    if (trailGeometryRef.current) {
      const points = runtime.trail.slice(-MAX_TRAIL_POINTS);
      points.forEach((p, i) => {
        trailPositions[i * 3] = p.x;
        trailPositions[i * 3 + 1] = p.y;
        trailPositions[i * 3 + 2] = 0;
      });
      trailGeometryRef.current.setDrawRange(0, points.length);
      const attr = trailGeometryRef.current.attributes
        .position as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Cañón naval. El grupo de afuera lleva el modelo de sus unidades
          originales al mundo: lo escala, lo apoya en el piso (el modelo
          tiene el cero a media altura) y lo gira para que apunte a +X, que
          es hacia donde vuela el proyectil. +90 en Y lleva el +Z del modelo
          —donde esta la boca— al +X del mundo. */}
      <group
        position={[CANNON_X, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={SCALE}
      >
        <group position={[0, -MODEL_MIN_Y, 0]}>
          {/* Cada modelo en su propio Suspense: dos cargas bajo el mismo
              límite se cuelgan entre sí y no aparece ninguna. Ver la
              "TRAMPA IMPORTANTE" en components/lobby/LobbyScene.tsx. */}
          <Suspense fallback={null}>
            <CannonCarriage />
          </Suspense>

          {/* El pivote va en los muñones, no en el origen del archivo: es
              el eje sobre el que gira un cañón de verdad. El ref está aquí
              afuera del Suspense a propósito, para que la elevación no
              dependa de que el modelo haya terminado de cargar. */}
          <group ref={cannonRef} position={[0, TRUNNION_Y, TRUNNION_Z]}>
            <Suspense fallback={null}>
              <CannonBarrel />
            </Suspense>
          </group>
        </group>
      </group>

      {/* Proyectil: goma mate. Roughness alto a propósito — si reflejara
          como el cañón se confundiría con él en movimiento. */}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshStandardMaterial color="#e24b4a" roughness={0.85} metalness={0.05} />
      </mesh>

      <Targets engine={projectile} />

      {/* Trayectoria */}
      <line>
        <bufferGeometry ref={trailGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
            count={MAX_TRAIL_POINTS}
          />
        </bufferGeometry>
        {/* toneMapped={false} + color por encima del blanco: la trayectoria
            cruza el umbral del bloom y se lee como una estela luminosa
            contra el pasto, no como una raya naranja. */}
        <lineBasicMaterial color={TRAIL_COLOR} toneMapped={false} />
      </line>
    </group>
  );
}

/** Anillos del blanco, del centro hacia afuera: centro, medio y borde. */
const RINGS: Array<[number, string]> = [
  [BULLSEYE_RADIUS * 3, "#e7ecf5"],
  [BULLSEYE_RADIUS * 2, "#e24b4a"],
  [BULLSEYE_RADIUS, "#f2a65a"],
];

interface RoundView {
  mode: ProjectileMode;
  round: RoundState;
}

/**
 * Blancos de F1 · Artillería, marcas de caída y viento.
 *
 * Se refresca con un intervalo y no en cada frame: los blancos y las marcas
 * solo cambian cuando aterriza un disparo o empieza una ronda, y React no se
 * entera de lo que el motor muta por dentro.
 */
function Targets({ engine }: { engine: ProjectileEngine }) {
  const [view, setView] = useState<RoundView>(() => {
    const r = engine.getRuntime();
    return { mode: r.mode, round: { ...r.round, shots: [...r.round.shots] } };
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = engine.getRuntime();
      setView({ mode: r.mode, round: { ...r.round, shots: [...r.round.shots] } });
    }, 150);
    return () => window.clearInterval(id);
  }, [engine]);

  if (view.mode === "libre") return null;
  const { round } = view;

  return (
    <group>
      {TARGETS_X.map((x, i) => {
        const active = !round.finished && i === round.targetIndex;
        const shot = round.shots[i];
        return (
          <group key={x} position={[x, 0, 0]}>
            {RINGS.map(([radius, color], k) => (
              <mesh key={k} position={[0, 0.02 + k * 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[radius, 40]} />
                <meshStandardMaterial
                  color={color}
                  emissive={active ? color : "#000000"}
                  emissiveIntensity={active ? 0.35 : 0}
                  roughness={0.8}
                />
              </mesh>
            ))}
            {/* Poste con la etiqueta: el blanco acostado en el piso casi no
                se ve desde el cañón, la etiqueta dice cuál es y a qué distancia. */}
            <mesh position={[0, 1, -BULLSEYE_RADIUS * 3 - 0.2]}>
              <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
              <meshStandardMaterial color="#8e9bb0" metalness={0.8} roughness={0.3} />
            </mesh>
            <Html position={[0, 2.4, -BULLSEYE_RADIUS * 3 - 0.2]} center>
              <div className={styles.target} data-active={active} data-done={Boolean(shot)}>
                Blanco {i + 1} · {x} m
                {shot && <span>{shot.points} pts</span>}
              </div>
            </Html>
          </group>
        );
      })}

      {/* Dónde cayó cada disparo de la ronda. */}
      {round.shots.map((shot, i) => (
        <group key={i} position={[shot.x, 0, 0.6]}>
          <mesh position={[0, 0.35, 0]}>
            <coneGeometry args={[0.12, 0.7, 10]} />
            <meshBasicMaterial
              color={shot.miss <= BULLSEYE_RADIUS ? "#34d399" : "#f2a65a"}
              toneMapped={false}
            />
          </mesh>
          <Html position={[0, 0.95, 0]} center>
            <div className={styles.mark}>
              {shot.miss <= BULLSEYE_RADIUS ? "¡Impacto!" : `${shot.miss.toFixed(1)} m`}
            </div>
          </Html>
        </group>
      ))}

      {view.mode === "viento" && (
        <Html position={[6, 3.4, 0]} center>
          <div className={styles.wind}>
            Viento {round.wind > 0 ? "a favor →" : "← en contra"} · {Math.abs(round.wind).toFixed(1)} m/s²
          </div>
        </Html>
      )}
    </group>
  );
}
