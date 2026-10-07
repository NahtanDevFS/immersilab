"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { espectroExperiment } from "@/components/modules/networks/experiments/espectro";

export default function EspectroPage() {
  return (
    <ExperimentShell
      experiment={espectroExperiment}
      disciplineName="Redes"
      moduleName="Capa física"
    />
  );
}
