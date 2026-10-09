"use client";

import type { ReactNode } from "react";
import { BodyAnchor } from "./Anchors";
import { GazeButton } from "./GazeButton";
import { VrText } from "./VrText";

export interface VrCardSection {
  label?: string;
  text: string;
}

export interface VrCardButton {
  id: string;
  label: string;
  onSelect: () => void;
  primary?: boolean;
}

const WIDTH = 1.35;
const PADDING = 0.06;
const TEXT_SIZE = 0.036;
const LABEL_SIZE = 0.028;
const LINE = TEXT_SIZE * 1.25;
/** Ancho medio de un carácter de Geist, en fracciones del tamaño de letra. */
const CHAR_WIDTH = 0.52;

/**
 * Cuántos renglones ocupa un texto al partirse en `maxWidth`. Es una
 * estimación (troika parte por palabras y cada letra mide distinto), pero
 * alcanza para dimensionar el fondo: se redondea para arriba.
 */
export function estimateLines(text: string, fontSize: number, maxWidth: number): number {
  const perLine = Math.max(10, Math.floor(maxWidth / (fontSize * CHAR_WIDTH)));
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let current = 0;
    lines += 1;
    for (const word of words) {
      const next = current === 0 ? word.length : current + 1 + word.length;
      if (next > perLine && current > 0) {
        lines += 1;
        current = word.length;
      } else {
        current = next;
      }
    }
  }
  return lines;
}

/**
 * Tarjeta de lectura de la vista VR, adelante y a la altura de los ojos: la
 * explicación del experimento, la parada del recorrido, la ayuda del lobby.
 * Es el reemplazo 3D de las tarjetas HTML, que en el visor no se ven.
 *
 * Abajo, una fila de botones (Cerrar, Escuchar…), que se eligen con la mira.
 */
export function VrCard({
  eyebrow,
  title,
  sections,
  buttons,
  footer,
}: {
  eyebrow?: string;
  title: string;
  sections: VrCardSection[];
  buttons: VrCardButton[];
  footer?: ReactNode;
}) {
  const textWidth = WIDTH - 2 * PADDING;
  const left = -WIDTH / 2 + PADDING;

  let y = 0;
  const items: ReactNode[] = [];
  if (eyebrow) {
    items.push(
      <VrText key="eyebrow" position={[left, y, 0]} fontSize={LABEL_SIZE} color="#2dd4bf" anchorY="top">
        {eyebrow.toUpperCase()}
      </VrText>,
    );
    y -= LABEL_SIZE * 1.6;
  }
  items.push(
    <VrText key="title" position={[left, y, 0]} fontSize={0.05} color="#e7ecf5" anchorY="top" maxWidth={textWidth}>
      {title}
    </VrText>,
  );
  y -= 0.05 * 1.25 * estimateLines(title, 0.05, textWidth) + 0.03;

  sections.forEach((section, i) => {
    if (section.label) {
      items.push(
        <VrText key={`l-${i}`} position={[left, y, 0]} fontSize={LABEL_SIZE} color="#93a1be" anchorY="top">
          {section.label.toUpperCase()}
        </VrText>,
      );
      y -= LABEL_SIZE * 1.5;
    }
    items.push(
      <VrText
        key={`t-${i}`}
        position={[left, y, 0]}
        fontSize={TEXT_SIZE}
        color="#c4cde0"
        anchorY="top"
        maxWidth={textWidth}
        lineHeight={1.25}
      >
        {section.text}
      </VrText>,
    );
    y -= LINE * estimateLines(section.text, TEXT_SIZE, textWidth) + 0.03;
  });

  y -= 0.03;
  const buttonWidth = Math.min(0.42, (textWidth - 0.03 * (buttons.length - 1)) / Math.max(1, buttons.length));
  const rowWidth = buttons.length * buttonWidth + (buttons.length - 1) * 0.03;
  const buttonY = y - 0.05;
  buttons.forEach((button, i) => {
    items.push(
      <GazeButton
        key={`b-${button.id}`}
        label={button.label}
        onSelect={button.onSelect}
        position={[-rowWidth / 2 + buttonWidth / 2 + i * (buttonWidth + 0.03), buttonY, 0]}
        width={buttonWidth}
        height={0.09}
        fontSize={0.034}
        primary={button.primary}
      />,
    );
  });
  y = buttonY - 0.05;
  if (footer) {
    items.push(
      <group key="footer" position={[0, y - 0.03, 0]}>
        {footer}
      </group>,
    );
    y -= 0.08;
  }

  const height = -y + 2 * PADDING;
  return (
    <BodyAnchor>
      <group position={[0, 0.32, -1.6]}>
        <mesh position={[0, -height / 2 + PADDING, -0.01]}>
          <planeGeometry args={[WIDTH, height]} />
          <meshBasicMaterial color="#131b2e" transparent opacity={0.96} toneMapped={false} />
        </mesh>
        {items}
      </group>
    </BodyAnchor>
  );
}
