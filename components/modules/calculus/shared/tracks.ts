/**
 * Pistas para "Frená en el pico" (C1).
 *
 * Van aparte del catálogo de `functions.ts` a propósito: aquellas son
 * monótonas y positivas porque las pide la suma de Riemann (área sin signo),
 * y acá hace falta justo lo contrario — curvas con varios máximos y mínimos,
 * que es donde f'(x) cambia de signo y el juego tiene sentido.
 *
 * Cada pista trae su derivada ANALÍTICA. Se podría derivar numéricamente,
 * pero el juego se gana o se pierde por dónde f'(x) vale exactamente cero, y
 * una diferencia finita mete un error justo en el punto que se está
 * evaluando.
 */
export interface Track {
  id: string;
  label: string;
  expression: string;
  f: (x: number, amp: number) => number;
  df: (x: number, amp: number) => number;
  domain: [number, number];
}

export const TRACKS: Track[] = [
  {
    id: "ondas",
    label: "Ondas — sen(x) + sen(2x)/2",
    expression: "A·(sin(x) + sin(2x)/2) + 3",
    f: (x, amp) => amp * (Math.sin(x) + Math.sin(2 * x) / 2) + 3,
    df: (x, amp) => amp * (Math.cos(x) + Math.cos(2 * x)),
    domain: [0, 4 * Math.PI],
  },
  {
    id: "cubica",
    label: "Cúbica — x³/9 − x² + 2x",
    expression: "A·(x^3/9 − x^2 + 2x) + 2",
    f: (x, amp) => amp * ((x * x * x) / 9 - x * x + 2 * x) + 2,
    df: (x, amp) => amp * ((x * x) / 3 - 2 * x + 2),
    domain: [0, 9],
  },
  {
    id: "colinas",
    label: "Colinas — dos gaussianas",
    expression: "A·(2·e^(−(x−3)²) + 1.4·e^(−(x−8)²/2)) + 1",
    f: (x, amp) =>
      amp *
        (2 * Math.exp(-Math.pow(x - 3, 2)) +
          1.4 * Math.exp(-Math.pow(x - 8, 2) / 2)) +
      1,
    df: (x, amp) =>
      amp *
      (-4 * (x - 3) * Math.exp(-Math.pow(x - 3, 2)) -
        1.4 * (x - 8) * Math.exp(-Math.pow(x - 8, 2) / 2)),
    domain: [0, 12],
  },
];

export function getTrack(id: string | number | boolean): Track {
  return TRACKS.find((t) => t.id === String(id)) ?? TRACKS[0];
}

export const TRACK_OPTIONS = TRACKS.map((t) => ({
  label: t.label,
  value: t.id,
}));

/**
 * Puntos donde f'(x) = 0 dentro del dominio, por cambio de signo de la
 * derivada + bisección. Son las metas del juego, así que se calculan una vez
 * por combinación de pista y amplitud, no por frame.
 */
export function findCriticalPoints(track: Track, amp: number): number[] {
  const [min, max] = track.domain;
  const steps = 600;
  const dx = (max - min) / steps;
  const zeros: number[] = [];

  let prevX = min;
  let prevD = track.df(prevX, amp);

  for (let i = 1; i <= steps; i += 1) {
    const x = min + i * dx;
    const d = track.df(x, amp);

    if (prevD === 0) zeros.push(prevX);
    else if (prevD * d < 0) {
      // Bisección: 40 pasos dejan el cero con precisión de sobra frente a la
      // tolerancia con la que se juzga al jugador.
      let lo = prevX;
      let hi = x;
      for (let k = 0; k < 40; k += 1) {
        const mid = (lo + hi) / 2;
        if (track.df(lo, amp) * track.df(mid, amp) <= 0) hi = mid;
        else lo = mid;
      }
      zeros.push((lo + hi) / 2);
    }

    prevX = x;
    prevD = d;
  }

  return zeros;
}
