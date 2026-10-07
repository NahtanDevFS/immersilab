"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { taylorExperiment } from "@/components/modules/calculus/experiments/taylor";

export default function TaylorPage() {
  return (
    <ExperimentShell
      experiment={taylorExperiment}
      disciplineName="Cálculo"
      moduleName="Núcleo A"
    />
  );
}
