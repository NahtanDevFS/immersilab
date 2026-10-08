"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { protoboardExperiment } from "@/components/modules/electronics/experiments/protoboard";

export default function ProtoboardPage() {
  return (
    <ExperimentShell
      experiment={protoboardExperiment}
      disciplineName="Electrónica"
      moduleName="Circuitos"
    />
  );
}
