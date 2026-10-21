"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getGazed, isSelectHeld, registerGazeTarget } from "@/lib/view/gaze";
import {
  getDraggingPanel,
  getPanelPlacement,
  panelResetVersion,
  savePanelPlacement,
  setDraggingPanel,
} from "@/lib/view/panelPlacement";
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
/** Dónde se guarda la altura de la barra (lib/view/panelPlacement.ts). */
const BAR_ID = "barra-pestanas";
/**
 * Altura por defecto de la fila de pestañas, grados bajo el horizonte: se
 * ve bajando un poco la vista. Se puede subir o bajar arrastrándola.
 */
const DEFAULT_PITCH = -36;
/**
 * Hasta dónde se puede llevar. Más arriba de −31° quedaba detrás de los
 * paneles abiertos (su borde de abajo llega a −26°).
 */
const MIN_PITCH = -62;
const MAX_PITCH = -31;
/** La acción principal va esto más abajo que las pestañas, centrada. */
const ACTION_BELOW = 8;
/** El texto de ayuda (y la franja para arrastrar), esto más arriba. */
const CAPTION_ABOVE = 4.5;
const BAR_DISTANCE = 1.35;
/**
 * Separación entre pestañas sobre el arco, grados. Con las cinco a 9.5° la
 * fila mide unos 47°: entra entera en la imagen de CADA ojo (con la acción
 * en la misma fila, un ojo no veía la primera y el otro la última).
 */
const STEP = 9.5;
const BUTTON_WIDTH = 0.19;

const HANDLE_IDLE = new THREE.Color("#1b2640");
const HANDLE_GAZED = new THREE.Color("#3b4f74");
const HANDLE_DRAG = new THREE.Color("#f2a65a");

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

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
 * Mirar una pestaña y apretar A abre ese panel (los demás siguen abiertos,
 * hasta tres, acomodados uno al lado del otro); otra vez sobre la misma, lo
 * cierra. Debajo, la acción principal del experimento (Lanzar, Soltar…),
 * para no tener que abrir los retos cada vez que se quiere disparar.
 *
 * Se sube o se baja manteniendo A sobre la franja del texto de ayuda (como
 * la barra de los paneles), para que estorbe lo menos posible a la vista.
 * La altura se guarda en el aparato; "Acomodar los paneles" la devuelve.
 */
export function VrTabBar({
  active,
  onSelect,
  action,
}: {
  /** Las pestañas con su panel abierto. */
  active: VrTab[];
  onSelect: (tab: VrTab) => void;
  action?: { label: string; onSelect: () => void; disabled?: boolean };
}) {
  const first = ((TABS.length - 1) * STEP) / 2;
  const [pitch, setPitch] = useState(() => getPanelPlacement(BAR_ID)?.pitch ?? DEFAULT_PITCH);
  const live = useRef(pitch);
  const grab = useRef(0);
  const heldBefore = useRef(true);
  const resetSeen = useRef(panelResetVersion());
  const handle = useRef<THREE.Mesh>(null);
  const handleMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const root = useRef<THREE.Group>(null);
  const work = useRef({ dir: new THREE.Vector3(), q: new THREE.Quaternion() });

  useEffect(() => {
    const mesh = handle.current;
    if (!mesh) return;
    return registerGazeTarget(mesh, { onSelect: () => {}, enabled: () => true });
  }, []);

  useFrame(({ camera }) => {
    const parent = root.current?.parent;
    if (!parent) return;
    if (panelResetVersion() !== resetSeen.current) {
      resetSeen.current = panelResetVersion();
      live.current = DEFAULT_PITCH;
      setPitch(DEFAULT_PITCH);
    }

    // Hacia dónde mira el jugador, en el marco del cuerpo (BodyAnchor).
    const { dir, q } = work.current;
    camera.getWorldDirection(dir);
    parent.getWorldQuaternion(q);
    dir.applyQuaternion(q.invert());
    const gazePitch = Math.asin(clamp(dir.y, -1, 1)) / DEG;

    const held = isSelectHeld();
    const gazed = getGazed() === handle.current;
    if (held && !heldBefore.current && gazed && getDraggingPanel() === null) {
      setDraggingPanel(BAR_ID);
      grab.current = gazePitch - live.current;
    }
    const dragging = getDraggingPanel() === BAR_ID;
    if (dragging) {
      if (held) {
        const next = clamp(gazePitch - grab.current, MIN_PITCH, MAX_PITCH);
        if (Math.abs(next - live.current) > 0.1) {
          live.current = next;
          setPitch(next);
        }
      } else {
        setDraggingPanel(null);
        savePanelPlacement(BAR_ID, { yaw: 0, pitch: live.current });
      }
    }
    heldBefore.current = held;
    handleMaterial.current?.color.copy(dragging ? HANDLE_DRAG : gazed ? HANDLE_GAZED : HANDLE_IDLE);
  });

  return (
    <group ref={root}>
      <group rotation={[(pitch + CAPTION_ABOVE) * DEG, 0, 0]}>
        <group position={[0, 0, -BAR_DISTANCE]} scale={PANEL_SCALE}>
          {/* La franja para arrastrar la barra, detrás del texto de ayuda. */}
          <mesh ref={handle} position={[0, 0, -0.005]}>
            <planeGeometry args={[0.95, 0.045]} />
            <meshBasicMaterial ref={handleMaterial} color={HANDLE_IDLE} transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <VrText anchorX="center" fontSize={0.022} color="#93a1be">
            Mira una pestaña y aprieta A · mantén A aquí para subir o bajar la barra
          </VrText>
        </group>
      </group>
      {TABS.map((tab, i) => (
        <ArcButton
          key={tab.id}
          yaw={first - i * STEP}
          pitch={pitch}
          label={tab.label}
          onSelect={() => onSelect(tab.id)}
          primary={active.includes(tab.id)}
        />
      ))}
      {action ? (
        <ArcButton
          yaw={0}
          pitch={pitch - ACTION_BELOW}
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
