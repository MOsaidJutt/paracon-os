"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MetricEntry = { key: string; label: string; weight: number; scaleMax: number; source: "AUTO" | "MANUAL" };
type ChecklistEntry = { key: string; label: string; cadence: "DAILY" | "WEEKLY" };

type ConfigEntry = {
  key: string;
  group: string;
  type: "LIST" | "NUMBER" | "WEIGHTS" | "BANDS" | "TEXT" | "METRICS" | "CHECKLIST";
  label: string;
  description: string;
  value: unknown;
  isOverridden: boolean;
};

/** Stable storage key for a new checklist row, derived from its label so a tick keeps matching if the label is later reworded. */
function slugifyChecklistKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `item-${Date.now()}`
  );
}

function ConfigCard({
  entry,
  apiBase,
  queryKey,
  allowReset,
}: {
  entry: ConfigEntry;
  apiBase: string;
  queryKey: string[];
  allowReset: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<unknown>(entry.value);

  const save = useMutation({
    mutationFn: async (value: unknown) => {
      const res = await fetch(`${apiBase}/${entry.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
    },
    onSuccess: () => {
      toast.success(`${entry.label} saved`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiBase}/${entry.key}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reset");
    },
    onSuccess: () => {
      toast.success(`${entry.label} reset to platform default`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Failed to reset"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{entry.label}</CardTitle>
          {entry.isOverridden && <Badge variant="outline">Overridden</Badge>}
        </div>
        <CardDescription>{entry.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entry.type === "LIST" && (
          <Textarea
            rows={4}
            value={(draft as string[]).join("\n")}
            onChange={(e) => setDraft(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          />
        )}

        {entry.type === "NUMBER" && (
          <Input
            type="number"
            value={draft as number}
            onChange={(e) => setDraft(Number(e.target.value))}
          />
        )}

        {entry.type === "TEXT" && (
          <Input
            type="text"
            value={draft as string}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}

        {entry.type === "WEIGHTS" && (
          <div className="flex flex-col gap-2">
            {Object.entries(draft as Record<string, number>).map(([label, weight]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-40 text-sm text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  step="0.05"
                  value={weight}
                  onChange={(e) =>
                    setDraft((current: Record<string, number>) => ({
                      ...current,
                      [label]: Number(e.target.value),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {entry.type === "BANDS" && (
          <div className="flex flex-col gap-2">
            {(draft as { label: string; max: number | null }[]).map((band, i) => (
              <div key={band.label} className="flex items-center gap-2">
                <span className="w-32 text-sm text-muted-foreground">{band.label}</span>
                <Input
                  type="number"
                  placeholder="No max"
                  value={band.max ?? ""}
                  onChange={(e) =>
                    setDraft((current: { label: string; max: number | null }[]) =>
                      current.map((b, idx) => (idx === i ? { ...b, max: e.target.value ? Number(e.target.value) : null } : b))
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* `key` is intentionally not editable here — it's the auto-fill mapping and the storage key inside every past StaffScore.metricScoresJson; renaming it would orphan history. Add/remove rows from the database directly if the metric set itself needs to change. */}
        {entry.type === "METRICS" && (
          <div className="flex flex-col gap-2">
            {(draft as MetricEntry[]).map((metric, i) => (
              <div key={metric.key} className="grid grid-cols-[1fr_5rem_5rem_7rem] items-center gap-2">
                <Input
                  value={metric.label}
                  onChange={(e) =>
                    setDraft((current: MetricEntry[]) =>
                      current.map((m, idx) => (idx === i ? { ...m, label: e.target.value } : m))
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.05"
                  placeholder="Weight"
                  value={metric.weight}
                  onChange={(e) =>
                    setDraft((current: MetricEntry[]) =>
                      current.map((m, idx) => (idx === i ? { ...m, weight: Number(e.target.value) } : m))
                    )
                  }
                />
                <Input
                  type="number"
                  placeholder="Scale max"
                  value={metric.scaleMax}
                  onChange={(e) =>
                    setDraft((current: MetricEntry[]) =>
                      current.map((m, idx) => (idx === i ? { ...m, scaleMax: Number(e.target.value) } : m))
                    )
                  }
                />
                <Select
                  value={metric.source}
                  onValueChange={(value) =>
                    setDraft((current: MetricEntry[]) =>
                      current.map((m, idx) => (idx === i ? { ...m, source: value as "AUTO" | "MANUAL" } : m))
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {/* Unlike METRICS, rows here are add/removable: a checklist is meant to
            be edited by the people who use it, and `key` is derived from the
            label rather than typed, so nobody has to think about storage keys. */}
        {entry.type === "CHECKLIST" && (
          <div className="flex flex-col gap-2">
            {(draft as ChecklistEntry[]).map((item, i) => (
              <div key={item.key} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
                <Input
                  value={item.label}
                  aria-label="Checklist item"
                  onChange={(e) =>
                    setDraft((current: ChecklistEntry[]) =>
                      current.map((c, idx) => (idx === i ? { ...c, label: e.target.value } : c))
                    )
                  }
                />
                <Select
                  value={item.cadence}
                  onValueChange={(value) =>
                    setDraft((current: ChecklistEntry[]) =>
                      current.map((c, idx) => (idx === i ? { ...c, cadence: value as ChecklistEntry["cadence"] } : c))
                    )
                  }
                >
                  <SelectTrigger aria-label="Cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${item.label || "item"}`}
                  onClick={() => setDraft((current: ChecklistEntry[]) => current.filter((_, idx) => idx !== i))}
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
                setDraft((current: ChecklistEntry[]) => [
                  ...current,
                  { key: `item-${Date.now()}`, label: "", cadence: "DAILY" as const },
                ])
              }
            >
              <Plus className="size-4" /> Add item
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                entry.type === "CHECKLIST"
                  ? (draft as ChecklistEntry[])
                      .filter((item) => item.label.trim().length > 0)
                      .map((item) => ({
                        ...item,
                        label: item.label.trim(),
                        key: item.key.startsWith("item-") ? slugifyChecklistKey(item.label) : item.key,
                      }))
                  : draft
              )
            }
          >
            {save.isPending ? "Saving..." : "Save"}
          </Button>
          {allowReset && entry.isOverridden && (
            <Button size="sm" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
              Reset to platform default
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ConfigEditor({
  apiBase = "/api/admin/config",
  queryKey = ["admin", "config"],
  allowReset = true,
}: {
  apiBase?: string;
  queryKey?: string[];
  allowReset?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error("Failed to load settings");
      return (await res.json()) as { configs: ConfigEntry[] };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      {data?.configs.map((entry) => (
        <ConfigCard key={entry.key} entry={entry} apiBase={apiBase} queryKey={queryKey} allowReset={allowReset} />
      ))}
    </div>
  );
}
