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
  /**
   * Subtítulo que agrupa variables seguidas en el panel ("Oscilador 1").
   * Sin esto, tres osciladores con "Amplitud 1, Frecuencia 1, Fase 1…" se
   * leían como nueve controles sueltos y era fácil cruzar los valores.
   */
  group?: string;
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
  /**
   * El panel de variables tal como lo ve el estudiante (nombre visible,
   * valor, unidad, rango). Lo agrega el tutor, no el motor: ver
   * lib/tutor/panel.ts.
   */
  panel?: string[];
}

/**
 * Estado de un reto, tal como lo dibuja el HUD de retos del shell.
 *
 * Los retos viven en el motor porque casi todos tienen estado propio
 * (sostener una condición un segundo, recordar el mejor intento, contar en
 * qué modelos ya se logró), y eso no se puede deducir de una foto del
 * `AIContext`. El shell solo los dibuja: ningún experimento necesita saber
 * cómo se ve un HUD de puntaje (PLAN_DESARROLLO.md §3.4).
 */
export interface ChallengeStatus {
  /** Estable entre llamadas: el HUD lo usa para detectar cuándo se completa. */
  id: string;
  title: string;
  /** Instrucción o pista corta; cuando está logrado puede decir cómo salió. */
  detail: string;
  done: boolean;
  /** 0–1, para la barra de progreso. */
  progress: number;
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

  /**
   * Opcional: los retos del experimento. Si existe, el shell muestra el HUD
   * de retos (contador, barras de progreso y aviso al completar uno).
   */
  getChallenges?: () => ChallengeStatus[];

  /**
   * Opcional: borra el progreso de los retos SIN tocar el experimento. No es
   * lo mismo que `reset()`, que en varios experimentos significa "intentar
   * de nuevo" (volver a lanzar, volver a soltar) y no debe borrar logros.
   */
  resetChallenges?: () => void;
}

/**
 * Explicación del experimento para el alumno que lo abre por primera vez.
 *
 * La lee la voz del laboratorio y se muestra como tarjeta (BriefingPanel).
 * Son tres campos y no un párrafo suelto a propósito: obliga a responder las
 * tres preguntas que alguien que nunca oyó hablar del tema necesita —
 * qué es, qué tengo que hacer, y cómo sé si me fue bien. Un texto libre
 * termina siendo siempre solo la primera.
 *
 * Se escriben en segunda persona y sin fórmulas: la fórmula ya está en la
 * pantalla, lo que falta es qué significa.
 */
export interface ExperimentBriefing {
  /** Qué concepto es y para qué sirve, en una o dos frases. */
  what: string;
  /** Qué tiene que hacer el alumno con los controles. */
  how: string;
  /** El reto concreto y qué mirar para saber si lo logró. */
  goal: string;
}

// Metadata + definición completa de un experimento, tal como se registra
// en el catálogo de un módulo.
export interface ExperimentDefinition {
  slug: string;
  name: string;
  description: string;
  variablesSchema: VariablesSchema;
  conceptTags?: string[];
  /**
   * Explicación hablada y escrita que se muestra al entrar. Es opcional en el
   * tipo por compatibilidad, pero todo experimento nuevo debería traerla: sin
   * ella, el que no conoce el tema ve una escena 3D sin saber qué mira.
   */
  briefing?: ExperimentBriefing;
  /**
   * Opcional: desde dónde se mira al entrar (modo computadora). Por defecto
   * la cámara está en (8, 5, 10) mirando a (5, 1, 0), que sirve para las
   * escenas de ~10 m. Un experimento más grande —el tiro parabólico, con
   * blancos a 45 m— necesita alejarse para que se vea entero.
   */
  cameraView?: {
    position: [number, number, number];
    target: [number, number, number];
  };
  /**
   * Pistas para el tutor de voz, propias de este experimento: qué conceptos
   * cubre, qué confusiones son típicas, qué vocabulario usar. Se anexan al
   * system prompt del tutor. Opcional: sin ellas el tutor se guía solo por
   * el estado (`AIContext`).
   */
  tutorHints?: string;
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
  /**
   * Opcional: las mismas acciones de ControlsComponent, para la vista VR.
   * Ahí el HTML no se puede usar (se dibuja una sola vez y cada ojo vería
   * medio panel), así que el shell las dibuja como botones 3D que se apuntan
   * con la mira. Se vuelve a leer varias veces por segundo: las etiquetas
   * pueden cambiar con el estado ("Soltar" → "Soltar de nuevo").
   */
  vrActions?: (engine: ExperimentEngine) => VrAction[];
  /**
   * Opcional: un pizarrón en la escena con las fórmulas del experimento y
   * espacio para hacer las cuentas a mano (components/shell/Whiteboard.tsx).
   */
  whiteboard?: WhiteboardSpec;
  // Factoría que crea una nueva instancia del motor de este experimento.
  createEngine: () => ExperimentEngine;
}

/** El pizarrón de un experimento: qué fórmulas lleva y dónde va. */
export interface WhiteboardSpec {
  title: string;
  /** Una fórmula (o una línea de explicación) por renglón. */
  formulas: string[];
  /** Centro del pizarrón en la escena, m. */
  position: [number, number, number];
  /** Giro alrededor del eje vertical, para que mire hacia el jugador. */
  rotationY?: number;
  /** Ancho, m (el alto sale de la proporción). Por defecto 2.2. */
  width?: number;
}

/** Un botón (o una línea de texto) del panel de acciones de la vista VR. */
export interface VrAction {
  /** Estable entre lecturas. */
  id: string;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** La acción principal (Disparar, Soltar…): se destaca. */
  primary?: boolean;
  /** Solo texto, sin botón: un puntaje, el mensaje recibido, un error. */
  info?: boolean;
}

// Un módulo agrupa varios experimentos bajo una disciplina.
export interface ModuleDefinition {
  slug: string;
  name: string;
  description: string;
  disciplineSlug: string;
  experiments: ExperimentDefinition[];
}