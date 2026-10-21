"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { VariablesSchema, VariablesState, WhiteboardSpec, WhiteboardTerm } from "@/types/module";
import { matchesShowWhen } from "@/lib/modules/visibility";
import { GazeButton } from "@/components/vr/GazeButton";
import { getGazed, getGazeUv, isSelectHeld, registerGazeTarget } from "@/lib/view/gaze";
import { probeReport } from "@/lib/debug/deviceProbe";
import { setDrawing } from "@/lib/view/drawing";
import { useViewMode } from "@/lib/view/viewMode";

/** Resolución de la textura del pizarrón (proporción 16:10). */
const TEX_W = 1600;
const TEX_H = 1000;
/** Hasta dónde llegan las fórmulas; a la derecha queda lugar para las cuentas. */
const FORMULA_COLUMN = 0.5;

const PENS = [
  { id: "negro", color: "#111827", label: "Negro" },
  { id: "azul", color: "#1d4ed8", label: "Azul" },
  { id: "rojo", color: "#dc2626", label: "Rojo" },
];

/*
 * El dibujo va sobre un <canvas> 2D que se usa como textura. Las funciones
 * que lo tocan están fuera del componente a propósito: el compilador de
 * React no deja mutar valores creados con hooks, y un canvas y su textura
 * se usan mutándolos, por diseño.
 */

/** Lo que se escribe en la columna de fórmulas con la modalidad elegida. */
interface BoardContent {
  title: string;
  formulas: string[];
  terms: WhiteboardTerm[];
}

function boardContent(spec: WhiteboardSpec, values: VariablesState, schema?: VariablesSchema): BoardContent {
  return {
    title: spec.title,
    formulas: spec.formulas
      .filter((line) => typeof line === "string" || matchesShowWhen(line.showWhen, values, schema))
      .map((line) => (typeof line === "string" ? line : line.text)),
    terms: (spec.terms ?? []).filter((term) => matchesShowWhen(term.showWhen, values, schema)),
  };
}

/** Hasta dónde se puede escribir en la columna de fórmulas (deja margen abajo). */
const FORMULA_BOTTOM = TEX_H - 40;

/**
 * Escribe las fórmulas y "qué es cada letra" con un tamaño de letra dado y
 * devuelve dónde terminó. Con `dry` solo mide, para achicar si no entra.
 */
function drawFormulas(ctx: CanvasRenderingContext2D, content: BoardContent, scale: number, dry: boolean): number {
  const x = 50;
  const maxWidth = TEX_W * FORMULA_COLUMN - 80;
  const write = (text: string, tx: number, ty: number) => {
    if (!dry) ctx.fillText(text, tx, ty);
  };
  const px = (size: number) => Math.round(size * scale);

  ctx.textBaseline = "top";
  ctx.font = `${px(40)}px system-ui, sans-serif`;
  ctx.fillStyle = "#1e3a8a";
  let y = 140;
  for (const line of content.formulas) {
    y = wrapText(ctx, line, x, y, maxWidth, 50 * scale, write) + 22 * scale;
  }

  if (content.terms.length > 0) {
    y += 14 * scale;
    ctx.font = `bold ${px(30)}px system-ui, sans-serif`;
    ctx.fillStyle = "#475569";
    write("Qué es cada letra", x, y);
    y += 44 * scale;
    // Todas las explicaciones arrancan en la misma columna (la del símbolo
    // más largo, con tope para que no se coma el renglón).
    ctx.font = `bold ${px(30)}px system-ui, sans-serif`;
    const widest = Math.max(...content.terms.map((t) => ctx.measureText(`${t.symbol}:`).width));
    const indent = Math.min(widest + 14 * scale, maxWidth * 0.35);
    for (const term of content.terms) {
      // El símbolo en azul, como en las fórmulas; lo que significa, en gris.
      ctx.font = `bold ${px(30)}px system-ui, sans-serif`;
      ctx.fillStyle = "#1e3a8a";
      const label = `${term.symbol}:`;
      // Un símbolo más largo que la columna va solo en su renglón.
      const own = ctx.measureText(label).width + 14 * scale > indent;
      write(label, x, y);
      if (own) y += 38 * scale;
      ctx.font = `${px(30)}px system-ui, sans-serif`;
      ctx.fillStyle = "#334155";
      y = wrapText(ctx, term.meaning, x + indent, y, maxWidth - indent, 38 * scale, write) + 6 * scale;
    }
  }
  return y;
}

