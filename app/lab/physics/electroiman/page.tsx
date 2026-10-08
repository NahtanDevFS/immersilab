"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { electroimanExperiment } from "@/components/modules/physics/experiments/electroiman";

export default function ElectroimanPage() {
  return (
    <ExperimentShell
      experiment={electroimanExperiment}
      disciplineName="Física"
      moduleName="Electromagnetismo"
    />
  );
}
