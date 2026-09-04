"use client";

import { useEffect, useState } from "react";
import { getActivePad, isPadDebugEnabled, readPad } from "./gamepad";
import styles from "./GamepadStatus.module.css";

interface PadInfo {
  id: string;
  mapping: string;
}

/**
 * Indicador del control conectado, sea USB o Bluetooth.
 *
 * Muestra el nombre del modelo y si el navegador lo reconoció con mapeo
 * estándar. Eso importa: con un control USB genérico el navegador reporta
 * mapeo vacío y los ejes pueden venir en otro orden, así que si los sticks
 * hacen cosas raras, este badge dice por qué — y con `?padDebug=1` muestra
 * los ejes y botones en vivo para encontrar los índices correctos y
 * pasarlos con `?stickR=`.
 *
 * Ojo con la Gamepad API: por seguridad, un control **no aparece hasta que
 * se aprieta un botón**. Un control USB recién enchufado que todavía no se
 * tocó es invisible para la página; por eso el estado "sin control" dice qué
 * hacer en vez de solo informar.
 */
export function GamepadStatus() {
  const [pad, setPad] = useState<PadInfo | null>(null);
  const debug = isPadDebugEnabled();
  const [raw, setRaw] = useState<string>("");

  useEffect(() => {
    // Los eventos gamepadconnected/disconnected cubren enchufar y
    // desenchufar, pero NO el primer botón de un control que el navegador
    // todavía no reveló, así que además se sondea. Es una vez por segundo,
    // no por frame — no cuesta nada.
    const check = () => {
      const active = getActivePad();
      setPad(
        active ? { id: active.id, mapping: active.mapping || "" } : null,
      );
    };

    check();
    const timer = window.setInterval(check, 1000);
    window.addEventListener("gamepadconnected", check);
    window.addEventListener("gamepaddisconnected", check);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("gamepadconnected", check);
      window.removeEventListener("gamepaddisconnected", check);
    };
  }, []);

  useEffect(() => {
    if (!debug) return;

    let id: number;
    const tick = () => {
      id = requestAnimationFrame(tick);
      const state = readPad();
      setRaw(
        state
          ? `ejes ${state.rawAxes.map((a) => a.toFixed(1)).join(" ")} · btn ${
              state.rawButtons.flatMap((b, i) => (b ? [i] : [])).join(",") ||
              "—"
            }`
          : "",
      );
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [debug]);

  return (
    <div className={styles.badge} data-connected={pad !== null}>
      {pad ? (
        <>
          <span className={styles.name}>{shortName(pad.id)}</span>
          {pad.mapping !== "standard" && (
            <span className={styles.warn}>mapeo no estándar</span>
          )}
          {debug && raw && <span className={styles.raw}>{raw}</span>}
        </>
      ) : (
        <span className={styles.name}>
          Sin control — enchufalo y apretá un botón
        </span>
      )}
    </div>
  );
}

/**
 * Los ids de la Gamepad API vienen como
 * "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)".
 * En un badge chico solo sirve la parte de adelante.
 */
function shortName(id: string) {
  const clean = id.split("(")[0].trim();
  return clean.length > 28 ? `${clean.slice(0, 27)}…` : clean || "Control";
}
