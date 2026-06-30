"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export type PerformanceScores = {
  quality: number;
  reliability: number;
  productivity: number;
  safety: number;
};

export function PerformanceRadar({ scores }: { scores: PerformanceScores }) {
  const data = [
    { metric: "Quality", value: scores.quality },
    { metric: "Reliability", value: scores.reliability },
    { metric: "Productivity", value: scores.productivity },
    { metric: "Safety", value: scores.safety },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
          <Radar dataKey="value" stroke="#6b4f43" fill="#6b4f43" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
