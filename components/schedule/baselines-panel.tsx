"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/tenders/format";

export type BaselineRow = {
  id: string;
  name: string;
  note: string | null;
  createdAt: string;
  savedBy: { id: string; name: string } | null;
};

export function BaselinesPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const { data } = useQuery({
    queryKey: ["projects", projectId, "baselines"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/baselines`);
      if (!res.ok) throw new Error("Failed to load baselines");
      return (await res.json()) as { baselines: BaselineRow[] };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/baselines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, note: note || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save baseline");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Baseline saved");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "baselines"] });
      setOpen(false);
      setName("");
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (baselineId: string) => {
      const res = await fetch(`/api/projects/${projectId}/baselines/${baselineId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete baseline");
      }
    },
    onSuccess: () => {
      toast.success("Baseline deleted");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "baselines"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const baselines = data?.baselines ?? [];

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Baselines</p>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <BookmarkPlus className="size-3.5" />
                Save as baseline
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Save baseline</DialogTitle>
                <DialogDescription>
                  Snapshots every task&apos;s current dates so you can compare against this original plan later.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="baseline-name">Name</Label>
                  <Input id="baseline-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tender baseline" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="baseline-note">Note (optional)</Label>
                  <Input id="baseline-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!name || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? "Saving..." : "Save baseline"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {baselines.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No baselines saved yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {baselines.map((b) => (
            <li key={b.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-foreground">{b.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatDate(b.createdAt)}
                  {b.savedBy ? ` · ${b.savedBy.name}` : ""}
                </span>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(b.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
