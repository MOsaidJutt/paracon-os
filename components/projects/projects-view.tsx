"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutList, GanttChartSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProjectRegisterTable } from "./project-register-table";
import { MultiProjectGanttView } from "@/components/schedule/multi-project-gantt-view";

type ViewKind = "LIST" | "GANTT";

/**
 * Projects: the existing project register, plus the multi-project stacked
 * Gantt (now carrying baseline/current comparison, RAG status, delay and the
 * cross-project snowball badge — see MultiProjectGanttView's `simplified`
 * prop) folded into one screen behind a toggle, same pattern as Prospects'
 * Board/List and Pre-Construction's Register/Intel.
 *
 * ProjectRegisterTable is untouched — it renders exactly as it does in Full.
 */
export function ProjectsView() {
  const queryClient = useQueryClient();

  const { data: viewPref } = useQuery({
    queryKey: ["preference", "projects.view"],
    queryFn: async () => {
      const res = await fetch("/api/preferences/projects.view");
      if (!res.ok) throw new Error("Failed to load your view preference");
      return (await res.json()) as { value: ViewKind };
    },
  });

  const setView = useMutation({
    mutationFn: async (value: ViewKind) => {
      const res = await fetch("/api/preferences/projects.view", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("Failed to save your view preference");
      return value;
    },
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: ["preference", "projects.view"] });
      const previous = queryClient.getQueryData(["preference", "projects.view"]);
      queryClient.setQueryData(["preference", "projects.view"], { value });
      return { previous };
    },
    onError: (_error, _value, context) => {
      queryClient.setQueryData(["preference", "projects.view"], context?.previous);
      toast.error("Couldn't save your view preference");
    },
  });

  const view: ViewKind = viewPref?.value ?? "LIST";

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Choose what to show"
        className="flex w-fit items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
      >
        {(
          [
            { value: "LIST", label: "List", icon: LayoutList },
            { value: "GANTT", label: "Gantt", icon: GanttChartSquare },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={view === option.value}
            onClick={() => setView.mutate(option.value)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <option.icon className="size-4" />
            {option.label}
          </button>
        ))}
      </div>

      {view === "LIST" ? <ProjectRegisterTable /> : <MultiProjectGanttView simplified />}
    </div>
  );
}
