/**
 * Física de "Guía la carga", sin React ni three. Todo en unidades reales.
 *
 * El movimiento es en un plano horizontal (x, z) a la altura de los ojos:
 * la partícula está en vacío y en caída libre junto con la cámara, así que
 * la gravedad no cuenta (se explica en el briefing). Solo actúan:
 * - la ley de Coulomb de cada carga fija: F = k·q·qᵢ·r̂ / r², con
 *   k = 9×10⁹ N·m²/C²;
 * - entre placas, un campo uniforme E = V/d.
 *
 * Con una esferita de 1 g y 1 µC, una carga de 5 µC a 1 m da 0.045 N, es
 * decir 45 m/s²: con 1 a 6 m/s las trayectorias caben en la cámara.
 */

export const K = 9e9;
export const MASS = 1e-3;
export const Q_PARTICLE = 1e-6;
export const MICRO = 1e-6;

/** La cámara de vacío, m. */
export const BOUNDS = { xMin: -5.2, xMax: 5.4, zMin: -3.5, zMax: 3.5 };
export const LAUNCHER = { x: -4.6, z: 0 };

export interface Charge {
  x: number;
  z: number;
  /** µC */
  q: number;
}

/** Los cuatro pedestales, en el orden de las variables q1 a q4. */
export const PEDESTALS: Array<{ x: number; z: number }> = [
  { x: -1.5, z: 1.6 },
  { x: 1.5, z: 1.6 },
  { x: -1.5, z: -1.6 },
  { x: 1.5, z: -1.6 },
];

export const sphereRadius = (q: number) => 0.12 + 0.03 * Math.abs(q);

export type LevelId = "desvia" | "placas" | "obstaculo" | "campo-nulo";

export interface Level {
  id: LevelId;
  title: string;
  /** El aro: centro y radio, m. Se cruza a lo largo de x. */
  ring?: { x: number; z: number; r: number };
  /** Muro en x fijo, de zMin a zMax. */
  wall?: { x: number; zMin: number; zMax: number };
  /** Placas paralelas: de x0 a x1, separadas d, centradas en z = 0. */
  plates?: { x0: number; x1: number; d: number };
  /** ¿Se usa el ángulo del lanzador? */
  aim: boolean;
  /** ¿Se usan las cargas de los pedestales? */
  charges: boolean;
}

export const LEVELS: Level[] = [
  { id: "desvia", title: "1 · Desvía", ring: { x: 4.2, z: 1.8, r: 0.35 }, aim: false, charges: true },
  { id: "placas", title: "2 · Entre placas", ring: { x: 3.2, z: 0.9, r: 0.35 }, plates: { x0: -1, x1: 1, d: 1 }, aim: false, charges: false },
  { id: "obstaculo", title: "3 · Rodea el muro", ring: { x: 4.2, z: 0, r: 0.35 }, wall: { x: 0, zMin: -1.1, zMax: 1.1 }, aim: true, charges: true },
  { id: "campo-nulo", title: "4 · Campo nulo", aim: false, charges: false },
];

export function getLevel(id: unknown): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

/** Las dos cargas fijas del nivel 4: +4 µC y +1 µC separadas 3 m. */
export const NULL_CHARGES: Charge[] = [
  { x: -1.5, z: 0, q: 4 },
  { x: 1.5, z: 0, q: 1 },
];
/** Donde se anula: a 2 m de la de 4 µC, de (x/(3 − x))² = 4. */
export const NULL_X = -1.5 + 2;

/** Campo eléctrico de las cargas puntuales en (x, z), V/m. */
export function fieldAt(charges: Charge[], x: number, z: number): [number, number] {
  let ex = 0;
  let ez = 0;
  for (const c of charges) {
    if (c.q === 0) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    const r2 = dx * dx + dz * dz;
    const r = Math.sqrt(r2);
    if (r < 1e-6) continue;
    const e = (K * c.q * MICRO) / r2;
    ex += (e * dx) / r;
    ez += (e * dz) / r;
  }
  return [ex, ez];
}

export interface ShotInput {
  level: Level;
  charges: Charge[];
  sign: 1 | -1;
  speed: number;
  angleDeg: number;
  voltage: number;
}

export type ShotEnd = "aro" | "esfera" | "muro" | "placa" | "fuera" | "tiempo";

export interface Shot {
  /** Puntos (t, x, z) cada pocos pasos, para dibujar y animar. */
  points: Array<{ t: number; x: number; z: number }>;
  end: ShotEnd;
  /** Duración del tiro, s. */
  duration: number;
}

const DT = 1 / 600;
const MAX_T = 14;

/** Aceleración en (x, z), m/s². */
function accel(input: ShotInput, x: number, z: number): [number, number] {
  const qp = input.sign * Q_PARTICLE;
  const [ex, ez0] = input.level.charges ? fieldAt(input.charges, x, z) : [0, 0];
  let ez = ez0;
  const p = input.level.plates;
  if (p && x >= p.x0 && x <= p.x1 && Math.abs(z) <= p.d / 2) {
    // Placa de abajo (z < 0) en +V: el campo apunta hacia +z.
    ez += input.voltage / p.d;
  }
  return [(qp * ex) / MASS, (qp * ez) / MASS];
}

