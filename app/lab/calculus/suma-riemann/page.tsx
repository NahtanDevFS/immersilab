"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { sumaRiemannExperiment } from "@/components/modules/calculus/experiments/suma-riemann";

export default function SumaRiemannPage() {
  return (
    <ExperimentShell
      experiment={sumaRiemannExperiment}
      disciplineName="Cálculo"
      moduleName="Núcleo A"
    />
  );
}
