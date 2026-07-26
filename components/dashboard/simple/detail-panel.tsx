"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * The one slide-over shell every simplified-dashboard detail panel uses.
 *
 * The client's rule for this view is that detail arrives beside the page, not
 * instead of it: no card on the dashboard navigates away. A single shell keeps
 * the width, the scroll behaviour and the header shape identical wherever you
 * open one from, which is what makes them feel like the same object rather
 * than five different modals.
 *
 * Wider than the shadcn default (sm:max-w-sm is too narrow for a table of
 * figures) and scrollable, since a project's detail can run past the fold on a
 * laptop. On a phone it fills the width, which is the right call for a panel
 * you read rather than compare against what's behind it.
 */
export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left sm:text-left">
          <SheetTitle className="font-heading text-lg">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
