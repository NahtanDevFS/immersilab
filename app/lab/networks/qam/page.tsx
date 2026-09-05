"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { qamExperiment } from "@/components/modules/networks/experiments/qam";

export default function QamPage() {
  return (
    <ExperimentShell
      experiment={qamExperiment}
      disciplineName="Redes"
      moduleName="Capa física"
    />
  );
}
