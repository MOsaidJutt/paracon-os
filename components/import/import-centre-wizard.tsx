"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
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

type ContactsColumnMap = {
  name: string;
  trade?: string;
  status?: string;
  address?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  comments?: string;
};

type ContactsPlan =
  | { stage: "needs-mapping"; headers: string[]; sampleRows: Record<string, unknown>[] }
  | {
      stage: "ready";
      contactType: "client" | "supplier";
      rows: { rowNumber: number; action: "create" | "update" | "skip"; name: string | null; warnings: string[] }[];
    };

// Mirrors lib/tenders/import.ts's ImportPlan — only the fields the table below renders.
type TenderTrackerPlan = {
  tenders: { rowNumber: number; action: "create" | "update" | "skip"; projectName: string; clientName: string; warnings: string[] }[];
};

const REQUIRED_ZZTAKEOFF_FIELDS: { key: keyof ColumnMap; label: string; required: boolean }[] = [
  { key: "description", label: "Description", required: true },
  { key: "quantity", label: "Quantity", required: true },
  { key: "unit", label: "Unit of measure", required: true },
  { key: "unitRate", label: "Unit rate", required: false },
  { key: "amount", label: "Amount", required: false },
  { key: "remarks", label: "Remarks", required: false },
];

function contactsFieldsFor(
  contactType: "client" | "supplier"
): { key: keyof ContactsColumnMap; label: string; required: boolean }[] {
  if (contactType === "supplier") {
    return [
      { key: "name", label: "Company", required: true },
      { key: "trade", label: "Trade", required: true },
      { key: "contactName", label: "Contact name", required: false },
      { key: "email", label: "Email", required: false },
      { key: "phone", label: "Phone", required: false },
      { key: "comments", label: "Comments", required: false },
    ];
  }
  return [
    { key: "name", label: "Client name", required: true },
    { key: "status", label: "Status", required: false },
    { key: "address", label: "Address", required: false },
    { key: "contactName", label: "Primary contact name", required: false },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "mobile", label: "Mobile", required: false },
  ];
}

// Shown before upload so the v9-Tender-Tracker-style "what exactly does this file need to look like" question never has to be answered by guessing from an error message.
const EXPECTED_STRUCTURE: Record<string, string> = {
  "tender-tracker":
    "An .xlsx workbook with 3 sheets, named exactly: \"Tender Register new\", \"Client Directory\", \"Supplier Directory\". Each sheet's first non-blank row is its header row. Required tender columns: Project Name, Status, Client. Required client column: Client. Required supplier columns: Trades, Company.",
  contacts:
    "Any .xlsx/.xls/.csv export — columns are mapped to our fields after upload, so there's no fixed header requirement. You'll need at minimum a name/company column (and a trade column if importing suppliers/subcontractors).",
  "document-bulk-zip":
    "A .zip export (e.g. from a Dropbox or Google Drive folder). Each file's enclosing folder name or file name should match an existing project or tender name exactly — files that don't match anything are listed as unmatched and skipped, never silently dropped.",
  zztakeoff:
    "Any Excel/CSV export with a single header row — columns are mapped to Description/Quantity/Unit/Unit rate/Amount/Remarks after upload, so there's no fixed header requirement.",
};

const HAS_SAMPLE = new Set(["tender-tracker"]);

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

function RowActionBadge({ action }: { action: "create" | "update" | "skip" }) {
  if (action === "skip") return <Badge variant="warning">Skipped</Badge>;
  return <Badge variant="secondary">{action === "create" ? "New" : "Update"}</Badge>;
}

