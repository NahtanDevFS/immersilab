import type { VariablesState } from "@/types/module";

/**
 * Recorrido guiado: una demo corta del laboratorio, pensada para mostrarlo
 * en clase (PLAN_DESARROLLO.md, Fase F.4). Pasa por un experimento de cada
 * área, en un orden que va de lo más conocido a lo más vistoso, y termina
 * en la pantalla de progreso para mostrar que lo logrado queda guardado.
 *
 * El estado vive en la URL (`?recorrido=2`): así se puede abrir directo una
 * parada, recargar sin perderse, y no hace falta estado global. Fuera del
 * recorrido, los experimentos funcionan exactamente igual que siempre.
 */

export const TOUR_PARAM = "recorrido";

export interface TourStop {
  slug: string;
  href: string;
  name: string;
  /** Lo que se lee y se dice al llegar: corto, para no frenar la demo. */
  say: string;
  /** Variables con las que arranca la parada, si conviene otra cosa que la de siempre. */
  preset?: VariablesState;
}

export const TOUR: TourStop[] = [
  {
    slug: "tiro-parabolico",
    href: "/lab/physics/tiro-parabolico",
    name: "Tiro parabólico",
    say:
      "Empezamos por Física. Este cañón dispara proyectiles que siguen una parábola: avanzan a velocidad constante en horizontal mientras la gravedad los trae de vuelta. " +
      "Está en modo artillería: hay tres blancos y un disparo para cada uno. Ajusta el ángulo y la velocidad, y dispara. " +
      "Si tienes una duda, mantén presionado el botón del micrófono y pregúntale al tutor.",
    preset: { modo: "blancos" },
  },
  {
    slug: "solidos-revolucion",
    href: "/lab/calculus/solidos-revolucion",
    name: "Tornea la pieza",
    say:
      "Ahora Cálculo. Una curva que gira alrededor de un eje barre un sólido, y su volumen es una integral: la suma de muchos discos delgados. " +
      "Los deslizadores son el radio de la pieza a distintas alturas. El reto es igualar la pieza traslúcida, en forma y en volumen.",
  },
  {
    slug: "espectro",
    href: "/lab/networks/espectro",
    name: "Tu voz en el espectro",
    say:
      "Pasamos a Redes y Telecomunicaciones. Aquí la transformada de Fourier descompone tu voz en frecuencias, en tiempo real. " +
      "Enciende el micrófono y silba, y después habla: vas a ver cuánto de tu voz cabe en la banda telefónica.",
  },
  {
    slug: "enrutamiento",
    href: "/lab/networks/enrutamiento",
    name: "Encuentra el camino",
    say:
      "Última parada. Tú eres el router: elige por qué enlace sale el paquete hasta llegar al destino, y al final se compara tu camino con el que habría elegido el algoritmo de Dijkstra. " +
      "Prueba cambiar la métrica a saltos y mira cómo cambia el mejor camino.",
  },
];

/** URL de una parada (índice desde 0). */
export function tourHref(index: number): string {
  return `${TOUR[index].href}?${TOUR_PARAM}=${index + 1}`;
}

/** Parada del recorrido según la URL actual, o null si no hay recorrido. */
export function readTourIndex(search: string): number | null {
  const raw = new URLSearchParams(search).get(TOUR_PARAM);
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 1 && n <= TOUR.length ? n - 1 : null;
}
