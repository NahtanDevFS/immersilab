import { tiroParabolicoExperiment } from "@/components/modules/physics/experiments/tiro-parabolico";
import { colisiones1DExperiment } from "@/components/modules/physics/experiments/colisiones-1d";
import { sumaRiemannExperiment } from "@/components/modules/calculus/experiments/suma-riemann";
import { derivadaPicoExperiment } from "@/components/modules/calculus/experiments/derivada-pico";
import { venturiExperiment } from "@/components/modules/physics/experiments/venturi";
import { solidosRevolucionExperiment } from "@/components/modules/calculus/experiments/solidos-revolucion";
import { qamExperiment } from "@/components/modules/networks/experiments/qam";
import { enrutamientoExperiment } from "@/components/modules/networks/experiments/enrutamiento";
import { osiExperiment } from "@/components/modules/networks/experiments/osi";
import { doorPlacement } from "./corridor";

export interface LobbyDoor {
  href: string;
  name: string;
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
 * Agregar un experimento es agregar una línea acá; no hay que elegir
 * coordenadas ni revisar que no se pise con otra puerta.
 */
const registry = [
  { href: "/lab/physics/tiro-parabolico", name: tiroParabolicoExperiment.name },
  { href: "/lab/physics/colisiones-1d", name: colisiones1DExperiment.name },
  { href: "/lab/calculus/suma-riemann", name: sumaRiemannExperiment.name },
  { href: "/lab/calculus/derivada-pico", name: derivadaPicoExperiment.name },
  {
    href: "/lab/calculus/solidos-revolucion",
    name: solidosRevolucionExperiment.name,
  },
  { href: "/lab/physics/venturi", name: venturiExperiment.name },
  { href: "/lab/networks/qam", name: qamExperiment.name },
  { href: "/lab/networks/enrutamiento", name: enrutamientoExperiment.name },
  { href: "/lab/networks/osi", name: osiExperiment.name },
];

export const lobbyDoors: LobbyDoor[] = registry.map((entry, index) => ({
  ...entry,
  ...doorPlacement(index),
}));
