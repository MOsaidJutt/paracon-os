"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentTarget } from "./types";

export function LinkedDocumentDialog({
  open,
  onOpenChange,
  target,
  kinds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Exclude<DocumentTarget, { workerId: string }>;
  kinds: string[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [kind, setKind] = useState(kinds[0] ?? "Other");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/documents/linked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, driveUrl, kind, ...target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add linked document");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Drive link added");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setName("");
      setDriveUrl("");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Google Drive link</DialogTitle>
          <DialogDescription>
            For large CAD/drawing sets that stay in Drive — this saves a link + metadata only, never a copy of
            the file. It shows up and is searchable here exactly like an uploaded document; clicking opens it in Drive.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-doc-name">Name</Label>
            <Input id="link-doc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Architectural Drawing Set" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-doc-url">Google Drive URL</Label>
            <Input
              id="link-doc-url"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-doc-kind">Kind</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="link-doc-kind">
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!name || !driveUrl || mutation.isPending} onClick={() => mutation.mutate()}>
            <Link2 className="size-4" />
            {mutation.isPending ? "Saving..." : "Add link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
