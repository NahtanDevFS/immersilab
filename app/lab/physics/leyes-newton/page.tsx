"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { leyesNewtonExperiment } from "@/components/modules/physics/experiments/leyes-newton";

export default function LeyesNewtonPage() {
  return (
    <ExperimentShell
      experiment={leyesNewtonExperiment}
      disciplineName="Física"
      moduleName="Núcleo A"
    />
  );
}
