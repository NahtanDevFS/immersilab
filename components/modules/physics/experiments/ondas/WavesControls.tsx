"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { WavesEngine, WavesRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Botón de sonido. Los cuatro objetivos los dibuja el HUD de retos del
 * shell; el objetivo activo se elige en el panel de variables.
 */
export function WavesControls({ engine }: Props) {
  const waves = engine as WavesEngine;
  const [runtime, setRuntime] = useState<WavesRuntime>(() => ({
    ...waves.getRuntime(),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto.
      setRuntime({ ...waves.getRuntime() });
    }, 100);
    return () => {
      window.clearInterval(id);
      // Salir del experimento apaga el sonido.
      waves.stopAudio();
    };
  }, [waves]);

  return (
    <div className={styles.actions}>
      <div className={styles.buttons}>
        <button
          className={styles.fireButton}
          onClick={() => (runtime.audioOn ? waves.stopAudio() : void waves.startAudio())}
        >
          {runtime.audioOn ? "Apagar sonido" : "Escuchar la suma"}
        </button>
      </div>
    </div>
  );
}
