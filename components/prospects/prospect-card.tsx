"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, CalendarClock, ChevronRight, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import { nextActionState } from "@/lib/prospects/summary";
import type { ProspectRow } from "./types";

const NEXT_ACTION_CLASS = {
  overdue: "text-rag-red",
  today: "text-rag-amber",
  upcoming: "text-muted-foreground",
  none: "text-muted-foreground",
} as const;

/**
 * One lead on the board.
 *
 * The whole card opens the detail panel; the drag handle and the primary
 * action are separate targets inside it. Making the entire card draggable
 * would mean a tap on a phone is ambiguous between "open this" and "start
 * dragging", and on the board the common action is opening.
 */
export function ProspectCard({
  prospect,
  onOpen,
  onAdvance,
  onConvert,
  advanceLabel,
  canEdit,
}: {
  prospect: ProspectRow;
  onOpen: () => void;
  onAdvance?: () => void;
  onConvert?: () => void;
  /** e.g. "Move to Warm" — absent when there is no later stage to move to. */
  advanceLabel?: string;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: prospect.id,
    disabled: !canEdit || prospect.convertedTenderId !== null,
  });

  const due = nextActionState(prospect.nextActionDate);
  const isConverted = prospect.convertedTenderId !== null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "rounded-lg border border-border bg-card p-3 transition-shadow",
        isDragging && "z-10 opacity-90 shadow-lg"
      )}
    >
      <div className="flex items-start gap-1.5">
        {canEdit && !isConverted && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag ${prospect.name} to another stage`}
            className="-ml-1 mt-0.5 flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpen}
          // Named explicitly rather than left to its text content: a screen
          // reader would otherwise announce the whole card — name, contact,
          // value, probability and next action — as one run-on label.
          aria-label={`Open ${prospect.name}`}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{prospect.name}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </span>

          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {prospect.contactName || "No contact"}
            {prospect.estimatedValue != null && ` · ${formatCurrency(prospect.estimatedValue)}`}
            {prospect.probability != null && ` · ${prospect.probability}%`}
          </span>

          {prospect.nextAction && (
            <span className={cn("mt-1.5 flex items-center gap-1 text-xs", NEXT_ACTION_CLASS[due])}>
              <CalendarClock className="size-3.5 shrink-0" />
              <span className="truncate">
                {prospect.nextAction}
                {prospect.nextActionDate && ` · ${due === "today" ? "today" : formatDate(prospect.nextActionDate)}`}
              </span>
            </span>
          )}
        </button>
      </div>

      {isConverted ? (
        <Badge variant="outline" className="mt-2 max-w-full gap-1">
          <span className="shrink-0">Converted</span>
          <ArrowRight className="size-3 shrink-0" />
          <span className="truncate">{prospect.convertedTender?.projectName ?? "tender"}</span>
        </Badge>
      ) : (
        canEdit && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/* Both actions name the lead they act on. A board full of bare
                "Convert" buttons is unusable with a screen reader, and
                ambiguous for anyone driving by keyboard. */}
            {onConvert && (
              <Button
                size="sm"
                className="h-9"
                onClick={onConvert}
                aria-label={`Convert ${prospect.name} to a tender`}
              >
                Convert
                <ArrowRight className="size-3.5" />
              </Button>
            )}
            {onAdvance && advanceLabel && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={onAdvance}
                aria-label={`${advanceLabel}: ${prospect.name}`}
              >
                {advanceLabel}
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
