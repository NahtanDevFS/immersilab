"use client";

import { Suspense } from "react";
import * as THREE from "three";
import { useTiledPbrTexture } from "../shell/useTiledPbrTexture";
import { Door } from "./Door";
import { lobbyDoors, type LobbyDoor } from "./catalog";

const HALF_W = 10;
const HALF_D = 10;
const HEIGHT = 5;

const TRIM_COLOR = "#1b2233"; // zócalo y cornisa: metal oscuro anodizado
// Ojo con los colores oscuros: un hex como #222c40 parece "gris azulado" en
// un selector, pero pasado a lineal y despues por el tone mapping ACES sale
// casi negro en pantalla. El techo estuvo tres iteraciones viendose como un
// agujero por esto, no por falta de luz.
const CEILING_COLOR = "#aeb9c9";
const ACCENT = "#2dd4bf"; // mismo teal que --lab-accent en globals.css

/** Emisivos por encima de 1 con toneMapped={false} → los agarra el bloom. */
const STRIP_INTENSITY = 2.4;
const GUIDE_INTENSITY = 1.6;

/**
 * Escena 3D del lobby.
 *
 * Antes era una caja de seis planos: piso, techo de color liso y cuatro
 * paredes. El problema no era la textura sino que no había NADA que diera
 * escala — sin zócalo, sin cornisa, sin columnas, el ojo no tiene con qué
 * medir y una pared de 20 metros se lee igual que una de 3.
 *
 * Lo que se agregó, en orden de cuánto aporta:
 *   1. Tiras de luz en el techo. Son la fuente de luz visible de la sala y
 *      lo que alimenta el bloom; además reemplazan al plano negro que
 *      ocupaba medio campo visual al mirar arriba en el visor.
 *   2. Zócalo y cornisa. Dos cajas finas por pared, casi gratis, y de
 *      inmediato la sala tiene altura medible.
 *   3. Nichos por puerta. Cada experimento pasa de ser una calcomanía sobre
 *      la pared a un "stand" con su propio retranqueo y su luz de acento.
 *   4. Pilastras laterales, que dan ritmo a las paredes largas.
 *   5. Franjas guía en el piso hacia cada puerta. Decoran, pero sobre todo
 *      resuelven un problema real: en un visor, sin referencias en el suelo
 *      cuesta saber hacia dónde estás caminando.
 *
 * Los elementos 3, 4 y 5 se generan a partir de `lobbyDoors`, así que
 * agregar un experimento al catálogo también le da su nicho, su luz y su
 * franja — sin tocar este archivo.
 */
