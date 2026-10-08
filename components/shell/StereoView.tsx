"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { StereoEffect } from "three/examples/jsm/effects/StereoEffect.js";
import { readPad } from "./gamepad";
import { selectGazed, updateGaze } from "@/lib/view/gaze";

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

/** Un toque más largo o con más recorrido que esto es arrastrar, no tocar. */
const TAP_MAX_MS = 400;
const TAP_MAX_PX = 12;

/**
 * Mira en el centro de la vista: un anillo chico que sigue a la cabeza, a
 * metro y medio. Sin ella, en el visor no hay referencia de hacia dónde se
 * está mirando exactamente. Se dibuja encima de todo (sin prueba de
 * profundidad) para que no se esconda detrás de una pared.
 *
 * También es el "puntero" de la vista VR (lib/view/gaze.ts): cada cuadro
 * mira qué botón 3D queda al centro, y se agranda cuando hay uno. Se activa
 * con A en el control, tocando la pantalla (el botón de muchos visores
 * genéricos toca la pantalla) o con Enter en la compu.
 */
function GazeReticle() {
  const ref = useRef<THREE.Mesh>(null);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const canvas = useThree((state) => state.gl.domElement);
  const padWasPressed = useRef(true); // si ya venía apretado al entrar, no cuenta

  useEffect(() => {
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const tap =
        performance.now() - down.t < TAP_MAX_MS &&
        Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MAX_PX;
      down = null;
      if (tap) selectGazed();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") selectGazed();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [canvas]);

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    camera.getWorldDirection(forward);
    mesh.position.copy(camera.position).addScaledVector(forward, 1.5);
    mesh.quaternion.copy(camera.quaternion);

    const gazed = updateGaze(camera);
    mesh.scale.setScalar(gazed ? 1.8 : 1);

    // A del control: por flanco, una vez por apretón.
    const pressed = readPad()?.action ?? false;
    if (pressed && !padWasPressed.current) selectGazed();
    padWasPressed.current = pressed;
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
