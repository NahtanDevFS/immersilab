"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useTiledPbrTexture } from "../shell/useTiledPbrTexture";
import { DOOR_HEIGHT, DOOR_WIDTH } from "./corridor";
import styles from "./Door.module.css";

/*
 * Entrar a un experimento pide TRES condiciones a la vez, no solo estar
 * cerca. Con la distancia sola, pasar caminando por el pasillo bastaba para
 * que te metiera adentro sin quererlo — y la puerta está justo al costado
 * del camino, así que rozarla es lo normal, no la excepción.
 *
 *   1. Estar cerca (`TRIGGER_RADIUS`).
 *   2. Estar MIRÁNDOLA. Nadie entra a una puerta de espaldas.
 *   3. Sostener las dos cosas `DWELL_SECONDS`. Es el patrón de "mirada
 *      sostenida" de las interfaces de visor: da tiempo a arrepentirse, y el
 *      marco que se va encendiendo avisa qué está por pasar.
 */
const TRIGGER_RADIUS = 1.15;
/** Coseno del ángulo máximo entre hacia dónde mirás y dónde está la puerta.
 *  0.55 ≈ 57°: hay que estar de frente, pero no clavado al centímetro. */
const FACING_THRESHOLD = 0.55;
/** Cuánto hay que sostenerlo. Menos de medio segundo no da tiempo a soltar
 *  el stick; más de uno se siente trabado. */
const DWELL_SECONDS = 0.75;
/** Desde dónde la puerta empieza a responder al jugador que se acerca. */
const GLOW_START_DISTANCE = 6;

const LEAF_THICKNESS = 0.06;
const FRAME_DEPTH = 0.09;

interface Props {
  href: string;
  name: string;
  position: [number, number, number];
  rotationY?: number;
}

/**
 * Puerta del pasillo.
 *
 * Antes era un GLB de marco (`doorway-front.glb`) con un panel teal
 * translúcido encima. Se reemplazó por geometría propia: la puerta del
 * pasillo son cinco cajas, pesa cero, y sobre todo permite ponerle la
 * textura de madera pedida y controlar exactamente el ancho del vano — con
 * el GLB, el vano venía dado por el modelo y no coincidía con el hueco de la
 * pared.
 *
 * La hoja usa la textura de madera **teñida de negro**: el `color` se
 * multiplica sobre el mapa, así que un casi-negro deja ver la veta y los
 * poros en los reflejos sin que la puerta sea café. Una puerta de color liso
 * se lee como cartón; lo que la hace parecer madera pintada es justamente
 * que la rugosidad siga siendo la de la madera.
 */
export function Door({ href, name, position, rotationY = 0 }: Props) {
  const router = useRouter();
  const { camera } = useThree();

  // 1 repetición: la hoja mide ~1×2.25 m y la textura ~1 m — tilearla más
  // haría un patrón visible de tablas chicas que no existe en una puerta.
  const wood = useTiledPbrTexture("/textures/door/wood_028", 1, 2);

  const frameRef = useRef<THREE.MeshStandardMaterial>(null);
  const triggered = useRef(false);
  const doorPos = useRef(new THREE.Vector3(...position));
  const dwell = useRef(0);
  const look = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (triggered.current) return;

    const dx = camera.position.x - doorPos.current.x;
    const dz = camera.position.z - doorPos.current.z;
    const distance = Math.hypot(dx, dz);

    // ¿Está mirando la puerta? Producto punto entre hacia dónde mira la
    // cámara y la dirección jugador → puerta, los dos en el plano del piso:
    // mirar hacia arriba o abajo no debería contar como "no la estoy
    // mirando".
    camera.getWorldDirection(look.current);
    look.current.y = 0;
    look.current.normalize();
    const facing =
      distance > 0.001
        ? (look.current.x * -dx + look.current.z * -dz) / distance
        : 1;

    const armed = distance < TRIGGER_RADIUS && facing > FACING_THRESHOLD;
    dwell.current = armed
      ? Math.min(dwell.current + delta, DWELL_SECONDS)
      : // Se descarga más rápido de lo que se carga: alejarse tiene que
        // cancelar de inmediato, no dejar la cuenta a medias.
        Math.max(dwell.current - delta * 2.5, 0);

    if (frameRef.current) {
      const proximity = Math.max(
        1 - Math.min(1, distance / GLOW_START_DISTANCE),
        // La carga de la permanencia manda sobre la cercanía: el marco
        // llegando al máximo ES el aviso de que estás por entrar.
        dwell.current / DWELL_SECONDS,
      );
      // Al cuadrado y arrancando en cero: de lejos el marco es un perfil
      // oscuro más (el pasillo de referencia no tiene puertas que brillen), y
      // recién cerca se enciende. Con toneMapped={false}, lo que pasa de 1
      // cruza el umbral del bloom, así que la puerta a la que vas irradia.
      frameRef.current.emissiveIntensity = proximity * proximity * 2.2;
    }

    if (dwell.current >= DWELL_SECONDS) {
      triggered.current = true;
      router.push(href);
    }
  });

  const [x, y, z] = position;
  const frameW = DOOR_WIDTH + 0.09;
  const frameH = DOOR_HEIGHT + 0.05;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      {/* Marco: tres cajas (dos jambas y un dintel) con el teal del lab. Es
          lo único emisivo de la puerta, así que es lo que guía al jugador
          desde lejos en el pasillo. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * (frameW - 0.045)) / 2, frameH / 2, 0.02]}
          castShadow
        >
          <boxGeometry args={[0.045, frameH, FRAME_DEPTH]} />
          <meshStandardMaterial
            ref={side === -1 ? frameRef : undefined}
            color="#20242c"
            emissive="#2dd4bf"
            emissiveIntensity={0}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, frameH - 0.02, 0.02]} castShadow>
        <boxGeometry args={[frameW, 0.045, FRAME_DEPTH]} />
        <meshStandardMaterial
          color="#20242c"
          emissive="#2dd4bf"
          emissiveIntensity={0}
          toneMapped={false}
        />
      </mesh>

      {/* La hoja. */}
      <mesh position={[0, DOOR_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, LEAF_THICKNESS]} />
        <meshStandardMaterial
          {...wood}
          // Casi negro, no negro puro: en negro absoluto el mapa de rugosidad
          // no tiene nada que modular y la puerta se vuelve una silueta plana.
          color="#14151a"
          roughness={0.75}
          metalness={0.08}
          envMapIntensity={0.9}
        />
      </mesh>

      {/* Manija: acero, a 1.05 m como en una puerta real. Es la pieza que le
          da escala a la hoja — sin ella, una puerta 3D podría medir dos
          metros o cinco. */}
      <mesh
        position={[DOOR_WIDTH / 2 - 0.14, 1.05, LEAF_THICKNESS / 2 + 0.03]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.02, 0.02, 0.13, 10]} />
        <meshStandardMaterial color="#b9c0cc" metalness={0.95} roughness={0.2} />
      </mesh>

      <Html position={[0, DOOR_HEIGHT + 0.35, 0.06]} center>
        <div className={styles.label}>{name}</div>
      </Html>
    </group>
  );
}
