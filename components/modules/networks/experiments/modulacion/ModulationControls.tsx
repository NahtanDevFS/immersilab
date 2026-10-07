"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { ModulationEngine, ModulationRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Botón de la radio. Los retos los dibuja el HUD de retos del shell.
 *
 * El audio arranca con un clic porque los navegadores no dejan sonar nada
 * sin un gesto del usuario. Los retos funcionan igual con la radio apagada:
 * el sonido ayuda a "sentir" la sintonía, pero no es obligatorio.
 */
export function ModulationControls({ engine }: Props) {
  const radio = engine as ModulationEngine;
  const [runtime, setRuntime] = useState<ModulationRuntime>(() => ({
    ...radio.getRuntime(),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto.
      setRuntime({ ...radio.getRuntime() });
    }, 100);
    return () => {
      window.clearInterval(id);
      // Salir del experimento apaga la radio: si no, seguiría sonando en el lobby.
      radio.stopAudio();
    };
  }, [radio]);

  return (
    <div className={styles.actions}>
      <div className={styles.buttons}>
        <button
          className={styles.fireButton}
          onClick={() => (runtime.audioOn ? radio.stopAudio() : void radio.startAudio())}
        >
          {runtime.audioOn ? "Apagar radio" : "Encender radio"}
        </button>
      </div>
    </div>
  );
}
