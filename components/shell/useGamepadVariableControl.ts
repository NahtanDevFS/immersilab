"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VariablesSchema, VariablesState } from "@/types/module";

const STICK_DEADZONE = 0.5; // hay que empujar el stick con claridad, no un roce
const REPEAT_MS = 140; // cada cuánto se repite el ajuste mientras se mantiene

interface Options {
  schema: VariablesSchema;
  values: VariablesState;
  onChange: (key: string, value: number | boolean | string) => void;
}

/**
 * Permite ajustar las variables numéricas del experimento con el gamepad,
 * en vez de arrastrar los sliders con el dedo (que es difícil con el
 * cursor virtual — ver Fase 1 del plan, ítem pendiente sobre esto).
 *
 * Mapeo (layout "standard" de la Gamepad API):
 * - L1 / R1 (gatillos superiores): cambian cuál variable está seleccionada.
 * - D-pad izq/der, o el stick derecho: sube/baja el valor seleccionado,
 *   respetando min/max/step del schema.
 *
 * Solo actúa sobre variables tipo "number" — boolean/select quedan para
 * cuando se necesiten (probablemente con un botón de "toggle").
 */
export function useGamepadVariableControl({
  schema,
  values,
  onChange,
}: Options) {
  const numericKeys = useMemo(
    () => Object.keys(schema).filter((k) => schema[k].type === "number"),
    [schema],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedIndexRef = useRef(0);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Refs para leer el valor más reciente dentro del loop sin tener que
  // recrearlo en cada cambio (evitaría que se reinicie 60 veces por segundo).
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const prevPressed = useRef<boolean[]>([]);
  const lastAdjustAt = useRef(0);

  useEffect(() => {
    if (numericKeys.length === 0) return;
    let rafId: number;

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      const pads = navigator.getGamepads?.() ?? [];
      const pad = Array.from(pads).find((p) => p !== null);
      if (!pad) return;

      const pressed = pad.buttons.map((b) => b.pressed);
      const was = prevPressed.current;

      // L1 (índice 4) / R1 (índice 5): cambiar de variable, solo al
      // presionar (no repetir mientras se mantiene apretado).
      if (pressed[4] && !was[4]) {
        setSelectedIndex(
          (i) => (i - 1 + numericKeys.length) % numericKeys.length,
        );
      }
      if (pressed[5] && !was[5]) {
        setSelectedIndex((i) => (i + 1) % numericKeys.length);
      }

      // D-pad izq/der (índices 14/15) o stick derecho (eje 2): ajustar valor.
      const stickX = pad.axes[2] ?? 0;
      const direction = pressed[14]
        ? -1
        : pressed[15]
          ? 1
          : Math.abs(stickX) > STICK_DEADZONE
            ? Math.sign(stickX)
            : 0;

      const now = performance.now();
      if (direction !== 0 && now - lastAdjustAt.current > REPEAT_MS) {
        lastAdjustAt.current = now;
        const key = numericKeys[selectedIndexRef.current];
        const def = schema[key];
        const step = def.step ?? 1;
        const min = def.min ?? -Infinity;
        const max = def.max ?? Infinity;
        const current = Number(valuesRef.current[key] ?? def.default);
        const next = Math.min(max, Math.max(min, current + direction * step));
        onChangeRef.current(key, Number(next.toFixed(4)));
      }

      prevPressed.current = pressed;
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [numericKeys, schema]);

  return { selectedKey: numericKeys[selectedIndex] };
}