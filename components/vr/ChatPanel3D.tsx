"use client";

import { useState, type ReactNode } from "react";
import type { ChatMessage } from "@/components/tutor/useTutorSession";
import { useTutorHud, useTutorLog } from "@/lib/tutor/hudStore";
import { setChatOpen, useChatOpen } from "@/lib/tutor/chatPreference";
import { GazeButton } from "./GazeButton";
import { estimateLines } from "./VrCard";
import { VrText } from "./VrText";

export const CHAT_WIDTH = 1.1;
const TEXT_SIZE = 0.032;
const LINE = TEXT_SIZE * 1.25;
/** Alto disponible para los mensajes; lo que no entra se ve con "Ver anteriores". */
const BODY_HEIGHT = 0.95;

const COLOR: Record<ChatMessage["role"], string> = {
  user: "#93c5fd",
  tutor: "#e7ecf5",
  event: "#2dd4bf",
};

interface Shown {
  key: string;
  speaker: string | null;
  text: string;
  color: string;
}

function toShown(m: ChatMessage): Shown {
  const cut = m.state === "interrupted" ? " (cortado)" : "";
  return {
    key: String(m.id),
    speaker: m.role === "user" ? "TÚ" : m.role === "tutor" ? "TUTOR" : null,
    text: (m.text || (m.state === "streaming" ? "…" : "")) + cut,
    color: m.state === "error" ? "#e24b4a" : m.state === "interrupted" ? "#93a1be" : COLOR[m.role],
  };
}

/**
 * La conversación con el tutor en la vista VR, como un panel más: lo mismo
 * que la ventana desplegable de la PC. Minimizada queda solo la barra con
 * la cantidad de mensajes; desplegada muestra los últimos que entran, y con
 * "Ver anteriores" se recorre hacia atrás (no hay rueda del mouse).
 */
export function ChatPanel3D() {
  const log = useTutorLog();
  const { status, heard } = useTutorHud();
  const open = useChatOpen();
  /** Cuántos mensajes de los más recientes se saltean (0: se ve lo último). */
  const [offset, setOffset] = useState(0);

  const width = CHAT_WIDTH;
  const textWidth = width - 0.1;
  const left = -width / 2 + 0.05;
  const turns = log.filter((m) => m.role !== "event").length;

  const all: Shown[] = log.map(toShown);
  if (status === "listening" && heard) {
    all.push({ key: "escuchando", speaker: "TÚ", text: `${heard}…`, color: "#93a1be" });
  }

  // Desde el más reciente (menos lo salteado) hacia atrás, mientras entren.
  const end = Math.max(0, all.length - Math.min(offset, Math.max(0, all.length - 1)));
  const visible: Array<Shown & { height: number }> = [];
  let used = 0;
  for (let i = end - 1; i >= 0; i--) {
    const lines = Math.min(12, estimateLines(all[i].text, TEXT_SIZE, textWidth));
    const height = (all[i].speaker ? 0.04 : 0) + lines * LINE + 0.03;
    if (visible.length > 0 && used + height > BODY_HEIGHT) break;
    visible.unshift({ ...all[i], height });
    used += height;
  }
  const hiddenBefore = end - visible.length;
  const hiddenAfter = all.length - end;

  let y = 0;
  const items: ReactNode[] = [
    <VrText key="titulo" position={[left, y, 0]} fontSize={0.04} color="#93a1be">
      {`CONVERSACIÓN${turns > 0 ? ` (${turns})` : ""}`}
    </VrText>,
    <GazeButton
      key="abrir"
      label={open ? "Minimizar" : "Ver la conversación"}
      onSelect={() => setChatOpen(!open)}
      position={[width / 2 - 0.05 - (open ? 0.12 : 0.2), y, 0]}
      width={open ? 0.24 : 0.4}
      height={0.075}
      fontSize={0.028}
    />,
  ];
  y -= 0.09;

  if (open) {
    if (all.length === 0) {
      items.push(
        <VrText key="vacio" position={[left, y, 0]} anchorY="top" fontSize={TEXT_SIZE} color="#93a1be" maxWidth={textWidth}>
          Todavía no le has preguntado nada. Usa «Preguntar al tutor» (o el botón de hablar del control) y la
          conversación queda aquí.
        </VrText>,
      );
      y -= 0.16;
    } else {
      if (hiddenBefore > 0 || hiddenAfter > 0) {
        items.push(
          <GazeButton
            key="anteriores"
            label={`Ver anteriores (${hiddenBefore})`}
            onSelect={() => setOffset(offset + Math.max(1, visible.length))}
            position={[0, y, 0]}
            width={textWidth}
            height={0.07}
            fontSize={0.026}
            disabled={hiddenBefore === 0}
          />,
        );
        y -= 0.1;
      }
      visible.forEach((m) => {
        if (m.speaker) {
          items.push(
            <VrText key={`s-${m.key}`} position={[left, y, 0]} anchorY="top" fontSize={0.024} color={m.color}>
              {m.speaker}
            </VrText>,
          );
        }
        items.push(
          <VrText
            key={`t-${m.key}`}
            position={[left, y - (m.speaker ? 0.04 : 0), 0]}
            anchorY="top"
            fontSize={TEXT_SIZE}
            lineHeight={1.25}
            maxWidth={textWidth}
            color={m.speaker ? (m.color === COLOR.user ? "#c4cde0" : m.color) : m.color}
          >
            {m.text}
          </VrText>,
        );
        y -= m.height;
      });
      if (hiddenAfter > 0) {
        y -= 0.02;
        items.push(
          <GazeButton
            key="recientes"
            label={`Ver más recientes (${hiddenAfter})`}
            onSelect={() => setOffset(0)}
            position={[0, y - 0.035, 0]}
            width={textWidth}
            height={0.07}
            fontSize={0.026}
            primary
          />,
        );
        y -= 0.09;
      }
    }
  }

  const height = -y + 0.1;
  return (
    <group>
      <mesh position={[0, -height / 2 + 0.07, -0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#131b2e" transparent opacity={0.95} toneMapped={false} />
      </mesh>
      {items}
    </group>
  );
}
