"use client";

import { useEffect } from "react";
import { enterVr, exitVr } from "@/lib/view/viewMode";
import styles from "./VrControls.module.css";

/**
 * Botón para pasar a la vista VR (pantalla partida para el visor), como el
 * del visor en los videos 360 de YouTube. Va en el encabezado.
 *
 * `onBeforeEnter`: en iPhone el giroscopio necesita un toque para pedir
 * permiso; se aprovecha este mismo toque.
 */
export function VrButton({ onBeforeEnter }: { onBeforeEnter?: () => void }) {
  return (
    <button
      type="button"
      className={styles.enter}
      onClick={() => {
        onBeforeEnter?.();
        void enterVr();
      }}
      aria-label="Ver con visor de realidad virtual"
      title="Ver con visor (pantalla dividida)"
    >
      <VisorIcon />
      <span>Visor</span>
    </button>
  );
}

/**
 * Salida de la vista VR. Una ✕ arriba al centro de CADA mitad: cada ojo ve
 * solo su mitad de la pantalla, así que un botón único quedaría partido.
 * También se sale con Escape (en la compu) o al salir de pantalla completa.
 */
export function VrExit() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exitVr();
    };
    // Si el sistema saca la pantalla completa (gesto de atrás en Android),
    // se vuelve a la vista 360: la pantalla partida sin pantalla completa
    // queda tapada por las barras del navegador.
    let wasFullscreen = Boolean(document.fullscreenElement);
    const onFullscreen = () => {
      const now = Boolean(document.fullscreenElement);
      if (wasFullscreen && !now) void exitVr();
      wasFullscreen = now;
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  return (
    <div className={styles.exitLayer} data-vr-keep>
      {[0, 1].map((eye) => (
        <button
          key={eye}
          type="button"
          className={styles.exit}
          onClick={() => void exitVr()}
          aria-label="Salir de la vista con visor"
        >
          ✕ Salir del visor
        </button>
      ))}
      {/* La línea del medio: ayuda a calzar el celular centrado en el visor. */}
      <span className={styles.divider} aria-hidden />
    </div>
  );
}

function VisorIcon() {
  return (
    <svg viewBox="0 0 24 16" width="20" height="14" aria-hidden>
      <path
        d="M2 3.5C2 2.7 2.7 2 3.5 2h17c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-5.2l-2-3.2a1.5 1.5 0 0 0-2.6 0l-2 3.2H3.5C2.7 14 2 13.3 2 12.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="2.2" fill="currentColor" />
      <circle cx="16.5" cy="7.5" r="2.2" fill="currentColor" />
    </svg>
  );
}
