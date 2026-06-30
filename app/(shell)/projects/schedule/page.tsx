import { CrossProjectCalendar } from "@/components/schedule/cross-project-calendar";

export default function ScheduleCalendarPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Schedule Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every active project&apos;s program in one view, so trade conflicts across overlapping schedules are visible
          before they bite.
        </p>
      </div>
      <CrossProjectCalendar />
    </div>
  );
}
