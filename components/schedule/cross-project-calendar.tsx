"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/tenders/format";

type CalendarActivity = {
  id: string;
  parentId: string | null;
  name: string;
  trade: string;
  startDate: string;
  endDate: string;
  isCritical: boolean;
  projectId: string;
  projectName: string;
};

type CalendarProject = { id: string; name: string; code: string; status: string };

type TradeConflict = {
  week: string;
  trade: string;
  demand: number;
  supply: number;
  gap: number;
  projects: { projectId: string; projectName: string; demand: number }[];
};

type CalendarResponse = { projects: CalendarProject[]; activities: CalendarActivity[]; conflicts: TradeConflict[] };

type TaskFilter = "both" | "phases" | "tasks";

const PROJECT_COLORS = ["#6b4f43", "#4F6B82", "#2E7D32", "#6B5A78", "#ED9B11", "#8ea0af", "#1C1B17", "#C62828"];

function colorForIndex(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export function CrossProjectCalendar() {
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("both");
  const [colourBy, setColourBy] = useState<"project" | "trade" | "status">("project");
  const [search, setSearch] = useState("");

  const from = monthAnchor;
  const to = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0));

  const { data, isLoading } = useQuery({
    queryKey: ["schedule", "calendar", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`/api/schedule/calendar?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load schedule calendar");
      return (await res.json()) as CalendarResponse;
    },
  });

  const projectIndexById = useMemo(() => {
    const map = new Map<string, number>();
    (data?.projects ?? []).forEach((p, i) => map.set(p.id, i));
    return map;
  }, [data?.projects]);

  const filteredActivities = useMemo(() => {
    let list = data?.activities ?? [];
    if (taskFilter === "phases") list = list.filter((a) => a.parentId === null);
    if (taskFilter === "tasks") list = list.filter((a) => a.parentId !== null);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.projectName.toLowerCase().includes(q));
    }
    return list;
  }, [data?.activities, taskFilter, search]);

  const days = useMemo(() => {
    const firstWeekday = (from.getUTCDay() + 6) % 7; // Monday-first
    const gridStart = new Date(from);
    gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + i);
      return date;
    });
  }, [from]);

  function colorFor(activity: CalendarActivity): string {
    if (colourBy === "project") return colorForIndex(projectIndexById.get(activity.projectId) ?? 0);
    if (colourBy === "trade") return colorForIndex(activity.trade.length);
    return activity.isCritical ? "#C62828" : "#2E7D32";
  }

  const conflicts = data?.conflicts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthAnchor(new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() - 1, 1)))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center font-heading text-sm font-semibold text-foreground">
            {monthAnchor.toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthAnchor(new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 1)))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phases or tasks..."
              className="h-8 w-52 pl-7 text-xs"
            />
          </div>
          <Select value={taskFilter} onValueChange={(v) => setTaskFilter(v as TaskFilter)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Phases & tasks</SelectItem>
              <SelectItem value="phases">Phases only</SelectItem>
              <SelectItem value="tasks">Tasks only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={colourBy} onValueChange={(v) => setColourBy(v as typeof colourBy)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Colour by project</SelectItem>
              <SelectItem value="trade">Colour by trade</SelectItem>
              <SelectItem value="status">Colour by critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {colourBy === "project" &&
          (data?.projects ?? []).map((p, i) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: colorForIndex(i) }} />
              {p.name}
            </span>
          ))}
      </div>

      <TooltipProvider>
        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-2 py-1.5 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const inMonth = day.getUTCMonth() === monthAnchor.getUTCMonth();
              const dayActivities = filteredActivities.filter(
                (a) => day >= new Date(a.startDate.slice(0, 10)) && day <= new Date(a.endDate.slice(0, 10))
              );
              const dayConflicts = conflicts.filter((c) => isSameDay(new Date(c.week), startOfIsoWeekDay(day)));

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-24 border-b border-r border-border p-1.5",
                    !inMonth && "bg-muted/30 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{day.getUTCDate()}</span>
                    {dayConflicts.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-0.5 rounded-full bg-rag-red/15 px-1.5 py-0.5 text-[10px] font-medium text-rag-red">
                            <AlertTriangle className="size-3" />
                            {dayConflicts.length}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64 text-xs">
                          {dayConflicts.map((c) => (
                            <p key={`${c.week}-${c.trade}`}>
                              {c.trade}: needs {c.demand}, supply {c.supply} ({c.gap} short) —{" "}
                              {c.projects.map((p) => p.projectName).join(", ")}
                            </p>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayActivities.slice(0, 4).map((a) => (
                      <Tooltip key={a.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="truncate rounded px-1 text-[10px] font-medium text-white"
                            style={{ backgroundColor: colorFor(a) }}
                          >
                            {a.name}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <p className="font-medium">{a.name}</p>
                          <p className="text-muted-foreground">
                            {a.projectName} · {a.trade}
                          </p>
                          <p className="text-muted-foreground">
                            {formatDate(a.startDate)} – {formatDate(a.endDate)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {dayActivities.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{dayActivities.length - 4} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </TooltipProvider>

      {isLoading && <p className="text-sm text-muted-foreground">Loading schedule calendar...</p>}
    </div>
  );
}

function startOfIsoWeekDay(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d;
}
