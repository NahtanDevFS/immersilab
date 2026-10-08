"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import { MEASURE_POINTS, type ProtoboardEngine, type ProtoboardRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/** La lectura del multímetro, los avisos y el cambio de componentes quemados. */
export function ProtoboardControls({ engine }: Props) {
  const board = engine as ProtoboardEngine;
  const [runtime, setRuntime] = useState<ProtoboardRuntime>(() => ({ ...board.getRuntime() }));

  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...board.getRuntime() }), 100);
    return () => window.clearInterval(id);
  }, [board]);

  const burned = Object.values(runtime.burned).some(Boolean);
  const point = MEASURE_POINTS.find((p) => p.id === runtime.point)?.label;

  return (
    <div className={styles.actions}>
      {runtime.message && <p className={styles.note}>{runtime.message}</p>}
      <div className={styles.buttons}>
        <span className={styles.note} data-inline title={point}>
          {runtime.display}
        </span>
        {burned && (
          <button className={styles.fireButton} onClick={() => board.replaceBurned()}>
            Cambiar lo quemado
          </button>
        )}
      </div>
    </div>
  );
}
