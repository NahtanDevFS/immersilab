"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import { registerGazeTarget } from "@/lib/view/gaze";

type Props = ComponentProps<"mesh"> & {
  /** Qué hace al apuntarlo con la mira y presionar A (o tocar la pantalla). */
  onGazeSelect: () => void;
};

/**
 * Un objeto de la escena que, además del clic de siempre, responde a la
 * mira de la vista VR. En el visor los clics de R3F no sirven (la imagen
 * está partida en dos), así que los objetos que se tocan en la escena
 * (enlaces, routers…) se registran también como blancos de la mira.
 */
export function GazeMesh({ onGazeSelect, ...props }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const latest = useRef(onGazeSelect);
  useEffect(() => {
    latest.current = onGazeSelect;
  });

  useEffect(() => {
    const object = mesh.current;
    if (!object) return;
    return registerGazeTarget(object, { onSelect: () => latest.current(), enabled: () => true });
  }, []);

  return <mesh ref={mesh} {...props} />;
}
