"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ZipPlan } from "@/lib/import/importers/document-bulk-zip";

type ImporterSummary = {
  key: string;
  label: string;
  description: string;
  acceptedExtensions: string[];
  requiresExtra: boolean;
};

type StageResult = {
  importJobId: string;
  alreadyImported: boolean;
  importedAt?: string;
  plan: unknown;
  summary: unknown;
};

type ZztakeoffPlan =
  | { stage: "needs-mapping"; headers: string[]; sampleRows: Record<string, unknown>[] }
  | { stage: "ready"; rows: { rowNumber: number; description: string | null; warnings: string[] }[] };

type ColumnMap = { description: string; quantity: string; unit: string; unitRate?: string; amount?: string; remarks?: string };

const REQUIRED_ZZTAKEOFF_FIELDS: { key: keyof ColumnMap; label: string; required: boolean }[] = [
  { key: "description", label: "Description", required: true },
  { key: "quantity", label: "Quantity", required: true },
  { key: "unit", label: "Unit of measure", required: true },
  { key: "unitRate", label: "Unit rate", required: false },
  { key: "amount", label: "Amount", required: false },
  { key: "remarks", label: "Remarks", required: false },
];

function SummaryGrid({ summary }: { summary: unknown }) {
  if (!summary || typeof summary !== "object") return null;
  const entries = Object.entries(summary as Record<string, unknown>).filter(([key]) => key !== "configWarnings");

  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {entries.map(([key, value]) => (
        <span key={key}>
          <span className="text-muted-foreground">{key}: </span>
          <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>
        </span>
      ))}
    </div>
  );
}

