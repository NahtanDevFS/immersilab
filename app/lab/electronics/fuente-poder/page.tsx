"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { fuentePoderExperiment } from "@/components/modules/electronics/experiments/fuente-poder";

export default function FuentePoderPage() {
  return (
    <ExperimentShell
      experiment={fuentePoderExperiment}
      disciplineName="Electrónica"
      moduleName="Circuitos"
    />
  );
}
