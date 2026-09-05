"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { useCollider } from "@/lib/collision/useCollider";
import { getFluid, PIPE_RADIUS, type VenturiEngine } from "./engine";

/*
 * El tubo se dibuja a escala aumentada: 1 metro del modelo son 8 metros de
 * escena. Un Venturi real de 12 cm de diámetro sería, a tamaño natural, un
 * caño del grosor de un brazo perdido en medio del campo — no se vería nada
 * de lo que hay que ver. Acá se camina POR AL LADO del tubo, que es lo que
 * justifica hacerlo en 3D.
 */
const SCALE = 8;
const PIPE_LENGTH = 9;
/** Dónde empieza y termina el estrechamiento, a lo largo del tubo. */
const THROAT_START = -1.1;
const THROAT_END = 1.1;
const AXIS_Y = 1.6;

/** Cuántas partículas viajan por el tubo. */
const PARTICLE_COUNT = 90;

/** Altura de la columna de los manómetros, en metros de escena. */
const GAUGE_HEIGHT = 2.2;

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * Perfil del tubo, como radio en función de la posición a lo largo del eje.
 *
 * El estrechamiento no es un escalón sino una transición suave (una coseno):
 * un Venturi real es cónico, y con un escalón el flujo se separaría de la
 * pared — que es otro fenómeno, y no el que este experimento explica.
 */
function radiusAt(z: number, throatRadius: number): number {
  if (z <= THROAT_START || z >= THROAT_END) return PIPE_RADIUS * SCALE;

  const t = (z - THROAT_START) / (THROAT_END - THROAT_START); // 0..1
  const blend = (1 - Math.cos(t * Math.PI * 2)) / 2; // 0 en los bordes, 1 al medio
  return THREE.MathUtils.lerp(
    PIPE_RADIUS * SCALE,
    throatRadius * SCALE,
    blend,
  );
}

