"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface OrientationState {
  alpha: number;
  beta: number;
  gamma: number;
}

type PermissionState = "unsupported" | "prompt" | "granted" | "denied";

/** Tiempo de espera para confirmar que el sensor realmente emite datos. */
const SENSOR_TIMEOUT_MS = 1200;

/**
 * Lee la orientación del dispositivo para usarla como cámara libre.
 *
 * Importante: que la API exista no significa que haya sensor. Los navegadores
 * de escritorio exponen DeviceOrientationEvent pero nunca emiten lecturas, así
 * que aquí sólo se considera "granted" cuando llega al menos un evento real
 * con datos. Si no llega nada en SENSOR_TIMEOUT_MS, se marca como unsupported
 * y la app cae de vuelta a los controles de mouse.
 */
export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<OrientationState>({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const hasReading = useRef(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("DeviceOrientationEvent" in window)
    ) {
      setPermission("unsupported");
    }
  }, []);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    // Un evento con los tres valores en null significa que no hay sensor real.
    if (event.alpha === null && event.beta === null && event.gamma === null) {
      return;
    }

    if (!hasReading.current) {
      hasReading.current = true;
      setPermission("granted");
    }

    setOrientation({
      alpha: event.alpha ?? 0,
      beta: event.beta ?? 0,
      gamma: event.gamma ?? 0,
    });
  }, []);

  /** Debe llamarse desde un click/tap del usuario (requisito de iOS). */
  const requestPermission = useCallback(async () => {
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    // iOS 13+ — requiere permiso explícito
    if (typeof DOE?.requestPermission === "function") {
      try {
        const result = await DOE.requestPermission();
        if (result !== "granted") {
          setPermission("denied");
          return;
        }
      } catch {
        setPermission("denied");
        return;
      }
    }

    window.addEventListener("deviceorientation", handleOrientation);

    // Si en este plazo no llegó ninguna lectura válida, no hay sensor (escritorio).
    window.setTimeout(() => {
      if (!hasReading.current) {
        window.removeEventListener("deviceorientation", handleOrientation);
        setPermission("unsupported");
      }
    }, SENSOR_TIMEOUT_MS);
  }, [handleOrientation]);

  useEffect(() => {
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [handleOrientation]);

  return { orientation, permission, requestPermission };
}
