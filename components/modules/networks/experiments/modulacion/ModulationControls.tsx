"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { ModulationEngine, ModulationRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Botón de la radio y tarjeta de retos.
 *
 * El audio arranca con un clic porque los navegadores no dejan sonar nada
 * sin un gesto del usuario. Los retos funcionan igual con la radio apagada:
 * el sonido ayuda a "sentir" la sintonía, pero no es obligatorio.
 */
export function ModulationControls({ engine }: Props) {
  const radio = engine as ModulationEngine;
  const [runtime, setRuntime] = useState<ModulationRuntime>(() => ({
    ...radio.getRuntime(),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto.
      setRuntime({ ...radio.getRuntime() });
    }, 100);
    return () => {
      window.clearInterval(id);
      // Salir del experimento apaga la radio: si no, seguiría sonando en el lobby.
      radio.stopAudio();
    };
  }, [radio]);

  const { sintonizar_am, modular_100, sintonizar_fm } = runtime.challenges;

  const challenges = [
    {
      key: "am",
      title: "Sintoniza Radio UMG (AM)",
      detail: "Está en 1040 kHz: mete su señal en el filtro del receptor.",
      state: sintonizar_am,
    },
    {
      key: "mod",
      title: "Modula al 100 % sin pasarte",
      detail: runtime.overmodulated
        ? "¡Sobremodulación! La envolvente se corta y el audio se distorsiona."
        : "Con Radio UMG sintonizada, lleva el índice entre 0.9 y 1.",
      state: modular_100,
    },
    {
      key: "fm",
      title: "Sintoniza UMG FM",
      detail: "Cambia a FM y búscala en 95.3 MHz.",
      state: sintonizar_fm,
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
              <span className={styles.detail}>{detail}</span>
              <span className={styles.bar}>
                <span style={{ width: `${state.progress * 100}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.buttons}>
        <button className={styles.resetButton} onClick={() => radio.reset()}>
          Reiniciar retos
        </button>
        <button
          className={styles.fireButton}
          onClick={() => (runtime.audioOn ? radio.stopAudio() : void radio.startAudio())}
        >
          {runtime.audioOn ? "Apagar radio" : "Encender radio"}
        </button>
      </div>
    </div>
  );
}
