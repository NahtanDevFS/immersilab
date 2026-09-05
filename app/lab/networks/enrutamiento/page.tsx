"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { enrutamientoExperiment } from "@/components/modules/networks/experiments/enrutamiento";

export default function EnrutamientoPage() {
  return (
    <ExperimentShell
      experiment={enrutamientoExperiment}
      disciplineName="Redes"
      moduleName="Capa de red"
    />
  );
}
