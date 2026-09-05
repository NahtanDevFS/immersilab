"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { venturiExperiment } from "@/components/modules/physics/experiments/venturi";

export default function VenturiPage() {
  return (
    <ExperimentShell
      experiment={venturiExperiment}
      disciplineName="Física"
      moduleName="Fluidos"
    />
  );
}
