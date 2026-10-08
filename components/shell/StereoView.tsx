"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { StereoEffect } from "three/examples/jsm/effects/StereoEffect.js";

/** Separación entre los ojos, en metros (la escena está en metros). */
const EYE_SEPARATION = 0.064;

/**
 * Campo visual vertical en la vista VR. Los lentes de un visor genérico
 * agrandan la imagen: con los 50–55° de la vista normal todo se ve como con
 * binoculares. Más abierto se siente a escala real.
 */
const VR_FOV = 75;

/**
 * Cambia el campo visual y devuelve el que tenía. Fuera del componente a
 * propósito: el compilador de React no deja mutar la cámara que devuelve un
 * hook, pero la cámara de three es un objeto que se muta por diseño.
 */
function applyFov(camera: THREE.Camera, fov: number): number {
  const perspective = camera as THREE.PerspectiveCamera;
  const previous = perspective.fov;
  perspective.fov = fov;
  perspective.updateProjectionMatrix();
  return previous;
}

/**
 * Dibuja la escena dos veces, lado a lado, con las cámaras separadas como
 * dos ojos. Es lo que hace YouTube en su vista para visor.
 *
 * Se monta SOLO en la vista VR: con prioridad 1, R3F deja de dibujar por su
 * cuenta y el que dibuja es este componente. Por lo mismo, el post-proceso
 * (que también toma el dibujo) tiene que estar apagado en esta vista.
 */
export function StereoView() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const effect = useMemo(() => {
    const stereo = new StereoEffect(gl);
    stereo.setEyeSeparation(EYE_SEPARATION);
    return stereo;
  }, [gl]);

  useEffect(() => {
    const previousFov = applyFov(camera, VR_FOV);
    return () => {
      applyFov(camera, previousFov);
      // El efecto deja el viewport en la mitad derecha: al volver a la vista
      // 360, sin esto se dibujaría solo en media pantalla.
      gl.setScissorTest(false);
      gl.setViewport(0, 0, size.width, size.height);
    };
  }, [camera, gl, size.width, size.height]);

  useFrame(({ scene, camera: current }) => {
    effect.render(scene, current);
  }, 1);

  return <GazeReticle />;
}

/**
 * Mira en el centro de la vista: un anillo chico que sigue a la cabeza, a
 * metro y medio. Sin ella, en el visor no hay referencia de hacia dónde se
 * está mirando exactamente. Se dibuja encima de todo (sin prueba de
 * profundidad) para que no se esconda detrás de una pared.
 */
function GazeReticle() {
  const ref = useRef<THREE.Mesh>(null);
  const forward = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    camera.getWorldDirection(forward);
    mesh.position.copy(camera.position).addScaledVector(forward, 1.5);
    mesh.quaternion.copy(camera.quaternion);
  });

  return (
    <mesh ref={ref} renderOrder={999} frustumCulled={false}>
      <ringGeometry args={[0.012, 0.02, 32]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.85}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
