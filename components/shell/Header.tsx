import Image from "next/image";
import styles from "./Header.module.css";

interface Props {
  disciplineName: string;
  moduleName: string;
  experimentName: string;
}

/**
 * Encabezado compartido por todos los experimentos. Muestra el logo de la
 * universidad, el nombre del laboratorio, y la "ruta" del experimento
 * actual (disciplina / módulo / experimento) para que el estudiante siempre
 * sepa dónde está dentro del catálogo.
 */
export function Header({ disciplineName, moduleName, experimentName }: Props) {
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
        <p className={styles.breadcrumb}>
          {disciplineName} / {moduleName} / {experimentName}
        </p>
      </div>
    </header>
  );
}