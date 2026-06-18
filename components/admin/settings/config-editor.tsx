"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ConfigEntry = {
  key: string;
  group: string;
  type: "LIST" | "NUMBER" | "WEIGHTS" | "BANDS";
  label: string;
  description: string;
  value: unknown;
  isOverridden: boolean;
};

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

        <div className="flex items-center gap-2">
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(draft)}>
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