/**
 * La columna de fórmulas, con el título. Si no entra, achica la letra: un
 * experimento con muchas fórmulas y letras no debe salirse del pizarrón.
 */
function drawFormulaColumn(ctx: CanvasRenderingContext2D, content: BoardContent) {
  // Solo esta columna: lo que el estudiante dibujó a la derecha se queda.
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, TEX_W * FORMULA_COLUMN - 4, TEX_H);

  // El título también se achica si es largo: si no, cruzaba la línea y se
  // metía en la zona de las cuentas.
  ctx.fillStyle = "#0f172a";
  ctx.textBaseline = "top";
  let titleSize = 54;
  ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
  while (titleSize > 32 && ctx.measureText(content.title).width > TEX_W * FORMULA_COLUMN - 80) {
    titleSize -= 2;
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
  }
  ctx.fillText(content.title, 50, 40 + (54 - titleSize) / 2);

  let scale = 1;
  while (scale > 0.55 && drawFormulas(ctx, content, scale, true) > FORMULA_BOTTOM) scale -= 0.05;
  drawFormulas(ctx, content, scale, false);
}

function drawBase(ctx: CanvasRenderingContext2D, content: BoardContent) {
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  drawFormulaColumn(ctx, content);

  // Separación entre fórmulas y lugar para las cuentas.
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(TEX_W * FORMULA_COLUMN, 120);
  ctx.lineTo(TEX_W * FORMULA_COLUMN, TEX_H - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "italic 34px system-ui, sans-serif";
  ctx.fillText("Tus cuentas", TEX_W * FORMULA_COLUMN + 30, 140);
}

/** Escribe un texto partiéndolo en renglones. Devuelve dónde terminó. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  write: (text: string, x: number, y: number) => void = (t, tx, ty) => ctx.fillText(t, tx, ty),
): number {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      write(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  write(line, x, y);
  return y + lineHeight;
}

function refresh(texture: THREE.Texture) {
  texture.needsUpdate = true;
}

/*
 * La tinta (lo que escribe el estudiante) NO va en la textura: es una cinta
 * de triángulos apoyada sobre el pizarrón. Antes cada trazo se pintaba en el
 * canvas de 1600×1000 y había que volver a subirlo entero a la tarjeta
 * gráfica: en el celular, escribiendo, bajaba de ~58 a 23–32 cuadros por
 * segundo (medido con el modo diagnóstico), aun subiéndolo 30 veces por
 * segundo. Agregar un tramo a la cinta sube solo esos seis vértices.
 */
const MAX_SEGMENTS = 8000;
const FLOATS_PER_SEGMENT = 6 * 3; // dos triángulos, x, y, z por vértice
/** Medio ancho del trazo, en fracción del ancho del pizarrón (~7 px de 1600). */
const INK_HALF_WIDTH = 3.5 / TEX_W;

interface Ink {
  mesh: THREE.Mesh;
  positions: THREE.BufferAttribute;
  colors: THREE.BufferAttribute;
  count: number;
}

function createInk(): Ink {
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * FLOATS_PER_SEGMENT), 3);
  const colors = new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * FLOATS_PER_SEGMENT), 3);
  positions.setUsage(THREE.DynamicDrawUsage);
  colors.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positions);
  geometry.setAttribute("color", colors);
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  // Sus límites cambian con cada trazo: que no la descarte por un cálculo viejo.
  mesh.frustumCulled = false;
  mesh.position.z = 0.003; // apenas delante del pizarrón
  return { mesh, positions, colors, count: 0 };
}

