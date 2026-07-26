"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DASHBOARD_WIDGETS, type WidgetState } from "@/lib/dashboard/widget-registry";
import { DEFAULT_KPI_SLOTS, RING_SLOT_COUNT, type KpiSlotId, type KpiSlotMeta } from "@/lib/dashboard/kpi-slots";
import { DetailPanel } from "./detail-panel";

const TITLE_BY_ID = Object.fromEntries(DASHBOARD_WIDGETS.simple.map((w) => [w.id, w.title]));

type SlotsResponse = { available: KpiSlotMeta[]; slots: KpiSlotId[] };

/**
 * "Customise" — widget order and visibility, plus which metric sits in each of
 * the four ring slots.
 *
 * Buttons rather than drag-and-drop for reordering. The Full view's dashboard
 * uses dnd-kit and it works well with a mouse, but this panel has to be usable
 * on a phone and on a tablet on site, where dragging a row inside a scrolling
 * sheet fights the scroll. Up/down buttons are boring and they work everywhere.
 *
 * Nothing saves until "Save changes": a user rearranging their dashboard is
 * experimenting, and every intermediate state does not deserve a write.
 */
export function CustomisePanel({
  open,
  onOpenChange,
  layout,
  onLayoutChange,
  onSave,
  isSaving,
  availableWidgetIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: WidgetState[];
  onLayoutChange: (next: WidgetState[]) => void;
  /** Handed the layout this panel is displaying, so the write can't depend on a stale captured value. */
  onSave: (layout: WidgetState[]) => void | Promise<void>;
  isSaving: boolean;
  /** Widget ids this user actually has data for — the rest aren't offered. */
  availableWidgetIds: string[];
}) {
  const queryClient = useQueryClient();
  /** The pending ring selection, seeded from the server the first time the panel opens. */
  const [slots, setSlots] = useState<KpiSlotId[] | null>(null);

  const { data: slotData, isLoading: slotsLoading } = useQuery({
    queryKey: ["dashboard", "kpi-slots"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/dashboard/kpi-slots");
      if (!res.ok) throw new Error("Failed to load the metric options");
      return (await res.json()) as SlotsResponse;
    },
  });

  // Closing discards the pending selection, so Cancel really cancels and the
  // next open starts from whatever is actually saved.
  useEffect(() => {
    if (open) return;
    setSlots(null);
  }, [open]);

  useEffect(() => {
    if (!slotData || slots !== null) return;
    setSlots(slotData.slots);
  }, [slotData, slots]);

  const saveSlots = useMutation({
    mutationFn: async (next: KpiSlotId[]) => {
      const res = await fetch("/api/dashboard/kpi-slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save your rings");
      }
    },
    // No invalidation here. React Query awaits onSuccess before mutateAsync
    // resolves, and invalidating the dashboard query kicks off a refetch that
    // re-runs the whole forecast engine — long enough that a second save
    // sequenced behind it never got away. Both writes are issued together
    // below, and the refresh happens once, after both have landed.
    onError: (error: Error) => toast.error(error.message),
  });

  const offered = layout.filter((widget) => availableWidgetIds.includes(widget.id));

  function move(id: string, direction: -1 | 1) {
    const index = layout.findIndex((w) => w.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layout.length) return;
    const next = [...layout];
    [next[index], next[target]] = [next[target], next[index]];
    onLayoutChange(next);
  }

  function toggle(id: string) {
    onLayoutChange(layout.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }

  function chooseSlot(index: number, id: KpiSlotId) {
    setSlots((current) => {
      if (!current) return current;
      const next = [...current];
      // Picking a metric that's already in another slot swaps the two rather
      // than silently duplicating it — the API rejects duplicates, and a
      // disabled option would leave the user unable to reorder their rings.
      const existing = next.indexOf(id);
      if (existing !== -1) next[existing] = next[index];
      next[index] = id;
      return next;
    });
  }

  /**
   * Both writes are awaited before the panel closes. Closing first and letting
   * the requests finish in the background loses them the moment the user
   * reloads or navigates, with nothing on screen to say the choice didn't
   * stick. On failure the panel stays open, so the user's edits are still
   * there to retry rather than discarded behind a closed sheet.
   */
  async function handleSave() {
    // Issued together, not one after the other. Sequencing them meant a slow or
    // failed first write swallowed the second silently: whichever save went
    // first was the only one that ever reached the server.
    const writes: Promise<unknown>[] = [Promise.resolve(onSave(layout))];
    if (slots && slots.length > 0) writes.push(saveSlots.mutateAsync(slots));

    const results = await Promise.allSettled(writes);
    const failed = results.filter((result) => result.status === "rejected");

    if (failed.length > 0) {
      // Stay open with the user's edits intact so they can retry. saveSlots
      // reports its own failure; the layout write needs one here.
      toast.error("Couldn't save your dashboard", {
        description: "Your changes are still here. Try again in a moment.",
      });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["dashboard", "simple"] });
    onOpenChange(false);
  }

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Customise your dashboard"
      description="Yours only. Nobody else's dashboard changes."
      footer={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving || saveSlots.isPending}>
            {isSaving || saveSlots.isPending ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="mb-1 text-sm font-medium text-foreground">The four rings</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Pick the metric each ring shows. Only percentages appear here, because a ring shows how far along
            something is.
          </p>
          {slotsLoading || !slots ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: RING_SLOT_COUNT }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {slots.map((slotId, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-sm text-muted-foreground">Ring {index + 1}</span>
                  <Select value={slotId} onValueChange={(value) => chooseSlot(index, value as KpiSlotId)}>
                    <SelectTrigger aria-label={`Metric for ring ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(slotData?.available ?? []).map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-medium text-foreground">What&apos;s on the page</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Reorder with the arrows, or hide anything you don&apos;t use.
          </p>
          <ul className="flex flex-col gap-1">
            {offered.map((widget, index) => (
              <li
                key={widget.id}
                className={cn(
                  "flex items-center gap-1 rounded-md border border-border px-2 py-1.5",
                  !widget.visible && "opacity-60"
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {TITLE_BY_ID[widget.id] ?? widget.id}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Move ${TITLE_BY_ID[widget.id]} up`}
                  disabled={index === 0}
                  onClick={() => move(widget.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Move ${TITLE_BY_ID[widget.id]} down`}
                  disabled={index === offered.length - 1}
                  onClick={() => move(widget.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={widget.visible ? `Hide ${TITLE_BY_ID[widget.id]}` : `Show ${TITLE_BY_ID[widget.id]}`}
                  onClick={() => toggle(widget.id)}
                >
                  {widget.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              onLayoutChange(
                DASHBOARD_WIDGETS.simple.map((w) => ({ id: w.id, visible: w.defaultVisible ?? true }))
              );
              if (slotData) {
                const allowed = new Set(slotData.available.map((slot) => slot.id));
                setSlots(DEFAULT_KPI_SLOTS.filter((id) => allowed.has(id)).slice(0, RING_SLOT_COUNT));
              }
            }}
          >
            <RotateCcw className="size-4" /> Reset to default
          </Button>
        </section>
      </div>
    </DetailPanel>
  );
}
