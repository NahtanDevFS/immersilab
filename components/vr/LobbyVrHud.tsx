"use client";

import { Suspense, useEffect, useState } from "react";
import { readPad } from "@/components/shell/gamepad";
import { requestRecenter } from "@/lib/view/recenter";
import { resetPanelPlacements } from "@/lib/view/panelPlacement";
import { setCalibrating, useCalibrating } from "@/lib/view/visorSettings";
import { exitVr } from "@/lib/view/viewMode";
import { VisorCalibration } from "./VisorCalibration";
import { displayName, useSession } from "@/lib/progress/useSession";
import { GazeButton } from "./GazeButton";
import { SIDE_START, SidePanel, VrDashboard } from "./VrDashboard";
import { VrText } from "./VrText";
import { VrCard } from "./VrCard";

/**
 * Dos columnas: la ayuda a la izquierda (WIDTH) y los botones y la cuenta a
 * la derecha (ACTIONS_WIDTH). Antes iba todo en una sola, una debajo de la
 * otra, y la ventana quedaba tan alta que para leer el final había que bajar
 * mucho la cabeza.
 */
const WIDTH = 1.25;
const ACTIONS_WIDTH = 0.78;
const PANEL_WIDTH = WIDTH + ACTIONS_WIDTH;
const LINE = 0.075;
/**
 * Cuántos caracteres entran por renglón en la columna del texto (a 0.033 de
 * letra) y cuánto mide cada renglón extra: las filas largas ocupan más de una
 * línea y, con un alto fijo, se encimaban con la siguiente.
 */
