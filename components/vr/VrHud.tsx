"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import type {
  ChallengeStatus,
  ExperimentEngine,
  VariableDefinition,
  VariablesSchema,
  VariablesState,
  VrAction,
} from "@/types/module";
import { onChallengeCompleted } from "@/lib/tutor/events";
import { useTutorHud } from "@/lib/tutor/hudStore";
import { completionKey } from "@/lib/progress/store";
import { useProgress } from "@/lib/progress/useSession";
import { BodyAnchor, HeadAnchor } from "./Anchors";
import { GazeButton } from "./GazeButton";
import { VrText } from "./VrText";

/** Distancia de los paneles laterales y cuánto se abren hacia los costados. */
const PANEL_DISTANCE = 2;
const SIDE_ANGLE = (40 * Math.PI) / 180;

const ROW = 0.115;
const COLUMN_WIDTH = 1.05;
/** Filas por columna del panel de variables: más alto que esto obliga a
 *  cabecear mucho, y con el visor eso cansa. */
const ROWS_PER_COLUMN = 7;

interface Props {
  engine: ExperimentEngine;
  experimentSlug: string;
  schema: VariablesSchema;
  values: VariablesState;
  onChange: (key: string, value: number | boolean | string) => void;
  vrActions?: (engine: ExperimentEngine) => VrAction[];
  /** Acciones que agrega el shell (p. ej. "Siguiente parada" del recorrido). */
  extraActions?: VrAction[];
}

/**
 * La interfaz de un experimento en la vista VR, dentro de la escena: cada
 * ojo la ve en su imagen, que es lo que el HTML no puede hacer.
 *
 * - A la izquierda, las variables, con botones − y + (o < > en las listas).
 * - A la derecha, los retos y las acciones del experimento.
 * - Pegados a la vista: el aviso de reto logrado y el tutor.
 *
 * Todo se maneja con la mira (centro de la vista) y A, o tocando la pantalla.
 */
export function VrHud(props: Props) {
  return (
    // El texto 3D carga la fuente antes de dibujarse.
    <Suspense fallback={null}>
      <BodyAnchor>
        <group rotation={[0, SIDE_ANGLE, 0]}>
          <group position={[0, -0.1, -PANEL_DISTANCE]}>
            <VariablesPanel3D schema={props.schema} values={props.values} onChange={props.onChange} />
          </group>
        </group>
        <group rotation={[0, -SIDE_ANGLE, 0]}>
          <group position={[0, -0.1, -PANEL_DISTANCE]}>
            <ChallengesAndActions {...props} />
          </group>
        </group>
      </BodyAnchor>
      <HeadAnchor>
        <ChallengeToast />
        <TutorSubtitles />
      </HeadAnchor>
    </Suspense>
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

function VariablesPanel3D({
  schema,
  values,
  onChange,
}: Pick<Props, "schema" | "values" | "onChange">) {
  const rows: Row[] = [];
  let lastGroup: string | undefined;
  Object.entries(schema).forEach(([key, def]) => {
    if (def.group && def.group !== lastGroup) rows.push({ kind: "group", label: def.group });
    lastGroup = def.group;
    rows.push({ kind: "variable", key, def });
  });

  const columns: Row[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_COLUMN) columns.push(rows.slice(i, i + ROWS_PER_COLUMN));
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const width = columns.length * COLUMN_WIDTH + 0.06;
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

function VariableRow({
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

  const width = 1.15;
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
  const { status, heard, reply, offline } = useTutorHud();
  const shown = heard || reply ? `${heard}\u0000${reply}` : "";
  const [hidden, setHidden] = useState("");

  useEffect(() => {
    if (!shown || shown === hidden || status !== "idle") return;
    const id = window.setTimeout(() => setHidden(shown), SUBTITLE_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [shown, hidden, status]);

  const label = STATUS_LABEL[status];
  const visible = (shown && shown !== hidden) || label;
  if (!visible) return null;

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
      ) : text ? (
        <VrText position={[0, -0.04, 0]} anchorX="center" fontSize={0.034} maxWidth={1.2} textAlign="center" color={offline ? "#e24b4a" : "#e7ecf5"}>
          {text}
        </VrText>
      ) : null}
    </group>
  );
}
