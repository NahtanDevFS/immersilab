"use client";

import type { ComponentProps } from "react";
import { Text } from "@react-three/drei";

/**
 * Fuente local para el texto 3D. Sin ella, troika la pide a un servidor en
 * internet y sin conexión no se dibuja nada. Geist (SIL OFL) viene con Next;
 * se copió a public/fonts. Ver CREDITOS.md.
 */
export const VR_FONT = "/fonts/Geist-Regular.ttf";

/**
 * Los caracteres que la fuente no trae, por algo que sí. Las letras griegas
 * y los subíndices aparecen en las fórmulas del tutor: sin esto se dibujaban
 * como cuadritos vacíos.
 */
const MISSING: Array<[RegExp, string]> = [
  [/✓/g, "ok"],
  [/✕/g, "x"],
  [/Δ/g, "∆"],
  [/⋅/g, "·"],
  [/α/g, "alfa"],
  [/β/g, "beta"],
  [/γ/g, "gamma"],
  [/δ/g, "delta"],
  [/ε/g, "épsilon"],
  [/η/g, "eta"],
  [/θ/g, "theta"],
  [/ρ/g, "rho"],
  [/σ/g, "sigma"],
  [/τ/g, "tau"],
  [/φ/g, "phi"],
  [/Σ/g, "∑"],
  [/ᵢ/g, "i"],
  [/ₙ/g, "n"],
  [/ⁿ/g, "^n"],
  [/⁻¹/g, "^-1"],
  [/⁻²/g, "^-2"],
  [/⁻/g, "^-"],
];

export function vrSafe(text: string): string {
  return MISSING.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

type Props = Omit<ComponentProps<typeof Text>, "children" | "font"> & { children: string };

/**
 * Grises de la interfaz, más claros en el texto 3D: a través de los lentes
 * de un visor, el gris sobre el fondo oscuro de los paneles se perdía.
 */
const BRIGHTER: Record<string, string> = {
  "#93a1be": "#cfd8ea",
  "#c4cde0": "#eef2fa",
  "#e7ecf5": "#ffffff",
};

/**
 * Texto dentro de la escena, para la vista VR: cada ojo lo ve en su imagen.
 *
 * Va "en negrita": un trazo del mismo color engrosa las letras (Geist solo
 * está en regular). Con los lentes de un visor genérico, la letra delgada
 * se desdibujaba y costaba distinguirla.
 */
export function VrText({ children, color = "#e7ecf5", ...props }: Props) {
  const fill = typeof color === "string" ? (BRIGHTER[color.toLowerCase()] ?? color) : color;
  return (
    <Text
      font={VR_FONT}
      anchorX="left"
      anchorY="middle"
      color={fill}
      strokeWidth="2.5%"
      strokeColor={fill}
      {...props}
    >
      {vrSafe(children)}
    </Text>
  );
}
