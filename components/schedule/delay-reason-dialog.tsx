"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/tenders/format";

export type DownstreamImpactedRow = {
  activityId: string;
  name: string;
  previousStartDate: string;
  previousEndDate: string;
  newStartDate: string;
  newEndDate: string;
};

export type CrossProjectImpactRow = {
  workerId: string;
  workerName: string;
  otherProjectId: string;
  otherProjectName: string;
  conflictWeeks: string[];
};

export function DelayReasonDialog({
  open,
  onOpenChange,
  taskName,
  previousEndDate,
  newEndDate,
  downstreamImpacted,
  crossProjectImpact,
  reasonOptions,
  onConfirm,
  onCancel,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  previousEndDate: string;
  newEndDate: string;
  downstreamImpacted: DownstreamImpactedRow[];
  crossProjectImpact: CrossProjectImpactRow[];
  reasonOptions: string[];
  onConfirm: (reason: string, note: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setReason(null);
      setNote("");
    }
  }, [open]);

  const deltaDays = Math.round(
    (new Date(newEndDate).getTime() - new Date(previousEndDate).getTime()) / 86_400_000
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reason for delay required</DialogTitle>
          <DialogDescription>Select a reason to confirm the new date.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-foreground">{taskName}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(previousEndDate)}</span>
              <span>→</span>
              <span className="font-medium text-foreground">{formatDate(newEndDate)}</span>
              <span className="rounded-full bg-rag-amber/15 px-1.5 py-0.5 font-medium text-rag-amber">
                {deltaDays > 0 ? `+${deltaDays} day${deltaDays === 1 ? "" : "s"}` : `${deltaDays} days`}
              </span>
            </div>
          </div>

          {downstreamImpacted.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-rag-amber/30 bg-rag-amber/10 p-3 text-sm text-rag-amber">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {downstreamImpacted.length} downstream task{downstreamImpacted.length === 1 ? "" : "s"} impacted
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                  {downstreamImpacted.map((d) => (
                    <li key={d.activityId}>
                      {d.name}: {formatDate(d.previousEndDate)} → {formatDate(d.newEndDate)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {crossProjectImpact.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-rag-red/30 bg-rag-red/10 p-3 text-sm text-rag-red">
              <Users className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {crossProjectImpact.length} crew conflict{crossProjectImpact.length === 1 ? "" : "s"} on other projects
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                  {crossProjectImpact.map((c) => (
                    <li key={`${c.workerId}-${c.otherProjectId}`}>
                      {c.workerName} is also booked on {c.otherProjectName} for{" "}
                      {c.conflictWeeks.length} week{c.conflictWeeks.length === 1 ? "" : "s"} this delay now needs them here
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>
              Reason <span className="text-rag-red">*</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {reasonOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReason(option)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    reason === option
                      ? "border-brass-deep bg-brass-deep text-white"
                      : "border-border text-muted-foreground hover:border-brass-deep/50"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="delay-note">Note (optional)</Label>
            <Textarea
              id="delay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for this delay..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button disabled={!reason || isSaving} onClick={() => reason && onConfirm(reason, note)}>
            {isSaving ? "Saving..." : "Save new date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
