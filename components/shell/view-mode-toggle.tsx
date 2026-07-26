"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/view-mode";

const OPTIONS: { value: ViewMode; label: string; icon: typeof LayoutGrid; hint: string }[] = [
  { value: "SIMPLE", label: "Simplified", icon: LayoutGrid, hint: "The five everyday modules" },
  { value: "FULL", label: "Full", icon: Layers, hint: "Every screen, including Finance" },
];

/**
 * Segmented Simplified/Full switch. Optimistic: the pressed segment moves
 * immediately and the nav re-renders from the server refresh, because waiting
 * on a round trip to see a view change reads as a broken button. A failed save
 * rolls the segment back and says so plainly.
 */
export function ViewModeToggle({ viewMode }: { viewMode: ViewMode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Null means "showing the server's value". Held until the refreshed server
  // prop catches up rather than cleared when the request resolves — otherwise
  // the pressed segment snaps back to the old view for the frame between the
  // save landing and router.refresh() re-rendering the layout.
  const [optimistic, setOptimistic] = useState<ViewMode | null>(null);
  const [saving, setSaving] = useState(false);
  const current = optimistic ?? viewMode;

  useEffect(() => {
    if (optimistic !== null && viewMode === optimistic) setOptimistic(null);
  }, [viewMode, optimistic]);

  async function select(next: ViewMode) {
    if (next === current || saving) return;
    setOptimistic(next);
    setSaving(true);
    try {
      const res = await fetch("/api/preferences/view-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewMode: next }),
      });
      if (!res.ok) throw new Error("save failed");
      startTransition(() => router.refresh());
    } catch {
      setOptimistic(null);
      toast.error("Couldn't switch view", { description: "Your view is unchanged. Try again in a moment." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="group"
      aria-label="Choose how much of the app to show"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={active}
            title={option.hint}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <option.icon className="size-4" />
            <span className="hidden md:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
