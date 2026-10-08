"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import { findLink, LINKS, NODES, type RoutingEngine, type RoutingRuntime } from "./engine";
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

  const down = runtime.downLinks.length;
  const stuck = !runtime.arrived && runtime.options.length === 0;

  return (
    <div className={styles.actions}>
      {!runtime.reachable && (
        <p className={styles.warning}>
          El destino quedó aislado: ningún camino llega. Repara algún enlace.
        </p>
      )}
      {runtime.reachable && stuck && (
        <p className={styles.warning}>
          Callejón sin salida: este router no tiene más enlaces. Reinicia el paquete.
        </p>
      )}

      <div className={styles.row}>
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

        {/* Volver a empezar en cualquier momento, no solo al llegar. */}
        {!runtime.arrived && runtime.path.length > 1 && (
          <button className={styles.secondary} onClick={() => routing.restart()}>
            Reiniciar paquete
          </button>
        )}
      </div>

      {/* Cortes de enlace. En la escena se corta tocando el enlace; aquí está
          lo mismo para el visor, donde no hay puntero para tocar la escena. */}
      <div className={styles.row}>
        <select
          className={styles.select}
          value=""
          onChange={(e) => {
            if (e.target.value !== "") routing.toggleLink(Number(e.target.value));
          }}
          aria-label="Cortar o reparar un enlace"
        >
          <option value="">Cortar o reparar un enlace…</option>
          {LINKS.map((link, index) => (
            <option key={index} value={index}>
              {runtime.downLinks.includes(index) ? "✕ " : ""}
              {labelOf(link.from)} – {labelOf(link.to)} · {link.latency} ms
              {runtime.downLinks.includes(index) ? " (cortado: reparar)" : ""}
            </option>
          ))}
        </select>
        <button
          className={styles.secondary}
          onClick={() => routing.cutRandom()}
          disabled={!runtime.reachable}
        >
          Cortar uno al azar
        </button>
        {down > 0 && (
          <button className={styles.secondary} onClick={() => routing.repairAll()}>
            Reparar {down > 1 ? `los ${down}` : "el enlace"}
          </button>
        )}
      </div>
    </div>
  );
}
