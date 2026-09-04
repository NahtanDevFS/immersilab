"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { QualityTier } from "./useQualityTier";

useGLTF.preload("/models/trees.glb");

/**
 * Línea de árboles en el horizonte. Reemplaza a los conos que hacían de
 * montañas: al bajarles el color para que no se leyeran como pirámides
 * quedaban como manchas oscuras sin significado, y un bosque da referencia
 * de escala real — un árbol se sabe cuánto mide, un cono no.
 *
 * El modelo (`22-trees_9_obj`) trae los 9 árboles fusionados en un solo
 * objeto de ~100 unidades de ancho, agrupado por material y no por árbol,
 * así que no se pueden separar. Se usa entero como "bosquecito" y se
 * repite rotado en varias posiciones para cerrar el horizonte.
 *
 * Pipeline que se le aplicó al original (33 MB .obj, 247k triángulos):
 *   obj → glb (script propio; obj2gltf se colgaba con este archivo)
 *   → gltf-transform simplify --ratio 0.35 → meshopt
 *   = 1.46 MB y ~86k triángulos.
 *
 * La compresión es **meshopt y no Draco** a propósito: el decodificador de
 * meshopt viene empaquetado con three, mientras que drei carga el de Draco
 * desde un CDN de Google. Sin internet en la defensa, con Draco los árboles
 * no cargarían.
 */

interface Grove {
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

// El modelo mide ~47 unidades de alto, asi que scale 0.4 ≈ arboles de 19 m.
// Estan fuera del radio de sombras (18 m) y dentro de la niebla (40–135 m):
// se leen como siluetas con bruma, que es justo lo que tiene que hacer un
// fondo — dar profundidad sin robarle atencion al experimento.
//
// El orden de la lista importa: los primeros son los que se ven en la vista
// por defecto, y en gama baja se plantan solo esos. De ahi que el bosque
// cierre primero el fondo (-Z), despues los costados, y al final la espalda.
//
// Las escalas y rotaciones son todas distintas a proposito: es un solo
// modelo repetido, y con la misma escala y angulo el ojo detecta el patron
// de inmediato. Variarlas es lo que lo hace leer como un bosque y no como
// un sello estampado varias veces.
const GROVES: Grove[] = [
  // Primera fila — la pared de arboles que cierra el horizonte de frente.
  { position: [-24, 0, -58], rotationY: 0, scale: 0.4 },
  { position: [12, 0, -64], rotationY: 2.1, scale: 0.44 },
  { position: [46, 0, -56], rotationY: 0.6, scale: 0.36 },
  { position: [-58, 0, -48], rotationY: 3.4, scale: 0.38 },
  { position: [-40, 0, -70], rotationY: 5.2, scale: 0.42 },
  { position: [72, 0, -62], rotationY: 1.8, scale: 0.38 },

  // Segunda fila, mas lejos y mas alta: asoma por encima de la primera y le
  // da espesor al bosque en vez de dejarlo como un telon plano.
  { position: [-8, 0, -88], rotationY: 1.2, scale: 0.52 },
  { position: [40, 0, -92], rotationY: 4.0, scale: 0.48 },
  { position: [-52, 0, -84], rotationY: 2.6, scale: 0.5 },
  { position: [24, 0, -104], rotationY: 0.3, scale: 0.58 },
  { position: [-88, 0, -78], rotationY: 4.6, scale: 0.54 },
  { position: [80, 0, -96], rotationY: 2.2, scale: 0.5 },

  // Costados — al girar la camara o caminar, el horizonte ya no queda pelado.
  { position: [-70, 0, -18], rotationY: 1.5, scale: 0.38 },
  { position: [-74, 0, 18], rotationY: 5.0, scale: 0.42 },
  { position: [72, 0, -22], rotationY: -1.4, scale: 0.34 },
  { position: [76, 0, 16], rotationY: 2.9, scale: 0.4 },
  { position: [-96, 0, -4], rotationY: 3.1, scale: 0.46 },
  { position: [98, 0, -2], rotationY: 0.4, scale: 0.44 },
  { position: [-92, 0, 44], rotationY: 1.9, scale: 0.44 },
  { position: [94, 0, 42], rotationY: 4.4, scale: 0.42 },

  // Espalda — se ven al darse vuelta.
  { position: [-30, 0, 62], rotationY: 3.9, scale: 0.4 },
  { position: [26, 0, 66], rotationY: 0.9, scale: 0.42 },
  { position: [-4, 0, 80], rotationY: 2.4, scale: 0.46 },
  { position: [56, 0, 74], rotationY: 5.4, scale: 0.44 },
  { position: [-62, 0, 76], rotationY: 0.7, scale: 0.44 },
];

/** Cuantos bosquecitos se plantan segun el tier. Cada uno son ~86k
 *  triangulos, asi que el numero es directamente el presupuesto. */
const COUNT: Record<QualityTier, number> = { high: 25, low: 8 };

export function TreeLine({ quality }: { quality: QualityTier }) {
  const { scene } = useGLTF("/models/trees.glb");

  const groves = useMemo(
    () => GROVES.slice(0, COUNT[quality]),
    [quality],
  );

  // scene.clone() comparte las geometrías y los materiales entre copias —
  // solo se duplican los nodos. La memoria de GPU no se multiplica; los
  // draw calls sí.
  const copies = useMemo(
    () => groves.map(() => scene.clone()),
    [scene, groves],
  );

  return (
    <>
      {groves.map((grove, i) => (
        <primitive
          key={i}
          object={copies[i]}
          position={grove.position}
          rotation={[0, grove.rotationY, 0]}
          scale={grove.scale}
        />
      ))}
    </>
  );
}
