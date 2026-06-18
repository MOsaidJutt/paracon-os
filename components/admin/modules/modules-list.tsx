"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type ModuleStatus = { id: string; slug: string; label: string; description: string; enabled: boolean };

export function ModulesList() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "modules"],
    queryFn: async () => {
      const res = await fetch("/api/admin/modules");
      if (!res.ok) throw new Error("Failed to load modules");
      return (await res.json()) as { modules: ModuleStatus[] };
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      const res = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, enabled }),
      });
      if (!res.ok) throw new Error("Failed to update module");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "modules"] }),
    onError: () => toast.error("Failed to update module"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modules</CardTitle>
        <CardDescription>
          Turn product modules on or off for your organisation. Disabling a module hides its nav and
          blocks its routes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {data?.modules.map((module) => (
          <div key={module.id} className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{module.label}</span>
              <span className="text-xs text-muted-foreground">{module.description}</span>
            </div>
            <Switch
              checked={module.enabled}
              onCheckedChange={(checked) => toggle.mutate({ moduleId: module.id, enabled: checked })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
