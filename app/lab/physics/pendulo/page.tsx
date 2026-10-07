"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { penduloExperiment } from "@/components/modules/physics/experiments/pendulo";

export default function PenduloPage() {
  return (
    <ExperimentShell
      experiment={penduloExperiment}
      disciplineName="Física"
      moduleName="Núcleo A"
    />
  );
}
