"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import { findLink, NODES, type RoutingEngine, type RoutingRuntime } from "./engine";
import styles from "./RoutingControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

function labelOf(id: string): string {
  return NODES.find((n) => n.id === id)?.label ?? id;
}

/**
 * Los saltos posibles, como botones.
 *
 * Duplica lo que se puede hacer clickeando un router en la escena, y es a
 * propósito: dentro del visor no hay puntero para tocar un objeto 3D, y el
 * cursor virtual del gamepad resuelve sobre el DOM. Las dos vías llaman al
 * mismo `hop()`, así que no hay dos caminos de código que se puedan
 * desincronizar.
 *
 * Cada botón muestra el costo del enlace: la decisión del jugador tiene que
 * poder tomarse mirando datos, no adivinando.
 */
export function RoutingControls({ engine }: Props) {
  const routing = engine as RoutingEngine;
  const [runtime, setRuntime] = useState<RoutingRuntime>(() =>
    routing.getRuntime(),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      // Copia superficial: el motor muta SIEMPRE el mismo objeto, así que sin
      // copiarlo React nunca ve un cambio.
      setRuntime({ ...routing.getRuntime() });
    }, 100);
    return () => window.clearInterval(id);
  }, [routing]);

  const head = runtime.path[runtime.path.length - 1];

  return (
    <div className={styles.actions}>
      <p className={styles.readout}>
        {runtime.path.join("→")} · {runtime.cost}
      </p>

      {runtime.arrived ? (
        <button className={styles.hop} onClick={() => routing.restart()}>
          Otro paquete
        </button>
      ) : (
        <div className={styles.hops}>
          {runtime.options.map((option) => {
            const found = findLink(head, option);
            return (
              <button
                key={option}
                className={styles.hop}
                onClick={() => routing.hop(option)}
              >
                {labelOf(option)}
                {found ? ` · ${found.link.latency}ms` : ""}
              </button>
            );
          })}
        </div>
      )}

      <button
        className={styles.secondary}
        onClick={() => routing.toggleFailure()}
      >
        {runtime.downLinks.length > 0 ? "Reparar enlace" : "Cortar un enlace"}
      </button>
    </div>
  );
}
