"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNarration } from "@/lib/narration/useNarration";
import { TOUR, tourHref } from "@/lib/tour";
import type { VariablesState } from "@/types/module";
import styles from "./TourPanel.module.css";

interface Props {
  index: number;
  /** Aplica las variables con las que arranca la parada. */
  onPreset: (values: VariablesState) => void;
  /** Deja el recorrido y sigue en este experimento, libre. */
  onExit: () => void;
  /** Abre la explicación completa del experimento (BriefingPanel). */
  onShowBriefing: () => void;
}

/**
 * Cuándo se narró cada parada. A nivel de módulo por lo mismo que en
 * BriefingPanel: el modo estricto de React monta dos veces y la frase se
 * escucharía dos veces encimada.
 */
const narratedAt = new Map<number, number>();

/**
 * Tarjeta del recorrido guiado (lib/tour.ts). Al llegar a una parada se abre
 * con un texto corto y lo lee en voz alta; "Ver el experimento" la pliega a
 * una pastilla arriba al centro con el botón para seguir. Reemplaza a la
 * explicación larga del experimento, que en una demo frena demasiado (sigue
 * a mano con "Explicación completa").
 */
export function TourPanel({ index, onPreset, onExit, onShowBriefing }: Props) {
  const router = useRouter();
  const { status, speak, stop, canPlayAudio } = useNarration();
  const [expanded, setExpanded] = useState(true);
  const current = TOUR[index];
  const next = TOUR[index + 1];

  // Variables de la parada: en una tarea aparte, no como setState síncrono
  // dentro del efecto (provoca un render en cascada).
  useEffect(() => {
    if (!current.preset) return;
    const id = window.setTimeout(() => onPreset(current.preset!), 0);
    return () => window.clearTimeout(id);
    // Solo al llegar a la parada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Se lee sola al llegar, si el navegador ya deja sonar audio (llegar con un
  // clic desde la parada anterior cuenta como interacción).
  useEffect(() => {
    const now = Date.now();
    if (canPlayAudio() && now - (narratedAt.get(index) ?? 0) > 3000) {
      narratedAt.set(index, now);
      speak(current.say);
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const goNext = () => {
    stop();
    router.push(next ? tourHref(index + 1) : "/progreso");
  };
  const exit = () => {
    stop();
    onExit();
  };

  const counter = `Recorrido · ${index + 1} de ${TOUR.length}`;
  const nextLabel = next ? `Siguiente: ${next.name} →` : "Terminar recorrido →";

  if (!expanded) {
    return (
      <div className={styles.pill}>
        <button
          type="button"
          className={styles.pillInfo}
          onClick={() => setExpanded(true)}
          aria-label="Ver el texto de esta parada"
        >
          {index + 1}/{TOUR.length} ?
        </button>
        <button type="button" className={styles.pillNext} onClick={goNext}>
          {nextLabel}
        </button>
      </div>
    );
  }

  return (
    <section className={styles.card} aria-label="Recorrido guiado">
      <p className={styles.counter}>{counter}</p>
      <h2 className={styles.title}>{current.name}</h2>
      <p className={styles.text}>{current.say}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => setExpanded(false)}>
          Ver el experimento
        </button>
        {status !== "unsupported" && (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => (status === "speaking" ? stop() : speak(current.say))}
          >
            {status === "speaking" ? "⏹ Detener" : "▶ Escuchar"}
          </button>
        )}
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.link} onClick={exit}>
          Salir del recorrido
        </button>
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            stop();
            setExpanded(false);
            onShowBriefing();
          }}
        >
          Explicación completa
        </button>
        <button type="button" className={styles.link} onClick={goNext}>
          {nextLabel}
        </button>
      </div>
    </section>
  );
}
