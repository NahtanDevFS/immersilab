"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { CUTOFF_TEMP, ITEMS, type MagnetEngine } from "./engine";
import styles from "./MagnetScene.module.css";
import { SceneLabel } from "@/components/vr/SceneLabel";

/** Dónde está cada objeto en el patio (x), y el contenedor al final. */
const SLOT_X = [0, 2.4, 4.8, 7.2, 9.8, 13.2];
const CONTAINER_X = 17.4;
/** Altura de la viga de la grúa y por dónde pasa el imán al viajar. */
const BEAM_Y = 6.2;
const TRAVEL_Y = 2.8;
/** El imán: un disco con su bobina. */
const MAGNET_RADIUS = 0.45;
const MAGNET_HEIGHT = 0.34;

/** Alto de cada objeto (para apoyarlo en el suelo o colgarlo del polo). */
const HEIGHT: Record<string, number> = {
  lata: 0.28,
  olla: 0.24,
  bloque: 0.3,
  tubo: 0.16,
  motor: 0.52,
  carro: 1.35,
};

/** Lugar de cada objeto dentro del contenedor, para que no se encimen. */
const CONTAINER_SPOT: Record<string, [number, number]> = {
  lata: [-0.6, -0.4],
  bloque: [0.1, -0.4],
  motor: [0.3, 0.4],
  olla: [-0.6, 0.4],
  tubo: [0, 0],
  carro: [0, 0],
};

const COPPER = new THREE.Color("#b87333");
const HOT = new THREE.Color("#ff3b1f");

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/**
 * Brillo de las líneas de campo. Fuera del componente a propósito: el
 * compilador de React no deja mutar un valor creado con un hook, pero un
 * material de three se ajusta mutándolo, por diseño.
 */
function setOpacity(material: THREE.Material, opacity: number) {
  material.opacity = opacity;
}

/** Posición x de la grúa para una posición continua 0..6. */
function craneX(pos: number): number {
  const i = Math.floor(pos);
  const t = pos - i;
  const xs = [...SLOT_X, CONTAINER_X];
  const a = xs[Math.min(i, xs.length - 1)];
  const b = xs[Math.min(i + 1, xs.length - 1)];
  return a + (b - a) * t;
}

/**
 * Patio de chatarra con una grúa pórtico y un electroimán.
 *
 * El imán baja hasta la separación elegida sobre el objeto (para que se vea
 * que esa distancia es la que manda), y si lo levanta, lo sube pegado al
 * polo. Las líneas de campo aparecen al encenderlo y brillan más cuanto más
 * fuerte es el campo; la bobina se pone roja al calentarse.
 */
