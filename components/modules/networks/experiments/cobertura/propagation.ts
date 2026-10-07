/**
 * Modelo de propagación de R3 · Cubre el campus, sin React ni three.
 *
 * Coordenadas en "unidades de mapa": 1 unidad = 50 m. El campus va de x = 0
 * a 10 (500 m) y de z = −3.5 a 3.5 (350 m), que es también donde se dibuja.
 *
 * Potencia recibida (dBm) = potencia de transmisión + ganancias de antena
 *   − pérdida de trayecto − pérdida por cada edificio atravesado.
 *
 * Pérdida de trayecto: modelo log-distancia, el estándar de libro para
 * exteriores con obstáculos. Se parte del espacio libre a 1 m,
 *   FSPL(1 m) = 20·log₁₀(0.001 km) + 20·log₁₀(f en MHz) + 32.44,
 * y desde ahí la pérdida crece 10·n dB por década de distancia. Con n = 2
 * es exactamente el espacio libre; en un campus con árboles y gente n ≈ 2.4.
 *
 * Por qué no espacio libre puro: se calibró con búsqueda exhaustiva y con
 * n = 2 una sola antena de 900 MHz cubría todo el campus a la mínima
 * potencia, y no había nada que pensar. Con n = 2.4, sensibilidad −78 dBm y
 * muros de 8/12/18 dB, la banda importa: 900 MHz se arregla con una antena,
 * 2.4 GHz necesita dos, y 5 GHz no alcanza con tres (por eso el Wi-Fi de
 * 5 GHz se despliega con muchos más puntos de acceso).
 */

export const METERS_PER_UNIT = 50;
export const MAP_X: [number, number] = [0, 10];
export const MAP_Z: [number, number] = [-3.5, 3.5];

export interface Building {
  id: string;
  name: string;
  /** Rectángulo en el plano del mapa: [xMin, zMin, xMax, zMax]. */
  rect: [number, number, number, number];
  /** Altura de dibujo, en unidades. */
  height: number;
}

export const BUILDINGS: Building[] = [
  { id: "biblioteca", name: "Biblioteca", rect: [1.0, -3.0, 3.0, -1.8], height: 0.9 },
  { id: "aulas-a", name: "Aulas A", rect: [4.0, -3.0, 6.5, -2.0], height: 1.1 },
  { id: "aulas-b", name: "Aulas B", rect: [7.2, -2.8, 9.4, -0.8], height: 0.8 },
  { id: "laboratorios", name: "Laboratorios", rect: [1.2, 0.2, 2.8, 2.2], height: 0.7 },
  { id: "cafeteria", name: "Cafetería", rect: [4.4, -0.6, 5.8, 0.8], height: 0.5 },
  { id: "rectoria", name: "Rectoría", rect: [7.0, 1.2, 9.0, 3.0], height: 1.0 },
];

export interface Point {
  id: string;
  name: string;
  x: number;
  z: number;
}

/** Los puntos donde hay que medir buena señal: el objetivo del reto. */
export const POINTS: Point[] = [
  { id: "p-biblioteca", name: "Biblioteca", x: 2.0, z: -2.4 },
  { id: "p-aulas-a", name: "Aulas A", x: 5.2, z: -2.5 },
  { id: "p-aulas-b", name: "Aulas B", x: 8.3, z: -1.8 },
  { id: "p-labs", name: "Laboratorios", x: 2.0, z: 1.2 },
  { id: "p-cafeteria", name: "Cafetería", x: 5.1, z: 0.1 },
  { id: "p-rectoria", name: "Rectoría", x: 8.0, z: 2.1 },
  { id: "p-parqueo", name: "Parqueo", x: 0.5, z: 3.0 },
  { id: "p-cancha", name: "Cancha", x: 9.6, z: -3.3 },
  { id: "p-plaza", name: "Plaza", x: 5.0, z: 2.6 },
  { id: "p-entrada", name: "Entrada", x: 0.3, z: -0.5 },
  { id: "p-jardin", name: "Jardín", x: 6.6, z: -1.2 },
  { id: "p-auditorio", name: "Auditorio", x: 3.6, z: 3.2 },
];

export interface Site {
  id: string;
  name: string;
  x: number;
  z: number;
}

/** Postes donde se puede montar una antena. */
export const SITES: Site[] = [
  { id: "s1", name: "Poste 1", x: 2.0, z: -1.2 },
  { id: "s2", name: "Poste 2", x: 5.2, z: -1.4 },
  { id: "s3", name: "Poste 3", x: 8.3, z: 0.2 },
  { id: "s4", name: "Poste 4", x: 3.4, z: 1.0 },
  { id: "s5", name: "Poste 5", x: 6.4, z: 2.0 },
  { id: "s6", name: "Poste 6", x: 0.6, z: 1.4 },
  { id: "s7", name: "Poste 7", x: 9.6, z: 3.2 },
];

export interface Band {
  id: string;
  label: string;
  mhz: number;
  /** Pérdida al atravesar un edificio entero (dos muros), en dB. */
  buildingLossDb: number;
}

