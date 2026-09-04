"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { colisiones1DExperiment } from "@/components/modules/physics/experiments/colisiones-1d";

export default function Colisiones1DPage() {
  return (
    <ExperimentShell
      experiment={colisiones1DExperiment}
      disciplineName="Física"
      moduleName="Núcleo A"
    />
  );
}