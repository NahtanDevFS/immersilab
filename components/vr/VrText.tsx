"use client";

import type { ComponentProps } from "react";
import { Text } from "@react-three/drei";

/**
 * Fuente local para el texto 3D. Sin ella, troika la pide a un servidor en
 * internet y sin conexión no se dibuja nada. Geist (SIL OFL) viene con Next;
 * se copió a public/fonts. Ver CREDITOS.md.
 */
export const VR_FONT = "/fonts/Geist-Regular.ttf";

/** Los pocos caracteres que la fuente no trae, por algo que sí. */
const MISSING: Array<[RegExp, string]> = [
  [/✓/g, "ok"],
  [/✕/g, "x"],
  [/β/g, "beta"],
  [/ᵢ/g, "i"],
];

export function vrSafe(text: string): string {
  return MISSING.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

type Props = Omit<ComponentProps<typeof Text>, "children" | "font"> & { children: string };

/** Texto dentro de la escena, para la vista VR: cada ojo lo ve en su imagen. */
export function VrText({ children, ...props }: Props) {
  return (
    <Text font={VR_FONT} anchorX="left" anchorY="middle" color="#e7ecf5" {...props}>
      {vrSafe(children)}
    </Text>
  );
}