const CHARS_PER_ROW = 46;
const EXTRA_ROW = 0.042;
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
  /** Abre una página que no es 3D (progreso, cuenta): sale del visor. */
  onOpenPage: (href: string) => void;
}) {
  const [pad, setPad] = useState(false);
  /**
   * Página que se quiere abrir (cuenta, progreso). No se abre de una: esas
   * páginas son HTML y necesitan teclado, así que sacan del visor, y antes
   * eso pasaba sin aviso. Se pregunta primero.
   */
  const [pending, setPending] = useState<{ href: string; label: string } | null>(null);
  const calibrating = useCalibrating();
  const { user } = useSession();

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
        ? "stick izquierdo; a fondo un momento para correr."
        : "hace falta un control. Si ya lo conectaste, presiona cualquier botón.",
    ],
    ["Elegir", pad ? "mira un botón y presiona A." : "mira un botón y toca la pantalla."],
    ["Entrar", "camina hasta una puerta y quédate mirándola un momento: cada una es un experimento."],
    ["Tutor", "adentro, mantén B mientras preguntas. A sin soltar B cancela; B lo calla mientras habla."],
    ["Paneles", "adentro, las pestañas de abajo los abren. Y (clic del stick derecho) los oculta; A sobre su barra de arriba los mueve."],
    ["Acercar", "mantén A (o el dedo) mirando un panel y se agranda para leerlo."],
    ["Altura", "stick derecho arriba o abajo te sube o te baja; centrar la vista vuelve a la altura de los ojos."],
    ["Centrar", "clic del stick izquierdo (o el botón de abajo) mira de nuevo al pasillo."],
  ];

  // La cuenta, como en el encabezado de la PC. Son páginas HTML: se abren
  // saliendo del visor.
  const accountButtons = [
    { href: "/progreso", label: "Mi progreso" },
    { href: "/cuenta", label: user ? "Mi cuenta" : "Ingresar" },
  ];
  const actionsX = PANEL_WIDTH / 2 - ACTIONS_WIDTH / 2;
  const buttonWidth = ACTIONS_WIDTH - 0.1;
  const accountWidth = (buttonWidth - 0.03 * (accountButtons.length - 1)) / accountButtons.length;

  const left = -PANEL_WIDTH / 2 + 0.05;
  const lineY: number[] = [];
  let linesEnd = -0.1;
  for (const [, text] of lines) {
    lineY.push(linesEnd);
    linesEnd -= LINE + (Math.ceil(text.length / CHARS_PER_ROW) - 1) * EXTRA_ROW;
  }
  const buttons = [
    { id: "recorrido", label: "Empezar el recorrido guiado", onSelect: onStartTour, primary: true },
    { id: "centrar", label: "Centrar la vista", onSelect: requestRecenter },
    { id: "acomodar", label: "Acomodar los paneles", onSelect: resetPanelPlacements },
    { id: "visor", label: "Ajustar el visor", onSelect: () => setCalibrating(true) },
    { id: "salir-visor", label: "Salir del visor", onSelect: () => void exitVr() },
  ];
  // Columna derecha: arranca a la altura de la primera fila de ayuda.
  const buttonsTop = -0.1;
  const accountTitleY = buttonsTop - buttons.length * BUTTON + 0.02;
  // El texto de la cuenta ocupa dos renglones en la columna angosta.
  const accountY = accountTitleY - 0.13;
  const height = Math.max(-linesEnd + 0.03, -accountY + 0.1) + 0.07;

  return (
    <Suspense fallback={null}>
      <VrDashboard intro="A tu derecha: cómo moverte y el recorrido guiado" hidden={calibrating || pending !== null}>
        <SidePanel id="lobby" side="right" angle={SIDE_START} width={PANEL_WIDTH} top={0.07}>
          <mesh position={[0, -height / 2 + 0.07, -0.01]}>
            <planeGeometry args={[PANEL_WIDTH, height]} />
            <meshBasicMaterial color="#131b2e" transparent opacity={0.95} toneMapped={false} />
          </mesh>
          {/* Separador entre las dos columnas. */}
          <mesh position={[PANEL_WIDTH / 2 - ACTIONS_WIDTH, -height / 2 + 0.05, -0.008]}>
            <planeGeometry args={[0.004, height - 0.08]} />
            <meshBasicMaterial color="#2a3550" toneMapped={false} />
          </mesh>
          <VrText position={[left, 0, 0]} fontSize={0.045} color="#93a1be">
            CÓMO MOVERTE
          </VrText>
          <VrText position={[actionsX - buttonWidth / 2, 0, 0]} fontSize={0.045} color="#93a1be">
            OPCIONES
          </VrText>
          {lines.map(([label, text], i) => (
            <group key={label} position={[0, lineY[i], 0]}>
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
              position={[actionsX, buttonsTop - i * BUTTON, 0]}
              width={buttonWidth}
              height={0.09}
              fontSize={0.032}
              primary={button.primary}
            />
          ))}
          <VrText
            position={[actionsX - buttonWidth / 2, accountTitleY, 0]}
            anchorY="top"
            fontSize={0.03}
            maxWidth={buttonWidth}
            color="#93a1be"
          >
            {user
              ? `Cuenta: ${displayName(user)} (se abre fuera del visor)`
              : "Invitado (la cuenta se abre fuera del visor)"}
          </VrText>
          {accountButtons.map((button, i) => (
            <GazeButton
              key={button.href}
              label={button.label}
              onSelect={() => setPending(button)}
              position={[actionsX - buttonWidth / 2 + accountWidth / 2 + i * (accountWidth + 0.03), accountY, 0]}
              width={accountWidth}
              height={0.085}
              fontSize={0.032}
            />
          ))}
        </SidePanel>
      </VrDashboard>
      <VisorCalibration />
      {pending ? (
        <VrCard
          eyebrow="Salir del visor"
          title={pending.label}
          sections={[
            {
              text:
                "Esta página no se puede usar dentro del visor: necesita el teclado del celular. " +
                "Si continúas, vas a salir del visor; para volver, toca Visor en el encabezado.",
            },
          ]}
          buttons={[
            { id: "cancelar", label: "Quedarme en el visor", onSelect: () => setPending(null), primary: true },
            {
              id: "continuar",
              label: "Continuar",
              onSelect: () => {
                const { href } = pending;
                setPending(null);
                onOpenPage(href);
              },
            },
          ]}
        />
      ) : null}
    </Suspense>
  );
}
