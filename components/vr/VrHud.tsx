"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type {
  ChallengeStatus,
  ExperimentBriefing,
  ExperimentEngine,
  VariableDefinition,
  VariablesSchema,
  VariablesState,
  VrAction,
} from "@/types/module";
import { onChallengeCompleted } from "@/lib/tutor/events";
import {
  cancelTutor,
  hideTutorSubtitles,
  toggleTutor,
  setSubtitlesShown,
  useSubtitlesDismissed,
  useSubtitlesShown,
  useTutorHud,
} from "@/lib/tutor/hudStore";
import { resetPanelPlacements } from "@/lib/view/panelPlacement";
import { GUEST, completionKey } from "@/lib/progress/store";
import { useProgress } from "@/lib/progress/useSession";
import { useNarration } from "@/lib/narration/useNarration";
import { TOUR } from "@/lib/tour";
import { readPad } from "@/components/shell/gamepad";
import { formatLabel } from "@/components/shell/ResultPanel";
import { getGazed, registerGazeTarget } from "@/lib/view/gaze";
import { requestRecenter } from "@/lib/view/recenter";
import { HeadAnchor } from "./Anchors";
import { GazeButton } from "./GazeButton";
import { estimateLines, VrCard } from "./VrCard";
import { panelAngle, SIDE_START, SidePanel, VrDashboard } from "./VrDashboard";
import { CHAT_WIDTH, ChatPanel3D } from "./ChatPanel3D";
import { VrText } from "./VrText";

/** Stick derecho sobre una variable: recorre el rango entero en ~3 s a fondo. */
const STICK_RANGE_SECONDS = 3;
/** En las listas, cada cuánto pasa a la opción siguiente con el stick a fondo, s. */
const STICK_REPEAT = 0.35;
const STICK_THRESHOLD = 0.5;

const ROW = 0.115;
const COLUMN_WIDTH = 1.05;
/** Filas por columna del panel de variables: más alto que esto obliga a
 *  cabecear mucho, y con el visor eso cansa. */
const ROWS_PER_COLUMN = 7;

/** Ancho del panel del centro (resultados y botones generales). */
const CENTER_WIDTH = 1.0;
/** Espacio entre el panel del centro y los de los costados. */
/**
 * Dónde empieza el panel del resultado, a la derecha: después del de retos
 * y acciones (1.15 de ancho, unos 40° a 1.3 m) y un pequeño espacio.
 */
const RESULT_START = SIDE_START + 44;
/** Ancho del panel de retos y acciones. */
const CHALLENGES_WIDTH = 1.15;

interface Props {
  engine: ExperimentEngine;
  experimentSlug: string;
  experimentName: string;
  schema: VariablesSchema;
  values: VariablesState;
  onChange: (key: string, value: number | boolean | string) => void;
  vrActions?: (engine: ExperimentEngine) => VrAction[];
  /** Acciones que agrega el shell (p. ej. "Siguiente parada" del recorrido). */
  extraActions?: VrAction[];
  briefing?: ExperimentBriefing;
  /** La explicación abierta: es el mismo estado que el de la tarjeta HTML. */
  briefingOpen: boolean;
  onBriefingOpenChange: (open: boolean) => void;
  /** La parada del recorrido guiado, si se está en una. */
  tourIndex: number | null;
  onExitTour: () => void;
  onBackToLobby: () => void;
}

/**
 * La interfaz de un experimento en la vista VR, dentro de la escena: cada
 * ojo la ve en su imagen, que es lo que el HTML no puede hacer.
 *
 * Paneles a los costados, fuera de la vista al mirar al frente (VrDashboard):
 * - a la izquierda, las variables (− y +, < > en las listas, o el stick
 *   derecho mirando la fila);
 * - a la derecha, los retos y las acciones del experimento;
 * - más a la derecha, el resultado con su gráfica y los botones generales
 *   (explicación, tutor, centrar la vista, volver al lobby).
 *
 * Adelante, a la altura de los ojos, las tarjetas de lectura (la explicación
 * del experimento y la parada del recorrido). Pegados a la vista: el aviso
 * de reto logrado y el tutor.
 *
 * Todo se maneja con la mira (centro de la vista) y A, o tocando la pantalla.
 */
