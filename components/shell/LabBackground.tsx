"use client";

import { Suspense } from "react";
import { Environment } from "@react-three/drei";
import { useTiledPbrTexture } from "./useTiledPbrTexture";
import { TreeLine } from "./TreeLine";
import type { QualityTier } from "./useQualityTier";

// Tono cálido que combina con el horizonte del HDRI de atardecer.
const FOG_COLOR = "#c9a888";

/**
 * Fondo visual compartido por todos los experimentos: cielo real (HDRI de
 * Poly Haven, CC0) con niebla, pasto real y una línea de árboles en el
 * horizonte.
 *
 * El HDRI no es solo fondo: drei lo usa además como iluminación ambiente de
 * toda la escena. Estaba en `environmentIntensity={0.2}`, que lo dejaba casi
 * apagado — y con el ambiente apagado los materiales no reflejan nada y todo
 * se ve chato y sin relieve. A 0.85 el pasto recibe el color del cielo y los
 * metales tienen algo que reflejar.
 *
 * Debe renderizarse DENTRO de un <Canvas> de React Three Fiber, antes del
 * SceneComponent de cada experimento (para que quede detrás).
 */
export function LabBackground({ quality }: { quality: QualityTier }) {
  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 40, 135]} />

      {/* Cada carga en su propio <Suspense>: si el cielo y el piso comparten
          limite, ninguno de los dos aparece nunca. Ver la "TRAMPA
          IMPORTANTE" en components/lobby/LobbyScene.tsx. */}
      <Suspense fallback={null}>
        <Sky />
      </Suspense>
      <Suspense fallback={null}>
        <Ground />
      </Suspense>

      <Suspense fallback={null}>
        <TreeLine quality={quality} />
      </Suspense>
    </>
  );
}

/** El HDRI no es solo fondo: drei lo usa ademas como iluminacion ambiente de
 *  toda la escena. Estaba en environmentIntensity 0.2, que lo dejaba casi
 *  apagado — y con el ambiente apagado los materiales no reflejan nada y
 *  todo se ve chato. A 0.6 el pasto recibe el color del cielo y los metales
 *  tienen algo que reflejar, sin lavar la escena como pasaba a 0.85. */
function Sky() {
  return (
    <Environment
      files="/textures/sky/qwantani_dusk_2_puresky.hdr"
      background
      environmentIntensity={0.6}
    />
  );
}

function Ground() {
  // Grass005 (ambientCG) es un cesped fino y muy uniforme: no tiene manchas
  // ni variacion de gran escala. A 75 repeticiones (2 m por baldosa) las
  // hojas quedan por debajo de un pixel a pocos metros y el mipmap las
  // promedia a un verde plano — se veia como fieltro. A 45 (3.3 m) la hoja
  // se alcanza a leer al caminar, que es donde importa, y sigue sin
  // notarse la repeticion justamente por lo uniforme que es.
  const tex = useTiledPbrTexture("/textures/grass/grass_005", 45, 45, true);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[150, 150]} />
      <meshStandardMaterial {...tex} aoMapIntensity={1} roughness={1} />
    </mesh>
  );
}
