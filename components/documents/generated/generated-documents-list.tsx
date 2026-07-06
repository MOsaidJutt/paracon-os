"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Eye, FileSpreadsheet, FileText, History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/tenders/format";
import { DocumentPreviewDialog } from "@/components/documents/preview-dialog";
import type { DocumentRow } from "@/components/documents/types";
import { DOCUMENT_TYPE_LABEL, generatedDocumentsQueryParam, type GeneratedDocumentRow, type GeneratedDocumentTarget } from "./types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Issued: "default",
  Withdrawn: "destructive",
  Superseded: "secondary",
};

function fileUrl(fileId: string): string {
  return `/api/documents/stored/${fileId}/url`;
}

type GeneratedDocumentVersionRow = {
  id: string;
  version: number;
  pdfFileId: string | null;
  xlsxFileId: string | null;
  createdAt: string;
};

/** Superseded versions of a regenerated document — still downloadable, so a "Regenerate" never silently loses access to what was previously issued. */
function VersionHistory({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["generated-document-versions", documentId],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/documents/generated/${documentId}/versions`);
      if (!res.ok) throw new Error("Failed to load version history");
      return (await res.json()) as { versions: GeneratedDocumentVersionRow[] };
    },
  });

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <History className="size-3" />
        Version history
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1 border-l border-border pl-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : !data || data.versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No prior versions — this is the first issue.</p>
          ) : (
            data.versions.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">v{v.version}</span>
                <span>{formatDate(v.createdAt)}</span>
                {v.pdfFileId && (
                  <a href={fileUrl(v.pdfFileId)} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">
                    <FileText className="size-3" /> PDF
                  </a>
                )}
                {v.xlsxFileId && (
                  <a href={fileUrl(v.xlsxFileId)} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">
                    <FileSpreadsheet className="size-3" /> Excel
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function asPreviewRow(doc: GeneratedDocumentRow): DocumentRow | null {
  if (!doc.pdfFileId) return null;
  return {
    source: "stored",
    id: doc.pdfFileId,
    name: `${doc.number} — ${DOCUMENT_TYPE_LABEL[doc.type]}`,
    category: "",
    mime: "application/pdf",
    size: null,
    version: doc.version,
    hasPreview: true,
    tags: [],
    driveUrl: null,
    byName: doc.createdBy?.name ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.createdAt,
  };
}

export function GeneratedDocumentsList({
  target,
  onRegenerate,
}: {
  target: GeneratedDocumentTarget;
  onRegenerate?: (doc: GeneratedDocumentRow) => void;
}) {
  const queryClient = useQueryClient();
  const queryParam = generatedDocumentsQueryParam(target);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["generated-documents", target],
    queryFn: async () => {
      const res = await fetch(`/api/documents/generated?${queryParam}`);
      if (!res.ok) throw new Error("Failed to load generated documents");
      return (await res.json()) as { documents: GeneratedDocumentRow[] };
    },
  });

  const { data: docConfig } = useQuery({
    queryKey: ["documents", "config"],
    queryFn: async () => {
      const res = await fetch("/api/documents/config");
      if (!res.ok) throw new Error("Failed to load document config");
      return (await res.json()) as { generatedStatusList: string[] };
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/documents/generated/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update status");
      }
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["generated-documents", target] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-md border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  const documents = data?.documents ?? [];

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-1 py-8 text-center">
          <FileText className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No generated documents yet</p>
          <p className="text-xs text-muted-foreground">
            Use the buttons above to generate a branded PDF + Excel — auto-numbered, stored and versioned here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Generated Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{doc.number}</span>
                  <Badge variant="outline">{DOCUMENT_TYPE_LABEL[doc.type]}</Badge>
                  {doc.version > 1 && <Badge variant="secondary">v{doc.version}</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" disabled={setStatus.isPending}>
                        <Badge variant={STATUS_VARIANT[doc.status] ?? "outline"} className="cursor-pointer">
                          {doc.status}
                        </Badge>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(docConfig?.generatedStatusList ?? []).map((status) => (
                        <DropdownMenuItem
                          key={status}
                          disabled={status === doc.status}
                          onClick={() => setStatus.mutate({ id: doc.id, status })}
                        >
                          Mark as {status}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {doc.createdBy?.name && <span>{doc.createdBy.name}</span>}
                  <span>{formatDate(doc.createdAt)}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {doc.pdfFileId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Preview"
                      onClick={() => setPreviewDoc(asPreviewRow(doc))}
                    >
                      <Eye className="size-4" />
                    </Button>
                  )}
                  {doc.pdfFileId && (
                    <Button variant="ghost" size="icon" className="size-8" asChild title="Download PDF">
                      <a href={fileUrl(doc.pdfFileId)} target="_blank" rel="noreferrer">
                        <FileText className="size-4" />
                      </a>
                    </Button>
                  )}
                  {doc.xlsxFileId && (
                    <Button variant="ghost" size="icon" className="size-8" asChild title="Download Excel">
                      <a href={fileUrl(doc.xlsxFileId)} target="_blank" rel="noreferrer">
                        <FileSpreadsheet className="size-4" />
                      </a>
                    </Button>
                  )}
                  {onRegenerate && (
                    <Button variant="ghost" size="icon" className="size-8" title="Regenerate" onClick={() => onRegenerate(doc)}>
                      <RefreshCw className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              {doc.version > 1 && <VersionHistory documentId={doc.id} />}
            </div>
          ))}
        </CardContent>
      </Card>

      <DocumentPreviewDialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)} doc={previewDoc} />
    </>
  );
}
