"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import type { CollisionEngine, CollisionPhase } from "./engine";
import styles from "./CollisionControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

export function CollisionControls({ engine }: Props) {
  const collision = engine as CollisionEngine;
  const [phase, setPhase] = useState<CollisionPhase>("idle");

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase(collision.getRuntime().phase);
    }, 120);
    return () => window.clearInterval(id);
  }, [collision]);

  return (
    <div className={styles.actions}>
      <button
        className={styles.fireButton}
        onClick={() => collision.start()}
        disabled={phase === "moving"}
      >
        {phase === "collided" ? "Soltar de nuevo" : "Soltar"}
      </button>
      {phase !== "idle" && (
        <button
          className={styles.resetButton}
          onClick={() => collision.reset()}
        >
          Reiniciar
        </button>
      )}
    </div>
  );
}