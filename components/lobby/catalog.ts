import { tiroParabolicoExperiment } from "@/components/modules/physics/experiments/tiro-parabolico";
import { colisiones1DExperiment } from "@/components/modules/physics/experiments/colisiones-1d";
import { sumaRiemannExperiment } from "@/components/modules/calculus/experiments/suma-riemann";
import { derivadaPicoExperiment } from "@/components/modules/calculus/experiments/derivada-pico";
import { venturiExperiment } from "@/components/modules/physics/experiments/venturi";
import { ondasExperiment } from "@/components/modules/physics/experiments/ondas";
import { penduloExperiment } from "@/components/modules/physics/experiments/pendulo";
import { solidosRevolucionExperiment } from "@/components/modules/calculus/experiments/solidos-revolucion";
import { taylorExperiment } from "@/components/modules/calculus/experiments/taylor";
import { qamExperiment } from "@/components/modules/networks/experiments/qam";
import { enrutamientoExperiment } from "@/components/modules/networks/experiments/enrutamiento";
import { osiExperiment } from "@/components/modules/networks/experiments/osi";
import { espectroExperiment } from "@/components/modules/networks/experiments/espectro";
import { modulacionExperiment } from "@/components/modules/networks/experiments/modulacion";
import { coberturaExperiment } from "@/components/modules/networks/experiments/cobertura";
import { doorPlacement } from "./corridor";
import { DISCIPLINES } from "@/lib/catalog";

export interface LobbyDoor {
  href: string;
  name: string;
  /** Slug del área (physics, calculus, networks), para el color. */
  discipline: string;
  /** Nombre del área, tal como se muestra. */
  disciplineName: string;
  /** Centro de la puerta dentro del pasillo (x, y, z). */
  position: [number, number, number];
  /** Rotación Y (radianes): las puertas miran hacia el centro del pasillo. */
  rotationY: number;
}

/**
 * El catálogo del lobby: una entrada por experimento, en el orden en que se
 * recorren.
 *
 * Solo se declara la ruta y el nombre — la posición la calcula
 * `doorPlacement` a partir del índice (izquierda, derecha, izquierda...).
 * Agregar un experimento es agregar una línea aquí; no hay que elegir
 * coordenadas ni revisar que no se pise con otra puerta.
 */
const registry = [
  { href: "/lab/physics/tiro-parabolico", name: tiroParabolicoExperiment.name },
  { href: "/lab/physics/colisiones-1d", name: colisiones1DExperiment.name },
  { href: "/lab/physics/pendulo", name: penduloExperiment.name },
  { href: "/lab/calculus/suma-riemann", name: sumaRiemannExperiment.name },
  { href: "/lab/calculus/derivada-pico", name: derivadaPicoExperiment.name },
  {
    href: "/lab/calculus/solidos-revolucion",
    name: solidosRevolucionExperiment.name,
  },
  { href: "/lab/calculus/taylor", name: taylorExperiment.name },
  { href: "/lab/physics/venturi", name: venturiExperiment.name },
  { href: "/lab/physics/ondas", name: ondasExperiment.name },
  { href: "/lab/networks/qam", name: qamExperiment.name },
  { href: "/lab/networks/enrutamiento", name: enrutamientoExperiment.name },
  { href: "/lab/networks/osi", name: osiExperiment.name },
  { href: "/lab/networks/espectro", name: espectroExperiment.name },
  { href: "/lab/networks/modulacion", name: modulacionExperiment.name },
  { href: "/lab/networks/cobertura", name: coberturaExperiment.name },
];

export const lobbyDoors: LobbyDoor[] = registry.map((entry, index) => {
  // El área sale de la ruta (/lab/<área>/<experimento>): así no hay que
  // declararla dos veces en cada línea de arriba.
  const discipline = entry.href.split("/")[2];
  return {
    ...entry,
    discipline,
    disciplineName: DISCIPLINES.find((d) => d.slug === discipline)?.name ?? "",
    ...doorPlacement(index),
  };
});
