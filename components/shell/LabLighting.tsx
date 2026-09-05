"use client";

import { Suspense } from "react";
import { Environment } from "@react-three/drei";
import type { QualityTier } from "./useQualityTier";

interface Props {
  /**
   * "indoor": sala cerrada (lobby). La luz ambiente se fabrica con
   * Lightformers, porque no hay cielo del cual tomarla.
   * "outdoor": el HDRI de LabBackground ya aporta el ambiente; acá solo se
   * agrega la luz principal que tira las sombras.
   */
  variant: "indoor" | "outdoor";
  quality: QualityTier;
  /** Mitad del lado de la zona que debe recibir sombras, en metros. */
  shadowRadius?: number;
}

/**
 * Esquema de iluminación único para todo ImmersiLab.
 *
 * El problema que resuelve: antes el lobby se iluminaba con una
 * `directionalLight` en [0, 4.5, 0] — apuntando recto hacia abajo desde el
 * centro del techo. Luz vertical = todas las caras de un objeto reciben lo
 * mismo = cero volumen. Y aunque el <Canvas> tenía `shadows`, ninguna luz
 * declaraba `castShadow`, así que no había una sola sombra en la escena.
 *
 * Acá la luz principal viene en ángulo (~35° de elevación), que es lo que
 * hace que una pared se lea como una pared y no como un rectángulo de
 * color, y es la única que tira sombra — una sola sombra bien puesta cuesta
 * menos y se ve mejor que tres mal puestas.
 */
export function LabLighting({
  variant,
  quality,
  shadowRadius = 14,
}: Props) {
  const indoor = variant === "indoor";
  const shadowMap = quality === "high" ? 2048 : 1024;

  return (
    <>
      {/* Relleno: cielo frío arriba, rebote cálido del piso abajo.
          En interior va más bajo que antes: el pasillo se ilumina sobre todo
          con sus propias luminarias de techo, y el relleno alto lavaba los
          contrastes hasta dejar las paredes sin sombra ninguna. Sustituye
          al ambientLight plano — un ambientLight suma lo mismo a todas las
          caras y es justamente lo que aplana una escena. */}
      <hemisphereLight
        args={[indoor ? "#dce6f7" : "#bcd4ff", "#4a4036", indoor ? 0.5 : 0.45]}
      />

      {/* Luz principal. La única con castShadow. */}
      <directionalLight
        position={indoor ? [7, 9, 5] : [12, 16, 9]}
        intensity={indoor ? 0.7 : 1.2}
        color={indoor ? "#fff8f2" : "#ffe8c9"}
        castShadow
        shadow-mapSize={[shadowMap, shadowMap]}
        /* bias negativo contra el "acné" de sombras; normalBias contra el
           peter-panning en superficies planas grandes como el piso. */
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={indoor ? 45 : 70}
        shadow-camera-left={-shadowRadius}
        shadow-camera-right={shadowRadius}
        shadow-camera-top={shadowRadius}
        shadow-camera-bottom={-shadowRadius}
      />

      {/* Contraluz sin sombra: despega los objetos del fondo. Es el truco de
          fotografía de producto y cuesta prácticamente nada. */}
      <directionalLight
        position={indoor ? [-6, 5, -8] : [-14, 8, -12]}
        intensity={indoor ? 0.2 : 0.3}
        color={indoor ? "#c8e2f5" : "#9fd8ff"}
      />

      {/* Ambiente y reflejos del lobby. Sin esto los metales (zócalo,
          cornisa) se ven negros: un material metálico no tiene color propio,
          solo devuelve lo que lo rodea, y si no hay entorno lo que devuelve
          es nada.

          Se reutiliza el HDRI de atardecer que ya carga LabBackground —
          queda en caché del navegador, así que en el lobby es gratis. Va sin
          `background` y con intensidad baja: no se ve, solo aporta el brillo
          del piso pulido y el reflejo de los metales. La intensidad es baja
          también porque es un HDRI de ATARDECER: subida, le mete un tinte
          rosado a las paredes del pasillo. Cuando esté el HDRI de
          interior (ver PLAN_DESARROLLO.md §5.2) se cambia solo esta ruta.

          Nota: NO usar <Environment> con <Lightformer> como hijos. Con drei
          10 / three 0.185 esa variante deja toda la escena en negro. */}
      {indoor && (
        // El <Suspense> no es opcional: <Environment files=...> suspende
        // mientras carga el HDRI, y sin un limite propio esa suspension sube
        // hasta el <Canvas> y deja TODA la escena en negro hasta que el
        // archivo este en cache. Va aca dentro y no en el shell para que
        // cualquiera que use <LabLighting> quede cubierto sin acordarse.
        <Suspense fallback={null}>
          <Environment
            files="/textures/sky/qwantani_dusk_2_puresky.hdr"
            environmentIntensity={0.22}
          />
        </Suspense>
      )}
    </>
  );
}
