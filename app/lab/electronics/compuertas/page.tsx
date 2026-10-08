"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { compuertasExperiment } from "@/components/modules/electronics/experiments/compuertas";

export default function CompuertasPage() {
  return (
    <ExperimentShell
      experiment={compuertasExperiment}
      disciplineName="Electrónica"
      moduleName="Electrónica digital"
    />
  );
}