export function ImportCentreWizard() {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<StageResult | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<ColumnMap>>({});
  const [targetType, setTargetType] = useState<"project" | "tender">("tender");
  const [targetId, setTargetId] = useState<string>("");
  const [report, setReport] = useState<unknown>(null);

  const { data: importersData } = useQuery({
    queryKey: ["import", "importers"],
    queryFn: async () => {
      const res = await fetch("/api/import");
      if (!res.ok) throw new Error("Failed to load importers");
      return (await res.json()) as { importers: ImporterSummary[] };
    },
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects", "import-targets"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) return { projects: [] as { id: string; name: string }[] };
      return (await res.json()) as { projects: { id: string; name: string }[] };
    },
    enabled: selectedKey === "zztakeoff",
  });

  const { data: tendersData } = useQuery({
    queryKey: ["tenders", "import-targets"],
    queryFn: async () => {
      const res = await fetch("/api/tenders");
      if (!res.ok) return { tenders: [] as { id: string; projectName: string }[] };
      return (await res.json()) as { tenders: { id: string; projectName: string }[] };
    },
    enabled: selectedKey === "zztakeoff",
  });

  const importer = importersData?.importers.find((i) => i.key === selectedKey) ?? null;

  function reset() {
    setFile(null);
    setStage(null);
    setColumnMap({});
    setTargetId("");
    setReport(null);
  }

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file || !selectedKey) throw new Error("Choose a file first");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/import/${selectedKey}/preview`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Preview failed");
      }
      return (await res.json()) as StageResult;
    },
    onSuccess: (result) => {
      setStage(result);
      setReport(result.alreadyImported ? result.summary : null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refineMutation = useMutation({
    mutationFn: async () => {
      if (!stage || !selectedKey) throw new Error("No staged import");
      const extra = {
        columnMap,
        ...(targetType === "project" ? { targetProjectId: targetId } : { targetTenderId: targetId }),
      };
      const res = await fetch(`/api/import/${selectedKey}/preview/${stage.importJobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extra }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to apply column map");
      }
      return (await res.json()) as { plan: unknown; summary: unknown };
    },
    onSuccess: (result) => {
      setStage((prev) => (prev ? { ...prev, plan: result.plan, summary: result.summary } : prev));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!stage || !selectedKey) throw new Error("No staged import");
      const extra =
        selectedKey === "zztakeoff"
          ? { columnMap, ...(targetType === "project" ? { targetProjectId: targetId } : { targetTenderId: targetId }) }
          : undefined;
      const res = await fetch(`/api/import/${selectedKey}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importJobId: stage.importJobId, extra }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Commit failed");
      }
      return (await res.json()) as { report: unknown; alreadyImported: boolean };
    },
    onSuccess: ({ report }) => {
      toast.success("Import committed");
      setReport(report);
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const zztakeoffPlan = useMemo(() => {
    if (selectedKey !== "zztakeoff" || !stage?.plan) return null;
    return stage.plan as ZztakeoffPlan;
  }, [selectedKey, stage]);

  const zipPlan = useMemo(() => {
    if (selectedKey !== "document-bulk-zip" || !stage?.plan) return null;
    return stage.plan as ZipPlan;
  }, [selectedKey, stage]);

  const needsMapping = zztakeoffPlan?.stage === "needs-mapping";
  const mappingComplete = !!columnMap.description && !!columnMap.quantity && !!columnMap.unit && !!targetId;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose an importer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {importersData?.importers.map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => {
                setSelectedKey(i.key);
                reset();
              }}
              className={`rounded-lg border p-3 text-left transition-colors ${
                selectedKey === i.key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              }`}
            >
              <p className="font-medium text-foreground">{i.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">Accepts: {i.acceptedExtensions.join(", ")}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {importer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Upload</CardTitle>
            <CardDescription>Dry-run preview first — nothing is written until you confirm commit.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <input
              aria-label="Choose file to import"
              type="file"
              accept={importer.acceptedExtensions.join(",")}
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                setStage(null);
                setReport(null);
              }}
              className="text-sm"
            />
            <Button size="sm" disabled={!file || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
              <Upload className="size-4" />
              {previewMutation.isPending ? "Uploading..." : "Preview"}
            </Button>
          </CardContent>
        </Card>
      )}

      {stage?.alreadyImported && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-5 text-green-600" />
              Already imported
            </CardTitle>
            <CardDescription>
              This exact file was already committed{stage.importedAt ? ` on ${new Date(stage.importedAt).toLocaleString()}` : ""}.
              Re-running it is a safe no-op.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SummaryGrid summary={stage.summary} />
          </CardContent>
        </Card>
      )}

      {stage && !stage.alreadyImported && needsMapping && zztakeoffPlan?.stage === "needs-mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Map columns &amp; choose a target</CardTitle>
            <CardDescription>
              We don&apos;t assume fixed headers — map your sheet&apos;s columns and pick the project or tender these
              quantities belong to.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {REQUIRED_ZZTAKEOFF_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`column-map-${field.key}`}>
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={columnMap[field.key] ?? ""}
                    onValueChange={(value) => setColumnMap((prev) => ({ ...prev, [field.key]: value }))}
                  >
                    <SelectTrigger id={`column-map-${field.key}`}>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {zztakeoffPlan.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-target-type">Target type</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as "project" | "tender")}>
                  <SelectTrigger id="import-target-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tender">Tender</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-target-id">{targetType === "tender" ? "Tender" : "Project"}</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger id="import-target-id">
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetType === "tender"
                      ? tendersData?.tenders.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.projectName}
                          </SelectItem>
                        ))
                      : projectsData?.projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              size="sm"
              className="w-fit"
              disabled={!mappingComplete || refineMutation.isPending}
              onClick={() => refineMutation.mutate()}
            >
              {refineMutation.isPending ? "Applying..." : "Apply mapping"}
            </Button>
          </CardContent>
        </Card>
      )}

      {stage && !stage.alreadyImported && !needsMapping && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{importer?.requiresExtra ? "4." : "3."} Review &amp; commit</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SummaryGrid summary={stage.summary} />

            {zipPlan && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">File</th>
                      <th className="px-3 py-2 text-left font-medium">Will attach to</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zipPlan.rows.map((row) => (
                      <tr key={row.entryPath} className="border-t border-border">
                        <td className="max-w-xs truncate px-3 py-2 text-foreground" title={row.entryPath}>
                          {row.fileName}
                        </td>
                        <td className="px-3 py-2">
                          {row.matchType === "unmatched" ? (
                            <Badge variant="warning">Unmatched — will be skipped</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {row.matchType === "project" ? "Project" : "Tender"}: {row.matchedName}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {typeof stage.summary === "object" &&
              stage.summary !== null &&
              "configWarnings" in (stage.summary as Record<string, unknown>) &&
              Array.isArray((stage.summary as Record<string, unknown>).configWarnings) &&
              ((stage.summary as Record<string, unknown>).configWarnings as string[]).length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {((stage.summary as Record<string, unknown>).configWarnings as string[]).map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

            <Button className="w-fit" disabled={commitMutation.isPending} onClick={() => commitMutation.mutate()}>
              {commitMutation.isPending ? "Committing..." : "Confirm commit"}
            </Button>
          </CardContent>
        </Card>
      )}

      {report !== null && !stage?.alreadyImported && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-5 text-green-600" />
              Import report
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SummaryGrid summary={report} />
            <Button variant="outline" size="sm" className="w-fit" onClick={reset}>
              Run another import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
