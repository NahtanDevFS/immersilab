"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import {
  MAX_MESSAGE_LENGTH,
  MIN_CHALLENGE_LENGTH,
  type QamEngine,
  type QamRuntime,
} from "./engine";
import styles from "./QamControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Botón de transmitir y "pantalla" del receptor.
 *
 * El texto recibido va aquí y no en el panel de resultados a propósito: es el
 * feedback del juego. Ver "HOLA UMG" convertirse en "H�LA U�G" comunica lo
 * que significa un BER de 3% mucho mejor que el número 3.
 */
export function QamControls({ engine }: Props) {
  const qam = engine as QamEngine;
  const [runtime, setRuntime] = useState<QamRuntime>(() => qam.getRuntime());
  const [message, setMessage] = useState(() => qam.getMessage());

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el runtime es el MISMO objeto siempre (el motor lo
      // muta), así que sin copiarlo React no ve ningún cambio y no
      // re-renderiza nunca.
      setRuntime({ ...qam.getRuntime() });
      // El mensaje también puede cambiar desde el visor (lista de mensajes).
      setMessage(qam.getMessage());
    }, 100);
    return () => window.clearInterval(id);
  }, [qam]);

  const transmitting = runtime.phase === "transmitiendo";

  const short = message.trim().length > 0 && message.trim().length < MIN_CHALLENGE_LENGTH;

  return (
    <div className={styles.actions}>
      {/* El mensaje a transmitir. Se limpia al escribir (sin tildes ni ñ:
          cada letra tiene que ser un solo byte), así se ve qué viaja. */}
      <label className={styles.message} data-short={short}>
        <span>Tu mensaje</span>
        <input
          type="text"
          value={message}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="HOLA UMG"
          disabled={transmitting}
          onChange={(e) => setMessage(qam.setMessage(e.target.value))}
          title={`Hasta ${MAX_MESSAGE_LENGTH} caracteres. Para los retos, ${MIN_CHALLENGE_LENGTH} o más.`}
        />
        {short && <small>Con menos de {MIN_CHALLENGE_LENGTH} no cuenta para los retos</small>}
      </label>

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
