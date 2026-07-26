"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChecklistEntry } from "@/lib/dashboard/checklist";

const CADENCE_LABEL = { DAILY: "Daily", WEEKLY: "Weekly" } as const;

/**
 * Band C, middle: the user's own daily and weekly checks.
 *
 * Ticking is optimistic and writes straight through — a checklist that makes
 * you wait for a spinner stops being a checklist. The tick is scoped to the
 * current day or ISO week server-side, so a daily item clears itself overnight
 * with no reset job and nothing for the user to remember.
 */
export function ChecklistCard({ checklist }: { checklist: ChecklistEntry[] }) {
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: async ({ itemKey, done }: { itemKey: string; done: boolean }) => {
      const res = await fetch("/api/dashboard/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey, done }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onMutate: async ({ itemKey, done }) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard", "simple"] });
      const previous = queryClient.getQueryData(["dashboard", "simple"]);
      queryClient.setQueryData(["dashboard", "simple"], (old: { checklist: ChecklistEntry[] } | undefined) =>
        old
          ? { ...old, checklist: old.checklist.map((item) => (item.key === itemKey ? { ...item, done } : item)) }
          : old
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(["dashboard", "simple"], context?.previous);
      toast.error("Couldn't save that tick", { description: "Nothing was lost. Try again in a moment." });
    },
    // Deliberately no invalidate on success. Refetching the dashboard would
    // re-run the whole forecast engine to learn one boolean the client already
    // knows, and the optimistic value is authoritative until the next load.
  });

  const byCadence = (["DAILY", "WEEKLY"] as const)
    .map((cadence) => ({ cadence, items: checklist.filter((item) => item.cadence === cadence) }))
    .filter((group) => group.items.length > 0);

  const doneCount = checklist.filter((item) => item.done).length;

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">My checklist</CardTitle>
          <CardDescription>Yours alone. Daily items clear overnight, weekly ones on Monday.</CardDescription>
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
          {doneCount}/{checklist.length}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {byCadence.map((group) => (
          <div key={group.cadence}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {CADENCE_LABEL[group.cadence]}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.done}
                    onClick={() => mutate({ itemKey: item.key, done: !item.done })}
                    className="flex min-h-12 w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                        item.done ? "border-rag-green bg-rag-green text-white" : "border-border bg-background"
                      )}
                    >
                      {item.done && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn("min-w-0 flex-1", item.done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
