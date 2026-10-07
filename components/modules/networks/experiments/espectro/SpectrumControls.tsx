"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { SpectrumEngine, SpectrumRuntime } from "./engine";
import styles from "@/components/modules/shared/ExperimentActions.module.css";

interface Props {
  engine: ExperimentEngine;
}

const MIC_NOTE: Partial<Record<SpectrumRuntime["mic"], string>> = {
  pidiendo: "Acepta el permiso del micrófono en el navegador…",
  "sin-permiso": "Sin permiso de micrófono. Actívalo en el candado de la barra de direcciones.",
  "sin-soporte":
    "El navegador no entrega el micrófono aquí: abre el laboratorio por https:// o desde localhost.",
};

/**
 * Botón del micrófono y tarjeta de retos.
 *
 * Los retos van aquí y no en el panel de resultados: son instrucciones con
 * progreso ("silba", "di u y luego i"), y el panel de resultados es para
 * números. Mientras se juega, la vista está en la cascada; la tarjeta solo
 * confirma qué falta.
 */
export function SpectrumControls({ engine }: Props) {
  const spectrum = engine as SpectrumEngine;
  const [runtime, setRuntime] = useState<SpectrumRuntime>(() => ({
    ...spectrum.getRuntime(),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto.
      setRuntime({ ...spectrum.getRuntime() });
    }, 100);
    return () => {
      window.clearInterval(id);
      // Salir del experimento apaga el micrófono: si no, el indicador de
      // grabación del navegador seguiría encendido en el lobby.
      spectrum.stopMic();
    };
  }, [spectrum]);

  const listening = runtime.mic === "escuchando";
  const { silbido, vocales, banda } = runtime.challenges;

  const challenges = [
    {
      key: "silbido",
      title: "Silba",
      detail: "Un tono puro deja un solo pico.",
      state: silbido,
    },
    {
      key: "vocales",
      title: runtime.vowelStage === "u" ? "Di «uuu»…" : "…y ahora «iii»",
      detail:
        runtime.vowelStage === "u"
          ? "Sostén la u un segundo."
          : "Mira cómo aparece energía arriba de 2 kHz.",
      state: vocales,
    },
    {
      key: "banda",
      title: "Habla 3 segundos",
      detail:
        banda.progress > 0
          ? `${runtime.phoneBandPct.toFixed(0)} % de tu voz cabe en la banda telefónica.`
          : "¿Cuánto de tu voz cabe en 300–3400 Hz?",
      state: banda,
    },
  ];

  return (
    <div className={styles.actions}>
      {listening && (
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
      )}

      {MIC_NOTE[runtime.mic] && <p className={styles.note}>{MIC_NOTE[runtime.mic]}</p>}

      <div className={styles.buttons}>
        {listening && (
          <button className={styles.resetButton} onClick={() => spectrum.reset()}>
            Reiniciar retos
          </button>
        )}
        <button
          className={styles.fireButton}
          disabled={runtime.mic === "pidiendo"}
          onClick={() => (listening ? spectrum.stopMic() : void spectrum.startMic())}
        >
          {listening ? "Apagar micrófono" : "Encender micrófono"}
        </button>
      </div>
    </div>
  );
}
