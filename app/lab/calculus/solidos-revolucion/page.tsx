"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { solidosRevolucionExperiment } from "@/components/modules/calculus/experiments/solidos-revolucion";

export default function SolidosRevolucionPage() {
  return (
    <ExperimentShell
      experiment={solidosRevolucionExperiment}
      disciplineName="Cálculo"
      moduleName="Núcleo A"
    />
  );
}
