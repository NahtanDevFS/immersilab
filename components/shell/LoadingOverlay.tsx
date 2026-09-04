"use client";

import { useProgress } from "@react-three/drei";
import styles from "./LoadingOverlay.module.css";

/**
 * Pantalla de carga de las escenas 3D.
 *
 * No es cosmética. Antes, mientras el HDRI del cielo (varios MB) se
 * descomprimía, los `<Suspense fallback={null}>` no dibujaban nada y la
 * pantalla quedaba completamente negra durante segundos — indistinguible de
 * un error. En la defensa eso se lee como "no funciona", y en desarrollo
 * hizo perder bastante tiempo persiguiendo un bug que en realidad era una
 * carga en curso.
 *
 * `useProgress` de drei es un store global, no un hook de Canvas, así que
 * este componente va FUERA del <Canvas> como overlay HTML normal.
 *
 * @param label qué se está cargando, para que el usuario sepa a dónde va.
 */
export function LoadingOverlay({ label }: { label: string }) {
  const { progress, active } = useProgress();

  // No alcanza con `!active`: en el primer frame, antes de que arranque el
  // primer loader, `active` ya es false — y el overlay se ocultaba justo
  // durante la espera que tiene que cubrir. Se exige además que el progreso
  // haya llegado a 100. (Esto asume que la escena carga al menos un asset;
  // ambos shells lo hacen. Una escena 100% procedural dejaría el overlay
  // pegado en 0%.)
  const done = !active && progress >= 100;

  return (
    // Siempre montado: se oculta con opacidad para poder hacer el fundido.
    // Desmontarlo cortaría la transición de salida.
    <div className={styles.overlay} data-done={done}>
      <p className={styles.title}>{label}</p>
      <p className={styles.subtitle}>Cargando el entorno…</p>

      <div className={styles.track}>
        <div className={styles.bar} style={{ width: `${progress}%` }} />
      </div>

      <p className={styles.percent}>{Math.round(progress)}%</p>
    </div>
  );
}
