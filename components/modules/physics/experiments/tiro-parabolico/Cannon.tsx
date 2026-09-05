"use client";

import { useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

/** Textura de roble del propio pack del modelo
 *  (`NavalCannon/Wood3_by_Andrw9864/`), copiada a `public/`. El .glb
 *  conserva las UVs del .obj original, así que la veta cae donde el autor la
 *  mapeó — no hace falta reproyectar nada. */
const WOOD_MAP = "/textures/wood/red-oak.jpg";
const WOOD_BUMP = "/textures/wood/red-oak-bump.jpg";

useGLTF.preload("/models/cannon-barrel.glb");
useGLTF.preload("/models/cannon-carriage.glb");
useTexture.preload([WOOD_MAP, WOOD_BUMP]);

/**
 * Cañón naval, partido en dos piezas: el tubo (que se eleva con el slider de
 * ángulo) y la cureña con las ruedas (que se queda quieta).
 *
 * El modelo original (`NavalCannon/Naval cannon.obj`, 11 MB, 72k caras) viene
 * de 3ds Max con los dos problemas típicos de esos packs:
 *
 * 1. **Es una sola malla.** El tubo no está separado, así que no se podía
 *    animar el ángulo. Se parte por material: `wire_225143087` es el tubo
 *    entero, todo lo demás es la cureña (`scripts/obj2glb.py`).
 * 3. **Las normales vienen mal en parte de la cureña**, lo que hacía que
 *    esas caras salieran negras con cualquier material iluminado. Se
 *    recalculan al convertir (opción `renorm`).
 * 2. **No trae materiales reales.** Los 14 "wire_XXXXXXXX" son los colores
 *    de viewport de 3ds Max — azules, verdes y morados aleatorios. Si se
 *    usaran tal cual, el cañón sería un arlequín. Por eso acá se les asigna
 *    hierro y madera a mano, según lo que es cada grupo en el render de
 *    referencia (`NavalCannon/Renders/Render1.jpg`).
 *
 * Resultado: 119 KB + 307 KB, contra los 11 MB del .obj.
 */

/**
 * Reparto de materiales por pieza.
 *
 * Los materiales del .obj se llaman "wire_XXXXXXXX" — son los colores de
 * viewport de 3ds Max y no dicen qué pieza son. Para saberlo hubo que
 * pintar cada grupo de un tono distinto y mirarlo en pantalla. Vale la pena
 * dejar anotado lo que salió, porque es contraintuitivo:
 *
 *   wire_008110135   476 tri   ← el CUERPO de la cureña
 *   wire_027177148  1144 tri   ← ruedas
 *   wire_088177027  1216 tri   ← cubos de las ruedas
 *   wire_135006006  4914 tri   ← detalle de ruedas
 *   wire_028028177  5120 tri   ← detalle interno
 *   wire_086086086   490 tri   ← muñoneras (hierro)
 *
 * El cuerpo, que es la pieza más grande de todas, tiene MENOS triángulos que
 * casi cualquier otra: es una caja, mientras que las ruedas son superficies
 * de revolución. Por eso los intentos de repartir los materiales por
 * cantidad de triángulos fallaron — pintaban el cuerpo de hierro y la
 * cureña quedaba negra.
 */
/** Muñoneras: van en teal, es el eje de giro del tubo. */
const ACCENT_GROUPS = new Set(["wire_086086086", "wire_229154215"]);

/** Pernos y apliques: bronce. */
const BRASS_GROUPS = new Set([
  "wire_138008110",
  "wire_148177027",
  "wire_088177027", // cubos de las ruedas
  "wire_140088225",
]);

/*
 * Paleta: la del render de referencia del propio pack
 * (`NavalCannon/Renders/Render1.jpg`) — cureña y ruedas de roble, tubo de
 * hierro fundido oscuro casi negro, y todos los herrajes (pernos, aros de
 * las ruedas, cubos, muñoneras) en acero, no en bronce.
 *
 * Se probó antes la pieza entera en hierro del mismo tono: se leía limpia
 * pero perdía el contraste madera/metal, que es justo lo que hace que un
 * cañón se vea como un cañón. El riesgo de la madera es irse a naranja
 * fluorescente contra el verde del pasto, así que el marrón va desaturado y
 * bien mate.
 *
 * Ojo con los valores: un hex se convierte a espacio lineal y después pasa
 * por el tone mapping ACES, y en ese camino se oscurece bastante. Los tonos
 * de acá son más claros en el selector de lo que salen en pantalla — un
 * #111 de verdad sale negro absoluto y se pierde toda la forma. Misma
 * trampa que el techo del lobby (ver PLAN_DESARROLLO.md §2.6).
 */

/** Tubo: hierro fundido, casi negro como en el render. Metalness alto para
 *  que agarre el reflejo del cielo a lo largo del cañón — sin ese brillo un
 *  objeto tan oscuro se convierte en una silueta plana sin volumen. */
const BARREL = new THREE.MeshStandardMaterial({
  color: "#2b2e34",
  metalness: 0.92,
  roughness: 0.34,
  envMapIntensity: 1.3,
  side: THREE.DoubleSide,
});

/** Cureña y ruedas: roble, con la textura del pack. El `color` NO es el
 *  color de la madera — se multiplica sobre la textura, así que tiñe y
 *  atenúa: acá baja la veta a un roble oscuro, porque a plena luz de la
 *  escena la textura sale naranja fluorescente contra el pasto. Se probó con
 *  un gris puro y la madera quedaba descolorida, sin nada de calidez; por eso
 *  el atenuador es un marrón y no un neutro.
 *
 *  Es un parámetro suelto y no un material hecho, porque el material se arma
 *  recién cuando la textura terminó de cargar (ver `useWoodBodyMaterial`). */
const BODY_PARAMS: THREE.MeshStandardMaterialParameters = {
  color: "#5c4028",
  metalness: 0.04,
  roughness: 0.85,
  envMapIntensity: 0.5,
  bumpScale: 0.6,
  // FrontSide, NO DoubleSide: la cureña tiene caras interiores pegadas a las
  // exteriores, y dibujando las dos caras se peleaban por el z-buffer — ese
  // era el parpadeo de los laterales al mover la cámara. Las normales del
  // .obj ya vienen recalculadas desde la conversión (`renorm`), así que
  // descartar las traseras no deja ninguna cara negra.
  side: THREE.FrontSide,
};

/** Herrajes: hierro forjado negro — pernos, aros y cubos de las ruedas. Se
 *  probó bronce (quedaba de juguete) y acero claro (los apliques saltaban a
 *  la vista más que el cañón). En negro los herrajes dibujan la pieza sin
 *  competirle a la madera; el metalness alto es lo que evita que se lean
 *  como plástico. */
const BRASS = new THREE.MeshStandardMaterial({
  color: "#191b1f",
  metalness: 0.9,
  roughness: 0.42,
  envMapIntensity: 1.1,
  side: THREE.DoubleSide,
});

/** Muñoneras: el mismo hierro negro que el resto de los herrajes. */
const ACCENT = BRASS;

/**
 * Reemplaza los materiales de viewport por hierro y madera.
 *
 * Se clona la escena antes de tocarla porque `useGLTF` cachea el resultado y
 * lo comparte: mutar los materiales del original afectaría a cualquier otro
 * componente que cargue el mismo archivo.
 */
function useWoodBodyMaterial() {
  const [map, bump] = useTexture([WOOD_MAP, WOOD_BUMP], (loaded) => {
    // La configuración va en el callback de carga de useTexture y no después:
    // la textura es un color, y sin marcarla como sRGB three la lee como
    // datos lineales y la madera sale lavada y con el tono corrido.
    for (const tex of Array.isArray(loaded) ? loaded : [loaded]) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
    }
    const [diffuse] = Array.isArray(loaded) ? loaded : [loaded];
    diffuse.colorSpace = THREE.SRGBColorSpace;
  });

  return useMemo(
    () => new THREE.MeshStandardMaterial({ ...BODY_PARAMS, map, bumpMap: bump }),
    [map, bump],
  );
}