export function VrHud(props: Props) {
  const narration = useNarration();
  // La tarjeta de la parada se abre al llegar; "Ver el experimento" la cierra.
  const [tourCardOpen, setTourCardOpen] = useState(true);
  const stop = narration.stop;
  useEffect(() => stop, [stop]);

  const tourStop = props.tourIndex !== null ? TOUR[props.tourIndex] : undefined;
  const showTour = Boolean(tourStop) && tourCardOpen;
  const showBriefing = !showTour && Boolean(props.briefing) && props.briefingOpen;

  const listen = (text: string) =>
    narration.status === "speaking" ? narration.stop() : narration.speak(text);
  const listenLabel = narration.status === "speaking" ? "Detener" : "Escuchar";

  let card: ReactNode = null;
  if (showTour && tourStop && props.tourIndex !== null) {
    card = (
      <VrCard
        eyebrow={`Recorrido · ${props.tourIndex + 1} de ${TOUR.length}`}
        title={tourStop.name}
        sections={[{ text: tourStop.say }]}
        buttons={[
          {
            id: "ver",
            label: "Ver el experimento",
            primary: true,
            onSelect: () => {
              narration.stop();
              setTourCardOpen(false);
            },
          },
          ...(narration.status === "unsupported"
            ? []
            : [{ id: "escuchar", label: listenLabel, onSelect: () => listen(tourStop.say) }]),
          {
            id: "salir",
            label: "Salir del recorrido",
            onSelect: () => {
              narration.stop();
              props.onExitTour();
            },
          },
        ]}
      />
    );
  } else if (showBriefing && props.briefing) {
    const b = props.briefing;
    const script = [`${props.experimentName}.`, b.what, b.how, b.goal].join(" ");
    card = (
      <VrCard
        eyebrow="Cómo funciona"
        title={props.experimentName}
        sections={[
          { label: "Qué es", text: b.what },
          { label: "Qué haces", text: b.how },
          { label: "El reto", text: b.goal },
        ]}
        buttons={[
          {
            id: "cerrar",
            label: "Entendido",
            primary: true,
            onSelect: () => {
              narration.stop();
              props.onBriefingOpenChange(false);
            },
          },
          ...(narration.status === "unsupported"
            ? []
            : [{ id: "escuchar", label: listenLabel, onSelect: () => listen(script) }]),
          // Como el selector de voz de la tarjeta HTML: pasa a la siguiente.
          ...(narration.voices.length > 1
            ? [
                {
                  id: "voz",
                  label: "Cambiar la voz",
                  onSelect: () => {
                    const voices = narration.voices;
                    const i = voices.findIndex((v) => v.name === narration.voiceName);
                    const next = voices[(i + 1) % voices.length];
                    narration.setVoice(next.name);
                    narration.stop();
                  },
                },
              ]
            : []),
        ]}
        footer={
          narration.voiceName ? (
            <VrText anchorX="center" fontSize={0.026} color="#93a1be" maxWidth={1.2} textAlign="center">
              {`Voz: ${narration.voiceName}`}
            </VrText>
          ) : undefined
        }
      />
    );
  }

  return (
    // El texto 3D carga la fuente antes de dibujarse.
    <Suspense fallback={null}>
      <VrDashboard
        hidden={card !== null}
        intro="Gira la cabeza: a tu izquierda las variables y la conversación con el tutor; a tu derecha los retos y el resultado"
      >
        <SidePanel id="variables" side="left" angle={SIDE_START} width={variablesPanelWidth(props.schema)}>
          <VariablesPanel3D schema={props.schema} values={props.values} onChange={props.onChange} />
        </SidePanel>
        {/* La conversación con el tutor, a la izquierda, más allá de las variables. */}
        <SidePanel id="chat" side="left" {...chatPlacement(props.schema)} width={CHAT_WIDTH} top={0.07}>
          <ChatPanel3D />
        </SidePanel>
        <SidePanel id="retos" side="right" angle={SIDE_START} width={CHALLENGES_WIDTH} top={0.07}>
          <ChallengesAndActions {...props} />
        </SidePanel>
        <SidePanel id="resultado" side="right" angle={RESULT_START} width={CENTER_WIDTH} top={0.07}>
          <CenterPanel
            engine={props.engine}
            hasBriefing={Boolean(props.briefing)}
            onShowBriefing={() => {
              setTourCardOpen(false);
              props.onBriefingOpenChange(true);
            }}
            onBackToLobby={props.onBackToLobby}
          />
        </SidePanel>
      </VrDashboard>
      {card}
      <HeadAnchor>
        <ChallengeToast />
        <TutorSubtitles />
      </HeadAnchor>
    </Suspense>
  );
}

/* ------------------------------------------------------------------------ */
/* Centro: resultados y botones generales                                    */
/* ------------------------------------------------------------------------ */

