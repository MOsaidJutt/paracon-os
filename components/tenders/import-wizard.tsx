"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PreviewRow = { action: "create" | "update" | "skip"; warnings: string[] };
type TenderPreviewRow = PreviewRow & { rowNumber: number; projectName: string; clientName: string };
type ClientPreviewRow = PreviewRow & { name: string };
type SupplierPreviewRow = PreviewRow & { company: string; trade: string };

type PreviewResponse = {
  clients: ClientPreviewRow[];
  suppliers: SupplierPreviewRow[];
  tenders: TenderPreviewRow[];
  configWarnings: string[];
  summary: {
    clients: { create: number; update: number };
    suppliers: { create: number; update: number };
    tenders: { create: number; update: number; skip: number };
  };
};

type CommitReport = {
  report: {
    clients: { created: number; updated: number };
    suppliers: { created: number; updated: number };
    tenders: { created: number; updated: number; skipped: number };
  };
};

export function ImportWizard() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [report, setReport] = useState<CommitReport["report"] | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/tenders/import/preview", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to preview import");
      }
      return (await res.json()) as PreviewResponse;
    },
    onSuccess: (data) => {
      setPreview(data);
      setReport(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/tenders/import/commit", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to import");
      }
      return (await res.json()) as CommitReport;
    },
    onSuccess: ({ report }) => {
      toast.success("Import complete");
      setReport(report);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rowsWithWarnings = preview ? preview.tenders.filter((t) => t.warnings.length > 0) : [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Tender Tracker (.xlsx)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Upload the workbook (Tender Register new / Client Directory / Supplier Directory sheets). You&apos;ll see a
            dry-run preview of what will be created or updated before anything is written.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                setPreview(null);
                setReport(null);
                if (selected) previewMutation.mutate(selected);
              }}
              className="text-sm"
            />
            {previewMutation.isPending && <span className="text-sm text-muted-foreground">Parsing...</span>}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dry-run preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Clients: <strong>{preview.summary.clients.create}</strong> new,{" "}
                <strong>{preview.summary.clients.update}</strong> updated
              </span>
              <span>
                Suppliers: <strong>{preview.summary.suppliers.create}</strong> new,{" "}
                <strong>{preview.summary.suppliers.update}</strong> updated
              </span>
              <span>
                Tenders: <strong>{preview.summary.tenders.create}</strong> new,{" "}
                <strong>{preview.summary.tenders.update}</strong> updated,{" "}
                <strong>{preview.summary.tenders.skip}</strong> skipped
              </span>
            </div>

            {preview.configWarnings.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-rag-amber/40 bg-rag-amber/15 p-3 text-sm text-foreground">
                {preview.configWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {rowsWithWarnings.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Row warnings ({rowsWithWarnings.length})</p>
                <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
                  {rowsWithWarnings.map((row) => (
                    <div key={row.rowNumber} className="text-sm">
                      <span className="font-medium text-foreground">
                        Row {row.rowNumber} ({row.projectName}){" "}
                      </span>
                      <Badge variant={row.action === "skip" ? "destructive" : "secondary"} className="ml-1">
                        {row.action}
                      </Badge>
                      <ul className="ml-4 list-disc text-muted-foreground">
                        {row.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending} className="w-fit">
              <Upload className="size-4" />
              {commitMutation.isPending ? "Importing..." : "Confirm import"}
            </Button>
          </CardContent>
        </Card>
      )}

      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-5 text-rag-green" />
              Import report
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              Clients: {report.clients.created} created, {report.clients.updated} updated
            </p>
            <p>
              Suppliers: {report.suppliers.created} created, {report.suppliers.updated} updated
            </p>
            <p>
              Tenders: {report.tenders.created} created, {report.tenders.updated} updated, {report.tenders.skipped} skipped
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
