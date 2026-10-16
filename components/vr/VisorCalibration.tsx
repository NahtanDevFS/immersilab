"use client";

import { Suspense } from "react";
import {
  MM_PER_CSS_PX,
  resetVisorSettings,
  setCalibrating,
  setVisorSettings,
  useCalibrating,
  useVisorSettings,
  VISOR_LIMITS,
  type VisorSettings,
} from "@/lib/view/visorSettings";
import { BodyAnchor } from "./Anchors";
import { GazeButton } from "./GazeButton";
import { VrText } from "./VrText";

const WIDTH = 1.15;
const ROW = 0.12;

const ROWS: Array<{ key: keyof VisorSettings; label: string; format: (v: number) => string }> = [
  {
    key: "lensSeparation",
    label: "Separación de los lentes",
    format: (v) => `${Math.round(v * MM_PER_CSS_PX)} mm aprox.`,
  },
  { key: "distortion", label: "Corrección de la curvatura", format: (v) => `${Math.round(v * 100)} %` },
  { key: "zoom", label: "Tamaño de la imagen", format: (v) => `${Math.round(v * 100)} %` },
  {
    key: "chroma",
    label: "Corrección de color",
    format: (v) => (v === 0 ? "sin corrección" : `${v > 0 ? "+" : ""}${Math.round(v * 250)}`),
  },
];

/**
 * Ajuste del visor (lib/view/visorSettings.ts), dentro del visor mismo: así
 * se ve el efecto de cada cambio a través de los lentes. Mientras está
 * abierto, StereoView dibuja una cuadrícula adelante:
 * 1. Separación: hasta que la cuadrícula se vea una sola y nítida.
 * 2. Curvatura: hasta que sus líneas se vean rectas hasta los bordes.
 * 3. Tamaño: a gusto, que no se vean bordes negros al mirar al frente.
 */
export function VisorCalibration() {
  const open = useCalibrating();
  const settings = useVisorSettings();
  if (!open) return null;

  const left = -WIDTH / 2 + 0.05;
  const height = 0.2 + ROWS.length * ROW + 0.32;

  return (
    <Suspense fallback={null}>
      <BodyAnchor>
        <group position={[0, -0.18, -1.3]}>
          <mesh position={[0, -height / 2 + 0.08, -0.01]}>
            <planeGeometry args={[WIDTH, height]} />
            <meshBasicMaterial color="#131b2e" transparent opacity={0.94} toneMapped={false} />
          </mesh>
          <VrText position={[left, 0.02, 0]} fontSize={0.042} color="#93a1be">
            AJUSTAR EL VISOR
          </VrText>
          <VrText position={[left, -0.045, 0]} fontSize={0.026} color="#c4cde0" maxWidth={WIDTH - 0.1}>
            Separación: la cuadrícula una sola. Curvatura: líneas rectas. Color: bordes sin halo rojo ni azul.
          </VrText>
          {ROWS.map((row, i) => {
            const y = -0.15 - i * ROW;
            const { step } = VISOR_LIMITS[row.key];
            const value = settings[row.key];
            return (
              <group key={row.key} position={[0, y, 0]}>
                <VrText position={[left, 0, 0]} fontSize={0.034} maxWidth={0.5}>
                  {row.label}
                </VrText>
                <VrText position={[0.2, 0, 0]} anchorX="center" fontSize={0.032} color="#2dd4bf">
                  {row.format(value)}
                </VrText>
                <GazeButton
                  label="-"
                  onSelect={() => setVisorSettings({ [row.key]: value - step })}
                  position={[0.39, 0, 0]}
                  width={0.1}
                  height={0.09}
                />
                <GazeButton
                  label="+"
                  onSelect={() => setVisorSettings({ [row.key]: value + step })}
                  position={[0.5, 0, 0]}
                  width={0.1}
                  height={0.09}
                />
              </group>
            );
          })}
          <GazeButton
            label="Restablecer"
            onSelect={resetVisorSettings}
            position={[-0.26, -0.15 - ROWS.length * ROW - 0.04, 0]}
            width={0.5}
            height={0.09}
            fontSize={0.034}
          />
          <GazeButton
            label="Listo"
            onSelect={() => setCalibrating(false)}
            position={[0.26, -0.15 - ROWS.length * ROW - 0.04, 0]}
            width={0.5}
            height={0.09}
            fontSize={0.034}
            primary
          />
        </group>
      </BodyAnchor>
    </Suspense>
  );
}
