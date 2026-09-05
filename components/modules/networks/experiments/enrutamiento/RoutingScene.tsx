"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import {
  GOAL,
  LINKS,
  NODES,
  START,
  type RoutingEngine,
} from "./engine";
import styles from "./RoutingScene.module.css";

/** Altura a la que flota la red sobre el pasto. */
const NET_Y = 1.5;

const IDLE = new THREE.Color("#2b3550");
const TAKEN = new THREE.Color(0.3, 2.4, 2.1);
const OPTION = new THREE.Color(2.6, 1.8, 0.6);
const DOWN = new THREE.Color("#e24b4a");

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

function nodePosition(id: string): [number, number, number] {
  const node = NODES.find((n) => n.id === id);
  if (!node) return [0, NET_Y, 0];
  return [node.position[0], NET_Y, node.position[1]];
}

/**
 * La red como objeto: nueve routers flotando y los enlaces entre ellos.
 *
 * Los routers se pueden CLICKEAR para mandar el paquete — es la primera
 * escena del laboratorio donde el jugador toca la escena y no un slider. El
 * mismo salto está también en botones HTML (RoutingControls), y no es
 * duplicación al pepe: dentro del visor no hay puntero para clickear un mesh
 * en 3D, y el cursor virtual del gamepad resuelve sobre el DOM. Cada entrada
 * llama al mismo `hop()`.
 *
 * Los enlaces se pintan por estado, y ese código de color es la lectura
 * completa de la partida: gris el que no se usó, teal el camino recorrido,
 * ámbar los saltos disponibles ahora, rojo el enlace caído.
 */
export function RoutingScene({ engine, variables }: Props) {
  const routing = engine as RoutingEngine;

  const packetRef = useRef<THREE.Mesh>(null);
  const linkRefs = useRef<Array<THREE.Mesh | null>>([]);
  const nodeRefs = useRef<Record<string, THREE.Mesh | null>>({});

  const from = useMemo(() => new THREE.Vector3(), []);
  const to = useMemo(() => new THREE.Vector3(), []);

  useFixedTimestep((dt) => {
    routing.update(dt, variables);
  });

  useFrame(() => {
    const runtime = routing.getRuntime();

    // El paquete viaja entre el router anterior y el actual. Interpolar la
    // posición (en vez de teletransportarlo) es lo que hace que se lea que
    // un enlace largo "cuesta" más que uno corto.
    if (packetRef.current) {
      const path = runtime.path;
      const current = path[path.length - 1];
      const previous = path[path.length - 2] ?? current;
      from.set(...nodePosition(previous));
      to.set(...nodePosition(current));
      packetRef.current.position.lerpVectors(from, to, runtime.hopProgress);
    }

    LINKS.forEach((link, index) => {
      const mesh = linkRefs.current[index];
      if (!mesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;

      const isDown = runtime.downLinks.includes(index);
      const inPath = runtime.path.some(
        (id, i) =>
          i > 0 &&
          ((runtime.path[i - 1] === link.from && id === link.to) ||
            (runtime.path[i - 1] === link.to && id === link.from)),
      );
      const head = runtime.path[runtime.path.length - 1];
      const isOption =
        !isDown &&
        ((link.from === head && runtime.options.includes(link.to)) ||
          (link.to === head && runtime.options.includes(link.from)));

      const color = isDown
        ? DOWN
        : inPath
          ? TAKEN
          : isOption
            ? OPTION
            : IDLE;

      material.color.copy(color);
      material.emissive.copy(color);
      material.emissiveIntensity = isDown ? 0.6 : inPath || isOption ? 1 : 0.05;
    });

    NODES.forEach((node) => {
      const mesh = nodeRefs.current[node.id];
      if (!mesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const isOption = runtime.options.includes(node.id);
      const visited = runtime.path.includes(node.id);

      material.emissiveIntensity = isOption ? 1.4 : visited ? 0.6 : 0.15;
      // Los saltos posibles laten un poco: en una red de nueve nodos, sin
      // eso hay que buscar con la vista cuáles se pueden tocar.
      const pulse = isOption ? 1 + Math.sin(performance.now() / 220) * 0.08 : 1;
      mesh.scale.setScalar(pulse);
    });
  });

  return (
    <group>
      {/* Enlaces. Cada uno es un cilindro tendido entre dos routers. */}
      {LINKS.map((link, index) => {
        const a = new THREE.Vector3(...nodePosition(link.from));
        const b = new THREE.Vector3(...nodePosition(link.to));
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const length = a.distanceTo(b);
        const direction = b.clone().sub(a).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction,
        );

        return (
          <group key={`${link.from}-${link.to}`}>
            <mesh
              ref={(mesh) => {
                linkRefs.current[index] = mesh;
              }}
              position={mid}
              quaternion={quaternion}
            >
              <cylinderGeometry args={[0.045, 0.045, length, 8]} />
              <meshStandardMaterial
                color={IDLE}
                emissive={IDLE}
                emissiveIntensity={0.05}
                toneMapped={false}
              />
            </mesh>

            {/* La etiqueta del enlace: lo que el jugador tiene que mirar para
                decidir. Sin el dato a la vista, elegir un salto sería adivinar. */}
            <Html position={[mid.x, mid.y + 0.3, mid.z]} center>
              <div className={styles.linkLabel}>
                {link.latency} ms · {link.bandwidth} Mbps
              </div>
            </Html>
          </group>
        );
      })}

      {/* Routers. */}
      {NODES.map((node) => {
        const position = nodePosition(node.id);
        const isEdge = node.id === START || node.id === GOAL;

        return (
          <group key={node.id} position={position}>
            <mesh
              ref={(mesh) => {
                nodeRefs.current[node.id] = mesh;
              }}
              castShadow
              onClick={(event) => {
                // stopPropagation: sin esto, el clic atraviesa y activa
                // también el router que esté detrás en la línea de vista.
                event.stopPropagation();
                routing.hop(node.id);
              }}
            >
              <boxGeometry args={isEdge ? [0.9, 0.45, 0.9] : [0.7, 0.35, 0.7]} />
              <meshStandardMaterial
                color={isEdge ? "#2dd4bf" : "#8e9bb0"}
                emissive={isEdge ? "#2dd4bf" : "#8e9bb0"}
                emissiveIntensity={0.15}
                metalness={0.6}
                roughness={0.35}
              />
            </mesh>

            <Html position={[0, 0.55, 0]} center>
              <div className={styles.nodeLabel} data-edge={isEdge}>
                {node.label}
              </div>
            </Html>

            {/* Patas: sin ellas los routers se leen como cajas flotando. */}
            <mesh position={[0, -NET_Y / 2, 0]}>
              <cylinderGeometry args={[0.03, 0.03, NET_Y, 6]} />
              <meshStandardMaterial color="#39404d" metalness={0.5} roughness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* El paquete. */}
      <mesh ref={packetRef} castShadow>
        <octahedronGeometry args={[0.22]} />
        <meshStandardMaterial
          color="#f2a65a"
          emissive="#f2a65a"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
