"use client";

import { useState, useCallback } from "react";
import type { VariablesSchema, VariablesState } from "@/types/module";

/**
 * Inicializa el estado de variables a partir de los valores por defecto
 * declarados en el schema, y expone un setter por clave.
 */
export function useVariables(schema: VariablesSchema) {
  const [values, setValues] = useState<VariablesState>(() =>
    Object.fromEntries(
      Object.entries(schema).map(([key, def]) => [key, def.default]),
    ),
  );

  const setValue = useCallback(
    (key: string, value: number | boolean | string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => {
    setValues(
      Object.fromEntries(
        Object.entries(schema).map(([key, def]) => [key, def.default]),
      ),
    );
  }, [schema]);

  return { values, setValue, reset };
}
