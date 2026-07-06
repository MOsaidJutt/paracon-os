"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns3, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { WidgetState } from "@/lib/dashboard/widget-registry";

function SortableRow({
  id,
  title,
  visible,
  onToggle,
}: {
  id: string;
  title: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 rounded-md px-1.5 py-1", isDragging && "z-10 bg-muted")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${title}`}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <span className="flex-1 text-sm text-foreground">{title}</span>
      <Switch checked={visible} onCheckedChange={onToggle} aria-label={`Show ${title} column`} />
    </div>
  );
}

/**
 * Xero-style column show/hide + drag-to-reorder for a register table,
 * persisted per user via useColumnPreferences. Reusable across any table —
 * only needs a title lookup and the current WidgetState[] order.
 */
export function ColumnVisibilityMenu({
  titleById,
  columns,
  onToggle,
  onReorder,
}: {
  titleById: Record<string, string>;
  columns: WidgetState[];
  onToggle: (id: string) => void;
  onReorder: (next: WidgetState[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(columns, oldIndex, newIndex));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="size-4" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="mb-2 px-1.5 text-xs font-medium text-muted-foreground">Show / reorder columns</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5">
              {columns.map((c) => (
                <SortableRow key={c.id} id={c.id} title={titleById[c.id] ?? c.id} visible={c.visible} onToggle={() => onToggle(c.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}
