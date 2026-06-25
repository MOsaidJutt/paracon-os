"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBytes, type DocumentRow } from "./types";
import { formatDate } from "@/lib/tenders/format";

type VersionRow = { id: string; version: number; size: number; mime: string; createdAt: string };

export function DocumentVersionsDialog({
  open,
  onOpenChange,
  doc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocumentRow | null;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const { data } = useQuery({
    queryKey: ["documents", "versions", doc?.id],
    queryFn: async () => {
      const res = await fetch(`/api/documents/stored/${doc!.id}/versions`);
      if (!res.ok) throw new Error("Failed to load version history");
      return (await res.json()) as { versions: VersionRow[] };
    },
    enabled: open && !!doc,
  });

  const uploadVersion = useMutation({
    mutationFn: async () => {
      if (!file || !doc) throw new Error("Choose a file first");
      const mime = file.type || "application/octet-stream";

      const upload = await fetch(`/api/documents/stored/${doc.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mime }),
      });
      if (!upload.ok) {
        const body = await upload.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start upload");
      }
      const { key, uploadUrl } = (await upload.json()) as { key: string; uploadUrl: string };

      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      const commit = await fetch(`/api/documents/stored/${doc.id}/versions/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, fileName: file.name, mime, size: file.size }),
      });
      if (!commit.ok) {
        const body = await commit.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to register new version");
      }
      return commit.json();
    },
    onSuccess: () => {
      toast.success("New version uploaded");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "versions", doc?.id] });
      setFile(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Version history — {doc.name}</DialogTitle>
          <DialogDescription>Every previous version stays available; nothing is ever overwritten.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input aria-label="New version file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button size="sm" disabled={!file || uploadVersion.isPending} onClick={() => uploadVersion.mutate()}>
            <UploadCloud className="size-4" />
            {uploadVersion.isPending ? "Uploading..." : "New version"}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge>v{doc.version}</Badge>
              <span className="font-medium text-foreground">Current</span>
            </div>
            <a href={`/api/documents/stored/${doc.id}/url`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
              <Download className="size-4" />
            </a>
          </div>

          {data?.versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">v{v.version}</Badge>
                <span className="text-muted-foreground">
                  {formatBytes(v.size)} · {formatDate(v.createdAt)}
                </span>
              </div>
              <a
                href={`/api/documents/stored/${doc.id}/versions/${v.id}/url`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <Download className="size-4" />
              </a>
            </div>
          ))}

          {data?.versions.length === 0 && <p className="text-sm text-muted-foreground">No earlier versions yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