export function LobbyScene() {
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

      {/* Techo */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, HEIGHT, 0]}>
        <planeGeometry args={[HALF_W * 2, HALF_D * 2]} />
        {/* El techo es la unica superficie a la que las luminarias no le
            llegan (quedan pegadas a el, casi sin angulo), asi que se le da
            una emision propia baja. Ademas de resolverlo, es como se ve un
            techo luminoso real. La intensidad queda por debajo de 1 a
            proposito: asi no cruza el umbral del bloom y no se convierte en
            una mancha brillante sobre la cabeza — que en un visor, donde el
            techo ocupa medio campo visual al mirar arriba, seria peor que
            el negro que teniamos. */}
        <meshStandardMaterial
          color={CEILING_COLOR}
          emissive="#5d6a80"
          emissiveIntensity={0.18}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ---------------------------------------------------------------- */}
      {/* Zócalo y cornisa: 4 + 4 cajas finas. */}
      <Trim y={0.07} depth={0.09} height={0.14} />
      <Trim y={HEIGHT - 0.18} depth={0.07} height={0.16} />

      {/* Pilastras: dan ritmo a las paredes laterales, que son las más
          largas y las que más se leían como un plano vacío. */}
      {[-5, 0, 5].map((z) => (
        <group key={z}>
          <Pilaster position={[-HALF_W + 0.15, HEIGHT / 2, z]} />
          <Pilaster position={[HALF_W - 0.15, HEIGHT / 2, z]} />
        </group>
      ))}

      {/* ---------------------------------------------------------------- */}
      {/* Tiras de luz del techo. Son la fuente visible de la sala: el
          material emisivo da el brillo (y el bloom), y la pointLight de al
          lado es la que realmente ilumina. Van juntas porque un emissive
          por sí solo no ilumina nada en three.js. */}
      {[-8, -5, -2, 1, 4, 7].map((z) => (
        <group key={z}>
          <mesh position={[0, HEIGHT - 0.08, z]}>
            <boxGeometry args={[HALF_W * 1.7, 0.06, 0.22]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fff4e2"
              emissiveIntensity={STRIP_INTENSITY}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[0, HEIGHT - 0.6, z]}
            intensity={11}
            distance={13}
            decay={2}
            color="#fff4e2"
          />
        </group>
      ))}

      {/* ---------------------------------------------------------------- */}
      {/* Un nicho, una franja guía y una luz de acento por experimento. */}
      {lobbyDoors.map((door) => (
        <DoorBay key={door.href} door={door} />
      ))}

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
 * Este bug ya existía antes de esta refactorización — el lobby estaba en
 * negro en cada carga en frío desde que se le pusieron texturas, y solo
 * aparecía después de que el hot-reload lo re-renderizara, que es
 * justamente por lo que costó tanto verlo en desarrollo.
 *
 * La regla, al agregar una superficie o un modelo nuevo: envolverlo en su
 * propio <Suspense fallback={null}>. No alcanza con separarlo en un
 * componente aparte — los hermanos que comparten límite se bloquean igual.
 */

/** Piso pulido. roughness y metalness actúan como multiplicadores sobre el
 *  roughnessMap: bajarlos hace que el mármol refleje las tiras de luz del
 *  techo, y ese reflejo es la mitad de la sensación de "sala real". */
function Floor() {
  // Marble 01 (Poly Haven) es ~1.5 m de ancho real → ~13 repeticiones en un
  // piso de 20 m. El `color` lo enfría: en su tono original, bajo luz
  // cálida, se leía como madera en vez de como porcelanato técnico.
  const tex = useTiledPbrTexture("/textures/floor/marble_01", 13, 13);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[HALF_W * 2, HALF_D * 2]} />
      <meshStandardMaterial
        {...tex}
        color="#aebccd"
        roughness={0.4}
        metalness={0.2}
        envMapIntensity={1}
      />
    </mesh>
  );
}

function Walls() {
  // Fabric081C (ambientCG) es una tela lisa y neutra: casi no tiene dibujo,
  // el carácter se lo da la rugosidad. Por eso se tilea suave (2 m por
  // repetición) — apretarla no agregaría detalle, solo aliasing.
  const tex = useTiledPbrTexture("/textures/lab-wall/fabric_081c", 10, 3, true);

  return (
    <>
      <Wall position={[0, HEIGHT / 2, -HALF_D]} rotationY={0} width={HALF_W * 2} tex={tex} />
      <Wall position={[0, HEIGHT / 2, HALF_D]} rotationY={Math.PI} width={HALF_W * 2} tex={tex} />
      <Wall position={[-HALF_W, HEIGHT / 2, 0]} rotationY={Math.PI / 2} width={HALF_D * 2} tex={tex} />
      <Wall position={[HALF_W, HEIGHT / 2, 0]} rotationY={-Math.PI / 2} width={HALF_D * 2} tex={tex} />
    </>
  );
}

type PbrTex = ReturnType<typeof useTiledPbrTexture>;

