"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ExperimentEngine } from "@/types/module";
import { lobbyDoors } from "@/components/lobby/catalog";
import { EXPERIMENT_DEFINITIONS } from "@/components/modules/registry";
import { readPad } from "@/components/shell/gamepad";
import { isTouchDevice } from "@/lib/view/viewMode";
import { VoiceTutor } from "./VoiceTutor";

/**
 * El tutor en el lobby: para preguntar por los controles, qué experimento
 * elegir o cómo funciona el laboratorio, antes de entrar a una puerta.
 *
 * Es el mismo VoiceTutor de los experimentos, con un "motor" mínimo: no hay
 * escena que simular, así que `getState` solo cuenta qué aparato se está
 * usando. Todo lo fijo (controles y catálogo) va en las pistas, que se
 * mandan una vez por pregunta y no se acumulan en el historial: cada turno
 * del historial tiene un tope de 4000 caracteres (lib/tutor/protocol.ts) y
 * el catálogo en el contexto lo pasaba a la segunda pregunta.
 */

/** La primera frase de la descripción: el catálogo entero tiene que entrar en 3500. */
function shortDescription(description: string): string {
  const first = description.split(/[.:]/)[0].trim();
  return first.length > 110 ? `${first.slice(0, 107)}…` : first;
}

function lobbyHints(): string {
  const catalog = lobbyDoors
    .map((door) => {
      const slug = door.href.split("/").pop() ?? "";
      const description = EXPERIMENT_DEFINITIONS[slug]?.description ?? "";
      return `${door.name} (${door.disciplineName}): ${shortDescription(description)}`;
    })
    .join("; ");
  return (
    "Estás en el LOBBY, un pasillo con una puerta por experimento: aquí no hay experimento activo ni variables. " +
    "Ayuda con los controles, con qué experimento elegir según lo que el estudiante quiera practicar y con cómo funciona el laboratorio. " +
    "Si pregunta algo de un experimento en particular, dale una idea general y dile que adentro le puedes explicar con los valores. " +
    "Controles: mirar girando la cabeza (con el visor o el giroscopio) o arrastrando con el mouse o el dedo. " +
    "Caminar con el stick izquierdo, con W A S D o las flechas, o con el joystick de la pantalla en un celular sin control; " +
    "el stick a fondo un segundo, o Shift, corre. Subir y bajar la cámara con el stick derecho arriba o abajo, o con Q y E o la rueda del mouse. " +
    "Elegir o tocar con A (en el visor, mirando el botón; sin control, tocando la pantalla). " +
    "Hablar con el tutor: mantener B (o el gatillo derecho en un mando de Xbox, PlayStation o Switch) o el botón del micrófono, y soltarlo al terminar; " +
    "A sin soltar B cancela la pregunta y B lo calla mientras habla. Centrar la vista: clic del stick izquierdo o X. " +
    "En el visor, Y o el clic del stick derecho ocultan los paneles. " +
    "Entrar a un experimento: caminar hasta su puerta y quedarse mirándola un momento; al volver, se aparece frente a esa puerta. " +
    "Dentro de cada experimento, en el visor, abajo están las pestañas Variables, Retos, Resultado, Tutor y Menú; " +
    "una variable se cambia mirándola y moviendo el stick derecho a los lados, o con los botones menos y más para el ajuste fino. " +
    "Cada experimento tiene retos que quedan guardados; el progreso y la cuenta están en el botón de arriba (Mi progreso). " +
    "El botón Recorrido guiado lleva por nueve paradas de las cuatro áreas. " +
    "El control ImmersiLab funciona en Android y en computadora; en iPhone hay que usar un mando de Xbox, PlayStation o Switch. " +
    `Experimentos: ${catalog}.`
  );
}

/** Fijas (el catálogo no cambia mientras corre la app): se arman una vez. */
const LOBBY_HINTS = lobbyHints();

function describeDevice(vr: boolean): string {
  const pad = readPad();
  const input = pad
    ? pad.mapping === "ESP32"
      ? "el control ImmersiLab"
      : "un mando de consola"
    : isTouchDevice()
      ? "la pantalla táctil, sin control"
      : "teclado y mouse";
  return `${vr ? "visor" : "pantalla"}, con ${input}`;
}

export function LobbyTutor({ vr }: { vr: boolean }) {
  // `getState` se llama al preguntar, fuera del render: lee la vista de aquí.
  const vrRef = useRef(vr);
  useEffect(() => {
    vrRef.current = vr;
  }, [vr]);

  const engine = useMemo<ExperimentEngine>(
    () => ({
      init: () => {},
      update: () => {},
      reset: () => {},
      getState: () => ({
        experimentName: "Lobby de ImmersiLab",
        disciplineName: "General",
        variables: {},
        tutorNotes: {
          aparato: describeDevice(vrRef.current),
          experimentos: lobbyDoors.length,
        },
      }),
    }),
    [],
  );

  return <VoiceTutor engine={engine} hints={LOBBY_HINTS} />;
}
