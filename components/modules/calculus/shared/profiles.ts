/**
 * Perfiles de revolución: la matemática compartida entre el motor y la
 * escena de "Torneá la pieza" (C3).
 *
 * Un sólido de revolución acá queda definido por CINCO radios repartidos a lo
 * largo del eje. Cinco y no una fórmula libre porque el experimento se juega
 * con sliders: con tres, cualquier pieza sale como un cono y no hay nada que
 * ajustar; con diez, mover uno no cambia nada visible y el reto se vuelve
 * tedioso.
 *
 * Entre esos cinco puntos el radio se interpola con Catmull-Rom y no con
 * rectas: un torno no deja aristas, y sobre todo el volumen de una pieza con
 * quiebres depende muchísimo de dónde caen los quiebres, lo que hace que el
 * reto se gane por suerte en vez de por entender la integral.
 */

/** Cuántos radios controla el jugador. */
export const CONTROL_POINTS = 5;

/** Alto total de la pieza, en metros. Fijo: lo que se moldea es el radio. */
export const PIECE_HEIGHT = 2.4;

/** Muestras a lo largo del eje para dibujar y para integrar. */
export const PROFILE_SAMPLES = 120;

export interface TargetPiece {
  id: string;
  label: string;
  /** Los cinco radios que la definen, de la base a la punta. */
  radii: number[];
}

/**
 * Las piezas a igualar. Están elegidas para que cada una enseñe algo
 * distinto sobre V = π∫r², que es el punto del experimento:
 *
 *  - La copa tiene casi todo su volumen arriba, donde es ancha.
 *  - La pesa engaña: parece grande por lo alta, pero su cintura fina casi
 *    no aporta volumen, porque el radio va al CUADRADO.
 *  - El trompo es el caso donde un cambio chico de radio en la panza pesa
 *    más que uno grande en la punta.
 */
export const TARGET_PIECES: TargetPiece[] = [
  {
    id: "copa",
    label: "Copa",
    radii: [0.55, 0.22, 0.3, 0.72, 0.9],
  },
  {
    id: "pesa",
    label: "Pesa de gimnasio",
    radii: [0.85, 0.9, 0.18, 0.9, 0.85],
  },
  {
    id: "trompo",
    label: "Trompo",
    radii: [0.12, 0.6, 0.95, 0.5, 0.1],
  },
  {
    id: "jarron",
    label: "Jarrón",
    radii: [0.5, 0.95, 0.8, 0.42, 0.6],
  },
];

export function getTargetPiece(id: string | number | boolean): TargetPiece {
  return TARGET_PIECES.find((p) => p.id === String(id)) ?? TARGET_PIECES[0];
}

export const PIECE_OPTIONS = TARGET_PIECES.map((p) => ({
  label: p.label,
  value: p.id,
}));

/**
 * Radio en la altura `t` (0 = base, 1 = punta), interpolando los puntos de
 * control con Catmull-Rom.
 *
 * Los extremos se duplican para que la curva pase exactamente por el primer
 * y el último radio: sin eso, la base y la punta de la pieza no coinciden
 * con lo que marcan los sliders, y el jugador cree que el control está roto.
 */
export function radiusAt(radii: number[], t: number): number {
  const n = radii.length;
  const clamped = Math.min(Math.max(t, 0), 1);
  const scaled = clamped * (n - 1);
  const i = Math.min(Math.floor(scaled), n - 2);
  const local = scaled - i;

  const p0 = radii[Math.max(i - 1, 0)];
  const p1 = radii[i];
  const p2 = radii[i + 1];
  const p3 = radii[Math.min(i + 2, n - 1)];

  const t2 = local * local;
  const t3 = t2 * local;

  const value =
    0.5 *
    (2 * p1 +
      (-p0 + p2) * local +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3);

  // Un radio negativo no existe; la interpolación puede pasarse de largo
  // cuando dos puntos vecinos están muy separados.
  return Math.max(value, 0.02);
}

/**
 * Volumen del sólido por el método de DISCOS: V = π ∫ r(h)² dh, integrado con
 * Simpson sobre la altura.
 *
 * Se usa Simpson y no una suma de rectángulos porque el integrando va al
 * cuadrado: con sumas simples, el error del propio integrador competía con la
 * diferencia entre la pieza del jugador y la objetivo, y el marcador se movía
 * por el método numérico en vez de por lo que hacía el jugador.
 *
 * El método de CAPAS no se integra aparte a propósito: para capas hay que
 * invertir el perfil (altura en función del radio) y en una pieza con cintura
 * —la pesa, sin ir más lejos— ese "función inversa" no existe, hay dos alturas
 * para el mismo radio. Los dos métodos dan el mismo volumen; lo que cambia en
 * el experimento al elegir "capas" es CÓMO se rebana la pieza en pantalla,
 * que es justo lo que distingue un método del otro.
 */
export function volumeOfRevolution(radii: number[]): number {
  const n = PROFILE_SAMPLES % 2 === 0 ? PROFILE_SAMPLES : PROFILE_SAMPLES + 1;
  const dh = PIECE_HEIGHT / n;

  let sum = 0;
  for (let i = 0; i <= n; i += 1) {
    const r = radiusAt(radii, i / n);
    const f = r * r;
    const weight = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight * f;
  }

  return (Math.PI * dh * sum) / 3;
}

/**
 * Qué tan parecidas son dos siluetas: error cuadrático medio entre los dos
 * radios, en porcentaje del radio típico de la pieza objetivo.
 *
 * Hace falta ADEMÁS del error de volumen, porque el volumen solo no alcanza
 * para ganar el juego: una pieza recta puede tener exactamente el mismo
 * volumen que la copa sin parecerse en nada. Que las dos medidas convivan es
 * lo que obliga a mirar la integral y la forma al mismo tiempo.
 */
export function silhouetteError(radii: number[], target: number[]): number {
  let sum = 0;
  let targetSum = 0;

  for (let i = 0; i <= PROFILE_SAMPLES; i += 1) {
    const t = i / PROFILE_SAMPLES;
    const mine = radiusAt(radii, t);
    const theirs = radiusAt(target, t);
    sum += (mine - theirs) ** 2;
    targetSum += theirs;
  }

  const rms = Math.sqrt(sum / (PROFILE_SAMPLES + 1));
  const averageRadius = targetSum / (PROFILE_SAMPLES + 1);
  return (rms / averageRadius) * 100;
}
