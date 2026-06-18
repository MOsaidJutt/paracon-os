"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

type Organisation = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

type ModuleStatus = { id: string; slug: string; label: string; description: string; enabled: boolean };

type OrgUser = { id: string; name: string; email: string; isActive: boolean; role: { name: string } };

export function OrganisationDetail({ organisation }: { organisation: Organisation }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: modulesData } = useQuery({
    queryKey: ["super-admin", "modules", organisation.id],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/organisations/${organisation.id}/modules`);
      if (!res.ok) throw new Error("Failed to load modules");
      return (await res.json()) as { modules: ModuleStatus[] };
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["super-admin", "users", organisation.id],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/organisations/${organisation.id}/users`);
      if (!res.ok) throw new Error("Failed to load users");
      return (await res.json()) as { users: OrgUser[] };
    },
  });

  const toggleModule = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      const res = await fetch(`/api/super-admin/organisations/${organisation.id}/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, enabled }),
      });
      if (!res.ok) throw new Error("Failed to update module");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "modules", organisation.id] }),
    onError: () => toast.error("Failed to update module"),
  });

  const toggleSuspend = useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await fetch(`/api/super-admin/organisations/${organisation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update organisation");
    },
    onSuccess: () => {
      toast.success("Organisation updated");
      queryClient.invalidateQueries({ queryKey: ["super-admin", "organisations"] });
      router.refresh();
    },
    onError: () => toast.error("Failed to update organisation"),
  });

  const impersonate = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/super-admin/impersonate/${userId}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to impersonate");
      }
    },
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{organisation.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">/{organisation.slug}</p>
        </div>
        <Badge variant={organisation.isActive ? "outline" : "secondary"}>
          {organisation.isActive ? "Active" : "Suspended"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modules</CardTitle>
          <CardDescription>Feature flags for this organisation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {modulesData?.modules.map((module) => (
            <div key={module.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{module.label}</span>
                <span className="text-xs text-muted-foreground">{module.description}</span>
              </div>
              <Switch
                checked={module.enabled}
                onCheckedChange={(checked) => toggleModule.mutate({ moduleId: module.id, enabled: checked })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>Impersonate for support — every session is audited.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {usersData?.users.map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {user.email} · {user.role.name}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!user.isActive || impersonate.isPending}
                onClick={() => impersonate.mutate(user.id)}
              >
                Impersonate
              </Button>
            </div>
          ))}
          {usersData?.users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users yet — invite is pending acceptance.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>
            {organisation.isActive
              ? "Suspending blocks every user in this org from signing in."
              : "Reactivating restores access immediately."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <Button
            variant={organisation.isActive ? "destructive" : "default"}
            disabled={toggleSuspend.isPending}
            onClick={() => toggleSuspend.mutate(!organisation.isActive)}
          >
            {organisation.isActive ? "Suspend organisation" : "Reactivate organisation"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
