import type { ExperimentDefinition, VariablesState } from "@/types/module";
import { tiroParabolicoExperiment } from "@/components/modules/physics/experiments/tiro-parabolico";
import { colisiones1DExperiment } from "@/components/modules/physics/experiments/colisiones-1d";
import { penduloExperiment } from "@/components/modules/physics/experiments/pendulo";
import { ondasExperiment } from "@/components/modules/physics/experiments/ondas";
import { venturiExperiment } from "@/components/modules/physics/experiments/venturi";
import { sumaRiemannExperiment } from "@/components/modules/calculus/experiments/suma-riemann";
import { derivadaPicoExperiment } from "@/components/modules/calculus/experiments/derivada-pico";
import { solidosRevolucionExperiment } from "@/components/modules/calculus/experiments/solidos-revolucion";
import { taylorExperiment } from "@/components/modules/calculus/experiments/taylor";
import { qamExperiment } from "@/components/modules/networks/experiments/qam";
import { modulacionExperiment } from "@/components/modules/networks/experiments/modulacion";
import { espectroExperiment } from "@/components/modules/networks/experiments/espectro";
import { coberturaExperiment } from "@/components/modules/networks/experiments/cobertura";
import { enrutamientoExperiment } from "@/components/modules/networks/experiments/enrutamiento";
import { osiExperiment } from "@/components/modules/networks/experiments/osi";

/**
 * Todas las definiciones de experimento, por slug. Lo usa la pantalla de
 * progreso para saber qué retos tiene cada experimento sin abrirlo. El orden
 * y la ubicación (disciplina, módulo, ruta) están en lib/catalog.ts.
 */
export const EXPERIMENT_DEFINITIONS: Record<string, ExperimentDefinition> = Object.fromEntries(
  [
    tiroParabolicoExperiment,
    colisiones1DExperiment,
    penduloExperiment,
    ondasExperiment,
    venturiExperiment,
    sumaRiemannExperiment,
    derivadaPicoExperiment,
    solidosRevolucionExperiment,
    taylorExperiment,
    qamExperiment,
    modulacionExperiment,
    espectroExperiment,
    coberturaExperiment,
    enrutamientoExperiment,
    osiExperiment,
  ].map((definition) => [definition.slug, definition]),
);

/** Valores por defecto de las variables de un experimento. */
export function defaultVariables(definition: ExperimentDefinition): VariablesState {
  return Object.fromEntries(
    Object.entries(definition.variablesSchema).map(([key, v]) => [key, v.default]),
  );
}

/**
 * Los retos de un experimento (id y título), leídos de un motor recién
 * creado. No se monta la escena ni se toca audio: los motores son lógica pura.
 */
export function challengesOf(definition: ExperimentDefinition) {
  const engine = definition.createEngine();
  engine.init(defaultVariables(definition));
  return (engine.getChallenges?.() ?? []).map(({ id, title }) => ({
    id,
    // Los títulos con "←" o "…" dependen del estado en vivo; aquí se limpian.
    title: title.replace(/ ←$/, ""),
  }));
}