export function VenturiScene({ engine, variables }: Props) {
  const venturi = engine as VenturiEngine;

  const pipeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const gauge1Ref = useRef<THREE.Mesh>(null);
  const gauge2Ref = useRef<THREE.Mesh>(null);
  const particleMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  /** Posición inicial de cada partícula a lo largo del tubo, repartidas. */
  const seeds = useMemo(
    () =>
      Array.from(
        { length: PARTICLE_COUNT },
        (_, i) => (i / PARTICLE_COUNT) * PIPE_LENGTH,
      ),
    [],
  );
  /** Desvío radial de cada partícula, para que no viajen todas en fila. */
  const offsets = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        angle: (i * 2.399) % (Math.PI * 2), // ángulo áureo: reparte parejo
        radial: 0.25 + ((i * 37) % 60) / 100,
      })),
    [],
  );

  useFixedTimestep((dt) => {
    venturi.update(dt, variables);
  });

  // El tubo es un obstáculo sólido: sin esto se le camina a través, que es
  // lo que más delata que la escena es un decorado.
  useCollider({
    center: [0, AXIS_Y, 0],
    size: [PIPE_RADIUS * SCALE * 2, PIPE_RADIUS * SCALE * 2, PIPE_LENGTH],
  });

  useFrame(() => {
    const runtime = venturi.getRuntime();
    const throatRadius = Number(variables.cuello ?? 0.03);
    const fluid = getFluid(variables.fluido ?? "agua");

    // El perfil del tubo se reconstruye cuando cambia el cuello. Se compara
    // contra el radio guardado en la geometría para no rehacer la malla en
    // cada frame: crear geometría por frame es la forma más rápida de tirar
    // el framerate y llenar la memoria de la GPU.
    if (pipeRef.current) {
      const mesh = pipeRef.current;
      const built = mesh.userData.throatRadius as number | undefined;
      if (built !== throatRadius) {
        mesh.userData.throatRadius = throatRadius;
        const points: THREE.Vector2[] = [];
        const steps = 90;
        for (let i = 0; i <= steps; i += 1) {
          const z = -PIPE_LENGTH / 2 + (PIPE_LENGTH * i) / steps;
          points.push(new THREE.Vector2(radiusAt(z, throatRadius), z));
        }
        mesh.geometry.dispose();
        mesh.geometry = new THREE.LatheGeometry(points, 40);
      }
    }

    // Partículas: la velocidad de cada una es la del fluido EN SU POSICIÓN,
    // o sea que se apretujan y aceleran al pasar por el cuello. Es la
    // ecuación de continuidad hecha visible, y es lo que hace entender de un
    // vistazo por qué la presión cae justo ahí.
    if (particlesRef.current) {
      const a1 = PIPE_RADIUS * PIPE_RADIUS;
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        // Cada partícula avanza con la fase global; el módulo la hace volver
        // al principio del tubo, así el flujo es continuo sin reciclar nada.
        const base =
          (seeds[i] + runtime.flowPhase * runtime.v1 * 0.55) % PIPE_LENGTH;
        const z = base - PIPE_LENGTH / 2;
        const r = radiusAt(z, throatRadius) / SCALE;
        const { angle, radial } = offsets[i];

        dummy.position.set(
          Math.cos(angle) * r * SCALE * radial,
          AXIS_Y + Math.sin(angle) * r * SCALE * radial,
          z,
        );
        // Se estiran donde van rápido, como el motion blur de un plano
        // cenital de una autopista: refuerza la lectura de "acá acelera".
        const stretch = Math.min(4, (a1 / (r * r)) * 0.9);
        dummy.scale.set(1, 1, stretch);
        dummy.updateMatrix();
        particlesRef.current.setMatrixAt(i, dummy.matrix);
      }
      particlesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (particleMatRef.current) {
      particleMatRef.current.color.set(
        // Rojo cuando cavita: el fluido está hirviendo por baja presión, y
        // eso en una bomba real la destruye. Es el "perdiste" del juego.
        runtime.cavitating ? "#e24b4a" : fluid.color,
      );
      particleMatRef.current.emissive.set(
        runtime.cavitating ? "#e24b4a" : fluid.color,
      );
    }

    // Manómetros: dos columnas cuya altura es la presión. Se eligió esto y no
    // un número flotando porque la comparación entre las dos columnas es
    // instantánea y no hay que leer nada.
    const level = (pressure: number) =>
      THREE.MathUtils.clamp(pressure / 400000, 0.02, 1);

    if (gauge1Ref.current) {
      const h = level(runtime.p1) * GAUGE_HEIGHT;
      gauge1Ref.current.scale.set(1, h, 1);
      gauge1Ref.current.position.y = AXIS_Y + 0.5 + h / 2;
    }
    if (gauge2Ref.current) {
      const h = level(runtime.p2) * GAUGE_HEIGHT;
      gauge2Ref.current.scale.set(1, h, 1);
      gauge2Ref.current.position.y = AXIS_Y + 0.5 + h / 2;
    }
  });

  return (
    <group>
      {/* El tubo. Transparente y con las dos caras: hay que ver el fluido
          por dentro, que es donde pasa todo. */}
      <mesh
        ref={pipeRef}
        position={[0, AXIS_Y, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <latheGeometry />
        <meshStandardMaterial
          color="#9fb3c8"
          transparent
          opacity={0.22}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Bridas de los extremos: cierran el tubo visualmente y le dan escala
          de pieza industrial en vez de cilindro flotando. */}
      {[-PIPE_LENGTH / 2, PIPE_LENGTH / 2].map((z) => (
        <mesh key={z} position={[0, AXIS_Y, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry
            args={[PIPE_RADIUS * SCALE * 1.35, PIPE_RADIUS * SCALE * 1.35, 0.12, 28]}
          />
          <meshStandardMaterial color="#3a4150" metalness={0.85} roughness={0.35} />
        </mesh>
      ))}

      {/* El fluido. */}
      <instancedMesh
        ref={particlesRef}
        args={[undefined, undefined, PARTICLE_COUNT]}
      >
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial
          ref={particleMatRef}
          color="#2dd4bf"
          emissive="#2dd4bf"
          emissiveIntensity={0.5}
          roughness={0.35}
        />
      </instancedMesh>

      {/* Manómetros: uno en el tramo ancho, otro sobre el cuello. */}
      {[
        { z: -3.2, ref: gauge1Ref },
        { z: 0, ref: gauge2Ref },
      ].map(({ z, ref }) => (
        <group key={z} position={[0, 0, z]}>
          {/* Tubo de vidrio del manómetro. */}
          <mesh position={[0, AXIS_Y + 0.5 + GAUGE_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[0.1, 0.1, GAUGE_HEIGHT, 16]} />
            <meshStandardMaterial
              color="#cbd5e1"
              transparent
              opacity={0.18}
              roughness={0.1}
              depthWrite={false}
            />
          </mesh>
          {/* Columna de líquido: la altura ES la presión. */}
          <mesh ref={ref} position={[0, AXIS_Y + 0.5, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 1, 16]} />
            <meshStandardMaterial
              color="#f2a65a"
              emissive="#f2a65a"
              emissiveIntensity={0.35}
              roughness={0.4}
            />
          </mesh>
          {/* Toma de presión: conecta el manómetro con el tubo. */}
          <mesh position={[0, AXIS_Y + 0.28, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.55, 10]} />
            <meshStandardMaterial color="#3a4150" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Soportes: apoyan el tubo en el piso. Sin ellos flota. */}
      {[-3.6, 3.6].map((z) => (
        <mesh key={z} position={[0, AXIS_Y / 2 - 0.2, z]} castShadow receiveShadow>
          <boxGeometry args={[0.5, AXIS_Y - 0.4, 0.28]} />
          <meshStandardMaterial color="#39404d" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
