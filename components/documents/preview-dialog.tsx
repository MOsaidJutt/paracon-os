"use client";

import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocumentRow } from "./types";

const NON_BROWSER_RENDERABLE_IMAGE_MIME_TYPES = new Set(["image/heic", "image/heif"]);

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  doc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocumentRow | null;
}) {
  if (!doc) return null;

  const isImage = !!doc.mime?.startsWith("image/");
  const isPdf = doc.mime === "application/pdf";
  const needsPreviewVariant = !!doc.mime && NON_BROWSER_RENDERABLE_IMAGE_MIME_TYPES.has(doc.mime);
  const url = `/api/documents/stored/${doc.id}/url${needsPreviewVariant ? "?preview=true" : ""}`;
  const downloadUrl = `/api/documents/stored/${doc.id}/url`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{doc.name}</DialogTitle>
        </DialogHeader>

        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL changes per request, next/image's static optimisation doesn't apply
          <img src={url} alt={doc.name} className="max-h-[70vh] w-full rounded-md object-contain" />
        )}

        {isPdf && <iframe src={downloadUrl} className="h-[75vh] w-full rounded-md border border-border" title={doc.name} />}

        {!isImage && !isPdf && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border py-12 text-center">
            <FileText className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No inline preview available for this file type.</p>
            <Button asChild variant="outline" size="sm">
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                <Download className="size-4" />
                Download to view
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
