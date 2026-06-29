"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ClientOption } from "@/components/contacts/client-combobox";
import type { GeneratedDocumentRow } from "./types";

type LineItem = { item: number; description: string; amount: number };

type VariationSnapshotLike = {
  attention: string;
  company: string;
  cc: string;
  from: string;
  introLine: string;
  lineItems: LineItem[];
  signOffName: string;
  signOffRole: string;
  signOffPhone: string;
};

const EMPTY: VariationSnapshotLike = {
  attention: "",
  company: "",
  cc: "",
  from: "",
  introLine: "Please find below various additional works undertaken outside of our contractual scope.",
  lineItems: [{ item: 1, description: "", amount: 0 }],
  signOffName: "",
  signOffRole: "Project Manager",
  signOffPhone: "",
};

export function VariationFormDialog({
  open,
  onOpenChange,
  projectId,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existing?: GeneratedDocumentRow | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VariationSnapshotLike>(EMPTY);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // Pulls from the same shared Contacts database as everywhere else, so
  // picking a different addressee here is a search, never a re-type.
  const { data: clientsData } = useQuery({
    queryKey: ["contacts", "clients"],
    enabled: clientPickerOpen,
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      return (await res.json()) as { clients: ClientOption[] };
    },
  });

  // Enter-once: the variation is almost always addressed to this project's
  // head contractor, so default "Company" from the client already on file
  // instead of asking the PM to retype it every time. Still freely editable
  // for the rare variation addressed elsewhere.
  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    enabled: open && !existing,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return (await res.json()) as { project: { client: { name: string } } };
    },
  });

  useEffect(() => {
    if (existing) {
      const snapshot = existing.dataSnapshotJson as unknown as VariationSnapshotLike;
      setForm({
        attention: snapshot.attention,
        company: snapshot.company,
        cc: snapshot.cc,
        from: snapshot.from,
        introLine: snapshot.introLine,
        lineItems: snapshot.lineItems,
        signOffName: snapshot.signOffName,
        signOffRole: snapshot.signOffRole,
        signOffPhone: snapshot.signOffPhone,
      });
    } else if (open) {
      setForm({ ...EMPTY, company: projectData?.project.client.name ?? "" });
    }
  }, [existing, open, projectData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const url = existing ? `/api/documents/generated/${existing.id}/regenerate` : "/api/documents/generated/variation";
      const body = existing ? form : { ...form, projectId };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Failed to generate variation");
      }
      return res.json();
    },
    onSuccess: async (data: { document?: { id: string } }) => {
      toast.success(existing ? "Variation regenerated" : "Variation generated");
      // Auto-adds the new document to the commercial Variations register (Phase 8) — never a separate manual step.
      if (!existing && data?.document?.id) {
        await fetch("/api/finance/variations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedDocumentId: data.document.id }),
        }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["generated-documents", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["finance", "variations", projectId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function updateLine(index: number, patch: Partial<LineItem>) {
    setForm((f) => ({ ...f, lineItems: f.lineItems.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
  }

  function addLine() {
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, { item: f.lineItems.length + 1, description: "", amount: 0 }] }));
  }

  function removeLine(index: number) {
    setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== index).map((l, i) => ({ ...l, item: i + 1 })) }));
  }

  const canSubmit =
    form.attention.trim() && form.company.trim() && form.from.trim() && form.lineItems.every((l) => l.description.trim() && l.amount > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{existing ? `Regenerate ${existing.number}` : "Generate Variation Quotation"}</SheetTitle>
          <SheetDescription>
            Project, address and ABN are pulled automatically. Numbered VQ-## per project, GST and total computed for you.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variation-attention">Attention</Label>
              <Input
                id="variation-attention"
                value={form.attention}
                onChange={(e) => setForm((f) => ({ ...f, attention: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variation-company">Company</Label>
              <div className="flex gap-1.5">
                <Input
                  id="variation-company"
                  className="flex-1"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Search contacts"
                  onClick={() => setClientPickerOpen(true)}
                >
                  <Search className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variation-cc">Cc</Label>
              <Input id="variation-cc" value={form.cc} onChange={(e) => setForm((f) => ({ ...f, cc: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variation-from">From</Label>
              <Input id="variation-from" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="variation-intro">Intro line</Label>
            <Textarea
              id="variation-intro"
              rows={2}
              value={form.introLine}
              onChange={(e) => setForm((f) => ({ ...f, introLine: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium leading-none text-foreground">Line items</p>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="size-4" />
                Add line
              </Button>
            </div>
            {form.lineItems.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-center text-sm text-muted-foreground">{line.item}</span>
                <Input
                  aria-label={`Line ${line.item} description`}
                  placeholder="Description"
                  className="flex-1"
                  value={line.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                />
                <Input
                  aria-label={`Line ${line.item} amount`}
                  type="number"
                  placeholder="$"
                  className="w-32"
                  value={line.amount || ""}
                  onChange={(e) => updateLine(i, { amount: Number(e.target.value) })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  disabled={form.lineItems.length === 1}
                  onClick={() => removeLine(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variation-signoff-name">Sign-off name</Label>
              <Input
                id="variation-signoff-name"
                value={form.signOffName}
                onChange={(e) => setForm((f) => ({ ...f, signOffName: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variation-signoff-role">Role</Label>
              <Input
                id="variation-signoff-role"
                value={form.signOffRole}
                onChange={(e) => setForm((f) => ({ ...f, signOffRole: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variation-signoff-phone">Phone</Label>
              <Input
                id="variation-signoff-phone"
                value={form.signOffPhone}
                onChange={(e) => setForm((f) => ({ ...f, signOffPhone: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Generating..." : existing ? "Regenerate" : "Generate"}
          </Button>
        </SheetFooter>

        <CommandDialog open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
          <CommandInput placeholder="Search clients..." />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            {(clientsData?.clients ?? []).map((client) => (
              <CommandItem
                key={client.id}
                value={client.name}
                onSelect={() => {
                  setForm((f) => ({ ...f, company: client.name }));
                  setClientPickerOpen(false);
                }}
              >
                {client.name}
              </CommandItem>
            ))}
          </CommandList>
        </CommandDialog>
      </SheetContent>
    </Sheet>
  );
}
