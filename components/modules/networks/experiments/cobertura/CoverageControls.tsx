"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { CoverageEngine, CoverageRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/** Tarjeta de los tres retos de cobertura. Las antenas se manejan desde el panel de variables. */
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

  const { campus, wifi, reutilizar } = runtime.challenges;
  const { covered, total, interfered } = runtime.summary;
  const challenges = [
    {
      key: "campus",
      title: "Cubre el campus",
      detail: `Los ${total} puntos con buena señal, en cualquier banda.`,
      state: campus,
    },
    {
      key: "wifi",
      title: "Wi-Fi en 2.4 GHz",
      detail: "Lo mismo en la banda de Wi-Fi: los muros atenúan más.",
      state: wifi,
    },
    {
      key: "reuse",
      title: "Reutiliza canales",
      detail: "Tres antenas en 2.4 GHz con solo dos canales distintos.",
      state: reutilizar,
    },
  ];

  return (
    <div className={styles.actions}>
      <ol className={styles.challenges}>
        {challenges.map(({ key, title, detail, state }) => (
          <li key={key} className={styles.challenge} data-done={state.done}>
            <span className={styles.check} aria-hidden>
              {state.done ? "✓" : ""}
            </span>
            <span className={styles.text}>
              <strong>{title}</strong>
              <span className={styles.detail}>{state.done ? "¡Logrado!" : detail}</span>
              <span className={styles.bar}>
                <span style={{ width: `${state.progress * 100}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ol>

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
        <button className={styles.resetButton} onClick={() => coverage.reset()}>
          Reiniciar retos
        </button>
      </div>
    </div>
  );
}
