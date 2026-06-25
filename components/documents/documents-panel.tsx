"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, ExternalLink, History, Link2, Trash2, UploadCloud, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/tenders/format";
import { UploadDocumentDialog } from "./upload-dialog";
import { LinkedDocumentDialog } from "./link-dialog";
import { DocumentPreviewDialog } from "./preview-dialog";
import { DocumentVersionsDialog } from "./versions-dialog";
import { formatBytes, targetCategoryList, targetQueryParam, type DocumentConfig, type DocumentRow, type DocumentTarget } from "./types";

function DocumentIcon({ doc }: { doc: DocumentRow }) {
  if (doc.source === "linked") return <ExternalLink className="size-4 text-muted-foreground" />;
  if (doc.mime?.startsWith("image/")) return <ImageIcon className="size-4 text-muted-foreground" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

function DocumentRowItem({
  doc,
  canEdit,
  onPreview,
  onVersions,
  onDelete,
}: {
  doc: DocumentRow;
  canEdit: boolean;
  onPreview: () => void;
  onVersions: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
      <button
        type="button"
        onClick={doc.source === "stored" ? onPreview : () => window.open(doc.driveUrl ?? "#", "_blank")}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <DocumentIcon doc={doc} />
        <span className="truncate font-medium text-foreground">{doc.name}</span>
        {doc.source === "stored" && doc.version && doc.version > 1 && <Badge variant="secondary">v{doc.version}</Badge>}
        {doc.source === "linked" && <Badge variant="outline">Drive link</Badge>}
      </button>

      <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
        {doc.source === "stored" && <span>{formatBytes(doc.size)}</span>}
        {doc.byName && <span>{doc.byName}</span>}
        <span>{formatDate(doc.createdAt)}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {doc.source === "stored" ? (
          <>
            <Button variant="ghost" size="icon" className="size-8" onClick={onPreview} title="Preview">
              <Eye className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={onVersions} title="Version history">
              <History className="size-4" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" className="size-8" asChild title="Open in Drive">
            <a href={doc.driveUrl ?? "#"} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        {canEdit && (
          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={onDelete} title="Delete">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function DocumentsPanel({ target, canEdit = true }: { target: DocumentTarget; canEdit?: boolean }) {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [versionsDocId, setVersionsDocId] = useState<string | null>(null);

  const queryParam = targetQueryParam(target);

  const { data: config } = useQuery({
    queryKey: ["documents", "config"],
    queryFn: async () => {
      const res = await fetch("/api/documents/config");
      if (!res.ok) throw new Error("Failed to load document config");
      return (await res.json()) as DocumentConfig;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["documents", target],
    queryFn: async () => {
      const res = await fetch(`/api/documents?${queryParam}`);
      if (!res.ok) throw new Error("Failed to load documents");
      return (await res.json()) as { documents: DocumentRow[] };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      const url = doc.source === "stored" ? `/api/documents/stored/${doc.id}` : `/api/documents/linked/${doc.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete document");
      }
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const categories = useMemo(() => (config ? targetCategoryList(target, config) : []), [config, target]);

  const documentsByCategory = useMemo(() => {
    const map = new Map<string, DocumentRow[]>();
    for (const category of categories) map.set(category, []);
    for (const doc of data?.documents ?? []) {
      const bucket = map.get(doc.category) ?? map.get("General") ?? [];
      bucket.push(doc);
      if (!map.has(doc.category)) map.set("General", bucket);
    }
    return map;
  }, [categories, data]);

  const canLink = "workerId" in target === false;

  // Looked up by id each render (rather than snapshotting the doc object at
  // click time) so the open dialog reflects the new version number / preview
  // immediately after an upload invalidates the documents query.
  const previewDoc = previewDocId ? data?.documents.find((d) => d.id === previewDocId) ?? null : null;
  const versionsDoc = versionsDocId ? data?.documents.find((d) => d.id === versionsDocId && d.source === "stored") ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Documents</h2>
        {canEdit && (
          <div className="flex gap-2">
            {canLink && (
              <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                <Link2 className="size-4" />
                Add Drive link
              </Button>
            )}
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <UploadCloud className="size-4" />
              Upload
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading documents...</p>}

      {!isLoading &&
        Array.from(documentsByCategory.entries()).map(([category, docs]) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                {category}
                <span className="text-xs font-normal text-muted-foreground">{docs.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {docs.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                docs.map((doc) => (
                  <DocumentRowItem
                    key={`${doc.source}-${doc.id}`}
                    doc={doc}
                    canEdit={canEdit}
                    onPreview={() => setPreviewDocId(doc.id)}
                    onVersions={() => setVersionsDocId(doc.id)}
                    onDelete={() => {
                      if (window.confirm(`Delete "${doc.name}"? This can't be undone.`)) deleteMutation.mutate(doc);
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        target={target}
        categories={categories.length > 0 ? categories : ["General"]}
      />
      {canLink && (
        <LinkedDocumentDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          target={target as Exclude<DocumentTarget, { workerId: string }>}
          kinds={config?.linkedKindList ?? ["Other"]}
        />
      )}
      <DocumentPreviewDialog open={!!previewDocId} onOpenChange={(open) => !open && setPreviewDocId(null)} doc={previewDoc} />
      <DocumentVersionsDialog open={!!versionsDocId} onOpenChange={(open) => !open && setVersionsDocId(null)} doc={versionsDoc} />
    </div>
  );
}
