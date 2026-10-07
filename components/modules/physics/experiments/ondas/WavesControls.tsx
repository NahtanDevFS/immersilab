"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import { TARGETS, type WavesEngine, type WavesRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Tarjeta de los cuatro objetivos y botón de sonido. El objetivo activo se
 * elige en el panel de variables; aquí se ve cuáles ya se lograron y cuánto
 * falta para el actual.
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
      <ol className={styles.challenges}>
        {TARGETS.map((target) => {
          const challenge = runtime.challenges[target.id];
          const active = runtime.target.id === target.id;
          const detail = challenge.done
            ? "¡Logrado!"
            : active
              ? `${target.hint} Ajuste: ${Math.round(runtime.fit * 100)} %.`
              : target.hint;
          return (
            <li key={target.id} className={styles.challenge} data-done={challenge.done}>
              <span className={styles.check} aria-hidden>
                {challenge.done ? "✓" : ""}
              </span>
              <span className={styles.text}>
                <strong>
                  {target.label}
                  {active && !challenge.done ? " ←" : ""}
                </strong>
                <span className={styles.detail}>{detail}</span>
                <span className={styles.bar}>
                  <span
                    style={{
                      width: `${(challenge.done ? 1 : active ? runtime.fit : 0) * 100}%`,
                    }}
                  />
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className={styles.buttons}>
        <button className={styles.resetButton} onClick={() => waves.reset()}>
          Reiniciar retos
        </button>
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