function useDressedModel(
  path: string,
  body: THREE.Material,
  forceIron = false,
) {
  const { scene } = useGLTF(path);

  return useMemo(() => {
    const copy = scene.clone();
    copy.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;

      const name = (node.material as THREE.Material)?.name ?? "";
      node.material = forceIron
        ? BARREL
        : ACCENT_GROUPS.has(name)
          ? ACCENT
          : BRASS_GROUPS.has(name)
            ? BRASS
            : body;
    });
    return copy;
  }, [scene, body, forceIron]);
}

/** El tubo, en hierro negro. */
export function CannonBarrel() {
  // El tubo no usa la madera; se le pasa BARREL como cuerpo para no cargar la
  // textura (y no suspender) en una pieza que es toda de hierro.
  const model = useDressedModel("/models/cannon-barrel.glb", BARREL, true);
  return <primitive object={model} position={[0, -TRUNNION_Y, -TRUNNION_Z]} />;
}

/** Cureña y ruedas. */
export function CannonCarriage() {
  const body = useWoodBodyMaterial();
  const model = useDressedModel("/models/cannon-carriage.glb", body);
  return <primitive object={model} />;
}

/*
 * Medidas tomadas del .obj analizándolo, no a ojo. El modelo tiene Y arriba
 * y el tubo a lo largo de Z, con la culata en -Z y la **BOCA en +Z**.
 *
 * Eso último se determinó midiendo qué extremo es hueco respecto del eje del
 * ánima: en Z=+52.8 el radio mínimo es 3.53 (un anillo — el ánima), y en
 * Z=-39.5 es 0.02 (macizo — el cascabel). No es un detalle menor: tenerlo al
 * revés dejaba el cañón disparando hacia atrás.
 */

