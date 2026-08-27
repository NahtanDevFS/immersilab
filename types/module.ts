// Contrato de módulo — cualquier disciplina (física, cálculo, redes, futuras)
// debe implementar esta interfaz para conectarse al shell sin que el shell
// necesite conocer detalles propios de la disciplina.
//
// Ver PLAN_DESARROLLO.md, sección 4, para el diseño conceptual.

export type VariableType = "number" | "boolean" | "select";

export interface VariableDefinition {
  type: VariableType;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean | string;
  options?: { label: string; value: string }[]; // solo para type: "select"
}

// El esquema completo de variables de un experimento.
// Ejemplo (tiro parabólico):
// {
//   angle: { type: "number", label: "Ángulo", unit: "°", min: 0, max: 90, default: 45 },
//   velocity: { type: "number", label: "Velocidad inicial", unit: "m/s", min: 1, max: 50, default: 20 },
// }
export type VariablesSchema = Record<string, VariableDefinition>;

// Snapshot de valores concretos, usando las claves definidas en VariablesSchema.
export type VariablesState = Record<string, number | boolean | string>;

// Estado que un módulo expone hacia la IA como contexto de la conversación.
// El shell lo reenvía tal cual al backend, sin interpretarlo.
export interface AIContext {
  experimentName: string;
  disciplineName: string;
  variables: VariablesState;
  result?: Record<string, number | string>;
  conceptTags?: string[];
}

// Ciclo de vida que cada experimento debe implementar.
export interface ExperimentEngine {
  /** Se llama una vez al montar el experimento, con los valores iniciales de las variables. */
  init: (variables: VariablesState) => void;

  /** Se llama en cada paso de física con un delta de tiempo FIJO (ver lib/physics-engine). */
  update: (fixedDeltaSeconds: number, variables: VariablesState) => void;

  /** Reinicia el experimento a su estado inicial, sin perder los valores de variables actuales. */
  reset: () => void;

  /** Retorna el contexto actual, usado para renderizar la escena y para la IA. */
  getState: () => AIContext;

  /**
   * Opcional: serie de puntos (x,y) para graficar (ej. altura vs. tiempo).
   * El shell la usa para dibujar una mini-gráfica genérica en el panel de
   * resultados, sin necesidad de conocer la disciplina del experimento.
   */
  getSeries?: () => Array<{ x: number; y: number }>;
}

// Metadata + definición completa de un experimento, tal como se registra
// en el catálogo de un módulo.
export interface ExperimentDefinition {
  slug: string;
  name: string;
  description: string;
  variablesSchema: VariablesSchema;
  conceptTags?: string[];
  // Componente React que dibuja la escena 3D de este experimento.
  // Recibe el motor y las variables actuales (para alimentar engine.update
  // en cada frame) y renderiza con React Three Fiber.
  SceneComponent: React.ComponentType<{
    engine: ExperimentEngine;
    variables: VariablesState;
  }>;
  /**
   * Opcional: panel de acciones propias del experimento (ej. "Lanzar" en
   * tiro parabólico), renderizado como overlay HTML fuera del Canvas.
   * Se omite si el experimento no necesita acciones además de sus variables.
   */
  ControlsComponent?: React.ComponentType<{ engine: ExperimentEngine }>;
  // Factoría que crea una nueva instancia del motor de este experimento.
  createEngine: () => ExperimentEngine;
}

// Un módulo agrupa varios experimentos bajo una disciplina.
export interface ModuleDefinition {
  slug: string;
  name: string;
  description: string;
  disciplineSlug: string;
  experiments: ExperimentDefinition[];
}