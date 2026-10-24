"use client";

import { setPanelCollapsed } from "@/lib/view/panelCollapse";
import styles from "./PanelHeader.module.css";

/**
 * El título de un panel de la pantalla, que lo minimiza o lo vuelve a abrir
 * al tocarlo, como el de Retos. En el celular los paneles tapaban buena parte
 * de la escena; minimizado queda solo esta barra.
 */
export function PanelHeader({
  id,
  title,
  collapsed,
}: {
  /** Con qué nombre se guarda si está minimizado (lib/view/panelCollapse.ts). */
  id: string;
  title: string;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setPanelCollapsed(id, !collapsed)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Mostrar ${title.toLowerCase()}` : `Minimizar ${title.toLowerCase()}`}
    >
      <span className={styles.title}>{title}</span>
      <span className={styles.chevron} aria-hidden>
        {collapsed ? "▴" : "▾"}
      </span>
    </button>
  );
}