/** Lo que muestra el panel del centro, leído del motor unas veces por segundo. */
interface CenterSnapshot {
  result: Array<[string, string]>;
  series: Array<{ x: number; y: number }>;
  pad: boolean;
}

const SPARK_WIDTH = CENTER_WIDTH - 0.1;
const SPARK_HEIGHT = 0.12;

function sparkPoints(series: Array<{ x: number; y: number }>): Array<[number, number, number]> {
  const xs = series.map((p) => p.x);
  const ys = series.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  return series.map((p) => [
    -SPARK_WIDTH / 2 + ((p.x - minX) / spanX) * SPARK_WIDTH,
    -SPARK_HEIGHT + ((p.y - minY) / spanY) * SPARK_HEIGHT,
    0,
  ]);
}

/**
 * El panel del centro: los resultados del experimento (lo mismo que el
 * cuadro "Resultado" de la PC, con su mini gráfica) y, abajo, los botones
 * que valen en cualquier experimento.
 */
function CenterPanel({
  engine,
  hasBriefing,
  onShowBriefing,
  onBackToLobby,
}: {
  engine: ExperimentEngine;
  hasBriefing: boolean;
  onShowBriefing: () => void;
  onBackToLobby: () => void;
}) {
  const [snapshot, setSnapshot] = useState<CenterSnapshot>({ result: [], series: [], pad: false });
  const tutor = useTutorHud();
  const subtitlesShown = useSubtitlesShown();

  useEffect(() => {
    const read = () => {
      const result = engine.getState().result ?? {};
      setSnapshot({
        result: Object.entries(result).map(([key, value]) => [formatLabel(key), String(value)]),
        series: engine.getSeries?.() ?? [],
        pad: readPad() !== null,
      });
    };
    read();
    const id = window.setInterval(read, 200);
    return () => window.clearInterval(id);
  }, [engine]);

  const width = CENTER_WIDTH;
  const left = -width / 2 + 0.05;
  const right = width / 2 - 0.05;
  let y = 0;
  const items: ReactNode[] = [];

  if (snapshot.result.length > 0) {
    items.push(
      <VrText key="titulo" position={[left, y, 0]} fontSize={0.045} color="#93a1be">
        RESULTADO
      </VrText>,
    );
    y -= 0.06;
    const labelWidth = width * 0.6;
    const valueWidth = width * 0.3;
    snapshot.result.forEach(([label, value]) => {
      // Algunas etiquetas son largas ("Tu período teórico pequeñas
      // oscilaciones"): la fila crece con los renglones en vez de encimarse.
      const lines = Math.max(estimateLines(label, 0.032, labelWidth), estimateLines(value, 0.034, valueWidth));
      items.push(
        <group key={`r-${label}`} position={[0, y, 0]}>
          <VrText position={[left, 0, 0]} anchorY="top" fontSize={0.032} color="#c4cde0" maxWidth={labelWidth}>
            {label}
          </VrText>
          <VrText position={[right, 0, 0]} anchorX="right" anchorY="top" fontSize={0.034} color="#2dd4bf" maxWidth={valueWidth} textAlign="right">
            {value}
          </VrText>
        </group>,
      );
      y -= 0.042 * lines + 0.018;
    });
    if (snapshot.series.length > 1) {
      y -= 0.02;
      items.push(
        <group key="grafica" position={[0, y, 0]}>
          <mesh position={[0, -SPARK_HEIGHT / 2, -0.002]}>
            <planeGeometry args={[SPARK_WIDTH + 0.02, SPARK_HEIGHT + 0.03]} />
            <meshBasicMaterial color="#0b1220" toneMapped={false} />
          </mesh>
          <Line points={sparkPoints(snapshot.series)} color="#f2a65a" lineWidth={2} />
        </group>,
      );
      y -= SPARK_HEIGHT + 0.05;
    }
    y -= 0.03;
  }

  // Botones generales, uno debajo del otro (el panel es angosto).
  const general: Array<{ id: string; label: string; onSelect: () => void; primary?: boolean }> = [];
  if (hasBriefing) general.push({ id: "explicacion", label: "Ver la explicación", onSelect: onShowBriefing });
  // El tutor, según en qué esté: lo mismo que se puede hacer con el botón
  // del micrófono y la ✕ de los subtítulos en la PC.
  if (tutor.status === "listening") {
    general.push({ id: "tutor", label: "Enviar la pregunta", onSelect: toggleTutor, primary: true });
    general.push({ id: "tutor-cancelar", label: "Cancelar la pregunta", onSelect: cancelTutor });
  } else if (tutor.status === "thinking") {
    general.push({ id: "tutor-cancelar", label: "Cancelar (el tutor está pensando)", onSelect: cancelTutor });
  } else if (tutor.status === "speaking") {
    general.push({ id: "tutor-cancelar", label: "Callar al tutor", onSelect: cancelTutor });
    general.push({ id: "tutor", label: "Preguntar otra cosa", onSelect: toggleTutor });
  } else {
    general.push({ id: "tutor", label: "Preguntar al tutor", onSelect: toggleTutor });
    if (subtitlesShown) {
      general.push({ id: "subtitulos", label: "Ocultar los subtítulos", onSelect: hideTutorSubtitles });
    }
  }
  // Con el giroscopio: vuelve a poner el experimento de frente.
  general.push({ id: "centrar", label: "Centrar la vista", onSelect: requestRecenter });
  general.push({ id: "acomodar", label: "Acomodar los paneles", onSelect: resetPanelPlacements });
  general.push({ id: "lobby", label: "Volver al lobby", onSelect: onBackToLobby });

  y -= 0.02;
  general.forEach((button) => {
    items.push(
      <GazeButton
        key={button.id}
        label={button.label}
        onSelect={button.onSelect}
        position={[0, y, 0]}
        width={width - 0.1}
        height={0.085}
        fontSize={0.034}
        primary={button.primary}
      />,
    );
    y -= 0.105;
  });

  // Qué está haciendo el tutor, aquí mismo: mirando este panel, el aviso
  // pegado a la vista puede quedar en el borde y pasar desapercibido.
  const tutorLine = tutor.note
    ? tutor.note
    : tutor.status === "listening"
      ? "Te escucho… habla y después toca «Enviar la pregunta»."
      : tutor.status === "thinking"
        ? "El tutor está pensando…"
        : tutor.status === "speaking"
          ? "El tutor está respondiendo (subtítulos abajo, al frente)."
          : null;
  if (tutorLine) {
    items.push(
      <VrText
        key="tutor-estado"
        position={[0, y + 0.02, 0]}
        anchorX="center"
        fontSize={0.03}
        maxWidth={width - 0.1}
        textAlign="center"
        color={tutor.note ? "#fbbf24" : tutor.status === "listening" ? "#60a5fa" : "#f2a65a"}
      >
        {tutorLine}
      </VrText>,
    );
    y -= 0.07;
  }

  items.push(
    <VrText
      key="control"
      position={[0, y + 0.01, 0]}
      anchorX="center"
      fontSize={0.026}
      maxWidth={width - 0.1}
      textAlign="center"
      color={snapshot.pad ? "#34d399" : "#93a1be"}
    >
      {snapshot.pad
        ? "Y oculta los paneles · clic del stick izquierdo centra la vista"
        : "Sin control: mira un botón y toca la pantalla"}
    </VrText>,
  );
  y -= 0.06;

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

/* ------------------------------------------------------------------------ */
/* Variables                                                                 */
/* ------------------------------------------------------------------------ */

type Row =
  | { kind: "group"; label: string }
  | { kind: "variable"; key: string; def: VariableDefinition };

function formatNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * Cuánto mueve cada toque de − o +. El paso del slider es muy fino para esto
 * (0.01 en un rango de 0 a 1 serían cien toques): se usa más o menos un
 * cuarentavo del rango, redondeado a un múltiplo del paso original.
 */
function increment(def: VariableDefinition): number {
  const step = def.step ?? 0.1;
  const range = (def.max ?? 100) - (def.min ?? 0);
  return Math.max(step, Math.round(range / 40 / step) * step);
}

/**
 * Dónde va la conversación: a la izquierda, después de las variables. Si las
 * variables ocupan dos columnas, eso quedaría casi a la espalda: entonces va
 * encima de las variables.
 */
function chatPlacement(schema: VariablesSchema): { angle: number; pitch?: number } {
  const variables = panelAngle(variablesPanelWidth(schema));
  const after = SIDE_START + variables + 4;
  if (after + panelAngle(CHAT_WIDTH) <= 125) return { angle: after };
  return { angle: SIDE_START + variables / 2 - panelAngle(CHAT_WIDTH) / 2, pitch: 32 };
}

/** Las filas del panel de variables (con los títulos de grupo) en columnas. */
function variableColumns(schema: VariablesSchema): Row[][] {
  const rows: Row[] = [];
  let lastGroup: string | undefined;
  Object.entries(schema).forEach(([key, def]) => {
    if (def.group && def.group !== lastGroup) rows.push({ kind: "group", label: def.group });
    lastGroup = def.group;
    rows.push({ kind: "variable", key, def });
  });
  const columns: Row[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_COLUMN) columns.push(rows.slice(i, i + ROWS_PER_COLUMN));
  return columns;
}

function variablesPanelWidth(schema: VariablesSchema): number {
  return Math.max(1, variableColumns(schema).length) * COLUMN_WIDTH + 0.06;
}

function VariablesPanel3D({
  schema,
  values,
  onChange,
}: Pick<Props, "schema" | "values" | "onChange">) {
  const columns = variableColumns(schema);
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const width = variablesPanelWidth(schema);
  const height = tallest * ROW + 0.2;

  return (
    <group>
      <mesh position={[0, -height / 2 + 0.1, -0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#131b2e" transparent opacity={0.95} toneMapped={false} />
      </mesh>
      <VrText position={[-width / 2 + 0.05, 0.03, 0]} fontSize={0.045} color="#93a1be">
        VARIABLES
      </VrText>
      <VrText position={[width / 2 - 0.05, 0.03, 0]} anchorX="right" fontSize={0.028} color="#fbbf24">
        Mira una y mueve el stick derecho
      </VrText>
      {columns.map((column, c) => (
        <group key={c} position={[-width / 2 + 0.03 + COLUMN_WIDTH * (c + 0.5), -0.07, 0]}>
          {column.map((row, r) => (
            <group key={row.kind === "group" ? `g-${row.label}` : row.key} position={[0, -r * ROW, 0]}>
              {row.kind === "group" ? (
                <VrText position={[-COLUMN_WIDTH / 2 + 0.04, 0, 0]} fontSize={0.04} color="#2dd4bf">
                  {row.label.toUpperCase()}
                </VrText>
              ) : (
                <VariableRow def={row.def} value={values[row.key]} onChange={(v) => onChange(row.key, v)} />
              )}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** ¿El objeto mirado está dentro de este grupo (la fila o uno de sus botones)? */
function gazeInside(group: THREE.Object3D | null): boolean {
  for (let o = getGazed(); o; o = o.parent) if (o === group) return true;
  return false;
}

const ROW_IDLE = new THREE.Color("#131b2e");
const ROW_FOCUS = new THREE.Color("#22314f");

function setRowColor(material: THREE.MeshBasicMaterial | null, focused: boolean) {
  if (material) material.color.copy(focused ? ROW_FOCUS : ROW_IDLE);
}

/**
 * Una variable, con su fondo de fila: mirarla la resalta, y con el stick
 * derecho se ajusta sin tener que tocar − o + una y otra vez.
 */
function VariableRow(props: {
  def: VariableDefinition;
  value: number | boolean | string | undefined;
  onChange: (value: number | boolean | string) => void;
}) {
  const { def, value, onChange } = props;
  const group = useRef<THREE.Group>(null);
  const background = useRef<THREE.Mesh>(null);
  const backgroundMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  /** Cambio pendiente del stick (números) y espera para la próxima opción (listas). */
  const stick = useMemo(() => ({ pending: 0, cooldown: 0, last: 0 }), []);

  // El fondo de la fila también se puede mirar (no solo los botones).
  useEffect(() => {
    const mesh = background.current;
    if (!mesh) return;
    return registerGazeTarget(mesh, { onSelect: () => {}, enabled: () => true });
  }, []);

  useFrame((_, dt) => {
    const focused = gazeInside(group.current);
    setRowColor(backgroundMaterial.current, focused);
    const x = focused ? (readPad()?.right.x ?? 0) : 0;
    applyStick(latest.current, stick, x, dt);
  });

  return (
    <group ref={group}>
      <mesh ref={background} position={[0, 0, -0.004]}>
        <planeGeometry args={[COLUMN_WIDTH - 0.02, ROW - 0.012]} />
        <meshBasicMaterial ref={backgroundMaterial} color={ROW_IDLE} toneMapped={false} />
      </mesh>
      <VariableRowContent def={def} value={value} onChange={onChange} />
    </group>
  );
}

/**
 * El stick sobre una variable. Fuera del componente porque muta el estado
 * del stick (un objeto de useMemo), y el compilador de React no deja hacerlo
 * adentro.
 */
function applyStick(
  props: { def: VariableDefinition; value: number | boolean | string | undefined; onChange: (v: number | boolean | string) => void },
  stick: { pending: number; cooldown: number; last: number },
  x: number,
  dt: number,
) {
  const { def, value, onChange } = props;
  stick.cooldown = Math.max(0, stick.cooldown - dt);
  if (Math.abs(x) < STICK_THRESHOLD * 0.4) {
    stick.pending = 0;
    stick.cooldown = 0;
    return;
  }

  if (def.type === "number") {
    const min = def.min ?? 0;
    const max = def.max ?? 100;
    const step = def.step ?? 0.1;
    // Con el stick a fondo, el rango entero en unos segundos; poco empuje, lento.
    stick.pending += (x * Math.abs(x) * (max - min) * dt) / STICK_RANGE_SECONDS;
    if (Math.abs(stick.pending) >= step) {
      const steps = Math.trunc(stick.pending / step);
      stick.pending -= steps * step;
      const current = Number(value ?? def.default);
      const next = Math.min(max, Math.max(min, current + steps * step));
      onChange(Number((Math.round(next / step) * step).toFixed(6)));
    }
    return;
  }

  if (Math.abs(x) < STICK_THRESHOLD || stick.cooldown > 0) return;
  const direction = Math.sign(x);
  stick.cooldown = STICK_REPEAT;
  if (def.type === "boolean") {
    onChange(direction > 0);
    return;
  }
  const options = def.options ?? [];
  if (options.length === 0) return;
  const index = Math.max(0, options.findIndex((o) => o.value === String(value)));
  onChange(options[(index + direction + options.length) % options.length].value);
}

function VariableRowContent({
  def,
  value,
  onChange,
}: {
  def: VariableDefinition;
  value: number | boolean | string | undefined;
  onChange: (value: number | boolean | string) => void;
}) {
  const left = -COLUMN_WIDTH / 2 + 0.04;

  if (def.type === "select") {
    const options = def.options ?? [];
    const index = Math.max(0, options.findIndex((o) => o.value === String(value)));
    const go = (delta: number) =>
      onChange(options[(index + delta + options.length) % options.length].value);
    return (
      <>
        <VrText position={[left, 0, 0]} fontSize={0.038} maxWidth={0.36}>
          {def.label}
        </VrText>
        <GazeButton label="<" onSelect={() => go(-1)} position={[-0.07, 0, 0]} width={0.09} height={0.09} />
        <VrText position={[0.2, 0, 0]} anchorX="center" fontSize={0.032} maxWidth={0.34} textAlign="center" color="#2dd4bf">
          {options[index]?.label ?? String(value)}
        </VrText>
        <GazeButton label=">" onSelect={() => go(1)} position={[0.44, 0, 0]} width={0.09} height={0.09} />
      </>
    );
  }

  if (def.type === "boolean") {
    return (
      <>
        <VrText position={[left, 0, 0]} fontSize={0.038} maxWidth={0.6}>
          {def.label}
        </VrText>
        <GazeButton
          label={value ? "Sí" : "No"}
          onSelect={() => onChange(!value)}
          position={[0.38, 0, 0]}
          width={0.18}
          height={0.09}
          primary={Boolean(value)}
        />
      </>
    );
  }

  const min = def.min ?? 0;
  const max = def.max ?? 100;
  const current = Number(value ?? def.default);
  const delta = increment(def);
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    // Redondeo al paso: sumar 0.1 muchas veces acumula errores (0.30000004).
    const step = def.step ?? 0.1;
    onChange(Number((Math.round(clamped / step) * step).toFixed(6)));
  };

  return (
    <>
      <VrText position={[left, 0, 0]} fontSize={0.038} maxWidth={0.46}>
        {def.label}
      </VrText>
      <VrText position={[0.18, 0, 0]} anchorX="center" fontSize={0.042} color="#2dd4bf">
        {`${formatNumber(current)}${def.unit ? ` ${def.unit}` : ""}`}
      </VrText>
      <GazeButton label="-" onSelect={() => set(current - delta)} position={[0.34, 0, 0]} width={0.1} height={0.09} disabled={current <= min} />
      <GazeButton label="+" onSelect={() => set(current + delta)} position={[0.46, 0, 0]} width={0.1} height={0.09} disabled={current >= max} />
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Retos y acciones                                                          */
/* ------------------------------------------------------------------------ */

function ChallengesAndActions({ engine, experimentSlug, vrActions, extraActions = [] }: Props) {
  const progress = useProgress();
  const [snapshot, setSnapshot] = useState<{ challenges: ChallengeStatus[]; actions: VrAction[] }>(
    { challenges: [], actions: [] },
  );

  // Se lee del motor unas veces por segundo, como el HUD HTML: no hace falta
  // a 60 cuadros, y así no hay estado de React cambiando en cada uno.
  useEffect(() => {
    const read = () =>
      setSnapshot({
        challenges: engine.getChallenges?.() ?? [],
        actions: vrActions?.(engine) ?? [],
      });
    read();
    const id = window.setInterval(read, 200);
    return () => window.clearInterval(id);
  }, [engine, vrActions]);

  const width = CHALLENGES_WIDTH;
  const left = -width / 2 + 0.05;
  const saved = (id: string) => Boolean(progress.completions[completionKey(experimentSlug, id)]);
  const challenges = snapshot.challenges;
  const done = challenges.filter((c) => c.done || saved(c.id)).length;
  const actions = [...snapshot.actions, ...extraActions];

  let y = 0;
  const items: ReactNode[] = [];

  if (challenges.length > 0) {
    items.push(
      <VrText key="titulo-retos" position={[left, y, 0]} fontSize={0.045} color="#93a1be">
        {`RETOS ${done}/${challenges.length}`}
      </VrText>,
    );
    y -= 0.1;
    challenges.forEach((c) => {
      const isDone = c.done || saved(c.id);
      const fill = Math.min(1, Math.max(0, isDone ? 1 : c.progress));
      items.push(
        <group key={`reto-${c.id}`} position={[0, y, 0]}>
          <mesh position={[left + 0.02, 0, 0]}>
            <planeGeometry args={[0.04, 0.04]} />
            <meshBasicMaterial color={isDone ? "#34d399" : "#26344e"} toneMapped={false} />
          </mesh>
          <VrText position={[left + 0.07, 0, 0]} fontSize={0.04} maxWidth={width - 0.16} color={isDone ? "#e7ecf5" : "#c4cde0"}>
            {c.title.replace(/ ←$/, "")}
          </VrText>
          <VrText position={[left + 0.07, -0.05, 0]} fontSize={0.028} maxWidth={width - 0.16} color="#93a1be" anchorY="top">
            {isDone && !c.done ? "Ya lo lograste antes." : c.detail}
          </VrText>
          <mesh position={[left + 0.07 + (width - 0.16) / 2, -0.135, 0]}>
            <planeGeometry args={[width - 0.16, 0.012]} />
            <meshBasicMaterial color="#26344e" toneMapped={false} />
          </mesh>
          <mesh
            position={[left + 0.07 + ((width - 0.16) * fill) / 2, -0.135, 0.001]}
            scale={[Math.max(0.0001, fill), 1, 1]}
          >
            <planeGeometry args={[width - 0.16, 0.012]} />
            <meshBasicMaterial color={isDone ? "#34d399" : "#2dd4bf"} toneMapped={false} />
          </mesh>
        </group>,
      );
      y -= 0.19;
    });
  }

  // Lo mismo que el panel de retos de la PC: reiniciarlos (si el
  // experimento lo permite y hay alguno logrado en esta visita) y el aviso
  // de que sin cuenta el progreso queda solo en este dispositivo.
  if (engine.resetChallenges && challenges.some((c) => c.done)) {
    items.push(
      <GazeButton
        key="reiniciar-retos"
        label="Reiniciar los retos"
        onSelect={() => engine.resetChallenges?.()}
        position={[0, y + 0.02, 0]}
        width={width - 0.1}
        height={0.08}
        fontSize={0.032}
      />,
    );
    y -= 0.1;
  }
  if (challenges.length > 0 && progress.owner === GUEST) {
    items.push(
      <VrText
        key="invitado"
        position={[left, y + 0.02, 0]}
        fontSize={0.026}
        maxWidth={width - 0.1}
        color="#93a1be"
      >
        Sin cuenta, tu progreso se guarda solo en este dispositivo. Para ingresar, sal del visor.
      </VrText>,
    );
    y -= 0.08;
  }

  if (actions.length > 0) {
    y -= 0.02;
    items.push(
      <VrText key="titulo-acciones" position={[left, y, 0]} fontSize={0.045} color="#93a1be">
        ACCIONES
      </VrText>,
    );
    y -= 0.1;
    actions.forEach((action) => {
      if (action.info) {
        items.push(
          <VrText key={`a-${action.id}`} position={[left, y, 0]} fontSize={0.034} maxWidth={width - 0.1} color="#f2a65a">
            {action.label}
          </VrText>,
        );
        y -= 0.09;
        return;
      }
      items.push(
        <GazeButton
          key={`a-${action.id}`}
          label={action.label}
          onSelect={() => action.onSelect?.()}
          position={[0, y, 0]}
          width={width - 0.1}
          height={0.095}
          fontSize={0.04}
          disabled={action.disabled}
          primary={action.primary}
        />,
      );
      y -= 0.115;
    });
  }

  if (items.length === 0) return null;
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

/* ------------------------------------------------------------------------ */
/* Pegado a la vista: aviso de reto y tutor                                  */
/* ------------------------------------------------------------------------ */

function ChallengeToast() {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const off = onChallengeCompleted((event) => {
      setTitle(event.title.replace(/ ←$/, ""));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTitle(null), 3500);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, []);

  if (!title) return null;
  return (
    <group position={[0, 0.42, -1.6]}>
      <mesh>
        <planeGeometry args={[1.1, 0.16]} />
        <meshBasicMaterial color="#0f2e2a" transparent opacity={0.92} toneMapped={false} />
      </mesh>
      <VrText position={[0, 0.025, 0.002]} anchorX="center" fontSize={0.032} color="#34d399">
        RETO LOGRADO
      </VrText>
      <VrText position={[0, -0.03, 0.002]} anchorX="center" fontSize={0.045} maxWidth={1.04} textAlign="center">
        {title}
      </VrText>
    </group>
  );
}

const STATUS_LABEL = {
  idle: "",
  listening: "Te escucho…",
  thinking: "Pensando…",
  speaking: "",
} as const;

/** Los subtítulos quedan este tiempo después de que el tutor termina. */
const SUBTITLE_LINGER_MS = 8000;

function TutorSubtitles() {
  const { status, heard, reply, offline, note } = useTutorHud();
  const shown = heard || reply ? `${heard}\u0000${reply}` : "";
  const [hidden, setHidden] = useState("");

  useEffect(() => {
    if (!shown || shown === hidden || status !== "idle") return;
    const id = window.setTimeout(() => setHidden(shown), SUBTITLE_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [shown, hidden, status]);

  // "Ocultar los subtítulos" o "Cancelar" (botones 3D): se oculta lo que se
  // veía, hasta que llegue texto nuevo.
  const dismissed = useSubtitlesDismissed();
  const [dismissedSeen, setDismissedSeen] = useState(dismissed);
  if (dismissed !== dismissedSeen) {
    setDismissedSeen(dismissed);
    setHidden(shown);
  }

  const label = STATUS_LABEL[status];
  const textVisible = shown !== "" && shown !== hidden;
  useEffect(() => {
    setSubtitlesShown(textVisible);
    return () => setSubtitlesShown(false);
  }, [textVisible]);
  // El aviso del micrófono solo acompaña: quedaba fijo (hasta la próxima
  // pregunta) tapando la parte de abajo de la vista. Ya se ve en el panel.
  if (!textVisible && !label) return null;

  // Las respuestas son cortas (tres oraciones como mucho), pero se acota por
  // las dudas: un bloque de texto enorme pegado a la vista marea.
  const text = reply.length > 260 ? `${reply.slice(0, 257)}…` : reply;

  return (
    <group position={[0, -0.36, -1.6]}>
      <mesh position={[0, -0.04, -0.002]}>
        <planeGeometry args={[1.3, 0.3]} />
        <meshBasicMaterial color="#131b2e" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {label ? (
        <VrText position={[0, 0.07, 0]} anchorX="center" fontSize={0.034} color={status === "listening" ? "#60a5fa" : "#f2a65a"}>
          {label}
        </VrText>
      ) : null}
      {status === "listening" && heard ? (
        <VrText position={[0, -0.01, 0]} anchorX="center" fontSize={0.034} maxWidth={1.2} textAlign="center" color="#93a1be">
          {heard}
        </VrText>
      ) : textVisible && text ? (
        <VrText position={[0, -0.04, 0]} anchorX="center" fontSize={0.034} maxWidth={1.2} textAlign="center" color={offline ? "#e24b4a" : "#e7ecf5"}>
          {text}
        </VrText>
      ) : null}
      {note ? (
        <VrText position={[0, -0.16, 0]} anchorX="center" fontSize={0.03} maxWidth={1.2} textAlign="center" color="#fbbf24">
          {note}
        </VrText>
      ) : null}
    </group>
  );
}
