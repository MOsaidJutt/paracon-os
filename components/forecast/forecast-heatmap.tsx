import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/tenders/format";
import { cn } from "@/lib/utils";
import { roundShortfall } from "@/lib/forecast/format";

type HeatmapCell = {
  trade: string;
  weekIndex: number;
  week: string;
  demand: number;
  supply: number;
  gap: number;
  status: "Covered" | "Watch" | "Short";
  severity: "normal" | "critical";
};

// text-foreground (not a colour-matched text) keeps every tone readable —
// the rag-amber/rag-red hues fail WCAG AA for body-sized text on their own
// tint (see tailwind.config.ts's rag.green-deep comment for the verified
// numbers); the tint alone carries the signal, same as the trade dots in
// components/projects/calendar-view.tsx.
function cellTone(cell: HeatmapCell): string {
  if (cell.status === "Covered") return "bg-rag-green/15 text-foreground";
  if (cell.status === "Watch") return "bg-rag-amber/15 text-foreground";
  return cell.severity === "critical" ? "bg-rag-red/30 text-foreground" : "bg-rag-red/15 text-foreground";
}

function HeatmapCellValue({ cell }: { cell: HeatmapCell }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("cursor-default rounded-md px-2 py-1.5 text-center text-xs font-semibold", cellTone(cell))}>
          {cell.gap > 0 ? `-${roundShortfall(cell.gap)}` : Math.round(cell.demand)}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Demand {cell.demand.toFixed(1)} · Supply {cell.supply}
      </TooltipContent>
    </Tooltip>
  );
}

export function ForecastHeatmap({ trades, heatmap }: { trades: string[]; heatmap: HeatmapCell[] }) {
  const weeks = Array.from(new Map(heatmap.map((c) => [c.weekIndex, c.week])).entries()).sort(([a], [b]) => a - b);

  if (trades.length === 0 || weeks.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No trades or weeks to show yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card">Trade</TableHead>
            {weeks.map(([index, week]) => (
              <TableHead key={index} className="min-w-20 text-center">
                {formatDate(week)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade}>
              <TableCell className="sticky left-0 bg-card font-medium text-foreground">{trade}</TableCell>
              {weeks.map(([weekIndex]) => {
                const cell = heatmap.find((c) => c.trade === trade && c.weekIndex === weekIndex);
                return (
                  <TableCell key={weekIndex} className="p-1">
                    {cell ? <HeatmapCellValue cell={cell} /> : <div className="text-center">—</div>}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