/**
 * El tiro completo, integrado con RK4 a paso fijo: la trayectoria es la
 * misma en cualquier celular, no depende de los cuadros por segundo.
 */
export function simulate(input: ShotInput): Shot {
  const angle = input.level.aim ? (input.angleDeg * Math.PI) / 180 : 0;
  let x = LAUNCHER.x;
  let z = LAUNCHER.z;
  let vx = input.speed * Math.cos(angle);
  let vz = input.speed * Math.sin(angle);
  let t = 0;
  const points = [{ t, x, z }];
  const { ring, wall, plates } = input.level;
  let end: ShotEnd = "tiempo";

  for (let step = 0; t < MAX_T; step++) {
    const f = (px: number, pz: number) => accel(input, px, pz);
    const [a1x, a1z] = f(x, z);
    const [a2x, a2z] = f(x + (vx * DT) / 2, z + (vz * DT) / 2);
    const v2x = vx + (a1x * DT) / 2;
    const v2z = vz + (a1z * DT) / 2;
    const [a3x, a3z] = f(x + (v2x * DT) / 2, z + (v2z * DT) / 2);
    const v3x = vx + (a2x * DT) / 2;
    const v3z = vz + (a2z * DT) / 2;
    const [a4x, a4z] = f(x + v3x * DT, z + v3z * DT);
    const v4x = vx + a3x * DT;
    const v4z = vz + a3z * DT;
    const nx = x + (DT / 6) * (vx + 2 * v2x + 2 * v3x + v4x);
    const nz = z + (DT / 6) * (vz + 2 * v2z + 2 * v3z + v4z);
    vx += (DT / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
    vz += (DT / 6) * (a1z + 2 * a2z + 2 * a3z + a4z);
    t += DT;

    // ¿Cruzó el plano del aro (o del muro) en este paso? Se mira el tramo
    // entre la posición anterior y la nueva, para no saltarse un aro angosto.
    const ox = x;
    const oz = z;
    const crossed = (cx: number) => (ox - cx) * (nx - cx) <= 0 && ox !== nx;
    const zAt = (cx: number) => oz + ((nz - oz) * (cx - ox)) / (nx - ox);
    x = nx;
    z = nz;
    if (step % 6 === 0) points.push({ t, x, z });

    if (wall && crossed(wall.x) && zAt(wall.x) >= wall.zMin && zAt(wall.x) <= wall.zMax) { end = "muro"; break; }
    if (ring && crossed(ring.x) && Math.abs(zAt(ring.x) - ring.z) <= ring.r) { end = "aro"; break; }
    if (plates && x >= plates.x0 && x <= plates.x1 && Math.abs(z) >= plates.d / 2) { end = "placa"; break; }
    if (input.level.charges && input.charges.some((c) => c.q !== 0 && Math.hypot(x - c.x, z - c.z) < sphereRadius(c.q))) { end = "esfera"; break; }
    if (x < BOUNDS.xMin || x > BOUNDS.xMax || z < BOUNDS.zMin || z > BOUNDS.zMax) { end = "fuera"; break; }
  }
  points.push({ t, x, z });
  return { points, end, duration: t };
}

/**
 * Líneas de campo: salen de cada carga positiva en `per` direcciones y se
 * siguen paso a paso en la dirección del campo hasta llegar a una negativa
 * o salir de la cámara. Si no hay positivas, se trazan hacia atrás desde
 * las negativas. Se calculan solo cuando cambian las cargas.
 */
export function fieldLines(charges: Charge[], per = 14, steps = 200, ds = 0.06): Array<Array<[number, number]>> {
  const active = charges.filter((c) => c.q !== 0);
  const positives = active.filter((c) => c.q > 0);
  const sources = positives.length ? positives : active;
  const direction = positives.length ? 1 : -1;
  const lines: Array<Array<[number, number]>> = [];
  for (const s of sources) {
    for (let k = 0; k < per; k++) {
      const a = (2 * Math.PI * k) / per;
      let x = s.x + Math.cos(a) * (sphereRadius(s.q) + 0.02);
      let z = s.z + Math.sin(a) * (sphereRadius(s.q) + 0.02);
      const line: Array<[number, number]> = [[x, z]];
      for (let i = 0; i < steps; i++) {
        const [ex, ez] = fieldAt(active, x, z);
        const e = Math.hypot(ex, ez);
        if (e < 1e-9) break;
        x += (direction * ds * ex) / e;
        z += (direction * ds * ez) / e;
        line.push([x, z]);
        if (x < BOUNDS.xMin || x > BOUNDS.xMax || z < BOUNDS.zMin || z > BOUNDS.zMax) break;
        if (active.some((c) => c !== s && Math.hypot(x - c.x, z - c.z) < sphereRadius(c.q))) break;
      }
      lines.push(line);
    }
  }
  return lines;
}