const inkColor = new THREE.Color();

/**
 * Un tramo de tinta entre dos puntos del pizarrón (coordenadas de textura,
 * 0..1). Se alarga medio ancho de cada lado para que los tramos se pisen y
 * el trazo no quede cortado en las curvas.
 */
function addInk(ink: Ink, from: THREE.Vector2, to: THREE.Vector2, color: string, width: number, height: number) {
  if (ink.count >= MAX_SEGMENTS) return;
  const ax = (from.x - 0.5) * width;
  const ay = (from.y - 0.5) * height;
  const bx = (to.x - 0.5) * width;
  const by = (to.y - 0.5) * height;
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return;
  const half = INK_HALF_WIDTH * width;
  const ux = (dx / length) * half;
  const uy = (dy / length) * half;
  // Normal al trazo, en el plano del pizarrón.
  const nx = -uy;
  const ny = ux;
  const x0 = ax - ux;
  const y0 = ay - uy;
  const x1 = bx + ux;
  const y1 = by + uy;
  const quad = [
    x0 + nx, y0 + ny, x0 - nx, y0 - ny, x1 + nx, y1 + ny,
    x1 + nx, y1 + ny, x0 - nx, y0 - ny, x1 - nx, y1 - ny,
  ];
  inkColor.set(color).convertSRGBToLinear();
  const offset = ink.count * FLOATS_PER_SEGMENT;
  const pos = ink.positions.array as Float32Array;
  const col = ink.colors.array as Float32Array;
  for (let v = 0; v < 6; v++) {
    pos[offset + v * 3] = quad[v * 2];
    pos[offset + v * 3 + 1] = quad[v * 2 + 1];
    pos[offset + v * 3 + 2] = 0;
    col[offset + v * 3] = inkColor.r;
    col[offset + v * 3 + 1] = inkColor.g;
    col[offset + v * 3 + 2] = inkColor.b;
  }
  ink.positions.addUpdateRange(offset, FLOATS_PER_SEGMENT);
  ink.colors.addUpdateRange(offset, FLOATS_PER_SEGMENT);
  ink.positions.needsUpdate = true;
  ink.colors.needsUpdate = true;
  ink.count++;
  ink.mesh.geometry.setDrawRange(0, ink.count * 6);
}

function clearInk(ink: Ink) {
  ink.count = 0;
  ink.mesh.geometry.setDrawRange(0, 0);
}

/*
 * Estabilizador de la tiza en el visor (como el "lazy brush" de los programas
 * de dibujo). La tiza va atada a la mira con un hilo de LAZY_PX: los
 * temblores de la cabeza y el ruido del sensor que quedan dentro del hilo no
 * mueven la tiza; fuera de él, la tiza sigue a la mira de forma suave.
 */
const LAZY_PX = 9;
/** Desde más lejos que esto no se dibuja, m: desde el otro lado de la escena era un accidente. */
const MAX_DRAW_DISTANCE = 3.5;
const boardWorld = new THREE.Vector3();
const FOLLOW = 14; // 1/s: qué tan rápido alcanza la tiza a la mira

/**
 * Cursor de lápiz sobre el pizarrón (en la compu). La punta está abajo a la
 * izquierda: ese es el punto que dibuja.
 */
const PENCIL_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 24 24'>" +
  "<path d='M3 21l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L7.6 19.8z' " +
  "fill='#facc15' stroke='#111827' stroke-width='1.4' stroke-linejoin='round'/>" +
  "<path d='M3 21l1.2-4.6 3.4 3.4z' fill='#111827'/></svg>";
const PENCIL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PENCIL_SVG)}") 3 21, crosshair`;

/**
 * El cursor va en el canvas y no en la página: DragLookControls le pone al
 * canvas su propio cursor de mano ("grab"), y ese le gana al de la página.
 */
