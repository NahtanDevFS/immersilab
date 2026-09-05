"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { VariablesSchema, VariablesState } from "@/types/module";
import { VariablesPanel } from "./VariablesPanel";

/*
 * Dónde queda el panel respecto de la cabeza, en metros. Abajo y a la
 * izquierda, a poco más de un metro: fuera del centro de la vista (que es
 * donde pasa el experimento) pero al alcance de un vistazo, como el tablero
 * de un auto. Anclarlo al MUNDO se probó primero y no sirve: en un visor,
 * después de caminar tres metros el panel te queda a la espalda y hay que
 * girar el cuerpo entero para leer un número.
 */
const OFFSET = new THREE.Vector3(-0.46, -0.3, -0.95);
/** Cuánto se gira hacia adentro, para que no se lea "de canto". */
const YAW = 0.5;

/** Escala del panel dentro de la escena (ver el comentario en el <Html>). */
const PANEL_SCALE = 0.05;

/** Qué tan atenuado queda cuando NO lo estás mirando. */
const IDLE_OPACITY = 0.25;
/** Coseno del ángulo a partir del cual se considera que lo estás mirando. */
const LOOK_COS = 0.93;

interface Props {
  schema: VariablesSchema;
  values: VariablesState;
  onChange: (key: string, value: number | boolean | string) => void;
  selectedKey?: string;
}

/**
 * El panel de variables como objeto dentro de la escena, para el modo visor.
 *
 * El panel HTML pegado a la esquina de la pantalla funciona con un mouse,
 * pero dentro de unos lentes 360 queda literalmente sobre el ojo: no se
 * puede enfocar algo a dos centímetros de la cara, y tapa una esquina del
 * campo visual todo el tiempo. Acá el mismo panel se dibuja como una
 * superficie en el espacio, a distancia de lectura.
 *
 * Dos detalles que lo hacen usable y no un estorbo más:
 *
 *  - **Se atenúa cuando no lo mirás.** Con la cabeza al frente queda casi
 *    transparente y no compite con el experimento; al bajar la vista hacia
 *    él, se enciende. Esa transición es lo que lo vuelve "consultable" en
 *    vez de "siempre encima".
 *  - **Sigue siendo el MISMO componente** (`VariablesPanel`), no una copia:
 *    es DOM real posicionado en 3D por `<Html transform>`. Por eso el cursor
 *    virtual y el arrastre de sliders con el gamepad siguen funcionando sin
 *    tocar una línea de `useVirtualCursor` — que resuelve con
 *    `document.elementFromPoint`, y eso sigue valiendo con transformaciones
 *    CSS 3D.
 */
export function VariablesHud3D({
  schema,
  values,
  onChange,
  selectedKey,
}: Props) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const worldPos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const toPanel = useRef(new THREE.Vector3());
  const opacity = useRef(IDLE_OPACITY);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // Se copia la pose de la cámara y se corre al hueco de abajo-izquierda.
    // No se hace `camera.add(group)` a propósito: colgar objetos de la cámara
    // los saca del grafo de la escena y deja de valer todo lo que dependa de
    // la escena (raycast, sombras) sin ningún aviso.
    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);
    group.translateX(OFFSET.x);
    group.translateY(OFFSET.y);
    group.translateZ(OFFSET.z);
    group.rotateY(YAW);

    // ¿Lo está mirando? Ángulo entre hacia dónde apunta la cámara y la
    // dirección cámara → panel.
    group.getWorldPosition(worldPos.current);
    camera.getWorldDirection(look.current);
    toPanel.current.copy(worldPos.current).sub(camera.position).normalize();
    const looking = look.current.dot(toPanel.current) > LOOK_COS;

    // Interpolación por tiempo y no por frame: así se atenúa a la misma
    // velocidad a 30 fps que a 60.
    const target = looking ? 1 : IDLE_OPACITY;
    opacity.current += (target - opacity.current) * Math.min(1, delta * 6);

    if (wrapperRef.current) {
      wrapperRef.current.style.opacity = opacity.current.toFixed(3);
    }
  });

  return (
    <group ref={groupRef}>
      {/* La escala es la pieza delicada, y hay que ajustarla mirando: dentro
          de un `<Html transform>` el contenido se mide en píxeles de CSS, no
          en metros, así que sin escalar el panel mide cientos de metros. Este
          valor salió de probar en pantalla — a 1.1 m de los ojos deja el
          panel del tamaño de una tablet a la altura del pecho, que es lo que
          se puede leer de un vistazo a través de las lentes de un visor
          barato. Se subió después de probarlo: al tamaño anterior el panel
          se veía, pero los números no se leían. */}
      <Html transform scale={PANEL_SCALE} zIndexRange={[5, 0]}>
        <div ref={wrapperRef} style={{ opacity: IDLE_OPACITY }}>
          <VariablesPanel
            title="Variables"
            schema={schema}
            values={values}
            onChange={onChange}
            selectedKey={selectedKey}
            variant="hud"
          />
        </div>
      </Html>
    </group>
  );
}
