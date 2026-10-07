"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import { GOOD_PREDICTION, type CollisionEngine, type CollisionPhase } from "./engine";
import styles from "./CollisionControls.module.css";

interface Props {
  engine: ExperimentEngine;
}

export function CollisionControls({ engine }: Props) {
  const collision = engine as CollisionEngine;
  const [phase, setPhase] = useState<CollisionPhase>("idle");
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const runtime = collision.getRuntime();
      setPhase(runtime.phase);
      setScore(runtime.prediction?.score ?? null);
    }, 120);
    return () => window.clearInterval(id);
  }, [collision]);

  return (
    <div className={styles.actions}>
      {/* Puntaje de la predicción del último choque (F2). */}
      {score !== null && (
        <span className={styles.score} data-good={score >= GOOD_PREDICTION}>
          Tu predicción: {score} pts
        </span>
      )}
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