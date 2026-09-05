"use client";

import { Suspense } from "react";
import * as THREE from "three";
import { useTiledPbrTexture } from "../shell/useTiledPbrTexture";
import { useBounds } from "@/lib/collision/useCollider";
import { Door } from "./Door";
import { lobbyDoors } from "./catalog";
import {
  CORRIDOR_BACK_Z,
  CORRIDOR_HALF_W,
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
  corridorEndZ,
} from "./corridor";

const ACCENT = "#2dd4bf"; // mismo teal que --lab-accent en globals.css

/*
 * Ojo con los colores: un hex que en un selector parece "gris claro" pasa a
 * lineal y después por el tone mapping ACES, y sale bastante más oscuro. Por
 * eso las paredes y el techo van casi en blanco puro — un #e8e8e8 se veía
 * gris sucio. Misma trampa que el techo de la versión anterior del lobby.
 */
const WALL_COLOR = "#f4f6f8";
const CEILING_COLOR = "#fbfcfd";

const END_Z = corridorEndZ(lobbyDoors.length);
const LENGTH = CORRIDOR_BACK_Z - END_Z;
const MID_Z = (CORRIDOR_BACK_Z + END_Z) / 2;

/** Luminarias lineales del techo, repartidas a lo largo del pasillo. */
const LAMP_SPACING = 4;
const LAMPS = Array.from(
  { length: Math.max(1, Math.round(LENGTH / LAMP_SPACING)) },
  (_, i) => CORRIDOR_BACK_Z - 2 - i * LAMP_SPACING,
);

/**
 * Escena 3D del lobby: un pasillo con las puertas de los experimentos
 * enfrentadas en las dos paredes.
 *
 * Reemplaza a la sala cuadrada de 20×20 m. El motivo no es estético: en la
 * sala, las puertas quedaban repartidas por las cuatro paredes y había que
 * girar sobre uno mismo para saber qué había, que en un visor barato es
 * justo el movimiento que marea. Un pasillo tiene una sola dirección: se
 * camina hacia adelante y las puertas van apareciendo a los lados.
 *
 * El largo NO es una constante: sale de cuántas puertas tiene el catálogo
 * (`corridorEndZ`), así que sumar un experimento alarga el pasillo y le pone
 * su luminaria sin tocar este archivo.
 */
