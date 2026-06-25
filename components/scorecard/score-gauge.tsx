"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";

// Literal hex (Recharts needs real colour values, not Tailwind classes) —
// kept in sync with the rag.* / tan tokens in tailwind.config.ts.
const TRACK_COLOR = "#ddc8b8";
const BAND_COLOR = { good: "#2E7D32", warning: "#ED9B11", bad: "#C62828" } as const;

export type GaugeBand = keyof typeof BAND_COLOR;

export function bandForScore(score: number, goodThreshold: number, warningThreshold: number): GaugeBand {
  if (score >= goodThreshold) return "good";
  if (score >= warningThreshold) return "warning";
  return "bad";
}

/** A ~270° speedometer-style radial gauge for a 0-100 score, coloured by RAG band. */
export function ScoreGauge({
  value,
  band,
  size = 120,
  label,
}: {
  value: number;
  band: GaugeBand;
  size?: number;
  label?: string;
}) {
  const data = [{ value, fill: BAND_COLOR[band] }];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <RadialBarChart
        width={size}
        height={size}
        cx="50%"
        cy="50%"
        innerRadius="72%"
        outerRadius="100%"
        barSize={Math.round(size * 0.14)}
        data={data}
        startAngle={225}
        endAngle={-45}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          background={{ fill: TRACK_COLOR, fillOpacity: 0.35 }}
          dataKey="value"
          cornerRadius={Math.round(size * 0.07)}
          isAnimationActive={false}
        />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-semibold text-foreground">{Math.round(value)}</span>
        {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
