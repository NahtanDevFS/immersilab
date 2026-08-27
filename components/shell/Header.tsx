import Image from "next/image";
import Link from "next/link";
import styles from "./Header.module.css";

interface Props {
  /** Texto secundario debajo de "ImmersiLab" (ruta del experimento, o una guía). */
  subtitle?: string;
  /** Muestra un link para volver al lobby. */
  showBackLink?: boolean;
}

/**
 * Encabezado compartido por el lobby y todos los experimentos. Muestra el
 * logo de la universidad, el nombre del laboratorio, y opcionalmente un
 * subtítulo y un link de vuelta al lobby.
 */
export function Header({ subtitle, showBackLink }: Props) {
  return (
    <header className={styles.header}>
      <Image
        src="/brand/logo-umg.png"
        alt="Universidad Mariano Gálvez de Guatemala"
        width={28}
        height={28}
        className={styles.logo}
      />
      <div>
        <p className={styles.wordmark}>ImmersiLab</p>
        {subtitle && <p className={styles.breadcrumb}>{subtitle}</p>}
      </div>
      {showBackLink && (
        <Link href="/lab" className={styles.backLink}>
          ← Lobby
        </Link>
      )}
    </header>
  );
}