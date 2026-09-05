"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { DerivativeEngine, RidePhase } from "./engine";
import styles from "./RideControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Un solo botón que cambia de función según la fase: arrancar, frenar,
 * volver a intentar. Es la interacción entera del juego, y tenerla en un
 * único botón es lo que permite jugarlo con el gamepad dentro del visor,
 * donde apuntar a botones chicos es incómodo.
 *
 * Se lee la fase con un intervalo corto, no cada frame: es HTML fuera del
 * <Canvas>, igual que ResultPanel.
 */
export function RideControls({ engine }: Props) {
  const ride = engine as DerivativeEngine;
  const [phase, setPhase] = useState<RidePhase>("listo");
  const [slope, setSlope] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const runtime = ride.getRuntime();
      setPhase(runtime.phase);
      setSlope(runtime.slope);
    }, 80);
    return () => window.clearInterval(id);
  }, [ride]);

  return (
    <div className={styles.actions}>
      {/* Velocímetro: f'(x) en vivo. Es el dato con el que se juega, así que
          va pegado al botón y no en el panel de resultados, que solo se
          llena al terminar el intento. */}
      {phase === "rodando" && (
        <p className={styles.readout}>f&apos;(x) = {slope.toFixed(2)}</p>
      )}

      <button
        className={phase === "rodando" ? styles.fireButton : styles.resetButton}
        onClick={() => (phase === "rodando" ? ride.brake() : ride.start())}
      >
        {phase === "rodando"
          ? "¡Frenar!"
          : phase === "frenado"
            ? "Otra vuelta"
            : "Arrancar"}
      </button>
    </div>
  );
}
