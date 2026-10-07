"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { coberturaExperiment } from "@/components/modules/networks/experiments/cobertura";

export default function CoberturaPage() {
  return (
    <ExperimentShell
      experiment={coberturaExperiment}
      disciplineName="Redes"
      moduleName="Capa física"
    />
  );
}
