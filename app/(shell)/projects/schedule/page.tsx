"use client";

import { useState } from "react";
import { CrossProjectCalendar } from "@/components/schedule/cross-project-calendar";
import { MultiProjectGanttView } from "@/components/schedule/multi-project-gantt-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function ScheduleCalendarPage() {
  const [view, setView] = useState<"gantt" | "calendar">("gantt");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every active project&apos;s program stacked in one view — total labour demand by trade and trade conflicts
          across overlapping schedules are visible before they bite.
        </p>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "gantt" | "calendar")}>
        <TabsList>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="gantt">
          <MultiProjectGanttView />
        </TabsContent>
        <TabsContent value="calendar">
          <CrossProjectCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
