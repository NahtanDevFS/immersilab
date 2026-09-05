"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";

export interface OrientationState {
  alpha: number;
  beta: number;
  gamma: number;
}

type PermissionState = "unsupported" | "prompt" | "granted" | "denied";

/** Tiempo de espera para confirmar que el sensor realmente emite datos. */
const SENSOR_TIMEOUT_MS = 1200;
/** Más margen cuando ya sabemos que este aparato tiene sensor: al volver de
 *  otra pantalla, la primera lectura a veces tarda más que el plazo corto, y
 *  darlo por "sin giroscopio" hacía reaparecer el botón. */
const REMEMBERED_TIMEOUT_MS = 4000;

/**
 * Marca de que este dispositivo ya dio permiso alguna vez.
 *
 * Sin esto, el botón "Activar giroscopio" reaparecía en cada pantalla —
 * lobby, experimento, otro experimento — porque el hook se remonta con cada
 * ruta y arranca siempre en "prompt". En un visor, donde el teléfono ya está
 * adentro de la caja, eso es especialmente molesto: hay que sacarlo para
 * tocar un botón que ya se tocó.
 *
 * Es solo una PISTA, no el permiso: el permiso real lo sigue teniendo el
 * navegador. Si el usuario lo revocó, el intento automático falla y el botón
 * vuelve a aparecer.
 */
const GRANTED_KEY = "immersilab.gyro";

/**
 * Lee la orientación del dispositivo para usarla como cámara libre.
 *
 * Importante: que la API exista no significa que haya sensor. Los navegadores
 * de escritorio exponen DeviceOrientationEvent pero nunca emiten lecturas, así
 * que aquí sólo se considera "granted" cuando llega al menos un evento real
 * con datos. Si no llega nada en SENSOR_TIMEOUT_MS, se marca como unsupported
 * y la app cae de vuelta a los controles de mouse.
 */
function subscribeNever() {
  return () => {};
}

/*
 * ¿Este aparato ya dio permiso alguna vez?
 *
 * Se lee con useSyncExternalStore y no con un efecto + setState: el valor no
 * cambia durante la sesión, y fijarlo desde un efecto provoca un render en
 * cascada (el linter lo marca) además de dejar que el botón se dibuje un
 * instante antes de desaparecer, que es justo lo que se quiere evitar. React
 * compara el snapshot con Object.is en cada render, así que tiene que ser
 * estable: por eso el caché.
 */
let grantedCache: boolean | null = null;

function wasGranted(): boolean {
  if (grantedCache === null) {
    try {
      grantedCache = window.localStorage.getItem(GRANTED_KEY) === "1";
    } catch {
      grantedCache = false;
    }
  }
  return grantedCache;
}

/** Olvida la marca: este aparato dijo que sí alguna vez, pero ahora el
 *  sensor no responde, así que hay que volver a pedirlo. */
function forgetGranted() {
  grantedCache = false;
  try {
    window.localStorage.removeItem(GRANTED_KEY);
  } catch {
    // Almacenamiento bloqueado; no hay nada que limpiar.
  }
}

/**
 * Los sensores de movimiento solo se entregan en un contexto seguro: HTTPS o
 * localhost. Abrir el laboratorio desde el celular por la IP de la red local
 * (http://192.168.x.x:3000) hace que `deviceorientation` NO dispare nunca —
 * sin error, sin aviso, sin diálogo de permiso. Es la causa más común de
 * "acepté el permiso y el giroscopio igual no anda", y sin este chequeo no
 * hay forma de distinguirla de un teléfono sin sensor.
 */
function isInsecureContext(): boolean {
  return typeof window !== "undefined" && !window.isSecureContext;
}

