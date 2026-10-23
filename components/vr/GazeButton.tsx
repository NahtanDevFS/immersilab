"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getGazed, registerGazeTarget } from "@/lib/view/gaze";
import { useViewMode } from "@/lib/view/viewMode";
import { VrText } from "./VrText";

const BASE = new THREE.Color("#1d2a44");
const PRIMARY = new THREE.Color("#2dd4bf");
const HOVER = new THREE.Color("#f2a65a");
const DISABLED = new THREE.Color("#141c2e");
const FLASH = new THREE.Color("#ffffff");

/**
 * Lo que dura la respuesta al activarlo, s: se hunde un poco y destella. Hay
 * acciones que a veces no cambian nada en la escena (Soltar con una caja que
 * la fricción deja quieta), y sin esto no se sabía si el toque había llegado
 * o si el laboratorio se había trabado.
 */
const PRESS_SECONDS = 0.25;
const PRESS_SCALE = 0.9;

/**
 * La zona que se apunta es un poco más grande que el botón dibujado: con el
 * visor la cabeza nunca está quieta del todo, y entre dos botones vecinos
 * (el − y el + de una variable) quedaba un hueco de 2 cm donde la mira no
 * activaba nada. Con 1.2 cm por lado el hueco se cierra sin que las zonas
 * de dos botones vecinos se pisen.
 */
const HIT_MARGIN = 0.012;

interface Props {
  label: string;
  onSelect: () => void;
  position?: [number, number, number];
  width?: number;
  height?: number;
  fontSize?: number;
  disabled?: boolean;
  primary?: boolean;
}

/**
 * Botón de la vista VR: se apunta con la mira (se pone ámbar) y se activa
 * con A o tocando la pantalla. El color se cambia en cada cuadro sobre el
 * material, sin estado de React: lo que se mira cambia 60 veces por segundo.
 */
export function GazeButton({
  label,
  onSelect,
  position = [0, 0, 0],
  width = 0.5,
  height = 0.11,
  fontSize = 0.05,
  disabled = false,
  primary = false,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null); // la zona que se apunta
  const vr = useViewMode() === "vr";
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  /** Lo que se dibuja (no la zona que se apunta): es lo que se hunde. */
  const visual = useRef<THREE.Group>(null);
  /** Cuánto falta de la animación de apretado, s. */
  const press = useRef(0);
  // La última versión de las props, para el registro (que se hace una vez).
  const latest = useRef({ onSelect, disabled });
  useEffect(() => {
    latest.current = { onSelect, disabled };
  });
  const activate = useRef(() => {
    press.current = PRESS_SECONDS;
    latest.current.onSelect();
  });

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    return registerGazeTarget(mesh, {
      onSelect: () => activate.current(),
      enabled: () => !latest.current.disabled,
    });
  }, []);

  useFrame((_, dt) => {
    const material = materialRef.current;
    if (!material) return;
    const gazed = getGazed() === meshRef.current;
    material.color.copy(disabled ? DISABLED : gazed ? HOVER : primary ? PRIMARY : BASE);
    press.current = Math.max(0, press.current - dt);
    // 1 recién apretado, 0 al terminar: se hunde y destella de golpe y
    // vuelve suave.
    const k = press.current / PRESS_SECONDS;
    if (k > 0) material.color.lerp(FLASH, 0.6 * k);
    visual.current?.scale.setScalar(1 - (1 - PRESS_SCALE) * k);
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        // Marca de botón: sobre un botón, mantener A no activa la lupa.
        userData={{ gazeButton: true }}
        // También con el mouse o el dedo (fuera del visor): los botones 3D del
        // pizarrón se usan en la vista normal.
        onClick={(event) => {
          // En la vista VR un toque ya activa lo que marca la mira: si además
          // contara el clic, el mismo toque podría activar dos botones.
          if (vr) return;
          if (event.delta > 6) return; // fue un arrastre para mirar
          event.stopPropagation();
          if (!latest.current.disabled) activate.current();
        }}
      >
        <planeGeometry args={[width + HIT_MARGIN * 2, height + HIT_MARGIN * 2]} />
        {/* Invisible pero "visible" para three: un objeto con visible=false
            no se puede apuntar. */}
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <group ref={visual}>
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial ref={materialRef} color={BASE} transparent opacity={0.94} toneMapped={false} />
        </mesh>
        <VrText
          position={[0, 0, 0.004]}
          anchorX="center"
          fontSize={fontSize}
          maxWidth={width - 0.04}
          textAlign="center"
          color={disabled ? "#5d6b86" : primary ? "#052e2b" : "#e7ecf5"}
        >
          {label}
        </VrText>
      </group>
    </group>
  );
}
