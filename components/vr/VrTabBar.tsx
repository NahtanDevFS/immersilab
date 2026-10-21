"use client";

import { GazeButton } from "./GazeButton";
import { VrText } from "./VrText";
import { PANEL_SCALE } from "./VrDashboard";

export type VrTab = "variables" | "retos" | "resultado" | "tutor" | "menu";

const TABS: Array<{ id: VrTab; label: string }> = [
  { id: "variables", label: "Variables" },
  { id: "retos", label: "Retos" },
  { id: "resultado", label: "Resultado" },
  { id: "tutor", label: "Tutor" },
  { id: "menu", label: "Menú" },
];

const DEG = Math.PI / 180;
/** Qué tan abajo va la fila de pestañas, grados bajo el horizonte: se ve bajando un poco la vista. */
const BAR_PITCH = -32;
/** La acción principal, un poco más abajo y centrada. */
const ACTION_PITCH = -40;
const BAR_DISTANCE = 1.35;
/**
 * Separación entre pestañas sobre el arco, grados. Con las cinco a 9.5° la
 * fila mide unos 47°: entra entera en la imagen de CADA ojo (con la acción
 * en la misma fila, un ojo no veía la primera y el otro la última).
 */
const STEP = 9.5;
const BUTTON_WIDTH = 0.19;

function ArcButton({
  yaw,
  pitch,
  label,
  onSelect,
  primary,
  disabled,
  width = BUTTON_WIDTH,
}: {
  yaw: number;
  pitch: number;
  label: string;
  onSelect: () => void;
  primary: boolean;
  disabled?: boolean;
  width?: number;
}) {
  return (
    <group rotation={[pitch * DEG, yaw * DEG, 0, "YXZ"]}>
      <group position={[0, 0, -BAR_DISTANCE]} scale={PANEL_SCALE}>
        <GazeButton
          label={label}
          onSelect={onSelect}
          width={width}
          height={0.08}
          fontSize={0.027}
          primary={primary}
          disabled={disabled}
        />
      </group>
    </group>
  );
}

/**
 * La barra de pestañas de la vista VR, abajo al frente, en arco: cada botón
 * queda mirando al jugador y todos entran en la vista sin girar la cabeza.
 * Mirar una pestaña y apretar A abre ese panel al frente (y cierra el que
 * estaba); otra vez sobre la misma, lo cierra. Debajo, la acción principal
 * del experimento (Lanzar, Soltar…), para no tener que abrir los retos cada
 * vez que se quiere disparar.
 */
export function VrTabBar({
  active,
  onSelect,
  action,
}: {
  active: VrTab | null;
  onSelect: (tab: VrTab) => void;
  action?: { label: string; onSelect: () => void; disabled?: boolean };
}) {
  const first = ((TABS.length - 1) * STEP) / 2;

  return (
    <group>
      <group rotation={[(BAR_PITCH + 4.5) * DEG, 0, 0]}>
        <VrText position={[0, 0, -BAR_DISTANCE]} anchorX="center" fontSize={0.026} color="#93a1be">
          Mira una pestaña y aprieta A · otra vez la cierra
        </VrText>
      </group>
      {TABS.map((tab, i) => (
        <ArcButton
          key={tab.id}
          yaw={first - i * STEP}
          pitch={BAR_PITCH}
          label={tab.label}
          onSelect={() => onSelect(tab.id)}
          primary={active === tab.id}
        />
      ))}
      {action ? (
        <ArcButton
          yaw={0}
          pitch={ACTION_PITCH}
          label={action.label}
          onSelect={action.onSelect}
          primary
          disabled={action.disabled}
          width={0.34}
        />
      ) : null}
    </group>
  );
}
