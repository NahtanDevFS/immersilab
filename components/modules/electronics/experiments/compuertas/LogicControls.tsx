"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { LogicEngine, LogicRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/** El problema, el aviso de la última prueba y el botón para probar la tabla. */
export function LogicControls({ engine }: Props) {
  const logic = engine as LogicEngine;
  const [runtime, setRuntime] = useState<LogicRuntime>(() => ({ ...logic.getRuntime() }));

  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...logic.getRuntime() }), 100);
    return () => window.clearInterval(id);
  }, [logic]);

  const testing = runtime.testingRow >= 0;

  return (
    <div className={styles.actions}>
      <p className={styles.note} data-legend>
        {runtime.level.story}
      </p>
      {runtime.message && (
        <p
          className={styles.note}
          style={{ color: runtime.lastTest === "ok" ? "#34d399" : undefined }}
        >
          {runtime.message}
        </p>
      )}
      <div className={styles.buttons}>
        <button className={styles.fireButton} onClick={() => logic.runTest()} disabled={testing}>
          {testing
            ? `Probando ${runtime.testingRow + 1}/${runtime.rows.length}…`
            : "Probar todas las combinaciones"}
        </button>
      </div>
    </div>
  );
}
