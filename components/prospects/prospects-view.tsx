"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { cn } from "@/lib/utils";
import type { ProspectConfig } from "@/lib/prospects/config";
import { ProspectsSummary } from "./prospects-summary";
import { ProspectBoard } from "./prospect-board";
import { ProspectsTable } from "./prospects-table";
import { ProspectDetailPanel } from "./prospect-detail-panel";
import { ConvertProspectDialog } from "./convert-dialog";
import { ProspectFormDialog } from "./prospect-form-dialog";
import type { ProspectRow } from "./types";

type ViewKind = "BOARD" | "LIST";

/**
 * The Prospects module: a light CRM for leads before they justify a tender.
 *
 * Board is the default because it makes cold -> warm literal, which is what the
 * module is for. The list stays one click away for anyone who wants density,
 * and the choice is remembered per user.
 *
 * Everything opens beside the register rather than on its own page, matching
 * the dashboard: the detail panel and the convert confirmation are the only two
 * surfaces, and neither navigates away.
 */
export function ProspectsView({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState<ProspectRow | null>(null);
  const [converting, setConverting] = useState<ProspectRow | null>(null);
  const [adding, setAdding] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const res = await fetch("/api/prospects");
      if (!res.ok) throw new Error("Failed to load prospects");
      return (await res.json()) as { prospects: ProspectRow[] };
    },
  });

  const { data: config } = useQuery({
    queryKey: ["prospects", "config"],
    queryFn: async () => {
      const res = await fetch("/api/prospects/config");
      if (!res.ok) throw new Error("Failed to load prospect config");
      return (await res.json()) as ProspectConfig;
    },
  });

  const { data: viewPref } = useQuery({
    queryKey: ["preference", "prospects.view"],
    queryFn: async () => {
      const res = await fetch("/api/preferences/prospects.view");
      if (!res.ok) throw new Error("Failed to load your view preference");
      return (await res.json()) as { value: ViewKind };
    },
  });

  const setView = useMutation({
    mutationFn: async (value: ViewKind) => {
      const res = await fetch("/api/preferences/prospects.view", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("Failed to save your view preference");
      return value;
    },
    onMutate: async (value) => {
      // Switching view should feel instant; it's a display choice, not a write
      // anyone waits on.
      await queryClient.cancelQueries({ queryKey: ["preference", "prospects.view"] });
      const previous = queryClient.getQueryData(["preference", "prospects.view"]);
      queryClient.setQueryData(["preference", "prospects.view"], { value });
      return { previous };
    },
    onError: (_error, _value, context) => {
      queryClient.setQueryData(["preference", "prospects.view"], context?.previous);
      toast.error("Couldn't save your view preference");
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't move this lead");
      }
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["prospects"] });
      const previous = queryClient.getQueryData(["prospects"]);
      queryClient.setQueryData(["prospects"], (old: { prospects: ProspectRow[] } | undefined) =>
        old ? { prospects: old.prospects.map((p) => (p.id === id ? { ...p, stage } : p)) } : old
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      queryClient.setQueryData(["prospects"], context?.previous);
      toast.error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prospects"] }),
  });

  const view: ViewKind = viewPref?.value ?? "BOARD";
  const stageList = config?.stageList ?? [];

  const prospects = (data?.prospects ?? []).filter((p) => {
    if (!filter.trim()) return true;
    const needle = filter.trim().toLowerCase();
    return [p.name, p.contactName, p.address, p.nextAction]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(needle));
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <QueryErrorState message="We couldn't load your prospects." onRetry={() => refetch()} isRetrying={isRefetching} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {prospects.length} {prospects.length === 1 ? "lead" : "leads"}
          {filter.trim() && ` matching "${filter.trim()}"`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter leads"
            aria-label="Filter leads"
            className="h-9 w-44"
          />

          <div
            role="group"
            aria-label="Choose how to show prospects"
            className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
          >
            {(
              [
                { value: "BOARD", label: "Board", icon: LayoutGrid },
                { value: "LIST", label: "List", icon: List },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={view === option.value}
                onClick={() => setView.mutate(option.value)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <option.icon className="size-4" />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            ))}
          </div>

          {canEdit && (
            <Button size="sm" className="h-9" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add prospect
            </Button>
          )}
        </div>
      </div>

      {stageList.length > 0 && <ProspectsSummary prospects={prospects} stageList={stageList} />}

      {view === "BOARD" ? (
        <ProspectBoard
          prospects={prospects}
          stageList={stageList}
          canEdit={canEdit}
          onOpen={setActive}
          onMove={(prospect, stage) => move.mutate({ id: prospect.id, stage })}
          onConvert={setConverting}
        />
      ) : (
        <ProspectsTable embedded />
      )}

      <ProspectDetailPanel
        prospect={active}
        stageList={stageList}
        canEdit={canEdit}
        onOpenChange={(open) => !open && setActive(null)}
        onConvert={(prospect) => {
          setActive(null);
          setConverting(prospect);
        }}
      />

      <ConvertProspectDialog prospect={converting} onOpenChange={(open) => !open && setConverting(null)} />

      <ProspectFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
