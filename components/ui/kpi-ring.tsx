import { cn } from "@/lib/utils";
import { RAG_BAND_HEX, type RagBand } from "@/lib/dashboard/rag";

// Literal hex — an SVG stroke needs a real colour value, not a Tailwind class.
// Kept in sync with the tan token in tailwind.config.ts.
const TRACK_COLOR = "#ddc8b8";

/**
 * A closed progress ring: tan track, RAG-banded fill, the number in the
 * middle. Deliberately a full 360deg donut rather than the 270deg speedometer
 * in components/scorecard/score-gauge.tsx — that one reads as a gauge with a
 * floor and a ceiling, this one reads as "x% of the way there", which is what
 * every KPI on the simplified dashboard actually means.
 *
 * Pure SVG with no chart library: four of these render above the fold on
 * first paint, and a Recharts RadialBarChart each would ship a chart runtime
 * to draw an arc.
 */
export function KpiRing({
  percent,
  band,
  label,
  sublabel,
  size = 108,
  className,
}: {
  /**
   * 0-100, or null when there's no data yet. Values above 100 are clamped for
   * the arc (the ring is already full) but printed as given — beating a target
   * should say so.
   */
  percent: number | null;
  band: RagBand;
  label: string;
  sublabel?: string;
  size?: number;
  className?: string;
}) {
  const stroke = Math.round(size * 0.1);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={percent === null ? `${label}: no data yet` : `${label}: ${Math.round(percent)} percent`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TRACK_COLOR}
            strokeOpacity={0.4}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={RAG_BAND_HEX[band]}
            strokeWidth={stroke}
            // Square cap at zero. A round cap paints its rounded end even when
            // the dash length is 0, so an empty ring rendered as a coloured dot
            // at twelve o'clock — which reads as a sliver of progress that
            // isn't there, the same lie the null handling exists to avoid.
            strokeLinecap={dash > 0 ? "round" : "butt"}
            strokeDasharray={`${dash} ${circumference - dash}`}
            // Start the arc at 12 o'clock and run clockwise, the direction a
            // progress ring is read.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {percent === null ? (
            <span className="font-heading text-xl font-semibold text-muted-foreground" aria-hidden>
              &ndash;
            </span>
          ) : (
            <span className="font-heading text-xl font-semibold tabular-nums text-foreground">
              {Math.round(percent)}
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </span>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium leading-tight text-foreground">{label}</p>
        {sublabel && <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}
