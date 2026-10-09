import * as THREE from "three";

/**
 * Mira de la vista VR: lo que se apunta con la cabeza.
 *
 * En el visor no hay puntero: se interactúa mirando un botón 3D y apretando
 * A en el control (o tocando la pantalla, que es lo que hace el botón de
 * muchos visores genéricos). Los botones se registran aquí y cada cuadro se
 * lanza un rayo desde el centro de la vista solo contra ellos — contra la
 * escena entera sería carísimo (árboles, pasto, edificios).
 */

interface GazeTarget {
  onSelect: () => void;
  enabled: () => boolean;
}

const targets = new Map<THREE.Object3D, GazeTarget>();
const raycaster = new THREE.Raycaster();
const CENTER = new THREE.Vector2(0, 0);
let hovered: THREE.Object3D | null = null;
/** Coordenadas de textura del punto mirado (para dibujar en el pizarrón). */
let hoveredUv: THREE.Vector2 | null = null;

export function registerGazeTarget(object: THREE.Object3D, target: GazeTarget): () => void {
  targets.set(object, target);
  return () => {
    targets.delete(object);
    if (hovered === object) hovered = null;
  };
}

/** Dónde, dentro de lo mirado, cae la mira (coordenadas de textura). */
export function getGazeUv(): THREE.Vector2 | null {
  return hoveredUv;
}

/** Lo que se está mirando ahora (o null). */
export function getGazed(): THREE.Object3D | null {
  return hovered;
}

function isVisible(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false;
  }
  return true;
}

/** Actualiza lo que se mira. Una vez por cuadro, con la cámara principal. */
export function updateGaze(camera: THREE.Camera): THREE.Object3D | null {
  raycaster.setFromCamera(CENTER, camera);
  const candidates: THREE.Object3D[] = [];
  targets.forEach((target, object) => {
    if (target.enabled() && isVisible(object)) candidates.push(object);
  });
  const hit = raycaster.intersectObjects(candidates, false)[0];
  hovered = hit?.object ?? null;
  hoveredUv = hit?.uv ?? null;
  return hovered;
}

/** Activa lo que se está mirando. Devuelve si había algo. */
export function selectGazed(): boolean {
  if (!hovered) return false;
  targets.get(hovered)?.onSelect();
  return true;
}


/*
 * "Mantener apretado" en la vista VR: A del control o el dedo apoyado en la
 * pantalla. Sirve para arrastrar paneles y dibujar en el pizarrón con la
 * mira. El dedo lo informa StereoView (escucha el canvas); el control se
 * lee acá mismo, para que quien pregunte no tenga que saber de dónde viene.
 */
let screenHeld = false;
let padHeld: () => boolean = () => false;

export function setScreenHeld(held: boolean) {
  screenHeld = held;
}

/** Quién sabe leer el botón A (StereoView le pasa el lector del control). */
export function setPadHeldReader(reader: () => boolean) {
  padHeld = reader;
}

export function isSelectHeld(): boolean {
  return screenHeld || padHeld();
}
