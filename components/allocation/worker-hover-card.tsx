import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ComplianceBadge } from "@/components/labour/compliance-badge";

export type HoverWorker = {
  id: string;
  name: string;
  photoUrl: string | null;
  capability: string;
  status: string;
  baseLocation: string | null;
  compliance: { type: string; status: string; expiryDate: string | null }[];
  skills: { name: string; level: number }[];
  currentSite?: string | null;
};

/**
 * The intake notes' literal hover-card spec (docs/INTAKE_NOTES.md §2): "Hover
 * a worker to see Skills, Competency, Availability, Current Site, Compliance
 * — no extra clicks. Ever." Current Site is derived live from this week's
 * Allocation (passed in as `currentSite`) — the payoff this phase unlocks.
 */
export function WorkerHoverCard({ worker, children }: { worker: HoverWorker; children: React.ReactNode }) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items-start gap-3">
          <Avatar className="size-10">
            <AvatarImage src={worker.photoUrl ?? undefined} alt={worker.name} />
            <AvatarFallback>{worker.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-foreground">{worker.name}</p>
            <p className="text-xs text-muted-foreground">{worker.capability}</p>
          </div>
          <Badge variant={worker.status === "Available" ? "default" : "secondary"}>{worker.status}</Badge>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Current site</span>
            <span className="font-medium text-foreground">{worker.currentSite ?? "Unassigned"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Base location</span>
            <span className="font-medium text-foreground">{worker.baseLocation ?? "—"}</span>
          </div>
        </div>

        {worker.skills.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">Skills</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {worker.skills.map((skill) => (
                <Badge key={skill.name} variant="outline" className="text-[11px]">
                  {skill.name} · L{skill.level}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Compliance</p>
          <div className="mt-1 flex flex-col gap-1">
            {worker.compliance.length === 0 && <span className="text-xs text-muted-foreground">No records.</span>}
            {worker.compliance.map((c) => (
              <div key={c.type} className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground">{c.type}</span>
                <ComplianceBadge status={c.status} expiryDate={c.expiryDate} />
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
