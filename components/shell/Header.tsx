"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AccountChip } from "@/components/progress/AccountChip";
import { setPanelCollapsed, usePanelCollapsed } from "@/lib/view/panelCollapse";
import styles from "./Header.module.css";

interface Props {
  /** Texto secundario debajo de "ImmersiLab" (ruta del experimento, o una guía). */
  subtitle?: string;
  /** Muestra un link para volver al lobby. */
  showBackLink?: boolean;
  /** Muestra el acceso a la cuenta y al progreso (en el lobby). */
  showAccount?: boolean;
  /** Botones extra al final (el del visor). */
  actions?: ReactNode;
  /**
   * Botón "?" para volver a abrir la explicación del experimento. Va aquí,
   * en la esquina, y no flotando arriba al centro, donde tapaba la escena.
   */
  onHelp?: () => void;
}

/**
 * Encabezado compartido por el lobby y todos los experimentos. Muestra el
 * logo de la universidad, el nombre del laboratorio, y opcionalmente un
 * subtítulo y un link de vuelta al lobby.
 *
 * Se pliega con la flecha del final, como los paneles: en el celular ocupaba
 * buena parte del ancho. Plegado quedan el logo, el "?" y la flecha.
 */
export function Header({ subtitle, showBackLink, showAccount, actions, onHelp }: Props) {
  const collapsed = usePanelCollapsed("encabezado");
  return (
    <header className={styles.header} data-collapsed={collapsed}>
      <Image
        src="/brand/logo-umg.png"
        alt="Universidad Mariano Gálvez de Guatemala"
        width={28}
        height={28}
        className={styles.logo}
      />
      {!collapsed && (
        <>
          <div>
            <p className={styles.wordmark}>ImmersiLab</p>
            {subtitle && <p className={styles.breadcrumb}>{subtitle}</p>}
          </div>
          {showBackLink && (
            <Link href="/lab" className={styles.backLink}>
              ← Lobby
            </Link>
          )}
          {showAccount && <AccountChip />}
          {actions}
        </>
      )}
      {onHelp && (
        <button
          type="button"
          className={styles.iconButton}
          onClick={onHelp}
          aria-label="Ver la explicación del experimento"
        >
          ?
        </button>
      )}
      <button
        type="button"
        className={styles.iconButton}
        data-quiet
        onClick={() => setPanelCollapsed("encabezado", !collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Mostrar el encabezado" : "Plegar el encabezado"}
      >
        {collapsed ? "▸" : "◂"}
      </button>
    </header>
  );
}
