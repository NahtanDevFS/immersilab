"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { QamEngine, QamRuntime } from "./engine";
import styles from "./QamControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Botón de transmitir y "pantalla" del receptor.
 *
 * El texto recibido va acá y no en el panel de resultados a propósito: es el
 * feedback del juego. Ver "HOLA UMG" convertirse en "H�LA U�G" comunica lo
 * que significa un BER de 3% mucho mejor que el número 3.
 */
export function QamControls({ engine }: Props) {
  const qam = engine as QamEngine;
  const [runtime, setRuntime] = useState<QamRuntime>(() => qam.getRuntime());

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el runtime es el MISMO objeto siempre (el motor lo
      // muta), así que sin copiarlo React no ve ningún cambio y no
      // re-renderiza nunca.
      setRuntime({ ...qam.getRuntime() });
    }, 100);
    return () => window.clearInterval(id);
  }, [qam]);

  const transmitting = runtime.phase === "transmitiendo";

  return (
    <div className={styles.actions}>
      {runtime.phase !== "listo" && (
        <p className={styles.readout}>
          {transmitting
            ? `${runtime.progress}/${runtime.total} símbolos`
            : runtime.receivedText}
        </p>
      )}

      <button
        className={styles.fireButton}
        onClick={() => qam.transmit()}
        disabled={transmitting}
      >
        {transmitting ? "Transmitiendo…" : "Transmitir mensaje"}
      </button>
    </div>
  );
}
