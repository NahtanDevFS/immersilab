"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { razonesCambioExperiment } from "@/components/modules/calculus/experiments/razones-cambio";

export default function RazonesCambioPage() {
  return (
    <ExperimentShell
      experiment={razonesCambioExperiment}
      disciplineName="Cálculo"
      moduleName="Núcleo A"
    />
  );
}
