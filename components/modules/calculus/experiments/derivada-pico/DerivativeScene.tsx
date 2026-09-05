"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import { getTrack } from "@/components/modules/calculus/shared/tracks";
import type { DerivativeEngine } from "./engine";

/*
 * Igual que en la suma de Riemann, la pista se estira siempre hasta ocupar el
 * mismo cajón del mundo. Acá importa además que la escala en X y en Y sea la
 * MISMA (`UNIFORM`): la pendiente que el jugador ve tiene que ser la
 * pendiente que marca el velocímetro. Estirar Y para que "se vea mejor"
 * mostraría una tangente que no es la de la función.
 */
const PLOT_WIDTH = 12;
const CURVE_SAMPLES = 400;
const TANGENT_HALF = 1.6;

const TRACK_COLOR = new THREE.Color(0.35, 2.4, 2.1);
const TANGENT_COLOR = new THREE.Color(2.6, 1.7, 0.6);

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function DerivativeScene({ engine, variables }: Props) {
  const derivative = engine as DerivativeEngine;

  const trackRef = useRef<THREE.BufferGeometry>(null);
  const tangentRef = useRef<THREE.BufferGeometry>(null);
  const carRef = useRef<THREE.Mesh>(null);
  const markersRef = useRef<THREE.Group>(null);

  // Los buffers se crean una vez y se pasan a la geometría; a partir de ahí
  // se escriben SIEMPRE a través del atributo (`setXYZ`) y no tocando el
  // array directamente: el compilador de React trata un valor memoizado como
  // inmutable, y además `setXYZ` es la vía que three espera.
  const trackPositions = useMemo(
    () => new Float32Array((CURVE_SAMPLES + 1) * 3),
    [],
  );
  const tangentPositions = useMemo(() => new Float32Array(2 * 3), []);

  useFixedTimestep((dt) => {
    derivative.update(dt, variables);
  });

  useFrame(() => {
    const runtime = derivative.getRuntime();
    const track = getTrack(variables.pista ?? "ondas");
    const amp = Number(variables.amplitud ?? 1);
    const [min, max] = track.domain;
    const scale = PLOT_WIDTH / (max - min);

    if (trackRef.current) {
      const attr = trackRef.current.attributes
        .position as THREE.BufferAttribute;
      for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
        const x = min + ((max - min) * i) / CURVE_SAMPLES;
        attr.setXYZ(i, (x - min) * scale, track.f(x, amp) * scale, 0);
      }
      attr.needsUpdate = true;
    }

    const carX = (runtime.x - min) * scale;
    const carY = runtime.y * scale;

    if (carRef.current) {
      carRef.current.position.set(carX, carY + 0.18, 0);
    }

    if (tangentRef.current) {
      // La tangente se dibuja con la pendiente REAL (dy/dx de la función),
      // que sobrevive al cambio de escala solo porque X e Y usan el mismo
      // factor. Se normaliza el vector para que la recta mida siempre lo
      // mismo en pantalla y no se estire en las partes empinadas.
      const m = runtime.slope;
      const len = Math.hypot(1, m);
      const dx = (TANGENT_HALF * 1) / len;
      const dy = (TANGENT_HALF * m) / len;
      const attr = tangentRef.current.attributes
        .position as THREE.BufferAttribute;
      attr.setXYZ(0, carX - dx, carY - dy, 0);
      attr.setXYZ(1, carX + dx, carY + dy, 0);
      attr.needsUpdate = true;
    }

    // Los picos solo se revelan DESPUÉS de frenar. Verlos antes convierte el
    // juego en "parar sobre la marca" y deja de enseñar nada sobre f'.
    if (markersRef.current) {
      markersRef.current.visible = runtime.phase === "frenado";
      if (markersRef.current.visible) {
        runtime.criticalPoints.forEach((cp, i) => {
          const marker = markersRef.current!.children[i];
          if (!marker) return;
          marker.position.set(
            (cp - min) * scale,
            track.f(cp, amp) * scale + 0.1,
            0,
          );
          marker.visible = true;
        });
        // Cada pista tiene una cantidad distinta de picos; los sobrantes del
        // pool se apagan en vez de recrear el grupo.
        for (
          let i = runtime.criticalPoints.length;
          i < markersRef.current.children.length;
          i += 1
        ) {
          markersRef.current.children[i].visible = false;
        }
      }
    }
  });

  return (
    <group position={[0, 0.15, 0]}>
      {/* La pista. */}
      <line>
        <bufferGeometry ref={trackRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[trackPositions, 3]}
            count={CURVE_SAMPLES + 1}
          />
        </bufferGeometry>
        <lineBasicMaterial color={TRACK_COLOR} toneMapped={false} />
      </line>

      {/* Recta tangente: gira con el vagón y es la lectura visual de f'(x). */}
      <line>
        <bufferGeometry ref={tangentRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[tangentPositions, 3]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color={TANGENT_COLOR} toneMapped={false} />
      </line>

      {/* Vagón. Esfera y no caja: una caja tendría que girar con la pendiente
          para no verse flotando, y eso compite visualmente con la tangente,
          que es la que tiene que llevarse la atención. */}
      <mesh ref={carRef} castShadow>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial
          color="#f2a65a"
          emissive="#f2a65a"
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Pool de marcas de picos, ocultas hasta que el jugador frena. */}
      <group ref={markersRef} visible={false}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} visible={false}>
            <torusGeometry args={[0.22, 0.045, 8, 20]} />
            <meshStandardMaterial
              color="#2dd4bf"
              emissive="#2dd4bf"
              emissiveIntensity={0.7}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
