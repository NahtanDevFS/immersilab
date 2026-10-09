"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WhiteboardSpec } from "@/types/module";
import { GazeButton } from "@/components/vr/GazeButton";
import { getGazed, getGazeUv, isSelectHeld, registerGazeTarget } from "@/lib/view/gaze";
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

function drawBase(ctx: CanvasRenderingContext2D, spec: WhiteboardSpec) {
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 54px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(spec.title, 50, 40);

  ctx.font = "40px system-ui, sans-serif";
  ctx.fillStyle = "#1e3a8a";
  let y = 140;
  for (const line of spec.formulas) {
    y = wrapText(ctx, line, 50, y, TEX_W * FORMULA_COLUMN - 80, 50) + 22;
  }

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
): number {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

function stroke(ctx: CanvasRenderingContext2D, from: THREE.Vector2, to: THREE.Vector2, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x * TEX_W, (1 - from.y) * TEX_H);
  ctx.lineTo(to.x * TEX_W, (1 - to.y) * TEX_H);
  ctx.stroke();
}

function refresh(texture: THREE.Texture) {
  texture.needsUpdate = true;
}

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
 */
export function Whiteboard({ spec }: { spec: WhiteboardSpec }) {
  const width = spec.width ?? 2.2;
  const height = (width * TEX_H) / TEX_W;

  const surface = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext("2d")!;
    drawBase(ctx, spec);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { ctx, texture };
  }, [spec]);

  const [pen, setPen] = useState(PENS[0].color);
  const penRef = useRef(pen);
  useEffect(() => {
    penRef.current = pen;
  }, [pen]);

  const boardRef = useRef<THREE.Mesh>(null);
  /** Último punto del trazo en curso (con mouse o con la mira). */
  const last = useRef<THREE.Vector2 | null>(null);
  const gazeLast = useRef<THREE.Vector2 | null>(null);

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
      stroke(surface.ctx, last.current, uv, penRef.current);
      refresh(surface.texture);
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
  }, [element, camera, surface, vr]);

  // Vista VR: mirando el pizarrón con A apretado (o el dedo apoyado en la
  // pantalla), se dibuja donde cae la mira.
  useFrame(() => {
    const pressed = vr && isSelectHeld();
    const uv = getGazed() === boardRef.current ? getGazeUv() : null;
    if (pressed && uv) {
      if (gazeLast.current) {
        stroke(surface.ctx, gazeLast.current, uv, penRef.current);
        refresh(surface.texture);
      }
      gazeLast.current = uv.clone();
    } else {
      gazeLast.current = null;
    }
  });

  const clear = () => {
    drawBase(surface.ctx, spec);
    refresh(surface.texture);
  };

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
