"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import { SERIES_FUNCTIONS } from "./series";
import type { TaylorEngine, TaylorRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Tarjeta con un reto por función: cubrir su intervalo objetivo con el menor
 * grado posible. Al lograrlo se muestra el grado usado contra el mínimo, sin
 * decir con qué centro se consigue: encontrarlo es justamente el juego.
 */
export function TaylorControls({ engine }: Props) {
  const taylor = engine as TaylorEngine;
  const [runtime, setRuntime] = useState<TaylorRuntime>(() => ({
    ...taylor.getRuntime(),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto.
      setRuntime({ ...taylor.getRuntime() });
    }, 150);
    return () => window.clearInterval(id);
  }, [taylor]);

  return (
    <div className={styles.actions}>
      <ol className={styles.challenges}>
        {SERIES_FUNCTIONS.map((fn) => {
          const challenge = runtime.challenges[fn.id];
          const active = runtime.fn.id === fn.id;
          const perfect =
            challenge.bestDegree !== null && challenge.bestDegree <= challenge.minDegree;
          const detail = challenge.done
            ? perfect
              ? `Grado ${challenge.bestDegree}: ¡el mínimo posible!`
              : `Grado ${challenge.bestDegree}. Se puede con ${challenge.minDegree}: prueba otro centro.`
            : active
              ? `Cubierto: ${Math.round(runtime.coverage.fraction * 100)} % del objetivo.`
              : `Cubre [${fn.target[0].toFixed(2)}, ${fn.target[1].toFixed(2)}].`;
          const progress = challenge.done
            ? perfect
              ? 1
              : 0.75
            : active
              ? runtime.coverage.fraction * 0.7
              : 0;
          return (
            <li key={fn.id} className={styles.challenge} data-done={perfect}>
              <span className={styles.check} aria-hidden>
                {perfect ? "✓" : challenge.done ? "·" : ""}
              </span>
              <span className={styles.text}>
                <strong>{fn.label}</strong>
                <span className={styles.detail}>{detail}</span>
                <span className={styles.bar}>
                  <span style={{ width: `${progress * 100}%` }} />
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className={styles.buttons}>
        <button className={styles.resetButton} onClick={() => taylor.reset()}>
          Reiniciar retos
        </button>
      </div>
    </div>
  );
}
