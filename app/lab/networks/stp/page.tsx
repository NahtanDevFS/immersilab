"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { stpExperiment } from "@/components/modules/networks/experiments/stp";

export default function StpPage() {
  return (
    <ExperimentShell
      experiment={stpExperiment}
      disciplineName="Redes"
      moduleName="Segmentación y redundancia"
    />
  );
}
