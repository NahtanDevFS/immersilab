"use client";

import { useEffect, useState } from "react";
import type { ExperimentEngine } from "@/types/module";
import styles from "./ResultPanel.module.css";

interface Props {
  engine: ExperimentEngine;
}

/** Convierte "altura_maxima_m" en "Altura maxima m" — legible sin acoplarse
 * a las claves exactas que use cada experimento. */
function formatLabel(key: string): string {
  const withSpaces = key.replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Panel de resultados compartido por todos los experimentos. No conoce la
 * disciplina: lee `engine.getState().result` (definido en el contrato de
 * módulo) y lo muestra como pares clave/valor. Si el motor implementa
 * `getSeries()`, además dibuja una mini-gráfica.
 *
 * Se actualiza con un intervalo corto en vez de cada frame — es HTML fuera
 * del <Canvas>, no necesita 60 actualizaciones por segundo.
 */
export function ResultPanel({ engine }: Props) {
  const [result, setResult] = useState<Record<string, number | string>>();
  const [series, setSeries] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setResult(engine.getState().result);
      if (engine.getSeries) setSeries(engine.getSeries());
    }, 120);
    return () => window.clearInterval(id);
  }, [engine]);

  if (!result) return null;

  return (
    <div className={styles.panel}>
      <p className={styles.title}>Resultado</p>
      <dl className={styles.list}>
        {Object.entries(result).map(([key, value]) => (
          <div key={key} className={styles.row}>
            <dt className={styles.label}>{formatLabel(key)}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
      {series.length > 1 && <Sparkline points={series} />}
    </div>
  );
}

function Sparkline({ points }: { points: Array<{ x: number; y: number }> }) {
  const width = 140;
  const height = 34;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const path = points
    .map((p) => {
      const x = ((p.x - minX) / spanX) * width;
      // Y invertido: en pantalla, "arriba" es menor valor de y.
      const y = height - ((p.y - minY) / spanY) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={styles.sparkline}
    >
      <polyline points={path} fill="none" stroke="var(--lab-accent-warm)" strokeWidth="1.5" />
    </svg>
  );
}