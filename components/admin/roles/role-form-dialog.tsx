"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

type Permission = { id: string; slug: string; group: string; label: string; description: string };

export type RoleRow = {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  userCount: number;
  pendingInviteCount: number;
  permissionSlugs: string[];
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  permissionSlugs: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

function groupLabel(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!role;

  const { data: permissionsData } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error("Failed to load permissions");
      return (await res.json()) as { permissions: Permission[] };
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", permissionSlugs: [] },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: role?.name ?? "", permissionSlugs: role?.permissionSlugs ?? [] });
    }
  }, [open, role, form]);

  const selected = form.watch("permissionSlugs");

  function toggle(slug: string, checked: boolean) {
    const current = form.getValues("permissionSlugs");
    form.setValue(
      "permissionSlugs",
      checked ? [...current, slug] : current.filter((s) => s !== slug)
    );
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const url = isEdit ? `/api/admin/roles/${role!.id}` : "/api/admin/roles";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isEdit ? "Role updated" : "Role created");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const groups = Array.from(new Set((permissionsData?.permissions ?? []).map((p) => p.group)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit role" : "Create role"}</DialogTitle>
          <DialogDescription>
            Choose exactly the permission slugs this role should carry. Users with this role see
            only the nav and screens those slugs unlock.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Site Supervisor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group} className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">{groupLabel(group)}</p>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    {permissionsData?.permissions
                      .filter((p) => p.group === group)
                      .map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between rounded-md border border-border p-2.5"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">{permission.label}</span>
                            <span className="text-xs text-muted-foreground">{permission.slug}</span>
                          </div>
                          <Switch
                            checked={selected.includes(permission.slug)}
                            onCheckedChange={(checked) => toggle(permission.slug, checked)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
