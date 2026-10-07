"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { ondasExperiment } from "@/components/modules/physics/experiments/ondas";

export default function OndasPage() {
  return (
    <ExperimentShell
      experiment={ondasExperiment}
      disciplineName="Física"
      moduleName="Núcleo A"
    />
  );
}
