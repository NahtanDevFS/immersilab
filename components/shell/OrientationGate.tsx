"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import styles from "./OrientationGate.module.css";

function subscribeNever() {
  return () => {};
}

// React llama a getSnapshot en cada render y compara con Object.is, así que
// el valor tiene que ser estable. Se calcula una vez por carga.
let fullscreenCache: boolean | null = null;

/**
 * Solo se le pide pantalla completa a un dispositivo táctil. En una laptop la
 * ventana ya es del tamaño que el usuario quiso, y meterle una pantalla
 * intermedia sería puro estorbo.
 */
function supportsFullscreen(): boolean {
  if (fullscreenCache === null) {
    fullscreenCache =
      window.matchMedia("(pointer: coarse)").matches &&
      typeof document.documentElement.requestFullscreen === "function";
  }
  return fullscreenCache;
}

/**
 * Dos puertas antes de dejar entrar al laboratorio:
 *
 * 1. **Horizontal.** Los paneles se acomodan en las esquinas asumiendo una
 *    pantalla ancha. En vertical no hay nada que hacer más que pedir el giro.
 *
 * 2. **Pantalla completa.** En un celular, la barra de direcciones y la de
 *    navegación se comen entre 100 y 200 px de alto. Con eso, los botones de
 *    abajo ("Lanzar", "Soltar", "Activar giroscopio") quedaban tapados o
 *    fuera de alcance, y adentro de un visor directamente no existen.
 *
 * Lo importante de la #2: `requestFullscreen()` **solo funciona dentro de un
 * gesto del usuario**. Llamarla al montar el componente falla siempre y en
 * silencio — que es exactamente lo que le pasaba al `orientation.lock()` que
 * había acá antes. Por eso hay una pantalla de "tocá para entrar": no es un
 * paso de más, es el único momento en que el navegador acepta el pedido.
 *
 * Y el orden importa: primero pantalla completa, después bloquear la
 * orientación. `screen.orientation.lock()` está permitido casi solo en
 * pantalla completa, así que al revés falla.
 *
 * iOS/Safari en iPhone no implementa `requestFullscreen` fuera de video, así
 * que ahí este paso se saltea solo y la app se apoya en el `100dvh` del
 * contenedor, que ya recupera buena parte del alto.
 */
export function OrientationGate({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Capacidad del dispositivo: no cambia nunca durante la sesión, así que
  // se lee con useSyncExternalStore en vez de un efecto con setState (que
  // además provoca un render en cascada, y el linter lo marca).
  const needsFullscreen = useSyncExternalStore(
    subscribeNever,
    supportsFullscreen,
    () => false, // en el servidor no hay dispositivo que consultar
  );

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setIsPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement !== null);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen({
        // Ocupa también el área del notch. Sin esto queda una franja negra
        // en los celulares con muesca, y el laboratorio se ve en una caja.
        navigationUI: "hide",
      });
    } catch {
      // El navegador la rechazó (permiso, o no soportado). No es fatal:
      // se sigue con la vista normal, solo con menos alto.
    }

    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    // Ahora sí tiene chance de funcionar: estamos en pantalla completa.
    orientation?.lock?.("landscape").catch(() => {});
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

      {!isPortrait && needsFullscreen && !isFullscreen && (
        // Botón a pantalla completa, no un div con onClick: así el gesto
        // cuenta como activación para el navegador y además se puede
        // disparar con el Enter de un control o un teclado.
        <button className={styles.fsOverlay} onClick={enterFullscreen}>
          <svg
            className={styles.fsIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4" />
          </svg>
          <span className={styles.text}>Tocá para entrar</span>
          <span className={styles.subtext}>
            Se abre en pantalla completa — si no, los controles de abajo
            quedan tapados por el navegador
          </span>
        </button>
      )}
    </>
  );
}
