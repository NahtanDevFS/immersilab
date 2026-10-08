"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { SupplyEngine, SupplyRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/** La salida de la fuente y qué haría el celular con ella. */
export function SupplyControls({ engine }: Props) {
  const supply = engine as SupplyEngine;
  const [runtime, setRuntime] = useState<SupplyRuntime>(() => ({ ...supply.getRuntime() }));

  useEffect(() => {
    const id = window.setInterval(() => setRuntime({ ...supply.getRuntime() }), 150);
    return () => window.clearInterval(id);
  }, [supply]);

  const r = runtime.result;
  const phone =
    runtime.phone === "carga"
      ? "El celular está cargando."
      : runtime.phone === "sobrevoltaje"
        ? "¡Sobrevoltaje! El celular se dañaría."
        : "El celular no carga: le llega muy poco, o la salida baja demasiado entre picos.";

  return (
    <div className={styles.actions}>
      <p
        className={styles.note}
        style={{
          color:
            runtime.phone === "carga" ? "#34d399" : runtime.phone === "sobrevoltaje" ? "var(--lab-danger)" : undefined,
        }}
      >
        {phone}
      </p>
      <div className={styles.buttons}>
        <span className={styles.note} data-inline>
          {r.outAvg.toFixed(2)} V · rizado {r.ripplePct.toFixed(1)} %
        </span>
      </div>
    </div>
  );
}
