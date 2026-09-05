"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { OsiEngine, OsiRuntime } from "./engine";
import styles from "./OsiControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * La jugada: elegir qué cabecera pone (o saca) la capa en la que está el
 * paquete.
 *
 * El texto de arriba dice en qué capa estamos y para qué sirve, y aparece
 * DESPUÉS de elegir, no antes: si dijera "ahora toca IP", el juego se
 * reduciría a leer la respuesta. Lo que sí se muestra siempre es el error
 * anterior, porque equivocarse sin saber por qué no enseña nada.
 */
export function OsiControls({ engine }: Props) {
  const osi = engine as OsiEngine;
  const [runtime, setRuntime] = useState<OsiRuntime>(() => osi.getRuntime());

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta siempre el mismo objeto y sin
      // copiarlo React no ve el cambio.
      setRuntime({ ...osi.getRuntime() });
    }, 100);
    return () => window.clearInterval(id);
  }, [osi]);

  const stack = runtime.stack;
  const index =
    runtime.phase === "bajando"
      ? runtime.depth
      : stack.length - 1 - runtime.depth;
  const step = stack[index];

  return (
    <div className={styles.actions}>
      {runtime.lastError && step && (
        <p className={styles.readout}>
          {runtime.lastError} no va acá — esta capa {step.why.toLowerCase()}
        </p>
      )}

      {runtime.phase === "viajando" && (
        <p className={styles.readout}>Viajando por el cable…</p>
      )}

      {runtime.phase === "entregado" ? (
        <button className={styles.hop} onClick={() => osi.restart()}>
          Otro mensaje
        </button>
      ) : (
        <div className={styles.hops}>
          {runtime.options.map((option) => (
            <button
              key={option}
              className={styles.hop}
              onClick={() => osi.choose(option)}
            >
              {runtime.phase === "bajando" ? `+ ${option}` : `− ${option}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
