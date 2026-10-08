"use client";

import { useRef, useState } from "react";
import type { VariableDefinition, VariablesSchema, VariablesState } from "@/types/module";
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

      {Object.entries(schema).map(([key, def], index, entries) => {
        const value = values[key];
        // Subtítulo al empezar un grupo nuevo de variables.
        const groupStart =
          def.group && def.group !== entries[index - 1]?.[1].group ? (
            <p key={`grupo-${def.group}`} className={styles.group}>
              {def.group}
            </p>
          ) : null;
        const field = renderField(key, def, value);
        return groupStart ? [groupStart, field] : field;
      })}
    </div>
  );

  function renderField(key: string, def: VariableDefinition, value: VariablesState[string]) {

        if (def.type === "number") {
          return (
            <div
              key={key}
              className={styles.field}
              data-selected={key === selectedKey}
            >
              <label className={styles.label} htmlFor={key}>
                <span>{def.label}</span>
                {variant === "hud" ? (
                  // En el visor no hay teclado: solo se muestra el valor.
                  <span className={styles.value}>
                    {formatNumber(Number(value))}
                    {def.unit ? ` ${def.unit}` : ""}
                  </span>
                ) : (
                  <span className={styles.value}>
                    <NumberInput
                      def={def}
                      value={Number(value)}
                      onCommit={(v) => onChange(key, v)}
                    />
                    {/* Siempre presente, aunque no haya unidad: con el
                        mismo ancho, todas las casillas quedan alineadas. */}
                    <span className={styles.unit}>{def.unit ?? ""}</span>
                  </span>
                )}
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
  }
}

/** Sin ceros de más: 2 → "2", 2.5 → "2.5", 0.0125 → "0.0125". */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * Lleva un valor escrito a algo que el experimento entiende: dentro del
 * rango de la variable (fuera de él hay física que se rompe: masas en cero,
 * proyectiles que salen del mapa) y entero si la variable es una cantidad
 * entera (bloques, términos, antenas). Fuera de eso, cualquier decimal vale:
 * es para poner un valor exacto que el slider no alcanza por su paso.
 */
function normalize(def: VariableDefinition, value: number): number {
  const min = def.min ?? 0;
  const max = def.max ?? 100;
  const step = def.step ?? 0.1;
  const clamped = Math.min(max, Math.max(min, value));
  return Number.isInteger(step) ? Math.round(clamped) : clamped;
}

/**
 * Casilla para escribir el valor exacto de una variable. Mientras se escribe
 * no cambia nada (un "1" camino a "12" no debe mover el experimento); se
 * aplica con Enter o al salir de la casilla, y Escape la deja como estaba.
 */
function NumberInput({
  def,
  value,
  onCommit,
}: {
  def: VariableDefinition;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  /** Escape: el blur que sigue todavía ve el borrador, y no debe aplicarlo. */
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    if (draft === null) return;
    // Acepta coma decimal: en español es lo que sale natural.
    const parsed = Number(draft.trim().replace(",", "."));
    if (draft.trim() !== "" && Number.isFinite(parsed)) onCommit(normalize(def, parsed));
    setDraft(null);
  };

  return (
    <input
      className={styles.number}
      type="text"
      inputMode="decimal"
      value={draft ?? formatNumber(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      aria-label={`${def.group ? `${def.group}, ` : ""}${def.label}: escribe un valor entre ${def.min ?? 0} y ${def.max ?? 100}`}
      title={`Entre ${def.min ?? 0} y ${def.max ?? 100}${def.unit ? ` ${def.unit}` : ""}`}
    />
  );
}