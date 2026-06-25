"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ScopeLibraryItem } from "@/lib/documents/templates-config";
import type { GeneratedDocumentRow } from "./types";

type TradeCostLine = { name: string; costAmount: number };
type CustomScopeLine = { section: "Partitions & Doors" | "Ceiling"; code: string; label: string };

type TenderLetterSnapshotLike = {
  contactName: string;
  contactEmail: string;
  documentationReceivedDate: string | null;
  specifications: string;
  addendums: string;
  marginPct: number;
  tenderPrice: { tradeLines: { name: string; costAmount: number }[] };
  qualifications: string[];
  signOffName: string;
};

const FALLBACK_TRADE_PACKAGES = ["Partitions", "Doors", "Ceiling"];

export function TenderLetterFormDialog({
  open,
  onOpenChange,
  tenderId,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenderId: string;
  existing?: GeneratedDocumentRow | null;
}) {
  const queryClient = useQueryClient();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [documentationReceivedDate, setDocumentationReceivedDate] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [addendums, setAddendums] = useState("");
  const [marginPct, setMarginPct] = useState<string>("");
  const [tradeCostLines, setTradeCostLines] = useState<TradeCostLine[]>([]);
  const [checkedLibraryIds, setCheckedLibraryIds] = useState<Set<string>>(new Set());
  const [customScopeLines, setCustomScopeLines] = useState<CustomScopeLine[]>([]);
  const [qualificationsOverride, setQualificationsOverride] = useState("");
  const [signOffName, setSignOffName] = useState("");

  const { data: tenderData } = useQuery({
    queryKey: ["tender", tenderId],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}`);
      if (!res.ok) throw new Error("Failed to load tender");
      return (await res.json()) as {
        tender: { tradePackages: { name: string; contractValue: number }[] | null; contact: { name: string } | null };
      };
    },
  });

  const { data: templateData } = useQuery({
    queryKey: ["document-template", "TENDER_LETTER"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/documents/templates/TENDER_LETTER");
      if (!res.ok) throw new Error("Failed to load scope library");
      return (await res.json()) as { configJson: { scopeLibrary: ScopeLibraryItem[]; qualificationsLibrary: string[] } };
    },
  });

  useEffect(() => {
    if (!open) return;
    const snapshot = existing?.dataSnapshotJson as unknown as TenderLetterSnapshotLike | undefined;

    if (snapshot) {
      setContactName(snapshot.contactName);
      setContactEmail(snapshot.contactEmail);
      setDocumentationReceivedDate(snapshot.documentationReceivedDate ?? "");
      setSpecifications(snapshot.specifications);
      setAddendums(snapshot.addendums);
      setMarginPct(String(snapshot.marginPct));
      setTradeCostLines(snapshot.tenderPrice.tradeLines.map((l) => ({ name: l.name, costAmount: l.costAmount })));
      setQualificationsOverride(snapshot.qualifications.join("\n"));
      setSignOffName(snapshot.signOffName);
    } else {
      setContactName(tenderData?.tender.contact?.name ?? "");
      setContactEmail("");
      setDocumentationReceivedDate("");
      setSpecifications("");
      setAddendums("");
      setMarginPct("");
      const names = tenderData?.tender.tradePackages?.map((tp) => tp.name) ?? FALLBACK_TRADE_PACKAGES;
      setTradeCostLines(names.map((name) => ({ name, costAmount: 0 })));
      setQualificationsOverride("");
      setSignOffName("");
      setCheckedLibraryIds(new Set());
      setCustomScopeLines([]);
    }
  }, [open, existing, tenderData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        contactName,
        contactEmail,
        documentationReceivedDate: documentationReceivedDate || null,
        specifications,
        addendums,
        marginPct: marginPct ? Number(marginPct) : undefined,
        tradeCostLines,
        scopeLibraryItemIds: Array.from(checkedLibraryIds),
        customScopeLines: customScopeLines.filter((l) => l.label.trim()),
        qualifications: qualificationsOverride
          .split("\n")
          .map((q) => q.trim())
          .filter(Boolean),
        signOffName,
      };
      const url = existing ? `/api/documents/generated/${existing.id}/regenerate` : "/api/documents/generated/tender-letter";
      const body = existing ? payload : { ...payload, tenderId };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Failed to generate tender letter");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(existing ? "Tender letter regenerated" : "Tender letter generated");
      queryClient.invalidateQueries({ queryKey: ["generated-documents", { tenderId }] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const scopeLibrary = templateData?.configJson.scopeLibrary ?? [];
  const sections: Array<"Partitions & Doors" | "Ceiling"> = ["Partitions & Doors", "Ceiling"];

  function toggleLibraryItem(id: string) {
    setCheckedLibraryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSubmit = contactName.trim() && signOffName.trim() && tradeCostLines.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{existing ? `Regenerate ${existing.number}` : "Generate Tender Letter"}</SheetTitle>
          <SheetDescription>
            Company/project pulled from the tender. Margin defaults from your org&apos;s settings; the total is
            rounded up automatically per your configured rule.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tl-contact-name">Contact name</Label>
              <Input id="tl-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tl-contact-email">Contact email</Label>
              <Input id="tl-contact-email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tl-doc-received">Documentation received</Label>
              <Input
                id="tl-doc-received"
                type="date"
                value={documentationReceivedDate}
                onChange={(e) => setDocumentationReceivedDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tl-margin">Margin % (blank = org default)</Label>
              <Input id="tl-margin" type="number" placeholder="6" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tl-specifications">Specifications</Label>
              <Input id="tl-specifications" value={specifications} onChange={(e) => setSpecifications(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tl-addendums">Addendums</Label>
              <Input id="tl-addendums" value={addendums} onChange={(e) => setAddendums(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-none text-foreground">
              Trade pricing (cost — margin is applied automatically)
            </p>
            {tradeCostLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Trade ${i + 1} name`}
                  className="flex-1"
                  value={line.name}
                  onChange={(e) =>
                    setTradeCostLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, name: e.target.value } : l)))
                  }
                />
                <Input
                  aria-label={`Trade ${i + 1} cost`}
                  type="number"
                  className="w-32"
                  placeholder="Cost $"
                  value={line.costAmount || ""}
                  onChange={(e) =>
                    setTradeCostLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, costAmount: Number(e.target.value) } : l)))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => setTradeCostLines((lines) => lines.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setTradeCostLines((lines) => [...lines, { name: "", costAmount: 0 }])}
            >
              <Plus className="size-4" />
              Add trade
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-none text-foreground">Scope of works</p>
            {sections.map((section) => (
              <div key={section} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{section}</span>
                {scopeLibrary
                  .filter((item) => item.section === section)
                  .map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <Switch checked={checkedLibraryIds.has(item.id)} onCheckedChange={() => toggleLibraryItem(item.id)} />
                      <span>
                        {item.code ? <span className="font-medium">{item.code} — </span> : null}
                        {item.label}
                      </span>
                    </label>
                  ))}
              </div>
            ))}

            {customScopeLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Custom scope line ${i + 1} code`}
                  className="w-32"
                  placeholder="Code (optional)"
                  value={line.code}
                  onChange={(e) => setCustomScopeLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, code: e.target.value } : l)))}
                />
                <Input
                  aria-label={`Custom scope line ${i + 1} label`}
                  className="flex-1"
                  placeholder="Custom scope line"
                  value={line.label}
                  onChange={(e) => setCustomScopeLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, label: e.target.value } : l)))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => setCustomScopeLines((lines) => lines.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setCustomScopeLines((lines) => [...lines, { section: "Partitions & Doors", code: "", label: "" }])}
            >
              <Plus className="size-4" />
              Add custom scope line
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tl-qualifications">Qualifications (one per line — blank uses your org&apos;s standard list)</Label>
            <Textarea
              id="tl-qualifications"
              rows={4}
              placeholder={templateData?.configJson.qualificationsLibrary.join("\n")}
              value={qualificationsOverride}
              onChange={(e) => setQualificationsOverride(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tl-signoff-name">Sign-off name</Label>
            <Input id="tl-signoff-name" value={signOffName} onChange={(e) => setSignOffName(e.target.value)} />
          </div>
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Generating..." : existing ? "Regenerate" : "Generate"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
