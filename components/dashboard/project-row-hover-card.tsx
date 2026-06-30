"use client";

import Link from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ProjectHealthBadge } from "@/components/dashboard/project-health-badge";
import type { ProjectHealthStatus } from "@/lib/dashboard/health";

/** A project row that reveals its health reasons on hover instead of always showing them inline — same pattern as the worker/staff hover cards. */
export function ProjectRowHoverCard({
  id,
  name,
  code,
  status,
  reasons,
}: {
  id: string;
  name: string;
  code: string;
  status: ProjectHealthStatus;
  reasons: string[];
}) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Link
          href={`/projects/${id}`}
          className="flex items-center justify-between gap-2 rounded px-1 py-1 text-sm transition-colors hover:bg-muted/60"
        >
          <span className="text-foreground">
            {name} <span className="text-muted-foreground">({code})</span>
          </span>
          <ProjectHealthBadge status={status} />
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <p className="mb-1.5 text-sm font-medium text-foreground">{name}</p>
        {reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issues — on track.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {reasons.map((reason, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                · {reason}
              </li>
            ))}
          </ul>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
