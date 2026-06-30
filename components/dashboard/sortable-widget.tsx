"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wraps a dashboard card with a drag handle + visibility toggle while in customize mode; renders the card unchanged otherwise. */
export function SortableWidget({
  id,
  editing,
  visible,
  onToggleVisible,
  className,
  children,
}: {
  id: string;
  editing: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  className?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (!editing && !visible) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-widget-id={id}
      className={cn(className, isDragging && "z-10 opacity-90", editing && !visible && "opacity-50")}
    >
      <div className={cn("flex h-full flex-col", editing && "rounded-lg ring-1 ring-border")}>
        {editing && (
          <div className="flex items-center justify-between rounded-t-lg border-b border-border bg-muted/60 px-2 py-1">
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
              className="flex size-8 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </button>
            <button
              type="button"
              onClick={onToggleVisible}
              aria-label={visible ? "Hide widget" : "Show widget"}
              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
        )}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
