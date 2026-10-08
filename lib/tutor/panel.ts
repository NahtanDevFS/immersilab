import type { VariablesSchema, VariablesState } from "@/types/module";

/** Sin ceros de más, como se ve en la casilla del panel: 2.5, no 2.50. */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * El panel de variables descrito como lo ve el estudiante, una línea por
 * variable: nombre visible (con su grupo), valor, unidad y rango, y en las
 * listas, la opción elegida y las demás.
 *
 * El tutor ya recibía los valores, pero con la clave interna del código
 * ("a2", "pred_v1"), sin unidades ni rangos. Si el estudiante preguntaba por
 * "la amplitud del oscilador 2" o "el ajuste fino", el modelo tenía que
 * adivinar a qué clave se refería. Con esto ve lo mismo que hay en pantalla.
 */
export function describePanel(schema: VariablesSchema, values: VariablesState): string[] {
  return Object.entries(schema).map(([key, def]) => {
    const name = def.group ? `${def.label} (${def.group})` : def.label;
    const value = values[key] ?? def.default;

    if (def.type === "select") {
      const options = def.options ?? [];
      const chosen = options.find((o) => o.value === String(value))?.label ?? String(value);
      const others = options.filter((o) => o.value !== String(value)).map((o) => o.label);
      return `${name}: ${chosen}${others.length ? ` (otras opciones: ${others.join(", ")})` : ""}`;
    }

    if (def.type === "boolean") {
      return `${name}: ${value ? "activado" : "desactivado"}`;
    }

    const unit = def.unit ? ` ${def.unit}` : "";
    const min = def.min ?? 0;
    const max = def.max ?? 100;
    return `${name}: ${formatNumber(Number(value))}${unit} (rango ${formatNumber(min)} a ${formatNumber(max)}${unit})`;
  });
}
