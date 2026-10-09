"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { readPad } from "@/components/shell/gamepad";
import { getGazed, isSelectHeld, registerGazeTarget } from "@/lib/view/gaze";
import {
  getDraggingPanel,
  getPanelPlacement,
  panelResetVersion,
  savePanelPlacement,
  setDraggingPanel,
  type PanelPlacement,
} from "@/lib/view/panelPlacement";
import { BodyAnchor, HeadAnchor } from "./Anchors";
import { VrText } from "./VrText";

/*
 * Los paneles de la vista VR van a los COSTADOS, fuera de la vista: mirando
 * al frente solo se ve la escena (el visor muestra unos ±37°, y los paneles
 * empiezan a 45°). Para usarlos se gira la cabeza, como con una mesa de
 * trabajo a cada lado: a la izquierda las variables, a la derecha los retos
 * y las acciones, y más a la derecha el resultado.
 *
 * Antes iban adelante (primero a la altura de los ojos, después abajo como
 * un atril) y, aun abajo, quedaban en la visión periférica y estorbaban.
 */
export const PANEL_DISTANCE = 1.3;
/** Altura por defecto del borde de arriba de los paneles, respecto de los ojos, m. */
export const PANEL_TOP = -0.15;
/** Un poco inclinados hacia atrás: el panel queda casi todo bajo los ojos. */
export const PANEL_TILT = -0.25;
export const PANEL_SCALE = 0.8;
/** Dónde empieza el primer panel de cada lado: el borde de la vista es ~37°. */
export const SIDE_START = 45;
/**
 * Los paneles siguen al cuerpo solo si uno se da vuelta del todo. Con el
 * límite de siempre (55°), girar la cabeza para mirar un panel lo empujaba
 * más lejos.
 */
const FOLLOW_LIMIT = (140 * Math.PI) / 180;

/** Botón que muestra u oculta los paneles: la Y de un control estándar, el
 *  clic del stick derecho en el ESP32 (ver gamepad.ts). */
const TOGGLE_BUTTON = 3;

/**
 * Tablero de la vista VR: los paneles de los costados (SidePanel), que
 * acompañan al cuerpo.
 *
 * Se muestra y se oculta con el botón Y (clic del stick derecho en el ESP32);
 * al ocultarlo aparece un aviso corto, para que no parezca que se perdió.
 * `hidden` lo oculta desde afuera, mientras hay una tarjeta para leer.
 *
 * `intro`: como los paneles quedan fuera de la vista, al empezar (cuando no
 * hay tarjeta) se avisa unos segundos dónde están.
 */
export function VrDashboard({
  children,
  hidden = false,
  intro,
}: {
  children: ReactNode;
  hidden?: boolean;
  intro?: string;
}) {
  const [visible, setVisible] = useState(true);
  const [hint, setHint] = useState<{ text: string; ms: number } | null>(null);
  const wasPressed = useRef(true);
  const introShown = useRef(false);

  useEffect(() => {
    if (hidden || !intro || introShown.current) return;
    introShown.current = true;
    const id = window.setTimeout(() => setHint({ text: intro, ms: 6000 }), 0);
    return () => window.clearTimeout(id);
  }, [hidden, intro]);

  useFrame(() => {
    const pressed = readPad()?.rawButtons[TOGGLE_BUTTON] ?? false;
    if (pressed && !wasPressed.current) {
      const next = !visible;
      setVisible(next);
      setHint(
        next
          ? null
          : { text: "Paneles ocultos: botón Y (clic del stick derecho) para mostrarlos", ms: 2500 },
      );
    }
    wasPressed.current = pressed;
  });

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), hint.ms);
    return () => window.clearTimeout(id);
  }, [hint]);

  return (
    <>
      <BodyAnchor followLimit={FOLLOW_LIMIT}>
        <group visible={visible && !hidden}>
          {children}
        </group>
      </BodyAnchor>
      {hint ? (
        <HeadAnchor>
          <VrText
            position={[0, -0.12, -1.6]}
            anchorX="center"
            fontSize={0.045}
            maxWidth={1.3}
            textAlign="center"
            color="#fbbf24"
            outlineWidth={0.003}
            outlineColor="#0b1220"
          >
            {hint.text}
          </VrText>
        </HeadAnchor>
      ) : null}
    </>
  );
}

const DEG = Math.PI / 180;

/** Cuántos grados ocupa a lo ancho un panel de `width` (unidades de panel). */
export function panelAngle(width: number): number {
  return (2 * Math.atan((width * PANEL_SCALE) / 2 / PANEL_DISTANCE)) / DEG;
}
/** Hasta dónde se puede llevar un panel (más allá, el cuerpo lo seguiría). */
const MAX_YAW = 130;
const MIN_PITCH = -55;
const MAX_PITCH = 35;
/** Alto de la barra para arrastrar, en unidades de panel. */
const HANDLE_HEIGHT = 0.065;

