"use client";

import { Suspense, useEffect, useState } from "react";
import { readPad } from "@/components/shell/gamepad";
import { requestRecenter } from "@/lib/view/recenter";
import { resetPanelPlacements } from "@/lib/view/panelPlacement";
import { displayName, isStaff, useRole, useSession } from "@/lib/progress/useSession";
import { GazeButton } from "./GazeButton";
import { SIDE_START, SidePanel, VrDashboard } from "./VrDashboard";
import { VrText } from "./VrText";

const WIDTH = 1.25;
const LINE = 0.075;
const BUTTON = 0.11;

/**
 * La interfaz del lobby en la vista VR: el tutorial "¿Cómo me muevo?", el
 * botón del recorrido guiado y la cuenta son HTML y en el visor no se ven,
 * así que acá van como un panel a la derecha (se gira la cabeza para verlo;
 * al frente queda libre el pasillo). Se oculta con Y y se puede arrastrar,
 * como los de los experimentos.
 */
export function LobbyVrHud({
  onStartTour,
  onOpenPage,
}: {
  onStartTour: () => void;
  /** Abre una página que no es 3D (progreso, cuenta, vista docente): sale del visor. */
  onOpenPage: (href: string) => void;
}) {
  const [pad, setPad] = useState(false);
  const { user } = useSession();
  const { role } = useRole(user);

  // El control puede conectarse después de entrar: se revisa cada tanto.
  useEffect(() => {
    const read = () => setPad(readPad() !== null);
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, []);

  const lines: Array<[string, string]> = [
    ["Mirar", "gira la cabeza."],
    [
      "Caminar",
      pad
        ? "stick izquierdo del control."
        : "hace falta un control. Si ya lo conectaste, presiona cualquier botón.",
    ],
    ["Elegir", pad ? "mira un botón y presiona A." : "mira un botón y toca la pantalla."],
    ["Entrar", "camina hacia una puerta: cada una es un experimento."],
    ["Tutor", "adentro, mantén R2 (B en el control ImmersiLab) o usa el botón del panel."],
    ["Paneles", "Y (clic del stick derecho) los oculta; su barra de arriba los mueve."],
    ["Centrar", "clic del stick izquierdo (o el botón de abajo) mira de nuevo al pasillo."],
  ];

  // La cuenta, como en el encabezado de la PC. Son páginas HTML: se abren
  // saliendo del visor.
  const accountButtons = [
    ...(user && isStaff(role) ? [{ href: "/docente", label: "Vista docente" }] : []),
    { href: "/progreso", label: "Mi progreso" },
    { href: "/cuenta", label: user ? "Mi cuenta" : "Ingresar" },
  ];
  const accountWidth = (WIDTH - 0.1 - 0.03 * (accountButtons.length - 1)) / accountButtons.length;

  const left = -WIDTH / 2 + 0.05;
  const linesEnd = -0.1 - lines.length * LINE;
  const buttons = [
    { id: "recorrido", label: "Empezar el recorrido guiado", onSelect: onStartTour, primary: true },
    { id: "centrar", label: "Centrar la vista", onSelect: requestRecenter },
    { id: "acomodar", label: "Acomodar los paneles", onSelect: resetPanelPlacements },
  ];
  const accountTitleY = linesEnd - 0.03 - buttons.length * BUTTON;
  const accountY = accountTitleY - 0.08;
  const height = -accountY + 0.15;

  return (
    <Suspense fallback={null}>
      <VrDashboard intro="A tu derecha: cómo moverte y el recorrido guiado">
        <SidePanel id="lobby" side="right" angle={SIDE_START} width={WIDTH} top={0.07}>
          <mesh position={[0, -height / 2 + 0.07, -0.01]}>
            <planeGeometry args={[WIDTH, height]} />
            <meshBasicMaterial color="#131b2e" transparent opacity={0.95} toneMapped={false} />
          </mesh>
          <VrText position={[left, 0, 0]} fontSize={0.045} color="#93a1be">
            CÓMO MOVERTE
          </VrText>
          {lines.map(([label, text], i) => (
            <group key={label} position={[0, -0.1 - i * LINE, 0]}>
              <VrText position={[left, 0, 0]} fontSize={0.036} color="#2dd4bf">
                {label}
              </VrText>
              <VrText position={[left + 0.2, 0, 0]} fontSize={0.033} color="#c4cde0" maxWidth={WIDTH - 0.3}>
                {text}
              </VrText>
            </group>
          ))}
          {buttons.map((button, i) => (
            <GazeButton
              key={button.id}
              label={button.label}
              onSelect={button.onSelect}
              position={[0, linesEnd - 0.03 - i * BUTTON, 0]}
              width={WIDTH - 0.1}
              height={0.09}
              fontSize={0.036}
              primary={button.primary}
            />
          ))}
          <VrText position={[left, accountTitleY, 0]} fontSize={0.03} color="#93a1be">
            {user
              ? `Cuenta: ${displayName(user)} (se abre fuera del visor)`
              : "Invitado (la cuenta se abre fuera del visor)"}
          </VrText>
          {accountButtons.map((button, i) => (
            <GazeButton
              key={button.href}
              label={button.label}
              onSelect={() => onOpenPage(button.href)}
              position={[-WIDTH / 2 + 0.05 + accountWidth / 2 + i * (accountWidth + 0.03), accountY, 0]}
              width={accountWidth}
              height={0.085}
              fontSize={0.032}
            />
          ))}
        </SidePanel>
      </VrDashboard>
    </Suspense>
  );
}
