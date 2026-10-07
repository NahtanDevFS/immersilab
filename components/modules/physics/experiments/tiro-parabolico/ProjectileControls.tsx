"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import {
  TARGETS_X,
  type ProjectileEngine,
  type ProjectileMode,
  type ProjectilePhase,
} from "./engine";
import styles from "./ProjectileControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

interface View {
  phase: ProjectilePhase;
  mode: ProjectileMode;
  targetIndex: number;
  total: number;
  finished: boolean;
}

function read(projectile: ProjectileEngine): View {
  const r = projectile.getRuntime();
  return {
    phase: r.phase,
    mode: r.mode,
    targetIndex: r.round.targetIndex,
    total: r.round.total,
    finished: r.round.finished,
  };
}

/**
 * Botones de acción específicos de este experimento (no todos los
 * experimentos van a tener "Lanzar" — por eso vive aquí y no en el shell).
 * Sigue la fase del motor con un intervalo corto; es HTML fuera del
 * <Canvas>, no necesita sincronizarse a 60fps.
 *
 * En los modos de juego (F1 · Artillería) el botón dice a qué blanco se
 * dispara y hay un marcador de la ronda.
 */
export function ProjectileControls({ engine }: Props) {
  const projectile = engine as ProjectileEngine;
  const [view, setView] = useState<View>(() => read(projectile));

  useEffect(() => {
    const id = window.setInterval(() => setView(read(projectile)), 120);
    return () => window.clearInterval(id);
  }, [projectile]);

  const game = view.mode !== "libre";
  const fireLabel = !game
    ? view.phase === "landed"
      ? "Lanzar de nuevo"
      : "Lanzar"
    : `Disparar al blanco ${view.targetIndex + 1} (${TARGETS_X[view.targetIndex]} m)`;

  return (
    <div className={styles.actions}>
      {game && (
        <span className={styles.score}>
          {view.finished ? "Ronda terminada · " : `Blanco ${view.targetIndex + 1}/3 · `}
          {view.total} pts
        </span>
      )}

      {game && view.finished ? (
        <button className={styles.fireButton} onClick={() => projectile.newRound()}>
          Nueva ronda
        </button>
      ) : (
        <button
          className={styles.fireButton}
          onClick={() => projectile.fire()}
          disabled={view.phase === "flying"}
        >
          {fireLabel}
        </button>
      )}

      {game && !view.finished && view.targetIndex > 0 && (
        <button className={styles.resetButton} onClick={() => projectile.newRound()}>
          Reiniciar ronda
        </button>
      )}
      {!game && view.phase !== "idle" && (
        <button className={styles.resetButton} onClick={() => projectile.reset()}>
          Reiniciar
        </button>
      )}
    </div>
  );
}
