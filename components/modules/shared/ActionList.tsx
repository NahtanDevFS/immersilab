"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { ExperimentEngine, VrAction } from "@/types/module";
import styles from "./ExperimentActions.module.css";

/**
 * Arma el `ControlsComponent` (HTML, modo computadora) a partir de la misma
 * función que alimenta `vrActions`. Así las dos vistas no se pueden
 * desincronizar: un botón que existe con el mouse existe también en el
 * visor, con la misma etiqueta y el mismo efecto.
 *
 * Las líneas `info` van como notas y los botones en una fila al final; el
 * botón `primary` usa el color de acción principal.
 */
export function actionControls(
  build: (engine: ExperimentEngine) => VrAction[],
): ComponentType<{ engine: ExperimentEngine }> {
  function ActionControls({ engine }: { engine: ExperimentEngine }) {
    const [actions, setActions] = useState<VrAction[]>(() => build(engine));

    useEffect(() => {
      const id = window.setInterval(() => setActions(build(engine)), 120);
      return () => window.clearInterval(id);
    }, [engine]);

    const notes = actions.filter((a) => a.info);
    const buttons = actions.filter((a) => !a.info);
    return (
      <div className={styles.actions}>
        {notes.map((a) => (
          <p key={a.id} className={styles.note} data-legend>
            {a.label}
          </p>
        ))}
        {buttons.length > 0 && (
          <div className={styles.buttons} data-wrap>
            {buttons.map((a) => (
              <button
                key={a.id}
                className={a.primary ? styles.fireButton : styles.secondaryButton}
                onClick={() => a.onSelect?.()}
                disabled={a.disabled}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return ActionControls;
}
