"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useVisorSettings } from "@/lib/view/visorSettings";
import { enterFullscreen, enterVr, exitVr, isTouchDevice, useViewMode } from "@/lib/view/viewMode";
import { readPad } from "./gamepad";

/**
 * Botón del control que entra al visor desde la vista normal: el 3 (clic del
 * stick derecho en el ESP32, Y en un control estándar). Dentro del visor el
 * mismo botón oculta y muestra los paneles (VrDashboard).
 */
const ENTER_VR_BUTTON = 3;
import styles from "./VrControls.module.css";

/**
 * Botón para pasar a la vista VR (pantalla partida para el visor), como el
 * del visor en los videos 360 de YouTube. Va en el encabezado.
 *
 * `onBeforeEnter`: en iPhone el giroscopio necesita un toque para pedir
 * permiso; se aprovecha este mismo toque.
 */
export function VrButton({ onBeforeEnter }: { onBeforeEnter?: () => void }) {
  const view = useViewMode();

  // Con el control, en el celular: entrar al visor sin tocar la pantalla.
  // El navegador puede no dar pantalla completa sin un toque real; en ese
  // caso el visor lo avisa y un toque la recupera (VrExit).
  useEffect(() => {
    if (view !== "360" || !isTouchDevice()) return;
    let rafId = 0;
    let wasPressed = true; // si ya venía apretado (al salir del visor), no cuenta
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const pressed = readPad()?.rawButtons[ENTER_VR_BUTTON] ?? false;
      if (pressed && !wasPressed) void enterVr();
      wasPressed = pressed;
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [view]);

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
 * También se sale con Escape (en la compu).
 *
 * Si se pierde la pantalla completa (un gesto de atrás, bajar la barra de
 * notificaciones), en el celular NO se sale del visor: con el teléfono
 * puesto en el visor, salir obligaba a sacarlo para volver a entrar. Se
 * queda en el visor y se avisa en cada ojo que un toque en la pantalla (o
 * un botón del control, si el navegador lo acepta) la recupera. En la
 * computadora sí se sale, como antes: ahí es intencional.
 */
export function VrExit() {
  const [needsFullscreen, setNeedsFullscreen] = useState(false);

  useEffect(() => {
    const touch = isTouchDevice();
    const supported = Boolean(document.fullscreenEnabled);
    const check = () => setNeedsFullscreen(touch && supported && !document.fullscreenElement);
    const id = window.setTimeout(check, 600); // dar tiempo a que entre la primera vez

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exitVr();
    };
    let wasFullscreen = Boolean(document.fullscreenElement);
    const onFullscreen = () => {
      const now = Boolean(document.fullscreenElement);
      if (wasFullscreen && !now && !touch) void exitVr();
      wasFullscreen = now;
      check();
    };
    // Cualquier toque en la pantalla es un gesto válido para pedirla.
    const onTouch = () => {
      if (touch && supported && !document.fullscreenElement) void enterFullscreen();
    };
    // Y cualquier botón del control, por si el navegador lo acepta.
    let rafId = 0;
    let padWas = true;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const pad = readPad();
      const pressed = Boolean(pad && pad.rawButtons.some(Boolean));
      if (pressed && !padWas) onTouch();
      padWas = pressed;
    };
    rafId = requestAnimationFrame(tick);

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onTouch, { capture: true });
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onTouch, { capture: true });
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  // En el celular la ✕ no se muestra: con el teléfono en el visor no se
  // puede tocar con precisión, y como no está centrada en los lentes se veía
  // doble. Para salir está "Salir del visor" en los paneles 3D (se elige con
  // la mira). En la computadora sí, porque ahí se usa con el mouse.
  const touch = useSyncExternalStore(subscribeNever, isTouchDevice, () => false);
  const { lensSeparation } = useVisorSettings();

  return (
    <div className={styles.exitLayer} data-vr-keep>
      {!touch &&
        [0, 1].map((eye) => (
          <div key={eye} className={styles.eyeTop}>
            <button
              type="button"
              className={styles.exit}
              onClick={() => void exitVr()}
              aria-label="Salir de la vista con visor"
            >
              ✕ Salir del visor
            </button>
          </div>
        ))}
      {/* El aviso, centrado en cada lente (no en cada mitad): así se ve uno solo. */}
      {needsFullscreen &&
        [-1, 1].map((side) => (
          <p
            key={side}
            className={styles.fullscreenNote}
            style={{ left: `calc(50% ${side < 0 ? "-" : "+"} ${lensSeparation / 2}px)` }}
          >
            Toca la pantalla para volver a pantalla completa
          </p>
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

function subscribeNever() {
  return () => {};
}
