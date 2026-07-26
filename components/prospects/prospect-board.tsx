"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/tenders/format";
import { ProspectCard } from "./prospect-card";
import type { ProspectRow } from "./types";

/** A stage lane, or the derived Converted lane at the end. */
function Lane({
  id,
  title,
  count,
  value,
  droppable,
  children,
}: {
  id: string;
  title: string;
  count: number;
  value?: number;
  droppable: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable });

  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-transparent p-2 transition-colors",
        isOver && "border-dashed border-brass bg-brass/5"
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title} <span className="tabular-nums">· {count}</span>
        </h2>
        {value != null && value > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatCurrency(value)}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/**
 * Leads as lanes, cold through warm, with converted leads parked at the end.
 *
 * Lanes come from the admin-editable stage list, so adding a stage adds a lane
 * with no code change. "Converted" is deliberately NOT a stage — it's derived
 * from carrying a tender id, because whether a lead has become a tender is a
 * fact about the data, not a label someone can rename.
 *
 * Dragging is the desktop affordance; every card also carries a plain button
 * that does the same thing, because dragging inside a scrolling column on a
 * phone fights the scroll.
 */
export function ProspectBoard({
  prospects,
  stageList,
  canEdit,
  onOpen,
  onMove,
  onConvert,
}: {
  prospects: ProspectRow[];
  stageList: string[];
  canEdit: boolean;
  onOpen: (prospect: ProspectRow) => void;
  onMove: (prospect: ProspectRow, stage: string) => void;
  onConvert: (prospect: ProspectRow) => void;
}) {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a tap on the handle still
    // registers as a tap.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  const open = prospects.filter((p) => p.convertedTenderId === null);
  const converted = prospects.filter((p) => p.convertedTenderId !== null);
  const lastStage = stageList[stageList.length - 1];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const prospect = prospects.find((p) => p.id === active.id);
    const stage = String(over.id);
    if (!prospect || prospect.stage === stage || !stageList.includes(stage)) return;

    onMove(prospect, stage);
  }

  if (prospects.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <EmptyState
            title="No leads yet"
            description="Add a prospect to start tracking it from cold through to a tender."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {stageList.map((stage, index) => {
          const inStage = open.filter((p) => p.stage === stage);
          const nextStage = stageList[index + 1];

          return (
            <Lane
              key={stage}
              id={stage}
              title={stage}
              count={inStage.length}
              value={inStage.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0)}
              droppable={canEdit}
            >
              {inStage.map((prospect) => (
                <ProspectCard
                  key={prospect.id}
                  prospect={prospect}
                  canEdit={canEdit}
                  onOpen={() => onOpen(prospect)}
                  onAdvance={nextStage ? () => onMove(prospect, nextStage) : undefined}
                  advanceLabel={nextStage ? `Move to ${nextStage}` : undefined}
                  // Only the final stage offers Convert: a cold lead becoming a
                  // tender in one click would skip the qualification the board
                  // exists to track.
                  onConvert={stage === lastStage ? () => onConvert(prospect) : undefined}
                />
              ))}
              {inStage.length === 0 && (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  Nothing {stage.toLowerCase()}
                </p>
              )}
            </Lane>
          );
        })}

        {converted.length > 0 && (
          <Lane id="__converted" title="Converted" count={converted.length} droppable={false}>
            {converted.map((prospect) => (
              <ProspectCard
                key={prospect.id}
                prospect={prospect}
                canEdit={canEdit}
                onOpen={() => onOpen(prospect)}
              />
            ))}
          </Lane>
        )}
      </div>
    </DndContext>
  );
}
