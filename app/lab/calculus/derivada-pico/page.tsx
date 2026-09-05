"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { derivadaPicoExperiment } from "@/components/modules/calculus/experiments/derivada-pico";

export default function DerivadaPicoPage() {
  return (
    <ExperimentShell
      experiment={derivadaPicoExperiment}
      disciplineName="Cálculo"
      moduleName="Núcleo A"
    />
  );
}
