"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type PdfColors = { ink: string; paper: string; muted: string; accent: string; accentSoft: string };
type ScopeLibraryItem = { id: string; code: string | null; label: string; section: "Partitions & Doors" | "Ceiling"; defaultChecked: boolean };

type TemplateConfig =
  | { pdfColors: PdfColors; scopeLibrary: ScopeLibraryItem[]; qualificationsLibrary: string[] }
  | { pdfColors: PdfColors };

type TemplateEntry = { type: "TENDER_LETTER" | "VARIATION" | "PROGRESS_CLAIM"; configJson: TemplateConfig; isCustomised: boolean };

const TYPE_LABEL: Record<TemplateEntry["type"], string> = {
  TENDER_LETTER: "Tender Letter",
  VARIATION: "Variation",
  PROGRESS_CLAIM: "Progress Claim",
};

function ColorRow({
  idPrefix,
  colors,
  onChange,
}: {
  idPrefix: string;
  colors: PdfColors;
  onChange: (colors: PdfColors) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {(Object.keys(colors) as (keyof PdfColors)[]).map((key) => (
        <div key={key} className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-${key}`} className="text-xs capitalize">
            {key}
          </Label>
          <div className="flex items-center gap-1.5">
            <input
              id={`${idPrefix}-${key}`}
              type="color"
              value={colors[key]}
              onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
              className="size-8 rounded border border-border"
            />
            <Input
              aria-label={`${key} hex value`}
              value={colors[key]}
              onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
              className="text-xs"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TenderLetterEditor({
  config,
  onChange,
}: {
  config: { pdfColors: PdfColors; scopeLibrary: ScopeLibraryItem[]; qualificationsLibrary: string[] };
  onChange: (config: { pdfColors: PdfColors; scopeLibrary: ScopeLibraryItem[]; qualificationsLibrary: string[] }) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ColorRow idPrefix="tender-letter-color" colors={config.pdfColors} onChange={(pdfColors) => onChange({ ...config, pdfColors })} />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium leading-none text-foreground">Scope-builder library</p>
        <p className="text-xs text-muted-foreground">
          Reusable scope lines an estimator checks per Tender Letter (e.g. P1-P4 partitions, PB1-PB5 ceiling
          types). Estimators can still add one-off custom lines per letter.
        </p>
        {config.scopeLibrary.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <Switch
              checked={item.defaultChecked}
              onCheckedChange={(checked) =>
                onChange({
                  ...config,
                  scopeLibrary: config.scopeLibrary.map((it, idx) => (idx === i ? { ...it, defaultChecked: checked } : it)),
                })
              }
            />
            <Input
              aria-label="Scope item code"
              className="w-24"
              placeholder="Code"
              value={item.code ?? ""}
              onChange={(e) =>
                onChange({
                  ...config,
                  scopeLibrary: config.scopeLibrary.map((it, idx) => (idx === i ? { ...it, code: e.target.value || null } : it)),
                })
              }
            />
            <Input
              aria-label="Scope item label"
              className="flex-1"
              value={item.label}
              onChange={(e) =>
                onChange({
                  ...config,
                  scopeLibrary: config.scopeLibrary.map((it, idx) => (idx === i ? { ...it, label: e.target.value } : it)),
                })
              }
            />
            <Select
              value={item.section}
              onValueChange={(section: ScopeLibraryItem["section"]) =>
                onChange({ ...config, scopeLibrary: config.scopeLibrary.map((it, idx) => (idx === i ? { ...it, section } : it)) })
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Partitions & Doors">Partitions & Doors</SelectItem>
                <SelectItem value="Ceiling">Ceiling</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() => onChange({ ...config, scopeLibrary: config.scopeLibrary.filter((_, idx) => idx !== i) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            onChange({
              ...config,
              scopeLibrary: [
                ...config.scopeLibrary,
                { id: crypto.randomUUID(), code: null, label: "", section: "Partitions & Doors", defaultChecked: false },
              ],
            })
          }
        >
          <Plus className="size-4" />
          Add scope item
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tender-letter-qualifications">Qualifications library (one per line)</Label>
        <Textarea
          id="tender-letter-qualifications"
          rows={5}
          value={config.qualificationsLibrary.join("\n")}
          onChange={(e) => onChange({ ...config, qualificationsLibrary: e.target.value.split("\n").filter((l) => l.trim()) })}
        />
      </div>
    </div>
  );
}

function TemplateCard({ entry }: { entry: TemplateEntry }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TemplateConfig>(entry.configJson);

  useEffect(() => setDraft(entry.configJson), [entry.configJson]);

  const save = useMutation({
    mutationFn: async (configJson: TemplateConfig) => {
      const res = await fetch(`/api/admin/document-templates/${entry.type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configJson),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
    },
    onSuccess: () => {
      toast.success(`${TYPE_LABEL[entry.type]} template saved`);
      queryClient.invalidateQueries({ queryKey: ["admin", "document-templates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{TYPE_LABEL[entry.type]}</CardTitle>
        <CardDescription>
          {entry.isCustomised ? "Customised for your organisation." : "Using the built-in default — save to customise."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {entry.type === "TENDER_LETTER" ? (
          <TenderLetterEditor
            config={draft as { pdfColors: PdfColors; scopeLibrary: ScopeLibraryItem[]; qualificationsLibrary: string[] }}
            onChange={setDraft}
          />
        ) : (
          <ColorRow
            idPrefix={`${entry.type.toLowerCase()}-color`}
            colors={draft.pdfColors}
            onChange={(pdfColors) => setDraft({ ...draft, pdfColors })}
          />
        )}

        <Button size="sm" className="self-start" disabled={save.isPending} onClick={() => save.mutate(draft)}>
          {save.isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function DocumentTemplatesEditor() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "document-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/document-templates");
      if (!res.ok) throw new Error("Failed to load document templates");
      return (await res.json()) as { templates: TemplateEntry[] };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      {data?.templates.map((entry) => (
        <TemplateCard key={entry.type} entry={entry} />
      ))}
    </div>
  );
}
