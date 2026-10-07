"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { PendulumEngine, PendulumRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/** Botón de soltar/detener. Los retos los dibuja el HUD de retos del shell. */
export function PendulumControls({ engine }: Props) {
  const pendulum = engine as PendulumEngine;
  const [runtime, setRuntime] = useState<PendulumRuntime>(() => ({
    ...pendulum.getRuntime(),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto.
      setRuntime({ ...pendulum.getRuntime() });
    }, 100);
    return () => window.clearInterval(id);
  }, [pendulum]);

  return (
    <div className={styles.actions}>
      <div className={styles.buttons}>
        <button
          className={styles.fireButton}
          onClick={() =>
            runtime.phase === "oscilando" ? pendulum.stop() : pendulum.release()
          }
        >
          {runtime.phase === "oscilando" ? "Detener" : "Soltar los péndulos"}
        </button>
      </div>
    </div>
  );
}