function setCursor(element: HTMLElement, cursor: string) {
  element.style.cursor = cursor;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/** Dónde toca (coordenadas de textura) un punto de la pantalla, o null si no cae en el pizarrón. */
function boardUvAt(
  event: PointerEvent,
  element: HTMLElement,
  camera: THREE.Camera,
  board: THREE.Object3D | null,
): THREE.Vector2 | null {
  if (!board) return null;
  const rect = element.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(board, false)[0]?.uv?.clone() ?? null;
}

/**
 * Pizarrón con las fórmulas del experimento a la izquierda y lugar para hacer
 * las cuentas a mano a la derecha.
 *
 * - Con mouse o dedo: se dibuja arrastrando sobre el pizarrón (la cámara no
 *   gira mientras tanto).
 * - En la vista VR: se mira el pizarrón y se mantiene A (o el dedo en la
 *   pantalla); la mira es la tiza.
 *
 * Debajo, los plumones (tres colores) y el borrador, como botones 3D: se
 * tocan con el mouse o se apuntan con la mira.
 *
 * Las fórmulas y las letras de otra modalidad no se escriben (`showWhen`,
 * igual que en el panel de variables). Al cambiar de modalidad se reescribe
 * solo esa columna: las cuentas del estudiante no se borran.
 */
export function Whiteboard({
  spec,
  values,
  schema,
}: {
  spec: WhiteboardSpec;
  values: VariablesState;
  schema?: VariablesSchema;
}) {
  const width = spec.width ?? 2.2;
  const height = (width * TEX_H) / TEX_W;

  const content = useMemo(() => boardContent(spec, values, schema), [spec, values, schema]);
  // Se reescribe solo si cambia lo que se ve, no con cada slider que se mueve.
  const contentKey = JSON.stringify(content);
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const surface = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { ctx, texture };
  }, []);

  // El primer dibujo y, después, cada vez que cambia la modalidad.
  const drawnKey = useRef<string | null>(null);
  useEffect(() => {
    if (drawnKey.current === contentKey) return;
    if (drawnKey.current === null) drawBase(surface.ctx, contentRef.current);
    else drawFormulaColumn(surface.ctx, contentRef.current);
    drawnKey.current = contentKey;
    refresh(surface.texture);
  }, [contentKey, surface]);

  const [pen, setPen] = useState(PENS[0].color);
  const penRef = useRef(pen);
  useEffect(() => {
    penRef.current = pen;
  }, [pen]);

  const boardRef = useRef<THREE.Mesh>(null);
  /** Último punto del trazo en curso (con mouse o con la mira). */
  const last = useRef<THREE.Vector2 | null>(null);
  /** La punta de la tiza en el visor (estabilizada), en px de la textura. */
  const chalk = useRef<THREE.Vector2 | null>(null);
  const ink = useMemo(() => createInk(), []);

  // El pizarrón se registra en la mira para poder dibujar en el visor.
  useEffect(() => {
    const mesh = boardRef.current;
    if (!mesh) return;
    return registerGazeTarget(mesh, { onSelect: () => {}, enabled: () => true });
  }, []);

  // Dibujo con mouse o dedo. Se escucha el canvas directamente y en fase de
  // captura: así el pizarrón se entera ANTES que DragLookControls (que también
  // escucha el canvas) y, si el toque cae sobre el pizarrón, frena el evento y
  // la cámara ni se entera. Con los eventos de R3F llegaba después y cada
  // trazo giraba la vista.
  const element = useThree((state) => state.gl.domElement);
  /** El cursor que tenía el canvas antes de entrar al pizarrón (la mano). */
  const previousCursor = useRef("");
  const camera = useThree((state) => state.camera);
  const vr = useViewMode() === "vr";
  useEffect(() => {
    if (vr) return; // en el visor se dibuja con la mira y A
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const uv = boardUvAt(event, element, camera, boardRef.current);
      if (!uv) return;
      event.stopImmediatePropagation();
      setDrawing(true);
      last.current = uv;
    };
    const onMove = (event: PointerEvent) => {
      if (!last.current) return;
      const uv = boardUvAt(event, element, camera, boardRef.current);
      if (!uv) return; // fuera del pizarrón: se retoma al volver
      addInk(ink, last.current, uv, penRef.current, width, height);
      last.current = uv;
    };
    const onUp = () => {
      last.current = null;
      setDrawing(false);
    };
    element.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      element.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrawing(false);
    };
  }, [element, camera, ink, width, height, vr]);

  // Vista VR: mirando el pizarrón con A apretado (o el dedo apoyado en la
  // pantalla), se dibuja donde cae la mira, con la tiza estabilizada.
  useFrame((state, delta) => {
    const board = boardRef.current;
    const near = board ? state.camera.position.distanceTo(board.getWorldPosition(boardWorld)) <= MAX_DRAW_DISTANCE : false;
    const pressed = vr && near && isSelectHeld();
    const uv = getGazed() === board ? getGazeUv() : null;
    // Para el modo diagnóstico: si se está escribiendo y cuánta tinta hay.
    probeReport({ pizarron: { escribiendo: Boolean(pressed && uv), cerca: near, trazos: ink.count } });
    if (pressed && uv) {
      const target = new THREE.Vector2(uv.x * TEX_W, (1 - uv.y) * TEX_H);
      if (!chalk.current) {
        chalk.current = target;
      } else {
        const from = chalk.current.clone();
        const offset = target.clone().sub(from);
        const distance = offset.length();
        if (distance > LAZY_PX) {
          // Hasta el borde del hilo, de forma suave.
          const goal = from.clone().addScaledVector(offset, (distance - LAZY_PX) / distance);
          chalk.current.lerp(goal, 1 - Math.exp(-FOLLOW * delta));
          addInk(
            ink,
            new THREE.Vector2(from.x / TEX_W, 1 - from.y / TEX_H),
            new THREE.Vector2(chalk.current.x / TEX_W, 1 - chalk.current.y / TEX_H),
            penRef.current,
            width,
            height,
          );
        }
      }
    } else {
      chalk.current = null;
    }
  });

  const clear = () => clearInk(ink);

  return (
    <group position={spec.position} rotation={[0, spec.rotationY ?? 0, 0]}>
      {/* Marco y patas */}
      <mesh position={[0, 0, -0.03]} castShadow>
        <boxGeometry args={[width + 0.1, height + 0.1, 0.05]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.35} />
      </mesh>
      {[-width / 2 + 0.1, width / 2 - 0.1].map((x) => (
        <mesh key={x} position={[x, -spec.position[1] / 2 - height / 4, -0.05]} castShadow>
          <boxGeometry args={[0.06, Math.max(0.1, spec.position[1] - height / 2), 0.06]} />
          <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      <mesh
        ref={boardRef}
        onPointerOver={() => {
          if (vr) return;
          previousCursor.current = element.style.cursor;
          setCursor(element, PENCIL_CURSOR);
        }}
        onPointerOut={() => {
          if (vr) return;
          setCursor(element, previousCursor.current);
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={surface.texture} toneMapped={false} />
      </mesh>
      {/* Lo que escribe el estudiante (ver createInk). */}
      <primitive object={ink.mesh} />

      {/* Plumones y borrador, en la repisa de abajo. */}
      <Suspense fallback={null}>
        {PENS.map((p, i) => (
          <GazeButton
            key={p.id}
            label={p.label}
            onSelect={() => setPen(p.color)}
            position={[-width / 2 + 0.22 + i * 0.4, -height / 2 - 0.13, 0.02]}
            width={0.36}
            height={0.12}
            fontSize={0.05}
            primary={pen === p.color}
          />
        ))}
        <GazeButton
          label="Borrar"
          onSelect={clear}
          position={[width / 2 - 0.22, -height / 2 - 0.13, 0.02]}
          width={0.36}
          height={0.12}
          fontSize={0.05}
        />
      </Suspense>
    </group>
  );
}