const HANDLE_IDLE = new THREE.Color("#26344e");
const HANDLE_GAZED = new THREE.Color("#3b4f74");
const HANDLE_DRAG = new THREE.Color("#f2a65a");

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Un panel alrededor del jugador, que se puede llevar a otro lugar.
 *
 * - `angle` (grados): dónde queda por defecto su borde de adentro, medido
 *   desde el frente; `width` (unidades de panel) sirve para calcular dónde
 *   queda su centro.
 * - Los hijos van centrados en x, con el borde de arriba cerca de y = 0.
 *
 * Arriba lleva una barra: mirándola y manteniendo A (o el dedo apoyado en la
 * pantalla), el panel sigue a la mira hasta soltar. El lugar se guarda en
 * este dispositivo (lib/view/panelPlacement.ts). Siempre queda mirando al
 * jugador, porque se mueve sobre una esfera a su alrededor.
 */
export function SidePanel({
  id,
  side,
  angle,
  width,
  top = 0.1,
  pitch,
  children,
}: {
  id: string;
  side: "left" | "right";
  angle: number;
  width: number;
  /** Dónde está el borde de arriba del panel (la barra va justo encima). */
  top?: number;
  /** Altura por defecto (grados sobre el horizonte); si no, un poco abajo. */
  pitch?: number;
  children: ReactNode;
}) {
  const s = side === "left" ? 1 : -1;
  const halfAngle = Math.atan((width * PANEL_SCALE) / 2 / PANEL_DISTANCE) / DEG;
  const defaults: PanelPlacement = {
    yaw: s * (angle + halfAngle),
    pitch: pitch ?? Math.atan(PANEL_TOP / PANEL_DISTANCE) / DEG,
  };

  const group = useRef<THREE.Group>(null);
  const handle = useRef<THREE.Mesh>(null);
  const handleMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const place = useRef<PanelPlacement | null>(null);
  const offset = useRef<PanelPlacement>({ yaw: 0, pitch: 0 });
  const heldBefore = useRef(true);
  const resetSeen = useRef(panelResetVersion());
  const work = useRef({ dir: new THREE.Vector3(), q: new THREE.Quaternion() });

  // La barra se puede mirar (no hace nada al tocarla: hay que mantener).
  useEffect(() => {
    const mesh = handle.current;
    if (!mesh) return;
    return registerGazeTarget(mesh, { onSelect: () => {}, enabled: () => true });
  }, []);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g || !g.parent) return;
    if (place.current === null || panelResetVersion() !== resetSeen.current) {
      resetSeen.current = panelResetVersion();
      place.current = { ...(getPanelPlacement(id) ?? defaults) };
    }
    const current = place.current;

    // Hacia dónde mira el jugador, en el marco del cuerpo (BodyAnchor).
    const { dir, q } = work.current;
    camera.getWorldDirection(dir);
    g.parent.getWorldQuaternion(q);
    dir.applyQuaternion(q.invert());
    const gazeYaw = Math.atan2(-dir.x, -dir.z) / DEG;
    const gazePitch = Math.asin(clamp(dir.y, -1, 1)) / DEG;

    const held = isSelectHeld();
    const gazed = getGazed() === handle.current;
    if (held && !heldBefore.current && gazed && getDraggingPanel() === null) {
      setDraggingPanel(id);
      offset.current = { yaw: current.yaw - gazeYaw, pitch: current.pitch - gazePitch };
    }
    const dragging = getDraggingPanel() === id;
    if (dragging) {
      if (held) {
        current.yaw = clamp(wrap(gazeYaw + offset.current.yaw), -MAX_YAW, MAX_YAW);
        current.pitch = clamp(gazePitch + offset.current.pitch, MIN_PITCH, MAX_PITCH);
      } else {
        setDraggingPanel(null);
        savePanelPlacement(id, { ...current });
      }
    }
    heldBefore.current = held;

    g.rotation.set(current.pitch * DEG, current.yaw * DEG, 0, "YXZ");
    handleMaterial.current?.color.copy(dragging ? HANDLE_DRAG : gazed ? HANDLE_GAZED : HANDLE_IDLE);
  });

  return (
    <group ref={group}>
      <group position={[0, 0, -PANEL_DISTANCE]} scale={PANEL_SCALE}>
        <group rotation={[PANEL_TILT, 0, 0]}>
          <mesh ref={handle} position={[0, top + HANDLE_HEIGHT / 2 + 0.008, -0.01]}>
            <planeGeometry args={[width, HANDLE_HEIGHT]} />
            <meshBasicMaterial ref={handleMaterial} color={HANDLE_IDLE} toneMapped={false} />
          </mesh>
          <VrText
            position={[0, top + HANDLE_HEIGHT / 2 + 0.008, 0]}
            anchorX="center"
            fontSize={0.026}
            color="#93a1be"
          >
            Para mover: mira esta barra, mantén A (o el dedo) y mira adonde quieras
          </VrText>
          {children}
        </group>
      </group>
    </group>
  );
}
