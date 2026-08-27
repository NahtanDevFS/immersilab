"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { tiroParabolicoExperiment } from "@/components/modules/physics/experiments/tiro-parabolico";

export default function TiroParabolicoPage() {
  return (
    <ExperimentShell
      experiment={tiroParabolicoExperiment}
      disciplineName="Física"
      moduleName="Núcleo A"
    />
  );
}