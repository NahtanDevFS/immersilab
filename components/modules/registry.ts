import type { ExperimentDefinition, VariablesState } from "@/types/module";
import { tiroParabolicoExperiment } from "@/components/modules/physics/experiments/tiro-parabolico";
import { colisiones1DExperiment } from "@/components/modules/physics/experiments/colisiones-1d";
import { penduloExperiment } from "@/components/modules/physics/experiments/pendulo";
import { electroimanExperiment } from "@/components/modules/physics/experiments/electroiman";
import { sumaRiemannExperiment } from "@/components/modules/calculus/experiments/suma-riemann";
import { derivadaPicoExperiment } from "@/components/modules/calculus/experiments/derivada-pico";
import { solidosRevolucionExperiment } from "@/components/modules/calculus/experiments/solidos-revolucion";
import { razonesCambioExperiment } from "@/components/modules/calculus/experiments/razones-cambio";
import { coberturaExperiment } from "@/components/modules/networks/experiments/cobertura";
import { enrutamientoExperiment } from "@/components/modules/networks/experiments/enrutamiento";
import { osiExperiment } from "@/components/modules/networks/experiments/osi";
import { protoboardExperiment } from "@/components/modules/electronics/experiments/protoboard";
import { fuentePoderExperiment } from "@/components/modules/electronics/experiments/fuente-poder";
import { compuertasExperiment } from "@/components/modules/electronics/experiments/compuertas";
import { firewallNatExperiment } from "@/components/modules/networks/experiments/firewall-nat";
import { contadorExperiment } from "@/components/modules/electronics/experiments/contador";
import { leyesNewtonExperiment } from "@/components/modules/physics/experiments/leyes-newton";

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
    electroimanExperiment,
    sumaRiemannExperiment,
    derivadaPicoExperiment,
    solidosRevolucionExperiment,
    razonesCambioExperiment,
    coberturaExperiment,
    enrutamientoExperiment,
    osiExperiment,
    protoboardExperiment,
    fuentePoderExperiment,
    compuertasExperiment,
    firewallNatExperiment,
    contadorExperiment,
    leyesNewtonExperiment,
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