/** Y más bajo del modelo: la parte de abajo de las ruedas. Se usa para
 *  apoyarlo en el piso en vez de dejarlo hundido o flotando. */
export const MODEL_MIN_Y = -41.4;

/** Alto total del modelo, para calcular la escala. */
export const MODEL_HEIGHT = 69.7;

/** Muñones: el eje real sobre el que gira el tubo. Se localizaron por el
 *  material `wire_086086086`, que sobresale a ±15 en X (mucho más que el
 *  radio del tubo, ~7) — son las muñoneras. Su centro cae justo sobre el eje
 *  del ánima, lo que confirma la ubicación. */
export const TRUNNION_Y = 5.8;
export const TRUNNION_Z = 5.8;

/**
 * **El tubo viene inclinado 19° hacia arriba dentro del archivo.**
 *
 * Es la causa de que el ángulo dibujado no coincidiera con el del slider: la
 * elevación se aplicaba sobre una pieza que ya arrancaba 19° levantada, así
 * que 45° en el slider se dibujaban como 64°. Se midió ajustando una recta
 * al eje del ánima (dY/dZ = 0.3437 → 19.0°, y la boca es el extremo alto).
 * La escena lo compensa con `REST_TILT - angulo`.
 */
export const REST_TILT = (19.0 * Math.PI) / 180;

/** Distancia del muñón (Z=5.8) a la boca (Z=52.8) sobre el eje del tubo:
 *  √(47² + 16.15²) en unidades del modelo. Con ella se calcula dónde está la
 *  boca a cualquier ángulo, que es de donde sale el proyectil. */
export const MUZZLE_DISTANCE = 49.7;

/** 2.8 m de alto. El cañón anterior era una caja de 1 m; este se lee como
 *  una pieza de artillería de verdad y da escala al resto de la escena. */
export const SCALE = 2.8 / MODEL_HEIGHT;
