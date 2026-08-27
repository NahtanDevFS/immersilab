import { tiroParabolicoExperiment } from "@/components/modules/physics/experiments/tiro-parabolico";

export interface LobbyDoor {
  href: string;
  name: string;
  /** Centro de la puerta dentro del lobby (x, y, z). */
  position: [number, number, number];
}

/**
 * Una entrada por experimento del catálogo (sección 5 del plan). Al agregar
 * un experimento nuevo (colisiones, péndulo...), se le suma acá su ruta y
 * dónde va a estar su puerta — el resto del lobby (paredes, cámara,
 * caminar) no cambia.
 */
export const lobbyDoors: LobbyDoor[] = [
  {
    href: "/lab/physics/tiro-parabolico",
    name: tiroParabolicoExperiment.name,
    position: [0, 0, -10],
  },
];