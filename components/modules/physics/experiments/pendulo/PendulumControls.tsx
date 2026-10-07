"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { PendulumEngine, PendulumRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/** Botón de soltar/detener y tarjeta con los tres retos. */
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

  const { sincronizar, masa, doble } = runtime.challenges;
  const challenges = [
    {
      key: "sync",
      title: "Sincroniza los relojes",
      detail: "Que tu péndulo tenga el mismo período que la referencia (±1 %).",
      state: sincronizar,
    },
    {
      key: "mass",
      title: "¿Y la masa?",
      detail: sincronizar.done
        ? "Sin soltar de nuevo, cambia la masa en 2 kg o más. ¿Se desincroniza?"
        : "Primero sincroniza; después cambia la masa.",
      state: masa,
    },
    {
      key: "double",
      title: "El doble de lento",
      detail: "Que tu período sea exactamente el doble. ¿Cuánto hay que alargarlo?",
      state: doble,
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

      <div className={styles.buttons}>
        <button className={styles.resetButton} onClick={() => pendulum.reset()}>
          Reiniciar retos
        </button>
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
