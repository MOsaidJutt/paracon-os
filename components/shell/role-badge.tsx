import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Text colours flip between a darkened and lightened variant of the same
// hue depending on theme — the /15 tint composites very differently over
// a light vs. dark surface, so one fixed shade can't pass WCAG AA in both
// (verified per-pair; see tailwind.config.ts comments for exact ratios).
const ROLE_STYLES: Record<string, string> = {
  director: "bg-brass/15 text-brass-deep dark:text-brass-light border-brass/30",
  "project-manager": "bg-steel/15 text-steel-deep dark:text-steel-light border-steel/30",
  "site-foreman":
    "bg-rag-green/15 text-rag-green-deep dark:text-rag-green-light border-rag-green/30",
  estimator: "bg-heather/15 text-heather-deep dark:text-heather-light border-heather/30",
  viewer: "bg-muted text-muted-foreground border-border",
};

const ROLE_LABELS: Record<string, string> = {
  director: "Director",
  "project-manager": "Project Manager",
  "site-foreman": "Site Foreman",
  estimator: "Estimator",
  viewer: "Viewer",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", ROLE_STYLES[role] ?? "bg-muted text-muted-foreground")}
    >
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}
