"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AuditTrail } from "@/components/audit/audit-trail";
import { DetailPanel } from "@/components/dashboard/simple/detail-panel";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import { nextActionState } from "@/lib/prospects/summary";
import { cn } from "@/lib/utils";
import type { ProspectRow } from "./types";

type Draft = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  estimatedValue: string;
  stage: string;
  probability: string;
  nextAction: string;
  nextActionDate: string;
  notes: string;
};

function toDraft(prospect: ProspectRow): Draft {
  return {
    name: prospect.name,
    contactName: prospect.contactName ?? "",
    contactEmail: prospect.contactEmail ?? "",
    contactPhone: prospect.contactPhone ?? "",
    address: prospect.address ?? "",
    estimatedValue: prospect.estimatedValue != null ? String(prospect.estimatedValue) : "",
    stage: prospect.stage,
    probability: prospect.probability != null ? String(prospect.probability) : "",
    nextAction: prospect.nextAction ?? "",
    // <input type="date"> wants YYYY-MM-DD.
    nextActionDate: prospect.nextActionDate ? prospect.nextActionDate.slice(0, 10) : "",
    notes: prospect.notes ?? "",
  };
}

/**
 * A lead, opened beside the register rather than on its own page.
 *
 * Read mode by default and edit in place, because most opens are to look
 * something up, not to change it. The same panel carries the record's own
 * activity trail, which is the client's "who changed what, when, on the record
 * itself" ask rather than a separate audit screen.
 */
export function ProspectDetailPanel({
  prospect,
  stageList,
  canEdit,
  onOpenChange,
  onConvert,
}: {
  prospect: ProspectRow | null;
  stageList: string[];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onConvert: (prospect: ProspectRow) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Reset to read mode whenever a different lead is opened, so an abandoned
  // edit never bleeds onto the next one.
  useEffect(() => {
    setEditing(false);
    setDraft(prospect ? toDraft(prospect) : null);
  }, [prospect]);

  const save = useMutation({
    mutationFn: async (values: Draft) => {
      const res = await fetch(`/api/prospects/${prospect!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          contactName: values.contactName || null,
          contactEmail: values.contactEmail || null,
          contactPhone: values.contactPhone || null,
          address: values.address || null,
          estimatedValue: values.estimatedValue ? Number(values.estimatedValue) : null,
          stage: values.stage,
          probability: values.probability ? Number(values.probability) : null,
          nextAction: values.nextAction || null,
          nextActionDate: values.nextActionDate || null,
          notes: values.notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save this lead");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prospects"] });
      // The trail gains a row on every save, so it has to be refetched too.
      queryClient.invalidateQueries({ queryKey: ["audit-trail", "Prospect", prospect?.id] });
      toast.success("Lead updated");
      setEditing(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const due = prospect ? nextActionState(prospect.nextActionDate) : "none";
  const isConverted = prospect?.convertedTenderId != null;

  return (
    <DetailPanel
      open={prospect !== null}
      onOpenChange={onOpenChange}
      title={prospect?.name ?? ""}
      description={prospect ? `${prospect.stage}${isConverted ? " · converted" : ""}` : undefined}
      footer={
        prospect &&
        canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={() => draft && save.mutate(draft)} disabled={save.isPending}>
                  {save.isPending ? "Saving..." : "Save changes"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(toDraft(prospect));
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                {!isConverted && (
                  <Button size="sm" onClick={() => onConvert(prospect)}>
                    Convert to tender
                  </Button>
                )}
              </>
            )}
          </div>
        )
      }
    >
      {prospect && draft && (
        <div className="flex flex-col gap-5">
          {editing ? (
            <div className="flex flex-col gap-3">
              <Field label="Company / lead name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Stage">
                  <Select value={draft.stage} onValueChange={(value) => setDraft({ ...draft, stage: value })}>
                    <SelectTrigger aria-label="Stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stageList.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Probability (%)">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.probability}
                    onChange={(e) => setDraft({ ...draft, probability: e.target.value })}
                  />
                </Field>
                <Field label="Contact name">
                  <Input
                    value={draft.contactName}
                    onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                  />
                </Field>
                <Field label="Contact phone">
                  <Input
                    value={draft.contactPhone}
                    onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Contact email">
                <Input
                  type="email"
                  value={draft.contactEmail}
                  onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                />
              </Field>
              <Field label="Address">
                <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              </Field>
              <Field label="Estimated value ($)">
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={draft.estimatedValue}
                  onChange={(e) => setDraft({ ...draft, estimatedValue: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-[1fr_10rem] gap-3">
                <Field label="Next action">
                  <Input
                    placeholder="Call to confirm scope"
                    value={draft.nextAction}
                    onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })}
                  />
                </Field>
                <Field label="Due">
                  <Input
                    type="date"
                    value={draft.nextActionDate}
                    onChange={(e) => setDraft({ ...draft, nextActionDate: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <Textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </Field>
            </div>
          ) : (
            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label="Contact" value={prospect.contactName ?? "Not set"} />
              <Row label="Email" value={prospect.contactEmail ?? "Not set"} />
              <Row label="Phone" value={prospect.contactPhone ?? "Not set"} />
              <Row label="Address" value={prospect.address ?? "Not set"} />
              <Row
                label="Estimated value"
                value={prospect.estimatedValue != null ? formatCurrency(prospect.estimatedValue) : "Not set"}
              />
              <Row label="Probability" value={prospect.probability != null ? `${prospect.probability}%` : "Not set"} />
            </dl>
          )}

          {!editing && (
            <section>
              <h3 className="mb-1.5 text-sm font-medium text-foreground">Next action</h3>
              {prospect.nextAction ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {prospect.nextAction}
                  {prospect.nextActionDate && (
                    <Badge
                      variant={due === "overdue" ? "destructive" : due === "today" ? "warning" : "outline"}
                      className="shrink-0"
                    >
                      {due === "overdue" ? "Overdue" : due === "today" ? "Due today" : formatDate(prospect.nextActionDate)}
                    </Badge>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing scheduled. A lead with no next action is a lead nobody is chasing.
                </p>
              )}
            </section>
          )}

          {!editing && prospect.notes && (
            <section>
              <h3 className="mb-1.5 text-sm font-medium text-foreground">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{prospect.notes}</p>
            </section>
          )}

          {!editing && <AuditTrail entityType="Prospect" entityId={prospect.id} />}
        </div>
      )}
    </DetailPanel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={cn("text-xs text-muted-foreground")}>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
