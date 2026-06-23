"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarActivity = {
  id: string;
  name: string;
  trade: string;
  startDate: string;
  endDate: string;
  isCritical: boolean;
};

export type CalendarMilestone = {
  id: string;
  name: string;
  date: string;
};

const TRADE_DOT_COLORS: Record<string, string> = {
  Carpenter: "bg-brass",
  Electrician: "bg-steel",
  Plumber: "bg-rag-green",
  Plasterer: "bg-heather",
  Painter: "bg-rag-amber",
  "Site Labourer": "bg-steel-light",
  "Project Engineer": "bg-ink",
};

function dotColor(trade: string): string {
  return TRADE_DOT_COLORS[trade] ?? "bg-steel";
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarView({ activities, milestones }: { activities: CalendarActivity[]; milestones: CalendarMilestone[] }) {
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));

  const today = useMemo(() => new Date(), []);
  const next30 = useMemo(() => new Date(today.getTime() + 30 * 86_400_000), [today]);

  const days = useMemo(() => {
    const firstOfMonth = startOfMonth(monthAnchor);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return date;
    });
  }, [monthAnchor]);

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-heading text-sm font-semibold text-foreground">
          {monthAnchor.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === monthAnchor.getMonth();
          const isToday = isSameDay(day, today);
          const inNext30 = day >= today && day <= next30;

          const dayActivities = activities.filter(
            (a) => day >= new Date(a.startDate) && day <= new Date(a.endDate)
          );
          const dayMilestones = milestones.filter((m) => isSameDay(day, new Date(m.date)));

          return (
            <div
              key={i}
              className={cn(
                "min-h-20 border-b border-r border-border p-1.5",
                !inMonth && "bg-muted/30 text-muted-foreground",
                inNext30 && "bg-brass/5"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs", isToday && "font-bold text-brass-deep")}>{day.getDate()}</span>
                {dayMilestones.length > 0 && <Star className="size-3 fill-rag-red text-rag-red" />}
              </div>

              {dayMilestones.map((m) => (
                <div key={m.id} className="mt-0.5 truncate rounded bg-rag-red/10 px-1 text-[10px] font-medium text-rag-red" title={m.name}>
                  {m.name}
                </div>
              ))}

              <div className="mt-1 flex flex-wrap gap-0.5">
                {dayActivities.slice(0, 6).map((a) => (
                  <span
                    key={a.id}
                    title={`${a.name} (${a.trade})`}
                    className={cn("size-1.5 rounded-full", dotColor(a.trade), a.isCritical && "ring-1 ring-rag-red")}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
