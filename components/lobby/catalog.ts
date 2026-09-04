import { tiroParabolicoExperiment } from "@/components/modules/physics/experiments/tiro-parabolico";
import { colisiones1DExperiment } from "@/components/modules/physics/experiments/colisiones-1d";

export interface LobbyDoor {
  href: string;
  name: string;
  /** Centro de la puerta dentro del lobby (x, y, z). */
  position: [number, number, number];
  /** Rotación Y (radianes), para puertas en paredes distintas a la trasera. */
  rotationY?: number;
}

/**
 * Una entrada por experimento del catálogo (sección 5 del plan). Al agregar
 * un experimento nuevo (péndulo, plano inclinado...), se le suma acá su
 * ruta y dónde va a estar su puerta — el resto del lobby (paredes, cámara,
 * caminar) no cambia.
 */
export const lobbyDoors: LobbyDoor[] = [
  {
    href: "/lab/physics/tiro-parabolico",
    name: tiroParabolicoExperiment.name,
    position: [0, 0, -10],
  },
  {
    href: "/lab/physics/colisiones-1d",
    name: colisiones1DExperiment.name,
    position: [-6, 0, -10],
  },
];