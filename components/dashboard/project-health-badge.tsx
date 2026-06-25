import { Badge } from "@/components/ui/badge";
import type { ProjectHealthStatus } from "@/lib/dashboard/health";

const VARIANT: Record<ProjectHealthStatus, "success" | "warning" | "destructive"> = {
  "On Track": "success",
  Attention: "warning",
  Critical: "destructive",
};

export function ProjectHealthBadge({ status }: { status: ProjectHealthStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}
