"use client";

import { useEffect, useState } from "react";
import styles from "./OrientationGate.module.css";

/**
 * Bloquea la experiencia con un aviso cuando el teléfono está en vertical.
 * El laboratorio está diseñado para horizontal (los paneles se acomodan
 * en las esquinas asumiendo una pantalla ancha).
 *
 * En Android/Chrome además intenta forzar el giro con la Screen Orientation
 * API — funciona solo si el navegador lo permite. En iOS (Safari) esa API
 * no existe: ahí el aviso de "girá tu teléfono" de abajo es el único
 * mecanismo que realmente funciona, por eso es el principal, no un plan B.
 */
export function OrientationGate({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setIsPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    orientation?.lock?.("landscape").catch(() => {
      // Se ignora a propósito: falla en la mayoría de navegadores si la
      // página no está en pantalla completa, o directamente no existe (iOS).
    });
  }, []);

  return (
    <>
      {children}
      {isPortrait && (
        <div className={styles.overlay}>
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 18h.01" />
          </svg>
          <p className={styles.text}>Girá tu teléfono</p>
          <p className={styles.subtext}>
            Este laboratorio funciona en horizontal
          </p>
        </div>
      )}
    </>
  );
}