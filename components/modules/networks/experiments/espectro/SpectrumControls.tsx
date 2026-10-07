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
 * Botón del micrófono y avisos de permiso. Los retos los dibuja el HUD de
 * retos del shell, a partir de `engine.getChallenges()`.
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
  return (
    <div className={styles.actions}>
      {MIC_NOTE[runtime.mic] && <p className={styles.note}>{MIC_NOTE[runtime.mic]}</p>}

      <div className={styles.buttons}>
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
