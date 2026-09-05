"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import type { RiemannEngine } from "./engine";

/*
 * El experimento vive dentro de una "caja" fija del mundo: el intervalo [a,b]
 * siempre se estira hasta ocupar PLOT_WIDTH y la altura máxima de la función
 * siempre llega a PLOT_HEIGHT. Es decir, la escala del dibujo cambia con las
 * variables.
 *
 * Es a propósito: si el mapeo fuera fijo, cambiar de la parábola a la
 * exponencial (que llega a e²) dejaría a una de las dos como una rayita
 * pegada al piso. Lo que el alumno compara acá es la FORMA del error, no
 * cuántos metros mide la curva.
 *
 * El ancho y la posición coinciden con el target de la cámara del shell
 * (`OrbitControls target={[5, 1, 0]}`), así que la gráfica queda centrada al
 * entrar sin tocar el shell.
 */
const PLOT_WIDTH = 10;
const PLOT_HEIGHT = 4;
/** Profundidad de los bloques. Son cajas y no planos porque el punto de todo
 *  esto es caminar alrededor y ver el volumen que va quedando. */
const BAR_DEPTH = 1.2;
/** Tope de instancias del InstancedMesh. Tiene que ser ≥ el max del slider n:
 *  las instancias se reservan una vez y después solo se mueve la matriz. */
const MAX_BARS = 200;

const CURVE_COLOR = new THREE.Color(0.4, 2.6, 2.2);
const AXIS_COLOR = new THREE.Color(1.1, 1.1, 1.3);

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function RiemannScene({ engine, variables }: Props) {
  const riemann = engine as RiemannEngine;

  const barsRef = useRef<THREE.InstancedMesh>(null);
  const curveRef = useRef<THREE.BufferGeometry>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const curvePositions = useMemo(() => new Float32Array(241 * 3), []);

  useFixedTimestep((dt) => {
    riemann.update(dt, variables);
  });

  useFrame(() => {
    const runtime = riemann.getRuntime();
    const bars = runtime.bars;
    if (bars.length === 0) return;

    // Escalas del mapeo función → mundo. Se recalculan cada frame porque
    // dependen del intervalo y del techo de la función, que el alumno mueve.
    const a = bars[0].x0;
    const b = bars[bars.length - 1].x1;
    const sx = PLOT_WIDTH / Math.max(b - a, 1e-6);
    const sy = PLOT_HEIGHT / runtime.maxY;

    if (barsRef.current) {
      for (let i = 0; i < bars.length; i += 1) {
        const bar = bars[i];
        // Altura media del bloque: para los rectángulos es la altura a secas;
        // para el trapecio es el promedio de las dos puntas, o sea la caja
        // con el mismo área que el trapecio real. Dibujar el trapecio con su
        // cara inclinada pedía geometría propia por bloque y con n=200 eso es
        // un mesh nuevo por frame — el área, que es lo que se está sumando,
        // sale igual.
        const h = ((bar.yLeft + bar.yRight) / 2) * sy;
        dummy.position.set(
          (bar.x0 - a + (bar.x1 - bar.x0) / 2) * sx,
          h / 2,
          0,
        );
        // 0.985: deja una hendidura fina entre bloque y bloque. Sin ella, con
        // n grande la suma se ve como un bloque sólido y se pierde justo lo
        // que hay que ver, que son las tapas escalonadas contra la curva.
        dummy.scale.set((bar.x1 - bar.x0) * sx * 0.985, Math.max(h, 0.001), BAR_DEPTH);
        dummy.updateMatrix();
        barsRef.current.setMatrixAt(i, dummy.matrix);
      }
      barsRef.current.count = bars.length;
      barsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (curveRef.current) {
      const attr = curveRef.current.attributes
        .position as THREE.BufferAttribute;
      runtime.curve.forEach((p, i) => {
        // Z un pelo adelante de los bloques: en el mismo plano que la cara
        // frontal, la curva desaparece a tramos.
        attr.setXYZ(i, (p.x - a) * sx, p.y * sy, BAR_DEPTH / 2 + 0.02);
      });
      curveRef.current.setDrawRange(0, runtime.curve.length);
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Eje x: la base sobre la que se apoya el área. */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                0, 0.005, BAR_DEPTH / 2, PLOT_WIDTH + 0.6, 0.005, BAR_DEPTH / 2,
              ]),
              3,
            ]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color={AXIS_COLOR} toneMapped={false} />
      </line>

      {/* Eje y, en el borde izquierdo del intervalo. */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                0, 0, BAR_DEPTH / 2, 0, PLOT_HEIGHT + 0.6, BAR_DEPTH / 2,
              ]),
              3,
            ]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color={AXIS_COLOR} toneMapped={false} />
      </line>

      {/* Los bloques de la suma. Translúcidos a propósito: opacos taparían la
          curva y el alumno no vería el trozo que sobra o falta en cada uno,
          que es exactamente el error que el experimento mide. */}
      <instancedMesh
        ref={barsRef}
        args={[undefined, undefined, MAX_BARS]}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#f2a65a"
          transparent
          opacity={0.45}
          roughness={0.35}
          metalness={0.1}
          emissive="#f2a65a"
          emissiveIntensity={0.18}
          // Sin esto las caras traseras de un bloque tapan a las delanteras
          // del de atrás según el orden de dibujado, y la pila translúcida
          // titila al girar la cámara.
          depthWrite={false}
        />
      </instancedMesh>

      {/* La curva real, por delante de los bloques. */}
      <line>
        <bufferGeometry ref={curveRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[curvePositions, 3]}
            count={241}
          />
        </bufferGeometry>
        <lineBasicMaterial color={CURVE_COLOR} toneMapped={false} />
      </line>
    </group>
  );
}
