import type { ShowWhen, VariableDefinition, VariablesSchema, VariablesState } from "@/types/module";

/**
 * Qué variables (y qué opciones de una lista, y qué renglones del pizarrón)
 * aplican a la modalidad elegida — ver `VariableDefinition.showWhen`.
 *
 * Es una sola función para todos: el panel de la pantalla, el de la vista VR,
 * el pizarrón y lo que se le describe al tutor. Así los cuatro muestran
 * siempre lo mismo.
 */
export function matchesShowWhen(
  showWhen: ShowWhen | undefined,
  values: VariablesState,
  schema?: VariablesSchema,
): boolean {
  if (!showWhen) return true;
  return Object.entries(showWhen).every(([key, expected]) => {
    const value = values[key] ?? schema?.[key]?.default;
    const accepted = Array.isArray(expected) ? expected : [expected];
    return accepted.some((a) => (typeof a === "boolean" ? Boolean(value) === a : String(value) === a));
  });
}

/**
 * El esquema con solo las variables que se ven con estos valores, en el
 * mismo orden, y en las listas solo las opciones que aplican.
 */
export function visibleSchema(schema: VariablesSchema, values: VariablesState): VariablesSchema {
  const visible: VariablesSchema = {};
  for (const [key, def] of Object.entries(schema)) {
    if (!matchesShowWhen(def.showWhen, values, schema)) continue;
    visible[key] = def.options?.some((o) => o.showWhen)
      ? { ...def, options: def.options.filter((o) => matchesShowWhen(o.showWhen, values, schema)) }
      : def;
  }
  return visible;
}

/** Los valores sin las variables ocultas: para el tutor, que no hable de lo que no está. */
export function visibleValues(schema: VariablesSchema, values: VariablesState): VariablesState {
  const visible: VariablesState = {};
  for (const [key, value] of Object.entries(values)) {
    const def = schema[key];
    if (!def || matchesShowWhen(def.showWhen, values, schema)) visible[key] = value;
  }
  return visible;
}

/**
 * Las listas cuya opción elegida ya no aplica (se cambió de modalidad), con
 * la opción a la que hay que pasarlas: la primera que quedó.
 *
 * Solo mira las listas con opciones condicionadas: una escena puede poner en
 * otra lista un valor que no está entre las opciones, y eso no se toca.
 */
export function staleSelections(
  schema: VariablesSchema,
  values: VariablesState,
): Array<[key: string, value: string]> {
  const shown = visibleSchema(schema, values);
  const stale: Array<[string, string]> = [];
  for (const [key, def] of Object.entries(shown) as Array<[string, VariableDefinition]>) {
    if (def.type !== "select" || !schema[key].options?.some((o) => o.showWhen)) continue;
    if (!def.options?.length) continue;
    const current = String(values[key] ?? def.default);
    if (!def.options.some((o) => o.value === current)) stale.push([key, def.options[0].value]);
  }
  return stale;
}
