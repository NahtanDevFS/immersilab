"use client";

import { useEffect, useState } from "react";
import styles from "./GamepadStatus.module.css";

/**
 * Indicador de si hay un control conectado (Gamepad API). Ayuda a confirmar
 * que el emparejamiento por Bluetooth/USB funcionó, sin adivinar por qué
 * el movimiento no responde.
 */
export function GamepadStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const check = () => {
      const pads = navigator.getGamepads?.() ?? [];
      setConnected(Array.from(pads).some((p) => p !== null));
    };
    check();
    window.addEventListener("gamepadconnected", check);
    window.addEventListener("gamepaddisconnected", check);
    return () => {
      window.removeEventListener("gamepadconnected", check);
      window.removeEventListener("gamepaddisconnected", check);
    };
  }, []);

  return (
    <div className={styles.badge} data-connected={connected}>
      {connected ? "Control conectado" : "Sin control"}
    </div>
  );
}