/** iOS 13+ exige un gesto del usuario para entregar el sensor. */
function needsGesture(): boolean {
  const DOE = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  return typeof DOE?.requestPermission === "function";
}

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<OrientationState>({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const hasReading = useRef(false);
  /**
   * Se resuelve en el PRIMER render para que el botón "Activar giroscopio" no
   * llegue a dibujarse en un aparato que ya aceptó. Antes aparecía un
   * instante en cada pantalla —lobby, experimento, de vuelta al lobby—
   * porque el hook se remonta con cada ruta y arranca en "prompt"; dentro
   * del visor eso obliga a sacar el teléfono de la caja para tocar un botón
   * que ya se tocó. En el servidor devuelve `false`, así que no hay desajuste
   * de hidratación.
   */
  const remembered = useSyncExternalStore(
    subscribeNever,
    wasGranted,
    () => false,
  );
  const insecureContext = useSyncExternalStore(
    subscribeNever,
    isInsecureContext,
    () => false,
  );

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
      try {
        window.localStorage.setItem(GRANTED_KEY, "1");
        grantedCache = true;
      } catch {
        // Modo privado o almacenamiento bloqueado: se pierde la comodidad de
        // no volver a preguntar, pero nada más.
      }
    }

    setOrientation({
      alpha: event.alpha ?? 0,
      beta: event.beta ?? 0,
      gamma: event.gamma ?? 0,
    });
  }, []);

  /** Engancha el sensor y decide, con un plazo, si de verdad hay lecturas. */
  const attach = useCallback(() => {
    window.addEventListener("deviceorientation", handleOrientation);

    // Si en este plazo no llegó ninguna lectura válida, no hay sensor
    // (escritorio).
    window.setTimeout(
      () => {
        if (hasReading.current) return;

        // OJO: el listener se deja PUESTO cuando el aparato ya había
        // aceptado antes. Un celular puede tardar más que el plazo en
        // entregar la primera lectura (pantalla recién encendida, sensor
        // dormido, la pestaña estuvo en segundo plano), y desengancharlo ahí
        // dejaba el juego sin giroscopio para siempre aunque el sensor
        // arrancara un segundo después. Si el aparato es nuevo, en cambio,
        // se limpia: no tiene sentido escuchar un sensor que no existe.
        if (!wasGranted()) {
          window.removeEventListener("deviceorientation", handleOrientation);
          setPermission("unsupported");
          return;
        }

        // Ya había aceptado y aun así no llega nada: en iOS es que falta el
        // gesto de esta carga (lo resuelve el enganche por primer toque, más
        // abajo). Queda en "prompt" para que el botón esté disponible como
        // último recurso, pero el listener sigue vivo: si el sensor despierta
        // solo, el giroscopio se activa sin que el usuario toque nada.
        setPermission("prompt");
      },
      wasGranted() ? REMEMBERED_TIMEOUT_MS : SENSOR_TIMEOUT_MS,
    );
  }, [handleOrientation]);

  /**
   * Intenta enganchar el sensor solo, sin botón, apenas monta la pantalla.
   *
   * En Android (y en cualquier navegador sin `requestPermission`) esto
   * alcanza: los eventos empiezan a llegar y el botón nunca hace falta, ni
   * la primera vez.
   *
   * En iOS 13+ hace falta un gesto del usuario EN CADA CARGA de la página, y
   * eso vale también para las siguientes: aceptar una vez no alcanza para
   * que el sensor arranque solo al entrar a un experimento. Por eso, cuando
   * el aparato ya había aceptado, se engancha el PRIMER TOQUE que haga el
   * usuario —el que sea: entrar a pantalla completa, tocar un botón, apoyar
   * el dedo en la pantalla— y desde ahí se pide el permiso sin preguntar
   * nada. El usuario no vuelve a ver el botón: el giroscopio simplemente ya
   * está andando.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) return;

    if (!needsGesture()) {
      attach();
      return;
    }

    if (!wasGranted()) return; // iOS y todavía no aceptó: hace falta el botón

    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    const askOnFirstGesture = async () => {
      try {
        const result = await DOE.requestPermission?.();
        if (result === "granted") attach();
        else forgetGranted();
      } catch {
        // El navegador lo rechazó (por ejemplo, si el gesto ya "venció"):
        // queda el botón, que es el camino explícito.
      }
    };

    // `once` en los tres: alcanza con el primer gesto, sea cual sea.
    const options = { once: true } as const;
    window.addEventListener("pointerdown", askOnFirstGesture, options);
    window.addEventListener("touchend", askOnFirstGesture, options);
    window.addEventListener("keydown", askOnFirstGesture, options);

    return () => {
      window.removeEventListener("pointerdown", askOnFirstGesture);
      window.removeEventListener("touchend", askOnFirstGesture);
      window.removeEventListener("keydown", askOnFirstGesture);
    };
  }, [attach]);

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

    attach();
  }, [attach]);

  useEffect(() => {
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [handleOrientation]);

  return {
    orientation,
    permission,
    requestPermission,
    /** El navegador bloquea el sensor por no estar en HTTPS ni en localhost. */
    insecure: insecureContext,
    /** Ya aceptó antes en este aparato. */
    remembered,
  };
}
