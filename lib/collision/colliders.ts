import * as THREE from "three";

/**
 * Registro de colisionadores de la escena.
 *
 * El problema que resuelve: hasta ahora `MovementController` movía la cámara
 * libremente y se podía atravesar las paredes del lobby, que son planos sin
 * ningún tipo de sólido detrás.
 *
 * Por qué un registro global y no un motor de física (Rapier, Cannon): lo
 * único que colisiona en todo el proyecto es el jugador contra geometría
 * QUIETA. Meter un motor de física entero para eso agrega ~600 KB al bundle
 * y un world step por frame en un celular de gama media, para resolver algo
 * que son cuatro cajas y una prueba de solapamiento.
 *
 * La escena registra sus cajas al montar y las da de baja al desmontar
 * (`useCollider`), y el controlador de movimiento consulta este registro. El
 * jugador es un CILINDRO vertical (radio + sin altura): en un espacio que se
 * recorre caminando, la altura no aporta nada y complica el deslizamiento.
 */
/**
 * Recinto: el jugador tiene que quedar ADENTRO de este rectángulo (el
 * pasillo). Es lo contrario de una caja sólida, y no es lo mismo modelado al
 * revés: con cuatro cajas sólidas rodeando el pasillo, un jugador que por lo
 * que sea aparece del lado de afuera es empujado MÁS hacia afuera, porque la
 * caja lo repele desde la cara que tiene más cerca. Con un recinto, siempre
 * termina adentro. Se verificó con `resolveCollisions` antes de dejarlo así.
 */
export interface BoundsCollider {
  /** Esquinas en el plano XZ. */
  min: [number, number];
  max: [number, number];
}

export interface BoxCollider {
  /** Centro de la caja en el mundo. */
  center: [number, number, number];
  /** Tamaño total (no la mitad) en cada eje. */
  size: [number, number, number];
  /** Rotación en Y, en radianes. Las paredes laterales del pasillo la usan. */
  rotationY?: number;
}

const colliders = new Set<BoxCollider>();
const bounds = new Set<BoundsCollider>();

export function addCollider(collider: BoxCollider): () => void {
  colliders.add(collider);
  return () => {
    colliders.delete(collider);
  };
}

export function addBounds(area: BoundsCollider): () => void {
  bounds.add(area);
  return () => {
    bounds.delete(area);
  };
}

/* Vectores reusados: esta función corre por frame y por colisionador, y no
 * tiene sentido que genere basura para el GC en cada llamada. */
const local = new THREE.Vector2();
const closest = new THREE.Vector2();

/**
 * Empuja `position` fuera de cualquier colisionador con el que se solape,
 * tratando al jugador como un círculo de radio `radius` en el plano XZ.
 *
 * El empuje es sobre el eje de menor penetración, que es lo que produce el
 * "deslizamiento" contra la pared: caminar en diagonal contra un muro sigue
 * avanzando a lo largo del muro en vez de frenar en seco. Sin eso, el
 * movimiento se siente trabado — sobre todo con un stick analógico, donde es
 * casi imposible caminar perfectamente perpendicular a una pared.
 */
export function resolveCollisions(position: THREE.Vector3, radius: number) {
  // Primero los recintos: el jugador no puede salirse del espacio jugable.
  for (const area of bounds) {
    position.x = Math.min(
      Math.max(position.x, area.min[0] + radius),
      area.max[0] - radius,
    );
    position.z = Math.min(
      Math.max(position.z, area.min[1] + radius),
      area.max[1] - radius,
    );
  }

  for (const box of colliders) {
    const [cx, , cz] = box.center;
    const [sx, , sz] = box.size;
    const angle = box.rotationY ?? 0;

    // Al sistema local de la caja: así el test es siempre contra una caja
    // alineada a los ejes, aunque la pared esté rotada.
    const dx = position.x - cx;
    const dz = position.z - cz;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    local.set(dx * cos - dz * sin, dx * sin + dz * cos);

    const halfX = sx / 2;
    const halfZ = sz / 2;

    closest.set(
      Math.max(-halfX, Math.min(local.x, halfX)),
      Math.max(-halfZ, Math.min(local.y, halfZ)),
    );

    const offsetX = local.x - closest.x;
    const offsetZ = local.y - closest.y;
    const distanceSq = offsetX * offsetX + offsetZ * offsetZ;

    if (distanceSq >= radius * radius) {
      // Fuera de la caja y a más de un radio: no hay contacto.
      if (distanceSq > 0) continue;
    }

    let pushX: number;
    let pushZ: number;

    if (distanceSq > 1e-8) {
      // El centro del jugador está fuera de la caja: se lo empuja a lo largo
      // de la normal hacia el punto más cercano.
      const distance = Math.sqrt(distanceSq);
      const overlap = radius - distance;
      pushX = (offsetX / distance) * overlap;
      pushZ = (offsetZ / distance) * overlap;
    } else {
      // El centro quedó DENTRO de la caja (paso muy grande en un frame
      // largo, o spawn adentro). Se sale por la cara más cercana.
      const toX = halfX - Math.abs(local.x);
      const toZ = halfZ - Math.abs(local.y);
      if (toX < toZ) {
        pushX = Math.sign(local.x || 1) * (toX + radius);
        pushZ = 0;
      } else {
        pushX = 0;
        pushZ = Math.sign(local.y || 1) * (toZ + radius);
      }
    }

    // De vuelta al mundo.
    const wCos = Math.cos(angle);
    const wSin = Math.sin(angle);
    position.x += pushX * wCos - pushZ * wSin;
    position.z += pushX * wSin + pushZ * wCos;
  }
}
