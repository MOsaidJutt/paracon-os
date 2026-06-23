import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { roundShortfall } from "@/lib/forecast/format";

type MatrixCell = {
  role: string;
  blockIndex: number;
  blockLabel: string;
  demand: number;
  supply: number;
  gap: number;
  status: "Covered" | "Watch" | "Short";
  severity: "normal" | "critical";
};

function StatusBadge({ cell }: { cell: MatrixCell }) {
  if (cell.status === "Covered") return <Badge variant="success">Covered</Badge>;
  if (cell.status === "Watch") return <Badge variant="warning">Short {roundShortfall(cell.gap)}</Badge>;
  return (
    <Badge variant="destructive" className={cn(cell.severity === "critical" && "ring-2 ring-destructive/40")}>
      Short {roundShortfall(cell.gap)}
    </Badge>
  );
}

export function ForecastMatrix({ roles, matrix }: { roles: string[]; matrix: MatrixCell[] }) {
  const blocks = Array.from(new Map(matrix.map((c) => [c.blockIndex, c.blockLabel])).entries()).sort(
    ([a], [b]) => a - b
  );

  if (roles.length === 0 || blocks.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No trades or forecast blocks configured yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trade</TableHead>
            {blocks.map(([index, label]) => (
              <TableHead key={index}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role}>
              <TableCell className="font-medium text-foreground">{role}</TableCell>
              {blocks.map(([blockIndex]) => {
                const cell = matrix.find((c) => c.role === role && c.blockIndex === blockIndex);
                return <TableCell key={blockIndex}>{cell ? <StatusBadge cell={cell} /> : "—"}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
