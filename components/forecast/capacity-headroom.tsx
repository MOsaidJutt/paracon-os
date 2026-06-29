import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { roundHeadroom, roundShortfall } from "@/lib/forecast/format";

type RoleHeadroom = { role: string; headroom: number };
type ShortageEntry = { role: string; blockIndex: number; blockLabel: string; gap: number };
type CapacityHeadroom = {
  byRole: RoleHeadroom[];
  shortages: ShortageEntry[];
  canTakeOnMoreWork: boolean;
  totalHeadroom: number;
};

function headroomLabel(headroom: number): string {
  const rounded = roundHeadroom(headroom);
  if (rounded > 0) return `+${rounded} spare`;
  if (rounded < 0) return `${rounded} short`;
  return "exactly covered";
}

export function CapacityHeadroomCard({ headroom }: { headroom: CapacityHeadroom }) {
  const rolesWithSignal = headroom.byRole.filter((r) => roundHeadroom(r.headroom) !== 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Can we take on more work?</CardTitle>
          <Badge variant={headroom.canTakeOnMoreWork ? "default" : "destructive"}>
            {headroom.canTakeOnMoreWork ? "Yes" : "Not without hiring"}
          </Badge>
        </div>
        <CardDescription>
          Worst-case spare capacity per trade across the whole forecast horizon — the amount of
          new work each trade could take on today without creating a future shortage.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rolesWithSignal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every trade is exactly covered — no spare capacity, no shortage.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rolesWithSignal.map((r) => (
              <Badge key={r.role} variant={r.headroom < 0 ? "destructive" : "outline"} className="gap-1">
                {r.role}
                <span className="font-normal opacity-80">· {headroomLabel(r.headroom)}</span>
              </Badge>
            ))}
          </div>
        )}

        {headroom.shortages.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Shortages by trade and block</p>
            <ul className="flex flex-col gap-1">
              {headroom.shortages.map((s, i) => (
                <li key={`${s.role}-${s.blockIndex}-${i}`} className="text-sm text-muted-foreground">
                  <span className="text-foreground">{s.role}</span> — short {roundShortfall(s.gap)} in {s.blockLabel}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link href="/forecast" className="self-start text-sm font-medium text-brass hover:underline">
          More details →
        </Link>
      </CardContent>
    </Card>
  );
}