export function ImportCentreWizard() {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<StageResult | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<ColumnMap & ContactsColumnMap>>({});
  const [targetType, setTargetType] = useState<"project" | "tender">("tender");
  const [targetId, setTargetId] = useState<string>("");
  const [contactType, setContactType] = useState<"client" | "supplier">("client");
  const [supplierKind, setSupplierKind] = useState<"Supplier" | "Subcontractor">("Supplier");
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
    setContactType("client");
    setSupplierKind("Supplier");
    setReport(null);
  }

  function buildExtra(): Record<string, unknown> {
    if (selectedKey === "zztakeoff") {
      return { columnMap, ...(targetType === "project" ? { targetProjectId: targetId } : { targetTenderId: targetId }) };
    }
    if (selectedKey === "contacts") {
      return { columnMap, contactType, ...(contactType === "supplier" ? { supplierKind } : {}) };
    }
    return {};
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
      const res = await fetch(`/api/import/${selectedKey}/preview/${stage.importJobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extra: buildExtra() }),
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
      const extra = importer?.requiresExtra ? buildExtra() : undefined;
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

  const contactsPlan = useMemo(() => {
    if (selectedKey !== "contacts" || !stage?.plan) return null;
    return stage.plan as ContactsPlan;
  }, [selectedKey, stage]);

  const zipPlan = useMemo(() => {
    if (selectedKey !== "document-bulk-zip" || !stage?.plan) return null;
    return stage.plan as ZipPlan;
  }, [selectedKey, stage]);

  const tenderTrackerPlan = useMemo(() => {
    if (selectedKey !== "tender-tracker" || !stage?.plan) return null;
    return stage.plan as TenderTrackerPlan;
  }, [selectedKey, stage]);

  const needsMapping = zztakeoffPlan?.stage === "needs-mapping" || contactsPlan?.stage === "needs-mapping";

  const mappingComplete =
    selectedKey === "zztakeoff"
      ? !!columnMap.description && !!columnMap.quantity && !!columnMap.unit && !!targetId
      : selectedKey === "contacts"
        ? !!columnMap.name && (contactType !== "supplier" || !!columnMap.trade)
        : false;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose an importer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
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
            <CardTitle className="text-base">2. Expected file structure</CardTitle>
            <CardDescription>Check this before uploading — it&apos;s the exact shape this importer expects.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-foreground">{EXPECTED_STRUCTURE[importer.key]}</p>
            {HAS_SAMPLE.has(importer.key) && (
              <Button variant="outline" size="sm" className="w-fit" asChild>
                <a href={`/api/import/${importer.key}/sample`} download>
                  <Download className="size-4" />
                  Download a sample file
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {importer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Upload</CardTitle>
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
              <CheckCircle2 className="size-5 text-rag-green" />
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

      {stage && !stage.alreadyImported && needsMapping && selectedKey === "zztakeoff" && zztakeoffPlan?.stage === "needs-mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Map columns &amp; choose a target</CardTitle>
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

      {stage && !stage.alreadyImported && needsMapping && selectedKey === "contacts" && contactsPlan?.stage === "needs-mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Choose a type &amp; map columns</CardTitle>
            <CardDescription>Pick whether this file is clients or suppliers/subcontractors, then map your columns.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contacts-type">This file is</Label>
                <Select
                  value={contactType}
                  onValueChange={(v) => {
                    setContactType(v as "client" | "supplier");
                    setColumnMap({});
                  }}
                >
                  <SelectTrigger id="contacts-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Clients</SelectItem>
                    <SelectItem value="supplier">Suppliers / Subcontractors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {contactType === "supplier" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contacts-kind">Record as</Label>
                  <Select value={supplierKind} onValueChange={(v) => setSupplierKind(v as "Supplier" | "Subcontractor")}>
                    <SelectTrigger id="contacts-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Supplier">Supplier</SelectItem>
                      <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {contactsFieldsFor(contactType).map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`contacts-column-map-${field.key}`}>
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={columnMap[field.key] ?? ""}
                    onValueChange={(value) => setColumnMap((prev) => ({ ...prev, [field.key]: value }))}
                  >
                    <SelectTrigger id={`contacts-column-map-${field.key}`}>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {contactsPlan.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
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
            <CardTitle className="text-base">{importer?.requiresExtra ? "5." : "4."} Review &amp; commit</CardTitle>
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

            {tenderTrackerPlan && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Row</th>
                      <th className="px-3 py-2 text-left font-medium">Project</th>
                      <th className="px-3 py-2 text-left font-medium">Client</th>
                      <th className="px-3 py-2 text-left font-medium">Action</th>
                      <th className="px-3 py-2 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenderTrackerPlan.tenders.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-foreground">{row.projectName}</td>
                        <td className="px-3 py-2 text-foreground">{row.clientName}</td>
                        <td className="px-3 py-2">
                          <RowActionBadge action={row.action} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.warnings.join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {contactsPlan?.stage === "ready" && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Row</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Action</th>
                      <th className="px-3 py-2 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactsPlan.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-foreground">{row.name ?? "(blank)"}</td>
                        <td className="px-3 py-2">
                          <RowActionBadge action={row.action} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.warnings.join(" ")}</td>
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
                <div className="flex flex-col gap-1 rounded-md border border-rag-amber/40 bg-rag-amber/15 p-3 text-sm text-foreground">
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
              <CheckCircle2 className="size-5 text-rag-green" />
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