export function LobbyScene() {
  // El pasillo entero como recinto: el jugador se mueve libre adentro y no
  // puede cruzar las paredes ni las dos puntas. Va acá y no en cada pared
  // porque es UNA sola prueba por frame, y porque las paredes son planos sin
  // espesor — lo que encierra al jugador es el rectángulo, no la geometría.
  useBounds({
    min: [-CORRIDOR_HALF_W, END_Z],
    max: [CORRIDOR_HALF_W, CORRIDOR_BACK_Z],
  });

  return (
    <group>
      {/* Cada <Suspense> de acá abajo es obligatorio, no decorativo.
          Ver "TRAMPA IMPORTANTE" al pie del archivo antes de tocarlos. */}
      <Suspense fallback={null}>
        <Floor />
      </Suspense>
      <Suspense fallback={null}>
        <Walls />
      </Suspense>

      {/* Techo. Emisión propia baja: es la única superficie a la que las
          luminarias no le llegan (quedan pegadas a él, casi sin ángulo).
          Queda por debajo de 1 para no cruzar el umbral del bloom y
          convertirse en una mancha brillante sobre la cabeza. */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, CORRIDOR_HEIGHT, MID_Z]}
      >
        <planeGeometry args={[CORRIDOR_WIDTH, LENGTH]} />
        <meshStandardMaterial
          color={CEILING_COLOR}
          emissive="#8f9aa8"
          emissiveIntensity={0.1}
          roughness={0.97}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Luminarias lineales, como las del pasillo de referencia: una barra
          oscura con el tubo emisivo adentro. El material emisivo da el brillo
          y el bloom; la pointLight de al lado es la que ilumina de verdad —
          un emissive por sí solo no ilumina nada en three.js. */}
      {LAMPS.map((z) => (
        <group key={z}>
          {/* Carcasa. */}
          <mesh position={[0, CORRIDOR_HEIGHT - 0.05, z]}>
            <boxGeometry args={[0.42, 0.09, 2]} />
            <meshStandardMaterial color="#e6e9ee" roughness={0.7} />
          </mesh>

          {/* Difusor: un panel ancho y apenas encendido, no un tubo. Antes
              era una barra fina con emissiveIntensity 1.5 y, al pasar el
              umbral del bloom, cada luminaria se convertía en una estrella
              que dejaba ciego el fondo del pasillo. Bajarlo POR DEBAJO de 1
              es lo que lo vuelve un panel difuminado: ilumina, pero no
              florece. El blanco puro tampoco servía — con la luz encima
              seguía pasando el umbral, así que el difusor va en un blanco
              apenas gris.

              Está bajo a propósito (0.16): el objetivo es que se distinga la
              FORMA rectangular de la luminaria. Cuanto más se sube, más se
              come el borde del panel el resplandor, hasta que la lámpara
              deja de tener silueta y queda una mancha. */}
          <mesh position={[0, CORRIDOR_HEIGHT - 0.1, z]}>
            <boxGeometry args={[0.38, 0.015, 1.94]} />
            <meshStandardMaterial
              color="#e9ecf1"
              emissive="#fdf7ee"
              emissiveIntensity={0.16}
              roughness={0.9}
            />
          </mesh>

          {/* La luz de verdad (un emissive no ilumina nada en three.js). Va
              repartida en dos puntos a lo largo del panel en vez de uno solo
              en el medio: una fuente puntual dibuja un óvalo marcado en el
              piso, y dos separadas se leen como una luz de panel.

              La altura importa MÁS que la intensidad. Estas luces estaban a
              35 cm del techo y, por la caída con el cuadrado de la distancia,
              lo quemaban a blanco puro: esa era la mancha enorme sobre cada
              lámpara — no era el bloom. Bajadas a 90 cm, el techo recibe una
              fracción de eso y la luminaria se lee como un panel encendido y
              no como un agujero al sol. */}
          {[-0.55, 0.55].map((dz) => (
            <pointLight
              key={dz}
              position={[0, CORRIDOR_HEIGHT - 0.9, z + dz]}
              intensity={1.5}
              distance={7}
              decay={2}
              color="#fdf7ee"
            />
          ))}
        </group>
      ))}

      {/* Zócalo corrido en las dos paredes: además de dar escala, tapa la
          juntura piso-pared, que en ángulo rasante se ve como una fisura. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (CORRIDOR_HALF_W - 0.03), 0.06, MID_Z]}
          castShadow
        >
          <boxGeometry args={[0.06, 0.12, LENGTH]} />
          <meshStandardMaterial
            color="#1b2233"
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
      ))}

      {/* Franja guía en el piso, por el centro del pasillo. En un visor, sin
          referencias en el suelo cuesta saber hacia dónde se está caminando. */}
      <mesh position={[0, 0.006, MID_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.18, LENGTH - 1]} />
        <meshStandardMaterial
          color="#0b2b28"
          emissive={ACCENT}
          emissiveIntensity={1.4}
          toneMapped={false}
          transparent
          opacity={0.7}
        />
      </mesh>

      {lobbyDoors.map((door) => (
        <Suspense key={door.href} fallback={null}>
          <Door {...door} />
        </Suspense>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------ */
/*
 * TRAMPA IMPORTANTE — cada carga necesita su propio <Suspense>.
 *
 * `useTiledPbrTexture` (useTexture) y `useGLTF` suspenden mientras
 * descargan. Con React 19.2 + @react-three/drei 10, si varias de esas
 * cargas cuelgan del MISMO límite de <Suspense>, ese límite no se resuelve
 * nunca: la escena queda en negro para siempre y no se imprime ni un error
 * ni un warning en consola. Nada indica qué pasó.
 *
 * La regla, al agregar una superficie o un modelo nuevo: envolverlo en su
 * propio <Suspense fallback={null}>. No alcanza con separarlo en un
 * componente aparte — los hermanos que comparten límite se bloquean igual.
 */

/** Piso. Usa la misma tela que las paredes: es lo que pidió el proyecto y,
 *  de paso, resuelve un problema real del mármol anterior — un piso espejado
 *  duplicaba las luminarias y la escena terminaba con el doble de puntos
 *  brillantes de los que tiene un pasillo de verdad. Un poco más oscuro que
 *  las paredes, porque un piso que refleja igual que la pared no se lee como
 *  piso. */
function Floor() {
  const tex = useTiledPbrTexture("/textures/lab-wall/fabric_081c", 2, 10, true);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, MID_Z]}
      receiveShadow
    >
      <planeGeometry args={[CORRIDOR_WIDTH, LENGTH]} />
      <meshStandardMaterial
        {...tex}
        color="#cfd4da"
        aoMapIntensity={0.9}
        roughness={0.9}
        metalness={0}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

/** Las dos paredes largas y las dos de las puntas. La colisión no vive acá:
 *  es el recinto que registra LobbyScene. */
function Walls() {
  // Fabric081C (ambientCG): tela lisa y neutra, casi sin dibujo — el
  // carácter se lo da la rugosidad. Por eso se tilea suave (unos 2 m por
  // repetición): apretarla no agregaría detalle, solo aliasing al mirarla en
  // ángulo rasante, que es como se ve una pared de pasillo casi todo el
  // tiempo. El `ao` va cargado porque en una superficie mate es lo único que
  // le da relieve al tejido.
  const tex = useTiledPbrTexture("/textures/lab-wall/fabric_081c", 8, 2, true);

  return (
    <>
      {[-1, 1].map((side) => (
        <SideWall key={side} side={side} tex={tex} />
      ))}
      <EndWalls tex={tex} />
    </>
  );
}

type PbrTex = ReturnType<typeof useTiledPbrTexture>;

function SideWall({ side, tex }: { side: number; tex: PbrTex }) {
  const x = side * CORRIDOR_HALF_W;

  return (
    <mesh
      position={[x, CORRIDOR_HEIGHT / 2, MID_Z]}
      rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
      receiveShadow
    >
      <planeGeometry args={[LENGTH, CORRIDOR_HEIGHT]} />
      <meshStandardMaterial
        {...tex}
        color={WALL_COLOR}
        aoMapIntensity={0.85}
        roughness={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Fondo del pasillo y cierre por detrás del jugador: sin la de atrás, al
 *  girar se vería el pasillo abierto al vacío. */
function EndWalls({ tex }: { tex: PbrTex }) {
  return (
    <>
      {[END_Z, CORRIDOR_BACK_Z].map((z) => (
        <mesh key={z} position={[0, CORRIDOR_HEIGHT / 2, z]} receiveShadow>
          <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_HEIGHT]} />
          <meshStandardMaterial
            {...tex}
            color={WALL_COLOR}
            roughness={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}
