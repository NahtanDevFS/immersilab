"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import {
  PIECE_HEIGHT,
  PROFILE_SAMPLES,
  getTargetPiece,
  radiusAt,
} from "@/components/modules/calculus/shared/profiles";
import type { LatheEngine, LatheMethod } from "./engine";

/** Dónde se apoya la pieza torneada y dónde el fantasma de la objetivo. */
const PIECE_X = 0;
const GHOST_X = 3.2;
const BASE_Y = 0.35;

/** Cuántas rebanadas se dibujan al ver el método de discos. */
const SLICES = 14;
/**
 * En capas se dibujan MENOS y más transparentes. No es capricho: los
 * cascarones son concéntricos, así que al mirar la pieza la vista atraviesa
 * todos a la vez y sus opacidades se suman — con los mismos catorce del modo
 * discos, la pieza desaparecía detrás de un bloque naranja macizo.
 */
const SHELLS = 6;
const DISC_OPACITY = 0.3;
const SHELL_OPACITY = 0.12;

const PROFILE_COLOR = new THREE.Color(0.4, 2.6, 2.2);

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/** Perfil (radio, altura) listo para LatheGeometry. */
function buildProfile(radii: number[]): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= PROFILE_SAMPLES; i += 1) {
    const t = i / PROFILE_SAMPLES;
    points.push(new THREE.Vector2(radiusAt(radii, t), t * PIECE_HEIGHT));
  }
  return points;
}

/**
 * "Torneá la pieza" (C3): el sólido de revolución en vivo.
 *
 * Es el experimento que más justifica que todo esto sea 3D. En papel, "la
 * región bajo la curva gira alrededor del eje" es una frase que hay que
 * creerse; acá el perfil ESTÁ ahí, dibujado al lado del sólido que genera, y
 * se puede caminar alrededor de la pieza para ver qué produjo cada slider.
 *
 * Tres piezas en pantalla, y cada una tiene un porqué:
 *
 *  1. **El sólido**, girando lento sobre su eje, como en un torno.
 *  2. **El perfil**, la curva r(h) que lo genera, dibujada en el plano de
 *     corte. Sin ella, mover un slider es magia; con ella, se ve que se está
 *     moviendo un punto de una función.
 *  3. **La pieza objetivo**, al lado y traslúcida. Al lado y no encima: dos
 *     sólidos superpuestos y semitransparentes se leen como una sola mancha
 *     y no se distingue cuál sobra.
 */
