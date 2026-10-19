"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { subredesVlanExperiment } from "@/components/modules/networks/experiments/subredes-vlan";

export default function SubredesVlanPage() {
  return (
    <ExperimentShell
      experiment={subredesVlanExperiment}
      disciplineName="Redes"
      moduleName="Segmentación y redundancia"
    />
  );
}
