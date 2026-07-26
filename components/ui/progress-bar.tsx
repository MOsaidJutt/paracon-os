import { cn } from "@/lib/utils";
import type { RagBand } from "@/lib/dashboard/rag";

const BAND_CLASS: Record<RagBand, string> = {
  good: "bg-rag-green",
  warning: "bg-rag-amber",
  bad: "bg-rag-red",
};

/**
 * A labelled horizontal progress bar: label left, value right, tan track,
 * RAG-banded fill. The companion to KpiRing — a ring for the four north-star
 * figures, a bar wherever several values are compared down a list (trades,
 * worker KPIs), because bars share a baseline and rings don't.
 */
export function ProgressBar({
  label,
  percent,
  band,
  valueLabel,
  className,
}: {
  label: string;
  /** 0-100, or null for no data yet. Clamped for the fill width; `valueLabel` controls what's printed. */
  percent: number | null;
  band: RagBand;
  /** Printed at the right. Defaults to the rounded percentage. */
  valueLabel?: string;
  className?: string;
}) {
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-foreground">{label}</span>
        <span
          className={cn(
            "shrink-0 text-sm font-medium tabular-nums",
            percent === null ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {valueLabel ?? (percent === null ? "No data" : `${Math.round(percent)}%`)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-tan/40"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none", BAND_CLASS[band])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
