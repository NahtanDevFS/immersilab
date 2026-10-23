"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTiledPbrTexture } from "../shell/useTiledPbrTexture";
import { useBounds } from "@/lib/collision/useCollider";
import { Door } from "./Door";
import { useViewMode } from "@/lib/view/viewMode";
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
  // puede cruzar las paredes ni las dos puntas. Va aquí y no en cada pared
  // porque es UNA sola prueba por frame, y porque las paredes son planos sin
  // espesor — lo que encierra al jugador es el rectángulo, no la geometría.
  useBounds({
    min: [-CORRIDOR_HALF_W, END_Z],
    max: [CORRIDOR_HALF_W, CORRIDOR_BACK_Z],
  });

  return (
    <group>
      {/* Cada <Suspense> de aquí abajo es obligatorio, no decorativo.
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
          y el bloom, pero un emissive no ilumina nada en three.js: la luz
          que cae al piso es la de LightPools y la de NearbyLampLights. */}
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
              deja de tener silueta y queda una mancha.

              Va sin iluminación (meshBasic): con las luces reales solo cerca
              del jugador, un difusor iluminado se veía blanco en la luminaria
              de al lado y gris en las del fondo. Así todas se ven igual de
              encendidas. */}
          <mesh position={[0, CORRIDOR_HEIGHT - 0.1, z]}>
            <boxGeometry args={[0.38, 0.015, 1.94]} />
            <meshBasicMaterial color="#f1efe9" />
          </mesh>

        </group>
      ))}

      <LightPools />
      <NearbyLampLights />
      {/* Relleno propio del pasillo: con las luces reales solo cerca del
          jugador, el fondo quedaba más apagado que antes. Una luz de
          hemisferio cuesta casi nada (no depende de la distancia). */}
      <hemisphereLight args={["#fdf7ee", "#8a8f96", 0.2]} />

      {/* Zócalo corrido en las dos paredes: además de dar escala, tapa la
          juntura piso-pared, que en ángulo rasante se ve como una fisura. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (CORRIDOR_HALF_W - 0.03), 0.06, MID_Z]}
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
/* Luz "falsa" de las luminarias                                             */
/* ------------------------------------------------------------------------ */

/*
 * Antes cada luminaria tenía dos pointLight: unas 30 luces reales. Era lo que
 * más pesaba del lobby (≈20 fps en el visor de un celular de gama media):
 * three.js recorre TODAS las luces en cada píxel de cada superficie, y en la
 * vista VR la escena se dibuja dos veces.
 *
 * Ahora la luz se reparte en dos capas, como en los juegos de celular:
 * - LightPools: un charco de luz pintado en el piso bajo cada luminaria. No
 *   calcula nada, solo se suma al color del piso; desde lejos el pasillo se
 *   ve iluminado igual que antes.
 * - NearbyLampLights: UNA sola luz real, en la luminaria más cercana al
 *   jugador: es la que ilumina de verdad lo que está al lado (la puerta, el
 *   piso a los pies). Eran 4; se bajó a 1 para el visor, donde el pasillo es
 *   la pantalla más pesada.
 */

/** Cuántas luces reales hay en total, vayan donde vayan. */
const REAL_LIGHTS = 1;
/**
 * La luz se apaga suave al alejarse de su luminaria: entera hasta
 * FADE_START y en cero a mitad de camino hasta la siguiente (FADE_END). Ahí
 * es donde la más cercana pasa a ser la otra, así que al cambiar de
 * luminaria la luz ya está apagada y no se ve un salto. Caminando, se nota
 * como pasar bajo una lámpara: un poco más de luz debajo de cada una.
 */
const FADE_START = 0.6;
const FADE_END = LAMP_SPACING / 2;
/** Lo que antes daban las dos luces de cada luminaria, juntas en una. */
const LAMP_INTENSITY = 3;
/**
 * Más abajo que las de antes (estaban a 90 cm del techo): con una sola luz
 * por luminaria en vez de dos, a 90 cm quemaba un círculo en el techo. El
 * resplandor del techo ahora lo pinta LightPools, parejo en todas.
 */
const LAMP_LIGHT_Y = CORRIDOR_HEIGHT - 1.2;

function NearbyLampLights() {
  const lights = useRef<Array<THREE.PointLight | null>>([]);
  const work = useRef({ order: LAMPS.map((z) => ({ z, d: 0 })), camPos: new THREE.Vector3() });

  useFrame(({ camera }) => {
    const { order, camPos } = work.current;
    camera.getWorldPosition(camPos);
    for (const lamp of order) lamp.d = Math.abs(lamp.z - camPos.z);
    order.sort((a, b) => a.d - b.d);
    for (let i = 0; i < REAL_LIGHTS; i++) {
      const light = lights.current[i];
      if (!light) continue;
      const lamp = order[i];
      if (!lamp) {
        light.intensity = 0;
        continue;
      }
      light.position.z = lamp.z;
      const fade = 1 - THREE.MathUtils.smoothstep(lamp.d, FADE_START, FADE_END);
      light.intensity = LAMP_INTENSITY * fade;
    }
  });

  // Siempre las mismas: cambiar cuántas luces hay obliga a three.js a
  // recompilar todos los materiales, que es un tirón de medio segundo.
  return (
    <>
      {Array.from({ length: REAL_LIGHTS }, (_, i) => (
        <pointLight
          key={i}
          ref={(light) => {
            lights.current[i] = light;
          }}
          position={[0, LAMP_LIGHT_Y, LAMPS[0]]}
          intensity={0}
          distance={7}
          decay={2}
          color="#fdf7ee"
        />
      ))}
    </>
  );
}

/** Un degradé radial blanco → transparente, para los charcos de luz. */
function usePoolTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // Caída suave, parecida a la de una luz real: casi plana en el centro
    // y sin borde visible.
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.75)");
    g.addColorStop(0.7, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

/**
 * Un charco de luz pintado bajo cada luminaria en el piso, y otro alrededor
 * de ella en el techo (el resplandor que antes le daban sus luces). Mezcla
 * aditiva: aclara la superficie como lo haría la luz, sin tapar la textura.
 * El del techo queda detrás de la carcasa, así que solo se ve el halo.
 */
function LightPools() {
  const texture = usePoolTexture();
  return (
    <>
      {LAMPS.map((z) => (
        <group key={z}>
          <mesh position={[0, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
            <planeGeometry args={[CORRIDOR_WIDTH, 4.6]} />
            <meshBasicMaterial
              map={texture}
              color="#fdf7ee"
              transparent
              opacity={0.1}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, CORRIDOR_HEIGHT - 0.004, z]} rotation={[Math.PI / 2, 0, 0]} renderOrder={-1}>
            <planeGeometry args={[CORRIDOR_WIDTH * 0.9, 3.6]} />
            <meshBasicMaterial
              map={texture}
              color="#fdf7ee"
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </>
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
  const tex = useLobbySurface(useTiledPbrTexture("/textures/lab-wall/fabric_081c", 2, 10, true));

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, MID_Z]}
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

/** Las dos paredes largas y las dos de las puntas. La colisión no vive aquí:
 *  es el recinto que registra LobbyScene. */
function Walls() {
  // Fabric081C (ambientCG): tela lisa y neutra, casi sin dibujo — el
  // carácter se lo da la rugosidad. Por eso se tilea suave (unos 2 m por
  // repetición): apretarla no agregaría detalle, solo aliasing al mirarla en
  // ángulo rasante, que es como se ve una pared de pasillo casi todo el
  // tiempo. El `ao` va cargado porque en una superficie mate es lo único que
  // le da relieve al tejido.
  const tex = useLobbySurface(useTiledPbrTexture("/textures/lab-wall/fabric_081c", 8, 2, true));

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

/**
 * En la vista VR, las superficies del pasillo van sin mapa de relieve. Son
 * casi toda la pantalla, y el relieve es la textura más cara por píxel; con
 * la escena dibujada dos veces (un ojo cada vez) el pasillo era lo más pesado
 * del visor. A través de los lentes la tela de cerca se ve apenas más plana.
 * Fuera del visor queda igual que siempre.
 */
function useLobbySurface(tex: PbrTex): PbrTex {
  const vr = useViewMode() === "vr";
  return vr ? { ...tex, normalMap: null as unknown as PbrTex["normalMap"] } : tex;
}

function SideWall({ side, tex }: { side: number; tex: PbrTex }) {
  const x = side * CORRIDOR_HALF_W;

  return (
    <mesh
      position={[x, CORRIDOR_HEIGHT / 2, MID_Z]}
      rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
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
        <mesh key={z} position={[0, CORRIDOR_HEIGHT / 2, z]}>
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
