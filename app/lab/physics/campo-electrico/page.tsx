"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { campoElectricoExperiment } from "@/components/modules/physics/experiments/campo-electrico";

export default function CampoElectricoPage() {
  return (
    <ExperimentShell
      experiment={campoElectricoExperiment}
      disciplineName="Física"
      moduleName="Electromagnetismo"
    />
  );
}