function Wall({
  position,
  rotationY,
  width,
  tex,
}: {
  position: [number, number, number];
  rotationY: number;
  width: number;
  tex: PbrTex;
}) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]} receiveShadow>
      <planeGeometry args={[width, HEIGHT]} />
      {/* DoubleSide se mantiene por la razón original: si una rotación
          quedara mal, con una sola cara la pared se vería como un agujero
          abierto al vacío en vez de como una pared. */}
      <meshStandardMaterial
        {...tex}
        aoMapIntensity={0.8}
        roughness={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Anillo de moldura en las cuatro paredes, a la altura `y`. */
function Trim({
  y,
  depth,
  height,
}: {
  y: number;
  depth: number;
  height: number;
}) {
  const mat = (
    <meshStandardMaterial color={TRIM_COLOR} roughness={0.35} metalness={0.7} />
  );

  return (
    <group>
      {[-HALF_D, HALF_D].map((z) => (
        <mesh key={z} position={[0, y, z + (z < 0 ? depth / 2 : -depth / 2)]} castShadow>
          <boxGeometry args={[HALF_W * 2, height, depth]} />
          {mat}
        </mesh>
      ))}
      {[-HALF_W, HALF_W].map((x) => (
        <mesh key={x} position={[x + (x < 0 ? depth / 2 : -depth / 2), y, 0]} castShadow>
          <boxGeometry args={[depth, height, HALF_D * 2]} />
          {mat}
        </mesh>
      ))}
    </group>
  );
}

function Pilaster({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[0.3, HEIGHT, 0.7]} />
      <meshStandardMaterial color="#e8edf5" roughness={0.75} />
    </mesh>
  );
}

/**
 * El "stand" de un experimento: retranqueo oscuro detrás de la puerta,
 * contorno de acento, luz cenital y franja guía desde el centro de la sala.
 */
function DoorBay({ door }: { door: LobbyDoor }) {
  const [x, , z] = door.position;

  // La franja va desde cerca del centro de la sala hasta el pie de la
  // puerta. Se calcula del catálogo, así que una puerta nueva trae la suya.
  const guideStart = 3;
  const guideEnd = z + 1.4;
  const guideLength = Math.abs(guideStart - guideEnd);
  const guideMidZ = (guideStart + guideEnd) / 2;

  return (
    <group>
      {/* Retranqueo: panel oscuro un pelo delante de la pared. Hace que la
          puerta se lea metida en un hueco y no pegada encima. */}
      <mesh position={[x, 1.75, z + 0.04]} receiveShadow>
        <planeGeometry args={[3.7, 3.5]} />
        <meshStandardMaterial color="#141b29" roughness={0.85} />
      </mesh>

      {/* Contorno de acento del nicho (arriba y a los lados). */}
      <mesh position={[x, 3.5, z + 0.06]}>
        <boxGeometry args={[3.7, 0.05, 0.02]} />
        <AccentMaterial />
      </mesh>
      {[-1.85, 1.85].map((dx) => (
        <mesh key={dx} position={[x + dx, 1.75, z + 0.06]}>
          <boxGeometry args={[0.05, 3.5, 0.02]} />
          <AccentMaterial />
        </mesh>
      ))}

      {/* Luz de acento cenital. Sin sombra a propósito: la sombra ya la tira
          la luz principal, y un spot con shadow map por puerta multiplicaría
          el costo por nada. */}
      <spotLight
        position={[x, HEIGHT - 0.4, z + 2.2]}
        target-position={[x, 0, z]}
        angle={0.6}
        penumbra={0.8}
        intensity={22}
        distance={11}
        decay={2}
        color="#d8fbf5"
      />

      {/* Franja guía en el piso. */}
      <mesh
        position={[x, 0.006, guideMidZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.32, guideLength]} />
        <meshStandardMaterial
          color="#0b2b28"
          emissive={ACCENT}
          emissiveIntensity={GUIDE_INTENSITY}
          toneMapped={false}
          transparent
          opacity={0.75}
        />
      </mesh>
    </group>
  );
}

function AccentMaterial() {
  return (
    <meshStandardMaterial
      color="#0b2b28"
      emissive={ACCENT}
      emissiveIntensity={2}
      toneMapped={false}
    />
  );
}
