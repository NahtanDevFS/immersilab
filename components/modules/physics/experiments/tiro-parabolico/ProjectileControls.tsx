"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { ProjectileEngine, ProjectilePhase } from "./engine";
import styles from "./ProjectileControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

/**
 * Botones de acción específicos de este experimento (no todos los
 * experimentos van a tener "Lanzar" — por eso vive acá y no en el shell).
 * Sigue la fase del motor con un intervalo corto; es HTML fuera del
 * <Canvas>, no necesita sincronizarse a 60fps.
 */
export function ProjectileControls({ engine }: Props) {
  const projectile = engine as ProjectileEngine;
  const [phase, setPhase] = useState<ProjectilePhase>("idle");

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase(projectile.getRuntime().phase);
    }, 120);
    return () => window.clearInterval(id);
  }, [projectile]);

  return (
    <div className={styles.actions}>
      <button
        className={styles.fireButton}
        onClick={() => projectile.fire()}
        disabled={phase === "flying"}
      >
        {phase === "landed" ? "Lanzar de nuevo" : "Lanzar"}
      </button>
      {phase !== "idle" && (
        <button
          className={styles.resetButton}
          onClick={() => projectile.reset()}
        >
          Reiniciar
        </button>
      )}
    </div>
  );
}