"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { contadorExperiment } from "@/components/modules/electronics/experiments/contador";

export default function ContadorPage() {
  return (
    <ExperimentShell
      experiment={contadorExperiment}
      disciplineName="Electrónica"
      moduleName="Electrónica digital"
    />
  );
}