export function LatheScene({ engine, variables }: Props) {
  const lathe = engine as LatheEngine;

  const pieceRef = useRef<THREE.Mesh>(null);
  const ghostRef = useRef<THREE.Mesh>(null);
  const spinRef = useRef<THREE.Group>(null);
  const profileRef = useRef<THREE.BufferGeometry>(null);
  const slicesRef = useRef<THREE.Group>(null);

  const profilePositions = useMemo(
    () => new Float32Array((PROFILE_SAMPLES + 1) * 3),
    [],
  );

  useFixedTimestep((dt) => {
    lathe.update(dt, variables);
  });

  useFrame(() => {
    const runtime = lathe.getRuntime();
    const method = String(variables.metodo ?? "discos") as LatheMethod;
    const piece = getTargetPiece(variables.pieza ?? "copa");

    // La geometría se rehace SOLO cuando cambian los radios: crear un
    // LatheGeometry por frame es la forma más rápida de tirar el framerate y
    // llenar la memoria de la GPU (mismo criterio que en el Venturi).
    if (pieceRef.current) {
      const key = runtime.radii.join(",");
      if (pieceRef.current.userData.key !== key) {
        pieceRef.current.userData.key = key;
        pieceRef.current.geometry.dispose();
        pieceRef.current.geometry = new THREE.LatheGeometry(
          buildProfile(runtime.radii),
          48,
        );
      }
    }

    if (ghostRef.current && ghostRef.current.userData.key !== piece.id) {
      ghostRef.current.userData.key = piece.id;
      ghostRef.current.geometry.dispose();
      ghostRef.current.geometry = new THREE.LatheGeometry(
        buildProfile(piece.radii),
        40,
      );
    }

    if (spinRef.current) spinRef.current.rotation.y = runtime.spin;

    if (profileRef.current) {
      const attr = profileRef.current.attributes
        .position as THREE.BufferAttribute;
      for (let i = 0; i <= PROFILE_SAMPLES; i += 1) {
        const t = i / PROFILE_SAMPLES;
        attr.setXYZ(
          i,
          PIECE_X + radiusAt(runtime.radii, t),
          BASE_Y + t * PIECE_HEIGHT,
          0,
        );
      }
      attr.needsUpdate = true;
    }

    // Las rebanadas: es lo único que cambia al elegir un método u otro, y es
    // exactamente lo que distingue a los dos. En DISCOS se corta la pieza en
    // tajadas horizontales (cada una un cilindro de radio r(h)); en CAPAS, en
    // tubos concéntricos, como los anillos de un tronco. El volumen que sale
    // es el mismo — que es la moraleja.
    if (slicesRef.current) {
      const maxRadius = Math.max(...runtime.radii);
      slicesRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;

        if (method === "capas" && i >= SHELLS) {
          mesh.visible = false;
          return;
        }

        const t =
          method === "discos" ? (i + 0.5) / SLICES : (i + 1) / (SHELLS + 1);
        material.opacity = method === "discos" ? DISC_OPACITY : SHELL_OPACITY;

        if (method === "discos") {
          const r = radiusAt(runtime.radii, t);
          mesh.position.set(0, BASE_Y + t * PIECE_HEIGHT, 0);
          mesh.scale.set(r, (PIECE_HEIGHT / SLICES) * 0.82, r);
          mesh.visible = true;
        } else {
          // Capas: un tubo por cada radio, cuya altura es hasta dónde llega
          // la pieza a ese radio. Se recorre el perfil buscando la altura
          // máxima con radio ≥ este: eso es, literalmente, el alto del tubo.
          const r = maxRadius * t;
          let top = 0;
          for (let s = 0; s <= PROFILE_SAMPLES; s += 1) {
            const h = s / PROFILE_SAMPLES;
            if (radiusAt(runtime.radii, h) >= r) top = h * PIECE_HEIGHT;
          }
          mesh.position.set(0, BASE_Y + top / 2, 0);
          mesh.scale.set(r, Math.max(top, 0.01), r);
          mesh.visible = top > 0.02;
        }
      });
    }
  });

  return (
    <group>
      {/* La pieza torneada, girando. */}
      <group ref={spinRef} position={[PIECE_X, BASE_Y, 0]}>
        <mesh ref={pieceRef} castShadow receiveShadow>
          <latheGeometry />
          <meshStandardMaterial
            color="#b9c3d1"
            metalness={0.55}
            roughness={0.3}
            envMapIntensity={1.2}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Rebanadas del método elegido, por fuera de la pieza y traslúcidas:
            se ven como cortes marcados sobre el sólido y no lo tapan. */}
        <group ref={slicesRef}>
          {Array.from({ length: SLICES }).map((_, i) => (
            <mesh key={i}>
              <cylinderGeometry args={[1, 1, 1, 28, 1, true]} />
              <meshStandardMaterial
                color="#f2a65a"
                emissive="#f2a65a"
                emissiveIntensity={0.22}
                transparent
                opacity={0.3}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* Eje de giro: la recta alrededor de la cual se revoluciona. Es el
          protagonista silencioso de la fórmula, y sin dibujarlo el alumno no
          tiene dónde "ver" el eje del que habla el enunciado. */}
      <mesh position={[PIECE_X, BASE_Y + PIECE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, PIECE_HEIGHT + 1.2, 8]} />
        <meshStandardMaterial
          color="#0b2b28"
          emissive="#2dd4bf"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>

      {/* El perfil r(h): la curva que, al girar, genera todo lo demás. */}
      <line>
        <bufferGeometry ref={profileRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[profilePositions, 3]}
            count={PROFILE_SAMPLES + 1}
          />
        </bufferGeometry>
        <lineBasicMaterial color={PROFILE_COLOR} toneMapped={false} />
      </line>

      {/* La pieza a igualar, al lado y traslúcida. */}
      <mesh ref={ghostRef} position={[GHOST_X, BASE_Y, 0]}>
        <latheGeometry />
        <meshStandardMaterial
          color="#2dd4bf"
          transparent
          opacity={0.28}
          roughness={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Bancadas: apoyan las dos piezas y dan la referencia de "mesa de
          taller" que hace que se lean como objetos y no como gráficos. */}
      {[PIECE_X, GHOST_X].map((x) => (
        <mesh key={x} position={[x, BASE_Y / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.15, 1.25, BASE_Y, 32]} />
          <meshStandardMaterial color="#39404d" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
