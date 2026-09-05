"use client";

import type { VariablesSchema, VariablesState } from "@/types/module";
import styles from "./VariablesPanel.module.css";

interface Props {
  title: string;
  schema: VariablesSchema;
  values: VariablesState;
  onChange: (key: string, value: number | boolean | string) => void;
  /** Clave de la variable resaltada (ej. seleccionada con el gamepad). */
  selectedKey?: string;
  /**
   * "overlay" (por defecto): flotando en una esquina de la pantalla, para
   * mouse y pantalla plana. "hud": sin posicionamiento propio, porque lo
   * coloca `VariablesHud3D` como objeto dentro de la escena para el visor.
   */
  variant?: "overlay" | "hud";
}

/**
 * Panel de control genérico. No conoce ninguna disciplina: se construye
 * enteramente a partir del `variables_schema` que declara cada experimento.
 * Agregar un experimento nuevo (de física, cálculo, redes...) no requiere
 * tocar este componente.
 */
export function VariablesPanel({
  title,
  schema,
  values,
  onChange,
  selectedKey,
  variant = "overlay",
}: Props) {
  return (
    <div
      className={variant === "hud" ? `${styles.panel} ${styles.hud}` : styles.panel}
    >
      <h2 className={styles.title}>{title}</h2>

      {Object.entries(schema).map(([key, def]) => {
        const value = values[key];

        if (def.type === "number") {
          return (
            <div
              key={key}
              className={styles.field}
              data-selected={key === selectedKey}
            >
              <label className={styles.label} htmlFor={key}>
                <span>{def.label}</span>
                <span className={styles.value}>
                  {Number(value).toFixed(2)}
                  {def.unit ? ` ${def.unit}` : ""}
                </span>
              </label>
              <input
                id={key}
                className={styles.slider}
                type="range"
                min={def.min ?? 0}
                max={def.max ?? 100}
                step={def.step ?? 0.1}
                value={Number(value)}
                onChange={(e) => onChange(key, Number(e.target.value))}
              />
            </div>
          );
        }

        if (def.type === "boolean") {
          return (
            <div key={key} className={styles.field}>
              <label className={styles.label} htmlFor={key}>
                <span>
                  <input
                    id={key}
                    className={styles.checkbox}
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onChange(key, e.target.checked)}
                  />
                  {def.label}
                </span>
              </label>
            </div>
          );
        }

        if (def.type === "select") {
          return (
            <div key={key} className={styles.field}>
              <label className={styles.label} htmlFor={key}>
                <span>{def.label}</span>
              </label>
              <select
                id={key}
                className={styles.select}
                value={String(value)}
                onChange={(e) => onChange(key, e.target.value)}
              >
                {def.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}