"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

useGLTF.preload("/models/cannon-barrel.glb");
useGLTF.preload("/models/cannon-carriage.glb");

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
 * Paleta: cañón negro con los herrajes en bronce y un acento teal.
 *
 * Ojo con los valores: un hex se convierte a espacio lineal y después pasa
 * por el tone mapping ACES, y en ese camino se oscurece bastante. Los
 * "negros" de acá son grises medios en el selector justamente por eso — un
 * #111 de verdad sale negro absoluto y se pierde toda la forma. Misma
 * trampa que el techo del lobby (ver PLAN_DESARROLLO.md §2.6).
 */

/** Tubo: hierro negro pulido. Metalness alto para que agarre el reflejo del
 *  cielo a lo largo del cañón — sin ese brillo, un objeto negro se convierte
 *  en una silueta plana sin volumen. */
const BARREL = new THREE.MeshStandardMaterial({
  color: "#2a2d33",
  metalness: 0.9,
  roughness: 0.38,
  envMapIntensity: 1.2,
  side: THREE.DoubleSide,
});

/** Cureña y ruedas: negro mate, tirando a grafito. Más apagado que el tubo
 *  para que las dos piezas se distingan aunque las dos sean oscuras. */
const BODY = new THREE.MeshStandardMaterial({
  color: "#33373f",
  metalness: 0.25,
  roughness: 0.75,
  // DoubleSide: partes de la cureña vienen con las normales invertidas desde
  // el .obj original y con FrontSide salían negras del todo.
  side: THREE.DoubleSide,
});

/** Herrajes: bronce. Es el color natural de los apliques de artillería y
 *  contra el negro es lo que le da lectura a la pieza. */
const BRASS = new THREE.MeshStandardMaterial({
  color: "#b8863b",
  metalness: 0.85,
  roughness: 0.35,
  envMapIntensity: 1.3,
  side: THREE.DoubleSide,
});

/** Muñoneras en el teal del laboratorio: ata el cañón a la paleta del resto
 *  de la app y marca justo el eje sobre el que gira el tubo, que es el dato
 *  que el experimento quiere que se mire. */
const ACCENT = new THREE.MeshStandardMaterial({
  color: "#1d5f57",
  metalness: 0.6,
  roughness: 0.4,
  emissive: "#2dd4bf",
  emissiveIntensity: 0.25,
  side: THREE.DoubleSide,
});

/**
 * Reemplaza los materiales de viewport por hierro y madera.
 *
 * Se clona la escena antes de tocarla porque `useGLTF` cachea el resultado y
 * lo comparte: mutar los materiales del original afectaría a cualquier otro
 * componente que cargue el mismo archivo.
 */
function useDressedModel(path: string, forceIron = false) {
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
            : BODY;
    });
    return copy;
  }, [scene, forceIron]);
}

/** El tubo, en hierro negro. */
export function CannonBarrel() {
  const model = useDressedModel("/models/cannon-barrel.glb", true);
  return <primitive object={model} position={[0, -TRUNNION_Y, -TRUNNION_Z]} />;
}

/** Cureña y ruedas. */
export function CannonCarriage() {
  const model = useDressedModel("/models/cannon-carriage.glb");
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