/** Más frecuencia, más pérdida por muro: es la otra mitad de la lección. */
export const BANDS: Band[] = [
  { id: "900", label: "900 MHz", mhz: 900, buildingLossDb: 8 },
  { id: "2400", label: "2.4 GHz", mhz: 2400, buildingLossDb: 12 },
  { id: "5000", label: "5 GHz", mhz: 5000, buildingLossDb: 18 },
];

export function getBand(id: string | number | boolean): Band {
  return BANDS.find((b) => b.id === String(id)) ?? BANDS[1];
}

/** Ganancia sumada de las antenas transmisora y receptora, en dBi. */
export const ANTENNA_GAIN_DB = 4;
/** Señal mínima para una conexión utilizable, en dBm. */
export const SENSITIVITY_DBM = -78;
/** Exponente de pérdida del modelo log-distancia (2 = espacio libre). */
export const PATH_LOSS_EXPONENT = 2.4;
/** Cuánto tiene que superar la señal a la interferencia del mismo canal. */
export const MIN_SIR_DB = 6;

export interface Antenna {
  site: Site;
  channel: number;
}

/** Pérdida en espacio libre, en dB (d en unidades de mapa). */
export function fsplDb(distanceUnits: number, mhz: number): number {
  const km = Math.max(distanceUnits * METERS_PER_UNIT, 1) / 1000;
  return 20 * Math.log10(km) + 20 * Math.log10(mhz) + 32.44;
}

/** Pérdida de trayecto log-distancia: FSPL a 1 m + 10·n·log₁₀(d en m). */
export function pathLossDb(distanceUnits: number, mhz: number): number {
  const meters = Math.max(distanceUnits * METERS_PER_UNIT, 1);
  return fsplDb(1 / METERS_PER_UNIT, mhz) + 10 * PATH_LOSS_EXPONENT * Math.log10(meters);
}

/** ¿El segmento (x1,z1)→(x2,z2) atraviesa el rectángulo? Método de las franjas. */
function segmentHitsRect(
  x1: number, z1: number, x2: number, z2: number,
  [xMin, zMin, xMax, zMax]: Building["rect"],
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, x1 - xMin) && clip(dx, xMax - x1) &&
    clip(-dz, z1 - zMin) && clip(dz, zMax - z1) && t0 <= t1
  );
}

export function buildingsBetween(x1: number, z1: number, x2: number, z2: number): number {
  let n = 0;
  for (const b of BUILDINGS) if (segmentHitsRect(x1, z1, x2, z2, b.rect)) n++;
  return n;
}

/** Potencia recibida en (x, z) desde una antena, en dBm. */
export function receivedDbm(
  antenna: Antenna, x: number, z: number, band: Band, powerDbm: number,
): number {
  const d = Math.hypot(x - antenna.site.x, z - antenna.site.z);
  const walls = buildingsBetween(antenna.site.x, antenna.site.z, x, z);
  return powerDbm + ANTENNA_GAIN_DB - pathLossDb(d, band.mhz) - walls * band.buildingLossDb;
}

export interface Reception {
  /** Señal de la antena más fuerte, en dBm (−Infinity sin antenas). */
  bestDbm: number;
  /** Índice de la antena más fuerte. */
  best: number;
  /** Relación señal/interferencia del mismo canal, en dB (Infinity si no hay). */
  sirDb: number;
  covered: boolean;
  /** ¿Falla por interferencia (y no por señal débil)? */
  interfered: boolean;
}

const dbmToMw = (dbm: number) => 10 ** (dbm / 10);

export function receptionAt(
  antennas: Antenna[], x: number, z: number, band: Band, powerDbm: number,
): Reception {
  if (antennas.length === 0) {
    return { bestDbm: -Infinity, best: -1, sirDb: Infinity, covered: false, interfered: false };
  }
  const levels = antennas.map((a) => receivedDbm(a, x, z, band, powerDbm));
  let best = 0;
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[best]) best = i;

  let interferenceMw = 0;
  antennas.forEach((a, i) => {
    if (i !== best && a.channel === antennas[best].channel) interferenceMw += dbmToMw(levels[i]);
  });
  const sirDb =
    interferenceMw > 0 ? levels[best] - 10 * Math.log10(interferenceMw) : Infinity;

  const strongEnough = levels[best] >= SENSITIVITY_DBM;
  const clean = sirDb >= MIN_SIR_DB;
  return {
    bestDbm: levels[best],
    best,
    sirDb,
    covered: strongEnough && clean,
    interfered: strongEnough && !clean,
  };
}

export interface CoverageSummary {
  covered: number;
  total: number;
  /** Puntos que fallan por interferencia. */
  interfered: number;
  perPoint: Reception[];
}

export function coverageOf(antennas: Antenna[], band: Band, powerDbm: number): CoverageSummary {
  const perPoint = POINTS.map((p) => receptionAt(antennas, p.x, p.z, band, powerDbm));
  return {
    covered: perPoint.filter((r) => r.covered).length,
    total: POINTS.length,
    interfered: perPoint.filter((r) => r.interfered).length,
    perPoint,
  };
}