export function MagnetScene({ engine, variables }: Props) {
  const magnet = engine as MagnetEngine;

  const trolleyRef = useRef<THREE.Group>(null);
  const magnetRef = useRef<THREE.Group>(null);
  const cableRef = useRef<THREE.Mesh>(null);
  const coilRef = useRef<THREE.MeshStandardMaterial>(null);
  const fieldRef = useRef<THREE.Group>(null);
  const itemRefs = useRef<Record<string, THREE.Group | null>>({});
  const magnetY = useRef(TRAVEL_Y);

  useFixedTimestep((dt) => magnet.update(dt, variables));

  // Un solo material para las seis líneas: así el brillo se ajusta en todas.
  const fieldMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#2dd4bf",
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
      }),
    [],
  );

  // Líneas de campo: óvalos verticales alrededor del imán, de polo a polo.
  const fieldCurves = useMemo(
    () =>
      Array.from({ length: 6 }, (_, k) => {
        const angle = (k / 6) * Math.PI * 2;
        const points = Array.from({ length: 40 }, (_, j) => {
          const t = (j / 39) * Math.PI * 2;
          const r = MAGNET_RADIUS * 0.6 + 0.55 * (1 - Math.cos(t)) * 0.5 + 0.05;
          const y = 0.55 * Math.sin(t) * 1.4 - 0.15;
          return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
        });
        return new THREE.CatmullRomCurve3(points, true);
      }),
    [],
  );

  useFrame((_, delta) => {
    const r = magnet.getRuntime();
    const x = craneX(r.cranePos);
    if (trolleyRef.current) trolleyRef.current.position.x = x;

    // Altura del imán: sobre el objeto a la separación elegida, arriba si
    // lleva algo, a altura de viaje si se está moviendo o no hay nada abajo.
    const arrived = Math.abs(r.cranePos - r.targetPos) < 0.02;
    const below = arrived ? ITEMS[r.targetPos] : undefined;
    const belowFree = below && !r.inContainer.includes(below.id);
    const gap = Number(variables.separacion ?? 10) / 100;
    let target = TRAVEL_Y;
    if (r.carried) {
      const h = HEIGHT[r.carried] ?? 0.3;
      target = THREE.MathUtils.lerp(h, TRAVEL_Y + h * 0.3, r.lift);
    } else if (belowFree) {
      target = (HEIGHT[below.id] ?? 0.3) + gap;
    }
    magnetY.current = THREE.MathUtils.damp(magnetY.current, target, 4, delta);
    if (magnetRef.current) magnetRef.current.position.set(x, magnetY.current, 0);
    if (cableRef.current) {
      const top = BEAM_Y - 0.3;
      const bottom = magnetY.current + MAGNET_HEIGHT;
      const length = Math.max(0.05, top - bottom);
      cableRef.current.position.set(x, bottom + length / 2, 0);
      cableRef.current.scale.set(1, length, 1);
    }

    // Bobina: cobre que se pone rojo al calentarse.
    if (coilRef.current) {
      const heat = THREE.MathUtils.clamp((r.temperature - 40) / (CUTOFF_TEMP - 40), 0, 1);
      coilRef.current.color.copy(COPPER).lerp(HOT, heat);
      coilRef.current.emissive.copy(HOT);
      coilRef.current.emissiveIntensity = heat * 1.5;
    }

    // Campo: visible solo con el imán encendido, más intenso con más campo.
    const on = r.magnetOn && !r.tripped;
    if (fieldRef.current) {
      fieldRef.current.visible = on;
      fieldRef.current.rotation.y += delta * 0.3;
    }
    setOpacity(fieldMaterial, on ? 0.15 + 0.75 * Math.min(1, r.field / 0.6) : 0);

    // Objetos: en el suelo, colgando del imán o en el contenedor.
    ITEMS.forEach((item, i) => {
      const group = itemRefs.current[item.id];
      if (!group) return;
      if (r.carried === item.id) {
        group.position.set(x, magnetY.current - (HEIGHT[item.id] ?? 0.3), 0);
      } else if (r.inContainer.includes(item.id)) {
        const [dx, dz] = CONTAINER_SPOT[item.id] ?? [0, 0];
        group.position.set(CONTAINER_X + dx, 0.12, dz);
      } else {
        group.position.set(SLOT_X[i], 0, 0);
      }
    });
  });

  return (
    <group>
      {/* Pórtico de la grúa: dos patas a cada lado y la viga. */}
      {[-1.6, CONTAINER_X + 1.8].map((px) =>
        [-1.6, 1.6].map((pz) => (
          <mesh key={`${px}${pz}`} position={[px, BEAM_Y / 2, pz]} castShadow>
            <boxGeometry args={[0.25, BEAM_Y, 0.25]} />
            <meshStandardMaterial color="#d9a521" metalness={0.4} roughness={0.5} />
          </mesh>
        )),
      )}
      {[-1.6, 1.6].map((pz) => (
        <mesh key={pz} position={[(CONTAINER_X + 0.2) / 2, BEAM_Y, pz]} castShadow>
          <boxGeometry args={[CONTAINER_X + 3.6, 0.3, 0.25]} />
          <meshStandardMaterial color="#d9a521" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* Carro de la grúa sobre la viga. */}
      <group ref={trolleyRef} position={[0, BEAM_Y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.4, 3.6]} />
          <meshStandardMaterial color="#39404d" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
      <mesh ref={cableRef}>
        <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
        <meshStandardMaterial color="#1c1f26" />
      </mesh>

      {/* El electroimán: núcleo, bobina y polo. */}
      <group ref={magnetRef} position={[0, TRAVEL_Y, 0]}>
        <mesh position={[0, MAGNET_HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[MAGNET_RADIUS, MAGNET_RADIUS, MAGNET_HEIGHT, 32]} />
          <meshStandardMaterial color="#4a5060" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, MAGNET_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[MAGNET_RADIUS + 0.03, 0.07, 12, 40]} />
          <meshStandardMaterial ref={coilRef} color={COPPER} metalness={0.7} roughness={0.35} />
        </mesh>
        <group ref={fieldRef} visible={false}>
          {fieldCurves.map((curve, k) => (
            <mesh key={k} material={fieldMaterial}>
              <tubeGeometry args={[curve, 60, 0.012, 6, true]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Chatarra. */}
      {ITEMS.map((item, i) => (
        <group
          key={item.id}
          ref={(g) => {
            itemRefs.current[item.id] = g;
          }}
          position={[SLOT_X[i], 0, 0]}
        >
          <ScrapModel id={item.id} />
          <SceneLabel position={[0, (HEIGHT[item.id] ?? 0.3) + 0.35, 0.6]} center>
            <div className={styles.label}>
              {item.name}
              <span>{item.mass} kg</span>
            </div>
          </SceneLabel>
        </group>
      ))}

      {/* Contenedor, abierto arriba. */}
      <group position={[CONTAINER_X, 0, 0]}>
        {[
          { p: [0, 0.06, 0], s: [2.4, 0.12, 2] },
          { p: [-1.2, 0.5, 0], s: [0.08, 1, 2] },
          { p: [1.2, 0.5, 0], s: [0.08, 1, 2] },
          { p: [0, 0.5, -1], s: [2.4, 1, 0.08] },
          { p: [0, 0.5, 1], s: [2.4, 1, 0.08] },
        ].map((wall, k) => (
          <mesh key={k} position={wall.p as [number, number, number]} castShadow receiveShadow>
            <boxGeometry args={wall.s as [number, number, number]} />
            <meshStandardMaterial color="#2f6b4f" metalness={0.5} roughness={0.6} />
          </mesh>
        ))}
        <SceneLabel position={[0, 1.5, 1.1]} center>
          <div className={styles.label}>Contenedor</div>
        </SceneLabel>
      </group>
    </group>
  );
}

/** Cada objeto con formas simples: se reconoce sin modelos 3D. */
function ScrapModel({ id }: { id: string }) {
  switch (id) {
    case "lata":
      return (
        <mesh position={[0, 0.14, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.28, 20]} />
          <meshStandardMaterial color="#9aa3ad" metalness={0.8} roughness={0.35} />
        </mesh>
      );
    case "olla":
      return (
        <group>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.25, 0.24, 28, 1, true]} />
            <meshStandardMaterial color="#d6dbe0" metalness={0.9} roughness={0.25} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.01, 28]} />
            <meshStandardMaterial color="#d6dbe0" metalness={0.9} roughness={0.25} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.35, 0.2, 0]}>
              <boxGeometry args={[0.14, 0.03, 0.05]} />
              <meshStandardMaterial color="#2a2d33" />
            </mesh>
          ))}
        </group>
      );
    case "bloque":
      return (
        <mesh position={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[0.38, 0.3, 0.38]} />
          <meshStandardMaterial color="#4b4f57" metalness={0.7} roughness={0.6} />
        </mesh>
      );
    case "tubo":
      return (
        <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.2, 20]} />
          <meshStandardMaterial color="#c56a3a" metalness={0.9} roughness={0.3} />
        </mesh>
      );
    case "motor":
      return (
        <group>
          <mesh position={[0, 0.26, 0]} castShadow>
            <boxGeometry args={[0.75, 0.52, 0.55]} />
            <meshStandardMaterial color="#5a5f68" metalness={0.6} roughness={0.55} />
          </mesh>
          <mesh position={[0.48, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.22, 16]} />
            <meshStandardMaterial color="#3a3e45" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      );
    case "carro":
      return (
        <group>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[3, 0.6, 1.5]} />
            <meshStandardMaterial color="#b3302e" metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[-0.15, 1.08, 0]} castShadow>
            <boxGeometry args={[1.6, 0.5, 1.35]} />
            <meshStandardMaterial color="#8f2523" metalness={0.5} roughness={0.45} />
          </mesh>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * 1, 0.28, sz * 0.72]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.28, 0.28, 0.2, 16]} />
                <meshStandardMaterial color="#1b1d21" roughness={0.9} />
              </mesh>
            )),
          )}
        </group>
      );
    default:
      return null;
  }
}
