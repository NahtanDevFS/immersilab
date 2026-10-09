"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { useViewMode } from "@/lib/view/viewMode";
import { VrText } from "./VrText";

/**
 * Tamaño aparente del texto en la vista VR, como fracción de la distancia:
 * a 2 m mide 6 cm, a 20 m, 60 cm. Así se lee igual cerca o lejos, como las
 * etiquetas HTML (que siempre miden lo mismo en pantalla).
 */
const VR_SIZE_PER_METER = 0.03;

/** El texto de una etiqueta HTML, con sus partes separadas por espacios. */
function labelText(element: Element | null): string {
  if (!element) return "";
  const parts: string[] = [];
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
    } else if (node instanceof Element) {
      const text = labelText(node);
      if (text) parts.push(text);
    }
  });
  return parts.join(" ");
}

type Props = ComponentProps<typeof Html>;

/**
 * Etiqueta de una escena, para las dos vistas.
 *
 * - Vista 360: la etiqueta HTML de siempre (drei `<Html>`).
 * - Vista VR: el HTML se dibuja una sola vez para los dos ojos y queda oculto
 *   (ver el CSS del shell). Esta etiqueta copia su texto varias veces por
 *   segundo y lo dibuja como texto 3D, de frente al jugador.
 *
 * Copiar el texto del HTML (en vez de recibirlo como prop) es lo que la hace
 * un reemplazo directo de `<Html>`: muchas escenas escriben sus etiquetas en
 * cada cuadro (el período del péndulo, la velocidad de un carrito) y siguen
 * funcionando sin tocarlas.
 */
export function SceneLabel({ children, position, ...props }: Props) {
  const vr = useViewMode() === "vr";
  const contentRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!vr) return;
    const read = () => {
      const next = labelText(contentRef.current);
      setText((prev) => (prev === next ? prev : next));
    };
    read();
    const id = window.setInterval(read, 200);
    return () => window.clearInterval(id);
  }, [vr]);

  return (
    <>
      <Html position={position} {...props}>
        <div ref={contentRef} style={{ display: "contents" }}>
          {children}
        </div>
      </Html>
      {vr && text ? <VrLabel position={position} text={text} /> : null}
    </>
  );
}

function VrLabel({ position, text }: { position: Props["position"]; text: string }) {
  const group = useRef<THREE.Group>(null);
  const world = useMemo(() => new THREE.Vector3(), []);

  // Escala según la distancia a la cámara: tamaño aparente constante.
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.getWorldPosition(world);
    g.scale.setScalar(Math.max(0.02, world.distanceTo(camera.position) * VR_SIZE_PER_METER));
  });

  return (
    <Suspense fallback={null}>
      <Billboard ref={group} position={position}>
        <VrText
          anchorX="center"
          textAlign="center"
          fontSize={1}
          maxWidth={18}
          color="#ffffff"
          outlineWidth={0.08}
          outlineColor="#0b1220"
        >
          {text}
        </VrText>
      </Billboard>
    </Suspense>
  );
}
