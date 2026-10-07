"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { modulacionExperiment } from "@/components/modules/networks/experiments/modulacion";

export default function ModulacionPage() {
  return (
    <ExperimentShell
      experiment={modulacionExperiment}
      disciplineName="Redes"
      moduleName="Capa física"
    />
  );
}
