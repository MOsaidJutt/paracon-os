"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderOpen, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadGooglePicker } from "@/lib/google-drive/picker-loader";
import type { PickerDocument, PickerResponse } from "@/lib/google-drive/picker-types";
import type { DocumentTarget } from "./types";

type RegisteredDocument = {
  driveFileId: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink: string;
  thumbnailLink: string | null;
};

async function registerDriveFile(
  target: Exclude<DocumentTarget, { workerId: string }>,
  kind: string,
  source: "upload" | "picker",
  doc: RegisteredDocument
) {
  const res = await fetch("/api/documents/drive/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...target,
      kind,
      source,
      driveFileId: doc.driveFileId,
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.size,
      webViewLink: doc.webViewLink,
      thumbnailLink: doc.thumbnailLink,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to save the Drive document");
  }
  return res.json();
}

export function DriveDialog({
  open,
  onOpenChange,
  target,
  kinds,
  onUseManualLink,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Exclude<DocumentTarget, { workerId: string }>;
  kinds: string[];
  /** Falls back to pasting a raw URL — for an external share Picker can't browse (the org doesn't own the Drive account it lives in). */
  onUseManualLink: () => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState(kinds[0] ?? "Other");

  function onSaved() {
    toast.success("Saved to Google Drive");
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    setFile(null);
    onOpenChange(false);
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      const mimeType = file.type || "application/octet-stream";

      const sessionRes = await fetch("/api/documents/drive/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, fileName: file.name, mimeType }),
      });
      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start the Drive upload");
      }
      const { uploadUrl } = (await sessionRes.json()) as { uploadUrl: string };

      // Browser uploads the bytes straight to Google — our server never sees them.
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
      if (!putRes.ok) throw new Error("Upload to Google Drive failed");
      const uploaded = (await putRes.json()) as {
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        webViewLink: string;
        thumbnailLink?: string;
      };

      return registerDriveFile(target, kind, "upload", {
        driveFileId: uploaded.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        size: uploaded.size ? Number(uploaded.size) : file.size,
        webViewLink: uploaded.webViewLink,
        thumbnailLink: uploaded.thumbnailLink ?? null,
      });
    },
    onSuccess: onSaved,
    onError: (error: Error) => toast.error(error.message),
  });

  const browseMutation = useMutation({
    mutationFn: async () => {
      const tokenRes = await fetch("/api/documents/drive/picker-token", { method: "POST" });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to open Google Drive");
      }
      const { accessToken, apiKey } = (await tokenRes.json()) as { accessToken: string; apiKey: string };

      await loadGooglePicker();
      const picked = await new Promise<PickerDocument | null>((resolve, reject) => {
        const google = window.google;
        if (!google) {
          reject(new Error("Google Picker failed to load"));
          return;
        }
        const view = new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true);
        const picker = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setDeveloperKey(apiKey)
          .setCallback((response: PickerResponse) => {
            if (response.action === google.picker.Action.PICKED && response.docs?.[0]) {
              resolve(response.docs[0]);
            } else if (response.action === google.picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();
        picker.setVisible(true);
      });

      if (!picked) return null;
      return registerDriveFile(target, kind, "picker", {
        driveFileId: picked.id,
        name: picked.name,
        mimeType: picked.mimeType,
        size: picked.sizeBytes ?? null,
        webViewLink: picked.url,
        thumbnailLink: picked.iconUrl ?? null,
      });
    },
    onSuccess: (result) => {
      if (result) onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Google Drive</DialogTitle>
          <DialogDescription>
            For large CAD/drawing sets too big for our own storage. Upload a new file straight to this org&apos;s Drive
            folder, or browse Drive to link a file you already have there — both open with one click from here, no
            folder-hunting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drive-doc-kind">Kind</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="drive-doc-kind">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drive-doc-file">Upload a new file</Label>
            <div className="flex items-center gap-2">
              <Input id="drive-doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button size="sm" disabled={!file || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
                <UploadCloud className="size-4" />
                {uploadMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" disabled={browseMutation.isPending} onClick={() => browseMutation.mutate()}>
            <FolderOpen className="size-4" />
            {browseMutation.isPending ? "Opening Drive..." : "Browse Drive"}
          </Button>

          <button
            type="button"
            className="text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={onUseManualLink}
          >
            Or paste an existing Drive link instead (for a file outside this org&apos;s connected account)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
