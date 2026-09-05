"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { osiExperiment } from "@/components/modules/networks/experiments/osi";

export default function OsiPage() {
  return (
    <ExperimentShell
      experiment={osiExperiment}
      disciplineName="Redes"
      moduleName="Arquitectura"
    />
  );
}
