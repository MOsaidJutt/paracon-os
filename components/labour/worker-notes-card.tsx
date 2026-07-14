"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, NotebookPen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Free-text notes on a worker — collapsed by default so it doesn't crowd the profile when empty, expands to an editable textarea. */
export function WorkerNotesCard({ workerId, notes }: { workerId: string; notes: string | null }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(!!notes);
  const [draft, setDraft] = useState(notes ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Notes saved");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="sm:col-span-2">
      <CardContent className="pt-4">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground">
            <span className="flex items-center gap-1.5">
              <NotebookPen className="size-4 text-muted-foreground" />
              Notes
              {!open && notes && <span className="font-normal text-muted-foreground">— {notes.slice(0, 60)}{notes.length > 60 ? "…" : ""}</span>}
            </span>
            {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <Textarea
              rows={4}
              placeholder="Visas, preferences, past incidents — anything worth remembering about this worker."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button size="sm" className="mt-2" disabled={mutation.isPending || draft === (notes ?? "")} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving..." : "Save notes"}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
