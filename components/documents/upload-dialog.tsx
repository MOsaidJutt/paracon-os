"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentTarget } from "./types";

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  txt: "text/plain",
  eml: "message/rfc822",
};

const KNOWN_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

/** Browsers sometimes report no/wrong MIME for less common types (.heic, .eml) — fall back to extension. */
function resolveMime(file: File): string {
  if (file.type && KNOWN_MIME_TYPES.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? (file.type || "application/octet-stream");
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  target,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DocumentTarget;
  categories: string[];
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(categories[0] ?? "General");
  const [tagsInput, setTagsInput] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      const mime = resolveMime(file);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const upload = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mime, size: file.size, category, tags, ...target }),
      });
      if (!upload.ok) {
        const body = await upload.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start upload");
      }
      const { key, uploadUrl } = (await upload.json()) as { key: string; uploadUrl: string };

      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      const register = await fetch("/api/documents/stored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, fileName: file.name, mime, size: file.size, category, tags, ...target }),
      });
      if (!register.ok) {
        const body = await register.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to register document");
      }
      return register.json();
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setFile(null);
      setTagsInput("");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>Stored in our own storage — versioned, signed read URLs, no folder hunting.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-doc-file">File</Label>
            <Input id="upload-doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-doc-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="upload-doc-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-doc-tags">Tags (comma separated, optional)</Label>
            <Input
              id="upload-doc-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="urgent, client-facing"
            />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
            <UploadCloud className="size-4" />
            {mutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
