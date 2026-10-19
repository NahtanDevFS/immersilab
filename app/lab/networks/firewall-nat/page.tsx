"use client";

import { ExperimentShell } from "@/components/shell/ExperimentShell";
import { firewallNatExperiment } from "@/components/modules/networks/experiments/firewall-nat";

export default function FirewallNatPage() {
  return (
    <ExperimentShell
      experiment={firewallNatExperiment}
      disciplineName="Redes"
      moduleName="Seguridad"
    />
  );
}
