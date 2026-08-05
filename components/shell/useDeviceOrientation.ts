"use client";

import { useState, useEffect, useCallback } from "react";

export interface OrientationState {
  alpha: number; // rotación sobre el eje Z (brújula)
  beta: number; // inclinación frontal/trasera
  gamma: number; // inclinación izquierda/derecha
}

type PermissionState = "unsupported" | "prompt" | "granted" | "denied";

/**
 * Lee la orientación del dispositivo para usarla como cámara libre.
 *
 * Notas de compatibilidad:
 * - iOS (Safari) exige llamar a requestPermission() desde un gesto del usuario
 *   (un click/tap), y sólo funciona bajo HTTPS.
 * - Android/Chrome normalmente no pide permiso explícito, pero también requiere
 *   HTTPS.
 */
export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<OrientationState>({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [permission, setPermission] = useState<PermissionState>("prompt");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("DeviceOrientationEvent" in window)
    ) {
      setPermission("unsupported");
    }
  }, []);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
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
        setPermission(result);
        if (result === "granted") {
          window.addEventListener("deviceorientation", handleOrientation);
        }
      } catch {
        setPermission("denied");
      }
      return;
    }

    // Android y otros — no requieren permiso explícito
    window.addEventListener("deviceorientation", handleOrientation);
    setPermission("granted");
  }, [handleOrientation]);

  useEffect(() => {
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [handleOrientation]);

  return { orientation, permission, requestPermission };
}
