"use client";

import { Gantt, ViewMode, type Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";

export type ProgramActivityRow = {
  id: string;
  name: string;
  trade: string;
  startDate: string;
  endDate: string;
  isCritical: boolean;
  status: string;
};

const TRADE_COLORS: Record<string, string> = {
  Carpenter: "#B08D57",
  Electrician: "#4F6B82",
  Plumber: "#2E7D32",
  Plasterer: "#6B5A78",
  Painter: "#ED9B11",
  "Site Labourer": "#8ea0af",
  "Project Engineer": "#1C1B17",
};

function colorForTrade(trade: string): string {
  return TRADE_COLORS[trade] ?? "#4F6B82";
}

export function GanttView({ activities }: { activities: ProgramActivityRow[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Add an activity to see the program on a Gantt chart.
      </div>
    );
  }

  const tasks: Task[] = activities.map((a) => ({
    id: a.id,
    type: "task",
    name: a.isCritical ? `${a.name} ★` : a.name,
    start: new Date(a.startDate),
    end: new Date(a.endDate),
    progress: a.status === "Complete" ? 100 : 0,
    isDisabled: true,
    styles: {
      backgroundColor: colorForTrade(a.trade),
      backgroundSelectedColor: colorForTrade(a.trade),
      progressColor: a.isCritical ? "#C62828" : colorForTrade(a.trade),
    },
  }));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Gantt
        tasks={tasks}
        viewMode={ViewMode.Week}
        listCellWidth="155px"
        columnWidth={65}
        barCornerRadius={4}
        todayColor="rgba(176, 141, 87, 0.15)"
      />
    </div>
  );
}
