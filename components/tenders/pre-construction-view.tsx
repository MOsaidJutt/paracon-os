"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutList, LineChart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PreConstructionSummary } from "./pre-construction-summary";
import { TenderRegisterTable } from "./tender-register-table";
import { DashboardCards } from "./dashboard-cards";

type ViewKind = "REGISTER" | "INTEL";

/**
 * Pre-Construction: the working tender register, plus the bid-intelligence
 * analysis already built, folded into one screen instead of two.
 *
 * Register (the day-to-day tracker) is the default; Intel is the existing
 * /api/tenders/dashboard analysis (bid-size bands, timing, client scorecard),
 * reached by the same toggle pattern as Prospects' Board/List — a display
 * choice, remembered per user, that changes nothing about what's underneath.
 *
 * Neither TenderRegisterTable nor DashboardCards is touched by this wrapper:
 * they render exactly as they do in the Full view. This component only adds
 * the toggle and the summary strip above them.
 */
export function PreConstructionView() {
  const queryClient = useQueryClient();

  const { data: viewPref } = useQuery({
    queryKey: ["preference", "preconstruction.view"],
    queryFn: async () => {
      const res = await fetch("/api/preferences/preconstruction.view");
      if (!res.ok) throw new Error("Failed to load your view preference");
      return (await res.json()) as { value: ViewKind };
    },
  });

  const setView = useMutation({
    mutationFn: async (value: ViewKind) => {
      const res = await fetch("/api/preferences/preconstruction.view", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("Failed to save your view preference");
      return value;
    },
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: ["preference", "preconstruction.view"] });
      const previous = queryClient.getQueryData(["preference", "preconstruction.view"]);
      queryClient.setQueryData(["preference", "preconstruction.view"], { value });
      return { previous };
    },
    onError: (_error, _value, context) => {
      queryClient.setQueryData(["preference", "preconstruction.view"], context?.previous);
      toast.error("Couldn't save your view preference");
    },
  });

  const view: ViewKind = viewPref?.value ?? "REGISTER";

  return (
    <div className="flex flex-col gap-4">
      <PreConstructionSummary />

      <div
        role="group"
        aria-label="Choose what to show"
        className="flex w-fit items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
      >
        {(
          [
            { value: "REGISTER", label: "Register", icon: LayoutList },
            { value: "INTEL", label: "Intel", icon: LineChart },
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

      {view === "REGISTER" ? <TenderRegisterTable /> : <DashboardCards />}
    </div>
  );
}
