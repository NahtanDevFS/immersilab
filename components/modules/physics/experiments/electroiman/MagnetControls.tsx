"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import { CUTOFF_TEMP, RATED_POWER, type MagnetEngine, type MagnetRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Encender y apagar el imán, con el aviso de lo que pasó y la potencia y la
 * temperatura de la bobina a la vista: son lo que decide el reto del carro.
 */
export function MagnetControls({ engine }: Props) {
  const magnet = engine as MagnetEngine;
  const [runtime, setRuntime] = useState<MagnetRuntime>(() => ({ ...magnet.getRuntime() }));

  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...magnet.getRuntime() }), 100);
    return () => window.clearInterval(id);
  }, [magnet]);

  const overPower = runtime.power > RATED_POWER;
  const hot = runtime.temperature > CUTOFF_TEMP - 20;

  return (
    <div className={styles.actions}>
      {runtime.message && <p className={styles.note}>{runtime.message}</p>}
      <div className={styles.buttons}>
        <span
          className={styles.note}
          data-inline
          style={{ color: overPower || hot ? "var(--lab-danger)" : undefined }}
          title={`Potencia nominal: ${RATED_POWER} W · la protección corta a ${CUTOFF_TEMP} °C`}
        >
          {Math.round(runtime.power)} W · {Math.round(runtime.temperature)} °C
        </span>
        <button
          className={styles.fireButton}
          onClick={() => magnet.toggleMagnet()}
          disabled={runtime.tripped}
        >
          {runtime.tripped ? "Enfriando…" : runtime.magnetOn ? "Apagar imán" : "Encender imán"}
        </button>
      </div>
    </div>
  );
}
