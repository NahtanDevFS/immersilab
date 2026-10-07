"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { CoverageEngine, CoverageRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Leyenda del mapa de calor, aviso de interferencia y contador de puntos.
 * Los retos los dibuja el HUD de retos del shell; las antenas se manejan
 * desde el panel de variables.
 */
export function CoverageControls({ engine }: Props) {
  const coverage = engine as CoverageEngine;
  const [runtime, setRuntime] = useState<CoverageRuntime>(() => ({
    ...coverage.getRuntime(),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto.
      setRuntime({ ...coverage.getRuntime() });
    }, 150);
    return () => window.clearInterval(id);
  }, [coverage]);

  const { covered, total, interfered } = runtime.summary;

  return (
    <div className={styles.actions}>
      {/* Leyenda del mapa de calor: aquí y no en el piso, donde quedaba
          debajo del panel de variables o del botón del tutor. */}
      <p className={styles.note} data-legend>
        Piso: <span data-ok>verde</span> buena señal · <span data-weak>rojo</span> no
        alcanza · <span data-interf>magenta</span> interferencia
      </p>

      {interfered > 0 && (
        <p className={styles.note}>
          {interfered} punto{interfered > 1 ? "s" : ""} con interferencia: dos antenas en el
          mismo canal se pisan donde se solapan.
        </p>
      )}

      <div className={styles.buttons}>
        <span className={styles.note} data-inline>
          {covered}/{total} cubiertos
        </span>
      </div>
    </div>
  );
}
